import re
import json
import logging
import asyncio
import concurrent.futures
import os
from collections import Counter
from typing import Dict, Any, List, Optional

import fitz
import numpy as np

from langchain_core.prompts import ChatPromptTemplate

# --- Kafka Imports ---
from aiokafka import AIOKafkaProducer, AIOKafkaConsumer

# -------------------------------------------------
# LOGGER
# -------------------------------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("InfographicPipeline")


def _clean_scalar(value: Any) -> Optional[str]:
    """Normalize scalar values and drop placeholders/empty content."""
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    lowered = text.lower()
    placeholders = {
        "null", "none", "n/a", "na", "...", "-", "--", "unknown",
        "field name", "value", "location", "detail", "status",
        "yyyy-mm-dd", "<actual date>", "<actual value>", "<detected type>",
        "<actual fir number>", "<actual ipc section>", "<actual police station name>",
        "<actual finding title>", "<actual factual detail from document>",
    }
    if lowered in placeholders:
        return None
    return text


def _normalize_dict_values(data: Dict[str, Any]) -> Dict[str, str]:
    normalized: Dict[str, str] = {}
    for key, value in data.items():
        clean_key = _clean_scalar(key)
        if not clean_key:
            continue
        if isinstance(value, (list, dict)):
            if isinstance(value, list):
                joined = " | ".join(
                    clean for item in value if (clean := _clean_scalar(item))
                )
                if joined:
                    normalized[clean_key] = joined
            continue
        clean_value = _clean_scalar(value)
        if clean_value:
            normalized[clean_key] = clean_value
    return normalized


def _infer_document_type(text: str, data: Dict[str, Any]) -> str:
    raw_type = (_clean_scalar(data.get("document_type")) or "").lower()
    if raw_type in {"mobile_cdr", "bank_statement", "ir_document", "general"}:
        return raw_type

    haystack = f"{text[:6000]}\n{json.dumps(data, ensure_ascii=False)}".lower()
    if any(token in haystack for token in ["cdr", "imei", "imsi", "call detail", "b party", "cell id"]):
        return "mobile_cdr"
    if any(token in haystack for token in ["balance", "debit", "credit", "account", "ifsc", "withdrawal", "deposit"]):
        return "bank_statement"
    if any(token in haystack for token in ["fir", "police station", "under trial", "accused", "gangster", "arrested", "encounter"]):
        return "ir_document"
    return "general"


