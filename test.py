import pdfplumber
import pandas as pd
import re

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.naive_bayes import MultinomialNB

# -------------------------------
# 1. EXTRACT TEXT FROM PDF
# -------------------------------
def extract_text(file_path):
    text = ""
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            text += page.extract_text() + "\n"
    return text


# -------------------------------
# 2. PARSE TRANSACTIONS
# -------------------------------
def parse_transactions(text):
    lines = text.split("\n")
    data = []

    for line in lines:
        match = re.search(r'(\d{2}-\d{2}-\d{4}).*?([\d,]+\.\d{2})\s+([\d,]+\.\d{2}CR)', line)

        if match:
            date = match.group(1)
            amount = float(match.group(2).replace(",", ""))
            balance = float(match.group(3).replace(",", "").replace("CR", ""))

            debit = amount if "WDL" in line or "DEBIT" in line else 0
            credit = amount if debit == 0 else 0

            data.append({
                "date": pd.to_datetime(date, dayfirst=True),
                "description": line,
                "debit": debit,
                "credit": credit,
                "balance": balance
            })

    return pd.DataFrame(data)


# -------------------------------
# 3. CLEAN DATA
# -------------------------------
def clean_data(df):
    df = df.fillna(0)
    df["month"] = df["date"].dt.to_period("M")
    df["amount"] = df["credit"] - df["debit"]
    return df


# -------------------------------
# 4. TRAIN ML MODEL (Sample Data)
# -------------------------------
def train_model():
    # Sample training data (you can expand)
    data = [
        ("ATM WDL SBI", "ATM"),
        ("CASH DEPOSIT", "DEPOSIT"),
        ("INTEREST CREDIT", "INTEREST"),
        ("ATM ANNUAL FEE", "CHARGE"),
        ("TRANSFER TO ACCOUNT", "TRANSFER"),
    ]

    df = pd.DataFrame(data, columns=["text", "label"])

    vectorizer = TfidfVectorizer()
    X = vectorizer.fit_transform(df["text"])

    # Choose model
    model = LogisticRegression()   # OR MultinomialNB()
    model.fit(X, df["label"])

    return vectorizer, model


# -------------------------------
# 5. CLASSIFY
# -------------------------------
def classify(df, vectorizer, model):
    X = vectorizer.transform(df["description"])
    df["type"] = model.predict(X)
    return df


# -------------------------------
# 6. REPORTS
# -------------------------------

def monthly_summary(df):
    return df.groupby("month").agg({
        "credit": "sum",
        "debit": "sum",
        "balance": "last"
    })

def cash_flow(df):
    return {
        "total_credit": df["credit"].sum(),
        "total_debit": df["debit"].sum(),
        "net": df["credit"].sum() - df["debit"].sum()
    }

def transaction_type(df):
    return df.groupby("type").agg({
        "amount": "sum",
        "type": "count"
    })

def atm_report(df):
    atm = df[df["type"] == "ATM"]
    return {"total": atm["debit"].sum(), "count": len(atm)}

def charges_report(df):
    return df[df["type"] == "CHARGE"]["debit"].sum()

def pattern_report(df):
    return {
        "avg_deposit": df[df["credit"] > 0]["credit"].mean(),
        "avg_withdrawal": df[df["debit"] > 0]["debit"].mean()
    }

def high_value(df, threshold=5000):
    return df[abs(df["amount"]) > threshold]

def balance_trend(df):
    return df[["date", "balance"]]

def interest_report(df):
    return df[df["type"] == "INTEREST"]["credit"].sum()

def frequency_report(df):
    return {
        "debit_count": len(df[df["debit"] > 0]),
        "credit_count": len(df[df["credit"] > 0])
    }


# -------------------------------
# 7. PIPELINE RUN
# -------------------------------
def run_pipeline(file_path):

    text = extract_text(file_path)
    df = parse_transactions(text)
    df = clean_data(df)

    vectorizer, model = train_model()
    df = classify(df, vectorizer, model)

    reports = {
        "monthly": monthly_summary(df),
        "cashflow": cash_flow(df),
        "types": transaction_type(df),
        "atm": atm_report(df),
        "charges": charges_report(df),
        "pattern": pattern_report(df),
        "high_value": high_value(df),
        "balance": balance_trend(df),
        "interest": interest_report(df),
        "frequency": frequency_report(df)
    }

    return reports


# -------------------------------
# 8. RUN
# -------------------------------
if __name__ == "__main__":
    file_path = "ACCT STATEMENT.pdf"
    reports = run_pipeline(file_path)

    for key, value in reports.items():
        print(f"\n--- {key.upper()} ---")
        print(value)