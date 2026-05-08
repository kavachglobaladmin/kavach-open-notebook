"""
Bank statement transaction parser.
All constants loaded from settings.py (DB-backed, no hardcoded values).
"""

import datetime
import re

import pandas as pd

from open_notebook.bank_statement.settings import get_defaults
from open_notebook.bank_statement.nlp_engine import (
    is_balance_line as _nlp_is_balance,
    is_header_line as _nlp_is_header,
    should_skip_line as _nlp_should_skip,
    is_page_noise as _nlp_is_page_noise,
)

_D = get_defaults()

# Compile skip patterns and date regex at import time from defaults
_COMPILED_SKIP = [re.compile(p, re.IGNORECASE) for p in _D["skip_line_patterns"]]
_STRICT_DATE_RE = re.compile(
    r"\b(0?[1-9]|[12]\d|3[01])([-/.])(0?[1-9]|1[0-2])\2(\d{4})\b"
)
_PAGE_NOISE_RE = re.compile(_D["page_noise_pattern"], re.IGNORECASE)


def _get_months():
    return _D["months_map"]


def _get_header_words():
    return set(_D["header_words"])


def _get_balance_words():
    return set(_D["balance_label_words"])


# ---------------------------------------------------------------------------
# Amount helpers
# ---------------------------------------------------------------------------

def _parse_amount(token: str):
    t = token.strip()
    marker = ""
    upper = t.upper()
    if upper.endswith("CR"):
        marker = "CR"
        t = t[:-2]
    elif upper.endswith("DR"):
        marker = "DR"
        t = t[:-2]

    t = t.replace(",", "").strip()
    if not t or not any(c.isdigit() for c in t):
        return None
    if t.count(".") != 1:
        return None
    integer_part, decimal_part = t.split(".")
    if not integer_part.isdigit() or not decimal_part.isdigit():
        return None
    if len(decimal_part) > _D["max_decimal_places"]:
        return None
    value = float(t)
    if value < 0:
        return None
    return value, marker


def _signed(value: float, marker: str) -> float:
    return -value if marker == "DR" else value


def _amounts_in_line(line: str):
    results = []
    for idx, tok in enumerate(line.split()):
        parsed = _parse_amount(tok)
        if parsed:
            results.append((idx, parsed[0], parsed[1]))
    return results


# ---------------------------------------------------------------------------
# Date helpers
# ---------------------------------------------------------------------------

def _parse_strict_date(token: str) -> datetime.date | None:
    m = _STRICT_DATE_RE.search(token.strip(" ,."))
    if not m:
        return None
    day, month, year = int(m.group(1)), int(m.group(3)), int(m.group(4))
    year_max = datetime.date.today().year + _D["year_range_max_offset"]
    if year < _D["year_range_min"] or year > year_max:
        return None
    try:
        return datetime.date(year, month, day)
    except ValueError:
        return None


def _parse_mixed_date(token: str, fallback_year: int) -> datetime.date | None:
    months = _get_months()
    for sep in ("-", "/", "."):
        if sep not in token:
            continue
        parts = token.split(sep)
        if len(parts) != 3:
            continue
        day_s, mon_s, yr_s = parts[0].strip(), parts[1].strip().lower(), parts[2].strip()
        if not day_s.isdigit() or mon_s not in months:
            continue
        day = int(day_s)
        month = months[mon_s]
        year = int(yr_s) if yr_s.isdigit() and len(yr_s) == 4 else fallback_year
        if day < 1 or day > 31:
            continue
        try:
            return datetime.date(year, month, day)
        except ValueError:
            continue
    return None


