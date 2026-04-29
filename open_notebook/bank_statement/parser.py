"""
Bank statement transaction parser.

Handles Indian bank statement formats (SBI, HDFC, ICICI, Axis, etc.)

Key features:
- Supports DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY, DD-Mon-YYYY, DD Mon YYYY
- Handles SBI "Post Date + Value Date" duplicate columns (takes only first date)
- Rejects OCR-corrupted dates (day>31, month>12)
- Skips page headers, footers, summary lines
- Deduplicates transactions by (date, balance) key
- Handles CR/DR suffix amounts and Indian comma formatting
"""

import datetime
import re

import pandas as pd


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MONTHS = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}

# Strict numeric date: DD-MM-YYYY only (day 01-31, month 01-12, year 4 digits)
# Rejects OCR garbage like 44-44-2011, 93-01-2012
_STRICT_DATE_RE = re.compile(
    r"\b(0?[1-9]|[12]\d|3[01])([-/.])(0?[1-9]|1[0-2])\2(\d{4})\b"
)

# Words that indicate a table header row — skip these lines
_HEADER_WORDS = {
    "date", "transaction", "details", "narration", "description",
    "particulars", "amount", "balance", "debit", "credit",
    "withdrawal", "deposit", "payment", "method",
    "chq", "cheque", "ref", "value", "post", "remarks", "no/reference",
}

# Words that indicate opening/closing/brought-forward balance lines — skip as transactions
_BALANCE_LABEL_WORDS = {
    "opening", "closing", "brought", "forward", "carried",
    "b/f", "c/f", "b/d", "c/d",
}

# Words that indicate summary/footer lines — skip entirely
_SKIP_LINE_PATTERNS = [
    re.compile(r"page\s+no", re.IGNORECASE),
    re.compile(r"end\s+of\s+statement", re.IGNORECASE),
    re.compile(r"statement\s+summary", re.IGNORECASE),
    re.compile(r"brought\s+forward", re.IGNORECASE),
    re.compile(r"closing\s+balance", re.IGNORECASE),
    re.compile(r"total\s+debit", re.IGNORECASE),
    re.compile(r"total\s+credit", re.IGNORECASE),
    re.compile(r"last\s+transaction", re.IGNORECASE),
    re.compile(r"in\s+case\s+your\s+account", re.IGNORECASE),
    re.compile(r"dr\s+count", re.IGNORECASE),
    re.compile(r"cr\s+count", re.IGNORECASE),
]


# ---------------------------------------------------------------------------
# Amount helpers
# ---------------------------------------------------------------------------

def _parse_amount(token: str):
    """
    Return (float_value, marker) where marker is 'CR', 'DR', or ''.
    Returns None if token is not a valid amount.
    Requires decimal point to avoid matching account numbers / years.
    """
    t = token.strip()
    marker = ""
    upper = t.upper()
    if upper.endswith("CR"):
        marker = "CR"
        t = t[:-2]
    elif upper.endswith("DR"):
        marker = "DR"
        t = t[:-2]

    # Remove Indian-style commas (1,23,456.78)
    t = t.replace(",", "").strip()
    if not t:
        return None
    if not any(c.isdigit() for c in t):
        return None
    if t.count(".") != 1:          # must have exactly one decimal point
        return None
    integer_part, decimal_part = t.split(".")
    if not integer_part.isdigit() or not decimal_part.isdigit():
        return None
    if len(decimal_part) > 2:      # reject things like 35738.00CR that are balances with 2dp — actually keep
        return None
    value = float(t)
    if value < 0:
        return None
    return value, marker


def _signed(value: float, marker: str) -> float:
    return -value if marker == "DR" else value


def _amounts_in_line(line: str):
    """Return list of (token_index, float_value, marker) for every valid amount token."""
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
    """
    Parse DD-MM-YYYY / DD/MM/YYYY / DD.MM.YYYY strictly.
    Rejects OCR-corrupted values like 44-44-2011 or 93-01-2012.
    """
    m = _STRICT_DATE_RE.search(token.strip(" ,."))
    if not m:
        return None
    day = int(m.group(1))
    month = int(m.group(3))
    year = int(m.group(4))
    # Sanity check year range
    if year < 1990 or year > datetime.date.today().year + 1:
        return None
    try:
        return datetime.date(year, month, day)
    except ValueError:
        return None


