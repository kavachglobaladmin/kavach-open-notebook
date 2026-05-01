from open_notebook.bank_statement.classifier import classify
from open_notebook.bank_statement.cleaner import clean_data
from open_notebook.bank_statement.metadata import parse_statement_details
from open_notebook.bank_statement.parser import parse_transactions
from open_notebook.bank_statement.reports import (
    atm_report,
    balance_trend,
    cash_flow,
    charges_report,
    frequency_report,
    high_value,
    interest_report,
    monthly_summary,
    pattern_report,
    transaction_type,
)

_DISPLAY_COLS = ["date", "description", "debit", "credit", "balance", "nlp_keywords", "type"]


def _clean_ocr_content(text: str) -> str:
    """
    Clean OCR-extracted content for bank statement parsing.
    
    Handles:
    - [OCR PAGE CONTENT] markers → replaced with newlines
    - Long single-line pages → split on known date patterns and UPI keywords
    - Gujarati/Hindi OCR artifacts → removed
    - Repeated header lines → removed
    """
    import re

    # Remove [OCR PAGE CONTENT] markers
    text = re.sub(r'\[OCR PAGE CONTENT\]', '\n', text)

    # Remove non-ASCII characters that are OCR artifacts (Gujarati, Hindi etc.)
    # Keep: ASCII printable + common symbols
    text = re.sub(r'[^\x00-\x7F]+', ' ', text)

    # Split on UPI transaction patterns — insert newline before each UPI/NEFT/IMPS entry
    text = re.sub(r'\s+(UPI(?:OUT|IN)?[/ ])', r'\n\1', text)
    text = re.sub(r'\s+(NEFT[/ ])', r'\n\1', text)
    text = re.sub(r'\s+(IMPS[/ ])', r'\n\1', text)
    text = re.sub(r'\s+(RTGS[/ ])', r'\n\1', text)
    text = re.sub(r'\s+(SBINT[: ])', r'\n\1', text)

    # Split on date patterns like "04 Aug", "05 Sep" at start of segments
    text = re.sub(
        r'\s+(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?:\s+\d{4})?)\s+',
        r'\n\1\n',
        text
    )

    # Clean up multiple spaces and blank lines
    lines = []
    for line in text.splitlines():
        line = ' '.join(line.split())
        if line:
            lines.append(line)

    return '\n'.join(lines)


def _fmt(value) -> str:
    try:
        return f"{float(value):,.2f}"
    except (TypeError, ValueError):
        return "0.00"


def _fmt_records(records: list) -> list:
    out = []
    for record in records:
        item = dict(record)
        if "date" in item and hasattr(item["date"], "strftime"):
            item["date"] = item["date"].strftime("%d-%m-%Y")
        for key in ("debit", "credit", "balance", "amount", "total_amount"):
            if key in item:
                item[key] = _fmt(item[key])
        if "count" in item:
            try:
                item["count"] = int(item["count"])
            except (TypeError, ValueError):
                pass
        out.append(item)
    return out


def _fmt_atm(report: dict) -> dict:
    return {
        "count":   report["count"],
        "total":   _fmt(report["total"]),
        "avg":     _fmt(report["avg"]),
        "largest": _fmt(report["largest"]),
        "transactions": _fmt_records(report["transactions"]),
    }


def _fmt_charges(report: dict) -> dict:
    breakdown = [
        {"charge_type": r["charge_type"], "amount": _fmt(r["amount"])}
        for r in report["breakdown"]
    ]
    return {
        "total":        _fmt(report["total"]),
        "count":        report["count"],
        "breakdown":    breakdown,
        "transactions": _fmt_records(report["transactions"]),
    }


def _fmt_interest(report: dict) -> dict:
    return {
        "total":           _fmt(report["total"]),
        "count":           report["count"],
        "avg_per_quarter": _fmt(report["avg_per_quarter"]),
        "transactions":    _fmt_records(report["transactions"]),
    }


def _fmt_pattern(report: dict) -> dict:
    return {k: _fmt(v) if isinstance(v, float) else v for k, v in report.items()}


