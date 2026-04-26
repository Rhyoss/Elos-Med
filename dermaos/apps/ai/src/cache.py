"""Cliente Redis assíncrono + helpers de chave/serialização.

Chaves de cache são SHA-256 do payload normalizado — nunca incluem
texto cru, e portanto nunca vazam PHI mesmo se logadas.
"""
from __future__ import annotations

import hashlib
import json
from typing import Any, Optional

import redis.asyncio as redis

from .config import settings
from .logging_setup import get_logger

logger = get_logger(__name__)

_client: Optional[redis.Redis] = None


async def init_cache() -> None:
    global _client
    if _client is not None:
        return
    try:
        _client = redis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_timeout=2,
            socket_connect_timeout=2,
        )
        await _client.ping()
        logger.info("cache.ready")
    except Exception as exc:
        logger.error("cache.init_failed", error=str(exc))
        _client = None


async def close_cache() -> None:
    global _client
    if _client is not None:
        try:
            await _client.aclose()
        finally:
            _client = None


def get_client() -> Optional[redis.Redis]:
    return _client


def hash_key(prefix: str, payload: Any) -> str:
    """SHA-256 estável (sort_keys) para construção de chave de cache."""
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=False, default=str)
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return f"ai:{prefix}:{digest}"


async def cache_get(key: str) -> Optional[dict]:
    if _client is None:
        return None
    try:
        raw = await _client.get(key)
        return json.loads(raw) if raw else None
    except Exception as exc:
        logger.warning("cache.get_failed", key=key, error=str(exc))
        return None


async def cache_set(key: str, value: dict, ttl_seconds: int) -> None:
    if _client is None:
        return
    try:
        await _client.set(key, json.dumps(value, default=str), ex=ttl_seconds)
    except Exception as exc:
        logger.warning("cache.set_failed", key=key, error=str(exc))
