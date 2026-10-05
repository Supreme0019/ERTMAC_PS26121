import sys
import psycopg
from app.db import conn
from app.services.embeddings import embed

def fix_embeddings():
    print("=== Step 1: Checking document_chunks in Neon DB ===")
    with conn() as c:
        rows = c.execute("""
            SELECT id, text 
            FROM document_chunks 
            WHERE embedding IS NULL
            ORDER BY id
        """).fetchall()

        total = c.execute("SELECT count(*) as cnt FROM document_chunks").fetchone()["cnt"]
        already_embedded = c.execute("SELECT count(embedding) as cnt FROM document_chunks").fetchone()["cnt"]

        print(f"Total chunks in table: {total}")
        print(f"Already have embeddings: {already_embedded}")
        print(f"Need embeddings generated: {len(rows)}")

        if not rows:
            print("All chunks already have embeddings! Nothing to do.")
            return

        print("\n=== Step 2: Generating 384-dimensional embeddings using BAAI/bge-small-en-v1.5 ===")
        texts = [r["text"] for r in rows]
        chunk_ids = [r["id"] for r in rows]

        vectors = embed(texts, query=False)
        print(f"Generated {len(vectors)} vectors. Dimension: {len(vectors[0])}")

        print("\n=== Step 3: Updating database records ===")
        updated_count = 0
        for cid, vec in zip(chunk_ids, vectors):
            vec_str = "[" + ",".join(str(float(x)) for x in vec) + "]"
            c.execute("""
                UPDATE document_chunks
                SET embedding = %s::vector
                WHERE id = %s
            """, (vec_str, cid))
            updated_count += 1
            if updated_count % 5 == 0 or updated_count == len(chunk_ids):
                print(f"  Updated {updated_count}/{len(chunk_ids)} chunks...")

        print("\n=== Step 4: Verification ===")
        res = c.execute("""
            SELECT count(*) as total, 
                   count(embedding) as with_emb, 
                   count(*) - count(embedding) as without_emb
            FROM document_chunks
        """).fetchone()

        print(f"Verification Results:")
        print(f"  Total chunks: {res['total']}")
        print(f"  Chunks with embedding: {res['with_emb']}")
        print(f"  Chunks without embedding: {res['without_emb']}")

        if res["without_emb"] == 0 and res["with_emb"] > 0:
            print("\n SUCCESS: Problem 1 is completely fixed! Vector search is now active.")
        else:
            print(f"\n WARNING: {res['without_emb']} chunks still without embedding.")

if __name__ == "__main__":
    fix_embeddings()
