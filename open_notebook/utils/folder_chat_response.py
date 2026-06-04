from __future__ import annotations

import re
from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Any

import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize


def _load_stopwords(language: str = "english") -> set[str]:
    try:
        return set(stopwords.words(language))
    except LookupError:
        nltk.download("stopwords")
        return set(stopwords.words(language))


def _safe_word_tokenize(text: str) -> list[str]:
    try:
        return word_tokenize(text)
    except LookupError:
        nltk.download("punkt")
        return word_tokenize(text)
    except Exception:
        return re.findall(r"[A-Za-z0-9]+", text or "")


_NLP_STOPWORDS = _load_stopwords()


@dataclass(frozen=True)
class QueryFocus:
    raw_question: str
    subject_terms: tuple[str, ...]
    focus_terms: tuple[str, ...]
    focus_phrase: str


def _normalize_text(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def _tokenize(text: str) -> list[str]:
    return [
        token.lower()
        for token in _safe_word_tokenize(text or "")
        if re.fullmatch(r"[A-Za-z0-9]+", token)
    ]


def _content_terms(text: str) -> tuple[str, ...]:
    return tuple(
        dict.fromkeys(
            token
            for token in _tokenize(text)
            if token not in _NLP_STOPWORDS and len(token) > 1
        )
    )


def _clean_line(line: str) -> str:
    return re.sub(r"\s+", " ", (line or "").strip())


def _clean_extracted_value(value: str) -> str:
    cleaned = (value or "").strip()
    cleaned = cleaned.strip("|").strip()
    cleaned = re.sub(r"\s*\|\s*", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned)
    cleaned = re.sub(r"^-{2,}$", "", cleaned)
    return cleaned.strip(" :-")


def _dynamic_question_core(question: str) -> str:
    cleaned = re.sub(r"[?.!,]+$", "", (question or "").strip())
    tokens = _tokenize(cleaned)

    while tokens and tokens[0] in _NLP_STOPWORDS:
        tokens.pop(0)

    return " ".join(tokens).strip() or cleaned


def _dynamic_split_index(tokens: list[str]) -> int:
    if len(tokens) < 3:
        return -1

    candidate_indexes: list[tuple[int, int]] = []

    for index in range(1, len(tokens) - 1):
        token = tokens[index]

        if token not in _NLP_STOPWORDS:
            continue

        left_terms = [
            term for term in tokens[:index]
            if term not in _NLP_STOPWORDS and len(term) > 1
        ]
        right_terms = [
            term for term in tokens[index + 1:]
            if term not in _NLP_STOPWORDS and len(term) > 1
        ]

        if not left_terms or not right_terms:
            continue

        score = len(left_terms) + len(right_terms)

        if len(left_terms) <= len(right_terms):
            score += 2

        if index >= 1:
            score += 1

        candidate_indexes.append((score, index))

    if not candidate_indexes:
        return -1

    return sorted(candidate_indexes, key=lambda item: (-item[0], item[1]))[0][1]


def _split_focus_subject(question: str) -> tuple[str, tuple[str, ...], tuple[str, ...]]:
    core = _dynamic_question_core(question)
    tokens = _tokenize(core)
    terms = _content_terms(core)

    if not terms:
        return "requested detail", (), ()

    split_index = _dynamic_split_index(tokens)

    if split_index > 0 and split_index < len(tokens) - 1:
        focus_phrase = " ".join(tokens[:split_index])
        subject_phrase = " ".join(tokens[split_index + 1:])

        focus_terms = _content_terms(focus_phrase)
        subject_terms = _content_terms(subject_phrase)

        if focus_terms:
            return focus_phrase, subject_terms, focus_terms

    if len(terms) == 1:
        return terms[0], (), terms

    if len(terms) == 2:
        return terms[0], (terms[1],), (terms[0],)

    focus_terms = terms[:-1]
    subject_terms = (terms[-1],)
    focus_phrase = " ".join(focus_terms)

    return focus_phrase, subject_terms, focus_terms


def parse_query_focus(question: str) -> QueryFocus:
    raw = (question or "").strip()
    focus_phrase, subject_terms, focus_terms = _split_focus_subject(raw)

    if not focus_terms:
        focus_terms = _content_terms(raw)

    return QueryFocus(
        raw_question=raw,
        subject_terms=subject_terms,
        focus_terms=focus_terms,
        focus_phrase=focus_phrase.strip() or "requested detail",
    )


def build_question_focus_instruction(query_focus: QueryFocus | str) -> str:
    if isinstance(query_focus, str):
        query_focus = parse_query_focus(query_focus)

    if not query_focus.raw_question:
        return ""

    subject_hint = (
        ", ".join(query_focus.subject_terms)
        if query_focus.subject_terms
        else "the person or topic in the question"
    )

    focus_hint = query_focus.focus_phrase or "the requested detail"

    lines = [
        "USER QUESTION (answer ONLY this - do not add other analysis):",
        query_focus.raw_question,
        f"- Focus on this requested detail only: {focus_hint}",
        f"- Subject or topic to verify: {subject_hint}",
        "- Use only facts from the provided context that directly answer this question.",
        "- Do not invent folder names - use only names from the Notebook Roster.",
        "- Ignore unrelated fields, other details blocks, table headers, and metadata.",
        "- If you cannot find the requested detail in one folder, say `Not found in this folder.` for that folder only.",
        "- In ### Summary, restate only the requested detail per folder in one short line each.",
    ]

    return "\n".join(lines)


def iter_response_stream_chunks(text: str, chunk_size: int = 140) -> list[str]:
    if not text:
        return []

    return [
        text[offset: offset + chunk_size]
        for offset in range(0, len(text), chunk_size)
    ]


def _bare_record_id(value: str, prefix: str) -> str:
    cleaned = _normalize_text(value)
    return cleaned.removeprefix(f"{prefix}:") if cleaned.startswith(f"{prefix}:") else cleaned


def _expected_folder_names(folder_structure: list[dict[str, Any]]) -> list[str]:
    return [
        _folder_name(folder)
        for folder in folder_structure
        if isinstance(folder, dict) and _folder_name(folder)
    ]


def _source_text_blob(source: dict[str, Any]) -> str:
    parts: list[str] = []

    for key, value in source.items():
        if isinstance(value, str) and value.strip():
            parts.append(value)

        if isinstance(value, list):
            for item in value:
                if isinstance(item, dict):
                    for nested_value in item.values():
                        if isinstance(nested_value, str) and nested_value.strip():
                            parts.append(nested_value)

    return "\n".join(dict.fromkeys(parts))


def _source_title(source: dict[str, Any]) -> str:
    for key in ("title", "name", "filename", "file_name", "original_filename"):
        value = source.get(key)
        if isinstance(value, str) and value.strip():
            return _normalize_text(value)

    return _normalize_text(source.get("id")) or "Untitled source"


def _folder_name(folder: dict[str, Any]) -> str:
    for key in ("name", "title", "label"):
        value = folder.get(key)
        if isinstance(value, str) and value.strip():
            return _normalize_text(value)

    return _normalize_text(folder.get("id")) or "Unnamed folder"


def _collect_folder_sources(
    folder: dict[str, Any],
    sources: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    folder_text = _source_text_blob(folder).lower()
    folder_source_ids = {
        _bare_record_id(str(entry.get("id") or ""), "source")
        for entry in (folder.get("sources") or [])
        if isinstance(entry, dict)
    }
    folder_source_ids = {source_id for source_id in folder_source_ids if source_id}

    folder_aliases = {
        _normalize_text(folder.get("id")).lower(),
        _normalize_text(folder.get("name")).lower(),
        _normalize_text(folder.get("title")).lower(),
        _normalize_text(folder.get("label")).lower(),
    }
    folder_aliases = {alias for alias in folder_aliases if alias}

    matched: list[dict[str, Any]] = []
    seen: set[str] = set()

    for source in sources:
        if not isinstance(source, dict):
            continue

        source_id = _bare_record_id(str(source.get("id") or ""), "source")
        source_text = _source_text_blob(source).lower()
        source_tokens = set(_content_terms(source_text))

        if source_id and source_id in seen:
            continue

        related_aliases: set[str] = set()
        for notebook in source.get("notebooks") or []:
            if not isinstance(notebook, dict):
                continue
            for key in ("id", "name", "title", "label"):
                value = notebook.get(key)
                if isinstance(value, str) and value.strip():
                    related_aliases.add(_normalize_text(value).lower())

        is_id_match = bool(source_id and source_id in folder_source_ids)
        is_notebook_match = bool(folder_aliases and related_aliases and folder_aliases.intersection(related_aliases))

        if is_id_match or is_notebook_match:
            matched.append(source)
            if source_id:
                seen.add(source_id)

    return matched


def _is_noise_line(line: str) -> bool:
    cleaned = _clean_line(line)

    if not cleaned:
        return True

    if re.match(r"^#{1,6}\s+", cleaned):
        return True

    if re.fullmatch(r"\|?[-:\s|]{3,}\|?", cleaned):
        return True

    lowered = cleaned.lower()

    if lowered.startswith("- source:") or lowered.startswith("- result:"):
        return True

    return False


def _display_focus_label(query_focus: QueryFocus) -> str:
    label = query_focus.focus_phrase or "Requested detail"
    label = re.sub(r"\s+", " ", label).strip(" :-")
    return label[:1].upper() + label[1:] if label else "Requested detail"


def _line_matches_subject(line: str, query_focus: QueryFocus) -> bool:
    if not query_focus.subject_terms:
        return True

    line_tokens = set(_tokenize(line))
    return any(term in line_tokens for term in query_focus.subject_terms)


def _source_mentions_subject(source: dict[str, Any], query_focus: QueryFocus) -> bool:
    if not query_focus.subject_terms:
        return True

    source_tokens = set(_tokenize(_source_text_blob(source)[:2000]))
    return any(term in source_tokens for term in query_focus.subject_terms)


def _split_label_value(line: str) -> tuple[str, str]:
    separators = [
        separator
        for separator in re.findall(r"\s*[:|\t]\s*|\s+-\s+", line)
        if separator.strip()
    ]

    if not separators:
        return "", ""

    separator = separators[0]
    left, right = line.split(separator, 1)

    return _clean_extracted_value(left), _clean_extracted_value(right)


def _similarity(left: str, right: str) -> float:
    return SequenceMatcher(None, left.lower(), right.lower()).ratio()


def _score_label_match(label: str, query_focus: QueryFocus) -> int:
    label_tokens = set(_content_terms(label))

    if not label_tokens:
        return 0

    focus_tokens = set(query_focus.focus_terms)
    score = 0

    overlap = label_tokens.intersection(focus_tokens)

    if overlap:
        score += len(overlap) * 4

    label_text = " ".join(label_tokens)
    focus_text = " ".join(focus_tokens)

    if focus_text:
        ratio = _similarity(label_text, focus_text)
        if ratio >= 0.45:
            score += int(ratio * 6)

    for label_token in label_tokens:
        for focus_token in focus_tokens:
            token_ratio = _similarity(label_token, focus_token)

            if token_ratio >= 0.72:
                score += 3
            elif len(label_token) >= 4 and len(focus_token) >= 4:
                if label_token[:4] == focus_token[:4]:
                    score += 2

    focus_initials = "".join(token[:1] for token in query_focus.focus_terms if token)

    if focus_initials and focus_initials in label_tokens:
        score += 4

    return score


def _extract_labeled_values(
    text: str,
    query_focus: QueryFocus,
    source: dict[str, Any],
) -> list[str]:
    if not text or not query_focus.focus_terms:
        return []

    values: list[str] = []
    lines = [line for line in text.splitlines() if line and line.strip()]

    for index, raw_line in enumerate(lines):
        line = _clean_extracted_value(raw_line)

        if not line or _is_noise_line(line):
            continue

        label, value = _split_label_value(line)
        label_candidate = label or line
        label_score = _score_label_match(label_candidate, query_focus)

        if label_score <= 0:
            continue

        context_window = " ".join(
            _clean_extracted_value(lines[position])
            for position in range(max(0, index - 1), min(len(lines), index + 2))
        )

        if not (
            _line_matches_subject(context_window, query_focus)
            or _source_mentions_subject(source, query_focus)
        ):
            continue

        if not value and index + 1 < len(lines):
            value = _clean_extracted_value(lines[index + 1])

        if not value:
            continue

        value_terms = set(_content_terms(value))

        if value_terms and value_terms.issubset(set(query_focus.focus_terms)):
            continue

        if value not in values:
            values.append(value)

    return values


def _score_line(line: str, query_focus: QueryFocus, source_title: str) -> int:
    line_terms = set(_content_terms(line))
    focus_terms = set(query_focus.focus_terms)

    if focus_terms and not line_terms.intersection(focus_terms):
        return 0

    score = len(line_terms.intersection(focus_terms)) * 3

    if query_focus.subject_terms:
        subject_terms = set(query_focus.subject_terms)

        if line_terms.intersection(subject_terms):
            score += 3
        elif any(term in source_title for term in subject_terms):
            score += 1

    label, value = _split_label_value(line)

    if label and value:
        score += _score_label_match(label, query_focus)

    return score


def _extract_generic_snippets(
    source: dict[str, Any],
    query_focus: QueryFocus,
) -> list[str]:
    text = _source_text_blob(source)

    if not text:
        return []

    lines = [line for line in text.splitlines() if not _is_noise_line(line)]

    if not lines:
        return []

    source_title = _source_title(source).lower()
    scored: list[tuple[int, str]] = []

    for index, line in enumerate(lines):
        cleaned_line = _clean_line(line)
        score = _score_line(cleaned_line, query_focus, source_title)

        if score <= 0:
            continue

        if query_focus.subject_terms and not _line_matches_subject(cleaned_line, query_focus):
            if not any(term in source_title for term in query_focus.subject_terms):
                continue

        snippet_lines = [cleaned_line]

        if index + 1 < len(lines):
            next_line = _clean_line(lines[index + 1])

            if next_line and not re.match(r"^#{1,6}\s+", next_line):
                if cleaned_line.endswith(":") or len(cleaned_line) <= 50:
                    snippet_lines.append(next_line)

        snippet = " ".join(dict.fromkeys(snippet_lines))
        scored.append((score, snippet))

    unique_snippets: list[str] = []

    for _, snippet in sorted(scored, key=lambda item: (-item[0], len(item[1]))):
        snippet = _clean_extracted_value(snippet)

        if not snippet or snippet in unique_snippets:
            continue

        unique_snippets.append(snippet)

        if len(unique_snippets) >= 1:
            break

    return unique_snippets


def _extract_values_for_query(
    source: dict[str, Any],
    query_focus: QueryFocus,
) -> list[str]:
    text = _source_text_blob(source)
    labeled_values = _extract_labeled_values(text, query_focus, source)

    if labeled_values:
        return labeled_values

    return _extract_generic_snippets(source, query_focus)


def _extract_result_values(section: str) -> list[str]:
    result_match = re.search(
        r"^\s*-\s*Result:\s*(.+)$",
        section or "",
        re.IGNORECASE | re.MULTILINE,
    )

    if not result_match:
        return []

    result_line = result_match.group(1).strip()

    if not result_line or result_line.lower() == "not found in this folder.":
        return []

    parts = [
        part.strip()
        for part in re.split(r"\s*\[source:[^\]]+\]\s*", result_line)
        if part.strip()
    ]

    cleaned_parts: list[str] = []

    for part in parts:
        cleaned = _clean_extracted_value(part)

        if cleaned and cleaned not in cleaned_parts:
            cleaned_parts.append(cleaned)

    return cleaned_parts


def _section_has_data(section: str) -> bool:
    return bool(_extract_result_values(section))


def _choose_preferred_section(existing: str | None, generated: str) -> str:
    if not existing:
        return generated

    existing_has_data = _section_has_data(existing)
    generated_has_data = _section_has_data(generated)

    if generated_has_data and not existing_has_data:
        return generated

    if generated_has_data and existing_has_data:
        return generated

    if existing_has_data and not generated_has_data:
        return existing

    existing_values = _extract_result_values(existing)
    generated_values = _extract_result_values(generated)

    if len(generated_values) > len(existing_values):
        return generated

    return existing


def _build_dynamic_folder_section(
    folder: dict[str, Any],
    sources: list[dict[str, Any]],
    query_focus: QueryFocus,
) -> str:
    folder_name = _folder_name(folder)
    folder_sources = _collect_folder_sources(folder, sources)

    if not folder_sources:
        return (
            f"### Folder: {folder_name}\n"
            "- Source: Not found in this folder.\n"
            "- Result: Not found in this folder."
        )

    source_labels: list[str] = []
    result_bits: list[str] = []
    focus_label = _display_focus_label(query_focus)
    seen_values: set[str] = set()

    for source in folder_sources:
        source_id = _bare_record_id(str(source.get("id") or ""), "source")
        source_title = _source_title(source)
        source_label = f"{source_title} [source:{source_id}]" if source_id else source_title

        extracted_values = _extract_values_for_query(source, query_focus)

        if not extracted_values:
            continue

        if source_label not in source_labels:
            source_labels.append(source_label)

        for value in extracted_values[:2]:
            value_key = value.lower()

            if value_key in seen_values:
                continue

            seen_values.add(value_key)

            snippet = f"{focus_label}: {value}" if focus_label else value
            cited = f"{snippet} [source:{source_id}]" if source_id else snippet

            if cited not in result_bits:
                result_bits.append(cited)

    if not result_bits:
        return (
            f"### Folder: {folder_name}\n"
            "- Source: Not found in this folder.\n"
            "- Result: Not found in this folder."
        )

    return (
        f"### Folder: {folder_name}\n"
        f"- Source: {', '.join(source_labels)}\n"
        f"- Result: {' '.join(result_bits)}"
    )


def _extract_folder_section(content: str, folder_name: str) -> str | None:
    if not content or not folder_name:
        return None

    escaped = re.escape(folder_name.strip())
    pattern = rf"###\s*Folder:\s*{escaped}\b.*?(?=\n###\s*Folder:|\n###\s*Summary\b|\Z)"
    match = re.search(pattern, content, re.IGNORECASE | re.DOTALL)

    return match.group(0).strip() if match else None


def _normalize_existing_section(section: str, folder_name: str) -> str | None:
    source_match = re.search(
        r"^\s*-\s*Source:\s*(.+)$",
        section,
        re.IGNORECASE | re.MULTILINE,
    )
    result_match = re.search(
        r"^\s*-\s*Result:\s*(.+)$",
        section,
        re.IGNORECASE | re.MULTILINE,
    )

    if not source_match or not result_match:
        return None

    source_line = _clean_line(source_match.group(1))
    result_line = _clean_line(result_match.group(1))

    if not source_line or not result_line:
        return None

    return (
        f"### Folder: {folder_name}\n"
        f"- Source: {source_line}\n"
        f"- Result: {result_line}"
    )


def _summarize_result_line(result_line: str) -> str:
    cleaned = re.sub(r"\[(?:source|note):[^\]]+\]", "", result_line)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" .")

    return cleaned or "Not found in this folder."


def _build_summary_section(folder_names: list[str], sections: list[str]) -> str:
    lines = ["### Summary"]

    for folder_name, section in zip(folder_names, sections):
        result_match = re.search(
            r"^\s*-\s*Result:\s*(.+)$",
            section,
            re.IGNORECASE | re.MULTILINE,
        )
        result_line = result_match.group(1).strip() if result_match else "Not found in this folder."
        lines.append(f"- {folder_name}: {_summarize_result_line(result_line)}")

    return "\n".join(lines)


def _collect_reference_ids(sections: list[str]) -> list[str]:
    reference_ids: list[str] = []
    for section in sections:
        for source_id in re.findall(r"\[source:([^\]]+)\]", section or "", flags=re.IGNORECASE):
            normalized = _normalize_text(source_id)
            if normalized and normalized not in reference_ids:
                reference_ids.append(normalized)
    return reference_ids


def _build_references_section(sections: list[str]) -> str:
    reference_ids = _collect_reference_ids(sections)
    lines = ["### References"]

    if not reference_ids:
        lines.append("- No references available.")
        return "\n".join(lines)

    for index, source_id in enumerate(reference_ids, start=1):
        lines.append(f"- [{index}] [source:{source_id}]")

    return "\n".join(lines)


def build_structured_folder_response(
    folder_structure: list[dict[str, Any]],
    sources: list[dict[str, Any]],
    user_message: str = "",
) -> str:
    query_focus = parse_query_focus(user_message)
    folder_names = _expected_folder_names(folder_structure)

    sections = [
        _build_dynamic_folder_section(folder, sources, query_focus)
        for folder in folder_structure
        if isinstance(folder, dict)
    ]

    lines = [
        "### Case overview",
        f"- Total notebooks checked: {len(folder_names)}",
        f"- Folders checked: {', '.join(folder_names)}" if folder_names else "- Folders checked: none",
        "",
    ]

    if sections:
        lines.append("\n\n".join(sections))
        lines.append("")
        lines.append(_build_summary_section(folder_names, sections))
        lines.append("")
        lines.append(_build_references_section(sections))

    return "\n".join(lines).strip()


def postprocess_folder_chat_response(
    llm_content: str,
    folder_structure: list[dict[str, Any]],
    sources: list[dict[str, Any]],
    user_message: str = "",
) -> str:
    cleaned = (llm_content or "").strip()

    if not folder_structure:
        return cleaned

    folder_names = _expected_folder_names(folder_structure)
    query_focus = parse_query_focus(user_message)
    sections: list[str] = []

    for folder in folder_structure:
        if not isinstance(folder, dict):
            continue

        folder_name = _folder_name(folder)
        existing = _extract_folder_section(cleaned, folder_name)
        normalized = _normalize_existing_section(existing, folder_name) if existing else None
        generated = _build_dynamic_folder_section(folder, sources, query_focus)

        sections.append(_choose_preferred_section(normalized, generated))

    lines = [
        "### Case overview",
        f"- Total notebooks checked: {len(folder_names)}",
        f"- Folders checked: {', '.join(folder_names)}" if folder_names else "- Folders checked: none",
        "",
    ]

    if sections:
        lines.append("\n\n".join(sections))
        lines.append("")
        lines.append(_build_summary_section(folder_names, sections))
        lines.append("")
        lines.append(_build_references_section(sections))

    return "\n".join(lines).strip()
