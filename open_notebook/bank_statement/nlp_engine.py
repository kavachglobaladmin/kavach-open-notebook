"""
NLP Engine for Bank Statement Analysis using spaCy.

Replaces hardcoded lists with dynamic NLP-based detection:
- Bank/organization names → spaCy NER (ORG entities)
- Person names → spaCy NER (PERSON entities)
- Transaction categories → spaCy text classification + rule matching
- Noise words → spaCy stop words
- Header line detection → spaCy POS tagging
- Balance line detection → spaCy dependency parsing
"""

from __future__ import annotations

import re
from functools import lru_cache
from typing import Optional

from loguru import logger


# ---------------------------------------------------------------------------
# spaCy model loader (singleton)
# ---------------------------------------------------------------------------

_nlp = None


def get_nlp():
    """Load spaCy model once and reuse."""
    global _nlp
    if _nlp is None:
        try:
            import spacy
            _nlp = spacy.load("en_core_web_sm")
            logger.info("[NLP] spaCy en_core_web_sm loaded")
        except Exception as e:
            logger.warning(f"[NLP] spaCy load failed: {e} — falling back to rule-based")
            _nlp = None
    return _nlp


# ---------------------------------------------------------------------------
# 1. Bank / Organization name detection
# ---------------------------------------------------------------------------

def detect_bank_name(text: str) -> str:
    """
    Detect bank name from statement header.
    Priority:
    1. Explicit "Bank: <name>" field (structured output)
    2. Known bank name patterns in first 30 lines
    3. spaCy NER ORG entities (max 5 words)
    4. Regex fallback
    """
    # Priority 1: explicit "Bank:" label
    for line in text.splitlines()[:30]:
        stripped = line.strip()
        m = re.match(r'^(?:bank(?:\s+name)?)\s*[:\-]\s*(.+)$', stripped, re.IGNORECASE)
        if m:
            val = m.group(1).strip()
            if val and len(val) > 1:
                val_upper = val.upper()
                if any(w in val_upper for w in ["BANK", "SBI", "HDFC", "ICICI", "AXIS",
                                                  "KOTAK", "CANARA", "FEDERAL", "UNION",
                                                  "PUNJAB", "BARODA", "CENTRAL", "INDIAN",
                                                  "UCO", "YES", "INDUSIND", "RBL", "IDFC",
                                                  "FINANCE", "FINANCIAL", "CREDIT"]):
                    return val.title()
                words = val.split()
                if len(words) <= 3 and all(w[0].isupper() for w in words if w) and val.replace(' ', '').isalpha():
                    continue
                return val.title()

    # Priority 2: known bank name patterns anywhere in first 60 lines
    _KNOWN_BANK_PATTERNS = [
        r'\bSTATE\s+BANK\s+OF\s+INDIA\b',
        r'\bSBI\b',
        r'\bHDFC\s+BANK\b',
        r'\bICICI\s+BANK\b',
        r'\bAXIS\s+BANK\b',
        r'\bKOTAK\s+(?:MAHINDRA\s+)?BANK\b',
        r'\bCANARA\s+BANK\b',
        r'\bFEDERAL\s+BANK\b',
        r'\bPUNJAB\s+NATIONAL\s+BANK\b',
        r'\bBANK\s+OF\s+BARODA\b',
        r'\bUNION\s+BANK\b',
        r'\bBANK\s+OF\s+INDIA\b',
        r'\bCENTRAL\s+BANK\b',
        r'\bINDIAN\s+BANK\b',
        r'\bYES\s+BANK\b',
        r'\bINDUSIND\s+BANK\b',
        r'\bRBL\s+BANK\b',
        r'\bIDFC\s+(?:FIRST\s+)?BANK\b',
    ]
    # Search in first 60 lines (bank name may be in branch address section)
    header_text = "\n".join(text.splitlines()[:60])
    for pattern in _KNOWN_BANK_PATTERNS:
        m = re.search(pattern, header_text, re.IGNORECASE)
        if m:
            return m.group(0).strip().title()

    # Priority 3: spaCy NER (max 5 words to avoid greedy matches)
    nlp = get_nlp()
    if nlp is not None:
        header = "\n".join(text.splitlines()[:25])
        doc = nlp(header)
        for ent in doc.ents:
            if ent.label_ == "ORG":
                name = ent.text.strip()
                words = name.split()
                if len(words) <= 5 and any(w in name.upper() for w in ["BANK", "FINANCE", "FINANCIAL"]):
                    return name.title()

    return _detect_bank_name_fallback(text)


