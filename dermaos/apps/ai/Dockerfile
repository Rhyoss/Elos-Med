# syntax=docker/dockerfile:1
# Contexto de build: apps/ai/
# Uso: docker build -f apps/ai/Dockerfile -t dermaos-ai apps/ai/

# ─── Stage 1: builder ─────────────────────────────────────────────────────────
# Ferramentas de compilação apenas no builder — não chegam na imagem final
FROM python:3.12-slim AS builder

RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential gcc g++ && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

# --user: instala em ~/.local — pasta copiável para o runner sem root
# torch CPU (~800 MB) separado para aproveitar cache do layer
RUN pip install --no-cache-dir --user \
      --index-url https://download.pytorch.org/whl/cpu \
      torch==2.5.1 && \
    pip install --no-cache-dir --user -r requirements.txt

# ─── Stage 2: runner ──────────────────────────────────────────────────────────
FROM python:3.12-slim AS runner

# libgomp1: requerida por Prophet / cmdstanpy / scikit-learn
RUN apt-get update && \
    apt-get install -y --no-install-recommends libgomp1 && \
    rm -rf /var/lib/apt/lists/* && \
    adduser --disabled-password --gecos '' appuser

# Copia dependências instaladas pelo builder (sem devtools de compilação)
COPY --from=builder /root/.local /home/appuser/.local

COPY --chown=appuser:appuser src ./src

RUN mkdir -p /app/artifacts && chown -R appuser:appuser /app

USER appuser

WORKDIR /app

ENV PATH=/home/appuser/.local/bin:$PATH
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV TRANSFORMERS_OFFLINE=0
ENV HF_HOME=/home/appuser/.cache/huggingface

EXPOSE 8000

# Health check via Python puro (sem curl para minimizar dependências)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

# --no-access-log: evitar duplicação de logs (API já gera logs estruturados)
CMD ["uvicorn", "src.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "2", \
     "--no-access-log"]
