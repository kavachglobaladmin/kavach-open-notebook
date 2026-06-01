"""
Heuristic parsing of mobile / CDR style dumps (CSV, TSV, plain text logs).
Produces structured sections for UI and optional searchable full_text blob.

Dynamic version notes:
- Long keyword/regex based report detection has been removed.
- Column/report detection is now data-driven from the uploaded file's actual headers and values.
- Optional runtime config can extend/override role detection without editing this file.
- Existing output structure and parsing logic are preserved and extended.
"""

from __future__ import annotations

import csv
import io
import json
import re
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

# -- Dynamic detection configuration -------------------------------------------
# No fixed mobile/CDR vendor keyword block is required here.
# All parser rules are created at runtime from config + value-shape inference.
#
# Example override:
# run_pipeline_from_text(text, config={
#     "phone": {"country_prefixes": ["91"], "national_lengths": [10], "leading_digits": "6789"},
#     "role_aliases": {"datetime": ["Start Time"], "duration": ["Call Duration"]},
#     "event_labels": {"sms": ["SMS"], "in": ["Incoming"], "out": ["Outgoing"]},
# })

DEFAULT_DETECTION_CONFIG: dict[str, Any] = {
    "phone": {
        "country_prefixes": [],       # Optional, e.g. ["91"]. Empty = generic international/local numbers.
        "national_lengths": [10, 11, 12, 13, 14, 15],
        "leading_digits": "",        # Optional, e.g. "6789". Empty = no start-digit restriction.
        "strip_local_zero": True,
    },
    "date_formats": [],              # Optional strptime formats. Empty = auto parse common numeric dates.
    "role_aliases": {},              # Optional role -> source column aliases.
    "event_labels": {},              # Optional canonical event -> source values.
}

_NUMERIC_TOKEN = re.compile(r"\d+")
_WORD_TOKEN = re.compile(r"[a-z0-9]+")
_IMEI_LENGTH = 15


def _runtime_config(config: dict[str, Any] | None = None) -> dict[str, Any]:
    merged = json.loads(json.dumps(DEFAULT_DETECTION_CONFIG))
    for key, value in (config or {}).items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key].update(value)
        else:
            merged[key] = value
    return merged


def _configured_phone_regex(config: dict[str, Any] | None = None) -> re.Pattern[str]:
    cfg = _runtime_config(config).get("phone", {})
    lengths = [int(x) for x in cfg.get("national_lengths", [10]) if str(x).isdigit()] or [10]
    min_len, max_len = min(lengths), max(lengths)
    leading = str(cfg.get("leading_digits") or "")
    first = f"[{re.escape(leading)}]" if leading else r"\d"
    body = f"{first}\\d{{{min_len - 1},{max_len - 1}}}"
    prefixes = [re.escape(str(x).lstrip("+")) for x in cfg.get("country_prefixes", []) if str(x)]
    if prefixes:
        prefix_group = "|".join(prefixes)
        return re.compile(rf"(?:\+|00)?(?:{prefix_group})?[\s.-]?({body})\b|\b0?({body})\b")
    return re.compile(rf"(?<!\d)(\+?\d{{{min_len},{max_len}}})(?!\d)")


def _extract_phones(text: str, config: dict[str, Any] | None = None) -> list[str]:
    cfg = _runtime_config(config).get("phone", {})
    allowed_lengths = {int(x) for x in cfg.get("national_lengths", []) if str(x).isdigit()}
    leading = str(cfg.get("leading_digits") or "")
    values: set[str] = set()
    for match in _configured_phone_regex(config).finditer(text or ""):
        raw = next((g for g in match.groups() if g), match.group(0))
        digits = re.sub(r"\D", "", raw)
        for prefix in cfg.get("country_prefixes", []):
            prefix = str(prefix).lstrip("+")
            if prefix and digits.startswith(prefix) and len(digits) - len(prefix) in allowed_lengths:
                digits = digits[len(prefix):]
                break
        if cfg.get("strip_local_zero", True) and digits.startswith("0") and len(digits[1:]) in allowed_lengths:
            digits = digits[1:]
        if allowed_lengths and len(digits) not in allowed_lengths:
            continue
        if leading and (not digits or digits[0] not in leading):
            continue
        values.add(digits)
    return sorted(values)


def _merged_role_aliases(config: dict[str, Any] | None = None) -> dict[str, tuple[str, ...]]:
    aliases: dict[str, tuple[str, ...]] = {}
    user_aliases = _runtime_config(config).get("role_aliases") or {}
    for role, values in user_aliases.items():
        if isinstance(values, str):
            aliases[str(role)] = (values,)
        else:
            aliases[str(role)] = tuple(str(v) for v in values)
    return aliases


def _norm_key(value: str) -> str:
    return "".join(_WORD_TOKEN.findall((value or "").lower()))


def _token_set(value: str) -> set[str]:
    return set(_WORD_TOKEN.findall((value or "").lower()))


def _role_score(key: str, values: list[str], role: str, aliases: dict[str, tuple[str, ...]], config: dict[str, Any] | None = None) -> int:
    key_n = _norm_key(key)
    role_n = _norm_key(role)
    score = 0

    # 1) Runtime aliases supplied by caller.
    for alias in aliases.get(role, ()):  # caller-controlled, not hardcoded in the parser
        alias_n = _norm_key(alias)
        if alias_n and alias_n in key_n:
            score += 8

    # 2) Generic role-name match. Example: role "cell_id" matches columns like "cell id".
    if role_n and role_n in key_n:
        score += 6

    # 3) Value-shape inference where possible.
    sample_values = [str(v) for v in values[:50] if str(v).strip()]
    sample = " | ".join(sample_values)
    if role == "datetime" and _parse_datetime(sample, config=config):
        score += 4
    elif role == "duration" and any(_duration_to_sec(v, config=config) is not None for v in sample_values[:25]):
        score += 4
    elif role == "imei" and any(len(re.sub(r"\D", "", v)) == _IMEI_LENGTH for v in sample_values[:25]):
        score += 4
    elif role in {"latitude", "longitude"}:
        numeric = [_safe_float(v) for v in sample_values[:25]]
        numeric = [n for n in numeric if n is not None]
        if numeric:
            if role == "latitude" and all(-90 <= n <= 90 for n in numeric[:10]):
                score += 1
            if role == "longitude" and all(-180 <= n <= 180 for n in numeric[:10]):
                score += 1
    return score


