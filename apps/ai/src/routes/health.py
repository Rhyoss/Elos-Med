import httpx
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from ..config import settings

router = APIRouter()


@router.get("/health")
async def health_check():
    checks: dict[str, str] = {}

    # Verifica conectividade com Ollama
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{settings.ollama_base_url}/api/tags")
            checks["ollama"] = "ok" if resp.status_code == 200 else "degraded"
    except Exception:
        checks["ollama"] = "fail"

    healthy = all(v in ("ok", "degraded") for v in checks.values())

    return JSONResponse(
        status_code=200 if healthy else 503,
        content={
            "status": "ok" if healthy else "degraded",
            "checks": checks,
        },
    )
