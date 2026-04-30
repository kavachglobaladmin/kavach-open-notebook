"""
All 10 report functions for the bank statement dashboard.

1.  monthly_summary      — month-wise credit / debit / closing balance
2.  cash_flow            — total credit, debit, net flow
3.  transaction_type     — category-wise count + net amount
4.  atm_report           — ATM withdrawal count, total, avg, largest
5.  charges_report       — bank charges breakdown
6.  pattern_report       — deposit vs withdrawal pattern (avg, max, min)
7.  high_value           — transactions above threshold
8.  balance_trend        — date-wise running balance
9.  interest_report      — interest earned summary
10. frequency_report     — credit / debit transaction counts
"""

import math
import datetime


# ---------------------------------------------------------------------------
# 1. Monthly Summary
# ---------------------------------------------------------------------------

def monthly_summary(df):
    if df.empty:
        return []

    summary = (
        df.groupby("month", as_index=False)
        .agg({"credit": "sum", "debit": "sum", "balance": "last"})
        .sort_values("month")
    )
    records = summary.to_dict("records")
    for row in records:
        try:
            parts = str(row["month"]).split("-")
            row["month"] = datetime.date(int(parts[0]), int(parts[1]), 1).strftime("%b %Y")
        except (ValueError, IndexError):
            pass
    return records


# ---------------------------------------------------------------------------
# 2. Cash Flow
# ---------------------------------------------------------------------------

def cash_flow(df):
    total_credit = float(df["credit"].sum()) if not df.empty else 0.0
    total_debit  = float(df["debit"].sum())  if not df.empty else 0.0
    net          = total_credit - total_debit
    opening_bal  = float(df["balance"].iloc[0] - df["amount"].iloc[0]) if not df.empty else 0.0
    closing_bal  = float(df["balance"].iloc[-1]) if not df.empty else 0.0
    return {
        "total_credit": total_credit,
        "total_debit":  total_debit,
        "net":          net,
        "opening_balance": opening_bal,
        "closing_balance": closing_bal,
    }


# ---------------------------------------------------------------------------
# 3. Transaction Type (category-wise)
# ---------------------------------------------------------------------------

def transaction_type(df):
    if df.empty:
        return []

    grouped = (
        df.groupby("type", as_index=False)
        .agg(total_amount=("amount", "sum"), count=("type", "count"))
        .sort_values("count", ascending=False)
    )
    records = grouped.to_dict("records")
    for row in records:
        row["total_amount_raw"] = float(row["total_amount"])
    return records


# ---------------------------------------------------------------------------
# 4. ATM Withdrawal Report
# ---------------------------------------------------------------------------

def atm_report(df):
    if df.empty:
        return {
            "count": 0, "total": 0.0, "avg": 0.0,
            "largest": 0.0, "transactions": [],
        }

    atm = df[df["category"] == "ATM Withdrawal"].copy() if "category" in df.columns else df[df["debit"] > 0].copy()
    if atm.empty:
        return {
            "count": 0, "total": 0.0, "avg": 0.0,
            "largest": 0.0, "transactions": [],
        }

    total   = float(atm["debit"].sum())
    count   = int(len(atm))
    avg     = total / count if count else 0.0
    largest = float(atm["debit"].max())

    keep = [c for c in ["date", "description", "debit", "balance"] if c in atm.columns]
    txns = atm.nlargest(10, "debit")[keep].to_dict("records")

    return {
        "count": count,
        "total": total,
        "avg":   avg,
        "largest": largest,
        "transactions": txns,
    }


# ---------------------------------------------------------------------------
# 5. Bank Charges Report
# ---------------------------------------------------------------------------

def charges_report(df):
    if df.empty:
        return {
            "total": 0.0, "count": 0,
            "breakdown": [], "transactions": [],
        }

    # Match by category OR by description keywords (handles missing descriptions)
    _CHARGE_KEYWORDS = [
        "INTER BRCH FEE", "BRCH FEE", "ANNUAL FEE", "ATM FEE",
        "ATM REPLACE", "SERVICE CHARGE", "SMS CHARGE", "EXCESS DR",
        "ATM ANNUAL", "REPLACE CHARGE", "INTER BRANCH",
    ]

    def _is_charge(row):
        if str(row.get("category", "")) == "Bank Charges":
            return True
        desc = str(row.get("description", "")).upper()
        return any(k in desc for k in _CHARGE_KEYWORDS)

    charges = df[df.apply(_is_charge, axis=1)].copy()
    if charges.empty:
        return {
            "total": 0.0, "count": 0,
            "breakdown": [], "transactions": [],
        }

    total = float(charges["debit"].sum())
    count = int(len(charges))

    # Breakdown by description keyword
    breakdown_map: dict = {}
    for _, row in charges.iterrows():
        desc = str(row.get("description", "")).upper()
        if "ANNUAL" in desc or "ATM FEE" in desc or "REPLACE" in desc:
            key = "ATM / Annual Fee"
        elif "INTER BRCH" in desc or "BRCH FEE" in desc or "INTER BRANCH" in desc:
            key = "Inter-Branch Fee"
        elif "EXCESS" in desc:
            key = "Excess Charges"
        elif "SERVICE" in desc:
            key = "Service Charge"
        elif "SMS" in desc:
            key = "SMS Charges"
        else:
            key = "Other Charges"
        breakdown_map[key] = breakdown_map.get(key, 0.0) + float(row.get("debit", 0))

    breakdown = [{"charge_type": k, "amount": v} for k, v in sorted(breakdown_map.items(), key=lambda x: -x[1])]

    keep = [c for c in ["date", "description", "debit", "balance"] if c in charges.columns]
    txns = charges[keep].to_dict("records")

    return {
        "total": total,
        "count": count,
        "breakdown": breakdown,
        "transactions": txns,
    }


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

    credits = df[df["credit"] > 0]["credit"]
    debits  = df[df["debit"]  > 0]["debit"]

    return {
        "avg_deposit":    _safe(credits.mean()),
        "avg_withdrawal": _safe(debits.mean()),
        "max_deposit":    _safe(credits.max()),
        "max_withdrawal": _safe(debits.max()),
        "min_deposit":    _safe(credits.min()),
        "min_withdrawal": _safe(debits.min()),
        "total_deposit_txns":    int(len(credits)),
        "total_withdrawal_txns": int(len(debits)),
    }


