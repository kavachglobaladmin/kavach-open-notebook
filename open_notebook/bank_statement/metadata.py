import re as _re_meta
import re
from open_notebook.bank_statement.settings import get_defaults

_D = get_defaults()


def _header_lines(text):
    import re as _re
    table_words = set(_D["table_words"])
    # Patterns that indicate transaction data has started — stop scanning header
    _TRANSACTION_START = [
        _re.compile(r"BROUGHT\s+FORWARD", _re.IGNORECASE),
        _re.compile(r"OPENING\s+BALANCE", _re.IGNORECASE),
        _re.compile(r"^\d{2}[-/]\d{2}[-/]\d{4}", _re.IGNORECASE),  # date at line start
        _re.compile(r"Post\s+Date\s+Description", _re.IGNORECASE),
        _re.compile(r"Value\s+Date\s+Description", _re.IGNORECASE),
        _re.compile(r"Txn\s+Date", _re.IGNORECASE),
    ]
    lines = []
    for line in text.splitlines():
        cleaned = " ".join(line.split())
        if not cleaned:
            continue
        # Stop if transaction table header detected
        words = {word.lower().strip(":-") for word in cleaned.split()}
        if len(words.intersection(table_words)) >= 3:
            break
        # Stop if transaction data started
        if any(p.search(cleaned) for p in _TRANSACTION_START):
            break
        lines.append(cleaned)
    # Limit to first 40 lines max to avoid including transactions
    return lines[:40]


def _split_label_prefix(label):
    words = label.split()
    if len(words) <= 2:
        return "", label
    prefix = []
    for word in words:
        cleaned = word.strip(".,")
        if cleaned.isupper() and len(cleaned) > 1:
            prefix.append(word)
        else:
            break
    if prefix and len(prefix) < len(words):
        return " ".join(prefix), " ".join(words[len(prefix):])
    return "", label


def _label_from_left_text(text):
    words = text.strip().split()
    if len(words) <= 3:
        return "", " ".join(words)
    prefix, label = _split_label_prefix(" ".join(words))
    if prefix:
        return prefix, label
    return " ".join(words[:-2]), " ".join(words[-2:])


def _extract_key_values(line):
    separators = _D["separators"]
    fields = []
    free_text = []
    cursor = 0

    while True:
        found = [
            (line.find(sep, cursor), sep)
            for sep in separators
            if line.find(sep, cursor) != -1
        ]
        if not found:
            tail = line[cursor:].strip()
            if tail:
                free_text.append(tail)
            break

        sep_idx, sep = min(found, key=lambda x: x[0])
        left_text = line[cursor:sep_idx].strip()
        prefix, label = _label_from_left_text(left_text)
        if prefix:
            free_text.append(prefix)

        value_start = sep_idx + len(sep)
        next_found = [
            (line.find(ns, value_start), ns)
            for ns in separators
            if line.find(ns, value_start) != -1
        ]
        if not next_found:
            value = line[value_start:].strip(" ,")
            cursor = len(line)
        else:
            next_idx, _ = min(next_found, key=lambda x: x[0])
            next_left = line[value_start:next_idx]
            parts = next_left.strip().split()
            if len(parts) > 2:
                value = " ".join(parts[:-2]).strip(" ,")
                cursor = next_idx - len(" ".join(parts[-2:]))
            else:
                value = next_left.strip(" ,")
                cursor = next_idx

        if label and value:
            fields.append({"label": label.strip(), "value": value.strip()})

    return fields, " ".join(free_text).strip()


def _extract_inline_field(line):
    tokens = line.split()
    fields = []
    for i in range(len(tokens) - 2):
        label_end = tokens[i + 1].lower().strip(" .")
        value = tokens[i + 2].strip(" ,.")
        if label_end not in {"no", "number"}:
            continue
        if not value.isdigit() or len(value) < 6:
            continue
        label = f"{tokens[i].strip(' .')} {tokens[i + 1].strip(' .')}"
        fields.append({"label": label, "value": value})
    return fields


def _merge_fields(fields):
    merged = []
    seen_labels = {}
    seen_values = set()

    def _norm(label: str) -> str:
        return label.lower().replace("/", "").replace(" ", "").replace(".", "").replace("_", "")

    for field in fields:
        label = field["label"]
        value = field["value"]
        norm_key = _norm(label)
        if value and value in seen_values:
            continue
        if norm_key in seen_labels:
            if value not in seen_labels[norm_key]["value"].split(" | "):
                seen_labels[norm_key]["value"] = f"{seen_labels[norm_key]['value']} | {value}"
        else:
            item = {"label": label, "value": value}
            seen_labels[norm_key] = item
            merged.append(item)
        if value:
            seen_values.add(value)
    return merged


def parse_statement_details(text):
    lines = _header_lines(text)
    fields = []
    free_lines = []

    for line in lines:
        extracted, free_text = _extract_key_values(line)
        extracted.extend(_extract_inline_field(line))
        fields.extend(extracted)
        if free_text:
            free_lines.append(free_text)
        elif not extracted:
            free_lines.append(line)

    for line in text.splitlines():
        cleaned = " ".join(line.split())
        if cleaned:
            fields.extend(_extract_inline_field(cleaned))

    title_index = next(
        (i for i, line in enumerate(free_lines) if "statement" in line.lower()), -1
    )
    title = free_lines[title_index] if title_index >= 0 else ""
    issuer_lines   = free_lines[:title_index] if title_index >= 0 else free_lines[:2]
    customer_lines = free_lines[title_index + 1:] if title_index >= 0 else free_lines[2:]

    # Filter out bare label lines (lines that are just field names without values)
    _BARE_LABELS = {
        'account no', 'product', 'account open date', 'account number',
        'account type', 'date', 'description', 'debit', 'credit', 'balance',
        'drawing power', 'nominee name', 'account status',
    }
    def _is_meaningful_line(line: str) -> bool:
        stripped = line.strip().lower().rstrip(':')
        if stripped in _BARE_LABELS:
            return False
        if len(stripped) < 3:
            return False
        # Skip pure numbers (account numbers already in detail_cards)
        if stripped.replace(' ', '').isdigit():
            return False
        # Skip product codes already in detail_cards
        if re.search(r'^regular\s+sb|^savings|^current|^chq', stripped, re.IGNORECASE):
            return False
        return True

    issuer_lines   = [l for l in issuer_lines   if _is_meaningful_line(l)]
    customer_lines = [l for l in customer_lines if _is_meaningful_line(l)]

    return {
        "title": title,
        "issuer_lines": issuer_lines,
        "customer_lines": customer_lines,
        "fields": _merge_fields(fields),
        "raw_header_lines": lines,
    }
