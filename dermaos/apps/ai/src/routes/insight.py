"""POST /generate/insight — KPIs agregados → Claude (Anthropic).

Regras críticas:
- KPIs com qualquer chave PHI rejeitados em 422.
- clinic_id NUNCA é incluído no prompt enviado à API externa.
- ANTHROPIC_API_KEY nunca é logado e nunca é retornado.
- Retry: 1 tentativa adicional para 429/5xx (total 2 chamadas).
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from ..auth import require_internal_key
from ..cache import cache_get, cache_set, hash_key
from ..config import settings
from ..logging_setup import get_logger
from ..rate_limit import enforce_rate_limit
from ..sanitize import detect_phi_in_kpis

router = APIRouter()
logger = get_logger(__name__)

SYSTEM_PROMPT = (
    "Você é um analista de negócios de clínica dermatológica. "
    "Analise os KPIs e gere 3-5 insights acionáveis em português. "
    "Não mencione pacientes individuais. Foque em tendências e ações."
)
SYSTEM_PROMPT_VERSION = "v1.0.0"


class InsightRequest(BaseModel):
    kpis: dict[str, Any]
    context: str = Field(min_length=1, max_length=500)
    clinic_id: str = Field(min_length=1, max_length=128)

    @field_validator("kpis")
    @classmethod
    def _no_phi(cls, v: dict) -> dict:
        if not isinstance(v, dict):
            raise ValueError("kpis deve ser um objeto JSON")
        return v


def _err(code: str, message: str, http: int) -> HTTPException:
    return HTTPException(
        status_code=http,
        detail={"error": "generate_insight", "code": code, "message": message},
    )


def _build_user_prompt(kpis: dict, context: str) -> str:
    """Monta prompt SEM clinic_id e sem campos com nomes PHI."""
    return (
        "Contexto do negócio:\n"
        f"{context.strip()}\n\n"
        "KPIs agregados (JSON):\n"
        f"{json.dumps(kpis, sort_keys=True, ensure_ascii=False)}\n\n"
        "Tarefa: produza um JSON com a chave 'insights' contendo 3 a 5 itens. "
        "Cada item deve ter: title (string curta), description (1-2 frases), "
        "priority ('high'|'medium'|'low'), action (1 frase imperativa)."
    )


def _parse_insights(text: str) -> list[dict]:
    """Extrai a lista de insights do output da LLM. Tolera JSON com prosa."""
    # Tenta JSON puro primeiro
    candidates: list[str] = [text]
    # Heurística: pega o maior bloco entre chaves
    if "{" in text and "}" in text:
        candidates.append(text[text.find("{") : text.rfind("}") + 1])

    for raw in candidates:
        try:
            data = json.loads(raw)
            items = data.get("insights") if isinstance(data, dict) else data
            if isinstance(items, list) and items:
                cleaned: list[dict] = []
                for it in items[:5]:
                    if not isinstance(it, dict):
                        continue
                    pri = str(it.get("priority", "medium")).lower()
                    if pri not in {"high", "medium", "low"}:
                        pri = "medium"
                    cleaned.append(
                        {
                            "title": str(it.get("title", "")).strip()[:200],
                            "description": str(it.get("description", "")).strip()[:500],
                            "priority": pri,
                            "action": str(it.get("action", "")).strip()[:300],
                        }
                    )
                if cleaned:
                    return cleaned
        except Exception:
            continue
    return []


async def _call_claude(user_prompt: str) -> tuple[str, str]:
    """Chama a Anthropic API. Retorna (texto, model_id).

    Faz 1 retry para erros transientes (429/5xx). Timeout aplicado.
    """
    try:
        from anthropic import AsyncAnthropic, APIStatusError, APIConnectionError
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError(f"anthropic_sdk_unavailable: {exc}")

    if not settings.anthropic_api_key:
        raise RuntimeError("ANTHROPIC_API_KEY_NOT_SET")

    client = AsyncAnthropic(
        api_key=settings.anthropic_api_key,
        timeout=settings.anthropic_timeout_seconds,
    )

    last_exc: Exception | None = None
    for attempt in (1, 2):
        try:
            resp = await client.messages.create(
                model=settings.anthropic_model,
                max_tokens=1024,
                temperature=0.3,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_prompt}],
            )
            # Extrai text do primeiro bloco
            text_parts = [
                block.text for block in resp.content
                if getattr(block, "type", None) == "text"
            ]
            return ("\n".join(text_parts).strip(), resp.model)
        except APIStatusError as exc:
            last_exc = exc
            sc = getattr(exc, "status_code", 0)
            if attempt == 1 and (sc == 429 or 500 <= sc < 600):
                logger.warning("insight.retry", attempt=attempt, status=sc)
                await asyncio.sleep(0.5)
                continue
            raise
        except APIConnectionError as exc:
            last_exc = exc
            if attempt == 1:
                logger.warning("insight.retry.connection", attempt=attempt)
                await asyncio.sleep(0.5)
                continue
            raise

    if last_exc:
        raise last_exc
    raise RuntimeError("anthropic_unknown_failure")


@router.post("/generate/insight", dependencies=[Depends(require_internal_key)])
async def generate_insight(payload: InsightRequest):
    # clinic_id vai pro rate-limit/correlação, NUNCA pro prompt
    await enforce_rate_limit("insight", payload.clinic_id, settings.rate_limit_insight)

    phi_fields = detect_phi_in_kpis(payload.kpis)
    if phi_fields:
        # Loga apenas os nomes de campo (não os valores)
        logger.warning("insight.phi_detected", fields=phi_fields)
        raise _err(
            "PHI_DETECTED",
            f"KPIs contêm campos com PHI: {', '.join(sorted(set(phi_fields)))}.",
            422,
        )

    cache_key = hash_key(
        "insight", {"kpis": payload.kpis, "ctx": payload.context.strip()}
    )
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached

    user_prompt = _build_user_prompt(payload.kpis, payload.context)

    try:
        # Timeout total do endpoint = 35s (spec). A SDK impõe seu próprio
        # timeout interno (`anthropic_timeout_seconds`), e damos folga
        # para que o retry single-shot caiba dentro do orçamento.
        text, model_used = await asyncio.wait_for(
            _call_claude(user_prompt), timeout=35.0
        )
    except asyncio.TimeoutError:
        raise _err(
            "LLM_TIMEOUT",
            "Geração de insight excedeu o tempo limite. Tente novamente.",
            503,
        )
    except RuntimeError as exc:
        msg = str(exc)
        if msg == "ANTHROPIC_API_KEY_NOT_SET":
            raise _err("LLM_NOT_CONFIGURED",
                       "Chave da API Anthropic não configurada.", 503)
        logger.error("insight.runtime_error", error=msg)
        raise _err("LLM_FAILED", "Falha ao gerar insight.", 503)
    except Exception as exc:
        # Anthropic levanta APIStatusError/APIConnectionError; mapeamos para 503
        logger.error("insight.failed", error_type=type(exc).__name__)
        raise _err("LLM_FAILED",
                   "Serviço de LLM indisponível. Tente novamente em instantes.", 503)

    insights = _parse_insights(text)
    if not insights:
        raise _err("LLM_PARSE_ERROR",
                   "Resposta da LLM não pôde ser interpretada.", 502)

    response = {
        "insights": insights,
        "model_used": model_used,
        "system_prompt_version": SYSTEM_PROMPT_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    await cache_set(cache_key, response, settings.cache_ttl_insight)
    return response