# ---------------------------------------------------------------------------
# 7. High Value Transactions
# ---------------------------------------------------------------------------

def high_value(df, threshold=5000):
    if df.empty:
        return []
    keep = [c for c in ["date", "description", "debit", "credit", "balance", "nlp_keywords", "type"] if c in df.columns]
    return df[abs(df["amount"]) > threshold][keep].to_dict("records")


# ---------------------------------------------------------------------------
# 8. Balance Trend
# ---------------------------------------------------------------------------

def balance_trend(df):
    if df.empty:
        return []
    keep = [c for c in ["date", "description", "debit", "credit", "balance"] if c in df.columns]
    records = df[keep].to_dict("records")
    # Add month label for grouping
    for row in records:
        if hasattr(row.get("date"), "strftime"):
            row["month_label"] = row["date"].strftime("%b %Y")
        else:
            row["month_label"] = str(row.get("date", ""))[:7]
    return records


# ---------------------------------------------------------------------------
# 9. Interest Earned Report
# ---------------------------------------------------------------------------

def interest_report(df):
    if df.empty:
        return {
            "total": 0.0, "count": 0,
            "avg_per_quarter": 0.0, "transactions": [],
        }

    # Match by category OR description keywords OR month-end small credit pattern
    def _is_interest(row):
        cat = str(row.get("category", ""))
        desc = str(row.get("description", "")).upper()
        if cat == "Interest Credit":
            return True
        if any(k in desc for k in ["INTEREST", "INT CR", "INT CREDIT"]):
            return True
        # SBI interest: month-end credit with no description (date-only description)
        # Pattern: description looks like "31-12-2011 531.00 66,209.00CR"
        # These are small credits on last day of month
        import re as _re
        if _re.match(r'^\d{2}-\d{2}-\d{4}', desc) and float(row.get("credit", 0)) > 0:
            return True
        return False

    interest = df[df.apply(_is_interest, axis=1)].copy()
    # Only keep credit transactions for interest
    interest = interest[interest["credit"] > 0]

    if interest.empty:
        return {
            "total": 0.0, "count": 0,
            "avg_per_quarter": 0.0, "transactions": [],
        }

    total = float(interest["credit"].sum())
    count = int(len(interest))

    # Avg per quarter
    if "date" in interest.columns:
        months_span = 1
        try:
            d_min = interest["date"].min()
            d_max = interest["date"].max()
            months_span = max(1, (d_max.year - d_min.year) * 12 + (d_max.month - d_min.month) + 1)
        except Exception:
            pass
        quarters = max(1, months_span / 3)
        avg_per_quarter = total / quarters
    else:
        avg_per_quarter = total / max(1, count)

    keep = [c for c in ["date", "description", "credit", "balance"] if c in interest.columns]
    txns = interest[keep].to_dict("records")

    return {
        "total": total,
        "count": count,
        "avg_per_quarter": avg_per_quarter,
        "transactions": txns,
    }


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

    debit_count  = int(len(df[df["debit"]  > 0]))
    credit_count = int(len(df[df["credit"] > 0]))

    busiest_month = "-"
    busiest_count = 0
    avg_per_month = 0.0

    if "month" in df.columns:
        monthly_counts = df.groupby("month").size()
        if not monthly_counts.empty:
            bm_key = monthly_counts.idxmax()
            busiest_count = int(monthly_counts.max())
            avg_per_month = float(monthly_counts.mean())
            try:
                parts = str(bm_key).split("-")
                busiest_month = datetime.date(int(parts[0]), int(parts[1]), 1).strftime("%b %Y")
            except Exception:
                busiest_month = str(bm_key)

    return {
        "debit_count":         debit_count,
        "credit_count":        credit_count,
        "busiest_month":       busiest_month,
        "busiest_month_count": busiest_count,
        "avg_txns_per_month":  round(avg_per_month, 1),
    }
