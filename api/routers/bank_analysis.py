"""
Bank Statement Analysis API endpoint.
Uses the bank_statement pipeline to extract and analyze PDF bank statements.
"""
import json
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from loguru import logger
from pydantic import BaseModel

from open_notebook.domain.notebook import Source
from open_notebook.database.repository import repo_query

router = APIRouter()


# ---------------------------------------------------------------------------
# Analysis cache helpers (shared by bank + mobile analysis)
# ---------------------------------------------------------------------------

async def _load_cached_analysis(source_id: str, analysis_type: str) -> dict | None:
    """Load a previously saved analysis result from the database.

    Uses the same deterministic record ID as _save_cached_analysis so we always
    read the exact record that belongs to this source — never a stale row from
    a different source.
    """
    import hashlib
    key = f"{source_id}:{analysis_type}"
    record_id = "analysis_cache:" + hashlib.sha256(key.encode()).hexdigest()[:32]
    try:
        rows = await repo_query(
            "SELECT result FROM $rid",
            {"rid": record_id},
        )
        if rows and rows[0].get("result"):
            logger.info(f"[AnalysisCache] HIT for {source_id} / {analysis_type} → {record_id}")
            return rows[0]["result"]
    except Exception as e:
        logger.warning(f"[AnalysisCache] Load failed for {source_id}: {e}")
    return None


async def _save_cached_analysis(source_id: str, analysis_type: str, result: dict) -> None:
    """Upsert an analysis result into the database cache.

    Uses a deterministic record ID derived from source_id + analysis_type so that
    UPSERT always targets the same record for a given source — preventing duplicate
    cache rows and ensuring each source has its own isolated cache entry.

    Also deletes any legacy rows (created by the old broken UPSERT) that match
    source_id + analysis_type but have a non-deterministic auto-generated ID,
    so stale data from a different source can never be returned.
    """
    import hashlib
    # Build a stable record ID: analysis_cache:<hex(source_id:analysis_type)>
    key = f"{source_id}:{analysis_type}"
    record_id = "analysis_cache:" + hashlib.sha256(key.encode()).hexdigest()[:32]
    try:
        # Delete any legacy rows for this source that have random auto-IDs
        # (created before the deterministic-ID fix was applied).
        await repo_query(
            "DELETE analysis_cache WHERE source_id = $sid AND analysis_type = $atype AND id != $rid",
            {"sid": source_id, "atype": analysis_type, "rid": record_id},
        )
        await repo_query(
            """
            UPSERT $rid
            SET source_id = $sid,
                analysis_type = $atype,
                result = $result,
                updated = time::now()
            """,
            {"rid": record_id, "sid": source_id, "atype": analysis_type, "result": result},
        )
        logger.info(f"[AnalysisCache] Saved for {source_id} / {analysis_type} → {record_id}")
    except Exception as e:
        logger.warning(f"[AnalysisCache] Save failed for {source_id}: {e}")


# ---------------------------------------------------------------------------
# Helper: parse already-structured pipeline output back into result dict
# ---------------------------------------------------------------------------

