"""
Bank statement analysis pipeline.
Uses spaCy NLP engine for dynamic detection + settings.py for configuration.
"""

import re

from open_notebook.bank_statement.classifier import classify
from open_notebook.bank_statement.cleaner import clean_data
from open_notebook.bank_statement.config import (
    COLUMNS,
    DISPLAY_COLUMNS,
    EXTRACTION,
    MONTHS,
    OCR_SPLIT_PATTERNS,
    PARSING,
    REPORTS,
)
from open_notebook.bank_statement.nlp_engine import (
    detect_bank_name as _nlp_detect_bank,
    detect_account_holder as _nlp_detect_holder,
)
from open_notebook.bank_statement.metadata import parse_statement_details
from open_notebook.bank_statement.parser import parse_transactions
from open_notebook.bank_statement.reports import (
    atm_report, balance_trend, cash_flow, charges_report,
    frequency_report, high_value, interest_report,
    monthly_summary, pattern_report, transaction_type,
)

# Compile OCR split patterns once
_OCR_SPLIT_COMPILED = [
    (re.compile(src), dst) for src, dst in OCR_SPLIT_PATTERNS
]

# Build month abbreviation regex from config MONTHS keys
from open_notebook.bank_statement.config import MONTHS as _MONTHS
_MONTH_ABBREVS = "|".join(sorted({k.capitalize() for k in _MONTHS if len(k) == 3}))
_DATE_SPLIT_RE = re.compile(
    rf'\s+(\d{{1,2}}\s+(?:{_MONTH_ABBREVS})(?:\s+\d{{4}})?)\s+'
)


def _clean_ocr_content(text: str) -> str:
    """
    Clean OCR-extracted content for bank statement parsing.
    All patterns loaded from config.
    """
    # Remove [OCR PAGE CONTENT] markers
    text = re.sub(r'\[OCR PAGE CONTENT\]', '\n', text)

    # Remove non-ASCII characters that are OCR artifacts
    # Only strip if the text is predominantly ASCII (< 20% non-ASCII)
    non_ascii_count = sum(1 for c in text if ord(c) > 127)
    if len(text) > 0 and non_ascii_count / len(text) < 0.2:
        text = re.sub(r'[^\x00-\x7F]+', ' ', text)

    # Split on transaction keyword patterns (UPI, NEFT, IMPS, etc.)
    for pattern, replacement in _OCR_SPLIT_COMPILED:
        text = pattern.sub(replacement, text)

    # Split on date patterns like "04 Aug", "05 Sep"
    text = _DATE_SPLIT_RE.sub(r'\n\1\n', text)

    # Clean up multiple spaces and blank lines
    lines = [' '.join(line.split()) for line in text.splitlines() if line.strip()]
    return '\n'.join(lines)


def _extract_with_pdfplumber(file_path: str) -> str:
    """Extract embedded text using pdfplumber with configurable timeout."""
    import threading
    from loguru import logger as _log

    timeout = EXTRACTION["pdfplumber_timeout_seconds"]
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
    t.join(timeout=timeout)
    if t.is_alive():
        _log.warning(f"pdfplumber timed out after {timeout}s")
        return ""
    if error[0]:
        _log.warning(f"pdfplumber error: {error[0]}")
        return ""
    _log.info(f"pdfplumber extracted {len(result[0])} chars")
    return result[0]


