"""
Análise clínica com IA local (Ollama).
Todos os dados enviados para este endpoint são PHI — processados localmente.
"""
import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

import ollama

from ..config import settings

router = APIRouter()
logger = structlog.get_logger()


class ClinicalAnalysisRequest(BaseModel):
    prompt: str = Field(..., min_length=10, max_length=50_000)
    model: str = Field(default_factory=lambda: settings.ollama_default_model)
    system_prompt: str = Field(
        default=(
            "Você é um assistente médico especializado em dermatologia. "
            "Responda de forma objetiva e clínica, sempre em português. "
            "Nunca faça diagnósticos definitivos — apenas apoio à decisão clínica. "
            "Dados do paciente são confidenciais — não os repita desnecessariamente."
        )
    )
    temperature: float = Field(default=0.1, ge=0.0, le=1.0)


class ClinicalAnalysisResponse(BaseModel):
    content: str
    model: str
    prompt_tokens: int
    completion_tokens: int


@router.post("/clinical", response_model=ClinicalAnalysisResponse)
async def analyze_clinical(request: ClinicalAnalysisRequest) -> ClinicalAnalysisResponse:
    """
    Análise de dados clínicos com LLM local.
    Dados PHI nunca saem do ambiente Ollama.
    """
    try:
        client = ollama.AsyncClient(host=settings.ollama_base_url)
        response = await client.chat(
            model=request.model,
            messages=[
                {"role": "system", "content": request.system_prompt},
                {"role": "user", "content": request.prompt},
            ],
            options={"temperature": request.temperature},
        )

        message = response["message"]
        usage = response.get("usage", {})

        return ClinicalAnalysisResponse(
            content=message["content"],
            model=request.model,
            prompt_tokens=usage.get("prompt_tokens", 0),
            completion_tokens=usage.get("completion_tokens", 0),
        )
    except Exception as exc:
        logger.error("clinical_analysis_failed", error=str(exc), model=request.model)
        raise HTTPException(status_code=500, detail="Falha na análise clínica") from exc
