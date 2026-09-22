from __future__ import annotations

import asyncio
import logging
import os
import re
from contextlib import asynccontextmanager
from dataclasses import dataclass
from enum import Enum
from importlib import metadata
from time import perf_counter
from typing import Any, Callable, Mapping, Protocol

from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator


MODEL_DIMENSIONS = 1024
logger = logging.getLogger("bge-m3-embedding")


def _positive_int(name: str, default: int) -> int:
    raw_value = os.getenv(name, str(default))
    try:
        value = int(raw_value)
    except ValueError as error:
        raise ValueError(f"{name} must be an integer, got {raw_value!r}") from error
    if value <= 0:
        raise ValueError(f"{name} must be greater than zero")
    return value


def _boolean(name: str, default: bool) -> bool:
    raw_value = os.getenv(name, str(default)).strip().lower()
    if raw_value in {"1", "true", "yes", "on"}:
        return True
    if raw_value in {"0", "false", "no", "off"}:
        return False
    raise ValueError(f"{name} must be a boolean, got {raw_value!r}")


@dataclass(frozen=True)
class Settings:
    model_name: str = "BAAI/bge-m3"
    device: str = "cuda:0"
    max_length: int = 1024
    max_batch_size: int = 32
    max_text_characters: int = 100_000
    fp16: bool = True
    cache_dir: str = "/models/huggingface"

    @classmethod
    def from_env(cls) -> "Settings":
        settings = cls(
            model_name=os.getenv("BGE_MODEL_NAME", "BAAI/bge-m3"),
            device=os.getenv("BGE_DEVICE", "cuda:0"),
            max_length=_positive_int("BGE_MAX_LENGTH", 1024),
            max_batch_size=_positive_int("BGE_MAX_BATCH_SIZE", 32),
            max_text_characters=_positive_int("BGE_MAX_TEXT_CHARACTERS", 100_000),
            fp16=_boolean("BGE_FP16", True),
            cache_dir=os.getenv("HF_HOME", "/models/huggingface"),
        )
        if not re.fullmatch(r"cuda:\d+", settings.device):
            raise ValueError(
                "BGE_DEVICE must select an explicit CUDA device such as cuda:0; "
                "CPU fallback is not supported"
            )
        if not settings.model_name.strip():
            raise ValueError("BGE_MODEL_NAME must not be empty")
        return settings


class InputType(str, Enum):
    QUERY = "query"
    DOCUMENT = "document"


class EmbedRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    texts: list[str] = Field(min_length=1)
    input_type: InputType = Field(alias="inputType")

    @field_validator("texts")
    @classmethod
    def reject_blank_texts(cls, texts: list[str]) -> list[str]:
        blank_indexes = [index for index, text in enumerate(texts) if not text.strip()]
        if blank_indexes:
            raise ValueError(f"texts contains blank strings at indexes {blank_indexes}")
        return texts


class RuntimeMetadata(BaseModel):
    flag_embedding: str = Field(alias="flagEmbedding")
    torch: str
    cuda: str


class HealthResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    status: str
    ready: bool
    provider: str
    model: str
    device: str
    dimensions: int
    max_length: int = Field(alias="maxLength")
    fp16: bool
    normalized: bool
    cuda_available: bool = Field(alias="cudaAvailable")
    gpu_name: str = Field(alias="gpuName")
    runtime: RuntimeMetadata


class EmbedResponse(BaseModel):
    model: str
    dimensions: int
    normalized: bool
    count: int
    embeddings: list[list[float]]


class EmbeddingBackend(Protocol):
    provider: str
    model_name: str
    device: str
    dimensions: int
    max_length: int
    fp16: bool
    normalized: bool
    cuda_available: bool
    gpu_name: str
    runtime: dict[str, str]

    def token_lengths(self, texts: list[str]) -> list[int]: ...

    def encode(self, texts: list[str], input_type: InputType) -> list[list[float]]: ...


