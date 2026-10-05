"""Offline tests for entity extraction and the adaptive table writer (no database, no LLM)."""
import pytest

from app.documents.entities import extract_entities
from app.documents.entity_store import plan_insert

TEXT = ("Well: SYN-000   TD: 3,500 m\nReport interval 1500-1600 m\n"
        "At 2,840 m a partial loss of circulation was observed in Formation X. Losses of about 40 bbl/hr. "
        "LCM pill pumped. Pipe became stuck at 3300m MD with overpull of 45 klbs. "
        "Pit gain of 30 bbl. Mud weight 1.35 sg, pump 3200 psi. BHA inspected.")


def by_type(text, **kw):
    out = {}
    for e in extract_entities(text, **kw):
        out.setdefault(e.entity_type, []).append(e)
    return out


def test_depths_intervals_and_units():
    t = by_type(TEXT)
    assert sorted(e.value for e in t["depth"]) == ["2840", "3300", "3500"]
    assert [e.value for e in t["depth_interval"]] == ["1500-1600"]
    assert all(e.unit == "m" for e in t["depth"])


def test_other_entity_types():
    t = by_type(TEXT, formations=["Formation X"])
    assert [e.value for e in t["formation"]] == ["Formation X"]
    assert t["mud_weight"][0].value == "1.35" and t["mud_weight"][0].unit == "sg"
    assert t["pressure"][0].value == "3200" and t["flow_rate"][0].unit == "bbl/hr"
    assert t["volume"][0].value == "30" and t["load"][0].value == "45"
    assert {e.value for e in t["event_mention"]} >= {"mud_loss", "stuck_pipe", "kick"}
    assert {e.value for e in t["material"]} == {"lcm pill"} and "bha" in {e.value for e in t["equipment"]}


def test_offsets_point_at_the_text():
    for e in extract_entities(TEXT):
        assert TEXT[e.start:e.end] == e.text


def test_ocr_confidence_lowers_scores():
    hi = extract_entities("At 2,840 m")[0].confidence
    lo = extract_entities("At 2,840 m", ocr_conf=0.5)[0].confidence
    assert lo < hi


def test_no_false_depths_from_rates_or_words():
    t = by_type("Pump rate 15 m3/hr, mud 3 mm gauge, 12 members")
    assert "depth" not in t


def col(name, dtype="text", nullable="YES", default=None, identity="NO"):
    return {"data_type": dtype, "is_nullable": nullable, "column_default": default, "is_identity": identity}


def test_plan_matches_report_schema():
    cols = {"id": col("id", "integer", "NO", "nextval(x)"), "document_id": col("d", "integer", "NO"),
            "entity_type": col("t", nullable="NO"), "value": col("v", nullable="NO"),
            "confidence": col("c", "real"), "source_location": col("s")}
    plan = plan_insert(cols)
    assert [c for c, _, _ in plan] == ["document_id", "entity_type", "value", "confidence", "source_location"]


def test_plan_uses_aliases_and_json_columns():
    cols = {"id": col("id", "integer", "NO", None, "YES"), "document_id": col("d", "integer", "NO"),
            "entity_type": col("t", nullable="NO"), "entity_value": col("v", nullable="NO"),
            "page_number": col("p", "integer"), "source_location": col("s", "jsonb")}
    plan = plan_insert(cols)
    assert ("entity_value", "value", False) in plan and ("page_number", "page", False) in plan
    assert ("source_location", "source_location", True) in plan


def test_plan_errors_are_clear():
    with pytest.raises(RuntimeError, match="does not exist"):
        plan_insert({})
    with pytest.raises(RuntimeError, match="cannot fill"):
        plan_insert({"document_id": col("d", "integer", "NO"), "entity_type": col("t", nullable="NO"),
                     "tenant_id": col("x", "uuid", "NO")})
