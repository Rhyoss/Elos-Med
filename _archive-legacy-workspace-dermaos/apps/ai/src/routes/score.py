"""POST /score/lead — scoring de lead via Random Forest."""
from __future__ import annotations

import asyncio
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from ..auth import require_internal_key
from ..cache import cache_get, cache_set, hash_key
from ..config import settings
from ..logging_setup import get_logger
from ..metrics import measure
from ..ml.lead_scorer import lead_model
from ..rate_limit import enforce_rate_limit

router = APIRouter()
logger = get_logger(__name__)


SourceLiteral = Literal[
    "whatsapp", "instagram", "telegram", "email", "website", "referral", "other"
]


class LeadScoreRequest(BaseModel):
    model_config = ConfigDict(extra="allow")  # campos extras tolerados

    source: SourceLiteral
    interactions: int = Field(ge=0, le=10_000)
    time_since_first: float = Field(ge=0, le=3650)
    response_time: float = Field(ge=0, le=720)


def _err(code: str, message: str, http: int) -> HTTPException:
    return HTTPException(
        status_code=http,
        detail={"error": "score_lead", "code": code, "message": message},
    )


@router.post("/score/lead", dependencies=[Depends(require_internal_key)])
async def score_lead(payload: LeadScoreRequest):
    await enforce_rate_limit("lead", "global", settings.rate_limit_lead)

    if not lead_model.loaded:
        raise _err("MODEL_UNAVAILABLE", "Modelo de lead score não carregado.", 503)

    payload_dict = payload.model_dump()
    cache_key = hash_key("lead", payload_dict)
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached

    try:
        with measure("lead_scorer"):
            result = await asyncio.wait_for(
                asyncio.get_event_loop().run_in_executor(
                    None, lead_model.predict, payload_dict
                ),
                timeout=5.0,
            )
    except asyncio.TimeoutError:
        raise _err("TIMEOUT", "Tempo limite excedido.", 503)
    except RuntimeError as exc:
        raise _err("MODEL_UNAVAILABLE", str(exc), 503)
    except Exception as exc:
        logger.error("score.lead.failed", error=str(exc))
        raise _err("INFERENCE_FAILED", "Falha no scoring.", 500)

    await cache_set(cache_key, result, settings.cache_ttl_lead)
    return result
