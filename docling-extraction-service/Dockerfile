# syntax=docker/dockerfile:1
#
# docling-extraction-service (was: extraction-service) — now inside Woodpacker project
# Single image hosts TWO logical services (see README + compose.yaml):
#   - python-extraction-service: python -m woodpacker_extraction.server (port 8001, layout-first pipeline)
#   - docling-extraction-service: uvicorn app:app --host 0.0.0.0 --port 8001 (port 8002 externally)
#
# Woodpacker Docling Extraction Service (app.py) + Python Extraction Service (src/woodpacker_extraction/server.py)
# Spec: FROM python:3.12, EXPOSE 8001
#   docling  → CMD uvicorn app:app --host 0.0.0.0 --port 8001
#   python   → command: python -m woodpacker_extraction.server (overridden in compose.yaml)
# Backward-compatible with existing Next.js/NestJS/Postgres stack via legacy routes in app.py
#
# Builds a production-ready image with Docling + EasyOCR (de/en) for scanned PDFs:
#   pip install docling fastapi uvicorn python-multipart "docling[easyocr]"

FROM python:3.12

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

# System dependencies for OCR (opencv, pdf rendering) and build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 libsm6 libxext6 libxrender1 \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency manifests first for layer caching
COPY pyproject.toml README.md ./
COPY requirements.txt requirements-ocr.txt ./

# Copy application source – both new Docling service and legacy Woodpacker extraction
COPY app.py ./app.py
COPY converters ./converters
COPY src ./src

# Install Python dependencies directly from pyproject.toml
# This avoids pinned version conflicts in requirements.txt
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -e . \
    && mkdir -p uploads outputs \
    && useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app

# Backwards-compatible site-packages from legacy build (if needed)
# Legacy service expects generated Prisma client; keep if present
USER appuser
ENV PATH="/usr/local/bin:${PATH}"

EXPOSE 8001

# Spec start command (uses uvicorn executable, installed globally before USER switch)
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8001"]
