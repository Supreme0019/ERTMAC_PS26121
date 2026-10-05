import os, asyncio, json, re
import pandas as pd
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from psycopg.types.json import Jsonb
from ..db import conn
from ..replay.adapter import ReplaySource
from ..risk.engine import evaluate

router = APIRouter()
COLS = ["rop", "wob", "rpm", "torque", "pressure", "mud_flow", "mud_loss"]

# Absolute path resolution for replay data
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CANDIDATE_PATHS = [
    os.path.join(BASE_DIR, "data", "synthetic", "active_replay.csv"),
    os.path.join(os.path.dirname(BASE_DIR), "data", "synthetic", "active_replay.csv"),
    "../data/synthetic/active_replay.csv",
    "data/synthetic/active_replay.csv",
]
REPLAY_CSV = next((p for p in CANDIDATE_PATHS if os.path.exists(p)), CANDIDATE_PATHS[0])

UUID_REGEX = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)


def _persist(well_id, depth, alert):
    """
    Persist real-time risk alert to risk_predictions table
    matching the AI service PostgreSQL schema.
    """
    try:
        with conn() as c:
            with c.cursor() as cur:
                target_id = str(well_id)
                # Ensure target_id is a valid UUID in the DB
                if not UUID_REGEX.match(target_id):
                    row = cur.execute("SELECT id FROM wells WHERE well_name = %s LIMIT 1", (target_id,)).fetchone()
                    if row:
                        target_id = str(row["id"])
                    else:
                        target_id = None

                if not target_id:
                    return

                d_val = float(depth) if depth is not None else 0.0
                ev_refs = [e.get("event_id") for e in alert.get("evidence", []) if isinstance(e, dict) and e.get("event_id")]
                rule_ver = alert.get("rule_version") or alert.get("model_version") or "NWIS-Risk-v1"
                score_val = float(alert.get("score", 75.0))
                rtype = alert.get("risk_type") or "general"
                rlevel = alert.get("risk_level") or "moderate"

                cur.execute("""
                    INSERT INTO risk_predictions (
                        well_id, depth, risk_type, score, risk_level, evidence_refs, model_version, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
                """, (target_id, d_val, rtype, score_val, rlevel, Jsonb(ev_refs), rule_ver))
            c.commit()
    except Exception as e:
        print(f"  Note: _persist skipped ({e})")


@router.websocket("/realtime/{well_id}")
async def realtime(ws: WebSocket, well_id: str, speed: float = 1.0, radius_km: float = 10,
                   every: int = 5, start_depth: float | None = None):
    await ws.accept()
    buf, last = [], {}
    latest_risks = None
    evaluating = False

    # Immediate initial risk evaluation so frontend live alerts are active from frame 1
    try:
        init_depth = float(start_depth) if start_depth is not None else 2700.0
        latest_risks = await asyncio.to_thread(evaluate, well_id, init_depth, "Formation X", None, radius_km)
    except Exception as e:
        print(f"  Note: Initial risk evaluation exception ({e})")

    async def run_evaluation(current_row, recent_df):
        nonlocal latest_risks, evaluating
        try:
            r = await asyncio.to_thread(evaluate, well_id, current_row["depth"], current_row.get("formation"), recent_df, radius_km)
            if r:
                latest_risks = r
            # Persist in background non-blocking task so stream is never delayed
            for a in (r or []):
                key = a.get("risk_level")
                if last.get(a.get("risk_type")) != key:
                    last[a.get("risk_type")] = key
                    a["new"] = True
                    asyncio.create_task(asyncio.to_thread(_persist, well_id, current_row["depth"], a))
        except Exception as e:
            print(f"  Note: Background risk evaluation ({e})")
        finally:
            evaluating = False

    src = ReplaySource(REPLAY_CSV, interval=1.0 / max(speed, 0.1), start_depth=start_depth)
    try:
        async for row in src.stream():
            buf.append(row)
            if len(buf) % every == 0 and not evaluating:
                evaluating = True
                available_cols = [col for col in COLS if col in row]
                recent = pd.DataFrame(buf[-60:])[available_cols] if available_cols else None
                asyncio.create_task(run_evaluation(row, recent))

            msg = {"state": row, "risks": latest_risks}
            await ws.send_text(json.dumps(msg, default=str))

        await ws.send_text(json.dumps({"done": True}))
        # Brief pause so the client parses and flags isDone before socket closes
        await asyncio.sleep(0.15)
        try:
            await ws.close(code=1000)
        except Exception:
            pass
    except WebSocketDisconnect:
        return
    except Exception as e:
        print(f"  Note: Realtime WebSocket closed with exception: {e}")
        try:
            await ws.close(code=1011)
        except Exception:
            pass