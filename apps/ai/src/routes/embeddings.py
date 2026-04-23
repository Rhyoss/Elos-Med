"""
Geração de embeddings vetoriais para busca semântica em prontuários.
Usa Ollama localmente — PHI nunca sai do ambiente.
"""
from typing import Annotated

import ollama
import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..config import settings

router = APIRouter()
logger = structlog.get_logger()


class EmbeddingRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=10_000)
    model: str = Field(default="nomic-embed-text")


class EmbeddingResponse(BaseModel):
    embedding: list[float]
    model: str
    dimensions: int


@router.post("", response_model=EmbeddingResponse)
async def generate_embedding(request: EmbeddingRequest) -> EmbeddingResponse:
    """
    Gera embedding vetorial de texto clínico para armazenamento em pgvector.
    Texto PHI processado localmente via Ollama.
    """
    try:
        client = ollama.AsyncClient(host=settings.ollama_base_url)
        response = await client.embeddings(
            model=request.model,
            prompt=request.text,
        )
        embedding = response["embedding"]

        return EmbeddingResponse(
            embedding=embedding,
            model=request.model,
            dimensions=len(embedding),
        )
    except Exception as exc:
        logger.error("embedding_generation_failed", error=str(exc), model=request.model)
        raise HTTPException(status_code=500, detail="Falha ao gerar embedding") from exc
