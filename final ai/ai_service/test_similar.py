from app.similarity.engine import similar_wells

well_id = 'b1000000-0000-0000-0000-000000000001'
res = similar_wells(active_id=well_id, depth=2850, formation='Kopili', radius_km=15, top_n=5)
print(f"Similar wells found: {len(res)}")
for s in res:
    print(f" - {s['well_name']} ({s['well_id']}): score={s['score']} | dist={s['distance_km']} km | factors={s['factors']}")