def _normalize_infographic_output(data: Dict[str, Any], source_title: str, text: str) -> Dict[str, Any]:
    normalized = dict(data or {})
    normalized["document_type"] = _infer_document_type(text, normalized)

    header = normalized.get("header") if isinstance(normalized.get("header"), dict) else {}
    title = _clean_scalar(header.get("title")) or _clean_scalar(source_title) or "Document Analysis"
    subtitle = _clean_scalar(header.get("subtitle"))

    subject = _normalize_dict_values(normalized.get("subject", {}) if isinstance(normalized.get("subject"), dict) else {})
    personal = _normalize_dict_values(normalized.get("personal", {}) if isinstance(normalized.get("personal"), dict) else {})
    account = _normalize_dict_values(normalized.get("account", {}) if isinstance(normalized.get("account"), dict) else {})
    financial_summary = _normalize_dict_values(normalized.get("financial_summary", {}) if isinstance(normalized.get("financial_summary"), dict) else {})

    highlight_items: List[Dict[str, str]] = []
    for item in normalized.get("highlights", []) or []:
        if not isinstance(item, dict):
            continue
        item_title = _clean_scalar(item.get("title"))
        item_subtitle = _clean_scalar(item.get("subtitle"))
        item_description = _clean_scalar(item.get("description"))
        if not item_title and not item_description:
            continue
        if not item_title:
            item_title = item_description[:80]
        if not item_description:
            item_description = item_title
        highlight_items.append({
            "title": item_title,
            "subtitle": item_subtitle or "",
            "description": item_description,
        })

    timeline_events: List[Dict[str, str]] = []
    seen_timeline = set()
    for item in normalized.get("timeline_events", []) or []:
        if not isinstance(item, dict):
            continue
        date = _clean_scalar(item.get("date"))
        event = _clean_scalar(item.get("event"))
        if not date or not event:
            continue
        key = (date, event)
        if key in seen_timeline:
            continue
        seen_timeline.add(key)
        timeline_events.append({"date": date, "event": event})

    case_details: List[Dict[str, str]] = []
    seen_cases = set()
    for item in normalized.get("case_details", []) or []:
        if not isinstance(item, dict):
            continue
        case = {
            "fir_no": _clean_scalar(item.get("fir_no")) or "",
            "section": _clean_scalar(item.get("section")) or "",
            "date": _clean_scalar(item.get("date")) or "",
            "police_station": _clean_scalar(item.get("police_station")) or "",
            "status": _clean_scalar(item.get("status")) or "",
        }
        if not any(case.values()):
            continue
        key = tuple(case.values())
        if key in seen_cases:
            continue
        seen_cases.add(key)
        case_details.append(case)

    associates: List[Dict[str, str]] = []
    seen_associates = set()
    for item in normalized.get("associates", []) or []:
        if not isinstance(item, dict):
            continue
        name = _clean_scalar(item.get("name"))
        relation = _clean_scalar(item.get("relation")) or "associate"
        if not name:
            continue
        key = (name, relation)
        if key in seen_associates:
            continue
        seen_associates.add(key)
        associates.append({"name": name, "relation": relation})

    stat = normalized.get("stat") if isinstance(normalized.get("stat"), dict) else {}
    stat_value = _clean_scalar(stat.get("value"))
    stat_label = _clean_scalar(stat.get("label"))
    if not stat_value:
        if normalized["document_type"] == "ir_document" and case_details:
            stat_value = str(len(case_details))
            stat_label = stat_label or "Cases Identified"
        elif normalized["document_type"] == "bank_statement" and financial_summary.get("closing_balance"):
            stat_value = financial_summary["closing_balance"]
            stat_label = stat_label or "Closing Balance"
        elif timeline_events:
            stat_value = str(len(timeline_events))
            stat_label = stat_label or "Timeline Events"
        elif highlight_items:
            stat_value = str(len(highlight_items))
            stat_label = stat_label or "Key Findings"

    if not subtitle:
        if normalized["document_type"] == "ir_document":
            subtitle = subject.get("Social Status") or subject.get("Status") or (timeline_events[0]["date"] if timeline_events else None)
        elif normalized["document_type"] == "bank_statement":
            subtitle = account.get("Bank") or account.get("Account Number") or financial_summary.get("closing_balance")
        elif normalized["document_type"] == "mobile_cdr":
            subtitle = subject.get("Phone Number") or subject.get("Period")

    result: Dict[str, Any] = {
        "source_id": normalized.get("source_id", ""),
        "document_type": normalized["document_type"],
        "header": {"title": title, "subtitle": subtitle or ""},
        "subject": subject if subject else None,
        "personal": personal if personal else None,
        "account": account if account else None,
        "financial_summary": financial_summary if financial_summary else None,
        "highlights": highlight_items,
        "timeline_events": timeline_events,
        "case_details": case_details,
        "associates": associates,
    }
    if stat_value or stat_label:
        result["stat"] = {"value": stat_value or "", "label": stat_label or ""}
    return result


# ============================================================================
# CDR DIRECT PARSER — no LLM needed for CSV call records
# ============================================================================

def _is_cdr_text(text: str) -> bool:
    """Detect if text is a CDR/call detail record CSV."""
    sample = text[:2000].lower()
    cdr_signals = ['call type', 'b party', 'dur(s)', 'imei', 'imsi', 'cell id',
                   'call detail', 'cdr', 'target no', 'service type', 'roam nw']
    return sum(1 for s in cdr_signals if s in sample) >= 3


