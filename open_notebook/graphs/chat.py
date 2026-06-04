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
from open_notebook.utils import clean_thinking_content
from open_notebook.utils.error_classifier import classify_error
from open_notebook.utils.text_utils import extract_text_content


class ThreadState(TypedDict):
    messages: Annotated[list, add_messages]
    notebook: Optional[Notebook]
    context: Optional[str]
    context_config: Optional[dict]
    model_override: Optional[str]


STRICT_CONTEXT_INSTRUCTION = (
    "Answer using ONLY the notebook folders/files in the provided context. "
    "Do not use outside knowledge or guesswork. "
    "If the answer is not explicitly supported by the context, say that you "
    "could not find it in the selected folders/files."
)


def _build_system_prompt(state: ThreadState) -> str:
    context = state.get("context", "") or ""
    if context and len(context) > 1000:
        context = context[:1000] + "...[truncated]"

    limited_state = {**state, "context": context}
    base_prompt = Prompter(prompt_template="chat/system").render(data=limited_state)  # type: ignore[arg-type]
    return f"{STRICT_CONTEXT_INSTRUCTION}\n\n{base_prompt}"


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
        cleaned_content = clean_thinking_content(content)
        cleaned_message = ai_message.model_copy(update={"content": cleaned_content})

        return {"messages": cleaned_message}
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
                    token = chunk.content
                    if token:  # Only yield non-empty tokens
                        # Clean thinking tags as we stream
                        cleaned = clean_thinking_content(token)
                        if cleaned:
                            yield cleaned
        except (AttributeError, NotImplementedError):
            # Fall back to sync streaming in thread
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

agent_state = StateGraph(ThreadState)
agent_state.add_node("agent", call_model_with_messages)
agent_state.add_edge(START, "agent")
agent_state.add_edge("agent", END)
graph = agent_state.compile(checkpointer=memory)


