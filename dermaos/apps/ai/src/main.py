"""DermaOS AI Service — FastAPI.

Inferência local (Prophet, scikit-learn, BERT) e LLM externa (Anthropic)
apenas para dados agregados sem PHI. Autenticação interna obrigatória
em todos os endpoints exceto /health.
"""
from __future__ import annotations

import time
import uuid
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .cache import close_cache, init_cache
from .config import settings
from .db import close_pool, init_pool
from .logging_setup import configure_logging, get_logger
from .ml.prophet_runner import shutdown_executor
from .ml.registry import warmup_all
from .routes import analyze, health, insight, predict, score

configure_logging()
logger = get_logger("main")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("ai.startup.begin", version=settings.service_version)
    await init_pool()
    await init_cache()
    await warmup_all()
    logger.info("ai.startup.ready")
    try:
        yield
    finally:
        logger.info("ai.shutdown.begin")
        shutdown_executor()
        await close_cache()
        await close_pool()
        logger.info("ai.shutdown.done")


app = FastAPI(
    title="DermaOS AI Service",
    description="Predição, análise e insights — interno (X-Internal-API-Key).",
    version=settings.service_version,
    docs_url="/docs" if settings.debug else None,
    redoc_url=None,
    openapi_url="/openapi.json" if settings.debug else None,
    lifespan=lifespan,
)


# ─── CORS — interno apenas ──────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://api:3001", "http://localhost:3001"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-Internal-API-Key"],
)


# ─── Correlation-id + access log ────────────────────────────────────────────
@app.middleware("http")
async def access_log(request: Request, call_next):
    correlation_id = request.headers.get("X-Correlation-Id") or uuid.uuid4().hex
    structlog.contextvars.bind_contextvars(correlation_id=correlation_id)

    t0 = time.perf_counter()
    status_code = 500
    try:
        response = await call_next(request)
        status_code = response.status_code
        return response
    finally:
        duration_ms = round((time.perf_counter() - t0) * 1000.0, 2)
        logger.info(
            "request",
            method=request.method,
            path=request.url.path,
            status=status_code,
            duration_ms=duration_ms,
            correlation_id=correlation_id,
        )
        structlog.contextvars.clear_contextvars()


# ─── Error handlers (estruturados) ──────────────────────────────────────────
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    detail = exc.detail
    if isinstance(detail, dict) and {"error", "code", "message"} <= detail.keys():
        body = detail
    else:
        body = {
            "error": "http_error",
            "code": f"HTTP_{exc.status_code}",
            "message": str(detail) if detail else "Erro.",
        }
    return JSONResponse(status_code=exc.status_code, content=body)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Identifica o primeiro campo inválido para mensagem mais útil
    errors = exc.errors()
    first = errors[0] if errors else {}
    loc = ".".join(str(p) for p in first.get("loc", [])[1:]) or "input"
    msg = first.get("msg", "validação falhou")
    return JSONResponse(
        status_code=422,
        content={
            "error": "validation_error",
            "code": "INVALID_INPUT",
            "message": f"Campo '{loc}': {msg}",
            "errors": errors,
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error("unhandled_exception", error_type=type(exc).__name__)
    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_error",
            "code": "INTERNAL_ERROR",
            "message": "Erro interno do servidor.",
        },
    )


# ─── Routers ────────────────────────────────────────────────────────────────
app.include_router(health.router, tags=["health"])
app.include_router(predict.router, tags=["predict"])
app.include_router(analyze.router, tags=["analyze"])
app.include_router(score.router, tags=["score"])
app.include_router(insight.router, tags=["insight"])
