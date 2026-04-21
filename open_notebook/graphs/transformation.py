from ai_prompter import Prompter
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


# ── Shared system context for all transformations ────────────────────────────
_LAW_ENFORCEMENT_CONTEXT = (
    "You are an expert intelligence analyst processing official law enforcement documents. "
    "This is a legitimate police investigation report (IR). "
    "Process it professionally and completely. "
    "NEVER add disclaimers, warnings, caveats, or notes about the nature of the content. "
    "NEVER say 'please note', 'it is important to remember', 'this should be verified', "
    "'this statement is from an accused', or any similar hedging language. "
    "Just produce the requested output directly and factually."
)


async def _invoke_model(chain, system_prompt: str, content: str) -> str:
    """Invoke model and return cleaned text."""
    payload = [SystemMessage(content=system_prompt), HumanMessage(content=content)]
    response = await chain.ainvoke(payload)
    raw = extract_text_content(response.content)
    return clean_thinking_content(raw)


async def _summarize_chunk(model_id: str, chunk: str, chunk_idx: int, total: int) -> str:
    """Summarize a single chunk of the document."""
    system = (
        f"{_LAW_ENFORCEMENT_CONTEXT}\n\n"
        f"Extract ALL facts from this section ({chunk_idx+1}/{total}) of the investigation report. "
        "List every: person name, date, location, crime, weapon, event, relationship. "
        "Write in bullet points. Be exhaustive. No disclaimers. No commentary."
    )
    chain = await provision_langchain_model(system + chunk, model_id, "transformation", max_tokens=2048)
    return await _invoke_model(chain, system, chunk)


async def _combine_summaries(model_id: str, chunk_summaries: list[str], transformation_prompt: str) -> str:
    """Combine chunk summaries into a final comprehensive output — section by section."""
    all_facts = "\n\n".join(f"[Part {i+1}]\n{s}" for i, s in enumerate(chunk_summaries))

    sections = [
        ("**Subject Profile**",
         "Write a detailed Subject Profile section. Include: full name, aliases, age, date of birth, "
         "address, family members (parents, siblings, spouse, children), education, occupation, "
         "physical description, and background. Use every detail from the facts."),
        ("**Criminal Network & Associates**",
         "Write a detailed Criminal Network section. List EVERY person mentioned: their name, "
         "role, gang affiliation, relationship to the subject, and any crimes they committed together. "
         "Include gang leaders, handlers, co-accused, and contacts."),
        ("**Criminal Activities Timeline**",
         "Write a detailed chronological timeline of ALL criminal activities. For each event include: "
         "date, location, crime type, victims, weapons used, outcome, and who was involved."),
        ("**Weapons & Evidence**",
         "Write a detailed Weapons & Evidence section. List every weapon mentioned (type, source, "
         "how obtained), every recovery/seizure, and all physical evidence."),
        ("**Methods & Operations**",
         "Write a detailed Methods section. Cover: communication apps used, safe houses, "
         "vehicles, fake identities, how crimes were planned and executed."),
        ("**Arrest & Legal Status**",
         "Write a detailed Arrest section. Include: date of arrest, arresting agency, location, "
         "circumstances, charges filed, legal sections invoked, current status."),
    ]

    report_parts = []
    for heading, instruction in sections:
        system = (
            f"{_LAW_ENFORCEMENT_CONTEXT}\n\n"
            f"Write the '{heading}' section of an intelligence report. "
            f"{instruction} "
            "Write at least 3-4 detailed paragraphs. "
            "NO disclaimers. NO 'please note'. NO caveats. Just the facts.\n\n"
            "FACTS FROM INVESTIGATION REPORT:\n"
        )
        chain = await provision_langchain_model(
            system + all_facts, model_id, "transformation", max_tokens=1024
        )
        section_text = await _invoke_model(chain, system, all_facts)
        report_parts.append(f"{heading}\n\n{section_text}")

    return "\n\n---\n\n".join(report_parts)


