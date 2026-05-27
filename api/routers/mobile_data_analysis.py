"""
Mobile / CDR / SMS dump analysis endpoint.
Parses telecom-style CSV or text exports via open_notebook.mobile_data.pipeline.
Results are cached in the analysis_cache table — subsequent calls return the cached
result unless force_refresh=true is passed.
"""
from fastapi import APIRouter, HTTPException
from loguru import logger

from open_notebook.domain.notebook import Source
from api.routers.bank_analysis import _load_cached_analysis, _save_cached_analysis

router = APIRouter()

_ANALYSIS_TYPE = "mobile_cdr"


@router.get("/sources/{source_id}/mobile-analysis")
async def get_mobile_analysis_cached(source_id: str):
    """
    Return the cached mobile/CDR analysis result for a source.
    Returns 404 if no analysis has been run yet.
    """
    cached = await _load_cached_analysis(source_id, _ANALYSIS_TYPE)
    if cached is None:
        raise HTTPException(
            status_code=404,
            detail="No cached analysis found. Run the analysis first via POST."
        )
    return cached


@router.post("/sources/{source_id}/mobile-analysis")
async def analyze_mobile_data(source_id: str, force_refresh: bool = False):
    """
    Run heuristic mobile-data analysis on a source (calls, SMS-ish rows in CSV/text).
    Results are cached in the database — subsequent calls return the cached result
    unless force_refresh=true is passed.
    """
    try:
        # ── Return cached result if available and not forcing refresh ────────
        if not force_refresh:
            cached = await _load_cached_analysis(source_id, _ANALYSIS_TYPE)
            if cached is not None:
                logger.info(f"[MobileAnalysis] Returning cached result for {source_id}")
                return cached

        source = await Source.get(source_id)
        if not source:
            raise HTTPException(status_code=404, detail="Source not found")

        file_path = None
        if source.asset and source.asset.file_path:
            file_path = source.asset.file_path

        full_text = (source.full_text or "").strip()
        blob = ""

        import asyncio
        from open_notebook.mobile_data.pipeline import (
            build_searchable_text,
            read_file_text,
            run_pipeline_from_text,
            sniff_maybe_mobile,
        )

        if file_path:
            blob = read_file_text(str(file_path))
        if not blob.strip() and full_text:
            blob = full_text

        if not blob.strip():
            raise HTTPException(
                status_code=400,
                detail="No text content available. Upload a CSV / TXT CDR or SMS export.",
            )

        title = source.title or ""
        if not sniff_maybe_mobile(title, str(file_path) if file_path else "", blob[:16000]):
            logger.info(
                f"mobile-analysis: source {source_id} does not look like CDR/SMS data — running parser anyway"
            )

        result = await asyncio.to_thread(run_pipeline_from_text, blob)
        total = int(result.get("total_records") or 0)
        logger.info(f"Mobile data analysis for {source_id}: {total} parsed rows")

        if total == 0:
            hint = result.get("error_hint") or "Could not parse rows."
            raise HTTPException(
                status_code=422,
                detail=(
                    f"{hint} Export should include phone numbers (10-digit Indian MSISDN patterns) "
                    "and optionally dates / duration columns."
                ),
            )

        # Helpful denormalised preview for debugging / future UI
        result["_searchable_stub"] = build_searchable_text(result)

        # ── Persist result to database cache ─────────────────────────────────
        await _save_cached_analysis(source_id, _ANALYSIS_TYPE, result)

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Mobile analysis failed for {source_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Mobile analysis failed: {str(e)}")