def _extract_with_ocr_gpu(file_path: str) -> str:
    """OCR extraction using EasyOCR with automatic GPU detection."""
    from loguru import logger as _log

    ocr_dpi = EXTRACTION["ocr_dpi"]
    page_timeout = EXTRACTION["easyocr_timeout_per_page_seconds"]

    try:
        import torch
        import easyocr
        import fitz
        import numpy as np
        from PIL import Image
        import io
        import threading

        use_gpu = torch.cuda.is_available()
        gpu_label = f"YES ({torch.cuda.get_device_name(0)})" if use_gpu else "NO (CPU fallback)"
        _log.info(f"OCR starting — GPU={gpu_label}")

        doc = fitz.open(str(file_path))
        _log.info(f"Converted {len(doc)} pages")

        reader = easyocr.Reader(['en'], gpu=use_gpu, verbose=False)
        all_text = []

        for i, page in enumerate(doc):
            _log.info(f"OCR processing page {i + 1}/{len(doc)}...")
            pix = page.get_pixmap(dpi=ocr_dpi)
            img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
            img_array = np.array(img)

            ocr_result = [None]
            ocr_error = [None]

            def _run_ocr():
                try:
                    ocr_result[0] = reader.readtext(img_array, detail=0, paragraph=True)
                except Exception as e:
                    ocr_error[0] = e

            ocr_thread = threading.Thread(target=_run_ocr, daemon=True)
            ocr_thread.start()
            ocr_thread.join(timeout=page_timeout)

            if ocr_thread.is_alive():
                _log.warning(f"Page {i+1} OCR timed out after {page_timeout}s — skipping")
            elif ocr_error[0] is None and ocr_result[0]:
                page_text = "\n".join(ocr_result[0])
                all_text.append(page_text)
                _log.info(f"Page {i + 1}: extracted {len(page_text)} chars")

        doc.close()
        final = "\n[OCR PAGE CONTENT]\n".join(all_text)
        _log.info(f"OCR complete — total {len(final)} chars")
        return final

    except ImportError as e:
        from loguru import logger as _log
        _log.error(f"OCR dependency missing: {e}")
        return ""
    except Exception as e:
        from loguru import logger as _log
        _log.error(f"OCR extraction failed: {e}")
        return ""


def _extract_text_smart(file_path: str) -> str:
    """Smart extraction: PyMuPDF → pdfplumber → EasyOCR."""
    import fitz
    from loguru import logger as _log

    min_len = EXTRACTION["min_text_length"]

    try:
        doc = fitz.open(str(file_path))
        parts = [page.get_text() or "" for page in doc]
        doc.close()
        mupdf_text = "\n".join(parts).strip()
        if mupdf_text and len(mupdf_text) > min_len:
            _log.info(f"PyMuPDF extracted {len(mupdf_text)} chars")
            return mupdf_text
    except Exception as e:
        _log.warning(f"PyMuPDF failed: {e}")

    plumber_text = _extract_with_pdfplumber(file_path)
    if plumber_text and len(plumber_text) > min_len:
        return plumber_text

    _log.warning(f"pdfplumber returned only {len(plumber_text)} chars — switching to OCR")
    return _extract_with_ocr_gpu(file_path)


# ---------------------------------------------------------------------------
# Formatting helpers
# ---------------------------------------------------------------------------

def _fmt(value) -> str:
    try:
        return f"{float(value):,.2f}"
    except (TypeError, ValueError):
        return "0.00"


def _fmt_records(records: list) -> list:
    date_fmt = REPORTS["date_format"]
    out = []
    for record in records:
        item = dict(record)
        date_col = COLUMNS["date"]
        if date_col in item and hasattr(item[date_col], "strftime"):
            item[date_col] = item[date_col].strftime(date_fmt)
        for key in (COLUMNS["debit"], COLUMNS["credit"], COLUMNS["balance"],
                    COLUMNS["amount"], "total_amount"):
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
        "count":        report["count"],
        "total":        _fmt(report["total"]),
        "avg":          _fmt(report["avg"]),
        "largest":      _fmt(report["largest"]),
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


# ---------------------------------------------------------------------------
# Metadata enrichment
# ---------------------------------------------------------------------------