def _parse_text_date(tokens, start, fallback_year, period=None):
    months = _get_months()
    if start >= len(tokens):
        return None, start

    day_tok = tokens[start].strip(" ,.")
    if day_tok.isdigit() and start + 1 < len(tokens):
        mon_tok = tokens[start + 1].strip(" ,.-").lower()
        if mon_tok in months:
            day = int(day_tok)
            if 1 <= day <= 31:
                month = months[mon_tok]
                year = fallback_year
                next_idx = start + 2
                if next_idx < len(tokens):
                    yr_tok = tokens[next_idx].strip(" ,.")
                    if yr_tok.isdigit() and len(yr_tok) == 4:
                        year = int(yr_tok)
                        next_idx += 1
                year = _resolve_year(month, year, period)
                try:
                    return datetime.date(year, month, day), next_idx
                except ValueError:
                    pass

    mon_tok = tokens[start].strip(" ,.-").lower()
    if mon_tok in months and start + 1 < len(tokens):
        day_tok2 = tokens[start + 1].strip(" ,.")
        if day_tok2.isdigit():
            day = int(day_tok2)
            if 1 <= day <= 31:
                month = months[mon_tok]
                year = fallback_year
                next_idx = start + 2
                if next_idx < len(tokens):
                    yr_tok = tokens[next_idx].strip(" ,.")
                    if yr_tok.isdigit() and len(yr_tok) == 4:
                        year = int(yr_tok)
                        next_idx += 1
                year = _resolve_year(month, year, period)
                try:
                    return datetime.date(year, month, day), next_idx
                except ValueError:
                    pass

    return None, start


def _resolve_year(month, default_year, period):
    if not period:
        return default_year
    start_month, start_year, end_month, end_year = period
    if start_year == end_year:
        return start_year
    return start_year if month >= start_month else end_year


def _date_from_tokens(tokens, fallback_year, period=None):
    found_dates = []
    for idx, tok in enumerate(tokens):
        d = _parse_strict_date(tok)
        if d:
            found_dates.append((idx, d))
            continue
        d2 = _parse_mixed_date(tok, fallback_year)
        if d2:
            found_dates.append((idx, d2))

    for idx in range(len(tokens)):
        d3, _ = _parse_text_date(tokens, idx, fallback_year, period)
        if d3:
            found_dates.append((idx, d3))

    if not found_dates:
        return None, 0

    found_dates.sort(key=lambda x: x[0])
    first_idx, first_date = found_dates[0]
    desc_start = first_idx + 1
    if len(found_dates) >= 2:
        second_idx, second_date = found_dates[1]
        if second_date == first_date and second_idx == first_idx + 1:
            desc_start = second_idx + 1
    return first_date, desc_start


# ---------------------------------------------------------------------------
# Line classification
# ---------------------------------------------------------------------------

def _should_skip_line(line: str) -> bool:
    # Try spaCy-based detection first, fallback to compiled patterns
    try:
        return _nlp_should_skip(line)
    except Exception:
        return any(p.search(line) for p in _COMPILED_SKIP)


def _is_header_line(line: str) -> bool:
    # Try spaCy POS-based detection first
    try:
        return _nlp_is_header(line)
    except Exception:
        words = {w.lower().strip(" ,.:-/") for w in line.split()}
        return len(words & _get_header_words()) >= 3


def _is_balance_line(line: str) -> bool:
    # Try spaCy-based detection first
    try:
        return _nlp_is_balance(line)
    except Exception:
        words = {w.lower().strip(" ,.:-") for w in line.split()}
        return bool(words & _get_balance_words())


def _extract_balance_value(line: str):
    amounts = _amounts_in_line(line)
    if not amounts:
        return None
    _, value, marker = amounts[-1]
    return _signed(value, marker)


# ---------------------------------------------------------------------------
# Debit / Credit split
# ---------------------------------------------------------------------------

def _split_debit_credit(amount, prev_balance, curr_balance):
    if prev_balance is None:
        return 0.0, amount
    change = round(curr_balance - prev_balance, 2)
    if abs(change - amount) < 0.05:
        return 0.0, amount
    if abs(change + amount) < 0.05:
        return amount, 0.0
    if change >= 0:
        return 0.0, abs(change)
    return abs(change), 0.0


