"""
Transaction classifier.

Step 1 — Rule-based: assigns a human-readable category based on keywords
         found in the transaction description.
Step 2 — NLP clustering: groups transactions using TF-IDF + KMeans.
         Keywords are filtered to remove noise (short words, location codes,
         branch codes, single letters, common filler words).
"""

import re

import pandas as pd
from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import TfidfVectorizer


# ---------------------------------------------------------------------------
# Rule-based category map  (priority order — first match wins)
# ---------------------------------------------------------------------------

_RULES = [
    ("ATM Withdrawal",  [r"\batm\b", r"\bwdl\b", r"\bcash wdl\b"]),
    ("Cash Deposit",    [r"\bcash deposit\b", r"\bdeposit cash\b", r"\bdeposit self\b",
                         r"\bcash dep\b", r"\bdep tfr\b"]),
    ("Interest Credit", [r"\binterest credit\b", r"\bint cr\b", r"\binterest\b"]),
    ("Bank Charges",    [r"\binter brch fee\b", r"\bbrch fee\b", r"\bannual fee\b",
                         r"\batm fee\b", r"\batm replace\b", r"\bservice charge\b",
                         r"\bsms charge\b", r"\bexcess dr\b"]),
    ("Fund Transfer",   [r"\bneft\b", r"\brtgs\b", r"\bimps\b", r"\btransfer\b",
                         r"\bwdl tfr\b", r"\btfr\b"]),
    ("UPI Payment",     [r"\bupi\b", r"\bphonepe\b", r"\bgpay\b", r"\bpaytm\b",
                         r"\bbhim\b"]),
    ("Debit Entry",     [r"\bdebit\b", r"\bentry dt\b"]),
    ("EMI / Loan",      [r"\bemi\b", r"\bloan\b", r"\brepayment\b"]),
    ("Salary",          [r"\bsalary\b", r"\bsal cr\b", r"\bpayroll\b"]),
    ("Cheque",          [r"\bcheque\b", r"\bchq\b"]),
]

_COMPILED_RULES = [
    (label, [re.compile(p, re.IGNORECASE) for p in patterns])
    for label, patterns in _RULES
]


def _rule_category(description: str) -> str:
    for label, patterns in _COMPILED_RULES:
        for pat in patterns:
            if pat.search(description):
                return label
    return ""


# ---------------------------------------------------------------------------
# Noise words to exclude from NLP keywords
# ---------------------------------------------------------------------------

_NOISE_WORDS = {
    # Prepositions / articles
    "at", "in", "of", "to", "by", "on", "or", "an", "is", "it", "the",
    "and", "for", "from", "through", "via", "with",
    # State/region codes in Indian bank statements
    "gi", "gj", "dl", "bh", "mh", "br", "bri", "mhri", "bihi",
    # Common SBI branch/location words
    "self", "odhav", "gidc", "sbin", "sbij", "sbbj",
    "mil", "sugar", "vishnu", "gopalganj", "siwan", "mirganj",
    "babunia", "more", "siw", "colony", "amar", "delhi", "patna",
    "ahmedabad", "hdfc", "icici", "aws", "esta",
    # Generic filler
    "no", "dt", "ref", "loc", "ko", "fi", "off", "ltd", "pvt",
    # Short noise
    "inter", "brch", "cash", "credit", "debit",
}

# Meaningful keywords we always want to surface if present
_PRIORITY_KEYWORDS = {
    "neft", "rtgs", "imps", "upi", "phonepe", "gpay", "paytm",
    "salary", "interest", "emi", "loan", "cheque", "transfer",
    "deposit", "withdrawal", "annual", "charge", "fee",
    "starfin", "hajarilal", "suresh",
}


def _is_meaningful_keyword(word: str) -> bool:
    w = word.strip().lower()
    if len(w) < 4:
        return False
    if w in _NOISE_WORDS:
        return False
    if w.isdigit():
        return False
    return True


# ---------------------------------------------------------------------------
# NLP helpers
# ---------------------------------------------------------------------------

