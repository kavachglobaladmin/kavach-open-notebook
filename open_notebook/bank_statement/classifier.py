"""
Transaction classifier.

Step 1 — Rule-based: assigns a human-readable category based on keywords
         found in the transaction description.
Step 2 — NLP clustering: groups transactions using TF-IDF + KMeans.
         Keywords are filtered to remove noise (short words, location codes,
         branch codes, single letters, common filler words).

All rules, noise words, and thresholds are loaded from config.py.
"""

import re

import pandas as pd
from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import TfidfVectorizer

from open_notebook.bank_statement.config import (
    CATEGORY_RULES,
    CLASSIFICATION,
    COLUMNS,
    NLP_NOISE_WORDS,
    NLP_PRIORITY_KEYWORDS,
)
from open_notebook.bank_statement.nlp_engine import (
    classify_transaction as _nlp_classify,
    extract_keywords as _nlp_keywords,
    get_noise_words as _get_noise_words,
)

# ---------------------------------------------------------------------------
# Compile rule patterns once at import time
# ---------------------------------------------------------------------------

_COMPILED_RULES = [
    (label, [re.compile(p, re.IGNORECASE) for p in patterns])
    for label, patterns in CATEGORY_RULES
]


def _rule_category(description: str) -> str:
    for label, patterns in _COMPILED_RULES:
        for pat in patterns:
            if pat.search(description):
                return label
    return ""


# ---------------------------------------------------------------------------
# Keyword helpers
# ---------------------------------------------------------------------------

def _is_meaningful_keyword(word: str) -> bool:
    w = word.strip().lower()
    if len(w) < CLASSIFICATION["min_keyword_length"]:
        return False
    if w in NLP_NOISE_WORDS:
        return False
    if w.isdigit():
        return False
    return True


