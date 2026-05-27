"""
All 10 report functions for the bank statement dashboard.
All thresholds and keywords loaded from config.py.
"""

import math
import datetime

from open_notebook.bank_statement.config import (
    ATM_CATEGORY_NAME,
    CHARGE_KEYWORDS,
    CHARGE_TYPE_DEFAULT,
    CHARGE_TYPE_MAP,
    COLUMNS,
    INTEREST_KEYWORDS,
    REPORTS,
)


# ---------------------------------------------------------------------------
# 1. Monthly Summary
# ---------------------------------------------------------------------------

def monthly_summary(df):
    if df.empty:
        return []

    summary = (
        df.groupby(COLUMNS["month"], as_index=False)
        .agg({
            COLUMNS["credit"]:  "sum",
            COLUMNS["debit"]:   "sum",
            COLUMNS["balance"]: "last",
        })
        .sort_values(COLUMNS["month"])
    )
    records = summary.to_dict("records")
    for row in records:
        try:
            parts = str(row[COLUMNS["month"]]).split("-")
            row[COLUMNS["month"]] = datetime.date(int(parts[0]), int(parts[1]), 1).strftime(
                REPORTS["month_format"]
            )
        except (ValueError, IndexError):
            pass
    return records


# ---------------------------------------------------------------------------
# 2. Cash Flow
# ---------------------------------------------------------------------------

def cash_flow(df):
    credit_col  = COLUMNS["credit"]
    debit_col   = COLUMNS["debit"]
    balance_col = COLUMNS["balance"]
    amount_col  = COLUMNS["amount"]

    total_credit = float(df[credit_col].sum())  if not df.empty else 0.0
    total_debit  = float(df[debit_col].sum())   if not df.empty else 0.0
    net          = total_credit - total_debit
    opening_bal  = float(df[balance_col].iloc[0] - df[amount_col].iloc[0]) if not df.empty else 0.0
    closing_bal  = float(df[balance_col].iloc[-1]) if not df.empty else 0.0
    return {
        "total_credit":    total_credit,
        "total_debit":     total_debit,
        "net":             net,
        "opening_balance": opening_bal,
        "closing_balance": closing_bal,
    }


# ---------------------------------------------------------------------------
# 3. Transaction Type (category-wise)
# ---------------------------------------------------------------------------

def transaction_type(df):
    if df.empty:
        return []

    type_col   = COLUMNS["type"]
    amount_col = COLUMNS["amount"]

    grouped = (
        df.groupby(type_col, as_index=False)
        .agg(total_amount=(amount_col, "sum"), count=(type_col, "count"))
        .sort_values("count", ascending=False)
    )
    records = grouped.to_dict("records")
    for row in records:
        row["total_amount_raw"] = float(row["total_amount"])
    return records


# ---------------------------------------------------------------------------
# 4. ATM Withdrawal Report
# ---------------------------------------------------------------------------

def atm_report(df, cfg: dict | None = None):
    if cfg is None:
        cfg = {}
    empty = {"count": 0, "total": 0.0, "avg": 0.0, "largest": 0.0, "transactions": []}
    if df.empty:
        return empty

    cat_col   = COLUMNS["category"]
    debit_col = COLUMNS["debit"]
    atm_name  = cfg.get("atm_category_name", ATM_CATEGORY_NAME)
    top_n     = cfg.get("atm_top_n", REPORTS["atm_top_n"])

    atm = (
        df[df[cat_col] == atm_name].copy()
        if cat_col in df.columns
        else df[df[debit_col] > 0].copy()
    )
    if atm.empty:
        return empty

    total   = float(atm[debit_col].sum())
    count   = int(len(atm))
    avg     = total / count if count else 0.0
    largest = float(atm[debit_col].max())

    keep = [c for c in [COLUMNS["date"], COLUMNS["description"], debit_col, COLUMNS["balance"]]
            if c in atm.columns]
    txns = atm.nlargest(top_n, debit_col)[keep].to_dict("records")

    return {"count": count, "total": total, "avg": avg, "largest": largest, "transactions": txns}


