# import asyncio
# import operator
# from typing import Any, Dict, List, Optional
# # import pdfplumber
# import fitz
# import numpy as np
# from content_core import extract_content
# from content_core.common import ProcessSourceState
# from langchain_core.runnables import RunnableConfig
# from langgraph.graph import END, START, StateGraph
# from langgraph.types import Send
# # from loguru import logger
# from typing_extensions import Annotated, TypedDict
# import logging as logger
# from open_notebook.ai.models import Model, ModelManager
# from open_notebook.domain.content_settings import ContentSettings
# from open_notebook.domain.notebook import Asset, Source
# from open_notebook.domain.transformation import Transformation
# from open_notebook.graphs.transformation import graph as transform_graph


# def _ocr_image_bytes(image_bytes: bytes, reader) -> str:
#     """Run EasyOCR on raw image bytes. Returns joined text string."""
#     try:
#         import io as _io
#         from PIL import Image as _Image
#         img = _Image.open(_io.BytesIO(image_bytes)).convert("RGB")
#         arr = np.array(img)
#         lines = reader.readtext(arr, detail=0, batch_size=4)
#         return " ".join(lines).strip()
#     except Exception as e:
#         logger.warning(f"OCR on image bytes failed: {e}")
#         return ""


# def _ocr_pdf_sync(file_path: str) -> str:
#     """
#     Robust PDF text extraction with per-page OCR fallback.

#     Strategy:
#       1. Open with PyMuPDF.
#       2. For each page:
#          a. Extract embedded text (get_text).
#          b. Extract text blocks (get_text("blocks")).
#          c. If combined page text < 200 chars → rasterise page at 300 DPI and OCR it.
#       3. Deduplicate parts per page (preserving order), join all pages.
#       4. If total result is still empty, return "".
#     """
#     try:
#         import easyocr
#         reader = easyocr.Reader(["en", "hi"], gpu=False, verbose=False)
#     except Exception as e:
#         logger.warning(f"EasyOCR init failed: {e}. OCR fallback unavailable.")
#         reader = None

#     try:
#         doc = fitz.open(file_path)
#     except Exception as e:
#         logger.error(f"PyMuPDF could not open '{file_path}': {e}")
#         return ""

#     final_pages: list[str] = []

#     for page_index, page in enumerate(doc):
#         page_text_parts: list[str] = []

#         # 1. Embedded text
#         try:
#             embedded = page.get_text("text").strip()
#             if embedded:
#                 page_text_parts.append(embedded)
#         except Exception:
#             pass

#         # 2. Text blocks (captures table cells and structured content)
#         try:
#             blocks = page.get_text("blocks")
#             for block in blocks:
#                 if block[6] == 0 and block[4].strip():  # type 0 = text block
#                     page_text_parts.append(block[4].strip())
#         except Exception:
#             pass

#         combined = "\n".join(page_text_parts).strip()

#         # 3. Per-page OCR if text is sparse (scanned / image-based page)
#         if len(combined) < 200 and reader is not None:
#             try:
#                 pix = page.get_pixmap(dpi=300)
#                 img_bytes = pix.tobytes("png")
#                 ocr_text = _ocr_image_bytes(img_bytes, reader)
#                 if ocr_text:
#                     logger.info(
#                         f"Page {page_index + 1}: OCR extracted {len(ocr_text)} chars"
#                     )
#                     page_text_parts.append("[OCR PAGE CONTENT]\n" + ocr_text)
#             except Exception as e:
#                 logger.warning(f"Page {page_index + 1} OCR failed: {e}")

#         # Deduplicate parts while preserving order
#         clean_page_text = "\n".join(dict.fromkeys(page_text_parts))
#         final_pages.append(clean_page_text)

#     doc.close()
#     result = "\n\n".join(final_pages).strip()
#     logger.info(f"PDF extraction complete: {len(result)} chars from '{file_path}'")
#     return result