def _infer_column_roles(rows: list[dict[str, Any]], config: dict[str, Any] | None = None) -> dict[str, list[str]]:
    aliases = _merged_role_aliases(config)
    field_values: defaultdict[str, list[str]] = defaultdict(list)
    for row in rows:
        for key, value in _raw_values(row).items():
            if len(field_values[key]) < 50:
                field_values[key].append(value)

    roles: defaultdict[str, list[str]] = defaultdict(list)
    for field, values in field_values.items():
        for role in set(aliases) | {"datetime", "duration", "direction", "operator", "lac", "cell_id", "location_text", "latitude", "longitude", "imei", "imsi"}:
            if _role_score(field, values, role, aliases, config=config) > 0:
                roles[role].append(field)
    return dict(roles)


def _safe_float(value: Any) -> float | None:
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return None


def sniff_maybe_mobile(title: str | None, path: str | None, snippet: str, config: dict[str, Any] | None = None) -> bool:
    """Lightweight classifier using structure rather than title keyword matching."""
    blob = " ".join(filter(None, [title or "", Path(path).name if path else "", snippet[:8000]]))
    if not blob.strip():
        return False
    phone_count = len(_extract_phones(blob, config=config))
    digit_count = sum(1 for c in blob if c.isdigit())
    delimiter_count = sum(blob.count(d) for d in ("|", ",", "\t", ";"))
    has_date = _parse_datetime(blob, config=config) is not None
    has_duration = any(_duration_to_sec(part, config=config) is not None for part in re.split(r"[|,;\t\n]", blob[:4000]))
    return phone_count >= 2 or (phone_count >= 1 and digit_count > 80 and delimiter_count >= 8) or (phone_count >= 1 and has_date and has_duration)


def _parse_datetime(text: str, config: dict[str, Any] | None = None) -> datetime | None:
    text = (text or "").strip()
    if not text:
        return None

    for fmt in _runtime_config(config).get("date_formats", []) or []:
        try:
            return datetime.strptime(text, str(fmt))
        except (ValueError, TypeError):
            pass

    if _has_date_signal(text):
        try:
            from dateutil import parser as date_parser  # type: ignore
            # fuzzy=True lets the parser find date/time inside mixed row text.
            parsed = date_parser.parse(text, fuzzy=True, dayfirst=True, default=datetime(1900, 1, 1))
            return parsed if _is_valid_analysis_datetime(parsed) else None
        except Exception:
            pass

    # Lightweight fallback for numeric dates when python-dateutil is unavailable.
    time_match = re.search(r"\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b", text)
    hour = minute = second = 0
    if time_match:
        hour = int(time_match.group(1))
        minute = int(time_match.group(2))
        second = int(time_match.group(3) or 0)
    for rg, fmt in (
        (re.compile(r"\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2}|\d{2})\b"), "dmy"),
        (re.compile(r"\b(20\d{2})-(\d{1,2})-(\d{1,2})\b"), "ymd"),
    ):
        m = rg.search(text)
        if not m:
            continue
        try:
            if fmt == "dmy":
                d, mn, y = m.groups()
                yi = int(y) + (2000 if int(y) < 100 else 0)
                return datetime(yi, int(mn), int(d), hour, minute, second)
            y, mn, d = m.groups()
            return datetime(int(y), int(mn), int(d), hour, minute, second)
        except (ValueError, TypeError):
            continue
    return None


def _duration_to_sec(text: str, config: dict[str, Any] | None = None) -> int | None:
    t = (text or "").lower().strip()
    if not t:
        return None

    # HH:MM:SS style duration. Bare HH:MM is treated as clock time, not duration.
    m = re.fullmatch(r"(\d{1,3}):(\d{2}):(\d{2})", t)
    if m:
        h, mn, sec = int(m.group(1)), int(m.group(2)), int(m.group(3))
        return h * 3600 + mn * 60 + sec

    # Pure numeric duration. Default interpretation is seconds, but caller can override.
    if re.fullmatch(r"\d{1,6}", t):
        multiplier = int((_runtime_config(config).get("duration_number_unit") or "1"))
        return int(t) * multiplier

    # Unit-bearing values are parsed generically from number+unit pairs.
    multipliers = (_runtime_config(config).get("duration_units") or {
        "h": 3600, "hr": 3600, "hrs": 3600, "hour": 3600, "hours": 3600,
        "m": 60, "min": 60, "mins": 60, "minute": 60, "minutes": 60,
        "s": 1, "sec": 1, "secs": 1, "second": 1, "seconds": 1,
    })
    total = 0
    found = False
    for amount, unit in re.findall(r"(\d+)\s*([a-z]+)", t):
        if unit in multipliers:
            total += int(amount) * int(multipliers[unit])
            found = True
    return total if found else None


