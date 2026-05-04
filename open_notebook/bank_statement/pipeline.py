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

    - [OCR PAGE CONTENT] markers -> replaced with newlines

    - Long single-line pages -> split on known date patterns and UPI keywords

    - Non-ASCII OCR artifacts -> removed only when text is predominantly ASCII

    - Repeated header lines -> removed

    """

    import re

    # Remove [OCR PAGE CONTENT] markers

    text = re.sub(r'\[OCR PAGE CONTENT\]', '\n', text)

    # Remove non-ASCII characters that are OCR artifacts (Gujarati, Hindi etc.)

    # Only strip if the text is predominantly ASCII (i.e. not a Unicode-encoded PDF).

    # If >80% of chars are ASCII, strip the non-ASCII noise; otherwise leave intact.

    non_ascii_count = sum(1 for c in text if ord(c) > 127)

    if len(text) > 0 and non_ascii_count / len(text) < 0.2:

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

def _extract_with_pdfplumber(file_path: str) -> str:

    """Extract embedded text using pdfplumber with a 20-second timeout guard."""

    import threading

    from loguru import logger as _log

    result = [""]

    error = [None]

    def _run():

        try:

            import pdfplumber

            parts = []

            with pdfplumber.open(file_path) as pdf:

                for page in pdf.pages:

                    parts.append(page.extract_text() or "")

            result[0] = "\n".join(parts).strip()

        except Exception as e:

            error[0] = e

    _log.info("Trying pdfplumber extraction...")

    t = threading.Thread(target=_run, daemon=True)

    t.start()

    t.join(timeout=20)

    if t.is_alive():

        _log.warning("pdfplumber timed out after 20s")

        return ""

    if error[0]:

        _log.warning(f"pdfplumber error: {error[0]}")

        return ""

    _log.info(f"pdfplumber extracted {len(result[0])} chars")

    return result[0]

def _extract_with_ocr_gpu(file_path: str) -> str:

    """

    OCR extraction using EasyOCR with automatic GPU detection.

    Falls back to CPU if no GPU is available.

    Uses PyMuPDF to rasterise pages (no poppler dependency).

    """

    from loguru import logger as _log

    try:

        import torch

        import easyocr

        import fitz  # PyMuPDF — no poppler needed

        import numpy as np

        from PIL import Image

        import io

        use_gpu = torch.cuda.is_available()

        gpu_label = f"YES ({torch.cuda.get_device_name(0)})" if use_gpu else "NO (CPU fallback)"

        _log.info(f"OCR starting — GPU={gpu_label}")

        # Open PDF and rasterise pages with PyMuPDF

        doc = fitz.open(str(file_path))

        _log.info(f"Converted {len(doc)} pages")

        # Initialize EasyOCR reader once (GPU-aware)

        reader = easyocr.Reader(['en'], gpu=use_gpu, verbose=False)

        all_text = []

        for i, page in enumerate(doc):

            _log.info(f"OCR processing page {i + 1}/{len(doc)}...")

            pix = page.get_pixmap(dpi=200)

            img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")

            img_array = np.array(img)

            results = reader.readtext(img_array, detail=0, paragraph=True)

            page_text = "\n".join(results)

            all_text.append(page_text)

            _log.info(f"Page {i + 1}: extracted {len(page_text)} chars")

        doc.close()

        final = "\n[OCR PAGE CONTENT]\n".join(all_text)

        _log.info(f"OCR complete — total {len(final)} chars")

        return final

    except ImportError as e:

        from loguru import logger as _log

        _log.error(f"OCR dependency missing: {e}. Install: pip install easyocr pymupdf")

        return ""

    except Exception as e:

        from loguru import logger as _log

        _log.error(f"OCR extraction failed: {e}")

        return ""

def _extract_text_smart(file_path: str) -> str:

    """

    Smart extraction strategy:

    1. Try PyMuPDF (fast, no hang risk)

    2. Try pdfplumber with timeout

    3. Fall back to EasyOCR (GPU-accelerated if available)

    """

    import fitz

    from loguru import logger as _log

    # 1. PyMuPDF — fast, handles most text-based PDFs

    try:

        doc = fitz.open(str(file_path))

        parts = [page.get_text() or "" for page in doc]

        doc.close()

        mupdf_text = "\n".join(parts).strip()

        if mupdf_text and len(mupdf_text) > 100:

            _log.info(f"PyMuPDF extracted {len(mupdf_text)} chars")

            return mupdf_text

    except Exception as e:

        _log.warning(f"PyMuPDF failed: {e}")

    # 2. pdfplumber with timeout

    plumber_text = _extract_with_pdfplumber(file_path)

    if plumber_text and len(plumber_text) > 100:

        return plumber_text

    _log.warning(f"pdfplumber returned only {len(plumber_text)} chars — switching to OCR")

    # 3. EasyOCR (GPU if available)

    return _extract_with_ocr_gpu(file_path)

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

    from loguru import logger as _log

    # 1. Extract text — use pre-extracted if provided (e.g. OCR already done during source processing)

    if pre_extracted_text and len(pre_extracted_text.strip()) > 100:

        _log.info(f"run_pipeline: using pre_extracted_text ({len(pre_extracted_text)} chars)")

        raw_extracted = pre_extracted_text

        text = _clean_ocr_content(pre_extracted_text)

    else:

        _log.info(f"run_pipeline: extracting from file {file_path}")

        raw_extracted = _extract_text_smart(file_path)

        _log.info(f"run_pipeline: raw extracted length = {len(raw_extracted) if raw_extracted else 0}")

        text = _clean_ocr_content(raw_extracted) if raw_extracted else ""

    _log.info(f"run_pipeline: text length after clean = {len(text) if text else 0}")

    # 2. Metadata

    details = parse_statement_details(text)

    # 3. Extract key info from header and enrich detail_cards
    lines_header = [l.strip() for l in text.splitlines()[:25] if l.strip()]
    _SKIP_WORDS = {
        'BANK', 'STATEMENT', 'ACCOUNT', 'BRANCH', 'INDIA', 'LIMITED',
        'REGULAR', 'SAVINGS', 'CURRENT', 'PAN', 'DETAILS', 'SUMMARY',
        'REPORT', 'PERIOD', 'DATE', 'NEAR', 'OPP', 'NAGAR', 'COLONY',
        'ROAD', 'STREET', 'AHMEDABAD', 'MUMBAI', 'DELHI', 'GIDC',
        'GRUH', 'BHIKSHUK', 'GUJRAT', 'GUJARAT', 'ODHAV', 'INDUSTRIAL',
        'ESTATE', 'AREA', 'ZONE', 'SECTOR', 'PHASE', 'PLOT',
        'FEDERAL', 'SBI', 'HDFC', 'ICICI', 'AXIS', 'KOTAK', 'CANARA',
    }
    account_holder = ''
    for line in lines_header:
        words = line.split()
        if (line.replace(' ', '').isalpha() and line.isupper()
                and 2 <= len(words) <= 5 and 8 < len(line) < 50
                and not any(w in _SKIP_WORDS for w in words)):
            account_holder = line.title()
            break
        if (not account_holder and 2 <= len(words) <= 4
                and all(w[0].isupper() for w in words if w)
                and line.replace(' ', '').isalpha()
                and not any(w.upper() in _SKIP_WORDS for w in words)
                and 5 < len(line) < 40):
            account_holder = line
            break
    bank_name = ''
    _KNOWN_BANKS = ['FEDERAL BANK', 'STATE BANK OF INDIA', 'SBI', 'HDFC BANK',
                    'ICICI BANK', 'AXIS BANK', 'KOTAK BANK', 'CANARA BANK',
                    'PUNJAB NATIONAL BANK', 'BANK OF BARODA']
    for line in lines_header:
        for bank in _KNOWN_BANKS:
            if bank.lower() in line.lower():
                bank_name = bank.title()
                break
        if bank_name:
            break
    period_str = ''
    for line in lines_header:
        if ' to ' in line.lower() and any(c.isdigit() for c in line):
            period_str = line.strip()
            break
    existing_labels = {f['label'].lower().replace(' ', '').replace('/', '') for f in details['fields']}
    if account_holder and 'accountholder' not in existing_labels and 'name' not in existing_labels:
        details['fields'].insert(0, {'label': 'Account Holder', 'value': account_holder})
    if bank_name and 'bank' not in existing_labels and 'bankname' not in existing_labels:
        details['fields'].insert(0, {'label': 'Bank', 'value': bank_name})
    if period_str and 'period' not in existing_labels and 'statementperiod' not in existing_labels:
        details['fields'].append({'label': 'Statement Period', 'value': period_str})

    # 4. Parse + clean

    df = clean_data(parse_transactions(text))

    # 5. Classify

    if not df.empty:

        df, nlp_groups = classify(df)

    else:

        df["type"] = []

        df["nlp_keywords"] = []

        df["category"] = []

        nlp_groups = []

    # 6. All 10 reports

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

    # 7. Transaction list

    display_cols = [c for c in _DISPLAY_COLS if c in df.columns]

    txn_records  = df[display_cols].to_dict("records") if not df.empty else []

    return {

        # Metadata

        "details":            details,

        "detail_cards":       details["fields"],

        "nlp_groups":         nlp_groups,

        "total_transactions": int(len(df)),

        # Cash Flow

        "cashflow": {k: _fmt(v) for k, v in r_cashflow.items()},

        # Monthly Summary

        "monthly": _fmt_records(r_monthly),

        # Transaction Type

        "types": _fmt_records(r_types),

        # ATM

        "atm": _fmt_atm(r_atm),

        # Bank Charges

        "charges": _fmt_charges(r_charges),

        # Pattern

        "pattern": _fmt_pattern(r_pattern),

        # High Value

        "high_value": _fmt_records(r_highval),

        # Balance Trend

        "balance_trend": _fmt_records(r_trend),

        # Interest

        "interest": _fmt_interest(r_interest),

        # Frequency

        "frequency": r_frequency,

        # All transactions

        "transactions": _fmt_records(txn_records),

        # Raw extracted text — lets callers reuse it without re-running OCR

        "_extracted_text": raw_extracted or "",

    }

