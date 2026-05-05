"""
Mobile / CDR / SMS dump analysis endpoint.
Parses telecom-style CSV or text exports via open_notebook.mobile_data.pipeline.
"""
from fastapi import APIRouter, HTTPException
from loguru import logger

from open_notebook.domain.notebook import Source

router = APIRouter()


@router.post("/sources/{source_id}/mobile-analysis")
async def analyze_mobile_data(source_id: str):
    """
    Run heuristic mobile-data analysis on a source (calls, SMS-ish rows in CSV/text).
    """
    try:
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
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Mobile analysis failed for {source_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Mobile analysis failed: {str(e)}")