def _parse_mixed_date(token: str, fallback_year: int) -> datetime.date | None:
    """
    Parse tokens like '10-Apr-2024' or '10/Apr/2024'.
    """
    for sep in ("-", "/", "."):
        if sep not in token:
            continue
        parts = token.split(sep)
        if len(parts) != 3:
            continue
        day_s, mon_s, yr_s = parts[0].strip(), parts[1].strip().lower(), parts[2].strip()
        if not day_s.isdigit():
            continue
        if mon_s not in MONTHS:
            continue
        day = int(day_s)
        month = MONTHS[mon_s]
        year = int(yr_s) if yr_s.isdigit() and len(yr_s) == 4 else fallback_year
        if day < 1 or day > 31:
            continue
        try:
            return datetime.date(year, month, day)
        except ValueError:
            continue
    return None


def _parse_text_date(tokens: list, start: int, fallback_year: int, period=None):
    """
    Try to find a textual date starting at tokens[start].
    Handles: "15 Jan 2024", "15 Jan", "Jan 15, 2024"
    Returns (datetime.date, next_token_index) or (None, start).
    """
    if start >= len(tokens):
        return None, start

    # Pattern: DD Mon [YYYY]
    day_tok = tokens[start].strip(" ,.")
    if day_tok.isdigit() and start + 1 < len(tokens):
        mon_tok = tokens[start + 1].strip(" ,.-").lower()
        if mon_tok in MONTHS:
            day = int(day_tok)
            if 1 <= day <= 31:
                month = MONTHS[mon_tok]
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

    # Pattern: Mon DD[,] [YYYY]
    mon_tok = tokens[start].strip(" ,.-").lower()
    if mon_tok in MONTHS and start + 1 < len(tokens):
        day_tok2 = tokens[start + 1].strip(" ,.")
        if day_tok2.isdigit():
            day = int(day_tok2)
            if 1 <= day <= 31:
                month = MONTHS[mon_tok]
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


def _resolve_year(month: int, default_year: int, period) -> int:
    """Pick the correct year when a statement spans two calendar years."""
    if not period:
        return default_year
    start_month, start_year, end_month, end_year = period
    if start_year == end_year:
        return start_year
    return start_year if month >= start_month else end_year


def _date_from_tokens(tokens: list, fallback_year: int, period=None):
    """
    Scan tokens for a valid date.
    Returns (datetime.date, description_start_index) or (None, 0).

    SBI statements have TWO date columns (Post Date, Value Date).
    We take the FIRST valid date and skip the second if it's identical.
    """
    found_dates = []

    for idx, tok in enumerate(tokens):
        # Strict numeric date (DD-MM-YYYY etc.)
        d = _parse_strict_date(tok)
        if d:
            found_dates.append((idx, d))
            continue

        # Mixed token like "10-Apr-2024"
        d2 = _parse_mixed_date(tok, fallback_year)
        if d2:
            found_dates.append((idx, d2))
            continue

    # Try textual multi-token dates
    for idx in range(len(tokens)):
        d3, next_idx = _parse_text_date(tokens, idx, fallback_year, period)
        if d3:
            found_dates.append((idx, d3))

    if not found_dates:
        return None, 0

    # Sort by position, take first
    found_dates.sort(key=lambda x: x[0])
    first_idx, first_date = found_dates[0]

    # Skip second date if it's the same (SBI Post Date = Value Date pattern)
    desc_start = first_idx + 1
    if len(found_dates) >= 2:
        second_idx, second_date = found_dates[1]
        if second_date == first_date and second_idx == first_idx + 1:
            desc_start = second_idx + 1

    return first_date, desc_start


# ---------------------------------------------------------------------------
# Line classification helpers
# ---------------------------------------------------------------------------

def _should_skip_line(line: str) -> bool:
    """Return True if this line should be completely ignored."""
    for pattern in _SKIP_LINE_PATTERNS:
        if pattern.search(line):
            return True
    return False


