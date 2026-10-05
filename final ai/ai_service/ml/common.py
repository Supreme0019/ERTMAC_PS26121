"""Model factory, search spaces and paths shared by the ML scripts."""
import pathlib

MODELS = pathlib.Path(__file__).resolve().parent / "models"
OUT = pathlib.Path(__file__).resolve().parent / "outputs"
MODELS.mkdir(exist_ok=True)
OUT.mkdir(exist_ok=True)

SEARCH = {
    "xgb": dict(n_estimators=[100, 200, 300], max_depth=[3, 4, 6], learning_rate=[.03, .1, .2],
                subsample=[.7, .9, 1.0], colsample_bytree=[.7, .9, 1.0], min_child_weight=[1, 3, 5]),
    "lgbm": dict(n_estimators=[100, 200, 300], num_leaves=[15, 31, 63], learning_rate=[.03, .1, .2],
                 min_child_samples=[10, 20, 40], subsample=[.7, .9, 1.0], colsample_bytree=[.7, .9, 1.0]),
    "hgb": dict(max_iter=[100, 200, 300], max_depth=[3, 4, 6], learning_rate=[.03, .1, .2],
                min_samples_leaf=[10, 20, 40]),
}


def make_model(algo: str = "auto", pos_weight: float = 1.0):
    """Returns (algo_name, estimator). 'auto' uses XGBoost if installed, else scikit-learn's HistGradientBoosting."""
    if algo in ("auto", "xgb"):
        try:
            import xgboost as xgb
            return "xgb", xgb.XGBClassifier(n_estimators=150, max_depth=4, learning_rate=.1, subsample=.9,
                                            colsample_bytree=.9, scale_pos_weight=pos_weight,
                                            eval_metric="logloss", random_state=0)
        except ImportError:
            if algo == "xgb":
                raise
    if algo == "lgbm":
        import lightgbm as lgb
        return "lgbm", lgb.LGBMClassifier(n_estimators=150, learning_rate=.1, class_weight="balanced",
                                          random_state=0, verbose=-1)
    from sklearn.ensemble import HistGradientBoostingClassifier
    return "hgb", HistGradientBoostingClassifier(max_depth=4, class_weight="balanced", random_state=0)
