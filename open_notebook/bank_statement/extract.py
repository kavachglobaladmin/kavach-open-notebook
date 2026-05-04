import os
from pathlib import Path
import shutil
import sys
import threading

import pypdfium2 as pdfium


def _configure_tesseract():
    try:
        import pytesseract
    except ImportError:
        return False

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
    return True


def _ocr_page_lines(page, scale=3):
    import pytesseract
    from pytesseract import Output
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


def _ocr_text_tesseract(file_path):
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


def _embedded_text_with_timeout(file_path, timeout_seconds=15):
    """
    Extract embedded text using pdfplumber with a timeout guard.
    Image-only PDFs can cause pdfplumber to hang indefinitely.
    Returns empty string on timeout or error.
    """
    result = [""]
    error = [None]

    def _run():
        try:
            import pdfplumber
            text_parts = []
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    text_parts.append(page.extract_text() or "")
            result[0] = "\n".join(text_parts).strip()
        except Exception as e:
            error[0] = e

    t = threading.Thread(target=_run, daemon=True)
    t.start()
    t.join(timeout=timeout_seconds)
    if t.is_alive():
        # Thread is still running (hung) — return empty
        return ""
    if error[0]:
        return ""
    return result[0]


def _pymupdf_text(file_path):
    """Extract text using PyMuPDF (fitz) — handles more PDF types than pdfplumber."""
    import fitz  # PyMuPDF
    text_parts = []
    doc = fitz.open(str(file_path))
    try:
        for page in doc:
            text_parts.append(page.get_text() or "")
    finally:
        doc.close()
    return "\n".join(text_parts).strip()


# Module-level EasyOCR reader singleton — loaded once, reused across calls
_easyocr_reader = None


def _easyocr_text(file_path):
    """
    Extract text from an image-based PDF using EasyOCR (no tesseract required).
    Rasterises each page at 300 DPI via PyMuPDF and runs EasyOCR on the image.
    Returns joined text or empty string if EasyOCR is unavailable.
    """
    try:
        import easyocr
        import fitz
        import io
        import numpy as np
        from PIL import Image
    except ImportError:
        return ""

    # Reuse a module-level reader to avoid re-loading the model on every call
    global _easyocr_reader
    if _easyocr_reader is None:
        try:
            import torch
            use_gpu = torch.cuda.is_available()
            _easyocr_reader = easyocr.Reader(["en"], gpu=use_gpu, verbose=False)
        except Exception:
            return ""

    reader = _easyocr_reader

    try:
        doc = fitz.open(str(file_path))
    except Exception:
        return ""

    page_texts = []
    try:
        for page in doc:
            page_parts = []

            # Try embedded text first
            try:
                embedded = page.get_text("text").strip()
                if embedded:
                    page_parts.append(embedded)
            except Exception:
                pass

            # OCR if page text is sparse
            if len("\n".join(page_parts)) < 200:
                try:
                    pix = page.get_pixmap(dpi=300)
                    img_bytes = pix.tobytes("png")

                    # Run readtext in a thread with timeout — some pages can hang
                    ocr_result = [None]
                    ocr_error = [None]

                    def _run_ocr():
                        try:
                            img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
                            arr = np.array(img)
                            ocr_result[0] = reader.readtext(arr, detail=0, batch_size=4)
                        except Exception as e:
                            ocr_error[0] = e

                    ocr_thread = threading.Thread(target=_run_ocr, daemon=True)
                    ocr_thread.start()
                    ocr_thread.join(timeout=60)  # 60s per page max

                    if ocr_thread.is_alive():
                        # Page OCR hung — skip this page
                        pass
                    elif ocr_error[0] is None and ocr_result[0]:
                        page_parts.append("\n".join(ocr_result[0]))
                except Exception:
                    pass

            page_texts.append("\n".join(page_parts))
    finally:
        doc.close()

    return "\n\n".join(page_texts).strip()



def extract_text(file_path):
    # 1. Try PyMuPDF first — fast, no hang risk
    try:
        mupdf = _pymupdf_text(file_path)
        if mupdf and len(mupdf.strip()) > 100:
            return mupdf
    except Exception:
        pass

    # 2. Try pdfplumber with timeout — handles some PDFs PyMuPDF misses
    try:
        embedded = _embedded_text_with_timeout(file_path, timeout_seconds=15)
        if embedded and len(embedded.strip()) > 100:
            return embedded
    except Exception:
        pass

    # 3. EasyOCR — for image-based / scanned PDFs (no tesseract required)
    try:
        ocr_text = _easyocr_text(file_path)
        if ocr_text and len(ocr_text.strip()) > 50:
            return ocr_text
    except Exception:
        pass

    # 4. Tesseract OCR fallback (if installed)
    try:
        if shutil.which("tesseract"):
            ocr_text = _ocr_text_tesseract(file_path)
            if ocr_text:
                return ocr_text
    except Exception:
        pass

    return ""
