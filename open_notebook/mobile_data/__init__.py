"""Mobile / telecom CDR & SMS-ish dump analysis (CSV, TXT, structured text)."""

from open_notebook.mobile_data.pipeline import build_searchable_text, run_pipeline_from_text

__all__ = ["build_searchable_text", "run_pipeline_from_text"]
