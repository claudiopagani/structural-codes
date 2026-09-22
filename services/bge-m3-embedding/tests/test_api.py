from __future__ import annotations

from typing import ClassVar

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import EmbedRequest, InputType, Settings, create_app


class FakeBackend:
    provider = "FlagEmbedding"
    model_name = "BAAI/bge-m3"
    device = "cuda:0"
    dimensions = 1024
    max_length = 1024
    fp16 = True
    normalized = True
    cuda_available = True
    gpu_name = "Mock NVIDIA GPU"
    runtime: ClassVar[dict[str, str]] = {
        "flagEmbedding": "test",
        "torch": "test",
        "cuda": "test",
    }

    def __init__(self, settings: Settings) -> None:
        self.max_length = settings.max_length
        self.last_input_type: InputType | None = None

    def token_lengths(self, texts: list[str]) -> list[int]:
        return [self.max_length + 1 if text == "TOO_LONG" else 4 for text in texts]

    def encode(self, texts: list[str], input_type: InputType) -> list[list[float]]:
        self.last_input_type = input_type
        return [[0.0] * self.dimensions for _ in texts]


@pytest.fixture
def settings() -> Settings:
    return Settings(max_batch_size=2)


@pytest.fixture
def client(settings: Settings):
    app = create_app(settings=settings, backend_factory=FakeBackend)
    with TestClient(app) as test_client:
        yield test_client


def test_request_schema_accepts_strings_and_document_type() -> None:
    payload = EmbedRequest.model_validate(
        {"texts": ["testo uno", "testo due"], "inputType": "document"}
    )

    assert payload.texts == ["testo uno", "testo due"]
    assert payload.input_type is InputType.DOCUMENT


def test_request_schema_rejects_non_string_items() -> None:
    with pytest.raises(ValidationError):
        EmbedRequest.model_validate({"texts": [123], "inputType": "document"})


def test_input_type_is_restricted() -> None:
    with pytest.raises(ValidationError):
        EmbedRequest.model_validate({"texts": ["testo"], "inputType": "passage"})


def test_empty_batch_is_rejected(client: TestClient) -> None:
    response = client.post("/embed", json={"texts": [], "inputType": "document"})

    assert response.status_code == 422
    assert "texts" in response.text


def test_oversized_batch_is_rejected(client: TestClient) -> None:
    response = client.post(
        "/embed",
        json={"texts": ["uno", "due", "tre"], "inputType": "document"},
    )

    assert response.status_code == 422
    assert "maximum batch size is 2" in response.text


def test_health_metadata(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "ready": True,
        "provider": "FlagEmbedding",
        "model": "BAAI/bge-m3",
        "device": "cuda:0",
        "dimensions": 1024,
        "maxLength": 1024,
        "fp16": True,
        "normalized": True,
        "cudaAvailable": True,
        "gpuName": "Mock NVIDIA GPU",
        "runtime": {
            "flagEmbedding": "test",
            "torch": "test",
            "cuda": "test",
        },
    }


@pytest.mark.parametrize("input_type", ["query", "document"])
def test_embed_uses_supported_input_type(client: TestClient, input_type: str) -> None:
    response = client.post(
        "/embed", json={"texts": ["testo"], "inputType": input_type}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 1
    assert body["dimensions"] == 1024
    assert len(body["embeddings"][0]) == 1024
    assert client.app.state.backend.last_input_type is InputType(input_type)


def test_text_over_token_limit_is_rejected_without_encoding(client: TestClient) -> None:
    response = client.post(
        "/embed", json={"texts": ["TOO_LONG"], "inputType": "document"}
    )

    assert response.status_code == 422
    assert response.json()["detail"]["maxLength"] == 1024
    assert "no text was truncated" in response.json()["detail"]["message"]