class FlagEmbeddingBackend:
    provider = "FlagEmbedding"
    dimensions = MODEL_DIMENSIONS
    normalized = True

    def __init__(self, settings: Settings) -> None:
        # Heavy imports stay here so unit tests can use a fake backend without
        # installing Torch, FlagEmbedding, downloading the model, or using a GPU.
        import torch
        from FlagEmbedding import BGEM3FlagModel

        self.model_name = settings.model_name
        self.device = settings.device
        self.max_length = settings.max_length
        self.fp16 = settings.fp16
        self.cuda_available = bool(torch.cuda.is_available())

        if not self.cuda_available:
            raise RuntimeError(
                f"{self.device} was requested, but torch.cuda.is_available() is false; "
                "the service will not fall back to CPU"
            )

        device_index = int(self.device.split(":", maxsplit=1)[1])
        if device_index >= torch.cuda.device_count():
            raise RuntimeError(
                f"{self.device} was requested, but only {torch.cuda.device_count()} "
                "CUDA device(s) are visible"
            )

        self.gpu_name = torch.cuda.get_device_name(device_index)
        self.runtime = {
            "flagEmbedding": metadata.version("FlagEmbedding"),
            "torch": torch.__version__,
            "cuda": torch.version.cuda or "unknown",
        }

        logger.info(
            "Loading model=%s device=%s max_length=%d fp16=%s",
            self.model_name,
            self.device,
            self.max_length,
            self.fp16,
        )
        self._model = BGEM3FlagModel(
            self.model_name,
            devices=[self.device],
            use_fp16=self.fp16,
            pooling_method="cls",
            normalize_embeddings=self.normalized,
            cache_dir=settings.cache_dir,
            batch_size=settings.max_batch_size,
            query_max_length=self.max_length,
            passage_max_length=self.max_length,
            return_dense=True,
            return_sparse=False,
            return_colbert_vecs=False,
        )

        tokenizer_limit = getattr(self._model.tokenizer, "model_max_length", None)
        if (
            isinstance(tokenizer_limit, int)
            and tokenizer_limit < 1_000_000
            and self.max_length > tokenizer_limit
        ):
            raise RuntimeError(
                f"BGE_MAX_LENGTH={self.max_length} exceeds tokenizer capacity "
                f"{tokenizer_limit}"
            )

    def token_lengths(self, texts: list[str]) -> list[int]:
        return [
            len(
                self._model.tokenizer.encode(
                    text,
                    add_special_tokens=True,
                    truncation=False,
                )
            )
            for text in texts
        ]

    def encode(self, texts: list[str], input_type: InputType) -> list[list[float]]:
        encode_method = (
            self._model.encode_queries
            if input_type is InputType.QUERY
            else self._model.encode_corpus
        )
        output = encode_method(
            texts,
            batch_size=len(texts),
            max_length=self.max_length,
            return_dense=True,
            return_sparse=False,
            return_colbert_vecs=False,
        )

        # FlagEmbedding 1.4.2 returns a mapping. Supporting a direct array here
        # keeps this narrow adapter tolerant of the older stable API shape.
        dense_vectors: Any = (
            output["dense_vecs"] if isinstance(output, Mapping) else output
        )
        vectors = dense_vectors.tolist() if hasattr(dense_vectors, "tolist") else dense_vectors

        if not isinstance(vectors, list) or len(vectors) != len(texts):
            raise RuntimeError("FlagEmbedding returned an unexpected dense embedding batch")

        json_vectors: list[list[float]] = []
        for vector in vectors:
            if not isinstance(vector, (list, tuple)) or len(vector) != self.dimensions:
                raise RuntimeError(
                    "FlagEmbedding returned an embedding with an unexpected dimension"
                )
            json_vectors.append([float(value) for value in vector])
        return json_vectors


BackendFactory = Callable[[Settings], EmbeddingBackend]


def health_metadata(backend: EmbeddingBackend) -> HealthResponse:
    return HealthResponse(
        status="ok",
        ready=True,
        provider=backend.provider,
        model=backend.model_name,
        device=backend.device,
        dimensions=backend.dimensions,
        maxLength=backend.max_length,
        fp16=backend.fp16,
        normalized=backend.normalized,
        cudaAvailable=backend.cuda_available,
        gpuName=backend.gpu_name,
        runtime=RuntimeMetadata(**backend.runtime),
    )


def _validate_limits(payload: EmbedRequest, settings: Settings) -> None:
    if len(payload.texts) > settings.max_batch_size:
        raise HTTPException(
            status_code=422,
            detail=(
                f"texts contains {len(payload.texts)} items; "
                f"maximum batch size is {settings.max_batch_size}"
            ),
        )

    oversized = [
        index
        for index, text in enumerate(payload.texts)
        if len(text) > settings.max_text_characters
    ]
    if oversized:
        raise HTTPException(
            status_code=422,
            detail=(
                f"texts at indexes {oversized} exceed the configured limit of "
                f"{settings.max_text_characters} characters"
            ),
        )


def create_app(
    settings: Settings | None = None,
    backend_factory: BackendFactory = FlagEmbeddingBackend,
) -> FastAPI:
    service_settings = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        backend = backend_factory(service_settings)
        application.state.backend = backend
        application.state.inference_lock = asyncio.Lock()
        logger.info(
            "Embedding service ready model=%s device=%s dimensions=%d",
            backend.model_name,
            backend.device,
            backend.dimensions,
        )
        yield

    application = FastAPI(
        title="BGE-M3 dense embedding service",
        version="1.0.0-b1",
        lifespan=lifespan,
    )

    @application.get("/health", response_model=HealthResponse)
    async def health(request: Request) -> HealthResponse:
        return health_metadata(request.app.state.backend)

    @application.post("/embed", response_model=EmbedResponse)
    async def embed(payload: EmbedRequest, request: Request) -> EmbedResponse:
        _validate_limits(payload, service_settings)
        backend: EmbeddingBackend = request.app.state.backend
        started_at = perf_counter()

        async with request.app.state.inference_lock:
            token_lengths = await asyncio.to_thread(backend.token_lengths, payload.texts)
            too_long = [
                {"index": index, "tokens": token_count}
                for index, token_count in enumerate(token_lengths)
                if token_count > service_settings.max_length
            ]
            if too_long:
                raise HTTPException(
                    status_code=422,
                    detail={
                        "message": (
                            "one or more texts exceed BGE_MAX_LENGTH; "
                            "no text was truncated and no embedding was produced"
                        ),
                        "maxLength": service_settings.max_length,
                        "items": too_long,
                    },
                )
            embeddings = await asyncio.to_thread(
                backend.encode, payload.texts, payload.input_type
            )

        duration_ms = (perf_counter() - started_at) * 1000
        logger.info(
            "Embedded count=%d input_type=%s duration_ms=%.1f dimensions=%d",
            len(payload.texts),
            payload.input_type.value,
            duration_ms,
            backend.dimensions,
        )
        return EmbedResponse(
            model=backend.model_name,
            dimensions=backend.dimensions,
            normalized=backend.normalized,
            count=len(embeddings),
            embeddings=embeddings,
        )

    return application


app = create_app()
