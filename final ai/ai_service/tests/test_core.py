from app.similarity.engine import similar_wells
from app.risk.engine import evaluate


def test_similar_is_ranked():
    r = similar_wells("WELL-A-102", 2850, "Formation X")
    assert r and r == sorted(r, key=lambda x: -x["score"])


def test_risk_fires_in_planted_zone():
    a = evaluate("WELL-A-102", 2850, "Formation X")
    assert a and a[0]["risk_type"] == "mud_loss" and a[0]["evidence"]


def test_no_alert_at_unrelated_depth():
    assert evaluate("WELL-A-102", 1000, "Formation B") == []