import json as _json
import re as _re

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langgraph.graph import END, START, StateGraph
from typing_extensions import TypedDict

from open_notebook.ai.provision import provision_langchain_model
from open_notebook.domain.notebook import Source
from open_notebook.domain.transformation import DefaultPrompts, Transformation
from open_notebook.exceptions import OpenNotebookError
from open_notebook.utils import clean_thinking_content
from open_notebook.utils.error_classifier import classify_error
from open_notebook.utils.text_utils import extract_text_content


class TransformationState(TypedDict):
    input_text: str
    source: Source
    transformation: Transformation
    output: str


async def _invoke_model(chain, system_prompt: str, content: str) -> str:
    """Invoke model and return cleaned text."""
    payload = [SystemMessage(content=system_prompt), HumanMessage(content=content)]
    response = await chain.ainvoke(payload)
    raw = extract_text_content(response.content)
    return clean_thinking_content(raw)


# =============================================================================
# Mind Map
# =============================================================================

_DEFAULT_MINDMAP_PROMPT = """\
You are an expert information architect. Build a comprehensive, deeply structured \
JSON mind map from the document below.

HIERARCHY:
- Level 0 (Root): Subject name/title
- Level 1: Major logical groupings (Personal Profile, Family, Criminal Profile, Legal History, Associates, etc.)
- Level 2: Subcategories grouping related facts
- Level 3+: Atomic facts — one fact per leaf, "Key: Value" format

RULES:
- Capture ALL information from the document — no omission
- If a node has more than 4 direct children, group them under a subcategory first
- Each leaf = exactly ONE fact
- Use ONLY information explicitly present — do NOT infer or hallucinate
- Each fact appears exactly ONCE (no duplication)
- No empty arrays, no null values

OUTPUT: Return ONLY raw valid JSON — no markdown, no explanation, no code fences.
Format:
{
  "label": "Subject Name",
  "children": [
    {
      "label": "Category",
      "children": [
        {
          "label": "Subcategory",
          "children": [
            { "label": "Key: Value" }
          ]
        }
      ]
    }
  ]
}
"""


def _extract_subject(src_text: str) -> str:
    """Extract the primary subject name from the document text."""
    patterns = [
        _re.compile(r'(?:name|subject|accused|suspect|person)\s*[:–\-]\s*(.+)', _re.IGNORECASE),
    ]
    for line in src_text.splitlines():
        line = line.strip()
        if not line or len(line) < 3:
            continue
        for pat in patterns:
            m = pat.search(line)
            if m:
                val = m.group(1).strip()
                if val and len(val) > 2:
                    return val[:100]
        # First non-empty line as fallback
        return line[:100]
    return "Subject"


def _build_system_prompt(user_prompt: str, src_text: str) -> str:
    """
    Build the final system prompt.
    - If user_prompt has {subject}/{context} placeholders, inject real values.
    - If user_prompt is empty, use the default mind map prompt.
    - Always ensure JSON output instruction is present.
    """
    subject = _extract_subject(src_text)
    # context_hint = src_text.strip()[:500].replace("\n", " ")

    if user_prompt and user_prompt.strip():
        system = user_prompt.strip()
        # Inject placeholders if present
        system = system.replace("{subject}", subject)
        system = system.replace("{context}","[See document below]")
    else:
        system = _DEFAULT_MINDMAP_PROMPT

    # Ensure JSON output reminder if not already mentioned
    if "json" not in system.lower():
        system += (
            "\n\nOUTPUT: Return ONLY a valid JSON object:\n"
            '{"label": "<root>", "children": [{"label": "...", "children": [...]}]}\n'
            "No markdown, no explanation, no code fences."
        )

    return system


