"""
Bank Statement Analysis API endpoint.
Uses the bank_statement pipeline to extract and analyze PDF bank statements.
Results are cached in the analysis_cache table.
"""
import json
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from loguru import logger
from pydantic import BaseModel

from open_notebook.domain.notebook import Source

router = APIRouter()


# ---------------------------------------------------------------------------
# Analysis Cache helpers (shared with mobile_data_analysis)
# ---------------------------------------------------------------------------

async def _load_cached_analysis(source_id: str, analysis_type: str) -> Optional[dict]:
    """Load cached analysis result from DB. Returns None if not found."""
    try:
        from open_notebook.database.repository import repo_query
        result = await repo_query(
            """
            SELECT result FROM analysis_cache
            WHERE source_id = $sid AND analysis_type = $atype
            LIMIT 1
            """,
            {"sid": str(source_id), "atype": analysis_type},
        )
        if result and len(result) > 0:
            raw = result[0].get("result")
            if isinstance(raw, dict):
                return raw
            if isinstance(raw, str):
                import json
                return json.loads(raw)
    except Exception as e:
        logger.warning(f"[AnalysisCache] Load failed for {source_id}: {e}")
    return None


async def _save_cached_analysis(source_id: str, analysis_type: str, data: dict) -> None:
    """Save analysis result to DB cache."""
    try:
        from open_notebook.database.repository import repo_query
        sid = str(source_id)
        # Delete existing then create fresh
        await repo_query(
            "DELETE analysis_cache WHERE source_id = $sid AND analysis_type = $atype",
            {"sid": sid, "atype": analysis_type},
        )
        await repo_query(
            """
            CREATE analysis_cache CONTENT {
                source_id: $sid,
                analysis_type: $atype,
                result: $result,
                created: time::now()
            }
            """,
            {"sid": sid, "atype": analysis_type, "result": data},
        )
        logger.info(f"[AnalysisCache] Saved {analysis_type} for {source_id}")
    except Exception as e:
        logger.warning(f"[AnalysisCache] Save failed for {source_id}: {e}")


# ---------------------------------------------------------------------------
# Bank Statement Config API
# ---------------------------------------------------------------------------

class ConfigUpdateRequest(BaseModel):
    value: Any


@router.get("/bank-statement/config")
async def get_bank_config():
    """Get all bank statement configuration values (DB overrides + defaults)."""
    try:
        from open_notebook.bank_statement.settings import get_all_settings, get_schema
        settings = await get_all_settings()
        schema = get_schema()
        return {
            "settings": settings,
            "schema": {k: v["description"] for k, v in schema.items()},
        }
    except Exception as e:
        logger.error(f"Failed to get bank config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/bank-statement/config/{key}")
async def get_bank_config_key(key: str):
    """Get a single bank statement config value."""
    try:
        from open_notebook.bank_statement.settings import get_setting, get_schema
        schema = get_schema()
        if key not in schema:
            raise HTTPException(status_code=404, detail=f"Unknown config key: '{key}'")
        value = await get_setting(key)
        return {"key": key, "value": value, "description": schema[key]["description"]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/bank-statement/config/{key}")
async def set_bank_config_key(key: str, request: ConfigUpdateRequest):
    """Override a bank statement config value in the database."""
    try:
        from open_notebook.bank_statement.settings import set_setting
        await set_setting(key, request.value)
        return {"key": key, "value": request.value, "status": "saved"}
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/bank-statement/config/{key}")
async def reset_bank_config_key(key: str):
    """Reset a bank statement config value to its default."""
    try:
        from open_notebook.bank_statement.settings import reset_setting, get_schema
        schema = get_schema()
        if key not in schema:
            raise HTTPException(status_code=404, detail=f"Unknown config key: '{key}'")
        await reset_setting(key)
        return {"key": key, "status": "reset_to_default", "default": schema[key]["default"]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sources/{source_id}/bank-analysis")
async def get_bank_analysis_cached(source_id: str):
    """
    Return the cached bank statement analysis result for a source.
    Returns 404 if no analysis has been run yet.
    """
    cached = await _load_cached_analysis(source_id, "bank_statement")
    if cached is None:
        raise HTTPException(
            status_code=404,
            detail="No cached analysis found. Run the analysis first via POST."
        )
    return cached


@router.post("/sources/{source_id}/bank-analysis")
async def analyze_bank_statement(source_id: str, force_refresh: bool = False):
    """
    Run the full bank statement analysis pipeline on a source.
    Returns structured data: transactions, monthly summary, cash flow, ATM report, etc.
    """
    try:
        # Return cached result if available and not forcing refresh
        if not force_refresh:
            cached = await _load_cached_analysis(source_id, "bank_statement")
            if cached is not None:
                logger.info(f"[BankAnalysis] Returning cached result for {source_id}")
                return cached

        source = await Source.get(source_id)
        if not source:
            raise HTTPException(status_code=404, detail="Source not found")

        # Get file path from source asset
        file_path = None
        if source.asset and source.asset.file_path:
            file_path = source.asset.file_path

        if not file_path:
            raise HTTPException(
                status_code=400,
                detail="Source has no uploaded file. Bank analysis requires a PDF file."
            )

        logger.info(f"Running bank statement analysis for source {source_id}, file: {file_path}")

        from open_notebook.bank_statement.pipeline import run_pipeline_async

        full_text = source.full_text if source.full_text else None
        logger.info(f"source.full_text length: {len(full_text) if full_text else 0}")

        # If full_text is already structured pipeline output, always re-run from file
        # to get fresh transaction data. Pass raw text only if it's actual bank statement text.
        is_already_structured = bool(
            full_text and (
                full_text.strip().startswith("=== ACCOUNT DETAILS") or
                full_text.strip().startswith("=== CASH FLOW")
            )
        )

        if is_already_structured:
            # full_text is a previous pipeline output — run fresh from file
            logger.info("full_text is structured output — running pipeline on file directly")
            result = await run_pipeline_async(file_path, None)
        elif full_text and len(full_text.strip()) > 100:
            # Raw extracted text — pass to avoid re-OCR
            logger.info("Using source.full_text as raw text (no OCR needed)")
            result = await run_pipeline_async(file_path, full_text)
        else:
            # No stored text — run full extraction
            logger.info("source.full_text is empty — running file extraction")
            result = await run_pipeline_async(file_path, None)

        total = result.get('total_transactions', 0)
        logger.info(f"Bank analysis complete: {total} transactions")

        # Detect blank/unreadable PDF and return helpful error
        if total == 0:
            raise HTTPException(
                status_code=422,
                detail=(
                    "No transactions could be extracted from this PDF. "
                    "This usually means the PDF is image-based (scanned) without OCR, "
                    "or was created using 'Print to PDF' from a protected document. "
                    "Please download the original PDF directly from your bank's app or website "
                    "and upload that file instead."
                )
            )

        # Save result to cache for future calls
        await _save_cached_analysis(source_id, "bank_statement", result)

        # Also save the raw extracted text back to source.full_text
        # so future calls can skip OCR entirely
        raw_text = result.get("_extracted_text", "")
        if raw_text and source.full_text != raw_text:
            try:
                source.full_text = raw_text
                await source.save()
                logger.info(f"[BankAnalysis] Saved raw extracted text to source {source_id}")
            except Exception as e:
                logger.warning(f"[BankAnalysis] Could not save extracted text: {e}")

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Bank analysis failed for {source_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Bank analysis failed: {str(e)}")
