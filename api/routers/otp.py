"""
OTP router – send and verify one-time passwords via email.
Used by the Forgot Password flow on the frontend.

SMTP credentials are read from environment variables:
  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM
"""

import os
import random
import smtplib
import string
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Dict

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from loguru import logger

router = APIRouter(prefix="/otp", tags=["otp"])

# ── In-memory OTP store  { email -> {otp, expires_at} } ──────────────────────
# Fine for single-process deployments; swap for Redis in multi-instance setups.
_otp_store: Dict[str, dict] = {}

OTP_EXPIRY_SECONDS = 60


# ── Helpers ───────────────────────────────────────────────────────────────────

def _generate_otp(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


def _smtp_config() -> dict:
    return {
        "host": os.getenv("SMTP_HOST", "smtp.gmail.com"),
        "port": int(os.getenv("SMTP_PORT", "587")),
        "user": os.getenv("SMTP_USER", ""),
        "password": os.getenv("SMTP_PASSWORD", ""),
        "from_addr": os.getenv("SMTP_FROM", os.getenv("SMTP_USER", "")),
    }


def _send_email(to: str, subject: str, html_body: str) -> None:
    cfg = _smtp_config()

    if not cfg["user"] or not cfg["password"]:
        raise RuntimeError(
            "SMTP credentials not configured. "
            "Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM in .env"
        )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = cfg["from_addr"]
    msg["To"] = to
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(cfg["host"], cfg["port"]) as server:
        server.ehlo()
        server.starttls()
        server.login(cfg["user"], cfg["password"])
        server.sendmail(cfg["from_addr"], [to], msg.as_string())


def _otp_email_html(otp: str) -> str:
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;
                background:#f8faff;border-radius:12px;border:1px solid #e0e7ff;">
      <div style="text-align:center;margin-bottom:24px;">
        <img src="cid:logo" alt="Kavach" style="height:40px;" />
        <h2 style="color:#1e3a8a;margin:8px 0 0;">kavach</h2>
      </div>
      <h3 style="color:#1e293b;text-align:center;">Your One-Time Password</h3>
      <p style="color:#475569;text-align:center;font-size:14px;">
        Use the code below to reset your password. It expires in <strong>60 seconds</strong>.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <span style="display:inline-block;letter-spacing:10px;font-size:36px;font-weight:700;
                     color:#2563eb;background:#eff6ff;padding:16px 28px;border-radius:10px;
                     border:2px dashed #93c5fd;">
          {otp}
        </span>
      </div>
      <p style="color:#94a3b8;font-size:12px;text-align:center;">
        If you did not request this, please ignore this email.
      </p>
    </div>
    """


# ── Request / Response models ─────────────────────────────────────────────────

class SendOTPRequest(BaseModel):
    email: EmailStr


class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/send")
async def send_otp(body: SendOTPRequest):
    """
    Generate a 6-digit OTP, store it server-side, and email it to the user.
    No authentication required (this is the pre-login flow).
    """
    email = body.email.lower()
    otp = _generate_otp()
    expires_at = datetime.utcnow() + timedelta(seconds=OTP_EXPIRY_SECONDS)
    _otp_store[email] = {"otp": otp, "expires_at": expires_at}

    logger.info(f"[OTP] Generated OTP for {email} (expires {expires_at.isoformat()})")

    try:
        _send_email(
            to=email,
            subject="Kavach – Your Password Reset OTP",
            html_body=_otp_email_html(otp),
        )
        logger.success(f"[OTP] Email sent to {email}")
    except Exception as exc:
        logger.error(f"[OTP] Failed to send email to {email}: {exc}")
        # Remove stored OTP so the user can retry
        _otp_store.pop(email, None)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send OTP email: {str(exc)}",
        )

    return {"message": "OTP sent successfully", "expires_in": OTP_EXPIRY_SECONDS}


@router.post("/verify")
async def verify_otp(body: VerifyOTPRequest):
    """
    Verify the OTP submitted by the user.
    Returns 200 on success, 400 on invalid/expired OTP.
    """
    email = body.email.lower()
    record = _otp_store.get(email)

    if not record:
        raise HTTPException(status_code=400, detail="No OTP found for this email. Please request a new one.")

    if datetime.utcnow() > record["expires_at"]:
        _otp_store.pop(email, None)
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new one.")

    if record["otp"] != body.otp.strip():
        raise HTTPException(status_code=400, detail="Invalid OTP. Please try again.")

    # OTP is valid — keep it briefly so the reset-password step can confirm the session
    return {"message": "OTP verified successfully"}


@router.delete("/clear")
async def clear_otp(body: SendOTPRequest):
    """Remove OTP after password has been successfully reset."""
    _otp_store.pop(body.email.lower(), None)
    return {"message": "OTP cleared"}