def _cluster_count(row_count: int) -> int:
    if row_count <= 1:
        return 1
    return min(
        CLASSIFICATION["cluster_max"],
        max(CLASSIFICATION["cluster_min"], row_count // CLASSIFICATION["cluster_formula_divisor"]),
    )


def _tokenize(text: str) -> list:
    """Tokenize description — only keep meaningful words."""
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
    word_freq: dict = {}
    for desc in descriptions:
        for tok in _tokenize(desc):
            cat_words = set(category.lower().split())
            if tok.lower() in cat_words:
                continue
            word_freq[tok] = word_freq.get(tok, 0) + 1

    if not word_freq:
        return ""

    top = [w for w in sorted(word_freq, key=word_freq.get, reverse=True)[:5]
           if w != "unknown"][:3]
    return ", ".join(top)


def _top_keywords(features, labels, terms, cluster_id: int) -> str:
    n = CLASSIFICATION["top_keywords_per_cluster"]
    mask = [i for i, lbl in enumerate(labels) if lbl == cluster_id]
    if not mask:
        return ""
    scores = features[mask].mean(axis=0).A1
    ranked = [
        terms[i] for i in scores.argsort()[::-1]
        if scores[i] > 0 and _is_meaningful_keyword(terms[i])
    ]
    priority = [k for k in ranked if k in NLP_PRIORITY_KEYWORDS]
    others = [k for k in ranked if k not in NLP_PRIORITY_KEYWORDS]
    combined = (priority + others)[:n]
    return ", ".join(combined) if combined else ""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def classify(df: pd.DataFrame, cfg: dict | None = None):
    """
    Adds columns to df. Uses cfg for category rules, cluster settings, noise words.
    Falls back to config.py defaults if cfg not provided.
    """
    if cfg is None:
        cfg = {}

    # Load settings from cfg or fall back to config defaults
    import re as _re
    raw_rules = cfg.get("category_rules", CATEGORY_RULES)
    compiled_rules = [
        (label, [_re.compile(p, _re.IGNORECASE) for p in patterns])
        for label, patterns in raw_rules
    ]

    # Use spaCy stop words as noise words (dynamic), augmented with bank-specific terms
    noise_words = _get_noise_words()
    # Also add any user-configured noise words
    extra_noise = set(cfg.get("nlp_noise_words", []))
    noise_words = noise_words | extra_noise

    priority_kw = set(cfg.get("nlp_priority_keywords", sorted(NLP_PRIORITY_KEYWORDS)))
    cluster_min = cfg.get("cluster_min", CLASSIFICATION["cluster_min"])
    cluster_max = cfg.get("cluster_max", CLASSIFICATION["cluster_max"])
    cluster_div = cfg.get("cluster_formula_divisor", CLASSIFICATION["cluster_formula_divisor"])
    min_kw_len  = CLASSIFICATION["min_keyword_length"]  # code constant, not user-configurable

    def _rule_cat(description: str) -> str:
        # Try spaCy Matcher first (dynamic, no hardcoded patterns)
        nlp_cat = _nlp_classify(description)
        if nlp_cat:
            return nlp_cat
        # Fallback to regex rules from config/DB
        for label, patterns in compiled_rules:
            for pat in patterns:
                if pat.search(description):
                    return label
        return ""

    def _is_meaningful(word: str) -> bool:
        w = word.strip().lower()
        return len(w) >= min_kw_len and w not in noise_words and not w.isdigit()

    def _cluster_n(row_count: int) -> int:
        if row_count <= 1:
            return 1
        return min(cluster_max, max(cluster_min, row_count // cluster_div))
    desc_col = COLUMNS["description"]
    cat_col  = COLUMNS["category"]
    kw_col   = COLUMNS["nlp_keywords"]
    type_col = COLUMNS["type"]
    clus_col = COLUMNS["nlp_cluster"]

    if df.empty:
        df[cat_col]  = []
        df[kw_col]   = []
        df[type_col] = []
        return df, []

    df = df.copy()
    descriptions = df[desc_col].fillna("").astype(str)

    # Step 1: Rule-based categories using cfg rules
    df[cat_col] = descriptions.apply(_rule_cat)

    # Step 2: NLP clustering
    def _tokenize_local(text: str) -> list:
        tokens, current = [], []
        for ch in str(text).lower():
            if ch.isalpha():
                current.append(ch)
            elif current:
                tok = "".join(current)
                if _is_meaningful(tok):
                    tokens.append(tok)
                current = []
        if current:
            tok = "".join(current)
            if _is_meaningful(tok):
                tokens.append(tok)
        return tokens if tokens else ["unknown"]

    vectorizer = TfidfVectorizer(
        tokenizer=_tokenize_local,
        token_pattern=None,
        stop_words=None,
        ngram_range=CLASSIFICATION["tfidf_ngram_range"],
        min_df=CLASSIFICATION["tfidf_min_df"],
        max_features=CLASSIFICATION["tfidf_max_features"],
    )
    features = vectorizer.fit_transform(descriptions)
    terms = vectorizer.get_feature_names_out()
    n_clusters = _cluster_n(len(df))

    if n_clusters == 1:
        labels = [0] * len(df)
    else:
        model = KMeans(
            n_clusters=n_clusters,
            random_state=CLASSIFICATION["kmeans_random_state"],
            n_init=CLASSIFICATION["kmeans_n_init"],
        )
        labels = list(model.fit_predict(features))

    def _top_kw_local(cluster_id: int) -> str:
        n = CLASSIFICATION["top_keywords_per_cluster"]
        mask = [i for i, lbl in enumerate(labels) if lbl == cluster_id]
        if not mask:
            return ""
        scores = features[mask].mean(axis=0).A1
        ranked = [terms[i] for i in scores.argsort()[::-1]
                  if scores[i] > 0 and _is_meaningful(terms[i])]
        pri = [k for k in ranked if k in priority_kw]
        oth = [k for k in ranked if k not in priority_kw]
        combined = (pri + oth)[:n]
        return ", ".join(combined) if combined else ""

    cluster_kw = {cid: _top_kw_local(cid) for cid in sorted(set(labels))}
    df[clus_col] = labels

    def _row_keywords(row):
        cat = row[cat_col]
        desc = row[desc_col]
        words = _tokenize_local(desc)
        cat_words = set(cat.lower().split()) if cat else set()
        filtered = [w for w in words if w not in cat_words and w != "unknown"]
        if filtered:
            return ", ".join(filtered[:3])
        return cat if cat else "Other"

    df[kw_col]   = df.apply(_row_keywords, axis=1)
    df[type_col] = df[cat_col].apply(lambda c: c if c else "Other")

    # Build nlp_groups
    seen: dict = {}
    nlp_groups = []
    for lbl in sorted(set(labels)):
        cluster_rows = df[df[clus_col] == lbl]
        cats = cluster_rows[cat_col].value_counts()
        dominant = cats.index[0] if not cats.empty and cats.index[0] else "Other"

        # Keywords for this category
        cat_descs = cluster_rows[desc_col].tolist()
        word_freq: dict = {}
        for desc in cat_descs:
            for tok in _tokenize_local(desc):
                cat_words = set(dominant.lower().split())
                if tok.lower() not in cat_words:
                    word_freq[tok] = word_freq.get(tok, 0) + 1
        top = [w for w in sorted(word_freq, key=word_freq.get, reverse=True)[:5]
               if w != "unknown"][:3]
        kw = ", ".join(top) if top else cluster_kw.get(lbl, "") or dominant

        if dominant not in seen:
            seen[dominant] = {"group": dominant, "keywords": kw}
            nlp_groups.append(seen[dominant])
        else:
            existing = set(seen[dominant]["keywords"].split(", ")) if seen[dominant]["keywords"] else set()
            new = set(kw.split(", ")) if kw else set()
            merged = sorted(w for w in existing | new if w)
            seen[dominant]["keywords"] = ", ".join(merged[:5])

    return df, nlp_groups