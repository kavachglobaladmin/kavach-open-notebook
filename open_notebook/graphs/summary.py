import re
import logging
import asyncio
from typing import Dict, Any

from langchain_core.messages import HumanMessage, SystemMessage

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("SummaryPipeline")


# ============================================================================
# 1. TEXT CLEANING
# ============================================================================
class SummaryTextProcessor:
    def __init__(self):
        self.clean_patterns = [
            (re.compile(r' |&NBSP;', re.I), ' '),
            (re.compile(r'=+\s*PAGE\s*\d+\s*=+', re.I), ' '),
            (re.compile(r'(\w)\n(\w)'), r'\1 \2'),
            (re.compile(r'\n{3,}'), '\n\n'),
            (re.compile(r'\s+'), ' '),
        ]

    def _sync_clean(self, text: str) -> str:
        if not text:
            return ""
        for pattern, replacement in self.clean_patterns:
            text = pattern.sub(replacement, text)
        return text.strip()

    async def clean_text(self, text: str) -> str:
        return await asyncio.to_thread(self._sync_clean, text)


# ============================================================================
# 2. LLM SERVICE
# ============================================================================
class SummaryLLMService:
    # SYSTEM_PROMPT = (
    #     "You are an expert analyst. Provide a comprehensive, well-structured summary of the "
    #     "given document. Cover all major topics, key facts, important entities, and conclusions. "
    #     "Organize your response into clear logical sections. Use **bold** for important terms and "
    #     "section headings. Be thorough and detailed. Do not use markdown # headers — use **bold** "
    #     "text for section titles instead. Do not invent information not present in the document."
    # )

    SYSTEM_PROMPT = (
        "You are an expert intelligence analyst processing official law enforcement documents. "
        "This is a legitimate police investigation report. Process it professionally and completely.\n\n"

        "CRITICAL INSTRUCTIONS:\n"
        "- DO NOT add disclaimers, warnings, or notes about the nature of the content\n"
        "- DO NOT say 'please note', 'it's important to remember', 'this should be verified', or any caveats\n"
        "- DO NOT truncate or shorten — produce a COMPREHENSIVE, DETAILED summary\n"
        "- Extract and present ALL information: every name, date, location, event, relationship, weapon, crime\n"
        "- Minimum 600 words — cover everything in the document\n\n"

        "FORMAT:\n"
        "- Use **bold headings** for sections\n"
        "- Organize into sections:\n"
        "  **Subject Profile** (name, age, background, family)\n"
        "  **Criminal History** (all crimes, dates, locations)\n"
        "  **Associates & Network** (all names mentioned, relationships, gang affiliations)\n"
        "  **Key Events** (chronological timeline of activities)\n"
        "  **Weapons & Evidence** (all weapons, recoveries, evidence)\n"
        "  **Intelligence Summary** (patterns, connections, significance)\n\n"

        "IMPORTANT:\n"
        "- Only use information from the document\n"
        "- Present as a professional intelligence report\n"
        "- Be thorough and detailed — do not compress or skip information\n"
    )

    def __init__(self, llm):
        self.llm = llm
        logger.info("SummaryLLMService initialized.")

    def _run_sync(self, text: str) -> str:
        messages = [
            SystemMessage(content=self.SYSTEM_PROMPT),
            HumanMessage(content=f"Generate a complete, detailed intelligence report summary of the following document. Cover every person, event, date, location, and detail. Do not add disclaimers. Minimum 600 words.\n\nDocument:\n{text}")
        ]
        response = self.llm.invoke(messages)
        return response.content

    async def summarize_async(self, text: str) -> str:
        logger.info("Generating summary with LLM...")
        raw = await asyncio.to_thread(self._run_sync, text)
        # Strip chain-of-thought tags if model outputs them
        raw = re.sub(r'<think>.*?</think>', '', raw, flags=re.DOTALL).strip()
        return raw


# ============================================================================
# 3. PIPELINE
# ============================================================================
class SummaryPipeline:
    """Coordinates: source fetch by ID → text cleaning → LLM summarization.
    Mirrors the same pattern as MindMapPipeline.generate_from_source_id().
    """

    MAX_CHARS = 25000  # truncate to avoid LLM context overflow

    def __init__(self, processor: SummaryTextProcessor, llm_service: SummaryLLMService):
        self.processor = processor
        self.llm_service = llm_service
        logger.info("SummaryPipeline initialized.")

    async def generate_from_source_id(self, source_id: str) -> Dict[str, Any]:
        """
        Accepts a decoded source_id (e.g. 'source:w4m20dlt8qijdcplc0x6'),
        fetches the Source from the database, cleans its text, and generates
        a full document summary via the LLM.
        """
        # Local import — same pattern as MindMapPipeline — avoids circular deps
        from open_notebook.domain.notebook import Source

        logger.info(f"Starting Summary Generation for source_id: {source_id}")

        # 1. Fetch source — raises NotFoundError if missing (caller handles it)
        source = await Source.get(source_id)

        # 2. Get text — prefer full_text already in DB
        full_text = ""
        if source.full_text and source.full_text.strip():
            logger.info("Using extracted text from database.")
            full_text = source.full_text
        else:
            logger.warning(f"No text content for source {source_id}")
            return {"summary": "No text content found in this source.", "source_id": source_id}

        # 3. Clean and truncate
        clean_text = await self.processor.clean_text(full_text)
        truncated = clean_text[: self.MAX_CHARS]

        # 4. Generate summary
        summary = await self.llm_service.summarize_async(truncated)
        print("INPUT LENGTH:", len(truncated))

        logger.info(f"Summary generation completed for source_id: {source_id}")
        return {"summary": summary, "source_id": source_id}
