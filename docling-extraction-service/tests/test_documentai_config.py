"""Configuration and processor-selection tests for Google Document AI."""

from __future__ import annotations

import sys
import types
from pathlib import Path

import pytest

SRC = Path(__file__).resolve().parent.parent / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))


@pytest.fixture(autouse=True)
def clear_docai_env(monkeypatch):
    for name in (
        "GOOGLE_CLOUD_PROJECT",
        "DOCAI_LOCATION",
        "DOCAI_OCR_PROCESSOR_ID",
        "DOCAI_LAYOUT_PROCESSOR_ID",
        "GOOGLE_APPLICATION_CREDENTIALS",
    ):
        monkeypatch.delenv(name, raising=False)


def test_layout_configuration_requires_the_layout_processor(tmp_path, monkeypatch):
    from woodpacker_extraction.layout.providers.documentai import configuration_error

    credentials = tmp_path / "credentials.json"
    credentials.write_text("{}", encoding="utf-8")
    monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", "woodpecker-507001")
    monkeypatch.setenv("GOOGLE_APPLICATION_CREDENTIALS", str(credentials))
    monkeypatch.setenv("DOCAI_OCR_PROCESSOR_ID", "ocr")

    assert configuration_error("layout") == "missing DOCAI_LAYOUT_PROCESSOR_ID"


def test_ocr_and_layout_processor_ids_are_selected_independently(tmp_path, monkeypatch):
    from woodpacker_extraction.layout.providers.documentai import _get_client

    credentials = tmp_path / "credentials.json"
    credentials.write_text("{}", encoding="utf-8")
    monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", "woodpecker-507001")
    monkeypatch.setenv("DOCAI_LOCATION", "eu")
    monkeypatch.setenv("GOOGLE_APPLICATION_CREDENTIALS", str(credentials))
    monkeypatch.setenv("DOCAI_OCR_PROCESSOR_ID", "ocr-processor")
    monkeypatch.setenv("DOCAI_LAYOUT_PROCESSOR_ID", "layout-processor")

    class FakeClient:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

    fake_google = types.ModuleType("google")
    fake_cloud = types.ModuleType("google.cloud")
    fake_documentai_module = types.ModuleType("google.cloud.documentai")
    fake_documentai_module.DocumentProcessorServiceClient = FakeClient
    fake_documentai_module.RawDocument = object
    fake_documentai_module.ProcessRequest = object
    monkeypatch.setitem(sys.modules, "google", fake_google)
    monkeypatch.setitem(sys.modules, "google.cloud", fake_cloud)
    monkeypatch.setitem(sys.modules, "google.cloud.documentai", fake_documentai_module)

    from woodpacker_extraction.layout.providers import documentai

    documentai._client = None
    documentai._client_key = None
    _client, layout_name = _get_client("layout")
    _client, ocr_name = _get_client("ocr")

    assert layout_name == "projects/woodpecker-507001/locations/eu/processors/layout-processor"
    assert ocr_name == "projects/woodpecker-507001/locations/eu/processors/ocr-processor"
    assert _client.kwargs["client_options"]["api_endpoint"] == "eu-documentai.googleapis.com"


def test_configuration_error_does_not_include_credential_path(tmp_path, monkeypatch):
    from woodpacker_extraction.layout.providers.documentai import configuration_error

    secret_path = tmp_path / "private-service-account.json"
    monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", "woodpecker-507001")
    monkeypatch.setenv("GOOGLE_APPLICATION_CREDENTIALS", str(secret_path))
    monkeypatch.setenv("DOCAI_LAYOUT_PROCESSOR_ID", "layout")

    error = configuration_error("layout")

    assert error == "GOOGLE_APPLICATION_CREDENTIALS file is not readable"
    assert str(secret_path) not in error


def test_layout_parser_document_blocks_are_normalized(monkeypatch):
    from PIL import Image

    from woodpacker_extraction.layout.providers import documentai

    class Proto:
        def WhichOneof(self, _name):
            return "text_block"

    class TextBlock:
        text = "A layout parser paragraph"
        type_ = "paragraph"

    class Block:
        _pb = Proto()
        bounding_box = types.SimpleNamespace(
            normalized_vertices=[
                types.SimpleNamespace(x=0.1, y=0.1),
                types.SimpleNamespace(x=0.9, y=0.1),
                types.SimpleNamespace(x=0.9, y=0.2),
                types.SimpleNamespace(x=0.1, y=0.2),
            ]
        )
        text_block = TextBlock()

    monkeypatch.setattr(
        documentai,
        "process_document_with_docai",
        lambda *_args, **_kwargs: types.SimpleNamespace(
            pages=[],
            document_layout=types.SimpleNamespace(blocks=[Block()]),
            text="A layout parser paragraph",
        ),
    )

    regions = documentai.DocumentAIProvider().detect_page(Image.new("RGB", (1000, 1000)), 3)

    assert len(regions) == 1
    assert regions[0].type_hint == "paragraph"
    assert regions[0].text == "A layout parser paragraph"
    assert regions[0].bbox == (100.0, 100.0, 900.0, 200.0)
    assert regions[0].meta["page"] == 3
