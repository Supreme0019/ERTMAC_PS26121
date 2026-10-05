# Experimental ML package

Everything here is OPTIONAL and EXPERIMENTAL. The alert source for the product stays the rule-based engine in `app/risk/`.
Models are trained on synthetic data with planted patterns, so metrics show that the pipeline works, not real-world accuracy.

Run from `ai_service/` with the venv active:

    pip install -r ml/requirements-ml.txt
    python ml/train.py --event mud_loss --tune        # train, tune, cross-validate, calibrate, save
    python ml/train.py --event torque_spike
    python ml/severity.py                             # severity classifier, leave-one-well-out
    python ml/monitor.py                              # data-drift report for the live replay stream
    python ml/explain.py --event mud_loss             # SHAP + LIME (needs --algo xgb on train.py)
    python -m pytest tests/test_ml_offline.py -q

Outputs: `ml/models/` (joblib + json metadata, git-ignored) and `ml/outputs/` (charts, reports, git-ignored).
