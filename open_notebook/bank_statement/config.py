"""
Bank Statement Pipeline Configuration.

Static defaults only — all business logic moved to nlp_engine.py (spaCy-based).
These values are used as fallbacks when spaCy is unavailable or for non-NLP settings.
"""

# ---------------------------------------------------------------------------
# Column names
# ---------------------------------------------------------------------------
COLUMNS = {
    "date":         "date",
    "description":  "description",
    "debit":        "debit",
    "credit":       "credit",
    "balance":      "balance",
    "month":        "month",
    "amount":       "amount",
    "category":     "category",
    "type":         "type",
    "nlp_keywords": "nlp_keywords",
    "nlp_cluster":  "nlp_cluster",
}

DISPLAY_COLUMNS = [
    COLUMNS["date"], COLUMNS["description"], COLUMNS["debit"],
    COLUMNS["credit"], COLUMNS["balance"], COLUMNS["nlp_keywords"], COLUMNS["type"],
]

NUMERIC_COLUMNS = [COLUMNS["debit"], COLUMNS["credit"], COLUMNS["balance"]]

# ---------------------------------------------------------------------------
# Extraction settings (non-NLP, kept as config)
# ---------------------------------------------------------------------------
EXTRACTION = {
    "pdfplumber_timeout_seconds": 20,
    "easyocr_timeout_per_page_seconds": 60,
    "ocr_dpi": 200,
    "easyocr_dpi": 300,
    "min_text_length": 100,
    "min_ocr_text_length": 50,
}

# ---------------------------------------------------------------------------
# Parsing settings (non-NLP, kept as config)
# ---------------------------------------------------------------------------
PARSING = {
    "year_range_min": 1990,
    "year_range_max_offset": 1,
    "max_decimal_places": 2,
    "continuation_line_max_tokens": 10,
    "multiline_min_date_only_lines": 3,
    "header_scan_lines": 25,
}

# ---------------------------------------------------------------------------
# Classification settings (non-NLP, kept as config)
# ---------------------------------------------------------------------------
CLASSIFICATION = {
    "cluster_min": 2,
    "cluster_max": 6,
    "cluster_formula_divisor": 8,
    "tfidf_max_features": 300,
    "tfidf_ngram_range": (1, 2),
    "tfidf_min_df": 1,
    "kmeans_random_state": 42,
    "kmeans_n_init": 10,
    "top_keywords_per_cluster": 3,
    "min_keyword_length": 4,
}

# ---------------------------------------------------------------------------
# Report settings (non-NLP, kept as config)
# ---------------------------------------------------------------------------
REPORTS = {
    "high_value_threshold": 5000,
    "atm_top_n": 10,
    "date_format": "%d-%m-%Y",
    "month_format": "%b %Y",
}

# ---------------------------------------------------------------------------
# Month name mapping (language constant, not business logic)
# ---------------------------------------------------------------------------
MONTHS = {
    "jan": 1, "january": 1, "feb": 2, "february": 2,
    "mar": 3, "march": 3, "apr": 4, "april": 4, "may": 5,
    "jun": 6, "june": 6, "jul": 7, "july": 7,
    "aug": 8, "august": 8, "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10, "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}

# ---------------------------------------------------------------------------
# The following are FALLBACK values used when spaCy NLP is unavailable.
# Primary detection is done by nlp_engine.py using spaCy NER/POS/Matcher.
# ---------------------------------------------------------------------------

# Fallback: transaction category rules (used if spaCy Matcher fails)
CATEGORY_RULES = [
    ("ATM Withdrawal",  [r"\batm\b", r"\bwdl\b", r"\bcash wdl\b"]),
    ("Cash Deposit",    [r"\bcash deposit\b", r"\bdeposit cash\b", r"\bdeposit self\b",
                         r"\bcash dep\b", r"\bdep tfr\b"]),
    ("Interest Credit", [r"\binterest credit\b", r"\bint cr\b", r"\binterest\b"]),
    ("Bank Charges",    [r"\binter brch fee\b", r"\bbrch fee\b", r"\bannual fee\b",
                         r"\batm fee\b", r"\batm replace\b", r"\bservice charge\b",
                         r"\bsms charge\b", r"\bexcess dr\b"]),
    ("Fund Transfer",   [r"\bneft\b", r"\brtgs\b", r"\bimps\b", r"\btransfer\b",
                         r"\bwdl tfr\b", r"\btfr\b"]),
    ("UPI Payment",     [r"\bupi\b", r"\bphonepe\b", r"\bgpay\b", r"\bpaytm\b", r"\bbhim\b"]),
    ("Debit Entry",     [r"\bdebit\b", r"\bentry dt\b"]),
    ("EMI / Loan",      [r"\bemi\b", r"\bloan\b", r"\brepayment\b"]),
    ("Salary",          [r"\bsalary\b", r"\bsal cr\b", r"\bpayroll\b"]),
    ("Cheque",          [r"\bcheque\b", r"\bchq\b"]),
]

# Fallback: noise words (spaCy stop words used when available)
NLP_NOISE_WORDS = {
    "at", "in", "of", "to", "by", "on", "or", "an", "is", "it", "the",
    "and", "for", "from", "through", "via", "with",
    "gi", "gj", "dl", "bh", "mh", "br", "bri", "mhri", "bihi",
    "self", "odhav", "gidc", "sbin", "sbij", "sbbj",
    "no", "dt", "ref", "loc", "ko", "fi", "off", "ltd", "pvt",
    "inter", "brch", "cash", "credit", "debit",
}

