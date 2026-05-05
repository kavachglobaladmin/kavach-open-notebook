"""
Heuristic parsing of mobile / CDR style dumps (CSV, TSV, plain text logs).
Produces structured sections for UI and optional searchable full_text blob.
"""

from __future__ import annotations

import csv
import io
import re
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

# ── Keywords / regex ───────────────────────────────────────────────────────────
MOBILE_TITLE_HINTS = re.compile(
    r"cdr|call\s*detail|sms\s*(log|record)|subscriber|cell\s*tower|\blac\b|cell\s*id|"
    r"mobile\s*data|phone\s*log|\bimei\b|\bimsi\b|tower\s*location|incoming|outgoing",
    re.I,
)

_PHONE_IN = re.compile(
    r"(?:\+91|0091|91)[\s.-]?([6-9]\d{9})\b|\b([6-9]\d{9})\b|\b(?:0)?([6-9]\d{9})\b"
)

_DATE_PATTERNS = [
    (re.compile(r"\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2}|\d{2})\b"), "dmy"),
    (re.compile(r"\b(20\d{2})-(\d{1,2})-(\d{1,2})\b"), "ymd"),
]

_DURATION_SEC = [
    re.compile(r"(\d+)\s*h[rs]?\s*(\d+)\s*m(?:in)?\s*(\d+)\s*s(?:ec)?", re.I),
    re.compile(r"(\d+)\s*h[rs]?\s*(\d+)\s*m(?:in)?", re.I),
    re.compile(r"(\d+)\s*m(?:in)?(?:\s+(\d+)\s*s(?:ec)?)?", re.I),
    re.compile(r"\b(\d{1,2}):(\d{2}):(\d{2})\b"),
    re.compile(r"\b(\d{1,3})\s*s(?:ec)?\b", re.I),
]


def sniff_maybe_mobile(title: str | None, path: str | None, snippet: str) -> bool:
    """Lightweight classifier: should we prefer mobile-data pipeline for this upload?"""
    blob = " ".join(
        filter(
            None,
            [
                title or "",
                Path(path).name if path else "",
                snippet[:4000],
            ],
        )
    )
    if not blob.strip():
        return False
    if MOBILE_TITLE_HINTS.search(blob):
        return True
    if _PHONE_IN.findall(snippet[:8000]):
        digits = sum(1 if c.isdigit() else 0 for c in snippet[:8000])
        if digits > 120 and snippet.count("|") >= 10:
            return True
        if snippet.count("|") >= 20 and "/" in snippet and digits > 80:
            return True
    return False


def _normalize_phone(match_groups: tuple) -> str | None:
    for g in match_groups:
        if g:
            digits = re.sub(r"\D", "", g)
            if len(digits) == 11 and digits.startswith("91"):
                digits = digits[-10:]
            if len(digits) == 10 and digits[0] in "6789":
                return digits[-10:]
    return None


def _parse_datetime(text: str) -> datetime | None:
    text = text.strip()
    if not text:
        return None
    for rg, fmt in _DATE_PATTERNS:
        m = rg.search(text)
        if not m:
            continue
        try:
            if fmt == "dmy":
                d, mn, y = m.groups()
                yi = int(y)
                if yi < 100:
                    yi += 2000
                return datetime(yi, int(mn), int(d))
            if fmt == "ymd":
                y, mn, d = m.groups()
                return datetime(int(y), int(mn), int(d))
        except (ValueError, TypeError):
            continue
    return None


def _duration_to_sec(text: str) -> int | None:
    t = text.lower().strip()
    if not t:
        return None
    m = _DURATION_SEC[0].search(t)
    if m:
        h, mn, s = int(m.group(1)), int(m.group(2)), int(m.group(3))
        return h * 3600 + mn * 60 + s
    m = _DURATION_SEC[1].search(t)
    if m:
        h, mn = int(m.group(1)), int(m.group(2))
        return h * 3600 + mn * 60
    m = _DURATION_SEC[2].search(t)
    if m:
        mn = int(m.group(1))
        s = int(m.group(2) or 0)
        return mn * 60 + s
    m = _DURATION_SEC[3].search(t)
    if m:
        h, mn, s = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if h <= 99:
            return h * 3600 + mn * 60 + s
    m = _DURATION_SEC[4].search(t)
    if m:
        return int(m.group(1))
    if t.isdigit() and len(t) <= 5:
        return int(t)
    return None


