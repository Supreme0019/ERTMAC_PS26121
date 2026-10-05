import sys, os, time
from psycopg.types.json import Jsonb
from app.db import conn
from app.services.embeddings import embed

FM_MAP = {
    'f1000000-0000-0000-0000-000000000001': {
        'old': 'Formation A',
        'name': 'Tipam Sandstone',
        'lithology': 'Coarse-medium grained sandstone with siltstone intercalations',
        'description': 'Tipam Sandstone (Miocene) - Upper reservoir series, high permeability, seepage loss risk.',
        'risk_factors': 'Differential sticking, seepage mud losses'
    },
    'f1000000-0000-0000-0000-000000000002': {
        'old': 'Formation B',
        'name': 'Girujan Clay',
        'lithology': 'Mottled plastic claystone and reactive shale',
        'description': 'Girujan Clay (Miocene) - Thick regional seal, swelling reactive clays, bit balling risk.',
        'risk_factors': 'Swelling shale, bit balling, borehole washout'
    },
    'f1000000-0000-0000-0000-000000000003': {
        'old': 'Formation C',
        'name': 'Barail Formation',
        'lithology': 'Sandstone, shale, and carbonaceous coal seams',
        'description': 'Barail Formation (Oligocene) - Primary multi-layer hydrocarbon interval, torque spikes and gas shows.',
        'risk_factors': 'Coal seam sloughing, torque spikes, gas cut mud'
    },
    'f1000000-0000-0000-0000-000000000004': {
        'old': 'Formation X',
        'name': 'Kopili Formation',
        'lithology': 'Fissile splintery shale and calcareous siltstone',
        'description': 'Kopili Formation (Eocene) - High-pressure reactive shale transition zone, prone to sloughing, tight hole, and mechanical stuck pipe.',
        'risk_factors': 'Severe mechanical stuck pipe, borehole collapse, tight hole'
    },
    'f1000000-0000-0000-0000-000000000005': {
        'old': 'Formation Y',
        'name': 'Sylhet Limestone',
        'lithology': 'Dense crystalline fossiliferous limestone',
        'description': 'Sylhet Limestone (Eocene) - Basal carbonate series, hard drilling abrasive rock, vugular lost circulation.',
        'risk_factors': 'Lost circulation, severe bit wear, chert nodules'
    }
}

def apply_real_stratigraphy():
    print("=== Step 1: Updating formations table with authentic Assam stratigraphy ===")
    with conn() as c:
        with c.cursor() as cur:
            for fid, info in FM_MAP.items():
                attrs = Jsonb({
                    'lithology': info['lithology'],
                    'risk_factors': info['risk_factors'],
                    'basin': 'Assam-Arakan Basin'
                })
                cur.execute("""
                    UPDATE formations 
                    SET name = %s, description = %s, geological_attributes = %s
                    WHERE id = %s
                """, (info['name'], info['description'], attrs, fid))
                print(f"  {info['old']:<12} -> {info['name']:<18} ({info['lithology']})")
        c.commit()

    print("\n=== Step 2: Updating drilling_events descriptions ===")
    with conn() as c:
        with c.cursor() as cur:
            for fid, info in FM_MAP.items():
                cur.execute("""
                    UPDATE drilling_events
                    SET description = REPLACE(description, %s, %s)
                    WHERE description LIKE %s
                """, (info['old'], info['name'], f"%{info['old']}%"))
        c.commit()

    print("\n=== Step 3: Updating additional_parameters in drilling_parameters ===")
    with conn() as c:
        with c.cursor() as cur:
            for fid, info in FM_MAP.items():
                cur.execute("""
                    UPDATE drilling_parameters
                    SET additional_parameters = jsonb_set(additional_parameters, '{formation}', %s)
                    WHERE additional_parameters->>'formation' = %s
                """, (f'"{info["name"]}"', info['old']))
        c.commit()

    print("\n=== Step 4: Updating extracted_entities ===")
    with conn() as c:
        with c.cursor() as cur:
            for fid, info in FM_MAP.items():
                norm = info['name'].lower().replace(" ", "_")
                cur.execute("""
                    UPDATE extracted_entities
                    SET value = %s, normalized_value = %s
                    WHERE entity_type = 'FORMATION' AND (value = %s OR value ILIKE %s)
                """, (info['name'], norm, info['old'], f"%{info['old']}%"))
            
            # Update specific lithologies
            cur.execute("""
                UPDATE extracted_entities
                SET value = 'Fissile Reactive Shale', normalized_value = 'fissile_reactive_shale'
                WHERE entity_type = 'LITHOLOGY' AND value ILIKE '%sandstone%'
            """)
        c.commit()

    print("\n=== Step 5: Updating document_chunks text and re-generating embeddings ===")
    with conn() as c:
        with c.cursor() as cur:
            chunks = cur.execute("SELECT id, text FROM document_chunks ORDER BY id").fetchall()
            
            updated_chunks = []
            for ch in chunks:
                t = ch["text"]
                for fid, info in FM_MAP.items():
                    t = t.replace(info['old'], info['name'])
                updated_chunks.append((ch["id"], t))

            print(f"  Replaced formation names across {len(updated_chunks)} document chunks.")
            print("  Generating updated 384-dim embeddings using BAAI/bge-small-en-v1.5...")
            
            texts = [item[1] for item in updated_chunks]
            chunk_ids = [item[0] for item in updated_chunks]
            vectors = embed(texts, query=False)

            for cid, txt, vec in zip(chunk_ids, texts, vectors):
                vec_str = "[" + ",".join(str(float(x)) for x in vec) + "]"
                cur.execute("""
                    UPDATE document_chunks
                    SET text = %s, embedding = %s::vector
                    WHERE id = %s
                """, (txt, vec_str, cid))
        c.commit()

    print("\n=== Step 6: Verification ===")
    with conn() as c:
        with c.cursor() as cur:
            fms = cur.execute("SELECT name, geological_attributes->>'lithology' as lithology FROM formations ORDER BY name").fetchall()
            print("Formations in Database:")
            for f in fms:
                print(f"  • {f['name']:<20} | Lithology: {f['lithology']}")

            # Verify active well formation
            active_well = cur.execute("""
                SELECT w.well_name, f.name as current_formation, w.current_depth
                FROM wells w
                JOIN formations f ON f.id = w.current_formation_id
                WHERE w.status = 'active'
            """).fetchone()
            print(f"\nActive Well Status:")
            print(f"  Well: {active_well['well_name']} | Depth: {active_well['current_depth']}m | Formation: {active_well['current_formation']}")

if __name__ == "__main__":
    apply_real_stratigraphy()
