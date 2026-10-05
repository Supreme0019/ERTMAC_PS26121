import sys, os, time, math, random
from app.db import conn

def fix_problem_3():
    print("=== Step 1: Querying wells needing trajectory surveys ===")
    with conn() as c:
        with c.cursor() as cur:
            # Check existing trajectory wells
            existing = cur.execute("SELECT DISTINCT well_id FROM well_trajectories").fetchall()
            existing_wids = {str(r["well_id"]) for r in existing}
            print(f"Wells with existing trajectories: {len(existing_wids)}")

            # Fetch all wells
            wells = cur.execute("""
                SELECT id, well_name, latitude, longitude, COALESCE(total_depth, 3500) as total_depth
                FROM wells
                ORDER BY well_name
            """).fetchall()

    target_wells = [w for w in wells if str(w["id"]) not in existing_wids]
    print(f"Total wells in database: {len(wells)}")
    print(f"Offset wells needing trajectories: {len(target_wells)}")

    if not target_wells:
        print("All wells already have trajectory stations!")
        return

    print("\n=== Step 2: Generating Directional Survey Trajectories ===")
    records = []
    
    for w in target_wells:
        wid = str(w["id"])
        wname = w["well_name"]
        w_lat = float(w["latitude"])
        w_lon = float(w["longitude"])
        td = float(w["total_depth"])

        # Deterministic seed based on well name
        rnd = random.Random(wname)
        
        # Directional profile parameters
        kop = rnd.randint(600, 1100)          # Kickoff point depth (m)
        target_inc = rnd.uniform(12.0, 34.0)   # Tangent inclination angle (deg)
        azimuth = rnd.uniform(15.0, 345.0)     # Wellbore heading (deg)
        build_rate = rnd.uniform(1.8, 2.8)     # Deg per 100m

        cur_tvd = 0.0
        cur_lat = w_lat
        cur_lon = w_lon
        cur_inc = 0.0
        prev_md = 0.0

        # Survey stations every 200m down to total depth
        depth_stations = list(range(0, int(td), 200))
        if depth_stations[-1] < int(td):
            depth_stations.append(int(td))

        for md in depth_stations:
            md_val = float(md)
            delta_md = md_val - prev_md

            if md_val <= kop:
                inc = 0.0
            else:
                dist_past_kop = md_val - kop
                inc = min(target_inc, dist_past_kop * (build_rate / 100.0))
                # Add minor realistic wellbore tortuosity / drift (+- 0.5 deg)
                if inc >= target_inc:
                    inc += rnd.uniform(-0.4, 0.4)

            # Average inclination across interval for TVD and spatial displacement
            avg_inc_rad = math.radians((cur_inc + inc) / 2.0)
            az_rad = math.radians(azimuth)

            # Incremental TVD and horizontal displacements
            delta_tvd = delta_md * math.cos(avg_inc_rad)
            cur_tvd += delta_tvd

            delta_h = delta_md * math.sin(avg_inc_rad)
            dx = delta_h * math.sin(az_rad) # East-West (m)
            dy = delta_h * math.cos(az_rad) # North-South (m)

            # Convert meters to degrees latitude & longitude
            cur_lat += dy / 111139.0
            cur_lon += dx / (111139.0 * math.cos(math.radians(cur_lat)))

            records.append((
                wid,
                round(md_val, 1),
                round(cur_tvd, 2),
                round(cur_lat, 6),
                round(cur_lon, 6),
                round(inc, 2),
                round(azimuth, 1)
            ))

            cur_inc = inc
            prev_md = md_val

    print(f"Generated {len(records)} trajectory survey stations across {len(target_wells)} wells (~{len(records)//len(target_wells)} stations/well).")

    print("\n=== Step 3: Streaming Records into well_trajectories ===")
    t0 = time.time()
    with conn() as c:
        with c.cursor() as cur:
            with cur.copy("""
                COPY well_trajectories (
                    well_id, measured_depth, tvd, latitude, longitude, inclination, azimuth
                ) FROM STDIN
            """) as copy:
                for r in records:
                    copy.write_row(r)
        c.commit()

    elapsed = round(time.time() - t0, 2)
    print(f"Streamed {len(records)} trajectory points in {elapsed}s.")

    print("\n=== Step 4: Verification in Database ===")
    with conn() as c:
        with c.cursor() as cur:
            v = cur.execute("""
                SELECT count(*) as total_pts, 
                       count(DISTINCT well_id) as total_wells,
                       min(inclination) as min_inc,
                       max(inclination) as max_inc
                FROM well_trajectories
            """).fetchone()

            sample = cur.execute("""
                SELECT w.well_name, count(wt.id) as pts, max(wt.inclination) as max_inc
                FROM wells w
                JOIN well_trajectories wt ON wt.well_id = w.id
                GROUP BY w.well_name
                ORDER BY pts DESC
                LIMIT 5
            """).fetchall()

            print(f"Verification Results:")
            print(f"  Total trajectory points in DB: {v['total_pts']}")
            print(f"  Total wells with trajectory: {v['total_wells']} / 61")
            print(f"  Inclination range: {v['min_inc']} deg to {v['max_inc']} deg")
            print("\nSample wells:")
            for r in sample:
                print(f"  {r['well_name']}: {r['pts']} survey stations (Max inclination: {r['max_inc']} deg)")

            if v['total_wells'] == 61:
                print("\n SUCCESS: All 61 wells now have complete 3D directional trajectory surveys!")
            else:
                print(f"\n WARNING: Only {v['total_wells']} wells have trajectories.")

if __name__ == "__main__":
    fix_problem_3()
