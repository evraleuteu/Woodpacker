"""
Docling converter for Woodpacker.

Wraps Docling's native document conversion pipeline with OCR support
(German + English via EasyOCR) and provides a stable structured output
for downstream pipelines (lesson detection, exercise extraction, etc.).

Design goals:
- Preserve reading order, page order, heading/list/table structure (Docling does natively)
- Enable OCR automatically for scanned PDFs (EasyOCR fallback, de+en)
- Remain generic / not hard-coded to a specific book
- Graceful fallback to PyMuPDF when Docling is unavailable (CI / lightweight envs)
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Fallback helpers (PyMuPDF) – used when docling is not installed or fails
# ---------------------------------------------------------------------------

def _fallback_extract(file_path: str) -> dict[str, Any]:
    """Lightweight fallback using PyMuPDF – preserves spec shape without Docling."""
    import pymupdf  # type: ignore

    p = Path(file_path)
    suffix = p.suffix.lower()
    # For non-PDF fallback, try docx/pptx text extraction via python-docx / manual
    if suffix in (".docx", ".pptx"):
        return _fallback_docx_pptx_extract(file_path)
    if suffix == ".pdf":
        doc = pymupdf.open(file_path)
        pages: list[dict[str, Any]] = []
        blocks: list[dict[str, Any]] = []
        markdown_lines: list[str] = []
        for page_idx in range(doc.page_count):
            page = doc[page_idx]
            text = page.get_text("text") or ""
            # try to extract blocks with bbox to preserve some layout
            try:
                dict_blocks = page.get_text("dict").get("blocks", [])
            except Exception:
                dict_blocks = []
            page_num = page_idx + 1
            pages.append({"page": page_num, "width": float(page.rect.width), "height": float(page.rect.height)})
            # Create paragraph blocks from dict blocks or fallback to full page text
            if dict_blocks:
                for b in dict_blocks:
                    if b.get("type") == 0:  # text block
                        for line in b.get("lines", []):
                            for span in line.get("spans", []):
                                txt = (span.get("text") or "").strip()
                                if not txt:
                                    continue
                                font_size = float(span.get("size", 0) or 0)
                                # heuristic heading detection
                                is_heading = font_size >= 14 or txt.isupper() and len(txt.split()) <= 6
                                if is_heading:
                                    level = 1 if font_size >= 16 else 2
                                    blocks.append({
                                        "id": str(uuid.uuid4()),
                                        "type": "heading",
                                        "level": level,
                                        "text": txt,
                                        "page": page_num,
                                    })
                                    markdown_lines.append(f"{'#' * level} {txt}")
                                else:
                                    blocks.append({
                                        "id": str(uuid.uuid4()),
                                        "type": "paragraph",
                                        "text": txt,
                                        "page": page_num,
                                    })
                                    markdown_lines.append(txt)
                    elif b.get("type") == 1:
                        blocks.append({
                            "id": str(uuid.uuid4()),
                            "type": "image",
                            "text": "",
                            "page": page_num,
                        })
            else:
                if text.strip():
                    for para in text.split("\n\n"):
                        para = para.strip()
                        if not para:
                            continue
                        # crude list detection
                        if para.lstrip().startswith(("-", "•", "*")) or para.lstrip()[:2].strip().isdigit():
                            blocks.append({"id": str(uuid.uuid4()), "type": "list_item", "text": para, "page": page_num})
                        else:
                            blocks.append({"id": str(uuid.uuid4()), "type": "paragraph", "text": para, "page": page_num})
                        markdown_lines.append(para)
            if not text.strip() and not dict_blocks:
                markdown_lines.append(f"<!-- page {page_num} empty / scanned – OCR required -->")
        doc.close()
        markdown = "\n\n".join(markdown_lines) if markdown_lines else ""
        return {
            "markdown": markdown,
            "pages": pages,
            "blocks": blocks,
            "tables": [],
            "images": [],
            "metadata": {"filename": p.name, "filetype": suffix, "fallback": "pymupdf"},
        }
    # generic fallback for .txt etc.
    try:
        text = p.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        text = ""
    return {
        "markdown": text,
        "pages": [{"page": 1}],
        "blocks": [{"id": str(uuid.uuid4()), "type": "paragraph", "text": text, "page": 1}] if text else [],
        "tables": [],
        "images": [],
        "metadata": {"filename": p.name, "filetype": suffix, "fallback": "text"},
    }


def _fallback_docx_pptx_extract(file_path: str) -> dict[str, Any]:
    """Extract paragraphs/headings/tables from DOCX/PPTX when docling unavailable."""
    p = Path(file_path)
    suffix = p.suffix.lower()
    pages: list[dict[str, Any]] = [{"page": 1}]
    blocks: list[dict[str, Any]] = []
    tables: list[dict[str, Any]] = []
    images: list[dict[str, Any]] = []
    markdown_lines: list[str] = []
    try:
        if suffix == ".docx":
            try:
                import docx  # python-docx
                doc = docx.Document(file_path)
                for para in doc.paragraphs:
                    txt = para.text.strip()
                    if not txt:
                        continue
                    style = (para.style.name or "").lower()
                    if "heading" in style:
                        try:
                            level = int(style.replace("heading", "").strip() or "1")
                        except Exception:
                            level = 1
                        level = max(1, min(level, 6))
                        blocks.append({"id": str(uuid.uuid4()), "type": "heading", "level": level, "text": txt, "page": 1})
                        markdown_lines.append(f"{'#' * level} {txt}")
                    elif style.startswith("list"):
                        blocks.append({"id": str(uuid.uuid4()), "type": "list_item", "text": txt, "page": 1})
                        markdown_lines.append(f"- {txt}")
                    else:
                        blocks.append({"id": str(uuid.uuid4()), "type": "paragraph", "text": txt, "page": 1})
                        markdown_lines.append(txt)
                for ti, table in enumerate(doc.tables):
                    rows = []
                    for row in table.rows:
                        rows.append([cell.text.strip() for cell in row.cells])
                    if rows:
                        cols = rows[0] if rows else []
                        tables.append({"id": str(uuid.uuid4()), "page": 1, "rows": rows, "columns": cols})
                        # markdown table
                        if rows:
                            markdown_lines.append("| " + " | ".join(rows[0]) + " |")
                            markdown_lines.append("| " + " | ".join(["---"] * len(rows[0])) + " |")
                            for r in rows[1:]:
                                markdown_lines.append("| " + " | ".join(r) + " |")
            except Exception as exc:
                logger.warning("docx fallback failed: %s", exc)
                text = p.read_bytes().decode(errors="ignore")[:20000]
                blocks.append({"id": str(uuid.uuid4()), "type": "paragraph", "text": text[:5000], "page": 1})
                markdown_lines.append(text[:5000])
        elif suffix == ".pptx":
            try:
                from pptx import Presentation  # python-pptx
                prs = Presentation(file_path)
                for slide_idx, slide in enumerate(prs.slides, start=1):
                    pages.append({"page": slide_idx})
                    for shape in slide.shapes:
                        if shape.has_text_frame:
                            for para in shape.text_frame.paragraphs:
                                txt = para.text.strip()
                                if not txt:
                                    continue
                                lvl = getattr(para.level, "__int__", lambda: 0)()
                                if lvl == 0 and len(txt) < 80 and txt.isupper():
                                    blocks.append({"id": str(uuid.uuid4()), "type": "heading", "level": 1, "text": txt, "page": slide_idx})
                                    markdown_lines.append(f"# {txt}")
                                else:
                                    blocks.append({"id": str(uuid.uuid4()), "type": "paragraph", "text": txt, "page": slide_idx})
                                    markdown_lines.append(txt)
                        if shape.has_table:
                            tbl = shape.table
                            rows = [[cell.text.strip() for cell in row.cells] for row in tbl.rows]
                            tables.append({"id": str(uuid.uuid4()), "page": slide_idx, "rows": rows, "columns": rows[0] if rows else []})
            except Exception as exc:
                logger.warning("pptx fallback failed: %s", exc)
    except Exception as exc:
        logger.warning("docx/pptx fallback outer failed: %s", exc)
    markdown = "\n\n".join(markdown_lines)
    return {"markdown": markdown, "pages": pages, "blocks": blocks, "tables": tables, "images": images, "metadata": {"filename": p.name, "filetype": suffix, "fallback": "docx_pptx"}}


# ---------------------------------------------------------------------------
# Docling helpers
# ---------------------------------------------------------------------------

def _build_docling_converter():
    """Create a DocumentConverter with OCR (de+en) if docling is available."""
    try:
        from docling.document_converter import DocumentConverter
        from docling.datamodel.pipeline_options import PdfPipelineOptions
        from docling.datamodel.base_models import InputFormat
        from docling.document_converter import PdfFormatOption
    except Exception as exc:
        logger.info("Docling not available: %s – will use fallback", exc)
        return None, str(exc)

    try:
        pipeline_options = PdfPipelineOptions()
        # enable OCR and table structure – best effort across docling versions
        try:
            pipeline_options.do_ocr = True
        except Exception:
            pass
        try:
            pipeline_options.do_table_structure = True
        except Exception:
            pass
        # EasyOCR options – try multiple import paths across versions
        ocr_applied = False
        for mod_path, cls_name in [
            ("docling.datamodel.pipeline_options", "EasyOcrOptions"),
            ("docling.datamodel.pipeline_options", "OcrOptions"),
            ("docling.datamodel.pipeline_options", "EasyOCROptions"),
        ]:
            try:
                import importlib
                mod = importlib.import_module(mod_path)
                OcrCls = getattr(mod, cls_name, None)
                if OcrCls is None:
                    continue
                # lang as list of str
                try:
                    ocr_opts = OcrCls(lang=["de", "en"])  # type: ignore
                except TypeError:
                    try:
                        ocr_opts = OcrCls(langs=["de", "en"])  # type: ignore
                    except Exception:
                        ocr_opts = OcrCls()  # type: ignore
                # assign to pipeline
                for attr in ("ocr_options", "easyocr_options", "ocr_engine_options"):
                    try:
                        setattr(pipeline_options, attr, ocr_opts)
                        ocr_applied = True
                        break
                    except Exception:
                        continue
                if ocr_applied:
                    break
            except Exception:
                continue
        if not ocr_applied:
            logger.info("EasyOCR options not applied – using docling defaults (auto OCR still enabled)")

        # Build converter with pdf options; fallback to default if signature changed
        try:
            converter = DocumentConverter(
                format_options={
                    InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options),
                }
            )
        except Exception as exc:
            logger.warning("PdfFormatOption construction failed (%s), using default DocumentConverter", exc)
            converter = DocumentConverter()

        logger.info("Docling converter initialized (OCR de+en: %s)", ocr_applied)
        return converter, None
    except Exception as exc:
        logger.warning("Failed to build Docling converter: %s", exc)
        return None, str(exc)


_singleton_converter = None
_singleton_error: str | None = None


def get_converter():
    global _singleton_converter, _singleton_error
    if _singleton_converter is None and _singleton_error is None:
        _singleton_converter, _singleton_error = _build_docling_converter()
    return _singleton_converter


def _prov_page(prov: Any) -> int:
    """Extract page number from docling provenance object (1-based)."""
    if prov is None:
        return 1
    # prov may be dict, object with page_no / page
    if isinstance(prov, dict):
        for k in ("page_no", "page", "pageNo", "page_number"):
            v = prov.get(k)
            if isinstance(v, int):
                return v
        return 1
    for attr in ("page_no", "page", "pageNo", "page_number"):
        v = getattr(prov, attr, None)
        if isinstance(v, int):
            return int(v)
    # try bbox dict
    return 1


def _item_text(item: Any) -> str:
    """Extract text from a docling item (TextItem, etc.)."""
    if item is None:
        return ""
    if isinstance(item, dict):
        for k in ("text", "value", "content"):
            v = item.get(k)
            if isinstance(v, str):
                return v
        return ""
    for attr in ("text", "value", "content"):
        v = getattr(item, attr, None)
        if isinstance(v, str):
            return v
    try:
        return str(item)
    except Exception:
        return ""


def _label_of(item: Any) -> str:
    if isinstance(item, dict):
        return str(item.get("label") or item.get("type") or "")
    return str(getattr(item, "label", "") or getattr(item, "type", "") or getattr(item, "category", "") or "")


def _bbox_of(prov: Any):
    if prov is None:
        return None
    if isinstance(prov, dict):
        for k in ("bbox", "box", "rect"):
            v = prov.get(k)
            if v:
                return v
        return None
    for attr in ("bbox", "box", "rect", "coordinates"):
        v = getattr(prov, attr, None)
        if v is not None:
            return v
    return None


def _extract_from_docling_document(document: Any, filename: str) -> dict[str, Any]:
    """
    Map a DoclingDocument to the Woodpacker spec shape.
    Tries high-level APIs first, then falls back to export_to_dict().
    """
    markdown = ""
    try:
        markdown = document.export_to_markdown() or ""
    except Exception as exc:
        logger.warning("export_to_markdown failed: %s", exc)
        try:
            markdown = document.export_to_text() or ""  # type: ignore
        except Exception:
            markdown = ""

    # Try object-based extraction
    blocks: list[dict[str, Any]] = []
    tables: list[dict[str, Any]] = []
    images: list[dict[str, Any]] = []
    pages: list[dict[str, Any]] = []
    metadata: dict[str, Any] = {"filename": filename, "engine": "docling"}

    # pages
    try:
        doc_pages = getattr(document, "pages", None)
        if isinstance(doc_pages, dict):
            for p_no, p_obj in sorted(doc_pages.items()):
                try:
                    w = float(getattr(p_obj, "width", 0) or getattr(p_obj, "size", {}).get("width", 0) or 0)
                    h = float(getattr(p_obj, "height", 0) or getattr(p_obj, "size", {}).get("height", 0) or 0)
                except Exception:
                    w = h = 0
                pages.append({"page": int(p_no), "width": w, "height": h})
        elif isinstance(doc_pages, list):
            for idx, p_obj in enumerate(doc_pages, start=1):
                if isinstance(p_obj, dict):
                    pages.append({"page": p_obj.get("page") or idx, "width": float(p_obj.get("width") or 0), "height": float(p_obj.get("height") or 0)})
                else:
                    pages.append({"page": idx})
        elif doc_pages is not None:
            # unknown shape
            pages.append({"page": 1})
    except Exception as exc:
        logger.warning("pages extraction failed: %s", exc)

    if not pages:
        # infer page count from prov
        try:
            max_page = 1
            for coll_name in ("texts", "tables", "pictures", "figures"):
                coll = getattr(document, coll_name, None)
                if coll:
                    for it in coll:
                        prov = getattr(it, "prov", None)
                        if prov:
                            # prov may be list
                            if isinstance(prov, list):
                                for pr in prov:
                                    max_page = max(max_page, _prov_page(pr))
                            else:
                                max_page = max(max_page, _prov_page(prov))
            pages = [{"page": i} for i in range(1, max_page + 1)]
        except Exception:
            pages = [{"page": 1}]

    # texts / paragraphs / headings / lists
    try:
        texts_coll = getattr(document, "texts", None) or getattr(document, "paragraphs", None) or []
        # texts may be dict
        if isinstance(texts_coll, dict):
            texts_coll = list(texts_coll.values())
        for item in texts_coll:
            txt = _item_text(item).strip()
            if not txt:
                continue
            label = _label_of(item).lower()
            prov = getattr(item, "prov", None) if not isinstance(item, dict) else item.get("prov")
            page_no = 1
            if isinstance(prov, list) and prov:
                page_no = _prov_page(prov[0])
            elif prov:
                page_no = _prov_page(prov)
            # Map docling labels to spec block types
            # docling uses: title, section_header, paragraph, list_item, caption, footnote, etc.
            block_type = "paragraph"
            level = None
            if label in ("title", "section_header", "header", "heading", "h1", "h2", "h3", "h4", "h5", "h6"):
                block_type = "heading"
                # infer level from label
                if label in ("h1", "title"):
                    level = 1
                elif label == "h2":
                    level = 2
                elif label == "h3":
                    level = 3
                elif "section" in label:
                    level = 2
                else:
                    level = 1
                # heuristic: length / capitalization
            elif label in ("list_item", "ordered_list", "unordered_list", "list", "bullet"):
                block_type = "list_item"
            elif label in ("caption", "figure_caption"):
                block_type = "caption"
            elif label in ("footnote", "header", "footer", "page_number", "page_header", "page_footer"):
                block_type = label  # keep specialized
            # Preserve list hierarchy: docling list handling – we treat each list_item as separate block
            block: dict[str, Any] = {
                "id": str(getattr(item, "self_ref", "") or getattr(item, "id", "") or uuid.uuid4()),
                "type": block_type,
                "text": txt,
                "page": page_no,
            }
            if level is not None:
                block["level"] = level
            # attach bbox if available
            b = _bbox_of(prov[0] if isinstance(prov, list) and prov else prov)
            if b is not None:
                try:
                    # bbox may be dict with l,t,r,b or object
                    if isinstance(b, dict):
                        block["bbox"] = [float(b.get("l", 0)), float(b.get("t", 0)), float(b.get("r", 0)), float(b.get("b", 0))]
                    elif hasattr(b, "l"):
                        block["bbox"] = [float(b.l), float(b.t), float(b.r), float(b.b)]
                    else:
                        block["bbox"] = list(b) if isinstance(b, (list, tuple)) else None
                except Exception:
                    pass
            blocks.append(block)
    except Exception as exc:
        logger.warning("texts extraction failed: %s", exc)

    # If no blocks via attribute, try body iteration or export_to_dict
    if not blocks:
        try:
            d = document.export_to_dict()  # type: ignore
            # d may contain "texts", "main_text", "body", "children"
            # try to find texts
            for key in ("texts", "paragraphs", "body"):
                val = d.get(key) if isinstance(d, dict) else None
                if isinstance(val, list) and val:
                    for it in val:
                        if isinstance(it, dict):
                            txt = it.get("text") or it.get("value") or ""
                            if not txt:
                                continue
                            # FIX: 'label' might be an enum/dict not a string; coerce safely before .lower()
                            raw_label = it.get("label") or it.get("type") or ""
                            if isinstance(raw_label, str):
                                label = raw_label.lower()
                            else:
                                # handle non-string label (e.g. {"$ref": "#/$defs/..." } or enum)
                                try:
                                    label = str(raw_label).lower()
                                except Exception:
                                    label = ""
                            # extract page
                            prov = it.get("prov") or it.get("provenance")
                            page_no = 1
                            if isinstance(prov, list) and prov:
                                page_no = _prov_page(prov[0])
                            elif prov:
                                page_no = _prov_page(prov)
                            btype = "paragraph"
                            if label in ("title", "section_header", "heading"):
                                btype = "heading"
                            elif "list" in label:
                                btype = "list_item"
                            blocks.append({"id": str(it.get("self_ref") or it.get("id") or uuid.uuid4()), "type": btype, "text": str(txt), "page": page_no, **({"level": 1} if btype == "heading" else {})})
                    if blocks:
                        break
            # Also try to extract tables/images from dict
            if isinstance(d, dict):
                for t in d.get("tables", []) or []:
                    try:
                        # table dict may have "data": {"grid": [[{"text":...}]]}
                        data = t.get("data") or t.get("grid") or {}
                        grid = data.get("grid") if isinstance(data, dict) else data
                        rows: list[list[str]] = []
                        if isinstance(grid, list):
                            for row in grid:
                                if isinstance(row, list):
                                    rows.append([cell.get("text", "") if isinstance(cell, dict) else str(cell) for cell in row])
                        prov = t.get("prov")
                        page_no = _prov_page(prov[0] if isinstance(prov, list) and prov else prov) if prov else 1
                        tables.append({"id": str(t.get("self_ref") or t.get("id") or uuid.uuid4()), "page": page_no, "rows": rows, "columns": rows[0] if rows else []})
                    except Exception:
                        continue
                for pic in (d.get("pictures") or d.get("figures") or []):
                    try:
                        prov = pic.get("prov")
                        page_no = _prov_page(prov[0] if isinstance(prov, list) and prov else prov) if prov else 1
                        caption = pic.get("caption") or pic.get("text") or ""
                        if isinstance(caption, dict):
                            caption = caption.get("text") or ""
                        images.append({"id": str(pic.get("self_ref") or pic.get("id") or uuid.uuid4()), "page": page_no, "caption": str(caption)[:500]})
                    except Exception:
                        continue
        except Exception as exc:
            logger.warning("dict fallback failed: %s", exc)

    # Tables via object API (if not already populated)
    if not tables:
        try:
            for tbl in getattr(document, "tables", []) or []:
                try:
                    # TableItem may have data attribute with grid
                    data = getattr(tbl, "data", None)
                    rows: list[list[str]] = []
                    grid = None
                    if data is not None:
                        grid = getattr(data, "grid", None) or getattr(data, "table_cells", None) or data
                    # try export to dict for table
                    if grid is None:
                        try:
                            tbl_dict = tbl.export_to_dict()  # type: ignore
                            grid = tbl_dict.get("data", {}).get("grid")
                        except Exception:
                            grid = None
                    if isinstance(grid, list):
                        for row in grid:
                            if isinstance(row, list):
                                rows.append([cell.text if hasattr(cell, "text") else str(cell.get("text", "")) if isinstance(cell, dict) else str(cell) for cell in row])
                            elif isinstance(row, dict):
                                rows.append([str(v) for v in row.values()])
                    # fallback: try to parse markdown table from text?
                    prov = getattr(tbl, "prov", None)
                    page_no = _prov_page(prov[0] if isinstance(prov, list) and prov else prov) if prov else 1
                    if rows or getattr(tbl, "self_ref", None):
                        tables.append({"id": str(getattr(tbl, "self_ref", "") or getattr(tbl, "id", "") or uuid.uuid4()), "page": page_no, "rows": rows, "columns": rows[0] if rows else []})
                except Exception as e:
                    logger.debug("table extraction item failed: %s", e)
                    continue
        except Exception as exc:
            logger.warning("tables object extraction failed: %s", exc)

    if not images:
        try:
            pics = getattr(document, "pictures", None) or getattr(document, "figures", None) or getattr(document, "images", None) or []
            if isinstance(pics, dict):
                pics = list(pics.values())
            for pic in pics:
                try:
                    prov = getattr(pic, "prov", None)
                    page_no = _prov_page(prov[0] if isinstance(prov, list) and prov else prov) if prov else 1
                    caption = ""
                    for attr in ("caption", "text"):
                        v = getattr(pic, attr, None)
                        if isinstance(v, str) and v:
                            caption = v
                            break
                        if v is not None:
                            try:
                                caption = _item_text(v)
                                if caption:
                                    break
                            except Exception:
                                pass
                    images.append({"id": str(getattr(pic, "self_ref", "") or getattr(pic, "id", "") or uuid.uuid4()), "page": page_no, "caption": str(caption)[:500]})
                except Exception:
                    continue
        except Exception as exc:
            logger.warning("images object extraction failed: %s", exc)

    # Ensure tables have rows/columns at least empty
    for t in tables:
        t.setdefault("rows", [])
        t.setdefault("columns", t["rows"][0] if t["rows"] else [])

    # Preserve reading order: docling already preserves it via order of texts; we keep that order

    return {
        "markdown": markdown,
        "pages": pages,
        "blocks": blocks,
        "tables": tables,
        "images": images,
        "metadata": {**metadata, "pages": len(pages), "blocks": len(blocks)},
    }


def convert_document(file_path: str) -> dict[str, Any]:
    """
    Convert a document file (PDF/DOCX/PPTX) via Docling if available,
    else fallback to PyMuPDF / python-docx.
    Returns dict with markdown, pages, blocks, tables, images, metadata.
    """
    p = Path(file_path)
    if not p.exists():
        raise FileNotFoundError(f"File not found: {file_path}")
    suffix = p.suffix.lower()
    if suffix not in (".pdf", ".docx", ".pptx", ".ppt", ".doc", ".md", ".txt", ".html", ".htm", ".xlsx"):
        logger.warning("Unsupported suffix %s – attempting conversion anyway", suffix)

    converter = get_converter()
    if converter is None:
        logger.info("Using fallback extractor for %s", p.name)
        return _fallback_extract(file_path)

    try:
        start = time.time()
        # Docling's convert expects path string or URL; prefer string path
        result = converter.convert(str(p))
        document = result.document
        elapsed = time.time() - start
        logger.info("Docling converted %s in %.2fs", p.name, elapsed)
        extracted = _extract_from_docling_document(document, p.name)
        extracted["metadata"]["conversion_time_s"] = round(elapsed, 3)
        extracted["metadata"]["fallback"] = False
        # If docling returned essentially empty (e.g. scanned PDF with no OCR model), fallback to doing OCR via pymupdf + easyocr hint
        if not extracted["blocks"] and not extracted["markdown"].strip():
            logger.warning("Docling returned empty for %s – falling back to PyMuPDF OCR hint", p.name)
            fallback = _fallback_extract(file_path)
            # merge fallback blocks but keep docling pages
            if fallback["blocks"]:
                extracted["blocks"] = fallback["blocks"]
                if not extracted["markdown"].strip():
                    extracted["markdown"] = fallback["markdown"]
                extracted["metadata"]["fallback_blocks"] = True
        return extracted
    except Exception as exc:
        logger.exception("Docling conversion failed for %s: %s – using fallback", p.name, exc)
        return _fallback_extract(file_path)


class DoclingConverter:
    """Thin wrapper class for DI / testing."""

    def convert(self, file_path: str) -> dict[str, Any]:
        return convert_document(file_path)

    def get_supported_formats(self) -> list[str]:
        return [".pdf", ".docx", ".pptx", ".ppt", ".doc", ".md", ".txt", ".html", ".xlsx"]

    def health(self) -> dict[str, Any]:
        conv = get_converter()
        return {
            "docling_available": conv is not None,
            "ocr_languages": ["de", "en"],
            "supported_formats": self.get_supported_formats(),
        }
