"""Wrapper para classificação de sentimento via transformers (BERT multilingual).

O modelo é carregado uma vez no startup (lazy via `load`) e protegido
por asyncio.Lock para uso concorrente. Inferência roda em thread (CPU).
"""
from __future__ import annotations

import asyncio
import re
from typing import Optional

from ..config import settings
from ..logging_setup import get_logger

logger = get_logger(__name__)

_LABEL_TO_BUCKET = {
    "1 star": "negative",
    "2 stars": "negative",
    "3 stars": "neutral",
    "4 stars": "positive",
    "5 stars": "positive",
    "negative": "negative",
    "neutral": "neutral",
    "positive": "positive",
    "neg": "negative",
    "neu": "neutral",
    "pos": "positive",
}

_ASPECT_HINTS = {
    "atendimento": ["atendimento", "recepção", "secretária"],
    "preço": ["preço", "valor", "caro", "barato", "custo"],
    "resultado": ["resultado", "tratamento", "melhora", "piora"],
    "tempo_espera": ["espera", "demora", "atraso"],
    "ambiente": ["ambiente", "clínica", "consultório", "limpeza"],
}


class SentimentModel:
    def __init__(self) -> None:
        self.loaded: bool = False
        self.error: Optional[str] = None
        self.version: str = settings.sentiment_model_id
        self._pipeline = None
        self._lock = asyncio.Lock()

    def load(self) -> None:
        """Carrega o pipeline de transformers em memória (síncrono, CPU)."""
        try:
            from transformers import pipeline  # import tardio
            import torch

            self._pipeline = pipeline(
                task="sentiment-analysis",
                model=settings.sentiment_model_id,
                tokenizer=settings.sentiment_model_id,
                device=-1,  # CPU
                truncation=True,
                max_length=settings.sentiment_max_tokens,
                framework="pt",
                torch_dtype=torch.float32,
            )
            self.loaded = True
            self.error = None
            logger.info("ml.sentiment.loaded", model=self.version)
        except Exception as exc:
            self.loaded = False
            self.error = str(exc)
            logger.error("ml.sentiment.load_failed", error=self.error)

    async def predict(self, text: str) -> dict:
        if not self.loaded or self._pipeline is None:
            raise RuntimeError("sentiment_model_not_loaded")

        async with self._lock:
            result = await asyncio.get_event_loop().run_in_executor(
                None, self._pipeline, text
            )

        primary = result[0] if isinstance(result, list) else result
        label_raw = str(primary.get("label", "")).lower()
        bucket = _LABEL_TO_BUCKET.get(label_raw, "neutral")
        score = float(primary.get("score", 0.0))

        aspects = _extract_aspects(text, bucket, score)
        return {"sentiment": bucket, "score": round(score, 4), "aspects": aspects}


def _extract_aspects(text: str, sentiment: str, score: float) -> list[dict]:
    """Heurística simples: localiza menções a aspectos conhecidos.

    Para uma análise verdadeiramente aspectual seria necessário ABSA
    dedicado; aqui retornamos apenas aspectos detectados no texto,
    herdando o sentimento global do trecho.
    """
    found = []
    lowered = text.lower()
    for aspect, kws in _ASPECT_HINTS.items():
        if any(re.search(rf"\b{re.escape(k)}\b", lowered) for k in kws):
            found.append(
                {"aspect": aspect, "sentiment": sentiment, "score": round(score, 4)}
            )
    return found


sentiment_model = SentimentModel()
