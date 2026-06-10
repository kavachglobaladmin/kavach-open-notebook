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
import os
import re
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


def _clean_pdf_piece(value: Any) -> str:
    text = str(value or "").replace("\x00", " ").strip()
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    return text.strip()


def _looks_like_pdf_form_text(text: str, file_path: str = "") -> bool:
    lower = f"{file_path}\n{text[:20000]}".lower()
    signals = [
        "form no. mgt",
        "mgt-7",
        "annual return",
        "corporate identification number",
        "cin",
        "companies act",
        "authorised capital",
        "share holding pattern",
        "board meetings",
        "certificate of practice number",
    ]
    return sum(1 for signal in signals if signal in lower) >= 3


def _compose_layout_line(items: list[tuple[float, float, str]]) -> str:
    items = sorted(items, key=lambda item: item[0])
    parts: list[str] = []
    last_x1: float | None = None
    for x0, x1, text in items:
        clean = _clean_pdf_piece(text)
        if not clean:
            continue
        if last_x1 is not None:
            gap = max(0, x0 - last_x1)
            if gap > 90:
                parts.append(" | ")
            elif gap > 25:
                parts.append("  ")
            else:
                parts.append(" ")
        parts.append(clean)
        last_x1 = max(last_x1 or x1, x1)
    return re.sub(r" {3,}", "  ", "".join(parts)).strip()


def _normalize_line_for_compare(line: str) -> str:
    return re.sub(r"[^a-z0-9]", "", line.lower())


def _normalize_cin_candidate(token: str) -> str:
    raw = re.sub(r"[^A-Za-z0-9]", "", token or "").upper()
    if len(raw) != 21:
        return ""
    chars = list(raw)
    digit_pos = {1, 2, 3, 4, 5, 8, 9, 10, 11, 15, 16, 17, 18, 19, 20}
    to_digit = {"O": "0", "Q": "0", "D": "0", "I": "1", "L": "1", "S": "5", "B": "8", "G": "6"}
    to_alpha = {"0": "O", "1": "I", "5": "S", "8": "B", "6": "G"}
    for idx, ch in enumerate(chars):
        if idx in digit_pos:
            chars[idx] = to_digit.get(ch, ch)
        else:
            chars[idx] = to_alpha.get(ch, ch)
    cin = "".join(chars)
    if re.fullmatch(r"[A-Z]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}", cin):
        return cin
    return ""


def _normalize_pan_candidate(token: str) -> str:
    raw = re.sub(r"[^A-Za-z0-9]", "", token or "").upper()
    if len(raw) != 10:
        return ""
    chars = list(raw)
    digit_pos = {5, 6, 7, 8}
    to_digit = {"O": "0", "Q": "0", "D": "0", "I": "1", "L": "1", "S": "5", "B": "8"}
    to_alpha = {"0": "O", "1": "I", "5": "S", "8": "B"}
    for idx, ch in enumerate(chars):
        if idx in digit_pos:
            chars[idx] = to_digit.get(ch, ch)
        else:
            chars[idx] = to_alpha.get(ch, ch)
    pan = "".join(chars)
    if re.fullmatch(r"[A-Z]{5}\d{4}[A-Z]", pan):
        return pan
    return ""


def _add_identifier_normalizations(page_text: str) -> str:
    upper = page_text.upper()
    additions: list[str] = []

    cin_tokens = set(re.findall(r"\b[A-Z0-9]{21}\b", upper))
    for token in cin_tokens:
        norm = _normalize_cin_candidate(token)
        if norm and norm != token and norm not in upper:
            additions.append(f"CIN (normalized): {norm}")
            break

    pan_tokens = set(re.findall(r"\b[A-Z0-9]{10}\b", upper))
    for token in pan_tokens:
        norm = _normalize_pan_candidate(token)
        if norm and norm != token and norm not in upper:
            additions.append(f"PAN (normalized): {norm}")
            break

    if not additions:
        return page_text
    return page_text.strip() + "\n" + "\n".join(additions)


def _merge_layout_and_ocr_text(layout_text: str, ocr_text: str) -> str:
    """
    Merge OCR lines into layout text by adding only lines that are not already present.
    This keeps structure from layout extraction while filling missed typed values.
    """
    layout_lines = [line.rstrip() for line in layout_text.splitlines()]
    ocr_lines = [line.strip() for line in ocr_text.splitlines() if line.strip()]

    seen = {
        _normalize_line_for_compare(line)
        for line in layout_lines
        if _normalize_line_for_compare(line)
    }
    merged = list(layout_lines)
    added = 0

    for line in ocr_lines:
        # Skip tiny/noisy OCR fragments.
        if len(line) < 3:
            continue
        key = _normalize_line_for_compare(line)
        if not key:
            continue
        if key in seen:
            continue
        if len(key) <= 3:
            continue
        merged.append(line)
        seen.add(key)
        added += 1
        # Keep supplement bounded.
        if added >= 180:
            break

    return "\n".join(merged).strip()


