import json
import os
import re
import asyncio
import traceback
from urllib.parse import unquote
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from loguru import logger
from pydantic import BaseModel

from api.auth import get_current_user
from open_notebook.database.repository import ensure_record_id, repo_query
from open_notebook.domain.notebook import Notebook, Source

router = APIRouter()

KAFKA_BOOTSTRAP_SERVERS = os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "kafka:9093")

# Module-level orchestrator (lazy-initialised on first request)
_orchestrator: Optional[Any] = None


def _decode_source_id(source_id: str) -> str:
    return unquote(source_id)


# ── Helpers shared with the pipeline ─────────────────────────────────────────

def _parse_llm_output(raw: str) -> dict:
    """Extract a JSON dict from raw LLM output — handles <think>, <answer>, fences."""
    raw = re.sub(r'<think>.*?</think>', '', raw, flags=re.DOTALL)
    raw = re.sub(r'<answer>(.*?)</answer>', r'\1', raw, flags=re.DOTALL)
    raw = raw.strip()
    fence = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', raw, re.DOTALL)
    candidate = fence.group(1) if fence else raw
    brace = re.search(r'\{.*\}', candidate, re.DOTALL)
    if brace:
        try:
            return json.loads(brace.group())
        except json.JSONDecodeError:
            pass
    return {}


def _safe_str(v) -> str:
    return "" if v is None else str(v)


def _safe_list(v) -> list:
    if isinstance(v, list):
        return v
    if isinstance(v, dict):
        return [{"title": k, "description": str(val)} for k, val in v.items()]
    return []


def _render_html(data: dict) -> str:
    """Removed — HTML rendering is no longer used."""
    return ""


# ── Orchestrator builder ──────────────────────────────────────────────────────

def _build_orchestrator():
    from langchain_ollama import ChatOllama
    from open_notebook.graphs.infographic import (
        InfographicLLMService,
        InfographicPipeline,
        InfographicTextProcessor,
        KafkaInfographicOrchestrator,
        TextExtractorService,
    )

    ollama_url = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
    kafka_servers = os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "kafka:9093")

    logger.info(f"Building InfographicPipeline — Ollama: {ollama_url}, Kafka: {kafka_servers}")
    llm = ChatOllama(model="qwen3", temperature=0.3, base_url=ollama_url)
    pipeline = InfographicPipeline(
        extractor=TextExtractorService(),
        processor=InfographicTextProcessor(),
        llm_service=InfographicLLMService(llm),
    )
    orchestrator = KafkaInfographicOrchestrator(
        pipeline=pipeline,
        bootstrap_servers=kafka_servers,
    )
    logger.info("KafkaInfographicOrchestrator ready")
    return orchestrator


def get_orchestrator():
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = _build_orchestrator()
    return _orchestrator


async def _safe_produce(orchestrator, source_id: str):
    """Fire-and-forget Kafka job publish — errors are logged, never raised."""
    try:
        await orchestrator.produce_jobs([source_id])
    except Exception as e:
        logger.warning(f"Kafka produce skipped for {source_id}: {e}")


async def _assert_source_access(source_id: str, current_user: Optional[str]) -> None:
    """
    Enforce ownership scope for infographic generation.

    A source is accessible when at least one linked notebook is:
    - owned by current_user, or
    - unowned (legacy data, visible to all).
    """
    if not current_user:
        return

    references = await repo_query(
        "SELECT VALUE out FROM reference WHERE in = $source_id",
        {"source_id": ensure_record_id(source_id)},
    )

    # Legacy/unlinked sources are treated as globally visible.
    if not references:
        return

    current_user_lc = current_user.strip().lower()
    for notebook_id in references:
        try:
            notebook = await Notebook.get(str(notebook_id))
        except Exception:
            continue

        owner = notebook.owner.strip().lower() if notebook.owner else None
        if owner is None or owner == current_user_lc:
            return

    raise HTTPException(status_code=403, detail="Access denied")


async def start_kafka_consumer():
    """Start the KafkaInfographicOrchestrator consumer as a background task."""
    try:
        orchestrator = get_orchestrator()
        logger.info("Starting KafkaInfographicOrchestrator consumer...")
        await orchestrator.start_consumer()
    except Exception as e:
        logger.warning(f"Kafka infographic consumer could not start (Kafka may be unavailable): {e}")


# ── Models ────────────────────────────────────────────────────────────────────

class InfographicRequest(BaseModel):
    model_name: str = "qwen3"
    temperature: float = 0.2


class InfographicResponse(BaseModel):
    source_id: str
    document_type: str = "general"
    header: dict = {}
    left_column: list = []
    right_column: list = []
    stat: dict = {}
    highlights: list = []
    # Type-specific fields
    subject: Optional[Any] = None
    account: Optional[dict] = None
    personal: Optional[dict] = None
    financial_summary: Optional[dict] = None
    key_transactions: list = []
    call_summary: Optional[dict] = None
    top_contacts: list = []
    key_locations: list = []
    case_details: list = []
    associates: list = []
    timeline_events: list = []


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/sources/{source_id:path}/infographic", response_model=InfographicResponse)
async def generate_infographic(
    source_id: str,
    request: InfographicRequest,
    current_user: Optional[str] = Depends(get_current_user),
):
    try:
        source_id = _decode_source_id(source_id)
        source = await Source.get(source_id)
        if not source:
            raise HTTPException(status_code=404, detail="Source not found")
        await _assert_source_access(source_id, current_user)
        has_text = bool(source.full_text and source.full_text.strip())
        has_file = bool(source.asset and source.asset.file_path)
        if not has_text and not has_file:
            raise HTTPException(status_code=400, detail="Source has no usable text or file content")

        orchestrator = get_orchestrator()

        # Publish job to Kafka (non-blocking, best-effort)
        asyncio.create_task(_safe_produce(orchestrator, source_id))

        # Generate directly via the pipeline (no timeout) using asyncio.to_thread
        # for the CPU-bound text processing + concurrent LLM call
        logger.info(f"Generating infographic for source_id={source_id}")
        result = await orchestrator.pipeline.generate_from_source_id(source_id)
        logger.info(f"Infographic generation completed for source_id={source_id}")

        if not isinstance(result, dict):
            result = {}

        return InfographicResponse(
            source_id=source_id,
            document_type=_safe_str(result.get("document_type", "general")),
            header=result.get("header", {}),
            left_column=_safe_list(result.get("left_column", result.get("left", []))),
            right_column=_safe_list(result.get("right_column", result.get("right", []))),
            stat=result.get("stat", {}) if isinstance(result.get("stat"), dict) else {},
            highlights=_safe_list(result.get("highlights", result.get("cases", []))),
            # Type-specific fields
            subject=result.get("subject"),
            account=result.get("account"),
            personal=result.get("personal"),
            financial_summary=result.get("financial_summary"),
            key_transactions=_safe_list(result.get("key_transactions", [])),
            call_summary=result.get("call_summary"),
            top_contacts=_safe_list(result.get("top_contacts", [])),
            key_locations=_safe_list(result.get("key_locations", [])),
            case_details=_safe_list(result.get("case_details", [])),
            associates=_safe_list(result.get("associates", [])),
            timeline_events=_safe_list(result.get("timeline_events", [])),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Infographic generation failed for source {source_id}: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Infographic generation failed: {str(e)}")
