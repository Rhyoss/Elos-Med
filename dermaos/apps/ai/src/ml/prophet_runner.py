"""Treino + predição com Prophet, com timeout estrito.

Roda Prophet em ProcessPoolExecutor para que `concurrent.futures`
possa terminar o worker com SIGKILL caso exceda
`prophet_train_timeout_seconds` — `wait_for` em thread não cancelaria
trabalho CPU-bound de fato.
"""
from __future__ import annotations

import asyncio
from concurrent.futures import ProcessPoolExecutor, TimeoutError as FuturesTimeout
from datetime import date, datetime, timedelta
from typing import Any

from ..config import settings
from ..logging_setup import get_logger

logger = get_logger(__name__)

MODEL_VERSION = "prophet.v1"


def _train_and_predict(
    history: list[tuple[str, float]],
    horizon_days: int,
    current_stock: float,
) -> dict[str, Any]:
    """Executado em um processo filho. Importa Prophet localmente."""
    import pandas as pd
    from prophet import Prophet

    df = pd.DataFrame(history, columns=["ds", "y"])
    df["ds"] = pd.to_datetime(df["ds"])

    model = Prophet(
        daily_seasonality=False,
        weekly_seasonality=True,
        yearly_seasonality=False,
        interval_width=0.8,
    )
    model.fit(df)

    future = model.make_future_dataframe(periods=horizon_days, freq="D")
    fcst = model.predict(future).tail(horizon_days)

    yhat = fcst["yhat"].clip(lower=0).tolist()
    yhat_lower = fcst["yhat_lower"].clip(lower=0).tolist()
    yhat_upper = fcst["yhat_upper"].clip(lower=0).tolist()
    dates = [d.date().isoformat() for d in fcst["ds"]]

    # Stockout: primeiro dia onde consumo acumulado >= estoque atual
    cumulative = 0.0
    stockout_date: str | None = None
    for d, c in zip(dates, yhat):
        cumulative += float(c)
        if cumulative >= current_stock:
            stockout_date = d
            break

    # Confidence: 1 - largura média do CI relativa à média de yhat
    mean_yhat = max(sum(yhat) / max(len(yhat), 1), 1e-6)
    mean_band = sum((u - l) for u, l in zip(yhat_upper, yhat_lower)) / max(len(yhat), 1)
    confidence = max(0.0, min(1.0, 1.0 - (mean_band / (2.0 * mean_yhat))))

    return {
        "predicted_consumption": [
            {"date": d, "yhat": round(c, 4)} for d, c in zip(dates, yhat)
        ],
        "confidence_interval": [
            {"date": d, "lower": round(l, 4), "upper": round(u, 4)}
            for d, l, u in zip(dates, yhat_lower, yhat_upper)
        ],
        "stockout_date": stockout_date,
        "confidence": round(float(confidence), 4),
        "data_points_used": len(history),
        "model_version": MODEL_VERSION,
    }


_executor: ProcessPoolExecutor | None = None


def get_executor() -> ProcessPoolExecutor:
    global _executor
    if _executor is None:
        _executor = ProcessPoolExecutor(max_workers=1)
    return _executor


def shutdown_executor() -> None:
    global _executor
    if _executor is not None:
        _executor.shutdown(cancel_futures=True)
        _executor = None


async def run_forecast(
    history: list[tuple[date | datetime | str, float]],
    horizon_days: int,
    current_stock: float,
) -> dict[str, Any]:
    """Roda forecast com timeout estrito. Lança TimeoutError se exceder."""
    timeout = settings.prophet_train_timeout_seconds

    normalized: list[tuple[str, float]] = []
    for d, y in history:
        if isinstance(d, (date, datetime)):
            normalized.append((d.isoformat(), float(y)))
        else:
            normalized.append((str(d), float(y)))

    loop = asyncio.get_event_loop()
    executor = get_executor()
    future = loop.run_in_executor(
        executor, _train_and_predict, normalized, horizon_days, current_stock
    )
    try:
        return await asyncio.wait_for(future, timeout=timeout)
    except (FuturesTimeout, asyncio.TimeoutError):
        # Recicla executor para garantir que processo seja morto
        shutdown_executor()
        raise TimeoutError(f"prophet_train_exceeded_{timeout}s")


def aggregate_daily_consumption(
    rows: list[tuple[date, float]],
) -> list[tuple[str, float]]:
    """Soma quantidades de saída por dia. Preenche dias faltantes com 0.

    Espera tuplas (data, qty_saida_positiva).
    """
    if not rows:
        return []
    by_day: dict[date, float] = {}
    for d, q in rows:
        by_day[d] = by_day.get(d, 0.0) + float(q)
    start = min(by_day.keys())
    end = max(by_day.keys())
    out: list[tuple[str, float]] = []
    cur = start
    one = timedelta(days=1)
    while cur <= end:
        out.append((cur.isoformat(), float(by_day.get(cur, 0.0))))
        cur += one
    return out


def distinct_days(rows: list[tuple[date, float]]) -> int:
    return len({d for d, _ in rows})
