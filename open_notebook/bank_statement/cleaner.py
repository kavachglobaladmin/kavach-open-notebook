import pandas as pd


def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df

    df = df.copy()

    # Ensure numeric columns are proper floats
    for col in ("debit", "credit", "balance"):
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)

    # Ensure date column is datetime
    if "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"], errors="coerce")
        df = df.dropna(subset=["date"])

    # Safety-net deduplication: same date + same balance = same transaction
    # (parser already deduplicates, this catches any edge cases)
    df = df.drop_duplicates(subset=["date", "balance"], keep="first")

    # Sort by date
    df = df.sort_values("date").reset_index(drop=True)

    # Derived columns
    df["month"] = df["date"].dt.to_period("M").astype(str)
    df["amount"] = df["credit"] - df["debit"]

    return df