async def _build_mindmap_from_ai(src_text: str, model_id: str, user_prompt: str) -> dict:
    """
    Build a mind map using the transformation prompt (or default if empty).
    Handles {subject} and {context} placeholder injection.
    """
    from loguru import logger as _logger

    MAX_INPUT = 14000
    if len(src_text) > MAX_INPUT:
        src_text = src_text[:MAX_INPUT] + "\n...[truncated]"

    system = _build_system_prompt(user_prompt, src_text)

    _logger.info(f"[MindMap] system prompt: {len(system)} chars, doc: {len(src_text)} chars")

    chain = await provision_langchain_model(
        system, model_id, "transformation", max_tokens=8000
    )

    # Document goes in HumanMessage — not duplicated in system
    human_content = f"DOCUMENT:\n{src_text}\n\nProduce the JSON mind map now."
    payload = [SystemMessage(content=system), HumanMessage(content=human_content)]
    response = await chain.ainvoke(payload)
    raw_output = clean_thinking_content(extract_text_content(response.content))

    _logger.info(f"[MindMap] raw output: {len(raw_output)} chars")
    _logger.debug(f"[MindMap] preview:\n{raw_output[:600]}")

    return _parse_mindmap_json(raw_output)


def _parse_mindmap_json(raw: str) -> dict:
    """
    Robustly parse model JSON output into a mind map dict.
    Handles: markdown fences, leading prose, trailing commas, truncated JSON.
    """
    from loguru import logger as _logger

    fence_match = _re.search(r"```(?:json)?\s*([\s\S]*?)```", raw, _re.IGNORECASE)
    cleaned = fence_match.group(1).strip() if fence_match else raw.strip()
    cleaned = _re.sub(r"^Here is the JSON mind map:\s*", "", cleaned, flags=_re.IGNORECASE).strip()
    cleaned = _re.sub(r"```(?:json)?\s*", "", cleaned, flags=_re.IGNORECASE).replace("```", "").strip()

    # Skip any leading prose before the first {
    start = cleaned.find("{")
    if start == -1:
        _logger.error(f"[MindMap] No JSON object found. Output:\n{raw[:800]}")
        return _build_fallback_mind_map_from_text(raw, title="Mind Map")

    cleaned = cleaned[start:]

    # Fix trailing commas (common LLM mistake)
    cleaned = _re.sub(r",\s*([}\]])", r"\1", cleaned)

    # Attempt 1: direct parse
    try:
        data = _json.loads(cleaned)
        if isinstance(data, dict) and "label" in data:
            _logger.info("[MindMap] JSON parsed successfully")
            return _sanitize_tree(data)
    except _json.JSONDecodeError as e:
        _logger.warning(f"[MindMap] Direct parse failed: {e}")

    # Attempt 1b: trim an obviously incomplete tail, then rebalance
    try:
        repaired = _repair_truncated_json(cleaned)
        data = _json.loads(repaired)
        if isinstance(data, dict) and "label" in data:
            _logger.info("[MindMap] Repaired parse succeeded")
            return _sanitize_tree(data)
    except Exception as e:
        _logger.warning(f"[MindMap] Repaired parse failed: {e}")

    # Attempt 2: balance unclosed braces (truncated output)
    try:
        balanced = _balance_braces(cleaned)
        data = _json.loads(balanced)
        if isinstance(data, dict) and "label" in data:
            _logger.info("[MindMap] Balanced parse succeeded")
            return _sanitize_tree(data)
    except Exception as e:
        _logger.warning(f"[MindMap] Balanced parse failed: {e}")

    # Attempt 3: trim to last valid }
    try:
        last = cleaned.rfind("}")
        if last > 0:
            data = _json.loads(cleaned[: last + 1])
            if isinstance(data, dict) and "label" in data:
                _logger.info("[MindMap] Trimmed parse succeeded")
                return _sanitize_tree(data)
    except Exception as e:
        _logger.warning(f"[MindMap] Trimmed parse failed: {e}")

    _logger.error(f"[MindMap] All parse attempts failed. Raw:\n{raw[:800]}")
    return _build_fallback_mind_map_from_text(cleaned or raw, title="Mind Map")


def _balance_braces(s: str) -> str:
    """Close any unclosed braces/brackets in a truncated JSON string."""
    stack = []
    in_string = False
    escape = False
    for ch in s:
        if escape:
            escape = False
            continue
        if ch == "\\" and in_string:
            escape = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if not in_string:
            if ch in "{[":
                stack.append("}" if ch == "{" else "]")
            elif ch in "}]" and stack and stack[-1] == ch:
                stack.pop()
    return s + "".join(reversed(stack))