# Fallback: priority keywords
NLP_PRIORITY_KEYWORDS = {
    "neft", "rtgs", "imps", "upi", "phonepe", "gpay", "paytm",
    "salary", "interest", "emi", "loan", "cheque", "transfer",
    "deposit", "withdrawal", "annual", "charge", "fee",
}

# Fallback: header words (spaCy POS used when available)
HEADER_WORDS = {
    "date", "transaction", "details", "narration", "description",
    "particulars", "amount", "balance", "debit", "credit",
    "withdrawal", "deposit", "payment", "method",
    "chq", "cheque", "ref", "value", "post", "remarks", "no/reference",
}

# Fallback: balance label words
BALANCE_LABEL_WORDS = {
    "opening", "closing", "brought", "forward", "carried",
    "b/f", "c/f", "b/d", "c/d",
}

# Fallback: skip line patterns
SKIP_LINE_PATTERNS = [
    r"page\s+no", r"page\s+\d+\s+of\s+\d+", r"end\s+of\s+statement",
    r"statement\s+summary", r"brought\s+forward", r"closing\s+balance",
    r"total\s+debit", r"total\s+credit", r"last\s+transaction",
    r"in\s+case\s+your\s+account", r"dr\s+count", r"cr\s+count",
    r"issued\s+by\s+federal", r"contact\s+us\s+\d",
]

# Fallback: metadata separators
TABLE_WORDS = {
    "value", "post", "date", "description", "debit", "credit",
    "balance", "transaction", "transactions", "details", "amount",
    "payment", "method", "opening", "spent", "saved",
}
SEPARATORS = (":", " - ", " — ", " _ ", " = ")

# Fallback: bank names (spaCy NER used when available)
KNOWN_BANKS = [
    "FEDERAL BANK", "STATE BANK OF INDIA", "SBI", "HDFC BANK",
    "ICICI BANK", "AXIS BANK", "KOTAK BANK", "CANARA BANK",
    "PUNJAB NATIONAL BANK", "BANK OF BARODA", "UNION BANK",
    "BANK OF INDIA", "CENTRAL BANK", "INDIAN BANK", "UCO BANK",
    "YES BANK", "INDUSIND BANK", "RBL BANK", "IDFC BANK",
]

# Fallback: account holder skip words (spaCy NER used when available)
ACCOUNT_HOLDER_SKIP_WORDS = {
    "BANK", "STATEMENT", "ACCOUNT", "BRANCH", "INDIA", "LIMITED",
    "REGULAR", "SAVINGS", "CURRENT", "PAN", "DETAILS", "SUMMARY",
    "REPORT", "PERIOD", "DATE", "NEAR", "OPP", "NAGAR", "COLONY",
    "ROAD", "STREET", "AHMEDABAD", "MUMBAI", "DELHI", "GIDC",
    "FEDERAL", "SBI", "HDFC", "ICICI", "AXIS", "KOTAK", "CANARA",
}

# OCR split patterns (technical, not business logic)
OCR_SPLIT_PATTERNS = [
    (r"\s+(UPI(?:OUT|IN)?[/ ])", r"\n\1"),
    (r"\s+(NEFT[/ ])",           r"\n\1"),
    (r"\s+(IMPS[/ ])",           r"\n\1"),
    (r"\s+(RTGS[/ ])",           r"\n\1"),
    (r"\s+(SBINT[: ])",          r"\n\1"),
]

# Charge detection (fallback)
CHARGE_KEYWORDS = [
    "INTER BRCH FEE", "BRCH FEE", "ANNUAL FEE", "ATM FEE",
    "ATM REPLACE", "SERVICE CHARGE", "SMS CHARGE", "EXCESS DR",
    "ATM ANNUAL", "REPLACE CHARGE", "INTER BRANCH",
]
CHARGE_TYPE_MAP = [
    (["ANNUAL", "ATM FEE", "REPLACE"],           "ATM / Annual Fee"),
    (["INTER BRCH", "BRCH FEE", "INTER BRANCH"], "Inter-Branch Fee"),
    (["EXCESS"],                                  "Excess Charges"),
    (["SERVICE"],                                 "Service Charge"),
    (["SMS"],                                     "SMS Charges"),
]
CHARGE_TYPE_DEFAULT = "Other Charges"

INTEREST_KEYWORDS = ["INTEREST", "INT CR", "INT CREDIT"]
ATM_CATEGORY_NAME = "ATM Withdrawal"

ACCOUNT_HOLDER_DETECTION = {
    "all_upper_min_words": 2, "all_upper_max_words": 5,
    "all_upper_min_chars": 8, "all_upper_max_chars": 50,
    "title_case_min_words": 2, "title_case_max_words": 4,
    "title_case_min_chars": 5, "title_case_max_chars": 40,
}

PAGE_NOISE_PATTERN = (
    r"page\s*no|value\s*date|cheque|no/ref|heque|post\s*date"
    r"|issued\s+by|contact\s+us|account\s+no\.|account\s+holder"
    r"|day/night|payment\s+method|transaction\s+details"
)