def _parse_cdr_row(line: str) -> Optional[List[str]]:
    """Parse a single CDR CSV row with single-quoted values."""
    cells: List[str] = []
    cur = ''
    in_sq = False
    for ch in line:
        if ch == "'" and not in_sq:
            in_sq = True
            continue
        if ch == "'" and in_sq:
            in_sq = False
            continue
        if ch == ',' and not in_sq:
            cells.append(cur.strip())
            cur = ''
            continue
        cur += ch
    cells.append(cur.strip())
    return cells if len(cells) >= 5 else None


def _parse_cdr_direct(text: str, source_id: str) -> Dict[str, Any]:
    """Parse CDR CSV directly without LLM — handles 200K+ char files."""
    lines = text.replace('\r\n', '\n').split('\n')

    # Extract header info (first few lines)
    phone_no = ''
    date_range = ''
    operator = ''
    for line in lines[:10]:
        m = re.search(r"'(\d{10,})'", line)
        if m and not phone_no:
            phone_no = m.group(1)
        m2 = re.search(r"from\s+'([^']+)'\s+to\s+'([^']+)'", line, re.IGNORECASE)
        if m2:
            date_range = f"{m2.group(1)} to {m2.group(2)}"
        if any(op in line.upper() for op in ['AIRTEL', 'VODAFONE', 'JIO', 'BSNL', 'IDEA', 'VI']):
            for op in ['AIRTEL', 'VODAFONE', 'JIO', 'BSNL', 'IDEA', 'VI', 'BHARTI']:
                if op in line.upper():
                    operator = op.title()
                    break

    # Find header row
    header_idx = -1
    headers: List[str] = []
    for i, line in enumerate(lines):
        if 'Call Type' in line or 'Target No' in line or 'B Party' in line:
            headers = [h.strip().strip("'") for h in line.split(',')]
            header_idx = i
            break

    if header_idx < 0:
        return {'document_type': 'mobile_cdr', 'source_id': source_id,
                'header': {'title': f'CDR: {phone_no}', 'subtitle': date_range},
                'stat': {'value': '0', 'label': 'Records'}, 'highlights': []}

    # Map column indices
    def col(name: str) -> int:
        for j, h in enumerate(headers):
            if name.lower() in h.lower():
                return j
        return -1

    idx_type = col('Call Type')
    idx_bparty = col('B Party')
    idx_date = col('Date')
    idx_time = col('Time')
    idx_dur = col('Dur')
    idx_svc = col('Service Type')

    # Parse data rows
    incoming = outgoing = sms_count = data_count = 0
    contact_counter: Counter = Counter()
    timeline_rows: List[Dict] = []
    total = 0

    for line in lines[header_idx + 1:]:
        line = line.strip()
        if not line:
            continue
        cells = _parse_cdr_row(line)
        if not cells or len(cells) < 5:
            continue

        total += 1
        call_type = cells[idx_type].upper() if idx_type >= 0 and idx_type < len(cells) else ''
        bparty = cells[idx_bparty].strip() if idx_bparty >= 0 and idx_bparty < len(cells) else ''
        date = cells[idx_date].strip() if idx_date >= 0 and idx_date < len(cells) else ''
        time = cells[idx_time].strip() if idx_time >= 0 and idx_time < len(cells) else ''
        dur = cells[idx_dur].strip() if idx_dur >= 0 and idx_dur < len(cells) else '0'
        svc = cells[idx_svc].upper() if idx_svc >= 0 and idx_svc < len(cells) else ''

        if 'SMS' in svc or 'SMS' in call_type:
            sms_count += 1
        elif 'DATA' in svc or 'GPRS' in svc:
            data_count += 1
        elif call_type in ('IN', 'MTC'):
            incoming += 1
        elif call_type in ('OUT', 'MOC'):
            outgoing += 1

        if bparty and re.match(r'\d{7,}', bparty):
            contact_counter[bparty] += 1

        # Sample timeline events (first 10 unique dates)
        if date and len(timeline_rows) < 10:
            try:
                dur_int = int(float(dur))
            except Exception:
                dur_int = 0
            event_desc = f"{call_type} call {'to' if call_type in ('OUT','MOC') else 'from'} {bparty}"
            if 'SMS' in svc:
                event_desc = f"SMS {'to' if call_type in ('OUT','MOC') else 'from'} {bparty}"
            if dur_int > 0:
                event_desc += f" ({dur_int}s)"
            if not any(r['date'] == date for r in timeline_rows):
                timeline_rows.append({'date': date, 'event': event_desc})

    # Top contacts
    top_contacts = [
        {'number': num, 'calls': str(cnt),
         'type': 'both' if contact_counter[num] > 1 else 'outgoing'}
        for num, cnt in contact_counter.most_common(8)
    ]

    highlights = [
        {'title': 'TOTAL RECORDS', 'subtitle': 'CDR Summary',
         'description': f'{total} call/SMS/data records found in the CDR'},
        {'title': 'INCOMING CALLS', 'subtitle': 'Call Direction',
         'description': f'{incoming} incoming calls received'},
        {'title': 'OUTGOING CALLS', 'subtitle': 'Call Direction',
         'description': f'{outgoing} outgoing calls made'},
    ]
    if sms_count:
        highlights.append({'title': 'SMS MESSAGES', 'subtitle': 'Messaging',
                           'description': f'{sms_count} SMS messages'})
    if top_contacts:
        top = top_contacts[0]
        highlights.append({'title': 'TOP CONTACT', 'subtitle': 'Frequent Contact',
                           'description': f"Number {top['number']} contacted {top['calls']} times"})

    return {
        'document_type': 'mobile_cdr',
        'source_id': source_id,
        'header': {
            'title': f'CDR Analysis: {phone_no}' if phone_no else 'Mobile CDR Analysis',
            'subtitle': f'{operator} | {date_range}' if operator else date_range,
        },
        'stat': {'value': str(total), 'label': 'Total Records'},
        'subject': {
            'Phone Number': phone_no,
            'Operator': operator,
            'Period': date_range,
        },
        'call_summary': {
            'incoming': str(incoming),
            'outgoing': str(outgoing),
            'sms': str(sms_count),
            'data': str(data_count),
        },
        'top_contacts': top_contacts,
        'timeline_events': sorted(timeline_rows, key=lambda x: x['date']),
        'highlights': highlights,
    }