def _is_header_line(line: str) -> bool:
    """Return True if this looks like a table column header row."""
    words = {w.lower().strip(" ,.:-/") for w in line.split()}
    return len(words & _HEADER_WORDS) >= 3


def _is_balance_line(line: str) -> bool:
    """Return True if this is an opening/closing balance declaration."""
    words = {w.lower().strip(" ,.:-") for w in line.split()}
    return bool(words & _BALANCE_LABEL_WORDS)


def _extract_balance_value(line: str):
    """
    Extract the balance value from an opening/closing balance line.
    Returns float or None.
    """
    amounts = _amounts_in_line(line)
    if not amounts:
        return None
    _, value, marker = amounts[-1]
    return _signed(value, marker)


# ---------------------------------------------------------------------------
# Debit / Credit split
# ---------------------------------------------------------------------------

def _split_debit_credit(amount: float, prev_balance, curr_balance):
    """
    Determine whether `amount` is a debit or credit using balance change.
    """
    if prev_balance is None:
        return 0.0, amount

    change = round(curr_balance - prev_balance, 2)
    if abs(change - amount) < 0.05:
        return 0.0, amount        # credit
    if abs(change + amount) < 0.05:
        return amount, 0.0        # debit
    if change >= 0:
        return 0.0, abs(change)
    return abs(change), 0.0


# ---------------------------------------------------------------------------
# Statement-level helpers
# ---------------------------------------------------------------------------

def _statement_year(text: str) -> int:
    """Best-guess year from statement header text."""
    for line in text.splitlines():
        for tok in line.split():
            clean = tok.strip(" ,.")
            if clean.isdigit() and len(clean) == 4:
                yr = int(clean)
                if 2000 <= yr <= datetime.date.today().year + 1:
                    return yr
    return datetime.date.today().year


def _statement_period(text: str):
    """
    Find statement period (start_month, start_year, end_month, end_year).
    Looks for patterns like "01-11-2011 To 28-02-2013".
    """
    # Try numeric date pairs first (most reliable)
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
            return d1.month, d1.year, d2.month, d2.year

    # Fallback: textual month-year pairs
    tokens = " ".join(text.splitlines()).split()
    found = []
    for i in range(len(tokens) - 2):
        day = tokens[i].strip(" ,.")
        month = tokens[i + 1].strip(" ,.").lower()
        year = tokens[i + 2].strip(" ,.")
        if day.isdigit() and month in MONTHS and year.isdigit() and len(year) == 4:
            found.append((MONTHS[month], int(year)))
            if len(found) == 2:
                return found[0][0], found[0][1], found[1][0], found[1][1]
    return None


# ---------------------------------------------------------------------------
# Core transaction parser
# ---------------------------------------------------------------------------

def _clean_description(desc_tokens: list, fallback_year: int) -> str:
    """
    Build a clean description string, removing stray date tokens,
    amount tokens, and page-header fragments.
    """
    _PAGE_NOISE = re.compile(
        r"page\s*no|value\s*date|cheque|no/ref|heque|post\s*date",
        re.IGNORECASE,
    )
    # Amount pattern — remove stray amounts from description
    _AMOUNT_PAT = re.compile(r"^\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?(?:CR|DR)?$", re.IGNORECASE)

    clean = []
    for tok in desc_tokens:
        # Skip stray numeric dates
        if _parse_strict_date(tok) is not None:
            continue
        # Skip stray amount tokens
        if _AMOUNT_PAT.match(tok.replace(",", "")):
            continue
        # Skip page-header noise
        if _PAGE_NOISE.search(tok):
            continue
        clean.append(tok)
    return " ".join(clean).strip()


