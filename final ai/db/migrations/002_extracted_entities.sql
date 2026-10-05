-- Named entities extracted from report text (depths, formations, mud weight, equipment, ...).
-- Safe to run more than once. If another teammate already created this table, this does nothing:
-- the service adapts to whatever columns exist (see ai_service/app/documents/entity_store.py).
CREATE TABLE IF NOT EXISTS extracted_entities (
  id SERIAL PRIMARY KEY,
  document_id INT REFERENCES documents(id) ON DELETE CASCADE,
  well_id TEXT,
  page INT,
  entity_type TEXT NOT NULL,
  value TEXT NOT NULL,
  unit TEXT,
  text TEXT,
  snippet TEXT,
  confidence REAL,
  source_location TEXT,
  start_char INT,
  end_char INT
);
CREATE INDEX IF NOT EXISTS ent_doc ON extracted_entities (document_id);
CREATE INDEX IF NOT EXISTS ent_type ON extracted_entities (entity_type);
