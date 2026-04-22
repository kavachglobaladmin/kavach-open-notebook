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

    # Strip markdown fences
    cleaned = _re.sub(r"```(?:json)?\s*", "", raw).replace("```", "").strip()

    # Skip any leading prose before the first {
    start = cleaned.find("{")
    if start == -1:
        _logger.error(f"[MindMap] No JSON object found. Output:\n{raw[:800]}")
        return {"label": "Parse Error", "children": [{"label": "No JSON in model output"}]}

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
    return {"label": "Parse Error", "children": [{"label": "JSON parse failed — see logs"}]}


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


# =============================================================================
# Regular transformations (non-mindmap)
# =============================================================================

async def _run_with_prompt(model_id: str, content: str, transformation_prompt: str) -> str:
    """Single-pass or chunked transformation using the user's prompt."""
    CHUNK_SIZE = 6000

    if len(content) <= CHUNK_SIZE:
        system = transformation_prompt
        chain = await provision_langchain_model(
            system + content, model_id, "transformation", max_tokens=4096
        )
        return await _invoke_model(chain, system, content)

    chunks = [
        content[i: i + CHUNK_SIZE].strip()
        for i in range(0, len(content), CHUNK_SIZE)
        if content[i: i + CHUNK_SIZE].strip()
    ]

    summaries = []
    for idx, chunk in enumerate(chunks):
        system = (
            f"{transformation_prompt}\n\n"
            f"This is part {idx + 1} of {len(chunks)}. "
            "Extract all key facts, names, dates, events, and details. "
            "Be exhaustive. Use bullet points."
        )
        chain = await provision_langchain_model(
            system + chunk, model_id, "transformation", max_tokens=2048
        )
        summaries.append(await _invoke_model(chain, system, chunk))

    if len(summaries) == 1:
        return summaries[0]

    all_facts = "\n\n".join(f"[Part {i+1}]\n{s}" for i, s in enumerate(summaries))
    system = (
        f"{transformation_prompt}\n\n"
        "Combine the extracted facts below into one coherent output. "
        "No repetition. Be comprehensive.\n\nEXTRACTED FACTS:\n"
    )
    chain = await provision_langchain_model(
        system + all_facts, model_id, "transformation", max_tokens=4096
    )
    return await _invoke_model(chain, system, all_facts)


# =============================================================================
# Main graph node
# =============================================================================

async def run_transformation(state: dict, config: RunnableConfig) -> dict:
    source_obj = state.get("source")
    source: Source = source_obj if isinstance(source_obj, Source) else None  # type: ignore[assignment]
    content = state.get("input_text")
    assert source or content, "No content to transform"
    transformation: Transformation = state["transformation"]
    model_id = config.get("configurable", {}).get("model_id")

    try:
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
            from loguru import logger as _logger

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

            if source:
                await source.add_insight(transformation.title, final_output)

            return {"output": final_output}

        # ── All other transformations ─────────────────────────────────────
        if not content:
            content = source.full_text
        content_str = str(content) if content else ""

        default_prompts: DefaultPrompts = await DefaultPrompts.get_instance()
        transformation_prompt = transformation.prompt or ""
        if default_prompts.transformation_instructions:
            transformation_prompt = (
                f"{default_prompts.transformation_instructions}\n\n{transformation_prompt}"
            )

        final_output = await _run_with_prompt(model_id, content_str, transformation_prompt)

        if source:
            await source.add_insight(transformation.title, final_output)

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