# def _ocr_pdf_sync(file_path: str) -> str:
#     """
#     Improved PDF extraction:
#     - Preserves tables (HTML / structured extraction)
#     - OCR fallback for scanned pages
#     - Optional pdfplumber table extraction
#     """

#     try:
#         import easyocr
#         reader = easyocr.Reader(["en", "hi"], gpu=False, verbose=False)
#     except Exception as e:
#         logger.warning(f"EasyOCR init failed: {e}. OCR disabled.")
#         reader = None

#     try:
#         doc = fitz.open(file_path)
#     except Exception as e:
#         logger.error(f"Cannot open PDF: {e}")
#         return ""

#     final_pages = []

#     for page_index, page in enumerate(doc):
#         page_content_parts = []

#         # =========================
#         # 1. HTML extraction (BEST for tables)
#         # =========================
#         try:
#             html_text = page.get_text("html")
#             if html_text:
#                 page_content_parts.append(html_text)
#         except Exception as e:
#             logger.warning(f"HTML extraction failed on page {page_index}: {e}")

#         # =========================
#         # 2. Dictionary extraction (backup structured text)
#         # =========================
#         try:
#             dict_text = page.get_text("dict")
#             for block in dict_text.get("blocks", []):
#                 if "lines" in block:
#                     for line in block["lines"]:
#                         line_text = " ".join(
#                             span["text"] for span in line.get("spans", [])
#                         ).strip()
#                         if line_text:
#                             page_content_parts.append(line_text)
#         except Exception:
#             pass

#         combined_text = "\n".join(page_content_parts).strip()

#         # =========================
#         # 3. OCR fallback for scanned pages
#         # =========================
#         if len(combined_text) < 200 and reader is not None:
#             try:
#                 pix = page.get_pixmap(dpi=300)
#                 img_bytes = pix.tobytes("png")
#                 ocr_text = _ocr_image_bytes(img_bytes, reader)

#                 if ocr_text:
#                     logger.info(f"OCR page {page_index + 1}: {len(ocr_text)} chars")
#                     page_content_parts.append("[OCR CONTENT]\n" + ocr_text)
#             except Exception as e:
#                 logger.warning(f"OCR failed page {page_index}: {e}")

#         # =========================
#         # Deduplicate while preserving order
#         # =========================
#         clean_page = "\n".join(dict.fromkeys(page_content_parts))
#         final_pages.append(clean_page)

#     doc.close()

#     result = "\n\n".join(final_pages).strip()
#     logger.info(f"PDF extraction complete: {len(result)} chars from {file_path}")

#     return result

# async def _ocr_fallback(file_path: str) -> str:
#     """Async wrapper — runs OCR in a thread so it doesn't block the event loop."""
#     return await asyncio.to_thread(_ocr_pdf_sync, file_path)


# class SourceState(TypedDict):
#     content_state: ProcessSourceState
#     apply_transformations: List[Transformation]
#     source_id: str
#     notebook_ids: List[str]
#     source: Source
#     transformation: Annotated[list, operator.add]
#     embed: bool


# class TransformationState(TypedDict):
#     source: Source
#     transformation: Transformation


# async def content_process(state: SourceState) -> dict:
#     content_settings = ContentSettings(
#         default_content_processing_engine_doc="auto",
#         default_content_processing_engine_url="auto",
#         default_embedding_option="ask",
#         auto_delete_files="yes",
#         youtube_preferred_languages=[
#             "en",
#             "pt",
#             "es",
#             "de",
#             "nl",
#             "en-GB",
#             "fr",
#             "hi",
#             "ja",
#         ],
#     )
#     content_state: Dict[str, Any] = state["content_state"]  # type: ignore[assignment]

#     content_state["url_engine"] = (
#         content_settings.default_content_processing_engine_url or "auto"
#     )
#     content_state["document_engine"] = (
#         content_settings.default_content_processing_engine_doc or "auto"
#     )
#     content_state["output_format"] = "markdown"