# ============================================================================
# 1. TEXT EXTRACTION
# ============================================================================
class TextExtractorService:
    def _ocr_image_bytes(self, image_bytes: bytes, reader) -> str:
        """Run EasyOCR on raw PNG bytes from a rasterised page."""
        try:
            import io as _io
            from PIL import Image as _Image
            img = _Image.open(_io.BytesIO(image_bytes)).convert("RGB")
            lines = reader.readtext(np.array(img), detail=0, batch_size=4)
            return " ".join(lines).strip()
        except Exception as e:
            logger.warning(f"OCR on image bytes failed: {e}")
            return ""

    def _extract_sync(self, file_path: str) -> str:
        """
        Extract text from a file.
        For PDFs: per-page embedded text + per-page OCR fallback when sparse (< 200 chars).
        For images: direct EasyOCR.
        """
        logger.info(f"Extracting text from: {file_path}")
        if file_path.lower().endswith('.pdf'):
            try:
                import easyocr
                reader = easyocr.Reader(['en', 'hi'], gpu=False, verbose=False)
            except Exception as e:
                logger.warning(f"EasyOCR init failed: {e}")
                reader = None

            final_pages: list[str] = []
            try:
                doc = fitz.open(file_path)
            except Exception as e:
                logger.warning(f"PyMuPDF could not open '{file_path}': {e}")
                return ""

            for page_index, page in enumerate(doc):
                page_text_parts: list[str] = []

                # 1. Embedded text
                try:
                    embedded = page.get_text("text").strip()
                    if embedded:
                        page_text_parts.append(embedded)
                except Exception:
                    pass

                # 2. Text blocks (captures table cells and structured content)
                try:
                    blocks = page.get_text("blocks")
                    for block in blocks:
                        if block[6] == 0 and block[4].strip():
                            page_text_parts.append(block[4].strip())
                except Exception:
                    pass

                combined = "\n".join(page_text_parts).strip()

                # 3. Per-page OCR if text is sparse (scanned / image-based page)
                if len(combined) < 200 and reader is not None:
                    try:
                        pix = page.get_pixmap(dpi=300)
                        img_bytes = pix.tobytes("png")
                        ocr_text = self._ocr_image_bytes(img_bytes, reader)
                        if ocr_text:
                            logger.info(f"Page {page_index + 1}: OCR extracted {len(ocr_text)} chars")
                            page_text_parts.append("[OCR PAGE CONTENT]\n" + ocr_text)
                    except Exception as e:
                        logger.warning(f"Page {page_index + 1} OCR failed: {e}")

                # Deduplicate parts while preserving order
                final_pages.append("\n".join(dict.fromkeys(page_text_parts)))

            doc.close()
            return "\n\n".join(final_pages).strip()
        else:
            try:
                import easyocr
                reader = easyocr.Reader(['en'], gpu=False, verbose=False)
                return "\n".join(reader.readtext(file_path, detail=0))
            except Exception as e:
                logger.warning(f"EasyOCR failed: {e}")
                return ""

    async def extract_text_async(self, file_path: str) -> str:
        return await asyncio.to_thread(self._extract_sync, file_path)