# ---------------------------------------------------------------------------
# Statement-level helpers
# ---------------------------------------------------------------------------

def _statement_year(text: str) -> int:
    year_max = datetime.date.today().year + _D["year_range_max_offset"]
    for line in text.splitlines():
        for tok in line.split():
            clean = tok.strip(" ,.")
            if clean.isdigit() and len(clean) == 4:
                yr = int(clean)
                if 2000 <= yr <= year_max:
                    return yr
    return datetime.date.today().year


def _statement_period(text: str):
    months = _get_months()
    dates_found = []
    for line in text.splitlines()[:30]:
        for tok in line.split():
            d = _parse_strict_date(tok)
            if d:
                dates_found.append(d)
        if len(dates_found) >= 2:
            break

    if len(dates_found) >= 2:
        d1, d2 = dates_found[0], dates_found[-1]
        if d1 != d2:
            start, end = (d1, d2) if d1 < d2 else (d2, d1)
            return start.month, start.year, end.month, end.year

    tokens = " ".join(text.splitlines()).split()
    found = []
    for i in range(len(tokens) - 2):
        day = tokens[i].strip(" ,.")
        month = tokens[i + 1].strip(" ,.").lower()
        year = tokens[i + 2].strip(" ,.")
        if day.isdigit() and month in months and year.isdigit() and len(year) == 4:
            found.append(datetime.date(int(year), months[month], int(day)))
            if len(found) == 2:
                start, end = (found[0], found[1]) if found[0] < found[1] else (found[1], found[0])
                return start.month, start.year, end.month, end.year
    return None


# ---------------------------------------------------------------------------
# Core transaction parser
# ---------------------------------------------------------------------------

def _clean_description(desc_tokens, fallback_year):
    _AMOUNT_PAT = re.compile(r"^\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?(?:CR|DR)?$", re.IGNORECASE)
    months = _get_months()
    clean = []
    for tok in desc_tokens:
        if _parse_strict_date(tok) is not None:
            continue
        if _AMOUNT_PAT.match(tok.replace(",", "")):
            continue
        # Use spaCy page noise detection (falls back to regex if spaCy unavailable)
        try:
            if _nlp_is_page_noise(tok):
                continue
        except Exception:
            if _PAGE_NOISE_RE.search(tok):
                continue
        if not clean and tok.strip(" ,.-").lower() in months:
            continue
        clean.append(tok)
    return " ".join(clean).strip()


def _parse_transaction_line(line, prev_balance, current_date, fallback_year, period):
    tokens = line.split()
    if len(tokens) < 3:
        return None

    date_obj, desc_start = _date_from_tokens(tokens, fallback_year, period)
    if date_obj is None:
        if current_date:
            date_obj = current_date
            desc_start = 0
        else:
            return None

    amounts = _amounts_in_line(line)
    if len(amounts) < 2:
        return None

    bal_idx, bal_value, bal_marker = amounts[-1]
    amt_idx, amt_value, amt_marker = amounts[-2]
    balance = _signed(bal_value, bal_marker)

    if amt_marker == "CR":
        debit, credit = 0.0, amt_value
    elif amt_marker == "DR":
        debit, credit = amt_value, 0.0
    else:
        debit, credit = _split_debit_credit(amt_value, prev_balance, balance)

    desc_tokens = tokens[desc_start:amt_idx]
    while desc_tokens and not any(c.isalnum() for c in desc_tokens[0]):
        desc_tokens = desc_tokens[1:]
    description = _clean_description(desc_tokens, fallback_year)
    if not description:
        description = " ".join(tokens[desc_start:amt_idx]).strip() or line.strip()

    return {
        _D["col_date"]:        pd.Timestamp(date_obj),
        _D["col_description"]: description,
        _D["col_debit"]:       round(debit, 2),
        _D["col_credit"]:      round(credit, 2),
        _D["col_balance"]:     round(balance, 2),
    }