def run_pipeline(file_path, pre_extracted_text: str | None = None) -> dict:
    import re as _re
    from loguru import logger as _log

    # 1. Extract text — use pre-extracted if provided (e.g. OCR already done during source processing)
    if pre_extracted_text and len(pre_extracted_text.strip()) > 100:
        _log.info(f"run_pipeline: using pre_extracted_text ({len(pre_extracted_text)} chars)")
        text = _clean_ocr_content(pre_extracted_text)
    else:
        _log.info(f"run_pipeline: extracting from file {file_path}")
        from open_notebook.bank_statement.extract import extract_text
        text = extract_text(file_path)
        if text:
            text = _clean_ocr_content(text)

    _log.info(f"run_pipeline: text length after clean = {len(text) if text else 0}")

    # 2. Metadata
    details = parse_statement_details(text)

    # 3. Extract account holder - look in first 15 lines for all-caps name
    account_holder = ""
    _SKIP_WORDS = {
        'BANK', 'STATEMENT', 'ACCOUNT', 'BRANCH', 'INDIA', 'LIMITED',
        'REGULAR', 'SAVINGS', 'CURRENT', 'PAN', 'DETAILS', 'SUMMARY',
        'REPORT', 'PERIOD', 'DATE', 'NEAR', 'OPP', 'NAGAR', 'COLONY',
        'ROAD', 'STREET', 'AHMEDABAD', 'MUMBAI', 'DELHI', 'GIDC',
        'GRUH', 'BHIKSHUK', 'GUJRAT', 'GUJARAT', 'ODHAV', 'INDUSTRIAL',
        'ESTATE', 'AREA', 'ZONE', 'SECTOR', 'PHASE', 'PLOT',
    }
    for line in text.splitlines()[:15]:
        line = line.strip()
        words = line.split()
        if (line
                and line.replace(' ', '').isalpha()
                and line.isupper()
                and 2 <= len(words) <= 5
                and 8 < len(line) < 50
                and not any(w in _SKIP_WORDS for w in words)):
            account_holder = line
            break

    # Add account_holder to detail_cards if found
    if account_holder:
        existing_labels = {f["label"].lower() for f in details["fields"]}
        if "account holder" not in existing_labels and "name" not in existing_labels:
            details["fields"].insert(0, {"label": "Account Holder", "value": account_holder})

    # 3. Parse + clean
    df = clean_data(parse_transactions(text))

    # 4. Classify
    if not df.empty:
        df, nlp_groups = classify(df)
    else:
        df["type"] = []
        df["nlp_keywords"] = []
        df["category"] = []
        nlp_groups = []

    # 5. All 10 reports
    r_cashflow   = cash_flow(df)
    r_monthly    = monthly_summary(df)
    r_types      = transaction_type(df)
    r_atm        = atm_report(df)
    r_charges    = charges_report(df)
    r_pattern    = pattern_report(df)
    r_highval    = high_value(df)
    r_trend      = balance_trend(df)
    r_interest   = interest_report(df)
    r_frequency  = frequency_report(df)

    # 6. Transaction list
    display_cols = [c for c in _DISPLAY_COLS if c in df.columns]
    txn_records  = df[display_cols].to_dict("records") if not df.empty else []

    return {
        # Metadata
        "details":            details,
        "detail_cards":       details["fields"],
        "nlp_groups":         nlp_groups,
        "total_transactions": int(len(df)),

        # Report 2 — Cash Flow
        "cashflow": {k: _fmt(v) for k, v in r_cashflow.items()},

        # Report 1 — Monthly Summary
        "monthly": _fmt_records(r_monthly),

        # Report 3 — Transaction Type
        "types": _fmt_records(r_types),

        # Report 4 — ATM
        "atm": _fmt_atm(r_atm),

        # Report 5 — Bank Charges
        "charges": _fmt_charges(r_charges),

        # Report 6 — Pattern
        "pattern": _fmt_pattern(r_pattern),

        # Report 7 — High Value
        "high_value": _fmt_records(r_highval),

        # Report 8 — Balance Trend
        "balance_trend": _fmt_records(r_trend),

        # Report 9 — Interest
        "interest": _fmt_interest(r_interest),

        # Report 10 — Frequency
        "frequency": r_frequency,

        # All transactions
        "transactions": _fmt_records(txn_records),
    }
