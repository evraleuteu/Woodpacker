"""Extract text from a PDF using PyMuPDF, reading bytes from stdin and writing JSON to stdout.

Usage:
    python -m woodpacker_extraction.extract_pdf < file.pdf
    python -m woodpacker_extraction.extract_pdf --file path/to/file.pdf

Outputs JSON: {"text": "...", "pageCount": N}
"""

from __future__ import annotations

import json
import re
import sys

import pymupdf

MAX_PAGES = 300
MAX_CHARS = 250_000

_WS_RE = re.compile(r"[ \t]+")
_NEWLINE_RE = re.compile(r"\n{3,}")


def _clean_text(raw: str) -> str:
    """Clean text but preserve paragraph/newline structure."""
    text = raw.replace("\r\n", "\n").replace("\r", "\n")
    text = _WS_RE.sub(" ", text)
    text = _NEWLINE_RE.sub("\n\n", text)
    return text.strip()[:MAX_CHARS]


def extract_pdf_bytes(data: bytes) -> tuple[str, int]:
    """Extract text and page count from raw PDF bytes using PyMuPDF."""
    doc = pymupdf.open(stream=data, filetype="pdf")
    page_count = doc.page_count
    pages: list[str] = []
    limit = min(page_count, MAX_PAGES)
    for i in range(limit):
        page = doc[i]
        text = page.get_text() or ""
        if text:
            pages.append(f"[PAGE {i + 1}]\n{text}")
    doc.close()
    return _clean_text("\n".join(pages)), page_count


def extract_pdf_from_path(path: str) -> tuple[str, int]:
    """Extract text and page count from a PDF file path using PyMuPDF."""
    with open(path, "rb") as f:
        data = f.read()
    return extract_pdf_bytes(data)


def main() -> int:
    if "--file" in sys.argv:
        idx = sys.argv.index("--file")
        path = sys.argv[idx + 1]
        with open(path, "rb") as f:
            data = f.read()
    else:
        data = sys.stdin.buffer.read()

    try:
        text, page_count = extract_pdf_bytes(data)
        sys.stdout.buffer.write(json.dumps({"text": text, "pageCount": page_count}, ensure_ascii=False).encode("utf-8"))
        return 0
    except Exception as exc:  # noqa: BLE001
        sys.stdout.buffer.write(json.dumps({"text": "", "pageCount": 0, "error": str(exc)}, ensure_ascii=False).encode("utf-8"))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