async def run_transformation(state: dict, config: RunnableConfig) -> dict:
    source_obj = state.get("source")
    source: Source = source_obj if isinstance(source_obj, Source) else None  # type: ignore[assignment]
    content = state.get("input_text")
    assert source or content, "No content to transform"
    transformation: Transformation = state["transformation"]
    model_id = config.get("configurable", {}).get("model_id")

    try:
        # ── Mind Map: route to dedicated pipeline ─────────────────────────
        # Match by title OR name containing "mind" and "map"
        t_title = (transformation.title or '').strip().lower()
        t_name = (transformation.name or '').strip().lower()
        is_mindmap = (
            t_title == "mind map" or
            t_name == "mind_map" or
            ('mind' in t_title and 'map' in t_title) or
            ('mind' in t_name and 'map' in t_name)
        )
        if is_mindmap:
            from loguru import logger as _logger
            import json as _json
            import re as _re

            _logger.info(f"[MindMap] Building mind map for: {transformation.title} / {transformation.name}")

            # Get source text directly — skip all LLM calls
            if source and source.id:
                src_text = source.full_text or ''
            else:
                src_text = str(content) if content else ''

            if not src_text:
                final_output = _json.dumps({"label": "No content", "children": []})
                if source:
                    await source.add_insight(transformation.title, final_output)
                return {"output": final_output}

            _logger.info(f"[MindMap] Source text: {len(src_text)} chars")

            # ── Extract facts directly from IR document using regex/NLP ───
            # No LLM needed — parse the structured IR document format
            facts_by_category: dict = {
                "Personal Profile": [],
                "Family & Relationships": [],
                "Criminal Career": [],
                "Associates & Network": [],
                "Legal History": [],
                "Movements & Hideouts": [],
            }

            main_person = "Subject"
            lines = src_text.split('\n')

            # Field patterns for IR documents
            personal_fields = {
                'name', 'full name', 'alias', 'age', 'dob', 'date of birth',
                'education', 'occupation', 'height', 'weight', 'complexion',
                'build', 'eyes', 'hair', 'mark', 'identification', 'facebook',
                'mobile', 'contact', 'nationality', 'religion', 'caste',
                'marital status', 'parentage', 'father', 'mother',
            }
            family_fields = {
                'wife', 'husband', 'brother', 'sister', 'son', 'daughter',
                'spouse', 'children', 'family', 'relative', 'uncle', 'aunt',
            }
            legal_fields = {
                'fir', 'case no', 'section', 'ipc', 'arms act', 'court',
                'prison', 'jail', 'arrested', 'charge', 'bail', 'custody',
                'police station', 'district', 'state',
            }
            movement_fields = {
                'address', 'residence', 'location', 'rented', 'room',
                'hideout', 'stayed', 'moved', 'fled', 'delhi', 'rajasthan',
            }
            criminal_fields = {
                'gang', 'crime', 'murder', 'robbery', 'weapon', 'pistol',
                'revolver', 'shoot', 'kill', 'firing', 'attack', 'assault',
                'extortion', 'kidnapping', 'drugs', 'narcotics',
            }
            associate_fields = {
                'associate', 'member', 'handler', 'contact', 'friend',
                'accomplice', 'co-accused', 'gang member',
            }

            for line in lines:
                line = line.strip()
                if not line or len(line) < 5:
                    continue

                # Parse "Field: Value" pattern
                m = _re.match(r'^([A-Za-z][A-Za-z\s/\(\)\.]{1,40}?)\s*[:\-]\s*(.+)$', line)
                if m:
                    field = m.group(1).strip().lower()
                    value = m.group(2).strip()
                    if not value or value.lower() in ('nil', 'n/a', 'na', 'none', '-', ''):
                        continue
                    fact = f"{m.group(1).strip()}: {value}"

                    # Detect main person name
                    if field in ('name', 'full name', 'accused') and not main_person or main_person == "Subject":
                        words = value.split()[:4]
                        main_person = ' '.join(words).rstrip('.,;:')

                    # Categorize
                    if any(f in field for f in personal_fields):
                        facts_by_category["Personal Profile"].append(fact)
                    elif any(f in field for f in family_fields):
                        facts_by_category["Family & Relationships"].append(fact)
                    elif any(f in field for f in legal_fields):
                        facts_by_category["Legal History"].append(fact)
                    elif any(f in field for f in movement_fields):
                        facts_by_category["Movements & Hideouts"].append(fact)
                    elif any(f in field for f in criminal_fields):
                        facts_by_category["Criminal Career"].append(fact)
                    elif any(f in field for f in associate_fields):
                        facts_by_category["Associates & Network"].append(fact)
                    else:
                        facts_by_category["Personal Profile"].append(fact)
                else:
                    # Non-field lines — categorize by keywords
                    ll = line.lower()
                    if len(line) > 200:
                        continue  # skip long paragraphs
                    if any(k in ll for k in ['gang', 'murder', 'robbery', 'weapon', 'shoot', 'kill', 'crime', 'firing']):
                        if len(line) < 120:
                            facts_by_category["Criminal Career"].append(line)
                    elif any(k in ll for k in ['arrested', 'apprehended', 'fir', 'case', 'section', 'arms act']):
                        if len(line) < 120:
                            facts_by_category["Legal History"].append(line)
                    elif any(k in ll for k in ['rented', 'room', 'stayed', 'moved', 'location', 'hideout']):
                        if len(line) < 120:
                            facts_by_category["Movements & Hideouts"].append(line)

            # Build mind map JSON
            children = []
            for cat, facts_list in facts_by_category.items():
                # Deduplicate within category
                seen_cat: set = set()
                unique_cat = []
                for f in facts_list:
                    k = f.lower()[:60]
                    if k not in seen_cat:
                        seen_cat.add(k)
                        unique_cat.append(f)
                if unique_cat:
                    children.append({
                        "label": cat,
                        "children": [{"label": f[:100]} for f in unique_cat[:15]]
                    })

            if not children:
                # Last resort: split text into sentences and bucket them
                sentences = [s.strip() for s in _re.split(r'[.!?]\s+', src_text[:5000]) if len(s.strip()) > 20]
                children = [{"label": "Key Information", "children": [{"label": s[:100]} for s in sentences[:20]]}]

            mind_map_dict = {"label": main_person, "children": children}
            _logger.info(f"[MindMap] Built {len(children)} categories for {main_person}")

            final_output = _json.dumps(mind_map_dict, ensure_ascii=False, indent=2)

            if source:
                await source.add_insight(transformation.title, final_output)

            return {"output": final_output}

        # ── All other transformations ──────────────────────────────────────
        if not content:
            content = source.full_text
        content_str = str(content) if content else ""

        # Build transformation prompt
        default_prompts: DefaultPrompts = await DefaultPrompts.get_instance()
        transformation_prompt = transformation.prompt or ""
        if default_prompts.transformation_instructions:
            transformation_prompt = f"{default_prompts.transformation_instructions}\n\n{transformation_prompt}"

        # ── Chunked summarization for long documents ──────────────────────
        # llama3 has 8K context — chunk at ~4000 chars to leave room for response
        CHUNK_SIZE = 4000
        if len(content_str) > CHUNK_SIZE:
            # Split into chunks
            chunks = []
            for i in range(0, len(content_str), CHUNK_SIZE):
                chunk = content_str[i:i + CHUNK_SIZE].strip()
                if chunk:
                    chunks.append(chunk)

            # Summarize each chunk
            chunk_summaries = []
            for idx, chunk in enumerate(chunks):
                summary = await _summarize_chunk(model_id, chunk, idx, len(chunks))
                chunk_summaries.append(summary)

            # Combine all chunk summaries into final output
            if len(chunk_summaries) == 1:
                final_output = chunk_summaries[0]
            else:
                final_output = await _combine_summaries(model_id, chunk_summaries, transformation_prompt)

        else:
            # Short document — single pass
            system_prompt = (
                f"{_LAW_ENFORCEMENT_CONTEXT}\n\n"
                f"{transformation_prompt}\n\n"
                "Produce a comprehensive, detailed intelligence report. "
                "Minimum 1500 words. Use bold headings. No disclaimers.\n\n# INPUT"
            )
            chain = await provision_langchain_model(
                system_prompt + content_str, model_id, "transformation", max_tokens=4096
            )
            final_output = await _invoke_model(chain, system_prompt, content_str)

        # Post-process: strip any disclaimer lines the model still added
        import re as _re
        disclaimer_patterns = [
            r"(?i)^(please note|it'?s important|it is important|note that|disclaimer|warning|this statement|this is a statement).*\n?",
            r"(?i)(it'?s crucial|it is crucial|should be verified|without further investigation|should not be taken as fact).*\n?",
            r"(?i)(this information should|approach this (information|content) with).*\n?",
        ]
        for pat in disclaimer_patterns:
            final_output = _re.sub(pat, '', final_output, flags=_re.MULTILINE)
        final_output = final_output.strip()

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