# ============================================================================
# 2. TEXT CLEANING
# ============================================================================
class InfographicTextProcessor:
    def __init__(self):
        self.clean_patterns = [
            (re.compile(r' |&NBSP;', re.I), ' '),
            (re.compile(r'=+\s*PAGE\s*\d+\s*=+', re.I), ' '),
            (re.compile(r'(\w)\n(\w)'), r'\1 \2'),
            (re.compile(r'\n+'), '\n'),
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
# 3. LLM SERVICE — Universal Infographic Data Extractor
# ============================================================================
class InfographicLLMService:
    SYSTEM_PROMPT = """You are a data extraction expert. Your job is to read a document and extract REAL data from it into JSON format.

CRITICAL RULES:
1. Extract ONLY real data from the document - names, dates, numbers, places that actually appear in the text
2. NEVER use placeholder text like "Primary Subject Name", "Core Metric", "YYYY-MM-DD", "Field Name", "Value", "Location", "Detail", "Status"
3. If a field has no data, use null - do NOT invent placeholder text
4. Output ONLY valid JSON, no markdown fences, no explanation

STEP 1: Read the document and identify what type it is:
- If it contains phone call records, CDR data, IMEI numbers → use document_type: "mobile_cdr"
- If it contains bank account, transactions, balance, debit/credit → use document_type: "bank_statement"  
- If it contains FIR, police case, accused person, investigation → use document_type: "ir_document"
- Otherwise → use document_type: "general"

STEP 2: Extract ALL real data into this JSON structure:

{
  "source_id": "auto",
  "document_type": "<detected type>",
  "header": {
    "title": "<actual title from document - person name, account holder, phone number>",
    "subtitle": "<actual subtitle - date range, bank name, case summary>"
  },
  "stat": {
    "value": "<most important number from document - balance amount, call count, case count>",
    "label": "<what that number means>"
  },
  "subject": {
    "<actual field name from document>": "<actual value from document>"
  },
  "highlights": [
    {
      "title": "<actual finding title>",
      "subtitle": "<actual category or date>",
      "description": "<actual factual detail from document>"
    }
  ],
  "timeline_events": [
    {
      "date": "<actual date from document>",
      "event": "<actual event description>"
    }
  ],
  "case_details": [
    {
      "fir_no": "<actual FIR number>",
      "section": "<actual IPC section>",
      "date": "<actual date>",
      "police_station": "<actual police station name>",
      "status": "<actual status>"
    }
  ],
  "call_summary": {
    "incoming": "<actual count>",
    "outgoing": "<actual count>",
    "sms": "<actual count>",
    "data": "<actual count>"
  },
  "top_contacts": [
    {"number": "<actual phone number>", "calls": "<actual count>", "type": "incoming/outgoing/both"}
  ],
  "financial_summary": {
    "opening_balance": "<actual amount>",
    "closing_balance": "<actual amount>",
    "total_credits": "<actual amount>",
    "total_debits": "<actual amount>"
  },
  "key_transactions": [
    {"date": "<actual date>", "description": "<actual narration>", "amount": "<actual amount>", "type": "credit/debit", "balance": "<actual balance>"}
  ],
  "associates": [
    {"name": "<actual person name>", "relation": "<actual relation>"}
  ]
}

Include only the fields that have real data. Skip fields with no data.
"""

    def __init__(self, llm):
        self.llm = llm
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", self.SYSTEM_PROMPT),
            ("human", (
                "Extract ALL real data from this document into the JSON structure. "
                "Use ONLY actual names, numbers, dates, and facts from the document. "
                "Do NOT use any placeholder text.\n\n"
                "DOCUMENT:\n{text}"
            )),
        ])
        logger.info("InfographicLLMService initialized.")

    async def extract_dossier_async(self, text: str) -> Dict[str, Any]:
        logger.info("Extracting universal infographic structure with LLM...")
        messages = self.prompt.format_messages(text=text[:20000])
        logger.info("Calling llm.ainvoke...")
        response = await self.llm.ainvoke(messages)
        raw = response.content if hasattr(response, "content") else str(response)
        logger.info("llm.ainvoke completed. Parsing response...")

        # Strip any wrapper tags the model may add
        raw = re.sub(r'<think>.*?</think>', '', raw, flags=re.DOTALL)
        raw = re.sub(r'<answer>(.*?)</answer>', r'\1', raw, flags=re.DOTALL)
        raw = raw.strip()

        # Strip markdown fences
        fence = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', raw, re.DOTALL)
        candidate = fence.group(1) if fence else raw

        # Extract outermost JSON object
        brace = re.search(r'\{.*\}', candidate, re.DOTALL)
        if brace:
            try:
                result = json.loads(brace.group())
                logger.info("JSON parsed successfully.")
                return result
            except json.JSONDecodeError as e:
                logger.error(f"JSON parse failed: {e}")

        logger.error("Could not extract JSON from LLM output — returning empty dict")
        return {}



