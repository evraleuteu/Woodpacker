# docling-extraction-service (was: extraction-service)

> **Renamed + moved** from `../extraction-service` → `./docling-extraction-service` inside the Woodpacker project
> to avoid confusion with the Python pipeline. This single Docker image hosts **two logical services**
> (same `pyproject.toml` / `.venv`, different entrypoints) — see `compose.yaml`:

| Logical service | Compose service | Container | Port (host→internal) | Entrypoint | Purpose |
|---|---|---|---|---|---|
| **Python Extraction Service** (layout-first + LLM exercise pipeline) | `python-extraction-service` | `woodpacker-python-extraction` | `8001→8001` | `python -m woodpacker_extraction.server` (`src/woodpacker_extraction/server.py`) | Deterministic layout detection (PyMuPDF / Surya / DocumentAI), per-block OCR, exercise grouping, relationships, pipeline-inspector artifacts |
| **Docling Extraction Service** (generic document converter) | `docling-extraction-service` | `woodpacker-docling-extraction` | `8002→8001` | `uvicorn app:app` (`app.py` + `converters/docling_converter.py`) | Docling + EasyOCR (de/en), PDF/DOCX/PPTX → `markdown/pages/blocks/tables/images`, `outputs/document.json` — layout-preserved, book-agnostic |

Legacy alias `EXTRACTION_SERVICE_URL` still points to the Python service for backward-compat;
new canonical vars are `PYTHON_EXTRACTION_SERVICE_URL` and `DOCLING_EXTRACTION_SERVICE_URL`.

## woodpacker-extraction (Python Extraction Service)

The **Learning Material Intelligence Agent** for Woodpacker.

Reads uploaded learning materials (PDFs, text, audio, video, images) and builds a
structured, connected **Learning Material Graph**: material classification,
hierarchical exercises + individual exercise items, resource links (audio /
video / solutions / readings / chapter & exercise-number matches), a knowledge
graph with confidence scores, and a quality-control report.

Driven by the engine spec in
`Context Files/LEARNING_MATERIAL_RELATIONSHIP_ENGINE.md`.

> **Physical layout:** `src/woodpacker_extraction/` (this repo) is the Python Extraction Service.
> `app.py` + `converters/` is the Docling Extraction Service, sharing the same image for CI simplicity.

## Location

- Old: `C:\...\Woodpacker\extraction-service` (outside project, ambiguous)
- New: `C:\...\Woodpacker\Woodpacker\docling-extraction-service` (inside project, renamed for clarity)
- Next.js fallback path: `src/app/api/extract/pdf/route.ts` now defaults to `join(process.cwd(), 'docling-extraction-service')`
- Compose contexts: `../extraction-service` → `./docling-extraction-service`

## Install

```bash
.venv\Scripts\activate
pip install .
```

## CLI

```bash
# Classify, extract exercises and relationships, print JSON graph:
woodpacker-extract path/to/Kursbuch.pdf path/to/Übungsbuch.pdf path/to/Track_12.mp3
```

## Library

```python
from woodpacker_extraction import build_graph, LMRE_PROMPT

graph = build_graph(["Kursbuch.pdf", "Übungsbuch.pdf"], refine=True)
print(graph.model_dump(by_alias=True))
```

When `OPENCODE_API_KEY` is set, classifications are refined by the OpenCode LLM
using the `LMRE_PROMPT` Role prompt. Without a key the agent runs fully offline
via the local heuristic engine.

## Environment

| Variable           | Default                      | Notes |
|--------------------|------------------------------|-------|
| `OPENCODE_API_URL` | `https://opencode.ai/zen/v1` | OpenAI-compatible endpoint |
| `OPENCODE_API_KEY` | —                            | Required for the LLM path |
| `OPENCODE_MODEL`   | `deepseek-v4-flash-free`     | Model name |
