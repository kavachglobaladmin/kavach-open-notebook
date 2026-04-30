TABLE_WORDS = {
    "value",
    "post",
    "date",
    "description",
    "debit",
    "credit",
    "balance",
    "transaction",
    "transactions",
    "details",
    "amount",
    "payment",
    "method",
    "opening",
    "spent",
    "saved",
}
SEPARATORS = (":", " - ", " — ", " _ ", " = ")


def _header_lines(text):
    lines = []
    for line in text.splitlines():
        cleaned = " ".join(line.split())
        if not cleaned:
            continue
        words = {word.lower().strip(":-") for word in cleaned.split()}
        if len(words.intersection(TABLE_WORDS)) >= 3:
            break
        lines.append(cleaned)
    return lines


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
        return " ".join(prefix), " ".join(words[len(prefix) :])

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
    fields = []
    free_text = []
    cursor = 0

    while True:
        found = [
            (line.find(separator, cursor), separator)
            for separator in SEPARATORS
            if line.find(separator, cursor) != -1
        ]
        if not found:
            tail = line[cursor:].strip()
            if tail:
                free_text.append(tail)
            break

        separator_index, separator = min(found, key=lambda item: item[0])
        left_text = line[cursor:separator_index].strip()
        prefix, label = _label_from_left_text(left_text)
        if prefix:
            free_text.append(prefix)

        value_start = separator_index + len(separator)
        next_found = [
            (line.find(next_separator, value_start), next_separator)
            for next_separator in SEPARATORS
            if line.find(next_separator, value_start) != -1
        ]
        if not next_found:
            value = line[value_start:].strip(" ,")
            cursor = len(line)
        else:
            next_separator_index, _ = min(next_found, key=lambda item: item[0])
            next_left = line[value_start:next_separator_index]
            parts = next_left.strip().split()
            if len(parts) > 2:
                value = " ".join(parts[:-2]).strip(" ,")
                cursor = next_separator_index - len(" ".join(parts[-2:]))
            else:
                value = next_left.strip(" ,")
                cursor = next_separator_index

        if label and value:
            fields.append({"label": label.strip(), "value": value.strip()})

    return fields, " ".join(free_text).strip()


def _extract_inline_field(line):
    tokens = line.split()
    fields = []
    for index in range(len(tokens) - 2):
        label_end = tokens[index + 1].lower().strip(" .")
        value = tokens[index + 2].strip(" ,.")
        if label_end not in {"no", "number"}:
            continue
        if not value.isdigit() or len(value) < 6:
            continue

        label = f"{tokens[index].strip(' .')} {tokens[index + 1].strip(' .')}"
        fields.append({"label": label, "value": value})
    return fields


def _merge_fields(fields):
    merged = []
    seen = {}

    for field in fields:
        label = field["label"]
        value = field["value"]
        key = label.lower()

        if key in seen:
            if value not in seen[key]["value"].split(" | "):
                seen[key]["value"] = f"{seen[key]['value']} | {value}"
        else:
            item = {"label": label, "value": value}
            seen[key] = item
            merged.append(item)

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
        (index for index, line in enumerate(free_lines) if "statement" in line.lower()),
        -1,
    )
    title = free_lines[title_index] if title_index >= 0 else ""
    issuer_lines = free_lines[:title_index] if title_index >= 0 else free_lines[:2]
    customer_lines = free_lines[title_index + 1 :] if title_index >= 0 else free_lines[2:]

    return {
        "title": title,
        "issuer_lines": issuer_lines,
        "customer_lines": customer_lines,
        "fields": _merge_fields(fields),
        "raw_header_lines": lines,
    }