def _has_date_signal(text: str) -> bool:
    """Return True only when text contains a real date-like token, not just a time/number."""
    if not text:
        return False
    if re.search(r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b", text):
        return True
    if re.search(r"\b\d{4}[/-]\d{1,2}[/-]\d{1,2}\b", text):
        return True
    if re.search(r"\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b", text, re.I):
        return True
    return False


def _is_valid_analysis_datetime(dt: datetime | None) -> bool:
    """Reject parser defaults such as year 1900 caused by time-only strings."""
    return bool(dt and 1970 <= dt.year <= 2100)


def _display_day(dt: datetime) -> str:
    """Internal API date format for frontend display: dd-mm-yyyy."""
    return dt.strftime("%d-%m-%Y")


def _get_role_value(raw: dict[str, str], role: str, roles: dict[str, list[str]]) -> str:
    for field in roles.get(role, []):
        value = raw.get(field, "")
        if value not in (None, ""):
            return str(value)
    return ""


def _classify_event(kind_text: str, full_text: str, config: dict[str, Any] | None = None) -> str:
    event_labels = _runtime_config(config).get("event_labels") or {}
    compact_kind = _norm_key(kind_text or "")
    compact_full = _norm_key(full_text or "")
    for canonical, labels in event_labels.items():
        labels = [labels] if isinstance(labels, str) else labels
        for label in labels:
            label_n = _norm_key(str(label))
            if label_n and (label_n == compact_kind or label_n in compact_full):
                return str(canonical).lower()

    # Dynamic fallback: keep the source value instead of forcing a static mapping.
    # If the source value is exactly sms/in/out, existing downstream logic still works.
    if compact_kind:
        return compact_kind[:12]
    return ""


def _discover_csv_roles(text: str, dialect: csv.Dialect, config: dict[str, Any] | None = None) -> dict[str, list[str]]:
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    temp_rows: list[dict[str, Any]] = []
    for idx, raw in enumerate(reader):
        temp_rows.append({"raw": {str(k): v for k, v in raw.items()}})
        if idx >= 200:
            break
    return _infer_column_roles(temp_rows, config=config)


def extract_records_from_csv(text: str, config: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",\t|;")
    except csv.Error:
        dialect = csv.excel_tab if "\t" in sample.split("\n", 1)[0] else csv.excel
    roles = _discover_csv_roles(text, dialect, config=config)
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    for raw_in in reader:
        raw = {str(k): "" if v is None else str(v) for k, v in raw_in.items()}
        line = "|".join(str(v) for v in raw.values())
        nums = _extract_phones(line, config=config)

        dt_parts = [_get_role_value(raw, "datetime", roles)]
        dt_raw = " ".join(x for x in dt_parts if x).strip()
        dt = _parse_datetime(dt_raw, config=config) if dt_raw else _parse_datetime(line, config=config)

        dur_sec: int | None = None
        dur_value = _get_role_value(raw, "duration", roles)
        if dur_value:
            dur_sec = _duration_to_sec(dur_value, config=config)
        if dur_sec is None:
            for value in raw.values():
                dur_sec = _duration_to_sec(value, config=config)
                if dur_sec is not None:
                    break

        kind = _get_role_value(raw, "direction", roles)
        ctype = _classify_event(kind, line, config=config)

        rows.append(
            {
                "phones": nums,
                "datetime": dt.isoformat() if dt else None,
                "duration_sec": dur_sec,
                "type": ctype,
                "raw": raw,
                "_detected_roles": roles,
            }
        )
    return rows


def extract_records_from_lines(text: str, config: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for line in text.splitlines():
        ln = line.strip()
        if not ln or ln.startswith("#"):
            continue
        nums = _extract_phones(ln, config=config)
        if not nums and "|" not in ln:
            continue
        dt = _parse_datetime(ln, config=config)
        dur = None
        for part in re.split(r"[|,;\t]", ln):
            d = _duration_to_sec(part, config=config)
            if d is not None:
                dur = d
                break
        ctype = _classify_event("", ln, config=config)
        rows.append(
            {
                "phones": nums,
                "datetime": dt.isoformat() if dt else None,
                "duration_sec": dur,
                "type": ctype,
                "raw_line": ln[:500],
            }
        )
    return rows


def _raw_values(record: dict[str, Any]) -> dict[str, str]:
    raw = record.get("raw")
    if isinstance(raw, dict):
        return {str(k): "" if v is None else str(v) for k, v in raw.items()}
    raw_line = record.get("raw_line")
    if raw_line:
        return {"raw_line": str(raw_line)}
    return {}


def _first_role_value(record: dict[str, Any], role: str, roles: dict[str, list[str]]) -> str | None:
    raw = _raw_values(record)
    value = _get_role_value(raw, role, roles)
    return value.strip() if value else None


def _extract_dynamic_location(record: dict[str, Any], roles: dict[str, list[str]]) -> dict[str, str | None]:
    raw = _raw_values(record)
    combined = " | ".join(f"{k}:{v}" for k, v in raw.items())
    lac = _first_role_value(record, "lac", roles)
    cell_id = _first_role_value(record, "cell_id", roles)
    address = _first_role_value(record, "location_text", roles)
    latitude = _first_role_value(record, "latitude", roles)
    longitude = _first_role_value(record, "longitude", roles)

    # Generic label fallback for unstructured lines only.
    if not lac:
        m = re.search(r"\b(?:lac|location\s*area)[\s:=]+(\d{3,8})\b", combined, re.I)
        lac = m.group(1) if m else None
    if not cell_id:
        m = re.search(r"\b(?:cell|cid|tower|site)[\s_]*(?:id)?[\s:=]+(\d{3,10})\b", combined, re.I)
        cell_id = m.group(1) if m else None

    return {
        "datetime": record.get("datetime"),
        "lac": lac,
        "cell_id": cell_id,
        "address": address,
        "latitude": latitude,
        "longitude": longitude,
    }



def _communication_event_label(record: dict[str, Any]) -> str:
    """Return a user-facing dynamic event label.

    Avoids displaying a blank/static `unclassified` value. When the export does
    not provide a direction/service column, infer a readable event bucket from
    available row shape while still preserving any real source event value.
    """
    raw_type = str(record.get("type") or "").strip()
    if raw_type and raw_type.lower() not in {"unclassified", "unknown", "none", "null", "na", "n/a"}:
        return raw_type.replace("_", " ").title()

    duration = record.get("duration_sec")
    try:
        duration_i = int(duration or 0)
    except (TypeError, ValueError):
        duration_i = 0

    phones = record.get("phones") or []
    if duration_i > 0:
        return "Voice call"
    if len(phones) >= 2:
        return "Contact communication"
    if len(phones) == 1:
        return "Single-party communication"
    return "Communication row"


def _unique_contacts_by_day(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    buckets: defaultdict[str, set[str]] = defaultdict(set)
    for r in records:
        dts = r.get("datetime")
        if not dts:
            continue
        try:
            dt = datetime.fromisoformat(str(dts))
            if not _is_valid_analysis_datetime(dt):
                continue
            day = _display_day(dt)
        except (ValueError, TypeError):
            continue
        for phone in r.get("phones") or []:
            buckets[day].add(str(phone))
    return sorted(
        [{"period": day, "count": len(values)} for day, values in buckets.items()],
        key=lambda x: datetime.strptime(x["period"], "%d-%m-%Y"),
    )

def _build_sms_activity(records: list[dict[str, Any]]) -> dict[str, Any]:
    """Build SMS/message report without hiding source-driven event values."""
    event_counter: Counter[str] = Counter(_communication_event_label(r) for r in records)
    zero_duration_rows = [r for r in records if int(r.get("duration_sec") or 0) == 0]
    sms_rows = [r for r in records if str(r.get("type") or "").lower() == "sms"]

    # When the dynamic classifier cannot confidently label SMS rows, still provide
    # a useful communication breakdown instead of an empty-looking card.
    report_rows = sms_rows if sms_rows else zero_duration_rows
    sms_by_day: Counter[str] = Counter()
    sms_by_hour: Counter[int] = Counter()
    sms_contacts: Counter[str] = Counter()

    for r in report_rows:
        for p in r.get("phones") or []:
            sms_contacts[p] += 1
        dts = r.get("datetime")
        if dts:
            try:
                dt = datetime.fromisoformat(dts)
                if _is_valid_analysis_datetime(dt):
                    sms_by_day[_display_day(dt)] += 1
                    sms_by_hour[dt.hour] += 1
            except (ValueError, TypeError):
                pass

    return {
        "total_sms": len(sms_rows),
        "message_like_rows": len(zero_duration_rows),
        "source_event_breakdown": [{"event_type": k, "count": v} for k, v in event_counter.most_common(20)],
        "by_day": sorted([{"period": d, "count": c} for d, c in sms_by_day.items()], key=lambda x: datetime.strptime(x["period"], "%d-%m-%Y")),
        "by_hour": [{"hour": h, "count": sms_by_hour.get(h, 0)} for h in range(24)],
        "unique_contacts_by_day": _unique_contacts_by_day(report_rows),
        "top_sms_contacts": [{"number": n, "sms_count": c} for n, c in sms_contacts.most_common(25)],
        "notes": "Communication rows are grouped from detected row values. If no explicit SMS/service label exists, the report uses row shape, duration, contacts and timestamps to create meaningful buckets.",
    }

def _build_call_movement(records: list[dict[str, Any]], roles: dict[str, list[str]]) -> dict[str, Any]:
    """Build tower/location movement and communication-sequence movement.

    If the source has no tower/location columns, the report still returns contact
    sequence transitions derived from timestamped rows so the UI is not blank.
    """
    movement_rows: list[dict[str, Any]] = []
    tower_counter: Counter[str] = Counter()
    communication_sequence: list[dict[str, Any]] = []
    transition_counter: Counter[str] = Counter()

    sorted_records = sorted(records, key=lambda r: str(r.get("datetime") or ""))
    previous_phone: str | None = None

    for r in sorted_records:
        loc = _extract_dynamic_location(r, roles)
        phones = [str(p) for p in (r.get("phones") or [])]
        current_phone = phones[0] if phones else None
        dts = r.get("datetime")

        if current_phone:
            item = {
                "datetime": dts,
                "period": "",
                "from": previous_phone or "start",
                "to": current_phone,
                "type": _communication_event_label(r),
                "duration_sec": r.get("duration_sec"),
            }
            if dts:
                try:
                    dt = datetime.fromisoformat(str(dts))
                    if _is_valid_analysis_datetime(dt):
                        item["period"] = _display_day(dt)
                except (ValueError, TypeError):
                    pass
            communication_sequence.append(item)
            if previous_phone:
                transition_counter[f"{previous_phone} -> {current_phone}"] += 1
            previous_phone = current_phone

        if any(loc.get(k) for k in ("lac", "cell_id", "address", "latitude", "longitude")):
            tower_key = " / ".join([str(loc.get("lac") or ""), str(loc.get("cell_id") or "")]).strip(" /")
            if not tower_key and loc.get("address"):
                tower_key = str(loc["address"])
            if tower_key:
                tower_counter[tower_key] += 1
            movement_rows.append({**loc, "type": r.get("type") or "", "phones": phones, "duration_sec": r.get("duration_sec")})

    movement_rows.sort(key=lambda x: x.get("datetime") or "")
    return {
        "total_location_rows": len(movement_rows),
        "unique_towers": len(tower_counter),
        "top_towers": [{"tower": tower, "count": count} for tower, count in tower_counter.most_common(25)],
        "movement_sequence": movement_rows[-100:],
        "communication_sequence": communication_sequence[-100:],
        "top_contact_transitions": [{"transition": k, "count": v} for k, v in transition_counter.most_common(25)],
        "sequence_by_day": _unique_contacts_by_day(sorted_records),
        "total_sequence_rows": len(communication_sequence),
        "notes": "Tower movement is used when location columns exist. Otherwise contact-to-contact communication sequence is shown dynamically from source rows.",
    }

def _build_dynamic_field_report(records: list[dict[str, Any]], roles: dict[str, list[str]]) -> dict[str, Any]:
    field_counter: Counter[str] = Counter()
    populated_counter: Counter[str] = Counter()
    sample_values: defaultdict[str, list[str]] = defaultdict(list)
    for r in records:
        raw = _raw_values(r)
        for key, value in raw.items():
            field_counter[key] += 1
            value = value.strip()
            if value:
                populated_counter[key] += 1
                if len(sample_values[key]) < 3 and value not in sample_values[key]:
                    sample_values[key].append(value[:120])
    return {
        "detected_roles": roles,
        "detected_fields": [
            {"field": key, "rows_seen": field_counter[key], "populated_rows": populated_counter.get(key, 0), "sample_values": sample_values.get(key, [])}
            for key, _ in field_counter.most_common()
        ],
        "notes": "Generated from actual uploaded columns/raw lines. Role aliases can be changed through config instead of code edits.",
    }


def _is_noise_provider_label(value: str) -> bool:
    """Reject generic export labels so only real operator/provider names remain."""
    text = re.sub(r"\s+", " ", (value or "").strip())
    if not text:
        return True
    low = text.lower().strip(" :-_\t")
    if low in {"none", "null", "nil", "na", "n/a", "-", "--", "unknown", "not available"}:
        return True
    # These are column/header labels, not operator/provider names.
    if re.search(r"\b(target\s*no|target\s*number|mobile\s*no|subscriber\s*no|msisdn|phone\s*no|date|time|duration|record|row|type|direction)\b", low):
        return True
    # Very broad geography labels alone should not be shown as providers.
    if low in {"pan india", "india", "all india"}:
        return True
    return False


def _looks_like_named_entity(value: str) -> bool:
    """Generic provider/entity fallback without a predefined operator list."""
    text = re.sub(r"\s+", " ", (value or "").strip())
    if _is_noise_provider_label(text):
        return False
    if not (4 <= len(text) <= 80):
        return False
    alpha = sum(1 for c in text if c.isalpha())
    digits = sum(1 for c in text if c.isdigit())
    if alpha < 4 or digits > alpha:
        return False
    # Prefer values that look like exported organisation/provider labels rather than row IDs.
    words = [w for w in re.split(r"[^A-Za-z]+", text) if w]
    if not words:
        return False
    return alpha / max(len(text), 1) >= 0.45 and any(len(w) >= 4 for w in words)


def _extract_operator_values(records: list[dict[str, Any]], roles: dict[str, list[str]]) -> list[str]:
    values: Counter[str] = Counter()
    for r in records:
        value = _first_role_value(r, "operator", roles)
        if value and _looks_like_named_entity(value):
            values[value.strip()] += 1

    # Fallback: some telecom exports place the provider name in a heading/header
    # column rather than a row value. This remains data-driven: it scans actual
    # uploaded field names and values instead of using a fixed provider list.
    if not values:
        for r in records[:50]:
            raw = _raw_values(r)
            for key, value in raw.items():
                for candidate in (key, value):
                    candidate = re.sub(r"\s+", " ", str(candidate or "").strip())
                    if _looks_like_named_entity(candidate):
                        values[candidate] += 1
    cleaned: list[str] = []
    seen: set[str] = set()
    for value, _ in values.most_common(50):
        text = re.sub(r"\s+", " ", str(value or "").strip())
        if not _looks_like_named_entity(text):
            continue
        low = text.lower()
        if low in seen:
            continue
        seen.add(low)
        cleaned.append(text)
        if len(cleaned) >= 25:
            break
    return cleaned


def _extract_network_circle_values(records: list[dict[str, Any]], roles: dict[str, list[str]]) -> list[str]:
    """Extract network circle/region-like values without mixing them into provider names."""
    values: Counter[str] = Counter()
    for r in records:
        raw = _raw_values(r)
        for key, value in raw.items():
            key_l = str(key or "").lower()
            text = re.sub(r"\s+", " ", str(value or "").strip())
            if not text or _is_noise_provider_label(text):
                continue
            if "circle" in key_l or "region" in key_l or "zone" in key_l:
                values[text] += 1
            elif re.search(r"\b(pan india|[a-z ]+ circle)\b", text, re.I) and not re.search(r"target\s*no", text, re.I):
                values[text] += 1
    return [v for v, _ in values.most_common(20)]


def _extract_device_values(records: list[dict[str, Any]], roles: dict[str, list[str]]) -> dict[str, Any]:
    imei_values: Counter[str] = Counter()
    imsi_values: Counter[str] = Counter()
    for r in records:
        raw = _raw_values(r)
        for role, counter in (("imei", imei_values), ("imsi", imsi_values)):
            value = _get_role_value(raw, role, roles)
            if value:
                digits = re.sub(r"\D", "", value)
                if digits:
                    counter[digits] += 1
        for token in re.findall(r"(?<!\d)\d{15}(?!\d)", " | ".join(raw.values())):
            imei_values[token] += 1
    return {
        "imei_candidates": [v for v, _ in imei_values.most_common(20)],
        "imsi_candidates": [v for v, _ in imsi_values.most_common(20)],
        "notes": "Device/SIM values are read from detected columns and generic 15-digit candidates; validate against original export.",
    }



def _build_informative_insights(
    summary: dict[str, Any],
    source_details: dict[str, Any],
    sms_activity: dict[str, Any],
    call_movement: dict[str, Any],
    location: dict[str, Any],
    device_sim: dict[str, Any],
    suspicious: list[dict[str, str]],
    intelligence: dict[str, Any],
) -> dict[str, Any]:
    """Build one frontend-ready insights block instead of separate low-value cards.

    This keeps the existing pipeline outputs intact for compatibility, but gives the UI
    a single richer section that replaces Location / Device & SIM / Suspicious /
    Intelligence cards when desired.
    """
    operators = source_details.get("operators_detected") or summary.get("operators_detected") or []
    if not isinstance(operators, list):
        operators = [operators]
    top_transitions = call_movement.get("top_contact_transitions") or []
    top_transition = top_transitions[0] if isinstance(top_transitions, list) and top_transitions else {}
    imeis = device_sim.get("imei_candidates") or []
    imsis = device_sim.get("imsi_candidates") or []
    location_values: list[str] = []
    for key in ("location_values", "network_circle_values", "lat_long_values"):
        vals = location.get(key) or []
        if isinstance(vals, list):
            location_values.extend(str(v) for v in vals if v)
    for key, prefix in (("lac_values", "LAC"), ("cell_id_values", "Cell")):
        vals = location.get(key) or []
        if isinstance(vals, list):
            location_values.extend(f"{prefix} {v}" for v in vals if v)

    cards = [
        {
            "title": "Communication concentration",
            "value": (
                f"{top_transition.get('transition')} ({top_transition.get('count')})"
                if top_transition and top_transition.get("transition")
                else "No dominant contact path detected"
            ),
            "detail": "Most frequent source-to-destination path from parsed communication rows.",
            "accent": "#2563eb",
        },
        {
            "title": "Network/provider evidence",
            "value": ", ".join(str(x) for x in operators if x) or "Provider not detected",
            "detail": "Provider values are taken only from detected provider/operator fields after cleanup.",
            "accent": "#0d9488",
        },
        {
            "title": "Location evidence",
            "value": ", ".join(location_values[:4]) if location_values else "No tower/location columns detected",
            "detail": (
                "Location evidence comes from detected LAC, Cell ID, tower, circle or coordinate fields."
                if location_values
                else "Communication movement is shown because no tower/location fields were present."
            ),
            "accent": "#0891b2",
        },
        {
            "title": "Device/SIM evidence",
            "value": ", ".join(str(x) for x in (list(imeis) + list(imsis))[:4]) if (imeis or imsis) else "No device/SIM identifiers detected",
            "detail": "Identifiers are extracted from detected device/SIM fields or reliable 15-digit candidates; validate against the original source.",
            "accent": "#6366f1",
        },
    ]

    summary_rows = [
        {"label": "Parsed communication rows", "value": summary.get("parsed_rows")},
        {"label": "Unique contacts", "value": summary.get("unique_contacts")},
        {"label": "Date span", "value": summary.get("date_range")},
        {"label": "Night activity", "value": f"{summary.get('night_activity_pct', 0)}%"},
        {"label": "Message-like rows", "value": sms_activity.get("message_like_rows") or sms_activity.get("total_sms") or 0},
        {"label": "Sequence rows", "value": call_movement.get("total_sequence_rows") or len(call_movement.get("communication_sequence") or [])},
    ]
    if suspicious:
        summary_rows.append({"label": "Review flags", "value": ", ".join(x.get("title", "") for x in suspicious if x.get("title"))})

    evidence_trail: list[dict[str, Any]] = []
    for row in (call_movement.get("communication_sequence") or call_movement.get("movement_sequence") or [])[-8:]:
        if isinstance(row, dict):
            event = row.get("event_label") or row.get("type") or "Communication"
            from_v = row.get("from") or row.get("number") or row.get("lac") or row.get("cell_id") or "-"
            to_v = row.get("to") or row.get("location") or ""
            detail = f"{from_v} -> {to_v}" if to_v else str(from_v)
            evidence_trail.append({"label": row.get("period") or row.get("datetime") or event, "detail": detail, "value": event})

    observations = list(intelligence.get("insights") or [])
    if not observations:
        observations = [
            f"Analysed {summary.get('parsed_rows', 0)} rows across {summary.get('unique_contacts', 0)} unique contacts.",
            f"Date coverage: {summary.get('date_range') or '-'}.",
        ]

    return {
        "cards": cards,
        "summary_rows": summary_rows,
        "evidence_trail": evidence_trail,
        "observations": observations,
        "notes": "Frontend-ready insight block generated from parsed source rows; original detailed sections remain in response for compatibility.",
    }

def _build_location_summary(call_movement: dict[str, Any], records: list[dict[str, Any]] | None = None, roles: dict[str, list[str]] | None = None) -> dict[str, Any]:
    movement_rows = call_movement.get("movement_sequence") or []
    lac_values = sorted({str(x.get("lac")) for x in movement_rows if x.get("lac")})[:40]
    cell_values = sorted({str(x.get("cell_id")) for x in movement_rows if x.get("cell_id")})[:40]
    location_values = sorted({str(x.get("address") or x.get("location")) for x in movement_rows if x.get("address") or x.get("location")})[:40]
    lat_long_values = []
    seen_lat_long = set()
    for x in movement_rows:
        lat, lon = x.get("latitude"), x.get("longitude")
        if lat and lon:
            pair = f"{lat}, {lon}"
            if pair not in seen_lat_long:
                seen_lat_long.add(pair)
                lat_long_values.append(pair)
        if len(lat_long_values) >= 40:
            break
    network_circle_values = _extract_network_circle_values(records or [], roles or {})
    top_towers = call_movement.get("top_towers") or []
    has_location_data = bool(lac_values or cell_values or location_values or lat_long_values or network_circle_values or top_towers)
    return {
        "lac_values": lac_values,
        "cell_id_values": cell_values,
        "location_values": location_values,
        "lat_long_values": lat_long_values,
        "network_circle_values": network_circle_values,
        "top_towers": top_towers,
        "movement_rows": movement_rows,
        "has_location_data": has_location_data,
        "notes": (
            "Location values are taken from dynamically detected movement/location columns, tower/cell fields, or network circle fields when present."
            if has_location_data
            else "No location, LAC, Cell ID, latitude or longitude fields were present in the parsed source rows."
        ),
    }


def _print_pipeline_debug(result: dict[str, Any]) -> None:
    print("\n========== MOBILE PIPELINE OUTPUT FORMAT ==========")
    print("Output type:", type(result).__name__)
    print("Top-level keys:", list(result.keys()))
    print("\nSummary JSON:")
    print(json.dumps(result.get("summary", {}), indent=2, ensure_ascii=False, default=str))
    print("\nDetected roles:")
    print(json.dumps((result.get("dynamic_fields") or {}).get("detected_roles", {}), indent=2, ensure_ascii=False, default=str))
    print("\nReport sizes:")
    for key in ("call_activity", "sms_activity", "top_contacts", "time_pattern", "call_movement", "operator_sms", "location", "device_sim", "dynamic_fields", "suspicious", "intelligence"):
        value = result.get(key)
        if isinstance(value, list):
            print(f"- {key}: list[{len(value)}]")
        elif isinstance(value, dict):
            print(f"- {key}: dict keys={list(value.keys())}")
        else:
            print(f"- {key}: {type(value).__name__}")
    print("\nSample output JSON:")
    print(json.dumps(result, indent=2, ensure_ascii=False, default=str)[:6000])
    print("========== END MOBILE PIPELINE OUTPUT FORMAT ==========\n")


def run_pipeline_from_text(content: str, debug: bool = False, config: dict[str, Any] | None = None) -> dict[str, Any]:
    text = content or ""
    if not text.strip():
        result = _empty_payload("No text content to analyze.")
        if debug:
            _print_pipeline_debug(result)
        return result

    records: list[dict[str, Any]] = []
    if len(text) > 12 and ("," in text or "\t" in text or ";" in text or "|" in text):
        try:
            records = extract_records_from_csv(text, config=config)
        except Exception:
            records = []
    if len(records) < 3:
        line_recs = extract_records_from_lines(text, config=config)
        if len(line_recs) > len(records):
            records = line_recs

    if not records:
        result = _empty_payload("Could not parse call / SMS style rows. Use CSV or pipe-delimited export.")
        if debug:
            _print_pipeline_debug(result)
        return result

    roles = _infer_column_roles(records, config=config)

    contact_counter: Counter[str] = Counter()
    contact_duration: defaultdict[str, int] = defaultdict(int)
    contact_in = Counter()
    contact_out = Counter()
    sms_count = 0
    day_counter: Counter[str] = Counter()
    hour_counter: Counter[int] = Counter()
    total_duration = 0
    calls_with_dur = 0
    night_rows = 0
    rows_with_time = 0

    for r in records:
        et = r.get("type") or ""
        if et == "sms":
            sms_count += 1
        for p in r.get("phones") or []:
            contact_counter[p] += 1
            if r.get("duration_sec"):
                contact_duration[p] += int(r["duration_sec"])
            if et == "in":
                contact_in[p] += 1
            elif et == "out":
                contact_out[p] += 1
        ds = r.get("duration_sec")
        if ds is not None and ds > 0:
            total_duration += int(ds)
            calls_with_dur += 1
        dts = r.get("datetime")
        if dts:
            try:
                dt = datetime.fromisoformat(dts)
                if not _is_valid_analysis_datetime(dt):
                    continue
                day_key = _display_day(dt)
                day_counter[day_key] += 1
                hour_counter[dt.hour] += 1
                rows_with_time += 1
                if dt.hour >= 22 or dt.hour < 6:
                    night_rows += 1
            except (ValueError, TypeError):
                pass

    total_calls = sum(1 for r in records if r.get("type") != "sms")
    if total_calls == 0:
        total_calls = len(records) - sms_count

    top_contacts = [
        {"number": num, "call_count": cnt, "total_duration_sec": contact_duration.get(num, 0), "inbound": contact_in.get(num, 0), "outbound": contact_out.get(num, 0)}
        for num, cnt in contact_counter.most_common(25)
    ]

    call_activity = sorted(
        [{"period": d, "count": c} for d, c in day_counter.items()],
        key=lambda x: datetime.strptime(x["period"], "%d-%m-%Y"),
    )[-60:]
    time_pattern_by_hour = [{"hour": h, "count": hour_counter.get(h, 0)} for h in range(24)]
    peak_hour = max(range(24), key=lambda h: hour_counter.get(h, 0)) if hour_counter else None
    night_pct = round(100 * night_rows / rows_with_time, 1) if rows_with_time else 0.0

    suspicious: list[dict[str, str]] = []
    if night_pct >= 35 and rows_with_time >= 8:
        suspicious.append({"title": "High late-night / early-morning activity", "detail": f"{night_pct}% of timestamped events fall between 22:00-06:00.", "severity": "medium"})
    if len(contact_counter) >= 3:
        top1 = contact_counter.most_common(1)[0][1]
        if top1 / max(len(records), 1) >= 0.45:
            suspicious.append({"title": "Single number concentration", "detail": "A large share of events involve one destination number; review context.", "severity": "low"})
    short_burst = sum(1 for r in records if (r.get("duration_sec") or 999) < 15 and r.get("type") != "sms")
    if short_burst >= max(15, len(records) // 5):
        suspicious.append({"title": "Many ultra-short communications", "detail": "Frequent events under about 15 seconds can indicate pings, drops, or machine traffic.", "severity": "low"})

    dr_start = min(day_counter.keys(), default=None)
    dr_end = max(day_counter.keys(), default=None)
    date_range = f"{dr_start} -> {dr_end}" if dr_start and dr_end else "-"

    op_hits = _extract_operator_values(records, roles)
    device_sim = _extract_device_values(records, roles)
    sms_activity = _build_sms_activity(records)
    call_movement = _build_call_movement(records, roles)
    dynamic_fields = _build_dynamic_field_report(records, roles)

    intel_lines = [
        f"Pulled {len(records)} parsed rows covering {len(contact_counter)} distinct subscriber numbers with {sms_count} SMS-classified rows."
    ]
    if peak_hour is not None and hour_counter:
        intel_lines.append(f"Highest hourly bucket: {peak_hour}:00-{peak_hour + 1}:00, using timestamps as given in file.")
    intel_lines.append("Operator/provider values from detected source columns: " + (", ".join(op_hits) or "none detected"))

    summary = {
        "parsed_rows": len(records),
        "unique_contacts": len(contact_counter),
        "total_calls_est": total_calls,
        "sms_count": sms_count,
        "total_duration_min": round(total_duration / 60.0, 2) if total_duration else 0,
        "avg_duration_sec": round(total_duration / calls_with_dur, 1) if calls_with_dur else None,
        "date_range": date_range,
        "night_activity_pct": night_pct,
        "operators_detected": op_hits,
    }

    source_details = {
        "date_range": date_range,
        "operators_detected": op_hits,
        "unique_contacts": len(contact_counter),
        "total_calls_est": total_calls,
        "total_duration_min": summary["total_duration_min"],
        "avg_duration_sec": summary["avg_duration_sec"],
        "night_activity_pct": night_pct,
        "notes": "Source-level values are derived from parsed rows and dynamically detected columns; no frontend-only static values are injected.",
    }

    location_summary = _build_location_summary(call_movement, records, roles)
    intelligence = {"insights": intel_lines, "behavior_summary": intel_lines[0] if intel_lines else ""}
    informative_insights = _build_informative_insights(
        summary,
        source_details,
        sms_activity,
        call_movement,
        location_summary,
        device_sim,
        suspicious,
        intelligence,
    )

    result = {
        "ui_schema_version": "mobile-cdr-v5",
        "total_records": len(records),
        "summary": summary,
        "source_details": source_details,
        "call_activity": call_activity,
        "sms_activity": sms_activity,
        "top_contacts": top_contacts,
        "time_pattern": {"by_hour": time_pattern_by_hour, "peak_hour": peak_hour, "night_activity_pct": night_pct},
        "call_movement": call_movement,
        "operator_sms": {"operators_plaintext": op_hits, "sms_like_rows": sms_count, "notes": "Operator/provider and SMS rows are derived from detected columns and values."},
        "location": location_summary,
        "device_sim": device_sim,
        "dynamic_fields": dynamic_fields,
        "detected_fields": dynamic_fields,
        "suspicious": suspicious,
        "intelligence": intelligence,
        "informative_insights": informative_insights,
    }

    if debug:
        _print_pipeline_debug(result)
    return result


def _empty_payload(msg: str) -> dict[str, Any]:
    return {
        "ui_schema_version": "mobile-cdr-v4",
        "total_records": 0,
        "error_hint": msg,
        "summary": {},
        "call_activity": [],
        "sms_activity": {"total_sms": 0, "by_day": [], "by_hour": [], "top_sms_contacts": [], "notes": msg},
        "top_contacts": [],
        "time_pattern": {"by_hour": [], "peak_hour": None, "night_activity_pct": 0},
        "call_movement": {"total_location_rows": 0, "unique_towers": 0, "top_towers": [], "movement_sequence": [], "notes": msg},
        "operator_sms": {"operators_plaintext": [], "sms_like_rows": 0, "notes": msg},
        "location": {"lac_values": [], "cell_id_values": [], "location_values": [], "lat_long_values": [], "network_circle_values": [], "top_towers": [], "movement_rows": [], "has_location_data": False, "notes": msg},
        "device_sim": {"imei_candidates": [], "imsi_candidates": [], "notes": ""},
        "dynamic_fields": {"detected_roles": {}, "detected_fields": [], "notes": msg},
        "suspicious": [],
        "intelligence": {"insights": [], "behavior_summary": ""},
        "informative_insights": {"cards": [], "summary_rows": [], "evidence_trail": [], "observations": [], "notes": msg},
    }


def build_searchable_text(result: dict[str, Any]) -> str:
    """Embed pipeline output as plain text stored on Source.full_text."""
    lines: list[str] = ["=== MOBILE DATA SUMMARY ==="]
    s = result.get("summary") or {}
    lines.append(f"Parsed rows: {s.get('parsed_rows')}")
    lines.append(f"Unique contacts: {s.get('unique_contacts')} | SMS rows: {s.get('sms_count')}")
    lines.append(f"Date range: {s.get('date_range')}")
    lines.append("")
    lines.append("=== DETECTED SOURCE FIELDS ===")
    dynamic_fields = result.get("dynamic_fields") or {}
    for row in (dynamic_fields.get("detected_fields") or [])[:30]:
        lines.append(f"{row.get('field')} | populated={row.get('populated_rows')}/{row.get('rows_seen')} | sample={row.get('sample_values')}")
    lines.append("")
    lines.append("=== TOP CONTACTS (sample) ===")
    for row in (result.get("top_contacts") or [])[:15]:
        lines.append(f"{row.get('number')} | count={row.get('call_count')} | in={row.get('inbound')} out={row.get('outbound')} | dur_sec={row.get('total_duration_sec')}")
    lines.append("")
    lines.append("=== CALL ACTIVITY BY DAY (sample) ===")
    for row in (result.get("call_activity") or [])[-20:]:
        lines.append(f"{row.get('period')}: {row.get('count')}")
    lines.append("")
    lines.append("=== SMS ACTIVITY BY DAY (sample) ===")
    sms_activity = result.get("sms_activity") or {}
    for row in (sms_activity.get("by_day") or [])[-20:]:
        lines.append(f"{row.get('period')}: {row.get('count')}")
    lines.append("")
    lines.append("=== CALL MOVEMENT / TOWER ACTIVITY (sample) ===")
    call_movement = result.get("call_movement") or {}
    for row in (call_movement.get("top_towers") or [])[:15]:
        lines.append(f"{row.get('tower')}: {row.get('count')}")
    return "\n".join(lines)


def read_file_text(path: str) -> str:
    p = Path(path)
    if not p.is_file():
        return ""
    for enc in ("utf-8", "utf-8-sig", "utf-16", "latin-1", "cp1252"):
        try:
            return p.read_text(encoding=enc)
        except (UnicodeDecodeError, OSError):
            continue
    return p.read_text(encoding="utf-8", errors="replace")
