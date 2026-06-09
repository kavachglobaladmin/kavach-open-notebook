import asyncio
import sqlite3
from typing import Annotated, Any, AsyncIterator, Optional

from ai_prompter import Prompter
from langchain_core.messages import AIMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict

from open_notebook.ai.provision import provision_langchain_model
from open_notebook.config import LANGGRAPH_CHECKPOINT_FILE
from open_notebook.exceptions import OpenNotebookError
from open_notebook.utils import clean_thinking_content
from open_notebook.utils.error_classifier import classify_error
from open_notebook.utils.text_utils import extract_text_content

MAX_SOURCE_TEXT_CHARS = 8000
MAX_NOTE_TEXT_CHARS = 3000


class SuperChatState(TypedDict):
    messages: Annotated[list, add_messages]
    context: Optional[dict[str, Any]]
    model_override: Optional[str]


STRICT_CONTEXT_INSTRUCTION = (
    "You are Chat with Super, a case-wide investigative assistant. "
    "Answer using ONLY the provided aggregated sub-folder context. "
    "Do not use outside knowledge or guess missing facts. "
    "If the answer is not explicitly supported by the context, say that you "
    "could not find it in the selected sub-folder context."
)


def _truncate(text: Optional[str], limit: int) -> str:
    value = (text or "").strip()
    if len(value) <= limit:
        return value
    return f"{value[:limit]}...[truncated]"


def _format_folder_names(related_notebooks: list[dict[str, Any]]) -> str:
    names = [
        notebook.get("name") or notebook.get("id") or "Unknown folder"
        for notebook in related_notebooks
        if isinstance(notebook, dict)
    ]
    return ", ".join(names)


def _render_source(source: dict[str, Any]) -> list[str]:
    title = source.get("title") or source.get("id") or "Untitled source"
    related_notebooks = source.get("notebooks") or []
    notebook_names = _format_folder_names(related_notebooks) if related_notebooks else ""

    # Show "[FolderName] DocumentTitle" so the AI always sees folder context inline
    display_title = f"[{notebook_names}] {title}" if notebook_names else title
    parts = [
        f"- Document: {display_title}",
    ]

    if related_notebooks and notebook_names:
        parts.append(f"  Folder(s): {notebook_names}")

    insights = source.get("insights") or []
    if insights:
        parts.append("  Insights:")
        for insight in insights:
            if not isinstance(insight, dict):
                continue
            insight_type = insight.get("insight_type") or "Insight"
            insight_content = _truncate(insight.get("content"), 1200)
            insight_header = f"  - {insight_type}"
            parts.append(insight_header)
            if insight_content:
                parts.append(f"    {insight_content}")

    full_text = _truncate(source.get("full_text"), MAX_SOURCE_TEXT_CHARS)
    if full_text:
        parts.extend(["  Content:", f"  {full_text}"])

    parts.append("")
    return parts


def _render_note(note: dict[str, Any]) -> list[str]:
    title = note.get("title") or note.get("id") or "Untitled note"
    parts = [
        f"- Note: {title}",
    ]

    related_notebooks = note.get("notebooks") or []
    if related_notebooks:
        notebook_names = _format_folder_names(related_notebooks)
        if notebook_names:
            parts.append(f"  Folder(s): {notebook_names}")

    content = _truncate(note.get("content"), MAX_NOTE_TEXT_CHARS)
    if content:
        parts.extend(["  Content:", f"  {content}"])

    parts.append("")
    return parts


