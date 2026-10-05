from app.risk.engine import evaluate

well_id = 'b1000000-0000-0000-0000-000000000001'
alerts = evaluate(well_id=well_id, depth=2835, formation='Kopili', radius_km=15)
print(f"Risk alerts evaluated: {len(alerts)}")
for a in alerts:
    print(f"\n[ALERT] {a['risk_type']} -> Level: {a['risk_level']} (Score: {a['score']})")
    print(f"  Depth range: {a['depth_range']}")
    print(f"  Reasons: {a['reasons']}")
    print(f"  Evidence items: {len(a['evidence'])}")
    for ev in a['evidence'][:2]:
        print(f"    - {ev['well_name']} at {ev['depth']}m ({ev['severity']}): {ev['mitigation']}")
