CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE wells (
  id TEXT PRIMARY KEY,
  well_name TEXT,
  field TEXT,
  status TEXT,
  well_type TEXT,                       -- vertical | directional
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  geom geography(Point,4326),
  total_depth REAL,
  avg_inclination REAL,
  source TEXT DEFAULT 'synthetic',
  is_synthetic BOOLEAN DEFAULT TRUE
);
CREATE INDEX wells_geom_idx ON wells USING GIST (geom);

CREATE TABLE formations (
  name TEXT PRIMARY KEY,
  lithology TEXT,
  risk_factors TEXT
);

CREATE TABLE well_formations (
  well_id TEXT REFERENCES wells(id),
  formation TEXT REFERENCES formations(name),
  top_depth REAL,
  bottom_depth REAL,
  PRIMARY KEY (well_id, formation)
);

CREATE TABLE drilling_parameters (
  well_id TEXT REFERENCES wells(id),
  ts TIMESTAMP,
  depth REAL,
  formation TEXT,
  rop REAL, wob REAL, rpm REAL, torque REAL,
  pressure REAL, mud_flow REAL, mud_loss REAL
);
CREATE INDEX dp_well_depth ON drilling_parameters (well_id, depth);

CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  well_id TEXT REFERENCES wells(id),
  doc_type TEXT,
  file_uri TEXT,
  pages INT,
  ocr_used BOOLEAN,
  version INT DEFAULT 1,
  status TEXT DEFAULT 'ingested',
  is_synthetic BOOLEAN DEFAULT TRUE
);

CREATE TABLE document_chunks (
  id SERIAL PRIMARY KEY,
  document_id INT REFERENCES documents(id),
  well_id TEXT,
  page INT,
  section TEXT,
  text TEXT,
  ocr_confidence REAL,
  embedding vector(384)
);
CREATE INDEX chunks_emb ON document_chunks USING hnsw (embedding vector_cosine_ops);

CREATE TABLE drilling_events (
  id SERIAL PRIMARY KEY,
  well_id TEXT REFERENCES wells(id),
  depth REAL,
  formation TEXT,
  event_type TEXT,     -- mud_loss | stuck_pipe | kick | torque_spike | cementing_issue | other
  severity TEXT,
  description TEXT,
  mitigation TEXT,
  outcome TEXT,
  origin TEXT,         -- structured | extracted
  document_id INT,
  page INT,
  evidence_quote TEXT,
  confidence REAL,
  review_status TEXT DEFAULT 'auto',
  extractor_version TEXT
);
CREATE INDEX ev_well_depth ON drilling_events (well_id, depth);

CREATE TABLE risk_predictions (
  id SERIAL PRIMARY KEY,
  well_id TEXT,
  depth REAL,
  risk_type TEXT,
  score REAL,
  evidence_refs JSONB,
  rule_version TEXT,
  created_at TIMESTAMP DEFAULT now()
);