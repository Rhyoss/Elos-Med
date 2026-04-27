"""Logging estruturado (structlog) com supressão de PHI/segredos.

Filtros garantem que campos contendo `text`, `prompt`, `kpis`, `values`,
`api_key`, `authorization`, `secret`, `token` nunca cheguem ao output.
"""
from __future__ import annotations

import logging
import sys
from typing import Any

import structlog

from .config import settings

_REDACT_KEYS = {
    "text",
    "prompt",
    "input_text",
    "raw_text",
    "user_text",
    "kpis",
    "values",
    "api_key",
    "anthropic_api_key",
    "internal_api_key",
    "authorization",
    "x-internal-api-key",
    "secret",
    "password",
    "token",
}


def _redact_processor(_: Any, __: Any, event_dict: dict) -> dict:
    for k in list(event_dict.keys()):
        if k.lower() in _REDACT_KEYS:
            event_dict[k] = "[REDACTED]"
    return event_dict


def configure_logging() -> None:
    level = getattr(logging, settings.log_level.upper(), logging.INFO)

    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=level,
    )

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            _redact_processor,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(level),
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(name) if name else structlog.get_logger()
