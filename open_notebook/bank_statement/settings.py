"""
Bank Statement Runtime Settings.

ALL configuration values live here as defaults.
Values are loaded from the database (bank_statement_config table) at runtime.
DB values override these defaults — no static config.py needed.

Usage (async):
    from open_notebook.bank_statement.settings import get_setting, get_all_settings
    threshold = await get_setting("high_value_threshold")
    all_cfg   = await get_all_settings()

Usage (sync, inside pipeline):
    from open_notebook.bank_statement.settings import get_defaults
    cfg = get_defaults()   # pure defaults, no DB call
"""

from typing import Any

from loguru import logger


# ---------------------------------------------------------------------------
# All defaults defined here — single source of truth
# ---------------------------------------------------------------------------

_DEFAULTS: dict[str, dict] = {

    # ── Column names ────────────────────────────────────────────────────────
    "col_date":         {"default": "date",         "description": "Date column name"},
    "col_description":  {"default": "description",  "description": "Description column name"},
    "col_debit":        {"default": "debit",         "description": "Debit column name"},
    "col_credit":       {"default": "credit",        "description": "Credit column name"},
    "col_balance":      {"default": "balance",       "description": "Balance column name"},
    "col_month":        {"default": "month",         "description": "Month column name"},
    "col_amount":       {"default": "amount",        "description": "Amount column name"},
    "col_category":     {"default": "category",      "description": "Category column name"},
    "col_type":         {"default": "type",          "description": "Type column name"},
    "col_nlp_keywords": {"default": "nlp_keywords",  "description": "NLP keywords column name"},
    "col_nlp_cluster":  {"default": "nlp_cluster",   "description": "NLP cluster column name"},

    # ── Display columns (transaction table) ─────────────────────────────────
    "display_columns": {
        "default": ["date", "description", "debit", "credit", "balance", "nlp_keywords", "type"],
        "description": "Columns shown in the transaction table",
    },

    # ── Numeric columns ──────────────────────────────────────────────────────
    "numeric_columns": {
        "default": ["debit", "credit", "balance"],
        "description": "Columns converted to float during cleaning",
    },

    # ── Reports ──────────────────────────────────────────────────────────────
    "high_value_threshold": {
        "default": 5000,
        "description": "Transactions above this amount are flagged as high-value",
    },
    "atm_top_n": {
        "default": 10,
        "description": "Number of top ATM transactions to show in report",
    },
    "date_format": {
        "default": "%d-%m-%Y",
        "description": "Date display format (strftime)",
    },
    "month_format": {
        "default": "%b %Y",
        "description": "Month display format (strftime)",
    },

    # ── Extraction ───────────────────────────────────────────────────────────
    "pdfplumber_timeout_seconds": {
        "default": 20,
        "description": "Timeout in seconds for pdfplumber extraction",
    },
    "easyocr_timeout_per_page_seconds": {
        "default": 60,
        "description": "Timeout in seconds per page for EasyOCR",
    },
    "ocr_dpi": {
        "default": 200,
        "description": "DPI for OCR rasterization",
    },
    "easyocr_dpi": {
        "default": 300,
        "description": "DPI for EasyOCR rasterization",
    },
    "min_text_length": {
        "default": 100,
        "description": "Minimum chars from extraction before trying next method",
    },

    # ── Parsing ──────────────────────────────────────────────────────────────
    "year_range_min": {
        "default": 1990,
        "description": "Minimum valid year for date parsing",
    },
    "year_range_max_offset": {
        "default": 1,
        "description": "Current year + this value = max valid year",
    },
    "max_decimal_places": {
        "default": 2,
        "description": "Maximum decimal places for amount parsing",
    },
    "continuation_line_max_tokens": {
        "default": 10,
        "description": "Max tokens in a continuation description line",
    },
    "multiline_min_date_only_lines": {
        "default": 3,
        "description": "Min date-only lines to trigger multi-line transaction joining",
    },
    "header_scan_lines": {
        "default": 25,
        "description": "Number of header lines to scan for metadata",
    },

    # ── Classification ───────────────────────────────────────────────────────
    "cluster_min": {
        "default": 2,
        "description": "Minimum number of NLP clusters",
    },
    "cluster_max": {
        "default": 6,
        "description": "Maximum number of NLP clusters",
    },
    "cluster_formula_divisor": {
        "default": 8,
        "description": "Divisor for cluster count: min(max, max(min, rows // divisor))",
    },
    "tfidf_max_features": {
        "default": 300,
        "description": "Maximum TF-IDF features",
    },
    "tfidf_ngram_range": {
        "default": [1, 2],
        "description": "TF-IDF n-gram range [min, max]",
    },
    "tfidf_min_df": {
        "default": 1,
        "description": "TF-IDF minimum document frequency",
    },
    "kmeans_random_state": {
        "default": 42,
        "description": "KMeans random state for reproducibility",
    },
    "kmeans_n_init": {
        "default": 10,
        "description": "KMeans number of initializations",
    },
    "top_keywords_per_cluster": {
        "default": 3,
        "description": "Number of top keywords per NLP cluster",
    },
    "min_keyword_length": {
        "default": 4,
        "description": "Minimum character length for NLP keywords",
    },

    # ── Transaction category rules ───────────────────────────────────────────
    "category_rules": {
        "default": [
            ["ATM Withdrawal",  [r"\batm\b", r"\bwdl\b", r"\bcash wdl\b"]],
            ["Cash Deposit",    [r"\bcash deposit\b", r"\bdeposit cash\b", r"\bdeposit self\b",
                                 r"\bcash dep\b", r"\bdep tfr\b"]],
            ["Interest Credit", [r"\binterest credit\b", r"\bint cr\b", r"\binterest\b"]],
            ["Bank Charges",    [r"\binter brch fee\b", r"\bbrch fee\b", r"\bannual fee\b",
                                 r"\batm fee\b", r"\batm replace\b", r"\bservice charge\b",
                                 r"\bsms charge\b", r"\bexcess dr\b"]],
            ["Fund Transfer",   [r"\bneft\b", r"\brtgs\b", r"\bimps\b", r"\btransfer\b",
                                 r"\bwdl tfr\b", r"\btfr\b"]],
            ["UPI Payment",     [r"\bupi\b", r"\bphonepe\b", r"\bgpay\b", r"\bpaytm\b",
                                 r"\bbhim\b"]],
            ["Debit Entry",     [r"\bdebit\b", r"\bentry dt\b"]],
            ["EMI / Loan",      [r"\bemi\b", r"\bloan\b", r"\brepayment\b"]],
            ["Salary",          [r"\bsalary\b", r"\bsal cr\b", r"\bpayroll\b"]],
            ["Cheque",          [r"\bcheque\b", r"\bchq\b"]],
        ],
        "description": "Transaction category rules: [[name, [regex_patterns]], ...]",
    },

    # ── NLP noise / priority words ───────────────────────────────────────────
    "nlp_noise_words": {
        "default": [
            "at", "in", "of", "to", "by", "on", "or", "an", "is", "it", "the",
            "and", "for", "from", "through", "via", "with",
            "gi", "gj", "dl", "bh", "mh", "br", "bri", "mhri", "bihi",
            "self", "odhav", "gidc", "sbin", "sbij", "sbbj",
            "mil", "sugar", "vishnu", "gopalganj", "siwan", "mirganj",
            "babunia", "more", "siw", "colony", "amar", "delhi", "patna",
            "ahmedabad", "hdfc", "icici", "aws", "esta",
            "no", "dt", "ref", "loc", "ko", "fi", "off", "ltd", "pvt",
            "inter", "brch", "cash", "credit", "debit",
        ],
        "description": "Words excluded from NLP keyword extraction",
    },
    "nlp_priority_keywords": {
        "default": [
            "neft", "rtgs", "imps", "upi", "phonepe", "gpay", "paytm",
            "salary", "interest", "emi", "loan", "cheque", "transfer",
            "deposit", "withdrawal", "annual", "charge", "fee",
        ],
        "description": "Keywords always surfaced in NLP extraction if present",
    },

    # ── Parser constants ─────────────────────────────────────────────────────
    "months_map": {
        "default": {
            "jan": 1, "january": 1, "feb": 2, "february": 2,
            "mar": 3, "march": 3, "apr": 4, "april": 4, "may": 5,
            "jun": 6, "june": 6, "jul": 7, "july": 7,
            "aug": 8, "august": 8, "sep": 9, "sept": 9, "september": 9,
            "oct": 10, "october": 10, "nov": 11, "november": 11,
            "dec": 12, "december": 12,
        },
        "description": "Month name to number mapping",
    },
    "header_words": {
        "default": [
            "date", "transaction", "details", "narration", "description",
            "particulars", "amount", "balance", "debit", "credit",
            "withdrawal", "deposit", "payment", "method",
            "chq", "cheque", "ref", "value", "post", "remarks", "no/reference",
        ],
        "description": "Words indicating a table header row (skip these lines)",
    },
    "balance_label_words": {
        "default": ["opening", "closing", "brought", "forward", "carried",
                    "b/f", "c/f", "b/d", "c/d"],
        "description": "Words indicating opening/closing balance lines",
    },
    "skip_line_patterns": {
        "default": [
            r"page\s+no", r"page\s+\d+\s+of\s+\d+", r"end\s+of\s+statement",
            r"statement\s+summary", r"brought\s+forward", r"closing\s+balance",
            r"total\s+debit", r"total\s+credit", r"last\s+transaction",
            r"in\s+case\s+your\s+account", r"dr\s+count", r"cr\s+count",
            r"issued\s+by\s+federal", r"contact\s+us\s+\d",
        ],
        "description": "Regex patterns for footer/summary lines to skip",
    },

    # ── Metadata parsing ─────────────────────────────────────────────────────
    "table_words": {
        "default": [
            "value", "post", "date", "description", "debit", "credit",
            "balance", "transaction", "transactions", "details", "amount",
            "payment", "method", "opening", "spent", "saved",
        ],
        "description": "Words indicating the transaction table has started",
    },
    "separators": {
        "default": [":", " - ", " — ", " _ ", " = "],
        "description": "Field separators used in bank statement headers",
    },

    # ── Bank detection ───────────────────────────────────────────────────────
    "known_banks": {
        "default": [
            "FEDERAL BANK", "STATE BANK OF INDIA", "SBI", "HDFC BANK",
            "ICICI BANK", "AXIS BANK", "KOTAK BANK", "CANARA BANK",
            "PUNJAB NATIONAL BANK", "BANK OF BARODA", "UNION BANK",
            "BANK OF INDIA", "CENTRAL BANK", "INDIAN BANK", "UCO BANK",
            "YES BANK", "INDUSIND BANK", "RBL BANK", "IDFC BANK",
        ],
        "description": "Known bank names for header detection",
    },
    "account_holder_skip_words": {
        "default": [
            "BANK", "STATEMENT", "ACCOUNT", "BRANCH", "INDIA", "LIMITED",
            "REGULAR", "SAVINGS", "CURRENT", "PAN", "DETAILS", "SUMMARY",
            "REPORT", "PERIOD", "DATE", "NEAR", "OPP", "NAGAR", "COLONY",
            "ROAD", "STREET", "AHMEDABAD", "MUMBAI", "DELHI", "GIDC",
            "GRUH", "BHIKSHUK", "GUJRAT", "GUJARAT", "ODHAV", "INDUSTRIAL",
            "ESTATE", "AREA", "ZONE", "SECTOR", "PHASE", "PLOT",
            "FEDERAL", "SBI", "HDFC", "ICICI", "AXIS", "KOTAK", "CANARA",
        ],
        "description": "Words to skip when detecting account holder name",
    },
    "account_holder_detection": {
        "default": {
            "all_upper_min_words": 2, "all_upper_max_words": 5,
            "all_upper_min_chars": 8, "all_upper_max_chars": 50,
            "title_case_min_words": 2, "title_case_max_words": 4,
            "title_case_min_chars": 5, "title_case_max_chars": 40,
        },
        "description": "Bounds for account holder name detection",
    },

    # ── OCR cleaning ─────────────────────────────────────────────────────────
    "ocr_split_patterns": {
        "default": [
            [r"\s+(UPI(?:OUT|IN)?[/ ])", r"\n\1"],
            [r"\s+(NEFT[/ ])",           r"\n\1"],
            [r"\s+(IMPS[/ ])",           r"\n\1"],
            [r"\s+(RTGS[/ ])",           r"\n\1"],
            [r"\s+(SBINT[: ])",          r"\n\1"],
        ],
        "description": "Regex patterns for splitting OCR output on transaction keywords",
    },

    # ── Charge detection ─────────────────────────────────────────────────────
    "charge_keywords": {
        "default": [
            "INTER BRCH FEE", "BRCH FEE", "ANNUAL FEE", "ATM FEE",
            "ATM REPLACE", "SERVICE CHARGE", "SMS CHARGE", "EXCESS DR",
            "ATM ANNUAL", "REPLACE CHARGE", "INTER BRANCH",
        ],
        "description": "Keywords that identify bank charge transactions",
    },
    "charge_type_map": {
        "default": [
            [["ANNUAL", "ATM FEE", "REPLACE"],           "ATM / Annual Fee"],
            [["INTER BRCH", "BRCH FEE", "INTER BRANCH"], "Inter-Branch Fee"],
            [["EXCESS"],                                  "Excess Charges"],
            [["SERVICE"],                                 "Service Charge"],
            [["SMS"],                                     "SMS Charges"],
        ],
        "description": "Mapping from description keywords to charge category names",
    },
    "charge_type_default": {
        "default": "Other Charges",
        "description": "Default charge category when no keyword matches",
    },

    # ── Interest detection ───────────────────────────────────────────────────
    "interest_keywords": {
        "default": ["INTEREST", "INT CR", "INT CREDIT"],
        "description": "Keywords that identify interest credit transactions",
    },

    # ── ATM category name ────────────────────────────────────────────────────
    "atm_category_name": {
        "default": "ATM Withdrawal",
        "description": "Category name used for ATM withdrawal transactions",
    },

    # ── Page noise pattern ───────────────────────────────────────────────────
    "page_noise_pattern": {
        "default": (
            r"page\s*no|value\s*date|cheque|no/ref|heque|post\s*date"
            r"|issued\s+by|contact\s+us|account\s+no\.|account\s+holder"
            r"|day/night|payment\s+method|transaction\s+details"
        ),
        "description": "Regex pattern for page noise in transaction descriptions",
    },
}


