"""Offline unit tests: no database, no LLM calls. Run from ai_service/:  python -m pytest tests/test_offline.py -q"""
import pathlib

import pandas as pd
import pytest

from app.documents.chunker import chunk_page
from app.rag.citations import extract_citations
from app.rag.filters import parse_filters
from app.risk.anomaly import live_anomaly
from app.services.jsonutil import parse_json

REPLAY = pathlib.Path(__file__).resolve().parents[2] / "data" / "synthetic" / "active_replay.csv"
COLS = ["rop", "wob", "rpm", "torque", "pressure", "mud_flow", "mud_loss"]


def test_parse_json_accepts_object_list_and_fences():
    assert parse_json('{"events": []}') == {"events": []}
    assert parse_json('[{"a": 1}, {"a": 2}]') == [{"a": 1}, {"a": 2}]
    assert parse_json('```json\n{"events": [1]}\n```') == {"events": [1]}
    assert parse_json('Here you go: {"ok": true} thanks') == {"ok": True}
    with pytest.raises(ValueError):
        parse_json("no json here")


def test_extract_citations_handles_grouped_brackets():
    assert extract_citations("A [E21, E29] and B [E32][C5].") == ["E21", "E29", "E32", "C5"]
    assert extract_citations("no citations") == []
    assert extract_citations("[E7] again [E7]") == ["E7"]


def test_parse_filters():
    assert parse_filters("mud loss between 2700 and 2900 m") == {"types": ["mud_loss"], "from": 2700.0, "to": 2900.0}
    assert parse_filters("stuck pipe from 3,200 m to 3,400 m")["from"] == 3200.0
    assert parse_filters("what happened 2800-2900m")["types"] == []
    assert "from" not in parse_filters("show kicks")


def test_chunk_page_overlaps_long_text():
    words = " ".join(f"w{i}" for i in range(500))
    chunks = chunk_page(words, max_words=220, overlap=30)
    assert len(chunks) == 3 and chunks[1].split()[0] == "w190"
    assert chunk_page("short page") == ["short page"]


@pytest.mark.skipif(not REPLAY.exists(), reason="run scripts/generate_synthetic.py first")
def test_live_anomaly_fires_only_after_onset():
    ar = pd.read_csv(REPLAY)

    def window(depth):
        return ar[ar.depth <= depth].tail(60)[COLS]

    assert not live_anomaly(window(2800), "mud_loss")["flag"]
    assert live_anomaly(window(2850), "mud_loss")["flag"]
    assert not live_anomaly(window(2850).head(10), "mud_loss")["flag"]      # too few rows


def test_extractor_grounding_and_keyword_filter():
    pytest.importorskip("pydantic")
    from app.documents.extractor import ExtractedEvent, looks_eventful, score

    def ev(quote):
        return ExtractedEvent(event_type="mud_loss", depth_m=2840, description="d",
                              evidence_quote=quote, llm_confidence=0.9)

    page = "At 2,840 m in Formation X a partial loss of circulation was observed."
    assert score(ev("partial loss of circulation was observed"), page, 3500, None) == 0.9
    assert score(ev("this sentence is not on the page"), page, 3500, None) == 0.36      # x0.4
    assert score(ev("partial loss of circulation was observed"), page, 2000, None) == 0.54   # depth > TD, x0.6
    assert looks_eventful(page) and not looks_eventful("Tripped for bit change. BHA inspected.")