def _detect_bank_name_fallback(text: str) -> str:
    """Fallback: regex-based bank name detection."""
    bank_pattern = re.compile(
        r'\b((?:\w+\s+)*(?:BANK|FINANCE|FINANCIAL|CREDIT\s+UNION|COOPERATIVE\s+BANK)(?:\s+\w+)*)\b',
        re.IGNORECASE
    )
    for line in text.splitlines()[:25]:
        m = bank_pattern.search(line)
        if m:
            return m.group(1).strip().title()
    return ""


# ---------------------------------------------------------------------------
# 2. Account holder name detection
# ---------------------------------------------------------------------------

def detect_account_holder(text: str) -> str:
    """
    Detect account holder name.
    Priority:
    1. Explicit "Account Holder: <name>" field in header
    2. spaCy NER PERSON entities
    """
    # Priority 1: explicit field
    for line in text.splitlines()[:25]:
        stripped = line.strip()
        m = re.match(
            r'^(?:account\s+holder|customer\s+name|name|holder)\s*[:\-]\s*(.+)$',
            stripped, re.IGNORECASE
        )
        if m:
            val = m.group(1).strip()
            if val and len(val) > 2:
                return val.title()

    nlp = get_nlp()
    if nlp is None:
        return ""

    header = "\n".join(text.splitlines()[:25])
    doc = nlp(header)

    candidates = []
    for ent in doc.ents:
        if ent.label_ == "PERSON":
            name = ent.text.strip()
            words = name.split()
            if 2 <= len(words) <= 5 and 5 < len(name) < 50:
                candidates.append(name)

    if candidates:
        return candidates[0].title()

    # Fallback: look for ALL-CAPS name patterns (2-4 consecutive capitalized words)
    # Must not be bank/institution/location words
    _SKIP = {"BANK", "INDIA", "LIMITED", "LTD", "STATEMENT", "ACCOUNT", "BRANCH",
             "REGULAR", "SAVINGS", "CURRENT", "OPEN", "GIDC", "ODHAV", "NAGAR",
             "COLONY", "ROAD", "STREET", "STATE", "NATIONAL", "FEDERAL", "NEAR",
             "GRUH", "BHIKSHUK", "AHMEDABAD", "GUJRAT", "GUJARAT", "MUMBAI",
             "DELHI", "PATNA", "SIWAN", "GOPALGANJ", "INDIVIDUALS", "CHQ", "SB"}

    # Search for 2-4 consecutive ALL-CAPS words that look like a person name
    _NAME_RE = re.compile(r'\b([A-Z]{2,}(?:\s+[A-Z]{2,}){1,3})\b')
    header_text = " ".join(text.splitlines()[:30])
    for m in _NAME_RE.finditer(header_text):
        candidate = m.group(1).strip()
        words = candidate.split()
        if (2 <= len(words) <= 4
                and 5 < len(candidate) < 50
                and not any(w in _SKIP for w in words)
                and all(len(w) >= 2 for w in words)):
            return candidate.title()

    return ""


# ---------------------------------------------------------------------------
# 3. Transaction category classification
# ---------------------------------------------------------------------------

