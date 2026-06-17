from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()



class Stage1Request(BaseModel):
    symptom_text: str


class VoidItem(BaseModel):
    void_code: str
    severity: str   # "HIGH" | "MEDIUM" | "LOW"


class Stage1Response(BaseModel):
    symptoms:      list[str]
    scale_signals: dict
    voids:         list[VoidItem]



@router.post("/stage1-extract", response_model=Stage1Response, summary="Extract symptoms and voids from CEO input")
async def stage1_extract(request: Stage1Request):
    """
    Phase 1 skeleton — returns empty structure.
    Full LLM implementation in Phase 2 (elicitation_engine.py).
    """
    return Stage1Response(
        symptoms=[],
        scale_signals={},
        voids=[],
    )