# ---------------------------------------------------------------------------
# 5. Bank Charges Report
# ---------------------------------------------------------------------------

def charges_report(df, cfg: dict | None = None):
    if cfg is None:
        cfg = {}
    empty = {"total": 0.0, "count": 0, "breakdown": [], "transactions": []}
    if df.empty:
        return empty

    cat_col   = COLUMNS["category"]
    desc_col  = COLUMNS["description"]
    debit_col = COLUMNS["debit"]

    charge_keywords = cfg.get("charge_keywords", CHARGE_KEYWORDS)
    charge_type_map = cfg.get("charge_type_map", [[kws, lbl] for kws, lbl in CHARGE_TYPE_MAP])
    charge_default  = cfg.get("charge_type_default", CHARGE_TYPE_DEFAULT)

    def _is_charge(row):
        if str(row.get(cat_col, "")) == "Bank Charges":
            return True
        desc = str(row.get(desc_col, "")).upper()
        return any(k in desc for k in charge_keywords)

    charges = df[df.apply(_is_charge, axis=1)].copy()
    if charges.empty:
        return empty

    total = float(charges[debit_col].sum())
    count = int(len(charges))

    breakdown_map: dict = {}
    for _, row in charges.iterrows():
        desc = str(row.get(desc_col, "")).upper()
        key = charge_default
        for keywords, label in charge_type_map:
            if any(k in desc for k in keywords):
                key = label
                break
        breakdown_map[key] = breakdown_map.get(key, 0.0) + float(row.get(debit_col, 0))

    breakdown = [
        {"charge_type": k, "amount": v}
        for k, v in sorted(breakdown_map.items(), key=lambda x: -x[1])
    ]

    keep = [c for c in [COLUMNS["date"], desc_col, debit_col, COLUMNS["balance"]]
            if c in charges.columns]
    txns = charges[keep].to_dict("records")

    return {"total": total, "count": count, "breakdown": breakdown, "transactions": txns}


# ---------------------------------------------------------------------------
# 6. Deposit vs Withdrawal Pattern
# ---------------------------------------------------------------------------

def pattern_report(df):
    if df.empty:
        return {
            "avg_deposit": 0.0, "avg_withdrawal": 0.0,
            "max_deposit": 0.0, "max_withdrawal": 0.0,
            "min_deposit": 0.0, "min_withdrawal": 0.0,
            "total_deposit_txns": 0, "total_withdrawal_txns": 0,
        }

    def _safe(val):
        return 0.0 if (val is None or (isinstance(val, float) and math.isnan(val))) else float(val)

    credit_col = COLUMNS["credit"]
    debit_col  = COLUMNS["debit"]

    credits = df[df[credit_col] > 0][credit_col]
    debits  = df[df[debit_col]  > 0][debit_col]

    return {
        "avg_deposit":          _safe(credits.mean()),
        "avg_withdrawal":       _safe(debits.mean()),
        "max_deposit":          _safe(credits.max()),
        "max_withdrawal":       _safe(debits.max()),
        "min_deposit":          _safe(credits.min()),
        "min_withdrawal":       _safe(debits.min()),
        "total_deposit_txns":   int(len(credits)),
        "total_withdrawal_txns": int(len(debits)),
    }


# ---------------------------------------------------------------------------
# 7. High Value Transactions
# ---------------------------------------------------------------------------

def high_value(df, threshold=None):
    if threshold is None:
        threshold = REPORTS["high_value_threshold"]
    if df.empty:
        return []

    keep = [c for c in [
        COLUMNS["date"], COLUMNS["description"],
        COLUMNS["debit"], COLUMNS["credit"], COLUMNS["balance"],
        COLUMNS["nlp_keywords"], COLUMNS["type"],
    ] if c in df.columns]

    return df[abs(df[COLUMNS["amount"]]) > threshold][keep].to_dict("records")