def _parse_transaction_line(
    line: str,
    prev_balance,
    current_date: datetime.date | None,
    fallback_year: int,
    period,
) -> dict | None:
    """
    Try to extract a transaction from a single text line.
    Returns a dict with date/description/debit/credit/balance, or None.
    """
    tokens = line.split()
    if len(tokens) < 3:
        return None

    # --- Find date ---
    date_obj, desc_start = _date_from_tokens(tokens, fallback_year, period)
    if date_obj is None:
        if current_date:
            date_obj = current_date
            desc_start = 0
        else:
            return None

    # --- Find amounts ---
    amounts = _amounts_in_line(line)
    if len(amounts) < 2:
        return None

    # Last amount = running balance, second-to-last = transaction amount
    bal_idx, bal_value, bal_marker = amounts[-1]
    amt_idx, amt_value, amt_marker = amounts[-2]

    balance = _signed(bal_value, bal_marker)

    # Use CR/DR marker if present on the amount token
    if amt_marker == "CR":
        debit, credit = 0.0, amt_value
    elif amt_marker == "DR":
        debit, credit = amt_value, 0.0
    else:
        debit, credit = _split_debit_credit(amt_value, prev_balance, balance)

    # --- Build description ---
    desc_tokens = tokens[desc_start:amt_idx]
    while desc_tokens and not any(c.isalnum() for c in desc_tokens[0]):
        desc_tokens = desc_tokens[1:]
    description = _clean_description(desc_tokens, fallback_year)
    if not description:
        # Fallback: use middle portion of line
        description = " ".join(tokens[desc_start:amt_idx]).strip() or line.strip()

    return {
        "date": pd.Timestamp(date_obj),
        "description": description,
        "debit": round(debit, 2),
        "credit": round(credit, 2),
        "balance": round(balance, 2),
    }


# ---------------------------------------------------------------------------
# Continuation line support
# ---------------------------------------------------------------------------

def _is_continuation(line: str) -> bool:
    """
    A continuation line has no date and no amounts — pure description text.
    Appended to the previous transaction's description.
    """
    tokens = line.split()
    if not tokens or len(tokens) > 10:
        return False
    has_date = _date_from_tokens(tokens, datetime.date.today().year)[0] is not None
    has_amount = bool(_amounts_in_line(line))
    return not has_date and not has_amount


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def parse_transactions(text: str) -> pd.DataFrame:
    """
    Parse all transactions from extracted PDF text.
    Returns a DataFrame: date, description, debit, credit, balance.

    Guarantees:
    - No OCR-corrupted date rows
    - No duplicate (date, balance) rows
    - No page header / footer rows
    - Correct debit/credit split using running balance
    """
    rows = []
    prev_balance = None
    current_date = None
    fallback_year = _statement_year(text)
    period = _statement_period(text)

    # Track seen (date, balance) pairs to deduplicate
    # SBI has Post Date + Value Date columns → same txn appears twice in OCR text
    seen_keys: set = set()

    for raw_line in text.splitlines():
        line = " ".join(raw_line.split())
        if not line:
            continue

        # Skip footer / summary / page-number lines
        if _should_skip_line(line):
            continue

        # Skip table header rows
        if _is_header_line(line):
            continue

        # Capture opening / closing balance (don't parse as transaction)
        if _is_balance_line(line):
            val = _extract_balance_value(line)
            if val is not None:
                prev_balance = val
            continue

        # Update carry-forward date
        tokens = line.split()
        date_candidate, _ = _date_from_tokens(tokens, fallback_year, period)
        if date_candidate:
            current_date = date_candidate

        # Try to parse as a transaction
        txn = _parse_transaction_line(line, prev_balance, current_date, fallback_year, period)

        if txn:
            # Deduplicate: same date + same amounts = duplicate row
            # Use (date, debit, credit, balance) as key
            key = (txn["date"], round(txn["debit"], 2), round(txn["credit"], 2), round(txn["balance"], 2))
            if key in seen_keys:
                continue
            seen_keys.add(key)

            prev_balance = txn["balance"]
            rows.append(txn)
            continue

        # Continuation line — append to last transaction's description
        if rows and _is_continuation(line):
            rows[-1]["description"] = (rows[-1]["description"] + " " + line).strip()

    if not rows:
        return pd.DataFrame(columns=["date", "description", "debit", "credit", "balance"])

    df = pd.DataFrame(rows)[["date", "description", "debit", "credit", "balance"]]
    df = df.sort_values("date").reset_index(drop=True)
    return df
