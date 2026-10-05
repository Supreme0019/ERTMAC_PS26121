import numpy as np, pandas as pd, pathlib

rng = np.random.default_rng(42)
OUT = pathlib.Path("../data/synthetic"); OUT.mkdir(parents=True, exist_ok=True)
CENTER = (27.35, 95.30)   # arbitrary synthetic field location
N_WELLS = 60

FORMATIONS = [("Formation A", 0, 800, "sand/clay"),
              ("Formation B", 800, 1800, "sandstone"),
              ("Formation C", 1800, 2500, "shale"),
              ("Formation X", 2500, 3100, "fractured sandstone"),
              ("Formation Y", 3100, 3600, "shale/coal")]

# Hidden "risk zones" we plant on purpose. The system must rediscover these.
ZONES = [dict(type="mud_loss",     fm="Formation X", center=2840, half=35, p=0.65),
         dict(type="stuck_pipe",   fm="Formation Y", center=3300, half=40, p=0.55),
         dict(type="torque_spike", fm="Formation C", center=2100, half=30, p=0.50),
         dict(type="kick",         fm="Formation Y", center=3450, half=25, p=0.30)]

MITIG = {"mud_loss": ["LCM pill pumped", "reduced pump rate and adjusted mud weight"],
         "stuck_pipe": ["worked pipe and spotted freeing pill", "jarred free after circulation"],
         "torque_spike": ["reduced WOB and RPM, circulated bottoms up"],
         "kick": ["shut-in and increased mud weight"]}


def make_well(i, lat=None, lon=None, wid=None, td=None):
    lat = lat if lat is not None else CENTER[0] + rng.uniform(-.18, .18)
    lon = lon if lon is not None else CENTER[1] + rng.uniform(-.18, .18)
    directional = rng.random() < .5
    return dict(id=wid or f"SYN-{i:03d}", well_name=wid or f"SYN-{i:03d}", field="SYNTH-FIELD",
                status="completed", well_type="directional" if directional else "vertical",
                latitude=lat, longitude=lon,
                total_depth=round(td or rng.uniform(3200, 3700)),
                avg_inclination=round(rng.uniform(25, 45) if directional else rng.uniform(0, 10), 1),
                shift=(lat - CENTER[0]) * 400 + rng.normal(0, 25))   # geological "dip"


wells = [make_well(i) for i in range(N_WELLS)]
active = make_well(0, CENTER[0], CENTER[1], "WELL-A-102", 3500)
active.update(status="drilling", shift=5.0, well_type="directional", avg_inclination=32.0)


def tops(w):
    return [(n, t + w["shift"] if t > 0 else 0, min(b + w["shift"], w["total_depth"]), l)
            for n, t, b, l in FORMATIONS]


def fm_at(w, d):
    for n, t, b, _ in tops(w):
        if t <= d < b:
            return n
    return FORMATIONS[-1][0]


# ---- events (ground truth) ----
events = []
for w in wells:
    for z in ZONES:
        c = z["center"] + w["shift"]
        if w["total_depth"] < c + z["half"]:
            continue
        p = z["p"]
        if z["type"] == "stuck_pipe" and w["avg_inclination"] < 25:
            p = 0.05          # stuck pipe mostly in directional wells
        if rng.random() < p:
            d = round(c + rng.uniform(-z["half"], z["half"]))
            events.append(dict(well_id=w["id"], depth=d, formation=fm_at(w, d), event_type=z["type"],
                               severity=str(rng.choice(["low", "medium", "high"], p=[.25, .4, .35])),
                               mitigation=str(rng.choice(MITIG[z["type"]])),
                               outcome="drilling resumed"))
ev = pd.DataFrame(events)
ev.insert(0, "event_id", range(1, len(ev) + 1))


# ---- drilling parameters ----
def base_row(d):
    return dict(rop=max(5, 30 - (d - 1500) * .006 + rng.normal(0, 1.5)),
                wob=10 + d / 1000 + rng.normal(0, .5),
                rpm=120 + rng.normal(0, 3),
                torque=12 + d * .004 + rng.normal(0, .6),
                pressure=2000 + d * .35 + rng.normal(0, 25),
                mud_flow=850 + rng.normal(0, 8),
                mud_loss=max(0, rng.normal(.2, .2)))


def apply_anom(row, d, evs):
    for e in evs:
        gap = d - e["depth"]
        if -30 <= gap <= 10:
            k = (1 - abs(gap) / 30) if gap < 0 else 1.0
            sev = {"low": .5, "medium": .8, "high": 1.2}[e["severity"]]
            t = e["event_type"]
            if t == "mud_loss":
                row["mud_loss"] += 25 * k * sev; row["mud_flow"] -= 60 * k * sev; row["pressure"] -= 120 * k * sev
            elif t in ("stuck_pipe", "torque_spike"):
                row["torque"] *= 1 + .6 * k * sev; row["rop"] *= 1 - .4 * k * sev
            elif t == "kick":
                row["pressure"] += 250 * k * sev; row["mud_flow"] += 40 * k * sev
    return row


rows = []
for w in wells:
    wev = ev[ev.well_id == w["id"]].to_dict("records")
    t0 = pd.Timestamp("2022-01-01") + pd.Timedelta(days=int(rng.integers(0, 900)))
    for j, d in enumerate(range(1500, int(w["total_depth"]), 5)):
        r = apply_anom(base_row(d), d, wev)
        rows.append(dict(well_id=w["id"], ts=t0 + pd.Timedelta(hours=j), depth=d, formation=fm_at(w, d), **r))
drill = pd.DataFrame(rows)

# ---- active-well replay: 2700 -> 2900 m, anomaly ramps up from 2838 m ----
arows = []
t = pd.Timestamp.now().floor("s")
for j, d in enumerate(range(2700, 2900)):
    r = base_row(d)
    if 2838 <= d <= 2875:
        k = min((d - 2838) / 12, 1)
        r["mud_loss"] += k * 22; r["mud_flow"] -= k * 50; r["pressure"] -= k * 110
    arows.append(dict(well_id="WELL-A-102", ts=t + pd.Timedelta(seconds=5 * j), depth=d,
                      formation=fm_at(active, d), **r))

# ---- write files ----
allw = wells + [active]
pd.DataFrame(allw).drop(columns="shift").to_csv(OUT / "wells.csv", index=False)
pd.DataFrame([dict(formation=n, top_depth=t, bottom_depth=b, lithology=l, risk_factors="")
              for n, t, b, l in FORMATIONS]).to_csv(OUT / "formations.csv", index=False)
pd.DataFrame([dict(well_id=w["id"], formation=n, top_depth=t, bottom_depth=b)
              for w in allw for n, t, b, _ in tops(w) if t < b]).to_csv(OUT / "well_formations.csv", index=False)
drill.to_csv(OUT / "drilling_data.csv", index=False)
pd.DataFrame(arows).to_csv(OUT / "active_replay.csv", index=False)
ev.to_csv(OUT / "events_truth.csv", index=False)
print(f"{len(allw)} wells | {len(drill)} drilling rows | {len(ev)} events | {len(arows)} replay rows")