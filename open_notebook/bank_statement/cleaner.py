import pandas as pd

from open_notebook.bank_statement.settings import get_defaults

_D = get_defaults()


def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df

    df = df.copy()
    date_col    = _D["col_date"]
    debit_col   = _D["col_debit"]
    credit_col  = _D["col_credit"]
    balance_col = _D["col_balance"]
    month_col   = _D["col_month"]
    amount_col  = _D["col_amount"]

    for col in _D["numeric_columns"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)

    if date_col in df.columns:
        df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
        df = df.dropna(subset=[date_col])

    df = df.drop_duplicates(subset=[date_col, balance_col], keep="first")
    df = df.sort_values(date_col).reset_index(drop=True)

    df[month_col]  = df[date_col].dt.to_period("M").astype(str)
    df[amount_col] = df[credit_col] - df[debit_col]

    return df
