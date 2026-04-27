"""POST /analyze/sentiment e POST /detect/anomaly."""
from __future__ import annotations

import asyncio
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from ..auth import require_internal_key
from ..cache import cache_get, cache_set, hash_key
from ..config import settings
from ..logging_setup import get_logger
from ..metrics import measure
from ..ml.anomaly import detect as detect_anomaly
from ..ml.sentiment import sentiment_model
from ..rate_limit import enforce_rate_limit
from ..sanitize import sanitize_text

router = APIRouter()
logger = get_logger(__name__)


# ─── /analyze/sentiment ──────────────────────────────────────────────────────


class SentimentRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4096)
    language: Literal["pt-BR", "en", "es"] = "pt-BR"
    conversation_id: Optional[str] = Field(default=None, max_length=128)

    @field_validator("text")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()


def _err(endpoint: str, code: str, message: str, http: int) -> HTTPException:
    return HTTPException(
        status_code=http,
        detail={"error": endpoint, "code": code, "message": message},
    )


@router.post("/analyze/sentiment", dependencies=[Depends(require_internal_key)])
async def analyze_sentiment(payload: SentimentRequest):
    await enforce_rate_limit("sentiment", "global", settings.rate_limit_sentiment)

    if not sentiment_model.loaded:
        raise _err("analyze_sentiment", "MODEL_UNAVAILABLE",
                   "Modelo de sentimento não carregado.", 503)

    clean, sanitized, counts = sanitize_text(payload.text)
    if sanitized:
        logger.info(
            "analyze.sentiment.sanitized",
            counts=counts,
            conversation_id=payload.conversation_id,
        )

    cache_key = hash_key(
        "sentiment", {"t": clean, "l": payload.language}
    )
    cached = await cache_get(cache_key)
    if cached is not None:
        # Atualiza apenas o flag "sanitized" para refletir o request atual.
        return {**cached, "sanitized": sanitized}

    try:
        with measure("sentiment"):
            result = await asyncio.wait_for(
                sentiment_model.predict(clean), timeout=10.0
            )
    except asyncio.TimeoutError:
        raise _err("analyze_sentiment", "TIMEOUT",
                   "Tempo limite excedido na inferência.", 503)
    except RuntimeError as exc:
        raise _err("analyze_sentiment", "MODEL_UNAVAILABLE", str(exc), 503)
    except Exception as exc:
        logger.error("analyze.sentiment.failed", error=str(exc))
        raise _err("analyze_sentiment", "INFERENCE_FAILED",
                   "Falha na análise.", 500)

    output = {**result, "sanitized": sanitized}
    await cache_set(cache_key, output, settings.cache_ttl_sentiment)
    return output


# ─── /detect/anomaly ─────────────────────────────────────────────────────────


_METRIC_NAME_RE = r"^[A-Za-z0-9_]+$"


class AnomalyRequest(BaseModel):
    metric_name: str = Field(min_length=1, max_length=100, pattern=_METRIC_NAME_RE)
    values: list[float] = Field(min_length=10, max_length=10_000)
    timestamps: list[str] = Field(min_length=10, max_length=10_000)
    contamination: Optional[float] = Field(default=None, ge=0.001, le=0.499)

    @field_validator("timestamps")
    @classmethod
    def _validate_iso(cls, v: list[str]) -> list[str]:
        from datetime import datetime
        for ts in v:
            # Aceita 'Z' como UTC
            datetime.fromisoformat(ts.replace("Z", "+00:00"))
        return v

    @field_validator("timestamps")
    @classmethod
    def _same_length(cls, v, info):
        values = info.data.get("values")
        if values is not None and len(v) != len(values):
            raise ValueError("len(timestamps) deve ser igual a len(values)")
        return v


@router.post("/detect/anomaly", dependencies=[Depends(require_internal_key)])
async def detect_anomaly_endpoint(payload: AnomalyRequest):
    await enforce_rate_limit("anomaly", "global", settings.rate_limit_anomaly)

    try:
        with measure("isolation_forest"):
            result = await asyncio.wait_for(
                asyncio.get_event_loop().run_in_executor(
                    None,
                    detect_anomaly,
                    payload.values,
                    payload.timestamps,
                    payload.contamination,
                ),
                timeout=20.0,
            )
    except asyncio.TimeoutError:
        raise _err("detect_anomaly", "TIMEOUT",
                   "Tempo limite excedido na detecção.", 503)
    except ValueError as exc:
        raise _err("detect_anomaly", "INVALID_INPUT", str(exc), 422)
    except Exception as exc:
        logger.error("detect.anomaly.failed", error=str(exc))
        raise _err("detect_anomaly", "DETECTION_FAILED",
                   "Falha na detecção.", 500)

    return {**result, "metric_name": payload.metric_name}