def _enrich_details(details: dict, text: str, cfg: dict | None = None) -> dict:
    """Extract account holder, bank name, period using spaCy NER (with fallback)."""
    if cfg is None:
        cfg = {}

    lines = [l.strip() for l in text.splitlines() if l.strip()]

    # Use spaCy NER for bank name detection - search in more lines (bank name may be far down)
    bank_name = _nlp_detect_bank("\n".join(lines[:60]))

    # Use spaCy NER for account holder detection
    account_holder = _nlp_detect_holder(text)

    # Period detection - "Statement From" label followed by date range
    period_str = ''
    _PERIOD_RE = re.compile(
        r'(\d{1,2}[-/]\d{1,2}[-/]\d{4})\s+(?:to|To|–)\s+(\d{1,2}[-/]\d{1,2}[-/]\d{4})'
    )
    full_header = "\n".join(lines[:60])
    # Check label-value pairs (label on one line, value on next)
    for i, line in enumerate(lines[:60]):
        if re.search(r'statement\s+(?:from|period)|period', line, re.IGNORECASE):
            # Value might be on same line or next line
            search_text = line
            if i + 1 < len(lines):
                search_text += " " + lines[i + 1]
            m = _PERIOD_RE.search(search_text)
            if m:
                period_str = f"{m.group(1)} To {m.group(2)}"
                break
    if not period_str:
        m = _PERIOD_RE.search(full_header)
        if m:
            period_str = f"{m.group(1)} To {m.group(2)}"

    # Account number detection - label on one line, value on next
    acct_no = ''
    for i, line in enumerate(lines[:20]):
        if re.search(r'^account\s*no$', line, re.IGNORECASE):
            # Value is on next non-label line
            for j in range(i + 1, min(i + 5, len(lines))):
                val = lines[j].strip()
                if val.isdigit() and 8 <= len(val) <= 20:
                    acct_no = val
                    break
                elif val and not re.search(r'^account|^product', val, re.IGNORECASE):
                    break
            if acct_no:
                break
    if not acct_no:
        _ACCT_RE = re.compile(
            r'(?:account\s*(?:no|number|no\.)|a/c\s*(?:no|number)?)\s*[:\-]?\s*(\d{8,20})',
            re.IGNORECASE
        )
        m_acct = _ACCT_RE.search(full_header)
        if m_acct:
            acct_no = m_acct.group(1)

    # SBI-style grouped labels: "Account No", "Product", "Account Open Date"
    # appear on consecutive lines, followed by their values in the same order
    sbi_fields = []
    _SBI_GROUPS = [
        ['account no', 'product', 'account open date'],
        ['account no', 'account open date'],
    ]
    for group in _SBI_GROUPS:
        for start_i, line in enumerate(lines[:30]):
            if line.strip().lower().rstrip(':') == group[0]:
                match = all(
                    start_i + k < len(lines) and
                    lines[start_i + k].strip().lower().rstrip(':') == group[k]
                    for k in range(len(group))
                )
                if match:
                    val_start = start_i + len(group)
                    for k, lbl in enumerate(group):
                        val_idx = val_start + k
                        if val_idx < len(lines):
                            val = lines[val_idx].strip()
                            if val and not re.search(r'^account|^product', val, re.IGNORECASE):
                                sbi_fields.append({'label': lbl.title(), 'value': val})
                                if lbl == 'account no' and val.isdigit():
                                    acct_no = val
                    break
        if sbi_fields:
            break

    # Account holder address: lines after holder name
    holder_address = ''
    if account_holder:
        holder_upper = account_holder.upper().replace('  ', ' ')
        for i, line in enumerate(lines[:20]):
            if line.strip().upper().replace('  ', ' ') == holder_upper:
                addr_parts = []
                for j in range(i + 1, min(i + 5, len(lines))):
                    part = lines[j].strip()
                    if (not part or part.isdigit() or
                            re.search(r'^\d{2}[-/]\d{2}[-/]\d{4}$', part) or
                            part.lower() in ('drawing power', 'date of statement', 'ifsc code')):
                        break
                    addr_parts.append(part)
                if addr_parts:
                    holder_address = ', '.join(addr_parts)
                break

    # Bank address: lines after bank name
    bank_address = ''
    if bank_name:
        bank_upper = bank_name.upper()
        for i, line in enumerate(lines[:80]):
            if line.strip().upper() == bank_upper:
                addr_parts = []
                for j in range(i + 1, min(i + 4, len(lines))):
                    part = lines[j].strip()
                    if not part or part == ':' or part.lower() in ('open', 'nominee name'):
                        break
                    addr_parts.append(part)
                if addr_parts:
                    bank_address = ', '.join(addr_parts)
                break

    # Extract useful fields using label-on-line, value-on-next-line format
    # Also handle SBI-style grouped labels: multiple labels followed by their values
    useful_labels = {
        'currency', 'ifsc code', 'ifsc', 'interest rate', 'branch code',
        'micr code', 'account status', 'cleared balance', 'opening balance',
        'product', 'account open date', 'account type', 'nominee name',
        'drawing power', 'uncleared amount', 'monthly avg balance',
        'branch email', 'branch phone', 'date of statement',
    }

    def _looks_like_label(s: str) -> bool:
        """True if string looks like a field label (not a value)."""
        return s.lower().rstrip(':') in useful_labels or s.lower() in (
            'account no', 'account number', 'product', 'account open date'
        )

    def _is_valid_value(label: str, value: str) -> bool:
        if not value or len(value) > 60:
            return False
        if _looks_like_label(value):
            return False
        if 'date' in label.lower():
            # Date value must contain digits
            if not re.search(r'\d', value):
                return False
            # Account number (all digits) is not a date
            if value.isdigit() and len(value) > 6:
                return False
        if label.lower() == 'product' and value.isdigit():
            return False
        return True

    # Detect grouped label blocks: consecutive label lines followed by value lines
    label_value_fields = []
    i = 0
    while i < len(lines) - 1:
        label = lines[i].strip().rstrip(':').strip()
        if label.lower() in useful_labels:
            # Check if next lines are also labels (grouped block)
            group_labels = [label]
            j = i + 1
            while j < len(lines) and _looks_like_label(lines[j].strip().rstrip(':')):
                group_labels.append(lines[j].strip().rstrip(':').strip())
                j += 1
            # Now collect values for each label
            for k, lbl in enumerate(group_labels):
                val_idx = j + k
                if val_idx < len(lines):
                    val = lines[val_idx].strip().lstrip(':').strip()
                    if _is_valid_value(lbl, val):
                        label_value_fields.append({'label': lbl, 'value': val})
            i = j + len(group_labels)
        else:
            i += 1

    # Filter out transaction-like fields from existing detail_cards
    _TXN_VALUE_RE = re.compile(
        r'BROUGHT\s+FORWARD|CASH\s+DEPOSIT|ATM\s+WDL|INTER\s+BRCH|DEBIT\s*ENTRY|'
        r'^\d{2}[-/]\d{2}[-/]\d{4}\s+\d{2}[-/]\d{2}[-/]\d{4}',
        re.IGNORECASE
    )
    details['fields'] = [
        f for f in details['fields']
        if not _TXN_VALUE_RE.search(str(f.get('value', '')))
        and not _TXN_VALUE_RE.search(str(f.get('label', '')))
        and len(str(f.get('value', ''))) < 200
    ]

    existing_labels = {
        f['label'].lower().replace(' ', '').replace('/', '')
        for f in details['fields']
    }

    # Add enriched fields at the top
    if account_holder and 'accountholder' not in existing_labels and 'name' not in existing_labels:
        details['fields'].insert(0, {'label': 'Account Holder', 'value': account_holder})
    if bank_name and 'bank' not in existing_labels and 'bankname' not in existing_labels:
        details['fields'].insert(0, {'label': 'Bank', 'value': bank_name})
    if acct_no and 'accountno' not in existing_labels and 'accountnumber' not in existing_labels:
        details['fields'].insert(1 if bank_name else 0, {'label': 'Account No', 'value': acct_no})
    if period_str and 'period' not in existing_labels and 'statementperiod' not in existing_labels:
        details['fields'].append({'label': 'Statement Period', 'value': period_str})

    # Add SBI grouped fields (Product, Account Open Date)
    for lv in sbi_fields:
        norm = lv['label'].lower().replace(' ', '').replace('/', '')
        if norm not in existing_labels and norm not in ('accountno', 'accountnumber'):
            details['fields'].append(lv)
            existing_labels.add(norm)

    # Add addresses
    if holder_address and 'holderaddress' not in existing_labels and 'address' not in existing_labels:
        details['fields'].append({'label': 'Holder Address', 'value': holder_address})
    if bank_address and 'bankaddress' not in existing_labels and 'branchaddress' not in existing_labels:
        details['fields'].append({'label': 'Branch Address', 'value': bank_address})

    # Add useful label-value fields if not already present
    for lv in label_value_fields:
        norm = lv['label'].lower().replace(' ', '').replace('/', '')
        if norm not in existing_labels:
            details['fields'].append(lv)
            existing_labels.add(norm)

    return details


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def run_pipeline(file_path, pre_extracted_text: str | None = None) -> dict:
    """Sync entry point — uses default settings (no DB call in sync context)."""
    from loguru import logger as _log
    cfg = _get_default_settings()
    return _run_pipeline_with_config(file_path, pre_extracted_text, cfg, _log)


