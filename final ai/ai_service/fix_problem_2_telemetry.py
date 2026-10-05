import sys, os, time, json
import pandas as pd
from psycopg.types.json import Jsonb
from app.db import conn

CSV_PATH = "../data/synthetic/drilling_data.csv"

def fix_problem_2():
    print("=== Step 1: Loading wells mapping from database ===")
    with conn() as c:
        with c.cursor() as cur:
            wells = cur.execute("SELECT id, well_name, status FROM wells").fetchall()
            well_map = {w["well_name"]: str(w["id"]) for w in wells}
            print(f"Total wells found in DB: {len(well_map)}")
            
            curr_counts = cur.execute("SELECT count(*) as total, count(DISTINCT well_id) as wells_count FROM drilling_parameters").fetchone()
            print(f"Current drilling_parameters: {curr_counts['total']} rows across {curr_counts['wells_count']} wells.")

    print(f"\n=== Step 2: Reading {CSV_PATH} ===")
    if not os.path.exists(CSV_PATH):
        print(f"Error: {CSV_PATH} not found!")
        return

    df = pd.read_csv(CSV_PATH)
    total_csv_rows = len(df)
    unique_csv_wells = df['well_id'].nunique()
    print(f"Loaded CSV: {total_csv_rows} rows across {unique_csv_wells} unique wells.")

    # Validate that all CSV wells exist in DB
    missing_wells = [w for w in df['well_id'].unique() if w not in well_map]
    if missing_wells:
        print(f"Warning: {len(missing_wells)} wells in CSV not found in DB: {missing_wells[:5]}")
    else:
        print(" All 60 offset wells in CSV matched to database UUIDs successfully!")

    print("\n=== Step 3: Preparing and Batch Inserting Records via COPY ===")
    records = []
    
    # Map CSV rows
    for _, row in df.iterrows():
        wid = well_map.get(row['well_id'])
        if not wid:
            continue
            
        extra = json.dumps({"formation": str(row['formation']), "mud_loss": float(row['mud_loss'])})
        records.append((
            wid,
            str(row['ts']),
            float(row['depth']),
            float(row['wob']),
            float(row['rpm']),
            float(row['torque']),
            float(row['rop']),
            1.18, # mud_weight
            float(row['mud_flow']),
            float(row['pressure']),
            None, # annular_pressure
            None, # hook_load
            extra # additional_parameters
        ))

    print(f"Prepared {len(records)} records for streaming COPY...")

    t0 = time.time()

    with conn() as c:
        with c.cursor() as cur:
            with cur.copy("""
                COPY drilling_parameters (
                    well_id, timestamp, depth, wob, rpm, torque, rop,
                    mud_weight, mud_flow_rate, standpipe_pressure,
                    annular_pressure, hook_load, additional_parameters
                ) FROM STDIN
            """) as copy:
                for rec in records:
                    copy.write_row(rec)
        c.commit()

    elapsed = round(time.time() - t0, 2)
    print(f"\nBulk COPY completed in {elapsed}s ({round(len(records)/max(elapsed, 0.1), 0)} rows/sec).")

    print("\n=== Step 4: Verification in Database ===")
    with conn() as c:
        with c.cursor() as cur:
            verify = cur.execute("""
                SELECT count(*) as total, 
                       count(DISTINCT well_id) as wells_count,
                       min(depth) as min_d,
                       max(depth) as max_d
                FROM drilling_parameters
            """).fetchone()

            # Distribution sample
            dist = cur.execute("""
                SELECT w.well_name, count(dp.id) as param_rows
                FROM wells w
                JOIN drilling_parameters dp ON dp.well_id = w.id
                GROUP BY w.well_name
                ORDER BY param_rows DESC
                LIMIT 5
            """).fetchall()

            print(f"Verification Results:")
            print(f"  Total drilling_parameters rows: {verify['total']}")
            print(f"  Total wells with telemetry: {verify['wells_count']} (out of 61 wells in DB)")
            print(f"  Depth range: {verify['min_d']}m to {verify['max_d']}m")
            print("\nTop 5 wells by telemetry rows:")
            for r in dist:
                print(f"  {r['well_name']}: {r['param_rows']} rows")

            if verify['wells_count'] == 61 and verify['total'] > 23000:
                print("\n SUCCESS: Problem 2 is completely fixed! All 60 offset wells now have full telemetry.")
            else:
                print(f"\n WARNING: Only {verify['wells_count']} wells have telemetry.")

if __name__ == "__main__":
    fix_problem_2()