_OPERATORS = re.compile(r"\b(Jio|Airtel|Vodafone|\bVi\b|Idea|BSNL|MNTL|Tata)\b", re.I)
_IMEI = re.compile(r"\b(\d{15})\b")


def extract_records_from_csv(text: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",\t|;")
    except csv.Error:
        dialect = csv.excel_tab if "\t" in sample.split("\n", 1)[0] else csv.excel
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    for raw in reader:
        line = "|".join(str(v) for v in raw.values())
        nums = [_normalize_phone(g) for g in _PHONE_IN.findall(line)]
        nums = list({n for n in nums if n})
        dt_raw = ""
        dur_sec: int | None = None
        kind = ""
        lc = "|".join(f"{k}:{v}".lower() for k, v in raw.items())

        # Map common column names
        for key, val in raw.items():
            kl = key.lower()
            vv = val or ""
            if any(x in kl for x in ("date", "time", "timestamp", "dt")):
                dt_raw = vv
            if any(x in kl for x in ("duration", "dur", "sec", "length", "call time")):
                dur_sec = _duration_to_sec(str(vv)) or dur_sec
            if any(x in kl for x in ("type", "direction", "call type", "service")):
                kind = vv
        dt = _parse_datetime(dt_raw) if dt_raw else _parse_datetime(line)
        if not dur_sec:
            for pat in (r"duration[:\s]+(\S+)", r"(\d{1,2}:\d{2}:\d{2})"):
                mm = re.search(pat, line, re.I)
                if mm:
                    dur_sec = _duration_to_sec(mm.group(1))
                    break
        if any(x in lc for x in ("sms", "text", "message")):
            ctype = "sms"
        elif any(x in lc for x in ("in", "incoming", "inc")):
            ctype = "in"
        elif any(x in lc for x in ("out", "og", "orig")):
            ctype = "out"
        elif not kind:
            ctype = ""
        elif re.search(r"in", kind, re.I):
            ctype = "in"
        elif re.search(r"out|og", kind, re.I):
            ctype = "out"
        else:
            ctype = kind[:12].lower()

        rows.append(
            {
                "phones": nums,
                "datetime": dt.isoformat() if dt else None,
                "duration_sec": dur_sec,
                "type": ctype,
                "raw": {str(k): v for k, v in raw.items()},
            }
        )
    return rows