# ---------------------------------------------------------------------------
# Sync helper — returns pure defaults (no DB call)
# ---------------------------------------------------------------------------

def get_defaults() -> dict[str, Any]:
    """Return all default values as a flat dict. No DB call."""
    return {k: v["default"] for k, v in _DEFAULTS.items()}


def get_schema() -> dict:
    """Return full schema with keys, defaults, and descriptions."""
    return {k: {"default": v["default"], "description": v["description"]}
            for k, v in _DEFAULTS.items()}


# ---------------------------------------------------------------------------
# Async DB access
# ---------------------------------------------------------------------------

async def get_setting(key: str) -> Any:
    """Get a single config value from DB, falling back to default."""
    if key not in _DEFAULTS:
        raise KeyError(f"Unknown bank_statement config key: '{key}'")
    try:
        from open_notebook.database.repository import repo_query
        result = await repo_query(
            "SELECT config_value FROM bank_statement_config WHERE config_key = $key LIMIT 1",
            {"key": key},
        )
        if result and len(result) > 0 and "config_value" in result[0]:
            return result[0]["config_value"]
    except Exception as e:
        logger.debug(f"[BankConfig] DB read failed for '{key}': {e} — using default")
    return _DEFAULTS[key]["default"]


async def get_all_settings() -> dict[str, Any]:
    """Get all config values, merging DB overrides with defaults."""
    settings = get_defaults()
    try:
        from open_notebook.database.repository import repo_query
        rows = await repo_query("SELECT config_key, config_value FROM bank_statement_config")
        for row in (rows or []):
            key = row.get("config_key")
            if key in settings:
                settings[key] = row["config_value"]
    except Exception as e:
        logger.debug(f"[BankConfig] DB read failed: {e} — using all defaults")
    return settings


async def set_setting(key: str, value: Any) -> None:
    """Save a config value to DB (upsert)."""
    if key not in _DEFAULTS:
        raise KeyError(f"Unknown bank_statement config key: '{key}'")
    from open_notebook.database.repository import repo_query
    await repo_query(
        """
        UPSERT bank_statement_config
        SET config_key = $key,
            config_value = $value,
            description = $desc,
            updated = time::now()
        WHERE config_key = $key
        """,
        {"key": key, "value": value, "desc": _DEFAULTS[key]["description"]},
    )
    logger.info(f"[BankConfig] Saved '{key}' to DB")


async def reset_setting(key: str) -> None:
    """Delete a DB override — reverts to default."""
    from open_notebook.database.repository import repo_query
    await repo_query(
        "DELETE bank_statement_config WHERE config_key = $key",
        {"key": key},
    )
    logger.info(f"[BankConfig] Reset '{key}' to default")
