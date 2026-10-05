from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List
from ..risk.engine import evaluate

router = APIRouter()


class RiskQuery(BaseModel):
    well_id: Optional[str] = None
    depth: Optional[float] = None
    formation: Optional[str] = None
    radius_km: Optional[float] = 15.0
    well_data: Optional[dict] = None
    historical_events: Optional[List[dict]] = None


@router.get("/risks/{well_id}")
def get_risks(
    well_id: str,
    depth: Optional[float] = 2850.0,
    formation: Optional[str] = "Kopili",
    radius_km: float = 15.0,
):
    alerts = evaluate(
        well_id=well_id,
        depth=depth,
        formation=formation,
        recent=None,
        radius_km=radius_km,
    )
    return {
        "well_id": well_id,
        "depth": depth,
        "formation": formation,
        "alerts": alerts,
        "risks": alerts,
    }


@router.post("/risks/{well_id}")
@router.post("/api/risk/evaluate")
def post_risks(body: RiskQuery, well_id: Optional[str] = None):
    target_id = well_id or body.well_id
    if not target_id and body.well_data:
        target_id = body.well_data.get("id") or body.well_data.get("well_id")
        
    depth = body.depth
    if depth is None and body.well_data:
        depth = body.well_data.get("current_depth") or body.well_data.get("depth")
    if depth is None:
        depth = 2850.0

    formation = body.formation
    if not formation and body.well_data:
        formation = body.well_data.get("current_formation") or body.well_data.get("formation")
    if not formation:
        formation = "Kopili"

    alerts = evaluate(
        well_id=target_id or "b1000000-0000-0000-0000-000000000001",
        depth=depth,
        formation=formation,
        recent=None,
        radius_km=body.radius_km or 15.0,
    )
    return {
        "well_id": target_id,
        "depth": depth,
        "formation": formation,
        "alerts": alerts,
        "risks": alerts,
    }