def _format_super_context(context_data: Optional[dict[str, Any]]) -> str:
    if not context_data:
        return ""

    sources = {
        str(source.get("id")): source
        for source in (context_data.get("sources") or [])
        if isinstance(source, dict) and source.get("id")
    }
    notes = {
        str(note.get("id")): note
        for note in (context_data.get("notes") or [])
        if isinstance(note, dict) and note.get("id")
    }
    folder_structure = context_data.get("folder_structure") or []

    import logging as _log
    _log.info(f"[SuperChat] _format_super_context: {len(sources)} sources, {len(notes)} notes, {len(folder_structure)} folders")
    for folder in folder_structure:
        if isinstance(folder, dict):
            fname = folder.get("name") or folder.get("id")
            fsources = folder.get("sources") or []
            has_ctx = folder.get("has_context")
            _log.info(f"[SuperChat]   folder '{fname}': has_context={has_ctx}, {len(fsources)} source_metas")
            for sm in fsources:
                sid = str(sm.get("id") or "") if isinstance(sm, dict) else str(sm)
                matched = sid in sources
                _log.info(f"[SuperChat]     source_meta id='{sid}' matched={matched}")

    rendered_source_ids: set[str] = set()
    rendered_note_ids: set[str] = set()
    parts: list[str] = []

    if folder_structure:
        parts.append("CASE SUB-FOLDER CONTEXT")
        for folder in folder_structure:
            if not isinstance(folder, dict):
                continue
            folder_name = folder.get("name") or folder.get("id") or "Unnamed folder"
            parts.extend(["", f"Sub-folder: {folder_name}"])

            folder_has_context = bool(folder.get("has_context"))
            if not folder_has_context:
                parts.extend(["Status: Not available", ""])
                continue

            parts.append("Status: Context available")

            for source_meta in folder.get("sources") or []:
                if not isinstance(source_meta, dict):
                    continue
                source_id = str(source_meta.get("id") or "")
                source = sources.get(source_id)
                if not source:
                    continue
                rendered_source_ids.add(source_id)
                parts.extend(_render_source(source))

            for note_meta in folder.get("notes") or []:
                if not isinstance(note_meta, dict):
                    continue
                note_id = str(note_meta.get("id") or "")
                note = notes.get(note_id)
                if not note:
                    continue
                rendered_note_ids.add(note_id)
                parts.extend(_render_note(note))

    remaining_sources = [
        source for source_id, source in sources.items() if source_id not in rendered_source_ids
    ]
    remaining_notes = [
        note for note_id, note in notes.items() if note_id not in rendered_note_ids
    ]

    if remaining_sources or remaining_notes:
        parts.extend(["", "ADDITIONAL CASE MATERIAL"])
        for source in remaining_sources:
            parts.extend(_render_source(source))
        for note in remaining_notes:
            parts.extend(_render_note(note))

    rendered = "\n".join(parts).strip()
    # No truncation — pass full context to the model.
    # Modern LLMs (GPT-4o, Claude 3.5, Gemini) handle 128K+ tokens.
    # Hard truncation was silently dropping entire sub-folder sections.
    return rendered


def _build_system_prompt(state: SuperChatState) -> str:
    context_data = state.get("context") or {}
    formatted_context = _format_super_context(context_data)
    prompt_data = {
        "context": formatted_context,
        "folder_structure": context_data.get("folder_structure") or [],
    }
    base_prompt = Prompter(prompt_template="super_chat/system").render(data=prompt_data)
    return f"{STRICT_CONTEXT_INSTRUCTION}\n\n{base_prompt}"


def call_model_with_messages(state: SuperChatState, config: RunnableConfig) -> dict:
    try:
        system_prompt = _build_system_prompt(state)
        payload = [SystemMessage(content=system_prompt)] + state.get("messages", [])
        model_id = config.get("configurable", {}).get("model_id") or state.get(
            "model_override"
        )

        def run_in_new_loop():
            new_loop = asyncio.new_event_loop()
            try:
                asyncio.set_event_loop(new_loop)
                return new_loop.run_until_complete(
                    provision_langchain_model(
                        str(payload), model_id, "chat", max_tokens=500
                    )
                )
            finally:
                new_loop.close()
                asyncio.set_event_loop(None)

        try:
            asyncio.get_running_loop()
            import concurrent.futures

            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(run_in_new_loop)
                model = future.result()
        except RuntimeError:
            model = asyncio.run(
                provision_langchain_model(
                    str(payload),
                    model_id,
                    "chat",
                    max_tokens=500,
                )
            )

        ai_message = model.invoke(payload)
        content = extract_text_content(ai_message.content)
        cleaned_content = clean_thinking_content(content)
        cleaned_message = ai_message.model_copy(update={"content": cleaned_content})
        return {"messages": cleaned_message}
    except OpenNotebookError:
        raise
    except Exception as e:
        error_class, user_message = classify_error(e)
        raise error_class(user_message) from e


async def stream_model_tokens(
    messages: list, model_id: Optional[str], state: SuperChatState
) -> AsyncIterator[str]:
    try:
        system_prompt = _build_system_prompt(state)
        payload = [SystemMessage(content=system_prompt)] + messages

        model = await provision_langchain_model(
            str(payload),
            model_id,
            "chat",
            max_tokens=8192,
        )

        try:
            async for chunk in model.astream(payload):
                if hasattr(chunk, "content"):
                    token = chunk.content
                    if token:
                        cleaned = clean_thinking_content(token)
                        if cleaned:
                            yield cleaned
        except (AttributeError, NotImplementedError):
            def sync_stream():
                for chunk in model.stream(payload):
                    if hasattr(chunk, "content"):
                        token = chunk.content
                        if token:
                            cleaned = clean_thinking_content(token)
                            if cleaned:
                                yield cleaned

            for token in sync_stream():
                yield token

    except OpenNotebookError:
        raise
    except Exception as e:
        error_class, user_message = classify_error(e)
        raise error_class(user_message) from e


conn = sqlite3.connect(
    LANGGRAPH_CHECKPOINT_FILE,
    check_same_thread=False,
)
memory = SqliteSaver(conn)

agent_state = StateGraph(SuperChatState)
agent_state.add_node("agent", call_model_with_messages)
agent_state.add_edge(START, "agent")
agent_state.add_edge("agent", END)
graph = agent_state.compile(checkpointer=memory)