# ============================================================================
# 4. PIPELINE
# ============================================================================
class InfographicPipeline:
    def __init__(
        self,
        extractor: TextExtractorService,
        processor: InfographicTextProcessor,
        llm_service: InfographicLLMService,
    ):
        self.extractor = extractor
        self.processor = processor
        self.llm_service = llm_service

    async def generate_from_source_id(self, source_id: str) -> Dict[str, Any]:
        from open_notebook.domain.notebook import Source

        logger.info(f"Starting Infographic Generation for Source ID: {source_id}")

        source = await Source.get(source_id)
        if not source:
            return self._fallback("Unknown Source", "Source not found.")

        full_text = ""
        if source.full_text and source.full_text.strip():
            full_text = source.full_text
        elif source.asset and source.asset.file_path:
            full_text = await self.extractor.extract_text_async(source.asset.file_path)

        if not full_text:
            return self._fallback(source.title or "Unknown Source", "No text content found.")

        # ── CDR pre-processing: parse CSV and build structured summary ────────
        if _is_cdr_text(full_text):
            logger.info("CDR detected — using direct CSV parser instead of LLM")
            return _parse_cdr_direct(full_text, source_id)

        clean_text = await self.processor.clean_text(full_text)
        logger.info("Text cleaned. Calling LLM...")
        data = await self.llm_service.extract_dossier_async(clean_text)
        logger.info("LLM completed.")

        data["source_id"] = source_id
        data = _normalize_infographic_output(data, source.title or "Unknown Source", clean_text)
        logger.info(f"Infographic generated successfully for source_id: {source_id}")
        return data

    def _fallback(self, title: str, message: str) -> Dict[str, Any]:
        return {
            "source_id": "",
            "header": {"title": title.upper(), "subtitle": message},
            "left_column": [], "right_column": [], "stat": {}, "highlights": [],
        }