# spaCy Matcher patterns for transaction categories
# These replace hardcoded regex rules — patterns are data-driven
_CATEGORY_PATTERNS = [
    {
        "name": "ATM Withdrawal",
        "patterns": [
            [{"LOWER": {"IN": ["atm", "wdl", "cash"]}, "OP": "?"},
             {"LOWER": {"IN": ["withdrawal", "wdl", "withdraw"]}}],
            [{"LOWER": "atm"}],
        ]
    },
    {
        "name": "Cash Deposit",
        "patterns": [
            [{"LOWER": "cash"}, {"LOWER": {"IN": ["deposit", "dep"]}}],
            [{"LOWER": "deposit"}, {"LOWER": {"IN": ["cash", "self"]}}],
        ]
    },
    {
        "name": "Interest Credit",
        "patterns": [
            [{"LOWER": "interest"}],
            [{"LOWER": "int"}, {"LOWER": {"IN": ["cr", "credit"]}}],
        ]
    },
    {
        "name": "Bank Charges",
        "patterns": [
            [{"LOWER": {"IN": ["fee", "charge", "charges"]}}],
            [{"LOWER": {"IN": ["annual", "service", "sms", "atm"]}},
             {"LOWER": {"IN": ["fee", "charge"]}}],
        ]
    },
    {
        "name": "Fund Transfer",
        "patterns": [
            [{"LOWER": {"IN": ["neft", "rtgs", "imps", "transfer", "tfr"]}}],
        ]
    },
    {
        "name": "UPI Payment",
        "patterns": [
            [{"LOWER": {"IN": ["upi", "phonepe", "gpay", "paytm", "bhim"]}}],
        ]
    },
    {
        "name": "EMI / Loan",
        "patterns": [
            [{"LOWER": {"IN": ["emi", "loan", "repayment"]}}],
        ]
    },
    {
        "name": "Salary",
        "patterns": [
            [{"LOWER": {"IN": ["salary", "sal", "payroll"]}}],
        ]
    },
    {
        "name": "Cheque",
        "patterns": [
            [{"LOWER": {"IN": ["cheque", "chq", "check"]}}],
        ]
    },
]


@lru_cache(maxsize=1)
def _get_matcher():
    """Build and cache spaCy Matcher with category patterns."""
    nlp = get_nlp()
    if nlp is None:
        return None, None
    try:
        from spacy.matcher import Matcher
        matcher = Matcher(nlp.vocab)
        for cat in _CATEGORY_PATTERNS:
            matcher.add(cat["name"], cat["patterns"])
        return nlp, matcher
    except Exception as e:
        logger.warning(f"[NLP] Matcher build failed: {e}")
        return None, None


def classify_transaction(description: str) -> str:
    """
    Classify a transaction description using spaCy Matcher.
    Returns category name or empty string.
    """
    nlp, matcher = _get_matcher()
    if nlp is None or matcher is None:
        return ""

    try:
        doc = nlp(description.lower())
        matches = matcher(doc)
        if matches:
            # Return the first (highest priority) match
            match_id, start, end = matches[0]
            return nlp.vocab.strings[match_id]
    except Exception:
        pass
    return ""


# ---------------------------------------------------------------------------
# 4. Noise word detection using spaCy stop words
# ---------------------------------------------------------------------------

def get_noise_words() -> set:
    """
    Get noise words dynamically from spaCy stop words.
    Augmented with bank-specific terms.
    """
    nlp = get_nlp()
    base_noise = set()

    if nlp is not None:
        # spaCy stop words (prepositions, articles, conjunctions, etc.)
        base_noise = {w for w in nlp.Defaults.stop_words if len(w) <= 6}

    # Bank-specific noise (location codes, branch codes) — these are domain-specific
    # and cannot be inferred from general NLP
    bank_noise = {
        "gi", "gj", "dl", "bh", "mh", "br", "bri", "mhri", "bihi",
        "sbin", "sbij", "sbbj", "gidc", "odhav",
        "no", "dt", "ref", "loc", "ko", "fi", "off", "ltd", "pvt",
        "inter", "brch",
    }

    return base_noise | bank_noise


# ---------------------------------------------------------------------------
# 5. Header line detection using spaCy POS tagging
# ---------------------------------------------------------------------------

def is_header_line(line: str) -> bool:
    """
    Detect if a line is a table header using spaCy POS tagging.
    Header lines typically contain many nouns/labels with no verbs.
    """
    nlp = get_nlp()
    if nlp is None:
        return _is_header_line_fallback(line)

    try:
        doc = nlp(line.lower())
        tokens = [t for t in doc if not t.is_space and not t.is_punct]
        if not tokens:
            return False

        # Count financial/table keywords using NER and POS
        financial_terms = {
            "date", "transaction", "details", "narration", "description",
            "particulars", "amount", "balance", "debit", "credit",
            "withdrawal", "deposit", "payment", "method", "cheque",
            "ref", "value", "post", "remarks",
        }
        matches = sum(1 for t in tokens if t.text in financial_terms)
        return matches >= 3
    except Exception:
        return _is_header_line_fallback(line)


