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

        result = await asyncio.to_thread(run_pipeline, file_path)

        logger.info(f"Bank analysis complete: {result.get('total_transactions', 0)} transactions")
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Bank analysis failed for {source_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Bank analysis failed: {str(e)}")