#     # Add speech-to-text model configuration from Default Models
#     try:
#         model_manager = ModelManager()
#         defaults = await model_manager.get_defaults()
#         if defaults.default_speech_to_text_model:
#             stt_model = await Model.get(defaults.default_speech_to_text_model)
#             if stt_model:
#                 content_state["audio_provider"] = stt_model.provider
#                 content_state["audio_model"] = stt_model.name
#                 logger.debug(
#                     f"Using speech-to-text model: {stt_model.provider}/{stt_model.name}"
#                 )
#     except Exception as e:
#         logger.warning(f"Failed to retrieve speech-to-text model configuration: {e}")
#         # Continue without custom audio model (content-core will use its default)

#     processed_state = await extract_content(content_state)

#     file_path = getattr(processed_state, "file_path", None) or content_state.get("file_path")
#     content_text = processed_state.content or ""
#     is_pdf = file_path and str(file_path).lower().endswith(".pdf")

#     # Trigger OCR fallback when:
#     #   - content is empty/missing, OR
#     #   - it's a PDF and the extracted text is suspiciously sparse (< 200 chars total)
#     #     which indicates a scanned/image-based PDF that content_core couldn't read well
#     needs_ocr = (not content_text.strip()) or (is_pdf and len(content_text.strip()) < 200)

#     if needs_ocr:
#         # ── OCR fallback for file-based sources (scanned PDFs, image PDFs) ──
#         if file_path:
#             logger.info(
#                 f"content_core returned {'empty' if not content_text.strip() else 'sparse'} "
#                 f"text for file '{file_path}'. Attempting OCR fallback..."
#             )
#             ocr_text = await _ocr_fallback(file_path)
#             if ocr_text and ocr_text.strip():
#                 logger.info(
#                     f"OCR fallback succeeded — extracted {len(ocr_text)} chars from '{file_path}'"
#                 )
#                 processed_state.content = ocr_text
#                 return {"content_state": processed_state}
#             else:
#                 logger.warning(f"OCR fallback also returned empty text for '{file_path}'")

#         url = getattr(processed_state, "url", None) or ""
#         if url and ("youtube.com" in url or "youtu.be" in url):
#             raise ValueError(
#                 "Could not extract content from this YouTube video. "
#                 "No transcript or subtitles are available. "
#                 "Try configuring a Speech-to-Text model in Settings "
#                 "to transcribe the audio instead."
#             )
#         raise ValueError(
#             "Could not extract any text content from this source. "
#             "The content may be empty, inaccessible, or in an unsupported format."
#         )

#     return {"content_state": processed_state}


# async def save_source(state: SourceState) -> dict:
#     content_state = state["content_state"]

#     # Get existing source using the provided source_id
#     source = await Source.get(state["source_id"])
#     if not source:
#         raise ValueError(f"Source with ID {state['source_id']} not found")

#     # Update the source with processed content
#     source.asset = Asset(url=content_state.url, file_path=content_state.file_path)
#     source.full_text = content_state.content

#     # Preserve existing title if none provided in processed content
#     if content_state.title:
#         source.title = content_state.title

#     await source.save()

#     # NOTE: Notebook associations are created by the API immediately for UI responsiveness
#     # No need to create them here to avoid duplicate edges

#     if state["embed"]:
#         if source.full_text and source.full_text.strip():
#             logger.debug("Embedding content for vector search")
#             await source.vectorize()
#         else:
#             logger.warning(
#                 f"Source {source.id} has no text content to embed, skipping vectorization"
#             )

#     return {"source": source}


# def trigger_transformations(state: SourceState, config: RunnableConfig) -> List[Send]:
#     if len(state["apply_transformations"]) == 0:
#         return []

#     to_apply = state["apply_transformations"]
#     logger.debug(f"Applying transformations {to_apply}")

#     return [
#         Send(
#             "transform_content",
#             {
#                 "source": state["source"],
#                 "transformation": t,
#             },
#         )
#         for t in to_apply
#     ]


# async def transform_content(state: TransformationState) -> Optional[dict]:
#     source = state["source"]
#     content = source.full_text
#     if not content:
#         return None
#     transformation: Transformation = state["transformation"]

