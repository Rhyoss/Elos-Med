"""Registry centralizado de modelos. Faz warm-up no startup."""
from __future__ import annotations

import asyncio
import time

from ..logging_setup import get_logger
from .anomaly import anomaly_model
from .lead_scorer import lead_model
from .sentiment import sentiment_model

logger = get_logger(__name__)


async def warmup_all() -> None:
    """Carrega cada modelo em paralelo. Falha em um modelo NÃO derruba o serviço."""

    async def _wrap(name: str, fn) -> None:
        t0 = time.perf_counter()
        try:
            await asyncio.get_event_loop().run_in_executor(None, fn)
        except Exception as exc:
            logger.error("ml.warmup.unexpected_error", model=name, error=str(exc))
        finally:
            ms = (time.perf_counter() - t0) * 1000.0
            logger.info("ml.warmup.done", model=name, duration_ms=round(ms, 2))

    await asyncio.gather(
        _wrap("sentiment", sentiment_model.load),
        _wrap("lead_scorer", lead_model.load),
    )
    # Prophet/anomaly: stateless por chamada — não precisam pré-carregar.


def status_snapshot() -> dict:
    return {
        "sentiment": {"loaded": sentiment_model.loaded, "version": sentiment_model.version, "error": sentiment_model.error},
        "lead_scorer": {"loaded": lead_model.loaded, "version": lead_model.version, "error": lead_model.error},
        "prophet": {"loaded": True, "version": "prophet.v1", "error": None},
        "isolation_forest": {"loaded": anomaly_model.loaded, "version": anomaly_model.version, "error": anomaly_model.error},
    }
