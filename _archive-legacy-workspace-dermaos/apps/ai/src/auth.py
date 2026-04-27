"""Autenticação interna via header X-Internal-API-Key.

Comparação em tempo constante (`hmac.compare_digest`) — evita timing
oracle. Nunca loga o valor da chave. Sem chave configurada: rejeita.
"""
from __future__ import annotations

import hmac

from fastapi import Header, HTTPException, status

from .config import settings


def _structured_401() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={
            "error": "unauthorized",
            "code": "INVALID_INTERNAL_KEY",
            "message": "Header X-Internal-API-Key ausente ou inválido.",
        },
    )


async def require_internal_key(
    x_internal_api_key: str | None = Header(default=None, alias="X-Internal-API-Key"),
) -> None:
    expected = settings.internal_api_key
    if not expected or expected == "change-me":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": "service_unavailable",
                "code": "AUTH_NOT_CONFIGURED",
                "message": "INTERNAL_API_KEY não configurado no servidor.",
            },
        )
    if not x_internal_api_key:
        raise _structured_401()
    if not hmac.compare_digest(expected, x_internal_api_key):
        raise _structured_401()