def _cluster_count(row_count: int) -> int:
    if row_count <= 1:
        return 1
    return min(6, max(2, row_count // 8))


def _tokenize(text: str) -> list:
    """Tokenize description — only keep meaningful words (len>=4, not noise)."""
    tokens, current = [], []
    for ch in str(text).lower():
        if ch.isalpha():
            current.append(ch)
        elif current:
            tok = "".join(current)
            if _is_meaningful_keyword(tok):
                tokens.append(tok)
            current = []
    if current:
        tok = "".join(current)
        if _is_meaningful_keyword(tok):
            tokens.append(tok)
    return tokens if tokens else ["unknown"]


def _keywords_for_category(category: str, descriptions: list) -> str:
    """
    For a known category, return the most distinctive words from its descriptions
    — excluding the category name itself and generic noise.
    """
    # Collect all meaningful words from descriptions in this category
    word_freq: dict = {}
    for desc in descriptions:
        for tok in _tokenize(desc):
            # Skip words that are part of the category name
            cat_words = set(category.lower().split())
            if tok.lower() in cat_words:
                continue
            word_freq[tok] = word_freq.get(tok, 0) + 1

    if not word_freq:
        return ""

    # Sort by frequency, take top 3 unique meaningful words
    top = [w for w in sorted(word_freq, key=word_freq.get, reverse=True)[:5]
           if w != "unknown"][:3]
    return ", ".join(top)


def _top_keywords(features, labels, terms, cluster_id: int, n: int = 3) -> str:
    """Return top-n meaningful TF-IDF keywords for a cluster."""
    mask = [i for i, lbl in enumerate(labels) if lbl == cluster_id]
    if not mask:
        return ""
    scores = features[mask].mean(axis=0).A1
    ranked = [
        terms[i] for i in scores.argsort()[::-1]
        if scores[i] > 0 and _is_meaningful_keyword(terms[i])
    ]
    # Prefer priority keywords first
    priority = [k for k in ranked if k in _PRIORITY_KEYWORDS]
    others = [k for k in ranked if k not in _PRIORITY_KEYWORDS]
    combined = (priority + others)[:n]
    return ", ".join(combined) if combined else ""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def classify(df: pd.DataFrame):
    """
    Adds columns to df:
      - category     : human-readable rule-based label
      - nlp_keywords : meaningful TF-IDF keywords (noise filtered)
      - type         : category label used in summary table

    Returns (df, nlp_groups).
    """
    if df.empty:
        df["category"] = []
        df["nlp_keywords"] = []
        df["type"] = []
        return df, []

    df = df.copy()
    descriptions = df["description"].fillna("").astype(str)

    # Step 1: Rule-based categories
    df["category"] = descriptions.apply(_rule_category)

    # Step 2: NLP clustering
    vectorizer = TfidfVectorizer(
        tokenizer=_tokenize,
        token_pattern=None,
        stop_words=None,
        ngram_range=(1, 2),
        min_df=1,
        max_features=300,
    )
    features = vectorizer.fit_transform(descriptions)
    terms = vectorizer.get_feature_names_out()
    n_clusters = _cluster_count(len(df))

    if n_clusters == 1:
        labels = [0] * len(df)
    else:
        model = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        labels = list(model.fit_predict(features))

    cluster_kw = {
        cid: _top_keywords(features, labels, terms, cid)
        for cid in sorted(set(labels))
    }

    df["nlp_cluster"] = labels
    # Per-row nlp_keywords: meaningful words from description, fallback to category
    def _row_keywords(row):
        cat = row["category"]
        desc = row["description"]
        words = _tokenize(desc)
        # Remove words that are part of the category name
        cat_words = set(cat.lower().split()) if cat else set()
        filtered = [w for w in words if w not in cat_words and w != "unknown"]
        if filtered:
            return ", ".join(filtered[:3])
        # Fallback: just show the category name
        return cat if cat else "Other"

    df["nlp_keywords"] = df.apply(_row_keywords, axis=1)
    df["type"] = df["category"].apply(lambda c: c if c else "Other")

    # Build nlp_groups — one entry per unique category, with meaningful keywords
    seen: dict = {}
    nlp_groups = []
    for lbl in sorted(set(labels)):
        cluster_rows = df[df["nlp_cluster"] == lbl]
        cats = cluster_rows["category"].value_counts()
        dominant = cats.index[0] if not cats.empty and cats.index[0] else "Other"

        # Get meaningful keywords for this category from its descriptions
        cat_descs = cluster_rows["description"].tolist()
        kw = _keywords_for_category(dominant, cat_descs)
        if not kw or kw == "unknown":
            kw = cluster_kw.get(lbl, "")
        if not kw or kw == "unknown":
            kw = dominant  # fallback to category name itself

        if dominant not in seen:
            seen[dominant] = {"group": dominant, "keywords": kw if kw else dominant}
            nlp_groups.append(seen[dominant])
        else:
            existing = set(seen[dominant]["keywords"].split(", ")) if seen[dominant]["keywords"] else set()
            new = set(kw.split(", ")) if kw else set()
            merged = sorted(w for w in existing | new if w)
            seen[dominant]["keywords"] = ", ".join(merged[:5])

    return df, nlp_groups
