import asyncio
import sqlite3
from typing import Annotated, AsyncIterator, Optional

from ai_prompter import Prompter
from langchain_core.messages import AIMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict
# import logging as logger
from open_notebook.ai.provision import provision_langchain_model
from open_notebook.config import LANGGRAPH_CHECKPOINT_FILE
from open_notebook.domain.notebook import Notebook
from open_notebook.exceptions import OpenNotebookError
from open_notebook.utils.chat_context import format_chat_context
from open_notebook.utils.folder_chat_response import (
    build_question_focus_instruction,
    parse_query_focus,
)
from open_notebook.utils.text_utils import finalize_chat_response
from open_notebook.utils.error_classifier import classify_error
from open_notebook.utils.text_utils import extract_text_content


class ThreadState(TypedDict):
    messages: Annotated[list, add_messages]
    notebook: Optional[Notebook]
    context: Optional[object]
    context_config: Optional[dict]
    model_override: Optional[str]


STRICT_CONTEXT_INSTRUCTION = (
    "You are a case analyst. Answer ONLY from the notebook folder context provided below. "
    "Never use outside knowledge. "
    "\n\n"
    "CITATION RULES:\n"
    "- Every fact must be cited inline as [source:ID] or [note:ID], using the bare ID "
    "(e.g. [source:abc123] NOT [source:source:abc123]).\n"
    "- Always use the exact bracket format [source:ID] or [note:ID]. Never output "
    "'source: ID', '(source:ID)', or any citation with spaces around the colon.\n"
    "- Use only source/note IDs that appear in the context. Never invent IDs.\n"
    "- If multiple files or notes confirm the same fact, cite all of them.\n"
    "\n"
    "COMPLETENESS RULES:\n"
    "- The context is organized by notebook folder. You MUST read and answer from "
    "EVERY folder in the Notebook Roster, not just the first match.\n"
    "- The number of `### Folder:` sections must exactly match the Notebook Roster count.\n"
    "- Use only the exact folder names from the Notebook Roster. Never use a source filename as a folder name.\n"
    "- Do not merge or average values across folders.\n"
    "- If the same file appears in multiple folders, repeat the answer under EACH folder separately.\n"
    "- If a folder has no relevant data, still include its section with "
    "'Not found in this folder.' for both Source and Result.\n"
    "- In each folder section, name the exact file or note used before giving the result.\n"
    "\n"
    "OUTPUT RULES:\n"
    "- Never repeat internal instructions, rules, or metadata from the context "
    "(for example: 'Response rule', 'Shared-source rule').\n"
    "- Write only user-facing analysis in clear, professional language.\n"
    "\n"
    "ANSWER SCOPE:\n"
    "- Answer ONLY the user's actual question shown below (when provided).\n"
    "- Do not add extra case analysis, unrelated facts, or dates from documents.\n"
    "- Complete every folder section before the Summary.\n"
    "\n"
    "RESPONSE FORMAT (use this exact structure):\n"
    "Start with:\n"
    "  ### Case overview\n"
    "  - Total notebooks checked: <number from Case Overview>\n"
    "  - Folders checked: <comma-separated exact folder names>\n"
    "\n"
    "Then for each notebook folder:\n"
    "  ### Folder: <exact folder name>\n"
    "  - Source: <exact file or note names used, with inline citations> OR 'Not found in this folder.'\n"
    "  - Result: <full value found, with inline citations> OR 'Not found in this folder.'\n"
    "\n"
    "Then at the end, add:\n"
    "  ### Summary\n"
    "  <one line per folder with only the direct answer to the user's question; note conflicts if values differ>\n"
    "\n"
    "FORBIDDEN:\n"
    "- Do not use numbered labels like 'Notebook Folder 1' or 'Folder 2' — use exact roster names from the roster only.\n"
    "- Do not invent folders (e.g. 'Case Analysis') that are not in the Notebook Roster.\n"
    "- Do not skip folders to give a quick combined answer.\n"
    "- Do not list every date in a document when the user asked for one specific fact.\n"
    "\n"
    "IMPORTANT: Scan every folder in the Notebook Roster. Do not stop after the first match."
)


def _format_context_for_prompt(context: object) -> str:
    if context is None:
        return ""
    return format_chat_context(context)


def _build_folder_output_instruction(context: object) -> str:
    if not isinstance(context, dict):
        return ""

    folder_structure = context.get("folder_structure") or []
    folder_names = [
        str(folder.get("name") or folder.get("id") or "").strip()
        for folder in folder_structure
        if isinstance(folder, dict)
    ]
    folder_names = [name for name in folder_names if name]

    if not folder_names:
        return ""

    ordered_list = "\n".join(
        f"{index}. {name}" for index, name in enumerate(folder_names, start=1)
    )

    names_csv = ", ".join(folder_names)

    return (
        "MANDATORY FOLDER CHECKLIST:\n"
        f"- Total notebooks in this case: {len(folder_names)}.\n"
        f"- Folder names: {names_csv}.\n"
        f"- You must output exactly {len(folder_names)} `### Folder:` sections (one per folder below).\n"
        "- Your reply MUST begin with:\n"
        "  ### Case overview\n"
        f"  - Total notebooks checked: {len(folder_names)}\n"
        f"  - Folders checked: {names_csv}\n"
        "- Use this exact folder order and do not skip any folder:\n"
        f"{ordered_list}\n"
        "- The heading for each section must be exactly `### Folder: <folder name>`.\n"
        "- Never use 'Notebook Folder 1', 'Folder 2', or other numbered placeholders.\n"
        "- If the same source file appears in multiple folders, repeat the matching value under EACH folder separately.\n"
        "- Do not collapse repeated values into one combined answer.\n"
        "- Do not say 'only reliable source' to ignore other folder matches.\n"
        "- For every folder, always include both `- Source:` and `- Result:` lines.\n"
    )