# ============================================================================
# 6. KAFKA ORCHESTRATOR LAYER (Distributed Processing)
# ============================================================================
class KafkaInfographicOrchestrator:
    """
    Wraps InfographicPipeline with Kafka Producer/Consumer logic.
    The consumer is for tracking/async results only — the HTTP endpoint
    runs the pipeline directly to avoid double execution.
    """

    def __init__(
        self,
        pipeline: Optional[InfographicPipeline],
        bootstrap_servers: str = None,
        input_topic: str = "infographic_jobs",
        output_topic: str = "infographic_results",
        group_id: str = "infographic_worker_group",
    ):
        self.pipeline = pipeline
        self.bootstrap_servers = bootstrap_servers or os.environ.get(
            "KAFKA_BOOTSTRAP_SERVERS", "kafka:9093"
        )
        self.input_topic = input_topic
        self.output_topic = output_topic
        self.group_id = group_id

    async def produce_jobs(self, source_ids: List[str]):
        """Publish infographic job tracking events to Kafka (fire-and-forget)."""
        producer = AIOKafkaProducer(bootstrap_servers=self.bootstrap_servers)
        await producer.start()
        logger.info(f"Kafka Infographic Producer: sending {len(source_ids)} tracking events...")
        try:
            for sid in source_ids:
                payload = json.dumps({"source_id": sid, "status": "started"}).encode("utf-8")
                await producer.send_and_wait(self.input_topic, payload)
        except Exception as e:
            logger.error(f"Failed to produce infographic Kafka messages: {e}")
        finally:
            await producer.stop()

    async def _send_result(self, producer, source_id: str, result: Dict[str, Any], status: str):
        payload = json.dumps(
            {"source_id": source_id, "status": status, "data": result}
        ).encode("utf-8")
        await producer.send_and_wait(self.output_topic, payload)

    async def start_consumer(self, max_concurrent: int = 3):
        """
        Consume tracking events from Kafka.
        NOTE: Does NOT re-run the pipeline — the HTTP endpoint handles execution.
        This consumer only logs/tracks job events. No output topic needed.
        """
        consumer = AIOKafkaConsumer(
            self.input_topic,
            bootstrap_servers=self.bootstrap_servers,
            group_id=self.group_id,
            auto_offset_reset="latest",  # Only process new messages, not backlog
        )

        await consumer.start()
        logger.info(f"Kafka Infographic Consumer listening on topic '{self.input_topic}' (tracking only)...")

        async def process_message(msg):
            try:
                payload = json.loads(msg.value.decode("utf-8"))
                source_id = payload.get("source_id")
                status = payload.get("status", "unknown")
                logger.info(f"Kafka tracking event: source_id={source_id}, status={status}")
            except Exception as e:
                logger.error(f"Kafka tracking message error: {e}")

        try:
            async for msg in consumer:
                asyncio.create_task(process_message(msg))
        finally:
            await consumer.stop()
            logger.info("Kafka Infographic Consumer stopped.")

    async def _send_result(self, producer, source_id: str, result: Dict[str, Any], status: str):
        """No-op: output topic removed to avoid 'topic not found' errors."""
        pass