def _parse_structured_output(text: str) -> dict:
    """
    Parse the structured text format produced by a previous pipeline run
    (starts with '=== ACCOUNT DETAILS ===') back into a result dict
    using the exact key names that BankAnalysisContent expects.
    """
    import re

    # ── Account details ──────────────────────────────────────────────────────
    account_details: dict = {}
    acct_m = re.search(r'=== ACCOUNT DETAILS ===(.*?)(?===|\Z)', text, re.DOTALL)
    if acct_m:
        for line in acct_m.group(1).strip().splitlines():
            if ':' in line:
                k, _, v = line.partition(':')
                account_details[k.strip()] = v.strip()

    # Build details object matching what BankAnalysisContent reads
    details = {
        "title": account_details.get("Bank", "Bank Statement"),
        "fields": [{"label": k, "value": v} for k, v in account_details.items()],
        "issuer_lines": [account_details.get("Bank", "")] if account_details.get("Bank") else [],
        "customer_lines": [
            account_details.get("Account Holder", ""),
            account_details.get("Statement Period", ""),
        ],
    }

    # ── Cash flow → cashflow key ─────────────────────────────────────────────
    cashflow: dict = {}
    cf_m = re.search(r'=== CASH FLOW SUMMARY ===(.*?)(?===|\Z)', text, re.DOTALL)
    if cf_m:
        for line in cf_m.group(1).strip().splitlines():
            if ':' in line:
                k, _, v = line.partition(':')
                key_map = {
                    "total credit": "total_credit",
                    "total debit": "total_debit",
                    "net": "net",
                    "opening balance": "opening_balance",
                    "closing balance": "closing_balance",
                }
                mapped = key_map.get(k.strip().lower())
                if mapped:
                    cashflow[mapped] = v.strip().replace(",", "")

    # ── Monthly summary → monthly key ────────────────────────────────────────
    monthly: list = []
    ms_m = re.search(r'=== MONTHLY SUMMARY ===(.*?)(?===|\Z)', text, re.DOTALL)
    if ms_m:
        for line in ms_m.group(1).strip().splitlines():
            parts = [p.strip() for p in line.split('|')]
            if len(parts) >= 4:
                def _num(s: str) -> str:
                    try:
                        raw = re.sub(r'[^\d.\-]', '', s.split(':', 1)[-1])
                        return f"{float(raw):,.2f}"
                    except Exception:
                        return "0.00"
                monthly.append({
                    "month":   parts[0],
                    "credit":  _num(parts[1]),
                    "debit":   _num(parts[2]),
                    "balance": _num(parts[3]),
                })

    # ── Transactions ─────────────────────────────────────────────────────────
    transactions: list = []
    tx_m = re.search(r'=== TRANSACTIONS ===(.*?)(?===|\Z)', text, re.DOTALL)
    if tx_m:
        for line in tx_m.group(1).strip().splitlines():
            line = line.strip()
            if not line:
                continue
            parts = [p.strip() for p in line.split('|')]
            if len(parts) >= 4:
                def _f(s: str) -> str:
                    try:
                        return f"{abs(float(re.sub(r'[^\d.\-]', '', s))):,.2f}"
                    except Exception:
                        return "0.00"
                raw_amount = parts[2] if len(parts) > 2 else "0"
                is_debit = float(re.sub(r'[^\d.\-]', '', raw_amount) or "0") < 0
                transactions.append({
                    "date":         parts[0] if len(parts) > 0 else "",
                    "description":  parts[1] if len(parts) > 1 else "",
                    "debit":        _f(raw_amount) if is_debit else "0.00",
                    "credit":       _f(raw_amount) if not is_debit else "0.00",
                    "balance":      _f(parts[4]) if len(parts) > 4 else "0.00",
                    "type":         parts[5] if len(parts) > 5 else "Other",
                    "nlp_keywords": "",
                })

    total = len(transactions) if transactions else len(monthly)

    logger.info(
        f"[_parse_structured_output] parsed {total} transactions, "
        f"{len(monthly)} monthly rows, cashflow keys: {list(cashflow.keys())}"
    )

    return {
        "total_transactions": total,
        "details":            details,
        "cashflow":           cashflow if cashflow else None,
        "monthly":            monthly if monthly else None,
        "transactions":       transactions if transactions else None,
        # Empty sections — dialog handles None gracefully
        "types":              None,
        "atm":                None,
        "charges":            None,
        "interest":           None,
        "frequency":          None,
        "high_value":         None,
        "balance_trend":      None,
        "pattern":            None,
        "nlp_groups":         None,
    }


# ---------------------------------------------------------------------------
# Bank Statement Config API
# ---------------------------------------------------------------------------

class ConfigUpdateRequest(BaseModel):
    value: Any


@router.get("/bank-statement/config")
async def get_bank_config():
    """Get all bank statement configuration values (DB overrides + defaults)."""
    try:
        from open_notebook.bank_statement.settings import get_all_settings, get_schema
        settings = await get_all_settings()
        schema = get_schema()
        return {
            "settings": settings,
            "schema": {k: v["description"] for k, v in schema.items()},
        }
    except Exception as e:
        logger.error(f"Failed to get bank config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/bank-statement/config/{key}")
