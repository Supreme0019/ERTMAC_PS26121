import sys, pathlib, json
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import pandas as pd
from app.risk.engine import evaluate, WEIGHTS

replay = pd.read_csv("../data/synthetic/active_replay.csv")


def window(depth, n=60):
    df = replay[replay.depth <= depth]
    return df.tail(n)


def show(title, alerts):
    print(f"\n=== {title}")
    if not alerts:
        print("  no alerts")
    for a in alerts:
        print(f"  {a['risk_type']:<13} {a['risk_level']:<9} score {a['score']:<4} range {a['depth_range']}"
              f"  wells={len({e['well_id'] for e in a['evidence']})}")
        print("     ", a["score_breakdown"])


show("2790 m, normal drilling", evaluate("WELL-A-102", 2790, "Formation X", window(2790)))
show("2820 m, approaching zone", evaluate("WELL-A-102", 2820, "Formation X", window(2820)))
show("2850 m, anomaly present", evaluate("WELL-A-102", 2850, "Formation X", window(2850)))
show("1000 m, unrelated depth", evaluate("WELL-A-102", 1000, "Formation B", None))

# Ablation: switch off one component at a time at 2850 m and watch the score change
print("\n=== ABLATION at 2850 m (top alert score)")
base = evaluate("WELL-A-102", 2850, "Formation X", window(2850))
print("  full model:", base[0]["score"] if base else None)
for k in WEIGHTS:
    w = dict(WEIGHTS); w[k] = 0
    r = evaluate("WELL-A-102", 2850, "Formation X", window(2850), weights=w)
    print(f"  without {k:<13}:", r[0]["score"] if r else None)

if base:
    print("\nFULL JSON OF TOP ALERT:")
    print(json.dumps(base[0], indent=2, default=str)[:1500])