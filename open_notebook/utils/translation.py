"""
Translation utility: detect language and translate non-English content to English.
Uses Aya 8B (Ollama) for translation — multilingual model optimized for translation.
Falls back to default LLM if Aya is not available.
"""
import re
from typing import Optional, Tuple

from loguru import logger

# Translation model — qwen2.5:7b has good multilingual support for Indian languages
TRANSLATION_MODEL = "qwen2.5:7b"
OLLAMA_BASE_URL = "http://127.0.0.1:11434"


def _detect_language_simple(text: str) -> str:
    """
    Simple heuristic language detection without external libraries.
    Returns ISO 639-1 code: 'hi', 'en', 'gu', 'pa', 'ur', etc.
    """
    if not text or len(text.strip()) < 20:
        return "en"

    sample = text[:2000]

    # Devanagari script (Hindi, Marathi, Nepali, Sanskrit)
    devanagari = len(re.findall(r'[\u0900-\u097F]', sample))
    # Gujarati script
    gujarati = len(re.findall(r'[\u0A80-\u0AFF]', sample))
    # Punjabi/Gurmukhi script
    gurmukhi = len(re.findall(r'[\u0A00-\u0A7F]', sample))
    # Arabic/Urdu script
    arabic = len(re.findall(r'[\u0600-\u06FF]', sample))
    # Bengali script
    bengali = len(re.findall(r'[\u0980-\u09FF]', sample))
    # Tamil script
    tamil = len(re.findall(r'[\u0B80-\u0BFF]', sample))
    # Telugu script
    telugu = len(re.findall(r'[\u0C00-\u0C7F]', sample))
    # Kannada script
    kannada = len(re.findall(r'[\u0C80-\u0CFF]', sample))
    # Malayalam script
    malayalam = len(re.findall(r'[\u0D00-\u0D7F]', sample))

    total_non_latin = (devanagari + gujarati + gurmukhi + arabic + bengali
                       + tamil + telugu + kannada + malayalam)
    total_chars = len(sample.replace(' ', '').replace('\n', ''))

    if total_chars == 0:
        return "en"

    non_latin_ratio = total_non_latin / total_chars

    # If more than 15% non-Latin characters, it's non-English
    if non_latin_ratio < 0.15:
        return "en"

    if devanagari > 0:
        return "hi"
    if gujarati > 0:
        return "gu"
    if gurmukhi > 0:
        return "pa"
    if arabic > 0:
        return "ur"
    if bengali > 0:
        return "bn"
    if tamil > 0:
        return "ta"
    if telugu > 0:
        return "te"
    if kannada > 0:
        return "kn"
    if malayalam > 0:
        return "ml"

    return "en"


async def _translate_chunk_with_aya(chunk: str) -> str:
    """Translate a single chunk using qwen2.5:7b via Ollama chat API with few-shot examples."""
    import httpx

    messages = [
        {
            "role": "system",
            "content": (
                "You are a Hindi-English translator. "
                "Translate the ENTIRE Hindi text to English word by word. "
                "Do NOT summarize, shorten, or skip any content. "
                "Translate EVERYTHING including all sentences, paragraphs, and details. "
                "Preserve all names, dates, numbers, FIR numbers, and proper nouns exactly. "
                "Output the complete translation only."
            )
        },
        # Few-shot examples
        {"role": "user", "content": "मेरा नाम राम है।"},
        {"role": "assistant", "content": "My name is Ram."},
        {"role": "user", "content": "FIR No. 163/2021 दर्ज किया गया।"},
        {"role": "assistant", "content": "FIR No. 163/2021 was registered."},
        {"role": "user", "content": chunk}
    ]

    async with httpx.AsyncClient(timeout=300.0) as client:
        response = await client.post(
            f"{OLLAMA_BASE_URL}/api/chat",
            json={
                "model": TRANSLATION_MODEL,
                "messages": messages,
                "stream": False,
                "options": {"temperature": 0.1, "num_predict": 16000},
            },
        )
        response.raise_for_status()
        data = response.json()
        result = data.get("message", {}).get("content", "").strip()
        if not result or len(result) < 5:
            raise ValueError(f"Empty or too short translation result")
        return result


async def _translate_chunk_with_default_llm(chunk: str, model_id: Optional[str]) -> str:
    """Fallback: translate using the default configured LLM."""
    from open_notebook.ai.provision import provision_langchain_model
    from langchain_core.messages import HumanMessage, SystemMessage
    from open_notebook.utils import clean_thinking_content
    from open_notebook.utils.text_utils import extract_text_content

    system_prompt = (
        "You are a professional translator. Translate the following text to English. "
        "Preserve all names, dates, numbers, case numbers, FIR numbers, and proper nouns exactly as they are. "
        "Translate everything else accurately and naturally. "
        "Output ONLY the translated text — no explanations, no notes, no headers."
    )
    chain = await provision_langchain_model(
        system_prompt + chunk, model_id, "transformation", max_tokens=8000
    )
    payload = [SystemMessage(content=system_prompt), HumanMessage(content=chunk)]
    response = await chain.ainvoke(payload)
    return clean_thinking_content(extract_text_content(response.content)).strip()


async def translate_to_english(
    text: str,
    model_id: Optional[str] = None,
    chunk_size: int = 3000,  # Smaller chunks = better translation quality
) -> Tuple[str, str]:
    """
    Detect language and translate to English if non-English.
    Uses Aya 8B (Ollama) as primary translation model.

    Returns:
        (translated_text, language_code)
        If already English, returns (original_text, "en")
    """
    lang = _detect_language_simple(text)

    if lang == "en":
        logger.debug("[Translation] Content is English — no translation needed")
        return text, "en"

    logger.info(f"[Translation] Detected language: {lang} — translating to English using {TRANSLATION_MODEL}")

    # Split into chunks if text is large
    chunks = [text[i:i + chunk_size] for i in range(0, len(text), chunk_size)]
    translated_chunks = []

    for idx, chunk in enumerate(chunks):
        logger.debug(f"[Translation] Translating chunk {idx + 1}/{len(chunks)} ({len(chunk)} chars)")
        try:
            translated = await _translate_chunk_with_aya(chunk)
            translated_chunks.append(translated)
            logger.debug(f"[Translation] Chunk {idx + 1} done via {TRANSLATION_MODEL}")
        except Exception as e:
            logger.warning(f"[Translation] {TRANSLATION_MODEL} failed for chunk {idx + 1}: {e} — trying fallback")
            try:
                translated = await _translate_chunk_with_default_llm(chunk, model_id)
                translated_chunks.append(translated)
                logger.debug(f"[Translation] Chunk {idx + 1} done via fallback LLM")
            except Exception as e2:
                logger.warning(f"[Translation] Fallback also failed: {e2} — keeping original chunk")
                translated_chunks.append(chunk)

    translated_text = "\n\n".join(translated_chunks)
    logger.info(f"[Translation] Complete — {len(text)} → {len(translated_text)} chars, lang={lang}")
    return translated_text, lang
