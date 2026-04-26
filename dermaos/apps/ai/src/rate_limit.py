"""Rate limiting baseado em janela fixa de 60s usando Redis.

Algoritmo: INCR + EXPIRE atômico (pipeline). Quando Redis está
indisponível, FAIL OPEN com warning — preferimos servir do que
recusar tráfego interno legítimo.
"""
from __future__ import annotations

from fastapi import HTTPException, status

from .cache import get_client
from .logging_setup import get_logger

logger = get_logger(__name__)


async def enforce_rate_limit(bucket: str, identifier: str, limit_per_min: int) -> None:
    """Lança 429 se o consumo na janela atual exceder `limit_per_min`."""
    client = get_client()
    if client is None:
        logger.warning("ratelimit.cache_unavailable", bucket=bucket)
        return

    key = f"ai:rl:{bucket}:{identifier}"
    try:
        async with client.pipeline(transaction=True) as pipe:
            pipe.incr(key, 1)
            pipe.expire(key, 60)
            current, _ = await pipe.execute()
    except Exception as exc:
        logger.warning("ratelimit.failed", bucket=bucket, error=str(exc))
        return

    if int(current) > limit_per_min:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "error": "rate_limit_exceeded",
                "code": "RATE_LIMIT",
                "message": f"Limite de {limit_per_min} req/min excedido para {bucket}.",
            },
        )
