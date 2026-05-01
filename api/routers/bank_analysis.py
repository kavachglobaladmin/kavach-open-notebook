"""
Bank Statement Analysis API endpoint.
Uses the bank_statement pipeline to extract and analyze PDF bank statements.
"""
from fastapi import APIRouter, HTTPException
from loguru import logger

from open_notebook.domain.notebook import Source

router = APIRouter()


@router.post("/sources/{source_id}/bank-analysis")
async def analyze_bank_statement(source_id: str):
    """
    Run the full bank statement analysis pipeline on a source.
    Returns structured data: transactions, monthly summary, cash flow, ATM report, etc.
    """
    try:
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

        # Run pipeline in thread (CPU-bound)
        import asyncio
        from open_notebook.bank_statement.pipeline import run_pipeline

        # Strategy: always try direct file extraction first (most accurate).
        # Only fall back to source.full_text if file extraction yields 0 transactions
        # (handles image-based PDFs that were OCR'd during source processing).
        fallback_text = source.full_text if source.full_text else None
        logger.info(f"full_text length: {len(fallback_text) if fallback_text else 0}")

        # First pass: direct file extraction (no pre-extracted text)
        result = await asyncio.to_thread(run_pipeline, file_path, None)
        total = result.get('total_transactions', 0)
        logger.info(f"Bank analysis complete: {total} transactions")

        # Second pass: if file extraction failed, try stored full_text (OCR fallback)
        if total == 0 and fallback_text and len(fallback_text.strip()) > 100:
            logger.info("File extraction yielded 0 — retrying with source.full_text")
            result = await asyncio.to_thread(run_pipeline, file_path, fallback_text)
            total = result.get('total_transactions', 0)
            logger.info(f"Bank analysis (full_text fallback) complete: {total} transactions")

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

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Bank analysis failed for {source_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Bank analysis failed: {str(e)}")
