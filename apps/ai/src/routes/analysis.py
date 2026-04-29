"""
Análise clínica com IA local (Ollama).
Todos os dados enviados para este endpoint são PHI — processados localmente.

SEC-15: o cliente NÃO controla `model`, `system_prompt` nem `temperature`.
A escolha de modelo e o system prompt vivem no servidor (versionado em
config). O caller só passa o conteúdo a analisar.
"""
import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

import ollama

from ..config import settings

router = APIRouter()
logger = structlog.get_logger()


# ─── Templates de system prompt (versionados no servidor) ─────────────────────
# Adicionar novos templates aqui — caller só pode escolher o ID.
SYSTEM_PROMPTS: dict[str, str] = {
    "clinical_v1": (
        "Você é um assistente médico especializado em dermatologia. "
        "Responda de forma objetiva e clínica, sempre em português. "
        "Nunca faça diagnósticos definitivos — apenas apoio à decisão clínica. "
        "Dados do paciente são confidenciais — não os repita desnecessariamente."
    ),
    "soap_summary_v1": (
        "Você está auxiliando médicos a resumir notas SOAP. "
        "Devolva apenas pontos clínicos relevantes em português, sem invenção."
    ),
}

# SEC-15: lista branca de modelos. Cliente não escolhe — o servidor mapeia.
ALLOWED_MODELS = {settings.ollama_default_model}

# Temperatura travada para análise clínica (low temperature = menos alucinação).
FIXED_TEMPERATURE = 0.1


class ClinicalAnalysisRequest(BaseModel):
    """SEC-15: apenas `prompt` e `template_id` vêm do cliente."""
    prompt: str = Field(..., min_length=10, max_length=50_000)
    template_id: str = Field(default="clinical_v1")


class ClinicalAnalysisResponse(BaseModel):
    content: str
    model: str
    template_id: str
    prompt_tokens: int
    completion_tokens: int


@router.post("/clinical", response_model=ClinicalAnalysisResponse)
async def analyze_clinical(request: ClinicalAnalysisRequest) -> ClinicalAnalysisResponse:
    """
    Análise de dados clínicos com LLM local. Dados PHI nunca saem do Ollama.
    """
    system_prompt = SYSTEM_PROMPTS.get(request.template_id)
    if system_prompt is None:
        raise HTTPException(
            status_code=400,
            detail=f"template_id desconhecido. Use um de: {sorted(SYSTEM_PROMPTS.keys())}",
        )

    model = settings.ollama_default_model
    if model not in ALLOWED_MODELS:
        # Defesa em profundidade — se config aceitou modelo não-allowlisted
        # (não deveria, mas defesa em camadas):
        raise HTTPException(status_code=500, detail="Modelo configurado não permitido")

    try:
        client = ollama.AsyncClient(host=settings.ollama_base_url)
        response = await client.chat(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": request.prompt},
            ],
            options={"temperature": FIXED_TEMPERATURE},
        )

        message = response["message"]
        usage = response.get("usage", {})

        return ClinicalAnalysisResponse(
            content=message["content"],
            model=model,
            template_id=request.template_id,
            prompt_tokens=usage.get("prompt_tokens", 0),
            completion_tokens=usage.get("completion_tokens", 0),
        )
    except Exception as exc:
        logger.error("clinical_analysis_failed", error=str(exc), model=model)
        raise HTTPException(status_code=500, detail="Falha na análise clínica") from exc
