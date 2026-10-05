from fastapi import APIRouter, HTTPException
from ..ml_runtime import predict_replay

router = APIRouter()


@router.get("/ml/risk/{well_id}")
def ml_risk(well_id: str, depth: float, event_type: str = "mud_loss", explain: bool = False):
    """EXPERIMENTAL model probability for the replay demo well. The rule-based /risks endpoint remains the alert source."""
    if well_id != "WELL-A-102":
        raise HTTPException(404, "the experimental model only serves the replay demo well WELL-A-102")
    try:
        return predict_replay(depth, event_type, explain)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    except ValueError as e:
        raise HTTPException(422, str(e))
