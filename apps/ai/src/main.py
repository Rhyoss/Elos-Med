"""
DermaOS AI Service — FastAPI + Ollama
Dados clínicos PHI processados localmente via Ollama.
Dados não-PHI podem ser enviados para Claude API.
"""
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .routes import health, embeddings, analysis

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("DermaOS AI Service starting", port=8000)
    # Aqui: pré-carregar modelo Ollama, inicializar conexão DB, etc.
    yield
    logger.info("DermaOS AI Service shutting down")


app = FastAPI(
    title="DermaOS AI Service",
    description="Serviço de IA local para dados clínicos — Ollama + scikit-learn",
    version="1.0.0",
    docs_url="/docs" if settings.debug else None,
    redoc_url=None,
    lifespan=lifespan,
)

# ─── CORS (aceita apenas origem interna) ──────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://api:3001", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type", "X-Service-Key"],
)


# ─── Middleware de autenticação interna ───────────────────────────────────────
@app.middleware("http")
async def verify_service_key(request: Request, call_next):
    # Rota de health não requer autenticação
    if request.url.path in ("/health", "/docs", "/openapi.json"):
        return await call_next(request)

    service_key = request.headers.get("X-Service-Key")
    if service_key != settings.ai_service_key:
        return JSONResponse(status_code=401, content={"detail": "Unauthorized"})

    return await call_next(request)


# ─── Rotas ────────────────────────────────────────────────────────────────────
app.include_router(health.router, tags=["health"])
app.include_router(embeddings.router, prefix="/embeddings", tags=["embeddings"])
app.include_router(analysis.router, prefix="/analysis", tags=["analysis"])