def _ocr_page_sync(page: Any, reader: Any, dpi: int = 220) -> str:
    try:
        import io as _io
        import numpy as _np
        from PIL import Image as _Image

        pix = page.get_pixmap(dpi=dpi)
        img = _Image.open(_io.BytesIO(pix.tobytes("png"))).convert("RGB")
        arr = _np.array(img)
        lines = reader.readtext(arr, detail=0, batch_size=4)
        return "\n".join(_clean_pdf_piece(line) for line in lines if _clean_pdf_piece(line)).strip()
    except Exception as e:
        logger.debug(f"OCR page extraction failed: {e}")
        return ""


def _extract_pdf_structured_sync(file_path: str) -> str:
    """
    Extract text from table/form-heavy PDFs while preserving reading order.

    content-core is good for ordinary documents, but MCA/ROC PDFs often contain
    AcroForm fields and dense table layouts. PyMuPDF lets us read both page text
    and widget values with coordinates, so we can rebuild cleaner page lines.
    """
    try:
        doc = fitz.open(file_path)
    except Exception as e:
        logger.warning(f"Structured PDF extraction could not open '{file_path}': {e}")
        return ""

    page_texts: list[str] = []
    all_text_for_detection: list[str] = []
    widget_count = 0

    for page_index, page in enumerate(doc, start=1):
        positioned: list[tuple[float, float, float, str]] = []

        try:
            data = page.get_text("dict", sort=True)
            for block in data.get("blocks", []):
                if block.get("type") != 0:
                    continue
                for line in block.get("lines", []):
                    spans = []
                    for span in line.get("spans", []):
                        clean = _clean_pdf_piece(span.get("text", ""))
                        if not clean:
                            continue
                        x0, y0, x1, _y1 = span.get("bbox", (0, 0, 0, 0))
                        spans.append((float(x0), float(x1), clean))
                    line_text = _compose_layout_line(spans)
                    if line_text:
                        x0, y0, _x1, _y1 = line.get("bbox", (0, 0, 0, 0))
                        positioned.append((float(y0), float(x0), float(_x1), line_text))
                        all_text_for_detection.append(line_text)
        except Exception as e:
            logger.debug(f"Structured PDF text extraction failed on page {page_index}: {e}")

        try:
            widgets = list(page.widgets() or [])
        except Exception:
            widgets = []

        for widget in widgets:
            value = _clean_pdf_piece(getattr(widget, "field_value", ""))
            if not value or value.lower() in {"off", "false", "none"}:
                continue
            widget_count += 1
            name = _clean_pdf_piece(getattr(widget, "field_label", "") or getattr(widget, "field_name", ""))
            # Many generated PDFs use opaque names. Keep useful labels only.
            if name and re.search(r"[A-Za-z]", name) and not re.fullmatch(r"[A-Za-z_]*\d+[A-Za-z_\d]*", name):
                widget_text = f"{name}: {value}"
            else:
                widget_text = value
            rect = getattr(widget, "rect", None)
            y0 = float(rect.y0) if rect is not None else 0.0
            x0 = float(rect.x0) if rect is not None else 0.0
            x1 = float(rect.x1) if rect is not None else x0
            positioned.append((y0, x0, x1, widget_text))
            all_text_for_detection.append(widget_text)

        positioned.sort(key=lambda item: (round(item[0] / 3) * 3, item[1]))
        grouped: list[tuple[float, list[tuple[float, float, str]]]] = []
        for y0, x0, x1, text in positioned:
            if grouped and abs(grouped[-1][0] - y0) <= 3:
                grouped[-1][1].append((x0, x1, text))
            else:
                grouped.append((y0, [(x0, x1, text)]))

        lines: list[str] = []
        last_y: float | None = None
        for y0, items in grouped:
            line = _compose_layout_line(items)
            if not line:
                continue
            if last_y is not None and y0 - last_y > 22 and lines and lines[-1] != "":
                lines.append("")
            lines.append(line)
            last_y = y0

        page_text = "\n".join(lines).strip()
        page_texts.append(page_text)

    detection_text = "\n".join(all_text_for_detection)
    form_like = widget_count >= 8 or _looks_like_pdf_form_text(detection_text, file_path)

    # For form-like PDFs (e.g. MGT-7), OCR the first pages and merge unique lines.
    # These pages often contain filled values that are visually rendered but not
    # reliably available in the PDF text layer.
    if form_like:
        try:
            import easyocr
            import torch as _torch
            reader = easyocr.Reader(["en"], gpu=_torch.cuda.is_available(), verbose=False)
            ocr_pages = min(3, len(page_texts))
            for idx in range(ocr_pages):
                ocr_text = _ocr_page_sync(doc[idx], reader, dpi=220)
                if ocr_text:
                    merged = _merge_layout_and_ocr_text(page_texts[idx], ocr_text)
                    page_texts[idx] = _add_identifier_normalizations(merged)
        except Exception as e:
            logger.warning(f"Structured PDF OCR supplement skipped: {e}")

    pages: list[str] = []
    for i, text in enumerate(page_texts, start=1):
        if text.strip():
            pages.append(f"=== Page {i} ===\n{text.strip()}")

    doc.close()

    result = "\n\n".join(pages).strip()
    if not result:
        return ""

    if form_like:
        logger.info(
            f"Structured PDF extraction produced {len(result)} chars "
            f"with {widget_count} form field value(s)"
        )
        return result

    return ""