def _is_continuation(line: str) -> bool:
    tokens = line.split()
    if not tokens or len(tokens) > _D["continuation_line_max_tokens"]:
        return False
    has_date = _date_from_tokens(tokens, datetime.date.today().year)[0] is not None
    return not has_date and not bool(_amounts_in_line(line))


_PAGE_HEADER_RE = re.compile(
    r"issued\s+by|page\s+\d+\s+of|account\s+no\.|account\s+holder|date\s+day",
    re.IGNORECASE,
)


def _is_page_header(line: str) -> bool:
    return bool(_PAGE_HEADER_RE.search(line))


def _is_date_only_line(line, fallback_year, period) -> bool:
    tokens = line.split()
    if not tokens or len(tokens) > 3:
        return False
    date_obj, _ = _date_from_tokens(tokens, fallback_year, period)
    return date_obj is not None and not bool(_amounts_in_line(line))


def _is_amount_only_line(line: str) -> bool:
    tokens = line.split()
    return len(tokens) == 1 and _parse_amount(tokens[0]) is not None


def _join_multiline_transactions(lines, fallback_year, period):
    min_date_lines = _D["multiline_min_date_only_lines"]
    date_only_count = sum(1 for l in lines if _is_date_only_line(l, fallback_year, period))
    if date_only_count < min_date_lines:
        return lines

    result = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if _is_date_only_line(line, fallback_year, period):
            block = [line]
            i += 1
            while i < len(lines):
                next_line = lines[i]
                if _is_date_only_line(next_line, fallback_year, period):
                    break
                if _is_header_line(next_line) or _should_skip_line(next_line) or _is_page_header(next_line):
                    break
                block.append(next_line)
                if sum(1 for l in block[1:] if _is_amount_only_line(l)) >= 2:
                    i += 1
                    break
                i += 1
            if len([l for l in block[1:] if _is_amount_only_line(l)]) >= 2:
                result.append(" ".join(block))
            else:
                result.extend(block)
        else:
            result.append(line)
            i += 1
    return result


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def parse_transactions(text: str) -> pd.DataFrame:
    rows = []
    prev_balance = None
    current_date = None
    fallback_year = _statement_year(text)
    period = _statement_period(text)
    seen_keys: set = set()

    raw_lines = [" ".join(l.split()) for l in text.splitlines() if l.strip()]
    raw_lines = _join_multiline_transactions(raw_lines, fallback_year, period)

    desc_col = _D["col_description"]

    for line in raw_lines:
        if _should_skip_line(line):
            continue
        if _is_header_line(line):
            continue
        if _is_balance_line(line):
            val = _extract_balance_value(line)
            if val is not None:
                prev_balance = val
            continue

        tokens = line.split()
        date_candidate, _ = _date_from_tokens(tokens, fallback_year, period)
        if date_candidate:
            current_date = date_candidate

        txn = _parse_transaction_line(line, prev_balance, current_date, fallback_year, period)
        if txn:
            key = (txn[_D["col_date"]], round(txn[_D["col_debit"]], 2),
                   round(txn[_D["col_credit"]], 2), round(txn[_D["col_balance"]], 2))
            if key in seen_keys:
                continue
            seen_keys.add(key)
            prev_balance = txn[_D["col_balance"]]
            rows.append(txn)
            continue

        if rows and _is_continuation(line):
            rows[-1][desc_col] = (rows[-1][desc_col] + " " + line).strip()

    if not rows:
        return pd.DataFrame(columns=[
            _D["col_date"], _D["col_description"],
            _D["col_debit"], _D["col_credit"], _D["col_balance"],
        ])

    df = pd.DataFrame(rows)[[
        _D["col_date"], _D["col_description"],
        _D["col_debit"], _D["col_credit"], _D["col_balance"],
    ]]
    return df.sort_values(_D["col_date"]).reset_index(drop=True)
