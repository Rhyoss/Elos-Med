# ─── Builder ────────────────────────────────────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /app

RUN pip install --upgrade pip && \
    pip install --no-cache-dir uv

COPY apps/ai/requirements.txt .
RUN uv pip install --system --no-cache -r requirements.txt

# ─── Runner ─────────────────────────────────────────────────────────────────
FROM python:3.12-slim AS runner

RUN groupadd --system --gid 1001 dermaos && \
    useradd --system --uid 1001 --gid dermaos dermaos

WORKDIR /app

# Copia dependências instaladas
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

COPY apps/ai/src ./src

USER dermaos

EXPOSE 8000

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD python -c "import httpx; httpx.get('http://localhost:8000/health').raise_for_status()"

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
