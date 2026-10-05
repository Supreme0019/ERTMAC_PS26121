from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from ..rag.assistant import answer

router = APIRouter()


class Query(BaseModel):
    question: str
    well_id: Optional[str] = "b1000000-0000-0000-0000-000000000001"
    radius_km: Optional[float] = 15.0
    context: Optional[dict] = None


@router.post("/assistant/query")
@router.post("/api/rag/query")
def query(body: Query):
    target_well = body.well_id
    if not target_well and body.context and body.context.get("well"):
        target_well = body.context["well"].get("id")
    if not target_well:
        target_well = "b1000000-0000-0000-0000-000000000001"

    radius = body.radius_km or 15.0
    return answer(body.question, target_well, radius)