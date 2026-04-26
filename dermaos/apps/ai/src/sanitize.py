"""Sanitização de PII em texto livre antes de processamento ML.

Remove (substituindo por placeholder): CPF, telefone BR/internacional
e e-mails. NÃO loga o texto original — apenas o flag `sanitized` e o
número de matches por categoria.
"""
from __future__ import annotations

import re
from typing import Tuple

# CPF: 000.000.000-00 ou 00000000000
_CPF_RE = re.compile(r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b")
# Telefone BR (+55), com ou sem DDI/DDD, hífen ou espaço opcional
_PHONE_RE = re.compile(
    r"\b(?:\+?55\s?)?\(?\d{2}\)?[\s-]?\d{4,5}[\s-]?\d{4}\b"
)
_EMAIL_RE = re.compile(r"\b[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}\b")


def sanitize_text(text: str) -> Tuple[str, bool, dict]:
    """Retorna (texto_sanitizado, foi_modificado, contagens_por_tipo)."""
    counts = {"cpf": 0, "phone": 0, "email": 0}

    def _sub(pattern: re.Pattern[str], placeholder: str, key: str, s: str) -> str:
        def repl(_: re.Match[str]) -> str:
            counts[key] += 1
            return placeholder

        return pattern.sub(repl, s)

    out = text
    out = _sub(_EMAIL_RE, "[EMAIL_REMOVIDO]", "email", out)
    out = _sub(_CPF_RE, "[CPF_REMOVIDO]", "cpf", out)
    out = _sub(_PHONE_RE, "[TELEFONE_REMOVIDO]", "phone", out)

    sanitized = any(v > 0 for v in counts.values())
    return out, sanitized, counts


# Campos KPI proibidos para insights agregados (PHI evidente).
PHI_FORBIDDEN_FIELDS = {
    "patient_name",
    "patient_id",
    "name",
    "full_name",
    "cpf",
    "rg",
    "email",
    "phone",
    "telefone",
    "birthdate",
    "birth_date",
    "address",
    "endereco",
    "patient",
}


def detect_phi_in_kpis(kpis: dict) -> list[str]:
    """Retorna lista de chaves proibidas encontradas (recursivo, top-level)."""
    found: list[str] = []
    if not isinstance(kpis, dict):
        return found
    stack: list[dict] = [kpis]
    while stack:
        cur = stack.pop()
        for k, v in cur.items():
            if k.lower() in PHI_FORBIDDEN_FIELDS:
                found.append(k)
            if isinstance(v, dict):
                stack.append(v)
            elif isinstance(v, list):
                for item in v:
                    if isinstance(item, dict):
                        stack.append(item)
    return found
