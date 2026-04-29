import os
from pathlib import Path
import shutil
import sys

import pdfplumber
import pypdfium2 as pdfium
import pytesseract
from pytesseract import Output


def _configure_tesseract():
    possible_tessdata_dirs = [
        Path(sys.prefix) / "share" / "tessdata",
        Path(sys.prefix) / "Library" / "share" / "tessdata",
        Path(sys.prefix) / "Library" / "bin" / "tessdata",
    ]
    for tessdata_dir in possible_tessdata_dirs:
        if (tessdata_dir / "eng.traineddata").exists():
            os.environ["TESSDATA_PREFIX"] = str(tessdata_dir)
            break

    possible_tesseract_paths = [
        Path(sys.prefix) / "Library" / "bin" / "tesseract.exe",
        Path(sys.prefix) / "Scripts" / "tesseract.exe",
    ]
    tesseract_path = shutil.which("tesseract")
    if not tesseract_path:
        for possible_path in possible_tesseract_paths:
            if possible_path.exists():
                tesseract_path = str(possible_path)
                break
    if tesseract_path:
        pytesseract.pytesseract.tesseract_cmd = tesseract_path


def _ocr_page_lines(page, scale=3):
    _configure_tesseract()
    bitmap = page.render(scale=scale)
    image = bitmap.to_pil()
    data = pytesseract.image_to_data(image, output_type=Output.DICT, config="--psm 6")
    image.close()
    bitmap.close()
    rows = {}

    for index, text in enumerate(data["text"]):
        word = " ".join(str(text).split())
        if not word:
            continue

        key = (
            data["page_num"][index],
            data["block_num"][index],
            data["par_num"][index],
            data["line_num"][index],
        )
        rows.setdefault(key, []).append((data["left"][index], word))

    lines = []
    for key in sorted(rows):
        words = [word for _, word in sorted(rows[key], key=lambda item: item[0])]
        line = " ".join(words).strip()
        if line:
            lines.append(line)

    return lines


def _ocr_text(file_path):
    document = pdfium.PdfDocument(str(file_path))
    all_lines = []

    try:
        for page_index in range(len(document)):
            page = document[page_index]
            try:
                all_lines.extend(_ocr_page_lines(page))
                all_lines.append("")
            finally:
                page.close()
    finally:
        document.close()

    return "\n".join(all_lines).strip()


def _embedded_text(file_path):
    text_parts = []
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            text_parts.append(page.extract_text() or "")
    return "\n".join(text_parts).strip()


def extract_text(file_path):
    # Try embedded text first — no OCR needed for digital PDFs
    try:
        embedded = _embedded_text(file_path)
        if embedded and len(embedded.strip()) > 100:
            return embedded
    except Exception:
        pass
    # Fallback to OCR only if tesseract is available
    try:
        import shutil
        if shutil.which("tesseract"):
            ocr_text = _ocr_text(file_path)
            if ocr_text:
                return ocr_text
    except Exception:
        pass
    # Last resort
    try:
        return _embedded_text(file_path)
    except Exception:
        return ""
