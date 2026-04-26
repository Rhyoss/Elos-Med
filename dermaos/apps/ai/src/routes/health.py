"""GET /health — público (sem autenticação) para health checks."""
from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from ..config import settings
from ..metrics import tracker
from ..ml.registry import status_snapshot

router = APIRouter()


@router.get("/health")
async def health_check():
    snap = status_snapshot()

    models_payload = {
        "prophet": {
            "loaded": snap["prophet"]["loaded"],
            "avg_latency_ms": tracker.avg_ms("prophet"),
        },
        "sentiment": {
            "loaded": snap["sentiment"]["loaded"],
            "avg_latency_ms": tracker.avg_ms("sentiment"),
        },
        "lead_scorer": {
            "loaded": snap["lead_scorer"]["loaded"],
            "avg_latency_ms": tracker.avg_ms("lead_scorer"),
        },
        "isolation_forest": {
            "loaded": snap["isolation_forest"]["loaded"],
        },
    }

    any_loaded = any(m["loaded"] for m in models_payload.values())
    all_loaded = all(m["loaded"] for m in models_payload.values())

    if not any_loaded:
        status_str = "error"
        http_code = 503
    elif not all_loaded:
        status_str = "degraded"
        http_code = 200
    else:
        status_str = "ok"
        http_code = 200

    return JSONResponse(
        status_code=http_code,
        content={
            "status": status_str,
            "models": models_payload,
            "uptime_seconds": tracker.uptime_seconds(),
            "version": settings.service_version,
        },
    )
