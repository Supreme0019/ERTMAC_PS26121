"""Offline tests for the ML helpers (no database, no LLM). Needs data/synthetic from generate_synthetic.py."""
import pathlib

import numpy as np
import pytest

from ml.common import make_model
from ml.monitor import psi

DATA = pathlib.Path(__file__).resolve().parents[2] / "data" / "synthetic" / "drilling_data.csv"


def test_psi_is_small_for_same_and_large_for_shifted_data():
    rng = np.random.default_rng(0)
    a, b = rng.normal(0, 1, 5000), rng.normal(0, 1, 5000)
    assert psi(a, b) < 0.05
    assert psi(a, b + 2) > 0.25


def test_psi_handles_constant_reference():
    assert psi(np.zeros(100), np.ones(100)) == 0.0


def test_make_model_always_returns_a_usable_estimator():
    algo, est = make_model("auto")
    assert algo in ("xgb", "hgb") and hasattr(est, "fit") and hasattr(est, "predict_proba")


@pytest.mark.skipif(not DATA.exists(), reason="run scripts/generate_synthetic.py first")
def test_training_set_has_positives_and_no_missing_features():
    from ml.features import FEAT, build_training_set
    d = build_training_set("mud_loss")
    assert d.y.sum() > 50 and not d[FEAT].isna().any().any()


@pytest.mark.skipif(not DATA.exists(), reason="run scripts/generate_synthetic.py first")
def test_replay_features_flag_the_anomaly_region():
    from ml.features import FEAT, build_replay_set
    r = build_replay_set()
    assert r.loc[r.depth == 2855, "z_mud_loss"].iloc[0] > 10 > r.loc[r.depth == 2825, "z_mud_loss"].iloc[0]