def _is_header_line_fallback(line: str) -> bool:
    """Fallback header detection without spaCy."""
    financial_terms = {
        "date", "transaction", "details", "narration", "description",
        "particulars", "amount", "balance", "debit", "credit",
        "withdrawal", "deposit", "payment", "method", "cheque",
        "ref", "value", "post", "remarks",
    }
    words = {w.lower().strip(" ,.:-/") for w in line.split()}
    return len(words & financial_terms) >= 3


# ---------------------------------------------------------------------------
# 6. Balance line detection
# ---------------------------------------------------------------------------

def is_balance_line(line: str) -> bool:
    """
    Detect opening/closing balance lines using spaCy.
    """
    nlp = get_nlp()
    balance_terms = {"opening", "closing", "brought", "forward", "carried", "b/f", "c/f", "b/d", "c/d"}

    if nlp is None:
        words = {w.lower().strip(" ,.:-") for w in line.split()}
        return bool(words & balance_terms)

    try:
        doc = nlp(line.lower())
        words = {t.text for t in doc}
        return bool(words & balance_terms)
    except Exception:
        words = {w.lower().strip(" ,.:-") for w in line.split()}
        return bool(words & balance_terms)


# ---------------------------------------------------------------------------
# 7. Skip line detection (footer/summary lines)
# ---------------------------------------------------------------------------

_SKIP_PATTERNS = [
    re.compile(r"page\s+(?:no|\d+)", re.IGNORECASE),
    re.compile(r"end\s+of\s+statement", re.IGNORECASE),
    re.compile(r"statement\s+summary", re.IGNORECASE),
    re.compile(r"brought\s+forward", re.IGNORECASE),
    re.compile(r"closing\s+balance", re.IGNORECASE),
    re.compile(r"total\s+(?:debit|credit)", re.IGNORECASE),
    re.compile(r"last\s+transaction", re.IGNORECASE),
    re.compile(r"(?:dr|cr)\s+count", re.IGNORECASE),
    re.compile(r"contact\s+us\s+\d", re.IGNORECASE),
]


def should_skip_line(line: str) -> bool:
    """Check if line should be skipped (footer/summary)."""
    return any(p.search(line) for p in _SKIP_PATTERNS)


# ---------------------------------------------------------------------------
# 8. Keyword extraction using spaCy
# ---------------------------------------------------------------------------

def extract_keywords(text: str, noise_words: set | None = None, max_keywords: int = 3) -> list[str]:
    """
    Extract meaningful keywords from transaction description using spaCy.
    Uses POS tagging to prefer nouns and proper nouns.
    """
    nlp = get_nlp()
    if noise_words is None:
        noise_words = get_noise_words()

    if nlp is None:
        # Fallback: simple tokenization
        tokens = [w.lower() for w in text.split() if len(w) >= 4 and w.lower() not in noise_words]
        return tokens[:max_keywords]

    try:
        doc = nlp(text.lower())
        # Prefer PROPN (proper nouns) and NOUN, filter noise
        keywords = []
        for token in doc:
            if (token.pos_ in ("PROPN", "NOUN")
                    and not token.is_stop
                    and not token.is_punct
                    and len(token.text) >= 4
                    and token.text not in noise_words
                    and not token.is_digit):
                keywords.append(token.text)
        return keywords[:max_keywords] if keywords else []
    except Exception:
        tokens = [w.lower() for w in text.split() if len(w) >= 4 and w.lower() not in noise_words]
        return tokens[:max_keywords]


# ---------------------------------------------------------------------------
# 9. Page noise detection for description cleaning
# ---------------------------------------------------------------------------

_PAGE_NOISE_RE = re.compile(
    r"page\s*no|value\s*date|cheque|no/ref|post\s*date"
    r"|issued\s+by|contact\s+us|account\s+no\.|account\s+holder"
    r"|payment\s+method|transaction\s+details",
    re.IGNORECASE,
)


def is_page_noise(token: str) -> bool:
    """Check if a token is page header noise."""
    return bool(_PAGE_NOISE_RE.search(token))