# ---------------------------------------------------------------------------
# 8. Balance Trend
# ---------------------------------------------------------------------------

def balance_trend(df):
    if df.empty:
        return []

    keep = [c for c in [
        COLUMNS["date"], COLUMNS["description"],
        COLUMNS["debit"], COLUMNS["credit"], COLUMNS["balance"],
    ] if c in df.columns]

    records = df[keep].to_dict("records")
    for row in records:
        if hasattr(row.get(COLUMNS["date"]), "strftime"):
            row["month_label"] = row[COLUMNS["date"]].strftime(REPORTS["month_format"])
        else:
            row["month_label"] = str(row.get(COLUMNS["date"], ""))[:7]
    return records


# ---------------------------------------------------------------------------
# 9. Interest Earned Report
# ---------------------------------------------------------------------------

def interest_report(df, cfg: dict | None = None):
    if cfg is None:
        cfg = {}
    empty = {"total": 0.0, "count": 0, "avg_per_quarter": 0.0, "transactions": []}
    if df.empty:
        return empty

    cat_col    = COLUMNS["category"]
    desc_col   = COLUMNS["description"]
    credit_col = COLUMNS["credit"]
    date_col   = COLUMNS["date"]

    interest_keywords = cfg.get("interest_keywords", INTEREST_KEYWORDS)

    def _is_interest(row):
        cat = str(row.get(cat_col, ""))
        desc = str(row.get(desc_col, "")).upper()
        if cat == "Interest Credit":
            return True
        if any(k in desc for k in interest_keywords):
            return True
        import re as _re
        if _re.match(r'^\d{2}-\d{2}-\d{4}', desc) and float(row.get(credit_col, 0)) > 0:
            return True
        return False

    interest = df[df.apply(_is_interest, axis=1)].copy()
    interest = interest[interest[credit_col] > 0]

    if interest.empty:
        return empty

    total = float(interest[credit_col].sum())
    count = int(len(interest))

    months_span = 1
    if date_col in interest.columns:
        try:
            d_min = interest[date_col].min()
            d_max = interest[date_col].max()
            months_span = max(1, (d_max.year - d_min.year) * 12 + (d_max.month - d_min.month) + 1)
        except Exception:
            pass
    quarters = max(1, months_span / 3)
    avg_per_quarter = total / quarters

    keep = [c for c in [date_col, desc_col, credit_col, COLUMNS["balance"]]
            if c in interest.columns]
    txns = interest[keep].to_dict("records")

    return {"total": total, "count": count, "avg_per_quarter": avg_per_quarter, "transactions": txns}


# ---------------------------------------------------------------------------
# 10. Frequency Report
# ---------------------------------------------------------------------------

def frequency_report(df):
    if df.empty:
        return {
            "debit_count": 0, "credit_count": 0,
            "busiest_month": "-", "busiest_month_count": 0,
            "avg_txns_per_month": 0.0,
        }

    debit_col  = COLUMNS["debit"]
    credit_col = COLUMNS["credit"]
    month_col  = COLUMNS["month"]

    debit_count  = int(len(df[df[debit_col]  > 0]))
    credit_count = int(len(df[df[credit_col] > 0]))

    busiest_month = "-"
    busiest_count = 0
    avg_per_month = 0.0

    if month_col in df.columns:
        monthly_counts = df.groupby(month_col).size()
        if not monthly_counts.empty:
            bm_key = monthly_counts.idxmax()
            busiest_count = int(monthly_counts.max())
            avg_per_month = float(monthly_counts.mean())
            try:
                parts = str(bm_key).split("-")
                busiest_month = datetime.date(int(parts[0]), int(parts[1]), 1).strftime(
                    REPORTS["month_format"]
                )
            except Exception:
                busiest_month = str(bm_key)

    return {
        "debit_count":         debit_count,
        "credit_count":        credit_count,
        "busiest_month":       busiest_month,
        "busiest_month_count": busiest_count,
        "avg_txns_per_month":  round(avg_per_month, 1),
    }