def _prefer_structured_pdf_text(current_text: str, structured_text: str, file_path: str) -> bool:
    if not structured_text or len(structured_text.strip()) < 300:
        return False
    if _looks_like_pdf_form_text(structured_text, file_path):
        return True
    if not current_text or len(current_text.strip()) < 500:
        return True

    current_lines = [line.strip() for line in current_text.splitlines() if line.strip()]
    structured_lines = [line.strip() for line in structured_text.splitlines() if line.strip()]
    current_short = sum(1 for line in current_lines if len(line) <= 3)
    structured_short = sum(1 for line in structured_lines if len(line) <= 3)
    current_noise_ratio = current_short / max(1, len(current_lines))
    structured_noise_ratio = structured_short / max(1, len(structured_lines))

    return (
        len(structured_lines) >= max(10, int(len(current_lines) * 0.45))
        and structured_noise_ratio + 0.08 < current_noise_ratio
    )


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

    # ── Bank Statement Pipeline: only run for PDFs that look like bank statements ──
    # Check filename for bank-statement keywords to avoid running the slow pipeline on every PDF.
    # The pipeline can take up to 3 minutes; non-bank PDFs should skip it entirely.
    _BANK_KEYWORDS = {
        "statement", "bank", "account", "passbook", "transaction",
        "hdfc", "sbi", "icici", "axis", "kotak", "canara", "federal",
        "pnb", "bob", "ubi", "idbi", "yes bank", "indusind",
    }
    _fname_lower = str(file_path).lower() if file_path else ""
    _is_bank_pdf = is_pdf and file_path and any(kw in _fname_lower for kw in _BANK_KEYWORDS)

    if is_pdf and file_path and not _is_bank_pdf:
        try:
            structured_pdf_text = await asyncio.to_thread(_extract_pdf_structured_sync, str(file_path))
            if _prefer_structured_pdf_text(content_text, structured_pdf_text, str(file_path)):
                logger.info(
                    "Using structured PDF extraction instead of generic extraction "
                    f"for '{os.path.basename(str(file_path))}'"
                )
                processed_state.content = structured_pdf_text
                content_text = structured_pdf_text
                if not processed_state.title:
                    processed_state.title = os.path.splitext(os.path.basename(str(file_path)))[0]
        except Exception as _pdf_structured_error:
            logger.warning(f"Structured PDF extraction skipped: {_pdf_structured_error}")

    if _is_bank_pdf:
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
    source.full_text = content_state.content  # Always save original content

    # Preserve existing title if none provided in processed content
    if content_state.title:
        source.title = content_state.title

    # Detect language and translate non-English content
    if source.full_text and source.full_text.strip():
        try:
            from open_notebook.utils.translation import translate_to_english
            model_id = None  # Use default model
            translated, lang = await translate_to_english(source.full_text, model_id=model_id)
            source.content_language = lang
            if lang != "en":
                source.translated_content = translated
                logger.info(f"[Source] Translated content from '{lang}' to English for source {source.id}")
            else:
                source.translated_content = None
        except Exception as e:
            logger.warning(f"[Source] Translation failed for source {source.id}: {e}")

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
    # Use translated content for transformations if available (better quality)
    # Fall back to original full_text
    content = source.translated_content if source.translated_content else source.full_text
    if not content:
        return None
    transformation: Transformation = state["transformation"]

    logger.debug(f"Applying transformation {transformation.name}")
    result = await transform_graph.ainvoke(
        dict(
            source=source,
            input_text=content,
            transformation=transformation,
            save_insight=False,  # Don't save inside run_transformation — we save once here
        )  # type: ignore[arg-type]
    )
    # Save insight once here after LLM completes
    await source.add_insight(transformation.title, result["output"])
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
