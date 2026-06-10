"""Surreal-commands integration for Open Notebook"""

from .embedding_commands import (
    embed_insight_command,
    embed_note_command,
    embed_source_command,
    rebuild_embeddings_command,
)
from .example_commands import analyze_data_command, process_text_command
from .podcast_commands import generate_podcast_command
from .source_commands import process_source_command, run_transformation_command

__all__ = [
    # Embedding commands
    "embed_note_command",
    "embed_insight_command",
    "embed_source_command",
    "rebuild_embeddings_command",
    # Other commands
    "generate_podcast_command",
    "process_source_command",
    "run_transformation_command",
    "process_text_command",
    "analyze_data_command",
]


def fix_stuck_commands_sync():
    """
    Fix commands stuck in 'running' state from a previous worker session.
    Called at worker startup to prevent re-execution of already-completed commands.
    """
    import asyncio
    from loguru import logger

    async def _fix():
        try:
            from open_notebook.database.repository import repo_query, ensure_record_id
            stuck = await repo_query(
                "SELECT id, result FROM command WHERE status = 'running'"
            )
            fixed = 0
            for cmd in (stuck or []):
                res = cmd.get("result") or {}
                if res.get("execution_time") is not None and res.get("success") is True:
                    await repo_query(
                        "UPDATE $rid SET status = 'completed'",
                        {"rid": ensure_record_id(str(cmd["id"]))},
                    )
                    fixed += 1
            if fixed:
                logger.info(f"[Worker startup] Fixed {fixed} stuck 'running' command(s)")
        except Exception as e:
            logger.warning(f"[Worker startup] Could not fix stuck commands: {e}")

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(_fix())
        else:
            loop.run_until_complete(_fix())
    except Exception:
        asyncio.run(_fix())


# Auto-fix stuck commands when this module is imported by the worker
try:
    fix_stuck_commands_sync()
except Exception:
    pass  # Non-fatal — worker will still start
