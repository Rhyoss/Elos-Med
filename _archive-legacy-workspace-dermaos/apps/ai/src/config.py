"""Configurações do serviço de IA do DermaOS.

Lidas a partir de variáveis de ambiente. Segredos NUNCA têm default
operacional — `change-me`/`""` força detecção em tempo de boot.
"""
from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ── Bind ───────────────────────────────────────────────────────────────
    service_name: str = "dermaos-ai"
    service_version: str = "1.0.0"
    debug: bool = False
    log_level: str = "info"

    # ── Auth interno ───────────────────────────────────────────────────────
    internal_api_key: str = Field(default="change-me")

    # ── Banco / Cache ──────────────────────────────────────────────────────
    database_url: str = "postgresql://dermaos_app:password@db:5432/dermaos"
    redis_url: str = "redis://cache:6379/3"

    # ── Anthropic (Claude) ─────────────────────────────────────────────────
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-opus-4-7"
    anthropic_timeout_seconds: int = 30

    # ── Modelos / runtime ─────────────────────────────────────────────────
    sentiment_model_id: str = "nlptown/bert-base-multilingual-uncased-sentiment"
    sentiment_max_tokens: int = 512
    lead_model_path: str = "/app/artifacts/lead_scorer.joblib"
    prophet_train_timeout_seconds: int = 30
    isolation_default_contamination: float = 0.05

    # ── Cache TTLs (segundos) ─────────────────────────────────────────────
    cache_ttl_supply: int = 6 * 3600
    cache_ttl_sentiment: int = 3600
    cache_ttl_lead: int = 30 * 60
    cache_ttl_insight: int = 4 * 3600

    # ── Rate limits (requests por minuto) ─────────────────────────────────
    rate_limit_supply: int = 60
    rate_limit_sentiment: int = 120
    rate_limit_lead: int = 200
    rate_limit_anomaly: int = 30
    rate_limit_insight: int = 10

    # ── Observabilidade ───────────────────────────────────────────────────
    latency_window_size: int = 100


settings = Settings()
