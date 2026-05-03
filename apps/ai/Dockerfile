# ─── Builder ────────────────────────────────────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /app

RUN pip install --upgrade pip && \
    pip install --no-cache-dir uv

COPY apps/ai/requirements.txt .
RUN uv pip install --system --no-cache -r requirements.txt

# ─── Runner ─────────────────────────────────────────────────────────────────
FROM python:3.12-slim AS runner

RUN apt-get update && apt-get install -y --no-install-recommends tini && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd --system --gid 1001 dermaos && \
    useradd --system --uid 1001 --gid dermaos dermaos

WORKDIR /app

COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

COPY apps/ai/src ./src

USER dermaos

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PORT=8000

EXPOSE ${PORT}

ENTRYPOINT ["tini", "--"]
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