#     logger.debug(f"Applying transformation {transformation.name}")
#     result = await transform_graph.ainvoke(
#         dict(input_text=content, transformation=transformation)  # type: ignore[arg-type]
#     )
#     await source.add_insight(transformation.title, result["output"])
#     return {
#         "transformation": [
#             {
#                 "output": result["output"],
#                 "transformation_name": transformation.name,
#             }
#         ]
#     }


# # Create and compile the workflow
# workflow = StateGraph(SourceState)

# # Add nodes
# workflow.add_node("content_process", content_process)
# workflow.add_node("save_source", save_source)
# workflow.add_node("transform_content", transform_content)
# # Define the graph edges
# workflow.add_edge(START, "content_process")
# workflow.add_edge("content_process", "save_source")
# workflow.add_conditional_edges(
#     "save_source", trigger_transformations, ["transform_content"]
# )
# workflow.add_edge("transform_content", END)

# # Compile the graph
# source_graph = workflow.compile()



import asyncio
import operator
from typing import Any, Dict, List, Optional

import fitz
import numpy as np
from content_core import extract_content
from content_core.common import ProcessSourceState
from langchain_core.runnables import RunnableConfig
from langgraph.graph import END, START, StateGraph
from langgraph.types import Send
# from loguru import logger
from typing_extensions import Annotated, TypedDict
import logging as logger
from open_notebook.ai.models import Model, ModelManager
from open_notebook.domain.content_settings import ContentSettings
from open_notebook.domain.notebook import Asset, Source
from open_notebook.domain.transformation import Transformation
from open_notebook.graphs.transformation import graph as transform_graph


def _ocr_image_bytes(image_bytes: bytes, reader) -> str:
    """Run EasyOCR on raw image bytes. Returns joined text string."""
    try:
        import io as _io
        from PIL import Image as _Image
        img = _Image.open(_io.BytesIO(image_bytes)).convert("RGB")
        arr = np.array(img)
        lines = reader.readtext(arr, detail=0, batch_size=4)
        return " ".join(lines).strip()
    except Exception as e:
        logger.warning(f"OCR on image bytes failed: {e}")
        return ""


def _ocr_pdf_sync(file_path: str) -> str:
    """
    Robust PDF text extraction with per-page OCR fallback.

    Strategy:
      1. Open with PyMuPDF.
      2. For each page:
         a. Extract embedded text (get_text).
         b. Extract text blocks (get_text("blocks")).
         c. If combined page text < 200 chars → rasterise page at 300 DPI and OCR it.
      3. Deduplicate parts per page (preserving order), join all pages.
      4. If total result is still empty, return "".
    """
    try:
        import easyocr
        import torch as _torch
        _use_gpu = _torch.cuda.is_available()
        reader = easyocr.Reader(["en", "hi"], gpu=_use_gpu, verbose=False)
        logger.info(f"EasyOCR initialized — GPU={'YES' if _use_gpu else 'NO'}")
    except Exception as e:
        logger.warning(f"EasyOCR init failed: {e}. OCR fallback unavailable.")
        reader = None

    try:
        doc = fitz.open(file_path)
    except Exception as e:
        logger.error(f"PyMuPDF could not open '{file_path}': {e}")
        return ""

    final_pages: list[str] = []

    for page_index, page in enumerate(doc):
        page_text_parts: list[str] = []

        # 1. Embedded text
        try:
            embedded = page.get_text("text").strip()
            if embedded:
                page_text_parts.append(embedded)
        except Exception:
            pass

        # 2. Text blocks (captures table cells and structured content)
        try:
            blocks = page.get_text("blocks")
            for block in blocks:
                if block[6] == 0 and block[4].strip():  # type 0 = text block
                    page_text_parts.append(block[4].strip())
        except Exception:
            pass

        combined = "\n".join(page_text_parts).strip()

        # 3. Per-page OCR if text is sparse (scanned / image-based page)
        if len(combined) < 200 and reader is not None:
            try:
                pix = page.get_pixmap(dpi=300)
                img_bytes = pix.tobytes("png")
                ocr_text = _ocr_image_bytes(img_bytes, reader)
                if ocr_text:
                    logger.info(
                        f"Page {page_index + 1}: OCR extracted {len(ocr_text)} chars"
                    )
                    page_text_parts.append("[OCR PAGE CONTENT]\n" + ocr_text)
            except Exception as e:
                logger.warning(f"Page {page_index + 1} OCR failed: {e}")

        # Deduplicate parts while preserving order
        clean_page_text = "\n".join(dict.fromkeys(page_text_parts))
        final_pages.append(clean_page_text)

    doc.close()
    result = "\n\n".join(final_pages).strip()
    logger.info(f"PDF extraction complete: {len(result)} chars from '{file_path}'")
    return result