def extract_records_from_lines(text: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for line in text.splitlines():
        ln = line.strip()
        if not ln or ln.startswith("#"):
            continue
        pairs = list(_PHONE_IN.findall(ln))
        nums = list({_normalize_phone(p) for p in pairs})  # type: ignore[arg-type]
        nums = [n for n in nums if n]
        if not nums and "|" not in ln:
            continue
        dt = _parse_datetime(ln)
        dur = None
        for pat in ln.split("|"):
            d = _duration_to_sec(pat)
            if d is not None:
                dur = d
                break
        ln_l = ln.lower()
        ctype = ""
        if "sms" in ln_l or "text msg" in ln_l:
            ctype = "sms"
        elif any(x in ln_l for x in (" incoming", "-in-", " ic ")):
            ctype = "in"
        elif any(x in ln_l for x in (" outgoing", "-og-", " og ")):
            ctype = "out"

        rows.append(
            {"phones": nums, "datetime": dt.isoformat() if dt else None, "duration_sec": dur, "type": ctype, "raw_line": ln[:500]}
        )
    return rows


def run_pipeline_from_text(content: str) -> dict[str, Any]:
    text = content or ""
    if not text.strip():
        return _empty_payload("No text content to analyze.")

    records: list[dict[str, Any]] = []
    if len(text) > 12 and ("," in text or "\t" in text or ";" in text):
        try:
            records = extract_records_from_csv(text)
        except Exception:
            records = []
    if len(records) < 3:
        line_recs = extract_records_from_lines(text)
        if len(line_recs) > len(records):
            records = line_recs

    if not records:
        return _empty_payload("Could not parse call / SMS style rows. Use CSV or pipe-delimited export.")

    # Aggregate
    contact_counter: Counter[str] = Counter()
    contact_duration: defaultdict[str, int] = defaultdict(int)
    contact_in = Counter()
    contact_out = Counter()
    sms_count = 0
    day_counter: Counter[str] = Counter()
    hour_counter: Counter[int] = Counter()
    total_duration = 0
    calls_with_dur = 0
    night_rows = 0
    rows_with_time = 0

    for r in records:
        et = r.get("type") or ""
        if et == "sms":
            sms_count += 1
        elif et == "in":
            pass
        elif et == "out":
            pass

        for p in r.get("phones") or []:
            contact_counter[p] += 1
            if r.get("duration_sec"):
                contact_duration[p] += int(r["duration_sec"])
            if et == "in":
                contact_in[p] += 1
            elif et == "out":
                contact_out[p] += 1
            elif et == "sms":
                pass

        ds = r.get("duration_sec")
        if ds is not None and ds > 0:
            total_duration += int(ds)
            calls_with_dur += 1

        dts = r.get("datetime")
        if dts:
            try:
                dt = datetime.fromisoformat(dts)
                day_key = dt.strftime("%Y-%m-%d")
                day_counter[day_key] += 1
                hour_counter[dt.hour] += 1
                rows_with_time += 1
                if dt.hour >= 22 or dt.hour < 6:
                    night_rows += 1
            except (ValueError, TypeError):
                pass

    total_calls = sum(1 for r in records if r.get("type") != "sms")
    if total_calls == 0:
        total_calls = len(records) - sms_count

    top_contacts = []
    for num, cnt in contact_counter.most_common(25):
        top_contacts.append(
            {
                "number": num,
                "call_count": cnt,
                "total_duration_sec": contact_duration.get(num, 0),
                "inbound": contact_in.get(num, 0),
                "outbound": contact_out.get(num, 0),
            }
        )

    call_activity = sorted(
        [{"period": d, "count": c} for d, c in day_counter.items()],
        key=lambda x: x["period"],
    )[-60:]

    time_pattern_by_hour = [{"hour": h, "count": hour_counter.get(h, 0)} for h in range(24)]
    peak_hour = max(range(24), key=lambda h: hour_counter.get(h, 0)) if hour_counter else None
    night_pct = round(100 * night_rows / rows_with_time, 1) if rows_with_time else 0.0

    op_hits = list({m.group(1) for m in _OPERATORS.finditer(text[:50000])})
    imei_hits = list({m.group(1) for m in _IMEI.finditer(text[:50000])})[:20]

    lac_hits = re.findall(r"\b(?:LAC|lac)[\s:=]+(\d{3,8})\b", text[:50000], re.I)
    cell_hits = re.findall(r"\b(?:Cell|CELL)[\s_]*(?:ID|id)[\s:=]+(\d{3,10})\b", text[:50000], re.I)

    suspicious: list[dict[str, str]] = []
    if night_pct >= 35 and rows_with_time >= 8:
        suspicious.append(
            {
                "title": "High late-night / early-morning activity",
                "detail": f"{night_pct}% of timestamped events fall between 22:00–06:00.",
                "severity": "medium",
            }
        )
    if len(contact_counter) >= 3:
        top1 = contact_counter.most_common(1)[0][1]
        if top1 / max(len(records), 1) >= 0.45:
            suspicious.append(
                {
                    "title": "Single number concentration",
                    "detail": "A large share of events involve one destination number — review context.",
                    "severity": "low",
                }
            )
    short_burst = sum(1 for r in records if (r.get("duration_sec") or 999) < 15 and r.get("type") != "sms")
    if short_burst >= max(15, len(records) // 5):
        suspicious.append(
            {
                "title": "Many ultra-short communications",
                "detail": "Frequent events under ~15 seconds can indicate pings, drops, or machine traffic.",
                "severity": "low",
            }
        )

    dr_start = min(day_counter.keys(), default=None)
    dr_end = max(day_counter.keys(), default=None)
    date_range = f"{dr_start} → {dr_end}" if dr_start and dr_end else "—"

    intel_lines = []
    intel_lines.append(
        f"Pulled {len(records)} parsed rows covering {len(contact_counter)} distinct subscriber numbers "
        f"with {sms_count} SMS-classified rows."
    )
    if peak_hour is not None and hour_counter:
        intel_lines.append(
            f"Highest hourly bucket: {peak_hour}:00–{peak_hour + 1}:00 (local timestamps as given in file)."
        )
    intel_lines.append("Operator names in plaintext (if stated by exporter): " + (", ".join(op_hits) or "none detected"))

    summary = {
        "parsed_rows": len(records),
        "unique_contacts": len(contact_counter),
        "total_calls_est": total_calls,
        "sms_count": sms_count,
        "total_duration_min": round(total_duration / 60.0, 2) if total_duration else 0,
        "avg_duration_sec": round(total_duration / calls_with_dur, 1)
        if calls_with_dur
        else None,
        "date_range": date_range,
        "night_activity_pct": night_pct,
        "operators_detected": op_hits,
    }

    intelligence = {"insights": intel_lines, "behavior_summary": intel_lines[0] if intel_lines else ""}

    return {
        "total_records": len(records),
        "summary": summary,
        "call_activity": call_activity,
        "top_contacts": top_contacts,
        "time_pattern": {
            "by_hour": time_pattern_by_hour,
            "peak_hour": peak_hour,
            "night_activity_pct": night_pct,
        },
        "operator_sms": {
            "operators_plaintext": op_hits,
            "sms_like_rows": sms_count,
            "notes": "Derived from keywords in columns or row text.",
        },
        "location": {
            "lac_values": lac_hits[:40],
            "cell_id_values": cell_hits[:40],
            "notes": "Parsed from labels such as LAC / Cell ID when present.",
        },
        "device_sim": {
            "imei_candidates": imei_hits,
            "notes": "15-digit IMEI-like tokens only; validate against original export.",
        },
        "suspicious": suspicious,
        "intelligence": intelligence,
    }


def _empty_payload(msg: str) -> dict[str, Any]:
    return {
        "total_records": 0,
        "error_hint": msg,
        "summary": {},
        "call_activity": [],
        "top_contacts": [],
        "time_pattern": {"by_hour": [], "peak_hour": None, "night_activity_pct": 0},
        "operator_sms": {"operators_plaintext": [], "sms_like_rows": 0, "notes": msg},
        "location": {"lac_values": [], "cell_id_values": [], "notes": ""},
        "device_sim": {"imei_candidates": [], "notes": ""},
        "suspicious": [],
        "intelligence": {"insights": [], "behavior_summary": ""},
    }


def build_searchable_text(result: dict[str, Any]) -> str:
    """Embed pipeline output as plain text stored on Source.full_text."""
    lines: list[str] = ["=== MOBILE DATA SUMMARY ==="]
    s = result.get("summary") or {}
    lines.append(f"Parsed rows: {s.get('parsed_rows')}")
    lines.append(f"Unique contacts: {s.get('unique_contacts')} | SMS rows: {s.get('sms_count')}")
    lines.append(f"Date range: {s.get('date_range')}")
    lines.append("")
    lines.append("=== TOP CONTACTS (sample) ===")
    for row in (result.get("top_contacts") or [])[:15]:
        lines.append(
            f"{row.get('number')} | count={row.get('call_count')} | "
            f"in={row.get('inbound')} out={row.get('outbound')} | dur_sec={row.get('total_duration_sec')}"
        )
    lines.append("")
    lines.append("=== CALL ACTIVITY BY DAY (sample) ===")
    for row in (result.get("call_activity") or [])[-20:]:
        lines.append(f"{row.get('period')}: {row.get('count')}")
    return "\n".join(lines)


def read_file_text(path: str) -> str:
    p = Path(path)
    if not p.is_file():
        return ""
    for enc in ("utf-8", "utf-8-sig", "utf-16", "latin-1", "cp1252"):
        try:
            return p.read_text(encoding=enc)
        except (UnicodeDecodeError, OSError):
            continue
    return p.read_text(encoding="utf-8", errors="replace")
