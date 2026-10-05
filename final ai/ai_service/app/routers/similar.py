from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List
from ..similarity.engine import similar_wells

router = APIRouter()


class SimilarityQuery(BaseModel):
    well_id: Optional[str] = None
    reference_well: Optional[dict] = None
    candidate_wells: Optional[List[dict]] = None
    depth: Optional[float] = 2850.0
    formation: Optional[str] = "Kopili"
    radius_km: Optional[float] = 15.0
    top_n: Optional[int] = 5
    event_type: Optional[str] = None


@router.get("/wells/{well_id}/similar")
def get_similar(
    well_id: str,
    depth: Optional[float] = 2850.0,
    formation: Optional[str] = "Kopili",
    radius_km: float = 15.0,
    top_n: int = 5,
    event_type: Optional[str] = None,
):
    focus = [event_type] if event_type else None
    results = similar_wells(
        active_id=well_id,
        depth=depth,
        formation=formation,
        radius_km=radius_km,
        top_n=top_n,
        focus_types=focus,
    )
    return {
        "well_id": well_id,
        "results": results,
    }


@router.post("/wells/{well_id}/similar")
@router.post("/api/similarity/compute")
def post_similar(body: SimilarityQuery, well_id: Optional[str] = None):
    target_id = well_id or body.well_id
    if not target_id and body.reference_well:
        target_id = body.reference_well.get("id") or body.reference_well.get("well_id")
    
    depth = body.depth
    formation = body.formation
    if body.reference_well:
        depth = body.reference_well.get("current_depth") or body.reference_well.get("depth") or depth
        formation = body.reference_well.get("current_formation") or body.reference_well.get("formation") or formation

    focus = [body.event_type] if body.event_type else None
    results = similar_wells(
        active_id=target_id or "b1000000-0000-0000-0000-000000000001",
        depth=depth,
        formation=formation,
        radius_km=body.radius_km or 15.0,
        top_n=body.top_n or 5,
        focus_types=focus,
    )
    return {
        "well_id": target_id,
        "results": results,
        "similar_wells": results,
    }