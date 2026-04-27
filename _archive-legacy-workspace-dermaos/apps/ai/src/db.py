"""Conexão com Postgres via asyncpg (pool global)."""
from __future__ import annotations

from typing import Optional

import asyncpg

from .config import settings
from .logging_setup import get_logger

logger = get_logger(__name__)

_pool: Optional[asyncpg.Pool] = None


async def init_pool() -> None:
    global _pool
    if _pool is not None:
        return
    try:
        _pool = await asyncpg.create_pool(
            dsn=settings.database_url,
            min_size=1,
            max_size=8,
            command_timeout=15,
        )
        logger.info("db.pool_ready")
    except Exception as exc:
        logger.error("db.pool_init_failed", error=str(exc))
        _pool = None


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def get_pool() -> Optional[asyncpg.Pool]:
    return _pool