async def get_bank_config_key(key: str):
    """Get a single bank statement config value."""
    try:
        from open_notebook.bank_statement.settings import get_setting, get_schema
        schema = get_schema()
        if key not in schema:
            raise HTTPException(status_code=404, detail=f"Unknown config key: '{key}'")
        value = await get_setting(key)
        return {"key": key, "value": value, "description": schema[key]["description"]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/bank-statement/config/{key}")
async def set_bank_config_key(key: str, request: ConfigUpdateRequest):
    """Override a bank statement config value in the database."""
    try:
        from open_notebook.bank_statement.settings import set_setting
        await set_setting(key, request.value)
        return {"key": key, "value": request.value, "status": "saved"}
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/bank-statement/config/{key}")
async def reset_bank_config_key(key: str):
    """Reset a bank statement config value to its default."""
    try:
        from open_notebook.bank_statement.settings import reset_setting, get_schema
        schema = get_schema()
        if key not in schema:
            raise HTTPException(status_code=404, detail=f"Unknown config key: '{key}'")
        await reset_setting(key)
        return {"key": key, "status": "reset_to_default", "default": schema[key]["default"]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sources/{source_id}/bank-analysis")
async def get_bank_analysis_cached(source_id: str):
    """
    Return the cached bank statement analysis result for a source.
    Returns 404 if no analysis has been run yet.
    """
    cached = await _load_cached_analysis(source_id, "bank_statement")
    if cached is None:
        raise HTTPException(
            status_code=404,
            detail="No cached analysis found. Run the analysis first via POST."
        )
    return cached


@router.post("/sources/{source_id}/bank-analysis")
async def analyze_bank_statement(source_id: str, force_refresh: bool = False):
    """
    Run the full bank statement analysis pipeline on a source.
    Returns structured data: transactions, monthly summary, cash flow, ATM report, etc.
    Results are cached in the database — subsequent calls return the cached result
    unless force_refresh=true is passed.
    """
    try:
        # ── Return cached result if available and not forcing refresh ────────
        if not force_refresh:
            cached = await _load_cached_analysis(source_id, "bank_statement")
            if cached is not None:
                logger.info(f"[BankAnalysis] Returning cached result for {source_id}")
                return cached
        source = await Source.get(source_id)
        if not source:
            raise HTTPException(status_code=404, detail="Source not found")

        # Get file path from source asset
        file_path = None
        if source.asset and source.asset.file_path:
            file_path = source.asset.file_path

        if not file_path:
            raise HTTPException(
                status_code=400,
                detail="Source has no uploaded file. Bank analysis requires a PDF file."
            )

        logger.info(f"Running bank statement analysis for source {source_id}, file: {file_path}")

        # Resolve relative paths to absolute using the project root.
        import os
        if not os.path.isabs(file_path):
            project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            file_path = os.path.normpath(os.path.join(project_root, file_path))

        file_exists = os.path.exists(file_path)
        if not file_exists:
            logger.warning(f"File not found on disk: {file_path} — will attempt text-only mode")
            # Do NOT search the uploads folder for any random PDF — that would
            # return data from a completely different source.  Instead we fall
            # through to the text-only path below which uses source.full_text.

        logger.info(f"Resolved file path: {file_path} | exists={file_exists}")

        from open_notebook.bank_statement.pipeline import run_pipeline_async

        full_text = source.full_text if source.full_text else None
        logger.info(f"source.full_text length: {len(full_text) if full_text else 0}")

        # If full_text is already structured pipeline output, always re-run from file
        # to get fresh transaction data. Pass raw text only if it's actual bank statement text.
        is_already_structured = bool(
            full_text and (
                full_text.strip().startswith("=== ACCOUNT DETAILS") or
                full_text.strip().startswith("=== CASH FLOW")
            )
        )

        if not file_exists:
            # File missing — run in text-only mode using stored full_text
            if full_text and len(full_text.strip()) > 100:
                logger.info("File missing — running pipeline in text-only mode using source.full_text")
                # If full_text is already structured pipeline output, parse it directly
                # instead of re-running the full pipeline (which needs the file)
                if is_already_structured:
                    logger.info("full_text is structured output — parsing directly without file")
                    result = _parse_structured_output(full_text)
                else:
                    result = await run_pipeline_async(None, full_text)
            else:
                raise HTTPException(
                    status_code=404,
                    detail=(
                        "The original file is no longer available on disk and no extracted text "
                        "is stored for this source. Please re-upload the file."
                    )
                )
        elif is_already_structured:
            # full_text is a previous pipeline output — run fresh from file
            logger.info("full_text is structured output — running pipeline on file directly")
            result = await run_pipeline_async(file_path, None)
        elif full_text and len(full_text.strip()) > 100:
            # Raw extracted text — pass to avoid re-OCR
            logger.info("Using source.full_text as raw text (no OCR needed)")
            result = await run_pipeline_async(file_path, full_text)
        else:
            # No stored text — run full extraction
            logger.info("source.full_text is empty — running file extraction")
            result = await run_pipeline_async(file_path, None)

        total = result.get('total_transactions', 0)
        logger.info(f"Bank analysis complete: {total} transactions")

        # Detect blank/unreadable PDF — only error if we have NO data at all
        has_monthly = bool(result.get('monthly') or result.get('monthly_summary'))
        has_cashflow = bool(result.get('cashflow') or result.get('cash_flow'))
        if total == 0 and not has_monthly and not has_cashflow:
            raise HTTPException(
                status_code=422,
                detail=(
                    "No transactions could be extracted from this PDF. "
                    "This usually means the PDF is image-based (scanned) without OCR, "
                    "or was created using 'Print to PDF' from a protected document. "
                    "Please download the original PDF directly from your bank's app or website "
                    "and upload that file instead."
                )
            )

        # ── Persist result to database cache ─────────────────────────────────
        await _save_cached_analysis(source_id, "bank_statement", result)

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Bank analysis failed for {source_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Bank analysis failed: {str(e)}")