async def _ocr_fallback(file_path: str) -> str:
    """Async wrapper — runs OCR in a thread so it doesn't block the event loop."""
    return await asyncio.to_thread(_ocr_pdf_sync, file_path)


class SourceState(TypedDict):
    content_state: ProcessSourceState
    apply_transformations: List[Transformation]
    source_id: str
    notebook_ids: List[str]
    source: Source
    transformation: Annotated[list, operator.add]
    embed: bool


class TransformationState(TypedDict):
    source: Source
    transformation: Transformation


async def content_process(state: SourceState) -> dict:
    content_settings = ContentSettings(
        default_content_processing_engine_doc="auto",
        default_content_processing_engine_url="auto",
        default_embedding_option="ask",
        auto_delete_files="yes",
        youtube_preferred_languages=[
            "en",
            "pt",
            "es",
            "de",
            "nl",
            "en-GB",
            "fr",
            "hi",
            "ja",
        ],
    )
    content_state: Dict[str, Any] = state["content_state"]  # type: ignore[assignment]

    content_state["url_engine"] = (
        content_settings.default_content_processing_engine_url or "auto"
    )
    content_state["document_engine"] = (
        content_settings.default_content_processing_engine_doc or "auto"
    )
    content_state["output_format"] = "markdown"

    # Add speech-to-text model configuration from Default Models
    try:
        model_manager = ModelManager()
        defaults = await model_manager.get_defaults()
        stt_model_id = defaults.default_speech_to_text_model
        if stt_model_id:
            try:
                stt_model = await Model.get(stt_model_id)
            except Exception as e:
                logger.warning(
                    f"Default speech-to-text model {stt_model_id} was not found; "
                    "clearing stale default reference."
                )
                defaults.default_speech_to_text_model = None
                await defaults.save()
                stt_model = None

            if stt_model:
                content_state["audio_provider"] = stt_model.provider
                content_state["audio_model"] = stt_model.name
                logger.debug(
                    f"Using speech-to-text model: {stt_model.provider}/{stt_model.name}"
                )
    except Exception as e:
        logger.warning(f"Failed to retrieve speech-to-text model configuration: {e}")
        # Continue without custom audio model (content-core will use its default)

    processed_state = await extract_content(content_state)

    file_path = getattr(processed_state, "file_path", None) or content_state.get("file_path")
    content_text = processed_state.content or ""
    is_pdf = file_path and str(file_path).lower().endswith(".pdf")

    # ── Bank Statement Pipeline: har PDF file mate pehla run karo ──
    # For scanned/image PDFs: use _ocr_fallback to extract raw text first (fast, page-by-page).
    # Store that as full_text. The bank_statement pipeline (transaction parsing) runs later
    # when the user opens "Financial Analysis Report" — it uses source.full_text directly.
    if is_pdf and file_path:
        logger.info(f"PDF detected: '{file_path}'. Extracting text for storage...")
        try:
            from open_notebook.bank_statement.pipeline import run_pipeline

            # 3-minute timeout — if OCR takes longer, fall through to _ocr_fallback
            result = await asyncio.wait_for(
                asyncio.to_thread(run_pipeline, file_path, None),
                timeout=180
            )
            total = result.get("total_transactions", 0)

            if total > 0:
                # Pipeline parsed transactions successfully — build structured full_text
                lines = []

                # Account details
                detail_cards = result.get("detail_cards", [])
                if detail_cards:
                    lines.append("=== ACCOUNT DETAILS ===")
                    for f in detail_cards:
                        lines.append(f"{f.get('label', '')}: {f.get('value', '')}")
                    lines.append("")

                # Cash flow
                cf = result.get("cashflow", {})
                if cf:
                    lines.append("=== CASH FLOW SUMMARY ===")
                    for k, v in cf.items():
                        lines.append(f"{k.replace('_', ' ').title()}: {v}")
                    lines.append("")

                # Monthly summary
                monthly = result.get("monthly", [])
                if monthly:
                    lines.append("=== MONTHLY SUMMARY ===")
                    for row in monthly:
                        lines.append(
                            f"{row.get('month', '')} | Credit: {row.get('credit', '0')} | "
                            f"Debit: {row.get('debit', '0')} | Balance: {row.get('balance', '0')}"
                        )
                    lines.append("")

                # All transactions
                txns = result.get("transactions", [])
                if txns:
                    lines.append(f"=== ALL TRANSACTIONS ({len(txns)}) ===")
                    for tx in txns:
                        lines.append(
                            f"{tx.get('date','')} | {tx.get('description','')} | "
                            f"Dr:{tx.get('debit','0.00')} | Cr:{tx.get('credit','0.00')} | "
                            f"Bal:{tx.get('balance','0.00')} | {tx.get('type','')}"
                        )
                    lines.append("")

                full_text = "\n".join(lines)
                logger.info(
                    f"bank_statement pipeline: {total} transactions, {len(full_text)} chars"
                )
                processed_state.content = full_text
                if not processed_state.title:
                    import os as _os
                    processed_state.title = _os.path.splitext(_os.path.basename(file_path))[0]
                return {"content_state": processed_state}

            # Pipeline got 0 transactions — use raw extracted text if available
            raw_text = result.get("_extracted_text", "")
            if raw_text and raw_text.strip():
                logger.info(
                    f"bank_statement pipeline: 0 transactions but got {len(raw_text)} chars raw text"
                )
                processed_state.content = raw_text
                if not processed_state.title:
                    import os as _os
                    processed_state.title = _os.path.splitext(_os.path.basename(file_path))[0]
                return {"content_state": processed_state}

            # Pipeline returned nothing (OCR timed out or failed) — fall through to _ocr_fallback
            logger.info("bank_statement pipeline returned no text — trying _ocr_fallback")

        except asyncio.TimeoutError:
            logger.warning(f"bank_statement pipeline timed out for '{file_path}' — falling back to OCR")
        except Exception as _e:
            logger.warning(f"bank_statement pipeline failed: {_e} — falling back to OCR")

    content_text = processed_state.content or ""

    # ── Mobile CDR / SMS exports (CSV, TXT): structure full_text like bank summaries ──
    if file_path and content_text.strip():
        try:
            from open_notebook.mobile_data.pipeline import (
                build_searchable_text,
                run_pipeline_from_text,
                sniff_maybe_mobile,
            )

            title_hint = getattr(processed_state, "title", None) or ""
            if sniff_maybe_mobile(title_hint, str(file_path), content_text[:16000]):
                mr = await asyncio.to_thread(run_pipeline_from_text, content_text)
                if mr.get("total_records", 0) > 0:
                    excerpt_cap = 180_000
                    tail = (
                        content_text[:excerpt_cap]
                        if len(content_text) > excerpt_cap
                        else content_text
                    )
                    processed_state.content = (
                        f"{build_searchable_text(mr)}\n\n=== SOURCE EXCERPT ===\n{tail}"
                    )
                    content_text = processed_state.content or ""
                    logger.info(
                        f"mobile_data pipeline: {mr['total_records']} rows embedded in source text"
                    )
        except Exception as _mob:
            logger.warning(f"mobile_data pipeline skip: {_mob}")

    # Trigger OCR fallback when:
    #   - content is empty/missing, OR
    #   - it's a PDF and the extracted text is suspiciously sparse (< 200 chars total)
    needs_ocr = (not content_text.strip()) or (is_pdf and len(content_text.strip()) < 200)

    if needs_ocr:
        # For PDFs where pipeline returned nothing — use _ocr_fallback to get raw text.
        # This raw text is stored as full_text and used by bank-analysis endpoint later.
        if file_path:
            logger.info(f"Attempting EasyOCR fallback for '{file_path}'...")
            ocr_text = await _ocr_fallback(file_path)
            if ocr_text and ocr_text.strip():
                logger.info(
                    f"OCR fallback succeeded — extracted {len(ocr_text)} chars from '{file_path}'"
                )
                processed_state.content = ocr_text
                if not processed_state.title and file_path:
                    import os as _os
                    processed_state.title = _os.path.splitext(_os.path.basename(str(file_path)))[0]
                return {"content_state": processed_state}
            else:
                logger.warning(f"OCR fallback also returned empty text for '{file_path}'")

        url = getattr(processed_state, "url", None) or ""
        if url and ("youtube.com" in url or "youtu.be" in url):
            raise ValueError(
                "Could not extract content from this YouTube video. "
                "No transcript or subtitles are available. "
                "Try configuring a Speech-to-Text model in Settings "
                "to transcribe the audio instead."
            )
        raise ValueError(
            "Could not extract any text content from this source. "
            "The content may be empty, inaccessible, or in an unsupported format."
        )

    return {"content_state": processed_state}


