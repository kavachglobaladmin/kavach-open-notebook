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

        # Strategy:
        # 1. If full_text is raw OCR/extracted text → pass it to pipeline (avoids re-OCR).
        # 2. If full_text is already structured pipeline output (starts with "=== ACCOUNT DETAILS")
        #    → run pipeline directly on the file (text-based PDFs are fast; avoids parser confusion).
        # 3. If full_text is empty → run pipeline on file (triggers OCR if needed).
        full_text = source.full_text if source.full_text else None
        logger.info(f"source.full_text length: {len(full_text) if full_text else 0}")

        # Detect already-processed structured output — pipeline output starts with this marker
        is_already_structured = (
            full_text and full_text.strip().startswith("=== ACCOUNT DETAILS")
        )

        if is_already_structured:
            # full_text is structured pipeline output, not raw text — run on file directly
            logger.info("full_text is structured output — running pipeline on file directly")
            result = await asyncio.to_thread(run_pipeline, file_path, None)
            # If file extraction also fails (e.g. scanned PDF), try with full_text anyway
            if result.get('total_transactions', 0) == 0:
                logger.info("File extraction got 0 — trying full_text as fallback")
                result = await asyncio.to_thread(run_pipeline, file_path, full_text)
        elif full_text and len(full_text.strip()) > 100:
            # Raw extracted text — pass directly to avoid re-OCR
            logger.info("Using source.full_text as raw text (no OCR needed)")
            result = await asyncio.to_thread(run_pipeline, file_path, full_text)
        else:
            # No stored text — run full extraction (may trigger OCR)
            logger.info("source.full_text is empty — running file extraction")
            result = await asyncio.to_thread(run_pipeline, file_path, None)

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

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Bank analysis failed for {source_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Bank analysis failed: {str(e)}")