async def run_pipeline_async(file_path, pre_extracted_text: str | None = None) -> dict:
    """Async entry point — loads settings from DB with fallback to defaults."""
    from loguru import logger as _log
    import asyncio
    try:
        from open_notebook.bank_statement.settings import get_all_settings
        cfg = await get_all_settings()
    except Exception as e:
        _log.debug(f"[BankPipeline] Settings load failed: {e} — using defaults")
        cfg = _get_default_settings()
    return await asyncio.to_thread(_run_pipeline_with_config, file_path, pre_extracted_text, cfg, _log)


async def _load_settings_async() -> dict:
    from open_notebook.bank_statement.settings import get_all_settings
    return await get_all_settings()


def _get_default_settings() -> dict:
    from open_notebook.bank_statement.settings import get_schema
    return {k: v["default"] for k, v in get_schema().items()}


def _run_pipeline_with_config(file_path, pre_extracted_text, cfg, _log) -> dict:
    min_len = cfg.get("pdfplumber_timeout_seconds", EXTRACTION["min_text_length"])
    # Use min_text_length from EXTRACTION (not user-configurable, it's a code constant)
    min_text = EXTRACTION["min_text_length"]

    # 1. Extract text
    if pre_extracted_text and len(pre_extracted_text.strip()) > min_text:
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
    details = _enrich_details(details, text, cfg)

    # 3. Parse + clean
    df = clean_data(parse_transactions(text))

    # 4. Classify — pass cfg so category rules come from DB
    if not df.empty:
        df, nlp_groups = classify(df, cfg=cfg)
    else:
        for col in (COLUMNS["type"], COLUMNS["nlp_keywords"], COLUMNS["category"]):
            df[col] = []
        nlp_groups = []

    # 5. All 10 reports — pass cfg so thresholds come from DB
    high_value_threshold = cfg.get("high_value_threshold", REPORTS["high_value_threshold"])
    r_cashflow  = cash_flow(df)
    r_monthly   = monthly_summary(df)
    r_types     = transaction_type(df)
    r_atm       = atm_report(df, cfg=cfg)
    r_charges   = charges_report(df, cfg=cfg)
    r_pattern   = pattern_report(df)
    r_highval   = high_value(df, threshold=high_value_threshold)
    r_trend     = balance_trend(df)
    r_interest  = interest_report(df, cfg=cfg)
    r_frequency = frequency_report(df)

    # 6. Transaction list
    display_cols = [c for c in DISPLAY_COLUMNS if c in df.columns]
    txn_records  = df[display_cols].to_dict("records") if not df.empty else []

    return {
        "details":            details,
        "detail_cards":       details["fields"],
        "nlp_groups":         nlp_groups,
        "total_transactions": int(len(df)),
        "cashflow":           {k: _fmt(v) for k, v in r_cashflow.items()},
        "monthly":            _fmt_records(r_monthly),
        "types":              _fmt_records(r_types),
        "atm":                _fmt_atm(r_atm),
        "charges":            _fmt_charges(r_charges),
        "pattern":            _fmt_pattern(r_pattern),
        "high_value":         _fmt_records(r_highval),
        "balance_trend":      _fmt_records(r_trend),
        "interest":           _fmt_interest(r_interest),
        "frequency":          r_frequency,
        "transactions":       _fmt_records(txn_records),
        "_extracted_text":    raw_extracted or "",
    }