async def save_source(state: SourceState) -> dict:
    content_state = state["content_state"]

    # Get existing source using the provided source_id
    source = await Source.get(state["source_id"])
    if not source:
        raise ValueError(f"Source with ID {state['source_id']} not found")

    # Update the source with processed content
    source.asset = Asset(url=content_state.url, file_path=content_state.file_path)
    source.full_text = content_state.content

    # Preserve existing title if none provided in processed content
    if content_state.title:
        source.title = content_state.title

    await source.save()

    # NOTE: Notebook associations are created by the API immediately for UI responsiveness
    # No need to create them here to avoid duplicate edges

    if state["embed"]:
        if source.full_text and source.full_text.strip():
            logger.debug("Embedding content for vector search")
            await source.vectorize()
        else:
            logger.warning(
                f"Source {source.id} has no text content to embed, skipping vectorization"
            )

    return {"source": source}


def trigger_transformations(state: SourceState, config: RunnableConfig) -> List[Send]:
    if len(state["apply_transformations"]) == 0:
        return []

    to_apply = state["apply_transformations"]
    logger.debug(f"Applying transformations {to_apply}")

    return [
        Send(
            "transform_content",
            {
                "source": state["source"],
                "transformation": t,
            },
        )
        for t in to_apply
    ]


async def transform_content(state: TransformationState) -> Optional[dict]:
    source = state["source"]
    content = source.full_text
    if not content:
        return None
    transformation: Transformation = state["transformation"]

    logger.debug(f"Applying transformation {transformation.name}")
    result = await transform_graph.ainvoke(
        dict(input_text=content, transformation=transformation)  # type: ignore[arg-type]
    )
    # Note: transform_graph.ainvoke() already calls source.add_insight() internally
    # in the run_transformation() node, so we don't duplicate it here
    return {
        "transformation": [
            {
                "output": result["output"],
                "transformation_name": transformation.name,
            }
        ]
    }


# Create and compile the workflow
workflow = StateGraph(SourceState)

# Add nodes
workflow.add_node("content_process", content_process)
workflow.add_node("save_source", save_source)
workflow.add_node("transform_content", transform_content)
# Define the graph edges
workflow.add_edge(START, "content_process")
workflow.add_edge("content_process", "save_source")
workflow.add_conditional_edges(
    "save_source", trigger_transformations, ["transform_content"]
)
workflow.add_edge("transform_content", END)

# Compile the graph
source_graph = workflow.compile()
