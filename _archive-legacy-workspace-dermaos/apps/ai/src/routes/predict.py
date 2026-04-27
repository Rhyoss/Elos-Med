"""POST /predict/supply-stockout — predição de ruptura via Prophet."""
from __future__ import annotations

import asyncio
from datetime import date, timedelta
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from ..auth import require_internal_key
from ..cache import cache_get, cache_set, hash_key
from ..config import settings
from ..db import get_pool
from ..logging_setup import get_logger
from ..metrics import measure
from ..ml.prophet_runner import (
    aggregate_daily_consumption,
    distinct_days,
    run_forecast,
)
from ..rate_limit import enforce_rate_limit

router = APIRouter()
logger = get_logger(__name__)

LOOKBACK_DAYS = 180
MIN_HISTORY_DAYS = 14


class StockoutRequest(BaseModel):
    product_id: UUID
    clinic_id: UUID
    horizon_days: int = Field(ge=1, le=365)


def _err(code: str, message: str, http: int) -> HTTPException:
    return HTTPException(
        status_code=http,
        detail={"error": "predict_supply_stockout", "code": code, "message": message},
    )


async def _load_history(
    pool, product_id: UUID, clinic_id: UUID
) -> tuple[list[tuple[date, float]], float]:
    """Retorna (movimentações_de_saída_por_dia, estoque_atual).

    Filtra por (clinic_id, product_id) para respeitar RLS — clinic_id
    nunca cruza tenants. Saídas têm qty < 0 ou kind='out'; assumimos
    schema com colunas (occurred_at::date, qty, kind, current_stock).
    """
    sql = """
        SELECT occurred_at::date AS d,
               -- saída: quantidade positiva consumida
               CASE WHEN kind = 'out' THEN ABS(qty)
                    WHEN qty < 0 THEN ABS(qty)
                    ELSE 0 END AS qty_out
          FROM inventory_movements
         WHERE product_id = $1
           AND clinic_id  = $2
           AND occurred_at >= NOW() - ($3 || ' days')::interval
    """
    stock_sql = """
        SELECT COALESCE(SUM(CASE WHEN kind = 'in' THEN qty
                                 WHEN kind = 'out' THEN -ABS(qty)
                                 ELSE qty END), 0)::float AS current_stock
          FROM inventory_movements
         WHERE product_id = $1
           AND clinic_id  = $2
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, product_id, clinic_id, LOOKBACK_DAYS)
        stock_row = await conn.fetchrow(stock_sql, product_id, clinic_id)

    history: list[tuple[date, float]] = [
        (r["d"], float(r["qty_out"])) for r in rows if float(r["qty_out"]) > 0
    ]
    current_stock = float(stock_row["current_stock"]) if stock_row else 0.0
    return history, current_stock


ENDPOINT_TIMEOUT_SECONDS = 45


async def _run_pipeline(payload: StockoutRequest, cache_key: str) -> dict:
    pool = get_pool()
    if pool is None:
        raise _err("DB_UNAVAILABLE", "Banco de dados indisponível.", 503)

    try:
        history, current_stock = await _load_history(
            pool, payload.product_id, payload.clinic_id
        )
    except Exception as exc:
        logger.error("predict.history_load_failed", error=str(exc))
        raise _err("DB_ERROR", "Falha ao consultar movimentações.", 500)

    if distinct_days(history) < MIN_HISTORY_DAYS:
        raise _err(
            "INSUFFICIENT_DATA",
            "Histórico insuficiente para predição confiável. "
            "Mínimo: 14 dias de movimentações.",
            422,
        )

    daily = aggregate_daily_consumption(history)

    try:
        with measure("prophet"):
            result = await asyncio.wait_for(
                run_forecast(daily, payload.horizon_days, current_stock),
                timeout=settings.prophet_train_timeout_seconds + 5,
            )
    except TimeoutError:
        raise _err(
            "TRAIN_TIMEOUT",
            f"Treino do modelo excedeu {settings.prophet_train_timeout_seconds}s.",
            503,
        )
    except asyncio.TimeoutError:
        raise _err("TRAIN_TIMEOUT", "Treino excedeu tempo limite.", 503)
    except Exception as exc:
        logger.error("predict.forecast_failed", error=str(exc))
        raise _err("FORECAST_FAILED", "Falha na geração do forecast.", 500)

    result["current_stock"] = round(current_stock, 4)
    await cache_set(cache_key, result, settings.cache_ttl_supply)
    return result


@router.post(
    "/predict/supply-stockout",
    dependencies=[Depends(require_internal_key)],
)
async def predict_supply_stockout(payload: StockoutRequest):
    correlation_bucket = str(payload.clinic_id)
    await enforce_rate_limit("supply", correlation_bucket, settings.rate_limit_supply)

    cache_key = hash_key(
        "supply",
        {
            "p": str(payload.product_id),
            "c": str(payload.clinic_id),
            "h": payload.horizon_days,
        },
    )
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached

    try:
        return await asyncio.wait_for(
            _run_pipeline(payload, cache_key), timeout=ENDPOINT_TIMEOUT_SECONDS
        )
    except asyncio.TimeoutError:
        raise _err(
            "ENDPOINT_TIMEOUT",
            f"Predição excedeu {ENDPOINT_TIMEOUT_SECONDS}s.",
            503,
        )