def _repair_truncated_json(s: str) -> str:
    """
    Remove a dangling partial tail and then close any open containers.
    Useful when the model output ends in the middle of a child object.
    """
    repaired = s.strip()
    repaired = _re.sub(r',?\s*"[^"]*"\s*:\s*"?[^"\]}]*$', "", repaired)
    repaired = _re.sub(r',?\s*\{\s*"[^"]*"\s*:\s*"?[^"\]}]*$', "", repaired)

    while repaired and repaired[-1] not in ['}', ']', '"'] and not repaired[-1].isdigit():
        repaired = repaired[:-1].rstrip()

    repaired = _re.sub(r",\s*([}\]])", r"\1", repaired)
    return _balance_braces(repaired)


def _build_fallback_mind_map_from_text(text: str, title: str = "Mind Map") -> dict:
    """
    Build a usable fallback tree from prose or broken JSON instead of saving
    a Parse Error placeholder.
    """
    subject = _extract_subject(text) or title
    lines = []
    for line in text.splitlines():
        cleaned = line.strip(" `\t-")
        if not cleaned:
            continue
        if cleaned.lower().startswith(("here is the json", "json mind map")):
            continue
        if len(cleaned) < 4:
            continue
        lines.append(cleaned)

    children = []
    current_section = None
    current_items = []

    def flush_section():
        nonlocal current_section, current_items
        if current_section and current_items:
            children.append({
                "label": current_section[:120],
                "children": [{"label": item[:120]} for item in current_items[:12]],
            })
        current_section = None
        current_items = []

    for line in lines[:120]:
        if line.startswith(("{", "}", "[", "]")):
            continue
        label_match = _re.search(r'"label"\s*:\s*"([^"]+)"', line)
        if label_match:
            label = label_match.group(1).strip()
            if current_section is None:
                current_section = label
            elif not current_items:
                current_items.append(label)
            else:
                flush_section()
                current_section = label
            continue
        if len(line) > 20:
            current_items.append(line)

    flush_section()

    if not children:
        sentences = [
            s.strip() for s in _re.split(r'(?<=[.!?])\s+', text)
            if len(s.strip()) > 20
        ]
        chunk_size = max(3, len(sentences) // 5) if sentences else 3
        for i in range(0, len(sentences), chunk_size):
            chunk = sentences[i:i + chunk_size]
            children.append({
                "label": f"Section {i // chunk_size + 1}",
                "children": [{"label": s[:120]} for s in chunk],
            })

    return {
        "label": subject[:120] or title,
        "children": children if children else [{"label": "No structured content found"}],
    }


def _sanitize_tree(node: dict, max_label: int = 120) -> dict:
    """Recursively clean labels and drop empty/invalid nodes."""
    label = _re.sub(r"\s+", " ", str(node.get("label", ""))).strip() or "(empty)"
    if len(label) > max_label:
        label = label[:max_label].rsplit(" ", 1)[0].rstrip(".,;:-") + "..."

    result: dict = {"label": label}
    children = node.get("children")
    if isinstance(children, list) and children:
        clean = [
            _sanitize_tree(c, max_label)
            for c in children
            if isinstance(c, dict) and c.get("label")
        ]
        if clean:
            result["children"] = clean
    return result


async def _extract_bank_statement(model_id: str, content: str) -> str:
    """
    Multi-pass bank statement extraction.
    Pass 1: Extract account summary from first chunk.
    Pass 2: Extract transactions from every chunk independently.
    Pass 3: Merge all transaction lists into one JSON.
    """
    import json as _json_local

    CHUNK_SIZE = 8000
    chunks = [
        content[i: i + CHUNK_SIZE].strip()
        for i in range(0, len(content), CHUNK_SIZE)
        if content[i: i + CHUNK_SIZE].strip()
    ] or [content]

    # ── Pass 1: Account summary from first chunk ──────────────────────────
    summary_prompt = """Extract the bank account summary from the text below.
Return ONLY a JSON object like:
{
  "bank_name": "...",
  "account_number": "...",
  "account_holder": "...",
  "address": "...",
  "statement_period": "...",
  "opening_balance": 0.0,
  "closing_balance": 0.0,
  "total_credits": 0.0,
  "total_debits": 0.0
}
Use null for missing fields. Output ONLY the JSON, no explanation.

TEXT:
"""
    chain = await provision_langchain_model(
        summary_prompt + chunks[0], model_id, "transformation", max_tokens=1024
    )
    summary_raw = await _invoke_model(chain, summary_prompt, chunks[0])
    try:
        cleaned = summary_raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        account_summary = _json_local.loads(cleaned)
    except Exception:
        account_summary = {"raw": summary_raw}

    # ── Pass 2: Extract transactions from each chunk ──────────────────────
    txn_prompt = """You are a bank statement parser. Extract EVERY transaction row from the text.

Common bank statement formats:
  DATE  NARRATION/DESCRIPTION  [CHQ/REF NO]  WITHDRAWAL(DR)  DEPOSIT(CR)  BALANCE
  DATE  PARTICULARS  DEBIT  CREDIT  BALANCE
  DATE  DESCRIPTION  AMOUNT  DR/CR  BALANCE

Return ONLY a valid JSON array — no explanation, no markdown, no extra text:
[
  {
    "date": "DD-MM-YYYY",
    "description": "full narration text from the document",
    "cheque_ref": "cheque or reference number, or null",
    "debit": 0.0,
    "credit": 0.0,
    "balance": 0.0
  }
]

STRICT RULES:
1. Copy the EXACT narration/description text from the document — do NOT leave it empty.
2. Every line that starts with a date (DD-MM-YYYY, DD/MM/YYYY, etc.) is a transaction row.
3. If the amount column is labelled DR or Withdrawal put in debit, set credit to 0.
4. If the amount column is labelled CR or Deposit put in credit, set debit to 0.
5. Numbers must be plain floats — NO commas (write 35738.00 not 35,738.00).
6. Do NOT include header rows, opening/closing balance summary rows, or totals rows.
7. Do NOT output placeholder rows like date DD-MM-YYYY — only real data rows.
8. Output ONLY the JSON array starting with [ and ending with ].

TEXT:
"""

    all_transactions: list = []
    for chunk in chunks:
        chain = await provision_langchain_model(
            txn_prompt + chunk, model_id, "transformation", max_tokens=4096
        )
        raw = await _invoke_model(chain, txn_prompt, chunk)
        try:
            cleaned = raw.strip()
            # Strip markdown fences
            if cleaned.startswith("```"):
                cleaned = cleaned.split("```", 2)[-1] if cleaned.count("```") >= 2 else cleaned
                cleaned = cleaned.lstrip("json").strip().rstrip("```").strip()
            # Find JSON array in response
            start = cleaned.find("[")
            end = cleaned.rfind("]") + 1
            if start >= 0 and end > start:
                arr_str = cleaned[start:end]
                # Fix missing commas between objects: }\n{ → },\n{
                import re as _re
                arr_str = _re.sub(r'\}\s*\n\s*\{', '},\n{', arr_str)
                # Fix trailing commas
                arr_str = _re.sub(r',\s*([}\]])', r'\1', arr_str)
                # Fix comma-formatted numbers: 35,738.00 → 35738.00
                arr_str = _re.sub(r':\s*(-?\d{1,3}(?:,\d{3})+(?:\.\d+)?)', lambda m: ': ' + m.group(1).replace(',', ''), arr_str)
                txns = _json_local.loads(arr_str)
                if isinstance(txns, list):
                    # Filter out placeholder/template rows
                    real_txns = [
                        t for t in txns
                        if t.get("date") and t.get("date") not in ("DD-MM-YYYY", "YYYY-MM-DD", "")
                        and (t.get("debit", 0) or t.get("credit", 0) or t.get("balance", 0))
                    ]
                    all_transactions.extend(real_txns)
        except Exception:
            pass  # skip unparseable chunks

    # ── Pass 3: Deduplicate by (date, description, debit, credit) ────────
    seen: set = set()
    unique_txns: list = []
    for tx in all_transactions:
        # Clean numeric fields — remove commas from numbers like "35,738.00"
        for field in ("debit", "credit", "balance"):
            val = tx.get(field)
            if isinstance(val, str):
                try:
                    tx[field] = float(val.replace(",", "").replace("₹", "").strip()) if val.strip() else 0.0
                except ValueError:
                    tx[field] = 0.0
            elif val is None:
                tx[field] = 0.0

        key = (
            str(tx.get("date", "")),
            str(tx.get("description", ""))[:40],
            str(tx.get("debit", 0)),
            str(tx.get("credit", 0)),
        )
        if key not in seen:
            seen.add(key)
            unique_txns.append(tx)

    result = {
        "account_summary": account_summary,
        "transactions": unique_txns,
    }
    return _json_local.dumps(result, ensure_ascii=False, indent=2)


# =============================================================================
# Regular transformations (non-mindmap)
# =============================================================================

async def _run_with_prompt(model_id: str, content: str, transformation_prompt: str, transformation_name: str = "", is_final_transformation: bool = True) -> str:
    """
    Single-pass or chunked transformation using the user's prompt.
    
    Args:
        model_id: Model to use for transformation
        content: Content to transform
        transformation_prompt: Prompt for transformation
        transformation_name: Name of transformation (for detection)
        is_final_transformation: If False, this is an intermediate step (don't save Dense Summary)
    """
    import time as _time
    start_time = _time.time()
    
    # Bank statement needs larger context to capture all transactions in one pass
    CHUNK_SIZE = 12000 if ("bank_name" in transformation_prompt or "transactions" in transformation_prompt) else 15000
    # Dense summary needs more output tokens — detect by name or prompt content
    is_dense = (
        "dense" in transformation_name.lower()
        or "dense" in transformation_prompt.lower()
        or "paragraph" in transformation_prompt.lower()
    )
    # Structured JSON output (infographic, investigation profile, etc.)
    is_structured_json = (
        "document_type" in transformation_prompt
        or "ir_document" in transformation_prompt
        or ("infographic" in transformation_name.lower() and "json" in transformation_prompt.lower())
        or ("investigation" in transformation_name.lower() and "profile" in transformation_name.lower())
    )
    single_max_tokens = 8000 if is_dense else 4096

    if len(content) <= CHUNK_SIZE:
        system = transformation_prompt
        chain = await provision_langchain_model(
            system + content, model_id, "transformation", max_tokens=single_max_tokens
        )
        result = await _invoke_model(chain, system, content)
        elapsed = _time.time() - start_time
        from loguru import logger as _logger
        _logger.info(f"[Transformation] Single-pass completed in {elapsed:.2f}s")
        return result

    chunks = [
        content[i: i + CHUNK_SIZE].strip()
        for i in range(0, len(content), CHUNK_SIZE)
        if content[i: i + CHUNK_SIZE].strip()
    ]

    from loguru import logger as _logger
    _logger.info(f"[Transformation] Processing {len(chunks)} chunks (content size: {len(content)} chars)")

    summaries = []
    # Process chunks in parallel batches of 5 to reduce total time
    import asyncio as _asyncio

    async def _summarise_chunk(chunk: str, chunk_idx: int) -> str:
        chunk_start = _time.time()
        if is_dense:
            # For dense summary: write a detailed paragraph directly from this chunk
            system = (
                "Read the text below and write a detailed, comprehensive paragraph summarizing ALL the information in it. "
                "Include every name, date, location, case number, amount, and event. "
                "Write in flowing prose. Do NOT use bullet points. Do NOT add meta-commentary.\n\nTEXT:\n"
            )
        elif is_structured_json:
            system = (
                f"{transformation_prompt}\n\n"
                "Extract ALL relevant data from the text below as detailed bullet points.\n"
                "For EACH item extract ALL sub-fields:\n"
                "- Associates: name AND their exact relation/role (gang leader, co-accused, family member, etc.)\n"
                "- Timeline events: exact date AND complete event description (what happened, where, who)\n"
                "- Highlights: key finding AND category (Crime/Legal/Personal) AND specific factual detail\n"
                "- Case details: FIR number, IPC section, date, police station name, current status\n"
                "- stat: most important single number (total FIRs, years active, prison time, etc.)\n"
                "CRITICAL: Do NOT leave any sub-field empty. If relation unknown write 'associate'.\n"
                "Do NOT output JSON yet — just extract all facts as bullet points.\n\nTEXT:\n"
            )
        else:
            system = (
                f"{transformation_prompt}\n\n"
                "Extract ONLY the key facts, entities, dates, numbers, and events from the text below. "
                "Output as concise bullet points. Do NOT add commentary, meta-text, or mention 'part' numbers. "
                "Just the facts.\n\nTEXT:\n"
            )
        chain = await provision_langchain_model(
            system + chunk, model_id, "transformation", max_tokens=2048
        )
        result = await _invoke_model(chain, system, chunk)
        chunk_elapsed = _time.time() - chunk_start
        _logger.debug(f"[Transformation] Chunk {chunk_idx+1} completed in {chunk_elapsed:.2f}s")
        return result

    BATCH = 5
    for i in range(0, len(chunks), BATCH):
        batch = chunks[i:i + BATCH]
        batch_start = _time.time()
        results = await _asyncio.gather(*[_summarise_chunk(c, i+j) for j, c in enumerate(batch)])
        summaries.extend(results)
        batch_elapsed = _time.time() - batch_start
        _logger.info(f"[Transformation] Batch {i//BATCH + 1} ({len(batch)} chunks) completed in {batch_elapsed:.2f}s")

    if len(summaries) == 1:
        elapsed = _time.time() - start_time
        _logger.info(f"[Transformation] Completed in {elapsed:.2f}s")
        return summaries[0]

    # For dense summary: join all paragraphs directly — no re-summarization
    # This preserves all details instead of compressing them again
    if is_dense:
        all_paragraphs = "\n\n".join(s.strip() for s in summaries if s.strip())
        # Final pass: clean up duplicates and flow
        dedup_system = (
            f"{transformation_prompt}\n\n"
            "Below are detailed paragraphs extracted from different sections of a document. "
            "Combine them into one flowing, comprehensive summary. "
            "Remove only exact duplicate sentences. Keep ALL unique facts. "
            "Do NOT shorten or compress — preserve every detail. "
            "Do NOT mention 'sections' or 'parts'.\n\nPARAGRAPHS:\n"
        )
        chain = await provision_langchain_model(
            dedup_system + all_paragraphs, model_id, "transformation", max_tokens=8000
        )
        result = await _invoke_model(chain, dedup_system, all_paragraphs)
        elapsed = _time.time() - start_time
        _logger.info(f"[Transformation] Final merge completed in {elapsed:.2f}s")
        return result

    all_facts = "\n\n".join(s for s in summaries if s.strip())

    # For bank statement JSON, merge transaction arrays across chunks
    is_bank_stmt = "transactions" in transformation_prompt and "account_summary" in transformation_prompt

    if is_bank_stmt:
        merge_system = (
            "You are given multiple JSON fragments extracted from parts of a bank statement. "
            "Merge them into ONE valid JSON object with this structure:\n"
            '{"account_summary": {...}, "transactions": [...]}\n'
            "Combine ALL transactions from all parts into a single array. "
            "Use account_summary from the first part that has it. "
            "Output ONLY the merged JSON, no explanation.\n\nFRAGMENTS:\n"
        )
    elif is_structured_json:
        merge_system = (
            f"{transformation_prompt}\n\n"
            "You are given multiple fact lists extracted from different sections of a document.\n"
            "Merge them into ONE complete, valid JSON object following the exact structure above.\n\n"
            "STRICT MERGE RULES:\n"
            "- Concatenate ALL arrays: timeline_events, case_details, associates, highlights\n"
            "- Remove exact duplicate entries only\n"
            "- highlights: EVERY entry MUST have title + subtitle + description - NO empty strings allowed\n"
            "  subtitle = category like 'Crime' or 'Legal' or 'Personal'\n"
            "  description = one specific factual detail about that highlight\n"
            "- associates: EVERY entry MUST have name + relation - if unknown write 'associate'\n"
            "- timeline_events: EVERY entry MUST have date + full event description - NO empty events\n"
            "- case_details: use fields fir_no, section, date, police_station, status\n"
            "- stat.value = total number of FIR cases OR years active (pick most relevant number)\n"
            "- NEVER use empty string, '...', null, or placeholder text anywhere\n"
            "- If a field truly has no data, omit that field entirely\n"
            "Output ONLY valid JSON, no explanation, no markdown.\n\nFACTS:\n"
        )
    elif is_dense:
        merge_system = (
            f"{transformation_prompt}\n\n"
            "Below are facts extracted from different sections of a document. "
            "Write a COMPREHENSIVE, DETAILED summary in flowing paragraphs covering ALL the facts. "
            "CRITICAL: Remove any duplicate sentences — each fact must appear only ONCE. "
            "Do NOT mention 'parts', 'sections', or 'chunks'. "
            "Write as if you read the complete document at once. "
            "Include every name, date, location, case number, and detail.\n\nFACTS:\n"
        )
    else:
        merge_system = (
            f"{transformation_prompt}\n\n"
            "Below are key facts extracted from different sections of a document. "
            "Synthesize them into a single coherent output as instructed above. "
            "Do NOT mention 'parts', 'sections', or 'chunks'. "
            "Write as if you read the whole document at once.\n\nFACTS:\n"
        )

    chain = await provision_langchain_model(
        merge_system + all_facts, model_id, "transformation", max_tokens=8000
    )
    return await _invoke_model(chain, merge_system, all_facts)


# =============================================================================
# Main graph node
# =============================================================================

async def run_transformation(state: dict, config: RunnableConfig) -> dict:
    source_obj = state.get("source")
    source: Source = source_obj if isinstance(source_obj, Source) else None  # type: ignore[assignment]
    content = state.get("input_text")
    assert source or content, "No content to transform"
    transformation: Transformation = state["transformation"]
    # Use model_id from config first, then fall back to transformation's model_id
    model_id = config.get("configurable", {}).get("model_id") or transformation.model_id
    generation_id = config.get("configurable", {}).get("generation_id")

    try:
        # Log the model being used
        from loguru import logger as _logger
        model_name = "default"
        if model_id:
            try:
                from open_notebook.ai.models import Model
                model = await Model.get(model_id)
                if model:
                    model_name = f"{model.name} ({model.provider})"
            except Exception:
                model_name = model_id
        
        _logger.info(f"[Transformation] Running '{transformation.title}' with model: {model_name}")

        t_title = (transformation.title or "").strip().lower()
        t_name  = (transformation.name  or "").strip().lower()
        is_mindmap = (
            t_title == "mind map"
            or t_name  == "mind_map"
            or ("mind" in t_title and "map" in t_title)
            or ("mind" in t_name  and "map" in t_name)
        )

        # ── Mind Map ──────────────────────────────────────────────────────
        if is_mindmap:
            _logger.info(f"[MindMap] title='{transformation.title}' name='{transformation.name}'")

            if not content:
                content = source.full_text if source else ""
            src_text = str(content or "").strip()

            if not src_text:
                mind_map_dict: dict = {"label": "No content", "children": []}
            else:
                mind_map_dict = await _build_mindmap_from_ai(
                    src_text,
                    model_id,
                    transformation.prompt or "",
                )

            final_output = _json.dumps(mind_map_dict, ensure_ascii=False, indent=2)
            _logger.info(f"[MindMap] Done — {len(mind_map_dict.get('children', []))} top-level categories")

            return {"output": final_output}

        # ── All other transformations ─────────────────────────────────────
        if not content:
            content = source.full_text
        content_str = str(content) if content else ""

        default_prompts: DefaultPrompts = await DefaultPrompts.get_instance()
        transformation_prompt = transformation.prompt or ""

        # ── Bank Statement special handling ───────────────────────────────
        # If the transformation is bank-statement type, override with a
        # robust extraction prompt that returns actual data (not a schema).
        is_bank_statement = (
            "bank" in t_title and "statement" in t_title
            or "bank" in t_name  and "statement" in t_name
        )
        if is_bank_statement:
            final_output = await _extract_bank_statement(model_id, content_str)
        else:
            if default_prompts.transformation_instructions:
                transformation_prompt = (
                    f"{default_prompts.transformation_instructions}\n\n{transformation_prompt}"
                )
            final_output = await _run_with_prompt(
                model_id, content_str, transformation_prompt,
                transformation_name=t_name
            )

        return {"output": final_output}

    except OpenNotebookError:
        raise
    except Exception as e:
        error_class, user_message = classify_error(e)
        raise error_class(user_message) from e


agent_state = StateGraph(TransformationState)
agent_state.add_node("agent", run_transformation)  # type: ignore[type-var]
agent_state.add_edge(START, "agent")
agent_state.add_edge("agent", END)
graph = agent_state.compile()
