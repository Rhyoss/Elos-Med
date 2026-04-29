"""
Configuração do AI Service.

SEC-05 (auditoria 2026-04-28):
  - `ai_service_key` não tem default em código. Falha no boot se ausente
    ou menor que AI_SERVICE_KEY_MIN_LENGTH (32 bytes), evitando que o
    serviço suba com um valor placeholder ou trivial.
  - Em produção (GCP), o valor é injetado pelo Secret Manager via
    Cloud Run `--update-secrets=AI_SERVICE_KEY=ai-service-key:latest` ou
    GKE com Workload Identity.
"""
from typing import Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


# Comprimento mínimo da chave interna do serviço (256 bits em hex / 192 bits em base64).
AI_SERVICE_KEY_MIN_LENGTH = 32


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://dermaos_app:password@localhost:5432/dermaos"
    ollama_base_url: str = "http://ollama:11434"
    ollama_default_model: str = "llama3.1:8b"

    # Sem default — força configuração explícita.
    # Em GCP, vem do Secret Manager (Cloud Run / GKE Workload Identity).
    ai_service_key: str = Field(..., min_length=AI_SERVICE_KEY_MIN_LENGTH)

    debug: bool = False
    log_level: str = "info"

    @field_validator("ai_service_key")
    @classmethod
    def reject_placeholder_keys(cls, value: str) -> str:
        """Rejeita valores triviais que indiquem configuração esquecida."""
        forbidden = {
            "change-me",
            "changeme",
            "CHANGE_ME",
            "CHANGE_ME_ai_service_internal_key_here",
            "secret",
            "password",
            "test",
            "dev",
            "ai-service-key",
        }
        if value.strip() in forbidden:
            raise ValueError(
                "ai_service_key tem valor placeholder — gere com `openssl rand -hex 32`"
            )
        return value


settings = Settings()  # type: ignore[call-arg]  # pydantic resolve do env