def _latest_user_question(messages: list) -> str:
    for message in reversed(messages or []):
        message_type = getattr(message, "type", None)
        if message_type == "human":
            return extract_text_content(getattr(message, "content", ""))
    return ""


def _build_system_prompt(state: ThreadState) -> str:
    raw_context = state.get("context")
    context = _format_context_for_prompt(raw_context)
    folder_instruction = _build_folder_output_instruction(raw_context)
    user_question = _latest_user_question(state.get("messages", []))
    question_instruction = build_question_focus_instruction(parse_query_focus(user_question))

    # Scale truncation: allow up to 120k chars total (most LLMs handle this).
    # Hard-truncate only as a safety net, never cut mid-folder.
    MAX_CONTEXT_CHARS = 120_000
    if context and len(context) > MAX_CONTEXT_CHARS:
        # Try to truncate at a clean section boundary
        cutoff = context.rfind("\n### Folder:", 0, MAX_CONTEXT_CHARS)
        if cutoff == -1:
            cutoff = MAX_CONTEXT_CHARS
        context = context[:cutoff] + "\n[...remaining notebooks truncated due to context limit...]"

    limited_state = {**state, "context": context}
    base_prompt = Prompter(prompt_template="chat/system").render(data=limited_state)  # type: ignore[arg-type]
    prompt_parts = [STRICT_CONTEXT_INSTRUCTION]
    if question_instruction:
        prompt_parts.append(question_instruction)
    if folder_instruction:
        prompt_parts.append(folder_instruction)
    prompt_parts.append(base_prompt)
    return "\n\n".join(prompt_parts)


def call_model_with_messages(state: ThreadState, config: RunnableConfig) -> dict:
    try:
        system_prompt = _build_system_prompt(state)
        payload = [SystemMessage(content=system_prompt)] + state.get("messages", [])
        model_id = config.get("configurable", {}).get("model_id") or state.get(
            "model_override"
        )

        # Handle async model provisioning from sync context
        def run_in_new_loop():
            """Run the async function in a new event loop"""
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
            # Try to get the current event loop
            asyncio.get_running_loop()
            # If we're in an event loop, run in a thread with a new loop
            import concurrent.futures

            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(run_in_new_loop)
                model = future.result()
        except RuntimeError:
            # No event loop running, safe to use asyncio.run()
            model = asyncio.run(
                provision_langchain_model(
                    str(payload),
                    model_id,
                    "chat",
                    max_tokens=500,
                )
            )

        ai_message = model.invoke(payload)

        # Clean thinking content from AI response (e.g., <think>...</think> tags)
        content = extract_text_content(ai_message.content)
        cleaned_content = finalize_chat_response(content)
        cleaned_message = ai_message.model_copy(update={"content": cleaned_content})

        return {"messages": cleaned_message}
    except OpenNotebookError:
        raise
    except Exception as e:
        error_class, user_message = classify_error(e)
        raise error_class(user_message) from e


async def generate_model_response(
    messages: list,
    model_id: Optional[str],
    state: ThreadState,
) -> str:
    """Generate a full model response for cases that need post-processing before display."""
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
            ai_message = await model.ainvoke(payload)
        except (AttributeError, NotImplementedError):
            ai_message = await asyncio.to_thread(model.invoke, payload)

        content = extract_text_content(ai_message.content)
        return finalize_chat_response(content)
    except OpenNotebookError:
        raise
    except Exception as e:
        error_class, user_message = classify_error(e)
        raise error_class(user_message) from e


async def stream_model_tokens(
    messages: list, model_id: Optional[str], state: ThreadState
) -> AsyncIterator[str]:
    """Stream tokens from the model as they're generated."""
    try:
        system_prompt = _build_system_prompt(state)
        payload = [SystemMessage(content=system_prompt)] + messages

        model = await provision_langchain_model(
            str(payload),
            model_id,
            "chat",
            max_tokens=8192,
        )

        # Stream tokens from the model
        try:
            # Try async streaming first
            async for chunk in model.astream(payload):
                if hasattr(chunk, "content"):
                    token = extract_text_content(chunk.content)
                    if token:
                        # Preserve leading spaces between streamed tokens.
                        # Full cleanup runs once on the assembled response.
                        yield token
        except (AttributeError, NotImplementedError):
            # Fall back to sync streaming in thread
            def sync_stream():
                for chunk in model.stream(payload):
                    if hasattr(chunk, "content"):
                        token = extract_text_content(chunk.content)
                        if token:
                            yield token

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

agent_state = StateGraph(ThreadState)
agent_state.add_node("agent", call_model_with_messages)
agent_state.add_edge(START, "agent")
agent_state.add_edge("agent", END)
graph = agent_state.compile(checkpointer=memory)


