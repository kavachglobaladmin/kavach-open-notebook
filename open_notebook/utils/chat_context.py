from __future__ import annotations

import json
from typing import Any


def truncate_context_text(text: str, limit: int = 40000) -> str:
    cleaned = (text or "").strip()
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[:limit] + "\n[Content truncated to keep the chat context readable.]"


def _normalize_text(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def _folder_bucket_id(folder: dict[str, Any]) -> str:
    return _normalize_text(folder.get("id")) or "unknown-notebook"


def _lookup_source_by_id(
    source_by_id: dict[str, dict[str, Any]],
    raw_id: str,
) -> dict[str, Any] | None:
    bare_id = _canonical_record_id(raw_id, "source")
    if bare_id in source_by_id:
        return source_by_id[bare_id]
    prefixed = f"source:{bare_id}" if bare_id else ""
    if prefixed in source_by_id:
        return source_by_id[prefixed]
    return None


def _canonical_record_id(value: str, record_type: str) -> str:
    cleaned = _normalize_text(value)
    if not cleaned:
        return ""
    if record_type == "source":
        return cleaned.removeprefix("source:") if cleaned.startswith("source:") else cleaned
    if record_type == "note":
        return cleaned.removeprefix("note:") if cleaned.startswith("note:") else cleaned
    for prefix in ("source:", "note:"):
        if cleaned.startswith(prefix):
            return cleaned.removeprefix(prefix)
    return cleaned


def _notebook_aliases(folder: dict[str, Any]) -> set[str]:
    aliases: set[str] = set()

    folder_id = _normalize_text(folder.get("id"))
    folder_name = _normalize_text(folder.get("name"))

    if folder_id:
        aliases.add(folder_id.lower())
        if folder_id.lower().startswith("notebook:"):
            aliases.add(folder_id.lower().removeprefix("notebook:"))
    if folder_name:
        aliases.add(folder_name.lower())

    return aliases


def _related_notebook_aliases(item: dict[str, Any]) -> set[str]:
    aliases: set[str] = set()
    related_notebooks = item.get("notebooks") or []

    for notebook in related_notebooks:
        if not isinstance(notebook, dict):
            continue

        notebook_id = _normalize_text(notebook.get("id"))
        notebook_name = _normalize_text(notebook.get("name"))

        if notebook_id:
            aliases.add(notebook_id.lower())
            if notebook_id.lower().startswith("notebook:"):
                aliases.add(notebook_id.lower().removeprefix("notebook:"))
        if notebook_name:
            aliases.add(notebook_name.lower())

    return aliases


def _render_source_block(
    source: dict[str, Any],
    max_content_chars: int = 8000,
    max_insight_chars: int = 1000,
) -> list[str]:
    lines: list[str] = []
    source_title = _normalize_text(source.get("title")) or _normalize_text(source.get("id")) or "Untitled source"
    raw_id = _normalize_text(source.get("id")) or "unknown-source"
    # Normalise to bare ID (strip "source:" prefix to avoid "source:source:xxx")
    bare_id = raw_id.removeprefix("source:") if raw_id.startswith("source:") else raw_id
    notebook_names = ", ".join(
        _normalize_text(notebook.get("name")) or _normalize_text(notebook.get("id")) or "Unknown"
        for notebook in source.get("notebooks") or []
        if isinstance(notebook, dict)
    )

    lines.append(f"- {source_title} [source:{bare_id}]")
    if notebook_names:
        lines.append(f"  - Notebook folders: {notebook_names}")

    source_content = source.get("full_text") or source.get("content") or source.get("chunk")
    if source_content:
        lines.append(f"  - Content:\n{truncate_context_text(str(source_content), max_content_chars)}")

    insights = source.get("insights") or []
    if insights:
        lines.append("  - Insights:")
        for insight in insights:
            if isinstance(insight, dict):
                insight_text = insight.get("content") or insight.get("text") or ""
                if insight_text:
                    lines.append(f"    - {truncate_context_text(str(insight_text), max_insight_chars)}")

    return lines


def _render_note_block(
    note: dict[str, Any],
    max_content_chars: int = 4000,
) -> list[str]:
    lines: list[str] = []
    note_title = _normalize_text(note.get("title")) or _normalize_text(note.get("id")) or "Untitled note"
    raw_id = _normalize_text(note.get("id")) or "unknown-note"
    bare_id = raw_id.removeprefix("note:") if raw_id.startswith("note:") else raw_id
    notebook_names = ", ".join(
        _normalize_text(notebook.get("name")) or _normalize_text(notebook.get("id")) or "Unknown"
        for notebook in note.get("notebooks") or []
        if isinstance(notebook, dict)
    )

    lines.append(f"- {note_title} [note:{bare_id}]")
    if notebook_names:
        lines.append(f"  - Notebook folders: {notebook_names}")

    note_text = note.get("content") or note.get("full_text")
    if note_text:
        lines.append(f"  - Content:\n{truncate_context_text(str(note_text), max_content_chars)}")

    return lines


def format_chat_context(context: Any) -> str:
    if isinstance(context, str):
        return context

    if not isinstance(context, dict):
        return str(context)

    folder_structure = context.get("folder_structure") or []
    sources = context.get("sources") or []
    notes = context.get("notes") or []
    folder_summary = context.get("folder_summary") or ""
    summary_lines: list[str] = []

    # Scale per-source content limit based on how many sources we have
    # so 50+ sources don't overwhelm the context window
    total_sources = max(len(sources), 1)
    # At 1 source: 8000 chars. At 50 sources: ~1600 chars. Floor at 600.
    chars_per_source = max(600, min(8000, 80_000 // total_sources))
    chars_per_insight = max(300, min(1000, 30_000 // total_sources))

    if folder_summary:
        summary_lines.append("## Folder Summary")
        summary_lines.append(str(folder_summary).strip())
        summary_lines.append("")

    if folder_structure:
        notebook_sources: dict[str, list[dict[str, Any]]] = {}
        notebook_notes: dict[str, list[dict[str, Any]]] = {}
        notebook_lookup: dict[str, dict[str, Any]] = {}

        for folder in folder_structure:
            if not isinstance(folder, dict):
                continue

            folder_id = _normalize_text(folder.get("id")) or "unknown-notebook"
            folder_name = _normalize_text(folder.get("name")) or folder_id or "Unnamed folder"
            aliases = _notebook_aliases(folder)
            notebook_lookup[folder_id.lower()] = folder
            notebook_lookup[folder_name.lower()] = folder
            if folder_id.lower().startswith("notebook:"):
                notebook_lookup[folder_id.lower().removeprefix("notebook:")] = folder
            for alias in aliases:
                notebook_lookup.setdefault(alias, folder)
            notebook_sources[folder_id] = []
            notebook_notes[folder_id] = []

        unassigned_sources: list[dict[str, Any]] = []
        unassigned_notes: list[dict[str, Any]] = []

        source_by_id: dict[str, dict[str, Any]] = {}
        for source in sources:
            if not isinstance(source, dict):
                continue
            source_id = _canonical_record_id(str(source.get("id") or ""), "source")
            if source_id:
                source_by_id[source_id] = source

        note_by_id: dict[str, dict[str, Any]] = {}
        for note in notes:
            if not isinstance(note, dict):
                continue
            note_id = _canonical_record_id(str(note.get("id") or ""), "note")
            if note_id:
                note_by_id[note_id] = note

        def _item_key(item: dict[str, Any]) -> str:
            return _normalize_text(item.get("id")).lower()

        def _append_unique_item(
            bucket: dict[str, list[dict[str, Any]]],
            folder_id: str,
            item: dict[str, Any],
        ) -> None:
            existing_items = bucket.setdefault(folder_id, [])
            item_id = _item_key(item)
            if not item_id or any(_item_key(existing) == item_id for existing in existing_items):
                return
            existing_items.append(item)

        for source in sources:
            if not isinstance(source, dict):
                continue

            related_aliases = _related_notebook_aliases(source)
            matched_folder_ids: set[str] = set()
            for alias in related_aliases:
                folder = notebook_lookup.get(alias)
                if not folder:
                    continue
                folder_id = _normalize_text(folder.get("id")) or "unknown-notebook"
                if folder_id in matched_folder_ids:
                    continue
                matched_folder_ids.add(folder_id)
                _append_unique_item(notebook_sources, folder_id, source)
            if not matched_folder_ids:
                unassigned_sources.append(source)

        for note in notes:
            if not isinstance(note, dict):
                continue

            related_aliases = _related_notebook_aliases(note)
            matched_folder_ids: set[str] = set()
            for alias in related_aliases:
                folder = notebook_lookup.get(alias)
                if not folder:
                    continue
                folder_id = _normalize_text(folder.get("id")) or "unknown-notebook"
                if folder_id in matched_folder_ids:
                    continue
                matched_folder_ids.add(folder_id)
                _append_unique_item(notebook_notes, folder_id, note)
            if not matched_folder_ids:
                unassigned_notes.append(note)

        # Also honour folder_structure membership from the frontend/API so every
        # sub-folder is searchable even when notebook metadata is incomplete.
        for folder in folder_structure:
            if not isinstance(folder, dict):
                continue
            folder_id = _normalize_text(folder.get("id")) or "unknown-notebook"
            for folder_source in folder.get("sources") or []:
                if not isinstance(folder_source, dict):
                    continue
                source = _lookup_source_by_id(
                    source_by_id,
                    str(folder_source.get("id") or ""),
                )
                if source:
                    _append_unique_item(notebook_sources, folder_id, source)
            for folder_note in folder.get("notes") or []:
                if not isinstance(folder_note, dict):
                    continue
                note_id = _canonical_record_id(str(folder_note.get("id") or ""), "note")
                note = note_by_id.get(note_id)
                if note:
                    _append_unique_item(notebook_notes, folder_id, note)

        roster_folder_names = [
            str(folder.get("name") or folder.get("id") or "").strip()
            for folder in folder_structure
            if isinstance(folder, dict)
        ]
        roster_folder_names = [name for name in roster_folder_names if name]

        summary_lines.append("## Case Overview")
        summary_lines.append(
            f"- Total notebook folders in this case: {len(roster_folder_names)}"
        )
        if roster_folder_names:
            summary_lines.append(
                f"- Folder names (you must answer every one): {', '.join(roster_folder_names)}"
            )
        summary_lines.append(
            "- Your reply must start with `### Case overview` listing this total and these names."
        )
        summary_lines.append("")

        summary_lines.append("## Notebook Roster")
        for index, folder in enumerate(folder_structure, start=1):
            if not isinstance(folder, dict):
                continue

            folder_name = folder.get("name") or folder.get("id") or "Unnamed folder"
            folder_id = _folder_bucket_id(folder)
            folder_ref = (
                folder_id if str(folder_id).startswith("notebook:") else f"notebook:{folder_id}"
            )
            matched_sources = notebook_sources.get(folder_id, [])
            matched_notes = notebook_notes.get(folder_id, [])

            summary_lines.append(
                f"{index}. {folder_name} [{folder_ref}] - "
                f"{len(matched_sources)} sources, {len(matched_notes)} notes"
            )

        summary_lines.append("")
        summary_lines.append("## Folder Details")
        for index, folder in enumerate(folder_structure, start=1):
            if not isinstance(folder, dict):
                continue

            folder_name = folder.get("name") or folder.get("id") or "Unnamed folder"
            folder_id = _folder_bucket_id(folder)
            folder_sources = notebook_sources.get(folder_id, [])
            folder_notes = notebook_notes.get(folder_id, [])

            summary_lines.append(f"### Folder: {folder_name}")
            summary_lines.append(f"- Folder ID: {folder_id}")

            if folder_sources:
                summary_lines.append("- Sources:")
                for source in folder_sources:
                    summary_lines.extend(
                        f"  {line}" if not line.startswith("- ") else f"  {line}"
                        for line in _render_source_block(
                            source,
                            max_content_chars=chars_per_source,
                            max_insight_chars=chars_per_insight,
                        )
                    )
            else:
                summary_lines.append("- Sources: none")

            if folder_notes:
                summary_lines.append("- Notes:")
                for note in folder_notes:
                    summary_lines.extend(
                        f"  {line}" if not line.startswith("- ") else f"  {line}"
                        for line in _render_note_block(note, max_content_chars=chars_per_source)
                    )
            else:
                summary_lines.append("- Notes: none")

            summary_lines.append("")

        if unassigned_sources or unassigned_notes:
            summary_lines.append("## Unassigned Context")
            if unassigned_sources:
                summary_lines.append("- Sources:")
                for source in unassigned_sources:
                    summary_lines.extend(
                        f"  {line}" if not line.startswith("- ") else f"  {line}"
                        for line in _render_source_block(
                            source,
                            max_content_chars=chars_per_source,
                            max_insight_chars=chars_per_insight,
                        )
                    )
            if unassigned_notes:
                summary_lines.append("- Notes:")
                for note in unassigned_notes:
                    summary_lines.extend(
                        f"  {line}" if not line.startswith("- ") else f"  {line}"
                        for line in _render_note_block(note, max_content_chars=chars_per_source)
                    )

    elif sources:
        summary_lines.append("## Source Context")
        for source in sources:
            if not isinstance(source, dict):
                continue

            raw_source_id = source.get("id") or "unknown-source"
            bare_source_id = raw_source_id.removeprefix("source:") if raw_source_id.startswith("source:") else raw_source_id
            source_title = source.get("title") or "Untitled source"
            summary_lines.append(f"### Source: {source_title}")
            summary_lines.append(f"- ID: source:{bare_source_id}")

            related_notebooks = source.get("notebooks") or []
            if related_notebooks:
                notebook_names = ", ".join(
                    notebook.get("name", "Unknown")
                    for notebook in related_notebooks
                    if isinstance(notebook, dict)
                )
                if notebook_names:
                    summary_lines.append(f"- Notebook folders: {notebook_names}")

            insights = source.get("insights") or []
            if insights:
                summary_lines.append("- Insights:")
                for insight in insights:
                    if isinstance(insight, dict):
                        insight_text = insight.get("content") or insight.get("text") or ""
                        if insight_text:
                            summary_lines.append(
                                f"  - {truncate_context_text(str(insight_text), chars_per_insight)}"
                            )

            source_text = source.get("full_text") or source.get("content") or source.get("chunk")
            if source_text:
                summary_lines.append(f"- Content:\n{truncate_context_text(str(source_text), chars_per_source)}")
            summary_lines.append("")

    if notes:
        summary_lines.append("## Note Context")
        for note in notes:
            if not isinstance(note, dict):
                continue

            raw_note_id = note.get("id") or "unknown-note"
            bare_note_id = raw_note_id.removeprefix("note:") if raw_note_id.startswith("note:") else raw_note_id
            note_title = note.get("title") or "Untitled note"
            summary_lines.append(f"### Note: {note_title}")
            summary_lines.append(f"- ID: note:{bare_note_id}")

            related_notebooks = note.get("notebooks") or []
            if related_notebooks:
                notebook_names = ", ".join(
                    notebook.get("name", "Unknown")
                    for notebook in related_notebooks
                    if isinstance(notebook, dict)
                )
                if notebook_names:
                    summary_lines.append(f"- Notebook folders: {notebook_names}")

            note_text = note.get("content") or note.get("full_text")
            if note_text:
                summary_lines.append(f"- Content:\n{truncate_context_text(str(note_text), chars_per_source)}")
            summary_lines.append("")

    if not summary_lines:
        return json.dumps(context, indent=2, default=str)

    return "\n".join(summary_lines).strip()
