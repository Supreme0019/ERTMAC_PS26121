// =============================================================================
// NWIS Backend — Auto Schema Initialization (Neon Serverless & pg compatible)
// =============================================================================
// Runs automatically on server startup. Every statement uses CREATE IF NOT EXISTS
// so it's fully idempotent — safe to run on every boot, no manual migration needed.
// =============================================================================

const { sql } = require('../config/database');
const logger = require('../utils/logger');

async function initDB() {
  try {
    logger.info('🔧 Initializing database schema...');

    // ── Extensions ────────────────────────────────────────────────────────────
    await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
    await sql`CREATE EXTENSION IF NOT EXISTS "postgis"`;

    // ── Users ─────────────────────────────────────────────────────────────────
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(150) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'DRILLING_ENGINEER',
        status VARCHAR(30) DEFAULT 'active',
        refresh_token TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`;

    // ── Structural Zones ──────────────────────────────────────────────────────
    await sql`
      CREATE TABLE IF NOT EXISTS structural_zones (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(150) UNIQUE NOT NULL,
        description TEXT,
        structural_type VARCHAR(100) DEFAULT 'thrust_fault',
        geological_attributes JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // ── Wells ─────────────────────────────────────────────────────────────────
    await sql`
      CREATE TABLE IF NOT EXISTS wells (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        well_name VARCHAR(150) UNIQUE NOT NULL,
        field VARCHAR(150),
        status VARCHAR(50) DEFAULT 'planned',
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        location GEOGRAPHY(Point, 4326),
        spud_date DATE,
        total_depth NUMERIC,
        current_depth NUMERIC DEFAULT 0,
        current_formation_id UUID,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_wells_status ON wells(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_wells_field ON wells(field)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_wells_location ON wells USING GIST(location)`;

    // ── Formations (Chronostratigraphic & Lithostratigraphic Units) ───────────
    await sql`
      CREATE TABLE IF NOT EXISTS formations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(150) UNIQUE NOT NULL,
        description TEXT,
        geological_attributes JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // ── Well-Formation Relationship (Ordered Stratigraphic Columns) ───────────
    await sql`
      CREATE TABLE IF NOT EXISTS well_formations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        well_id UUID NOT NULL REFERENCES wells(id) ON DELETE CASCADE,
        formation_id UUID NOT NULL REFERENCES formations(id),
        top_depth NUMERIC NOT NULL,
        bottom_depth NUMERIC NOT NULL,
        metadata JSONB DEFAULT '{}',
        CONSTRAINT uq_well_formations UNIQUE (well_id, formation_id, top_depth)
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_well_formations_well ON well_formations(well_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_well_formations_formation ON well_formations(formation_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_well_formations_depth ON well_formations(well_id, top_depth, bottom_depth)`;

    // Ensure UNIQUE(well_id, formation_id, top_depth) constraint exists if table already existed
    await sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_well_formations') THEN
          DELETE FROM well_formations a USING well_formations b
          WHERE a.id > b.id AND a.well_id = b.well_id AND a.formation_id = b.formation_id AND a.top_depth = b.top_depth;
          ALTER TABLE well_formations ADD CONSTRAINT uq_well_formations UNIQUE (well_id, formation_id, top_depth);
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `;

    // ── Well Trajectories ─────────────────────────────────────────────────────
    await sql`
      CREATE TABLE IF NOT EXISTS well_trajectories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        well_id UUID NOT NULL REFERENCES wells(id) ON DELETE CASCADE,
        measured_depth NUMERIC NOT NULL,
        tvd NUMERIC,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        inclination NUMERIC,
        azimuth NUMERIC,
        trajectory_point GEOGRAPHY(Point, 4326),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_well_trajectories UNIQUE (well_id, measured_depth)
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_trajectories_well ON well_trajectories(well_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_trajectories_well_md ON well_trajectories(well_id, measured_depth)`;

    // Ensure UNIQUE(well_id, measured_depth) constraint exists if table already existed
    await sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_well_trajectories') THEN
          DELETE FROM well_trajectories a USING well_trajectories b
          WHERE a.id > b.id AND a.well_id = b.well_id AND a.measured_depth = b.measured_depth;
          ALTER TABLE well_trajectories ADD CONSTRAINT uq_well_trajectories UNIQUE (well_id, measured_depth);
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `;

    // FK: wells.current_formation_id → formations
    await sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_wells_current_formation') THEN
          ALTER TABLE wells ADD CONSTRAINT fk_wells_current_formation
            FOREIGN KEY (current_formation_id) REFERENCES formations(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `;

    // ── Drilling Parameters ───────────────────────────────────────────────────
    await sql`
      CREATE TABLE IF NOT EXISTS drilling_parameters (
        id BIGSERIAL PRIMARY KEY,
        well_id UUID NOT NULL REFERENCES wells(id) ON DELETE CASCADE,
        timestamp TIMESTAMPTZ NOT NULL,
        depth NUMERIC NOT NULL,
        wob NUMERIC,
        rpm NUMERIC,
        torque NUMERIC,
        rop NUMERIC,
        mud_weight NUMERIC,
        mud_flow_rate NUMERIC,
        standpipe_pressure NUMERIC,
        annular_pressure NUMERIC,
        hook_load NUMERIC,
        additional_parameters JSONB DEFAULT '{}'
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_parameters_well_depth ON drilling_parameters(well_id, depth)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_parameters_well_timestamp ON drilling_parameters(well_id, timestamp)`;

    // ── Documents ─────────────────────────────────────────────────────────────
    await sql`
      CREATE TABLE IF NOT EXISTS documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        well_id UUID REFERENCES wells(id),
        document_type VARCHAR(100) DEFAULT 'other',
        original_filename TEXT,
        file_uri TEXT NOT NULL,
        document_date DATE,
        version INTEGER DEFAULT 1,
        ocr_status VARCHAR(50) DEFAULT 'pending',
        processing_status VARCHAR(50) DEFAULT 'pending',
        checksum TEXT,
        uploaded_by UUID REFERENCES users(id),
        page_count INTEGER,
        text_length INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_documents_well ON documents(well_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(processing_status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type)`;

    // ── Drilling Events ───────────────────────────────────────────────────────
    await sql`
      CREATE TABLE IF NOT EXISTS drilling_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        well_id UUID NOT NULL REFERENCES wells(id),
        formation_id UUID REFERENCES formations(id),
        depth NUMERIC NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        severity VARCHAR(30) DEFAULT 'medium',
        description TEXT,
        start_time TIMESTAMPTZ,
        end_time TIMESTAMPTZ,
        source_document_id UUID,
        confidence NUMERIC,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_events_well ON drilling_events(well_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_events_type ON drilling_events(event_type)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_events_well_depth ON drilling_events(well_id, depth)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_events_severity ON drilling_events(severity)`;

    await sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_events_source_document') THEN
          ALTER TABLE drilling_events ADD CONSTRAINT fk_events_source_document
            FOREIGN KEY (source_document_id) REFERENCES documents(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `;

    // ── Mitigations ───────────────────────────────────────────────────────────
    await sql`
      CREATE TABLE IF NOT EXISTS mitigations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id UUID NOT NULL REFERENCES drilling_events(id) ON DELETE CASCADE,
        action TEXT NOT NULL,
        outcome TEXT,
        notes TEXT,
        source_document_id UUID,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_mitigations_event ON mitigations(event_id)`;

    await sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_mitigations_source_document') THEN
          ALTER TABLE mitigations ADD CONSTRAINT fk_mitigations_source_document
            FOREIGN KEY (source_document_id) REFERENCES documents(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `;

    // ── Document Chunks ───────────────────────────────────────────────────────
    await sql`
      CREATE TABLE IF NOT EXISTS document_chunks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        page INTEGER,
        section TEXT,
        chunk_index INTEGER,
        text TEXT NOT NULL,
        confidence NUMERIC,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_chunks_document ON document_chunks(document_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_chunks_section ON document_chunks(section)`;

    // ── Extracted Entities ────────────────────────────────────────────────────
    await sql`
      CREATE TABLE IF NOT EXISTS extracted_entities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        entity_type VARCHAR(100),
        value TEXT,
        normalized_value TEXT,
        confidence NUMERIC,
        page INTEGER,
        source_location TEXT,
        metadata JSONB DEFAULT '{}'
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_entities_document ON extracted_entities(document_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_entities_type ON extracted_entities(entity_type)`;

    // ── Risk Predictions ──────────────────────────────────────────────────────
    await sql`
      CREATE TABLE IF NOT EXISTS risk_predictions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        well_id UUID NOT NULL REFERENCES wells(id),
        depth NUMERIC,
        depth_bucket INTEGER,
        risk_type VARCHAR(100) NOT NULL,
        score NUMERIC NOT NULL,
        risk_level VARCHAR(30) NOT NULL,
        depth_range JSONB,
        evidence_refs JSONB DEFAULT '[]',
        model_version VARCHAR(100),
        explanation TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`ALTER TABLE risk_predictions ADD COLUMN IF NOT EXISTS depth_bucket INTEGER`;
    await sql`UPDATE risk_predictions SET depth_bucket = floor(depth / 25)::integer WHERE depth_bucket IS NULL AND depth IS NOT NULL`;

    // Dedup + unique index — only run if the index doesn't already exist
    await sql`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE indexname = 'uq_risk_pred_bucket'
        ) THEN
          UPDATE alerts SET risk_prediction_id = NULL
          WHERE risk_prediction_id IN (
            SELECT a.id FROM risk_predictions a
            INNER JOIN risk_predictions b ON
              a.ctid > b.ctid AND
              a.well_id = b.well_id AND
              a.risk_type = b.risk_type AND
              floor(a.depth / 25) = floor(b.depth / 25)
          );
          DELETE FROM risk_predictions a USING risk_predictions b
          WHERE a.ctid > b.ctid
            AND a.well_id = b.well_id
            AND a.risk_type = b.risk_type
            AND floor(a.depth / 25) = floor(b.depth / 25);
          CREATE UNIQUE INDEX uq_risk_pred_bucket ON risk_predictions(well_id, risk_type, depth_bucket);
        END IF;
      END $$
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_risks_well ON risk_predictions(well_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_risks_type ON risk_predictions(risk_type)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_risks_level ON risk_predictions(risk_level)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_risks_well_depth ON risk_predictions(well_id, depth)`;

    // ── Alerts ────────────────────────────────────────────────────────────────
    await sql`
      CREATE TABLE IF NOT EXISTS alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        well_id UUID NOT NULL REFERENCES wells(id),
        risk_prediction_id UUID REFERENCES risk_predictions(id),
        risk_type VARCHAR(100),
        severity VARCHAR(30) NOT NULL,
        message TEXT NOT NULL,
        evidence_refs JSONB DEFAULT '[]',
        status VARCHAR(30) DEFAULT 'generated',
        acknowledged_by UUID REFERENCES users(id),
        generated_at TIMESTAMPTZ DEFAULT NOW(),
        acknowledged_at TIMESTAMPTZ,
        resolved_at TIMESTAMPTZ,
        dedupe_key VARCHAR(255),
        score NUMERIC,
        occurrence_count INTEGER DEFAULT 1,
        first_seen_depth NUMERIC,
        last_seen_depth NUMERIC,
        last_seen_at TIMESTAMPTZ DEFAULT NOW(),
        parameter_snapshot JSONB DEFAULT '{}',
        thresholds JSONB DEFAULT '{}',
        feedback VARCHAR(50) DEFAULT NULL,
        feedback_by UUID REFERENCES users(id),
        feedback_at TIMESTAMPTZ
      )
    `;
    await sql`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS dedupe_key VARCHAR(255)`;
    await sql`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS score NUMERIC`;
    await sql`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS occurrence_count INTEGER DEFAULT 1`;
    await sql`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS first_seen_depth NUMERIC`;
    await sql`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS last_seen_depth NUMERIC`;
    await sql`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW()`;
    await sql`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS parameter_snapshot JSONB DEFAULT '{}'`;
    await sql`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS thresholds JSONB DEFAULT '{}'`;
    await sql`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS feedback VARCHAR(50) DEFAULT NULL`;
    await sql`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS feedback_by UUID REFERENCES users(id)`;
    await sql`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS feedback_at TIMESTAMPTZ`;

    await sql`CREATE INDEX IF NOT EXISTS idx_alerts_well ON alerts(well_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_alerts_dedupe_key ON alerts(dedupe_key)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_alerts_feedback ON alerts(feedback)`;

    // ── Audit Logs ────────────────────────────────────────────────────────────
    await sql`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id BIGSERIAL PRIMARY KEY,
        user_id UUID REFERENCES users(id),
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(100),
        resource_id UUID,
        old_data JSONB,
        new_data JSONB,
        ip_address INET,
        user_agent TEXT,
        timestamp TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type, resource_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action)`;

    // ── Triggers ──────────────────────────────────────────────────────────────
    await sql`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `;

    await sql`DROP TRIGGER IF EXISTS update_users_updated_at ON users`;
    await sql`
      CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    `;

    await sql`DROP TRIGGER IF EXISTS update_wells_updated_at ON wells`;
    await sql`
      CREATE TRIGGER update_wells_updated_at
        BEFORE UPDATE ON wells
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    `;

    await sql`
      CREATE OR REPLACE FUNCTION update_well_location()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `;

    await sql`DROP TRIGGER IF EXISTS set_well_location ON wells`;
    await sql`
      CREATE TRIGGER set_well_location
        BEFORE INSERT OR UPDATE OF latitude, longitude ON wells
        FOR EACH ROW EXECUTE FUNCTION update_well_location()
    `;

    await sql`
      CREATE OR REPLACE FUNCTION update_trajectory_point()
      RETURNS TRIGGER AS $$
      BEGIN
          IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
              NEW.trajectory_point = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `;

    await sql`DROP TRIGGER IF EXISTS set_trajectory_point ON well_trajectories`;
    await sql`
      CREATE TRIGGER set_trajectory_point
        BEFORE INSERT OR UPDATE OF latitude, longitude ON well_trajectories
        FOR EACH ROW EXECUTE FUNCTION update_trajectory_point()
    `;

    // ── Seed Demo Data (idempotent — ON CONFLICT DO NOTHING) ─────────────────

    // Demo Users
    await sql`
      INSERT INTO users (id, name, email, password_hash, role, status) VALUES
        ('a1000000-0000-0000-0000-000000000001', 'Rajesh Kumar', 'rajesh.kumar@ongc.demo', '$2a$10$rJxGfkY8LzOkXz3v5QfQKeCPvMgSfKvXyZ1dN8Q4r2wVT7sIU3jhK', 'DRILLING_ENGINEER', 'active'),
        ('a1000000-0000-0000-0000-000000000002', 'Priya Sharma', 'priya.sharma@ongc.demo', '$2a$10$rJxGfkY8LzOkXz3v5QfQKeCPvMgSfKvXyZ1dN8Q4r2wVT7sIU3jhK', 'SUPERVISOR', 'active'),
        ('a1000000-0000-0000-0000-000000000003', 'Amit Patel', 'amit.patel@ongc.demo', '$2a$10$rJxGfkY8LzOkXz3v5QfQKeCPvMgSfKvXyZ1dN8Q4r2wVT7sIU3jhK', 'DATA_ADMIN', 'active'),
        ('a1000000-0000-0000-0000-000000000004', 'Sneha Reddy', 'sneha.reddy@ongc.demo', '$2a$10$rJxGfkY8LzOkXz3v5QfQKeCPvMgSfKvXyZ1dN8Q4r2wVT7sIU3jhK', 'AI_ADMIN', 'active'),
        ('a1000000-0000-0000-0000-000000000005', 'Admin User', 'admin@nwis.demo', '$2a$10$rJxGfkY8LzOkXz3v5QfQKeCPvMgSfKvXyZ1dN8Q4r2wVT7sIU3jhK', 'SYSTEM_ADMIN', 'active')
      ON CONFLICT (email) DO NOTHING
    `;

    // Structural Zones (moved out of formations)
    await sql`
      INSERT INTO structural_zones (id, name, description, structural_type, geological_attributes) VALUES
        ('e9000000-0000-0000-0000-000000000001', 'Naga Thrust Zone', 'Structurally complex belt with high tectonic stress, abnormal pore pressure, and active thrust faulting', 'thrust_zone', '{"tectonic": "thrust_zone", "known_issues": ["kick", "well_control", "high_pressure"]}')
      ON CONFLICT (name) DO NOTHING
    `;

    // Formations & Wells (Only seed if database has no wells)
    const existingWellsCount = await sql`SELECT count(*) FROM wells`;
    if (parseInt(existingWellsCount[0].count, 10) === 0) {
      logger.info('Database has no wells. Running initial seed...');
      await sql`
        INSERT INTO formations (id, name, description, geological_attributes) VALUES
        ('f1000000-0000-0000-0000-000000000002', 'Girujan Clay', 'Upper Miocene mottled claystone and mudstone. Regional seal/cap rock conformably overlying Tipam Sandstone', '{"age": "Upper Miocene", "lithology": "claystone", "porosity_range": "5-10%", "cap_rock": true}'),
        ('f1000000-0000-0000-0000-000000000001', 'Tipam Sandstone', 'Upper-to-Middle Miocene massive sandstone with siltstone intercalations. Primary hydrocarbon reservoir', '{"age": "Upper Miocene", "lithology": "sandstone", "porosity_range": "15-25%", "permeability": "100-500 mD"}'),
        ('f1000000-0000-0000-0000-000000000003', 'Barail Group', 'Oligocene deltaic sandstones, carbonaceous shales, and coal seams. Major regional oil & gas producer', '{"age": "Oligocene", "lithology": "sandstone-shale-coal", "porosity_range": "10-20%"}'),
        ('f1000000-0000-0000-0000-000000000004', 'Kopili Formation', 'Eocene splintery carbonaceous shale, siltstone, and thin marls. High risk of overpressure, mud loss, and stuck pipe', '{"age": "Eocene", "lithology": "shale-limestone", "known_issues": ["mud_loss", "stuck_pipe"]}'),
        ('f1000000-0000-0000-0000-000000000005', 'Sylhet Limestone', 'Eocene shelf carbonate / fossiliferous limestone. Prone to vugular voids, caves, and severe lost circulation', '{"age": "Eocene", "lithology": "limestone", "known_issues": ["lost_circulation", "mud_loss"]}')
      ON CONFLICT (name) DO NOTHING
    `;

    // Wells (10 Wells across Lakwa, Rudrasagar, Geleki, Digboi, Naharkatiya)
    await sql`
      INSERT INTO wells (id, well_name, field, status, latitude, longitude, spud_date, total_depth, current_depth, current_formation_id, metadata) VALUES
        ('b1000000-0000-0000-0000-000000000001', 'NWIS-DEMO-01', 'Lakwa Field', 'active', 26.7800, 94.2100, '2026-08-15', 3300, 2850, 'f1000000-0000-0000-0000-000000000004', '{"target_formation": "Kopili Formation"}'),
        ('b1000000-0000-0000-0000-000000000002', 'LKW-A-102', 'Lakwa Field', 'completed', 26.7850, 94.2200, '2024-03-10', 3200, 3200, 'f1000000-0000-0000-0000-000000000005', '{}'),
        ('b1000000-0000-0000-0000-000000000003', 'LKW-B-201', 'Lakwa Field', 'completed', 26.7750, 94.2050, '2023-11-05', 3050, 3050, 'f1000000-0000-0000-0000-000000000005', '{}'),
        ('b1000000-0000-0000-0000-000000000004', 'LKW-C-305', 'Lakwa Field', 'completed', 26.7900, 94.2250, '2025-01-20', 2900, 2900, 'f1000000-0000-0000-0000-000000000004', '{}'),
        ('b1000000-0000-0000-0000-000000000005', 'RDL-A-401', 'Rudrasagar Field', 'completed', 26.8050, 94.1900, '2024-06-15', 3400, 3400, 'f1000000-0000-0000-0000-000000000005', '{"structural_zone": "Naga Thrust Zone"}'),
        ('b1000000-0000-0000-0000-000000000006', 'RDL-B-502', 'Rudrasagar Field', 'completed', 26.8100, 94.1950, '2023-08-20', 3150, 3150, 'f1000000-0000-0000-0000-000000000005', '{}'),
        ('b1000000-0000-0000-0000-000000000007', 'GEL-A-110', 'Geleki Field', 'completed', 26.7500, 94.1700, '2022-05-10', 3500, 3500, 'f1000000-0000-0000-0000-000000000005', '{"structural_zone": "Naga Thrust Zone"}'),
        ('b1000000-0000-0000-0000-000000000008', 'GEL-B-115', 'Geleki Field', 'suspended', 26.7450, 94.1650, '2024-09-01', 2600, 2600, 'f1000000-0000-0000-0000-000000000004', '{}'),
        ('b1000000-0000-0000-0000-000000000009', 'DGB-A-201', 'Digboi Field', 'active', 27.3900, 95.6200, '2026-07-01', 2000, 1800, 'f1000000-0000-0000-0000-000000000001', '{}'),
        ('b1000000-0000-0000-0000-000000000010', 'NHK-A-101', 'Naharkatiya Field', 'completed', 27.2800, 95.3400, '2025-02-15', 3000, 3000, 'f1000000-0000-0000-0000-000000000004', '{}')
      ON CONFLICT (well_name) DO NOTHING
    `;

    // Well-Formation Tops (Ordered stratigraphic column for ALL 10 WELLS)
    // Stratigraphic sequence from shallow to deep:
    //   1. Girujan Clay (0m - ~750m)
    //   2. Tipam Sandstone (~750m - ~1400m)
    //   3. Barail Group (~1400m - ~2200m)
    //   4. Kopili Formation (~2200m - ~3000m) -> 2850m MD on NWIS-DEMO-01 is safely in Kopili!
    //   5. Sylhet Limestone (~3000m - 3500m)
    await sql`
      INSERT INTO well_formations (well_id, formation_id, top_depth, bottom_depth, metadata) VALUES
        -- 1. NWIS-DEMO-01 (active, currently at 2850m in Kopili Formation)
        ('b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000002', 0,    750,  '{"notes": "Girujan Clay surface to cap rock"}'),
        ('b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 750,  1400, '{"notes": "Tipam Sandstone reservoir section"}'),
        ('b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000003', 1400, 2200, '{"notes": "Barail Group coal-bearing deltaic sequence"}'),
        ('b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000004', 2200, 2950, '{"notes": "Kopili Formation — active drilling target at 2850m"}'),
        ('b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000005', 2950, 3300, '{"notes": "Sylhet Limestone planned basement entry"}'),

        -- 2. LKW-A-102 (completed at 3200m)
        ('b1000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000002', 0,    780,  '{"notes": "Girujan Clay"}'),
        ('b1000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000001', 780,  1420, '{"notes": "Tipam Sandstone"}'),
        ('b1000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000003', 1420, 2250, '{"notes": "Barail Group"}'),
        ('b1000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000004', 2250, 3000, '{"notes": "Kopili Formation — documented mud loss & stuck pipe"}'),
        ('b1000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000005', 3000, 3200, '{"notes": "Sylhet Limestone — total fluid loss zone"}'),

        -- 3. LKW-B-201 (completed at 3050m)
        ('b1000000-0000-0000-0000-000000000003', 'f1000000-0000-0000-0000-000000000002', 0,    760,  '{"notes": "Girujan Clay"}'),
        ('b1000000-0000-0000-0000-000000000003', 'f1000000-0000-0000-0000-000000000001', 760,  1380, '{"notes": "Tipam Sandstone"}'),
        ('b1000000-0000-0000-0000-000000000003', 'f1000000-0000-0000-0000-000000000003', 1380, 2180, '{"notes": "Barail Group"}'),
        ('b1000000-0000-0000-0000-000000000003', 'f1000000-0000-0000-0000-000000000004', 2180, 2950, '{"notes": "Kopili Formation — gas cut and mud loss"}'),
        ('b1000000-0000-0000-0000-000000000003', 'f1000000-0000-0000-0000-000000000005', 2950, 3050, '{"notes": "Sylhet Limestone"}'),

        -- 4. LKW-C-305 (completed at 2900m)
        ('b1000000-0000-0000-0000-000000000004', 'f1000000-0000-0000-0000-000000000002', 0,    790,  '{"notes": "Girujan Clay"}'),
        ('b1000000-0000-0000-0000-000000000004', 'f1000000-0000-0000-0000-000000000001', 790,  1450, '{"notes": "Tipam Sandstone"}'),
        ('b1000000-0000-0000-0000-000000000004', 'f1000000-0000-0000-0000-000000000003', 1450, 2350, '{"notes": "Barail Group"}'),
        ('b1000000-0000-0000-0000-000000000004', 'f1000000-0000-0000-0000-000000000004', 2350, 2900, '{"notes": "Kopili Formation — bottom of hole"}'),

        -- 5. RDL-A-401 (completed at 3400m; crosses into Naga Thrust Zone)
        ('b1000000-0000-0000-0000-000000000005', 'f1000000-0000-0000-0000-000000000002', 0,    750,  '{"notes": "Girujan Clay"}'),
        ('b1000000-0000-0000-0000-000000000005', 'f1000000-0000-0000-0000-000000000001', 750,  1380, '{"notes": "Tipam Sandstone"}'),
        ('b1000000-0000-0000-0000-000000000005', 'f1000000-0000-0000-0000-000000000003', 1380, 2150, '{"notes": "Barail Group"}'),
        ('b1000000-0000-0000-0000-000000000005', 'f1000000-0000-0000-0000-000000000004', 2150, 2950, '{"notes": "Kopili Formation"}'),
        ('b1000000-0000-0000-0000-000000000005', 'f1000000-0000-0000-0000-000000000005', 2950, 3400, '{"structural_zone": "Naga Thrust Zone", "notes": "Sylhet Limestone intersecting Naga Thrust Zone at 3100m"}'),

        -- 6. RDL-B-502 (completed at 3150m)
        ('b1000000-0000-0000-0000-000000000006', 'f1000000-0000-0000-0000-000000000002', 0,    770,  '{"notes": "Girujan Clay"}'),
        ('b1000000-0000-0000-0000-000000000006', 'f1000000-0000-0000-0000-000000000001', 770,  1400, '{"notes": "Tipam Sandstone"}'),
        ('b1000000-0000-0000-0000-000000000006', 'f1000000-0000-0000-0000-000000000003', 1400, 2200, '{"notes": "Barail Group"}'),
        ('b1000000-0000-0000-0000-000000000006', 'f1000000-0000-0000-0000-000000000004', 2200, 3000, '{"notes": "Kopili Formation"}'),
        ('b1000000-0000-0000-0000-000000000006', 'f1000000-0000-0000-0000-000000000005', 3000, 3150, '{"notes": "Sylhet Limestone"}'),

        -- 7. GEL-A-110 (completed at 3500m; deepest Geleki well)
        ('b1000000-0000-0000-0000-000000000007', 'f1000000-0000-0000-0000-000000000002', 0,    810,  '{"notes": "Girujan Clay"}'),
        ('b1000000-0000-0000-0000-000000000007', 'f1000000-0000-0000-0000-000000000001', 810,  1450, '{"notes": "Tipam Sandstone"}'),
        ('b1000000-0000-0000-0000-000000000007', 'f1000000-0000-0000-0000-000000000003', 1450, 2250, '{"notes": "Barail Group"}'),
        ('b1000000-0000-0000-0000-000000000007', 'f1000000-0000-0000-0000-000000000004', 2250, 3050, '{"notes": "Kopili Formation"}'),
        ('b1000000-0000-0000-0000-000000000007', 'f1000000-0000-0000-0000-000000000005', 3050, 3500, '{"structural_zone": "Naga Thrust Zone", "notes": "Sylhet Limestone intersecting Naga Thrust Zone at 3250m"}'),

        -- 8. GEL-B-115 (suspended at 2600m)
        ('b1000000-0000-0000-0000-000000000008', 'f1000000-0000-0000-0000-000000000002', 0,    790,  '{"notes": "Girujan Clay"}'),
        ('b1000000-0000-0000-0000-000000000008', 'f1000000-0000-0000-0000-000000000001', 790,  1410, '{"notes": "Tipam Sandstone"}'),
        ('b1000000-0000-0000-0000-000000000008', 'f1000000-0000-0000-0000-000000000003', 1410, 2400, '{"notes": "Barail Group"}'),
        ('b1000000-0000-0000-0000-000000000008', 'f1000000-0000-0000-0000-000000000004', 2400, 2600, '{"notes": "Kopili Formation — well suspended"}'),

        -- 9. DGB-A-201 (active, Digboi field, surface to Tipam oil pool)
        ('b1000000-0000-0000-0000-000000000009', 'f1000000-0000-0000-0000-000000000002', 0,    650,  '{"notes": "Girujan Clay cap rock"}'),
        ('b1000000-0000-0000-0000-000000000009', 'f1000000-0000-0000-0000-000000000001', 650,  1800, '{"notes": "Tipam Sandstone — Digboi primary pay sand"}'),

        -- 10. NHK-A-101 (completed at 3000m)
        ('b1000000-0000-0000-0000-000000000010', 'f1000000-0000-0000-0000-000000000002', 0,    800,  '{"notes": "Girujan Clay"}'),
        ('b1000000-0000-0000-0000-000000000010', 'f1000000-0000-0000-0000-000000000001', 800,  1400, '{"notes": "Tipam Sandstone"}'),
        ('b1000000-0000-0000-0000-000000000010', 'f1000000-0000-0000-0000-000000000003', 1400, 2200, '{"notes": "Barail Group"}'),
        ('b1000000-0000-0000-0000-000000000010', 'f1000000-0000-0000-0000-000000000004', 2200, 3000, '{"notes": "Kopili Formation target horizon"}')
      ON CONFLICT (well_id, formation_id, top_depth) DO NOTHING
    `;

    // Well Trajectories for ALL 10 WELLS (Idempotent seed)
    await sql`
      INSERT INTO well_trajectories (well_id, measured_depth, tvd, latitude, longitude, inclination, azimuth, trajectory_point) VALUES
        -- 1. NWIS-DEMO-01
        ('b1000000-0000-0000-0000-000000000001', 0, 0, 26.7800, 94.2100, 0, 0, ST_SetSRID(ST_MakePoint(94.2100, 26.7800), 4326)),
        ('b1000000-0000-0000-0000-000000000001', 750, 750, 26.7801, 94.2102, 0.5, 45, ST_SetSRID(ST_MakePoint(94.2102, 26.7801), 4326)),
        ('b1000000-0000-0000-0000-000000000001', 1400, 1398, 26.7805, 94.2108, 2.2, 52, ST_SetSRID(ST_MakePoint(94.2108, 26.7805), 4326)),
        ('b1000000-0000-0000-0000-000000000001', 2200, 2192, 26.7812, 94.2119, 5.8, 55, ST_SetSRID(ST_MakePoint(94.2119, 26.7812), 4326)),
        ('b1000000-0000-0000-0000-000000000001', 2850, 2835, 26.7820, 94.2132, 9.4, 58, ST_SetSRID(ST_MakePoint(94.2132, 26.7820), 4326)),

        -- 2. LKW-A-102
        ('b1000000-0000-0000-0000-000000000002', 0, 0, 26.7850, 94.2200, 0, 0, ST_SetSRID(ST_MakePoint(94.2200, 26.7850), 4326)),
        ('b1000000-0000-0000-0000-000000000002', 1500, 1499, 26.7852, 94.2203, 1.1, 90, ST_SetSRID(ST_MakePoint(94.2203, 26.7852), 4326)),
        ('b1000000-0000-0000-0000-000000000002', 3200, 3192, 26.7858, 94.2212, 3.5, 95, ST_SetSRID(ST_MakePoint(94.2212, 26.7858), 4326)),

        -- 3. LKW-B-201
        ('b1000000-0000-0000-0000-000000000003', 0, 0, 26.7750, 94.2050, 0, 0, ST_SetSRID(ST_MakePoint(94.2050, 26.7750), 4326)),
        ('b1000000-0000-0000-0000-000000000003', 1500, 1498, 26.7753, 94.2054, 1.8, 120, ST_SetSRID(ST_MakePoint(94.2054, 26.7753), 4326)),
        ('b1000000-0000-0000-0000-000000000003', 3050, 3042, 26.7759, 94.2062, 4.2, 125, ST_SetSRID(ST_MakePoint(94.2062, 26.7759), 4326)),

        -- 4. LKW-C-305
        ('b1000000-0000-0000-0000-000000000004', 0, 0, 26.7900, 94.2250, 0, 0, ST_SetSRID(ST_MakePoint(94.2250, 26.7900), 4326)),
        ('b1000000-0000-0000-0000-000000000004', 1500, 1500, 26.7901, 94.2251, 0.4, 30, ST_SetSRID(ST_MakePoint(94.2251, 26.7901), 4326)),
        ('b1000000-0000-0000-0000-000000000004', 2900, 2898, 26.7903, 94.2254, 1.2, 35, ST_SetSRID(ST_MakePoint(94.2254, 26.7903), 4326)),

        -- 5. RDL-A-401
        ('b1000000-0000-0000-0000-000000000005', 0, 0, 26.8050, 94.1900, 0, 0, ST_SetSRID(ST_MakePoint(94.1900, 26.8050), 4326)),
        ('b1000000-0000-0000-0000-000000000005', 1700, 1696, 26.8055, 94.1908, 3.2, 80, ST_SetSRID(ST_MakePoint(94.1908, 26.8055), 4326)),
        ('b1000000-0000-0000-0000-000000000005', 3400, 3385, 26.8065, 94.1922, 6.8, 85, ST_SetSRID(ST_MakePoint(94.1922, 26.8065), 4326)),

        -- 6. RDL-B-502
        ('b1000000-0000-0000-0000-000000000006', 0, 0, 26.8100, 94.1950, 0, 0, ST_SetSRID(ST_MakePoint(94.1950, 26.8100), 4326)),
        ('b1000000-0000-0000-0000-000000000006', 1600, 1599, 26.8103, 94.1954, 1.5, 60, ST_SetSRID(ST_MakePoint(94.1954, 26.8103), 4326)),
        ('b1000000-0000-0000-0000-000000000006', 3150, 3144, 26.8108, 94.1962, 3.4, 65, ST_SetSRID(ST_MakePoint(94.1962, 26.8108), 4326)),

        -- 7. GEL-A-110
        ('b1000000-0000-0000-0000-000000000007', 0, 0, 26.7500, 94.1700, 0, 0, ST_SetSRID(ST_MakePoint(94.1700, 26.7500), 4326)),
        ('b1000000-0000-0000-0000-000000000007', 1800, 1795, 26.7506, 94.1709, 3.6, 110, ST_SetSRID(ST_MakePoint(94.1709, 26.7506), 4326)),
        ('b1000000-0000-0000-0000-000000000007', 3500, 3480, 26.7516, 94.1726, 7.5, 115, ST_SetSRID(ST_MakePoint(94.1726, 26.7516), 4326)),

        -- 8. GEL-B-115
        ('b1000000-0000-0000-0000-000000000008', 0, 0, 26.7450, 94.1650, 0, 0, ST_SetSRID(ST_MakePoint(94.1650, 26.7450), 4326)),
        ('b1000000-0000-0000-0000-000000000008', 1300, 1299, 26.7452, 94.1653, 1.2, 45, ST_SetSRID(ST_MakePoint(94.1653, 26.7452), 4326)),
        ('b1000000-0000-0000-0000-000000000008', 2600, 2595, 26.7456, 94.1660, 2.9, 50, ST_SetSRID(ST_MakePoint(94.1660, 26.7456), 4326)),

        -- 9. DGB-A-201
        ('b1000000-0000-0000-0000-000000000009', 0, 0, 27.3900, 95.6200, 0, 0, ST_SetSRID(ST_MakePoint(95.6200, 27.3900), 4326)),
        ('b1000000-0000-0000-0000-000000000009', 900, 899, 27.3902, 95.6204, 1.8, 45, ST_SetSRID(ST_MakePoint(95.6204, 27.3902), 4326)),
        ('b1000000-0000-0000-0000-000000000009', 1800, 1794, 27.3907, 95.6212, 4.5, 50, ST_SetSRID(ST_MakePoint(95.6212, 27.3907), 4326)),

        -- 10. NHK-A-101
        ('b1000000-0000-0000-0000-000000000010', 0, 0, 27.2800, 95.3400, 0, 0, ST_SetSRID(ST_MakePoint(95.3400, 27.2800), 4326)),
        ('b1000000-0000-0000-0000-000000000010', 1500, 1498, 26.2804, 95.3406, 2.1, 70, ST_SetSRID(ST_MakePoint(95.3406, 26.2804), 4326)),
        ('b1000000-0000-0000-0000-000000000010', 3000, 2991, 27.2812, 95.3418, 5.2, 75, ST_SetSRID(ST_MakePoint(95.3418, 27.2812), 4326))
      ON CONFLICT (well_id, measured_depth) DO NOTHING
    `;

    // Drilling Events
    await sql`
      INSERT INTO drilling_events (id, well_id, formation_id, depth, event_type, severity, description, start_time, end_time, confidence, metadata) VALUES
        ('e1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000004', 2810, 'mud_loss', 'high', 'Severe mud loss of 45 bbl/hr encountered while drilling in Kopili Formation. Losses started at 2810m MD.', '2024-05-15 06:30:00+05:30', '2024-05-15 14:00:00+05:30', 0.94, '{"source": "daily_report"}'),
        ('e1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000004', 2870, 'stuck_pipe', 'high', 'Drill pipe stuck at 2870m. Differential sticking suspected due to thick mud cake in Kopili shale.', '2024-05-18 10:15:00+05:30', '2024-05-19 02:00:00+05:30', 0.91, '{"source": "incident_report"}'),
        ('e1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000005', 2980, 'lost_circulation', 'critical', 'Total lost circulation in Sylhet Limestone. All returns lost at 2980m.', '2024-06-02 03:45:00+05:30', '2024-06-03 18:00:00+05:30', 0.97, '{"source": "incident_report"}'),
        ('e1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000004', 2650, 'tight_hole', 'medium', 'Tight hole conditions encountered while tripping at 2650m in upper Kopili.', '2024-05-10 08:00:00+05:30', '2024-05-10 12:00:00+05:30', 0.85, '{"source": "daily_report"}'),
        ('e1000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000003', 'f1000000-0000-0000-0000-000000000004', 2845, 'mud_loss', 'critical', 'Severe mud loss exceeding 60 bbl/hr at 2845m in fractured Kopili Formation.', '2024-02-20 07:00:00+05:30', '2024-02-21 06:00:00+05:30', 0.96, '{"source": "daily_report"}'),
        ('e1000000-0000-0000-0000-000000000006', 'b1000000-0000-0000-0000-000000000003', 'f1000000-0000-0000-0000-000000000004', 2780, 'gas_cut', 'medium', 'Gas-cut mud observed at 2780m. Background gas increased from 0.5% to 4.2%.', '2024-02-15 14:30:00+05:30', '2024-02-15 18:00:00+05:30', 0.88, '{"source": "daily_report"}'),
        ('e1000000-0000-0000-0000-000000000007', 'b1000000-0000-0000-0000-000000000003', 'f1000000-0000-0000-0000-000000000003', 2300, 'wellbore_instability', 'medium', 'Cavings observed in Barail shale section. Hole cleaning issues from 2200-2350m.', '2024-01-28 09:00:00+05:30', '2024-01-29 12:00:00+05:30', 0.82, '{"source": "daily_report"}'),
        ('e1000000-0000-0000-0000-000000000008', 'b1000000-0000-0000-0000-000000000005', 'f1000000-0000-0000-0000-000000000005', 3100, 'kick', 'critical', 'Gas kick encountered at 3100m in Sylhet Limestone near Naga Thrust Zone. Well shut-in applied.', '2024-09-10 02:30:00+05:30', '2024-09-10 14:00:00+05:30', 0.98, '{"structural_zone": "Naga Thrust Zone"}'),
        ('e1000000-0000-0000-0000-000000000009', 'b1000000-0000-0000-0000-000000000005', 'f1000000-0000-0000-0000-000000000004', 2900, 'mud_loss', 'high', 'Partial mud loss of 30 bbl/hr at 2900m transitioning into Kopili Formation.', '2024-08-25 11:00:00+05:30', '2024-08-25 20:00:00+05:30', 0.90, '{"source": "daily_report"}'),
        ('e1000000-0000-0000-0000-000000000010', 'b1000000-0000-0000-0000-000000000007', 'f1000000-0000-0000-0000-000000000005', 3250, 'well_control', 'critical', 'Well control situation at 3250m in Sylhet Limestone near Naga Thrust fault plane. BOP activated.', '2022-09-15 01:00:00+05:30', '2022-09-16 06:00:00+05:30', 0.99, '{"structural_zone": "Naga Thrust Zone"}'),
        ('e1000000-0000-0000-0000-000000000011', 'b1000000-0000-0000-0000-000000000007', 'f1000000-0000-0000-0000-000000000004', 2750, 'mud_loss', 'high', 'Mud loss at Kopili entry point. LCM treatment required.', '2022-08-20 09:00:00+05:30', '2022-08-20 18:00:00+05:30', 0.87, '{"source": "daily_report"}')
      ON CONFLICT (id) DO NOTHING
    `;

    // Standardized Structured Evidence References: {well_id, event_id, document_id, page}
    const seedEvidenceRefs = JSON.stringify([
      {
        well_id: 'b1000000-0000-0000-0000-000000000002',
        event_id: 'e1000000-0000-0000-0000-000000000001',
        document_id: 'd1000000-0000-0000-0000-000000000002',
        page: 1,
      },
      {
        well_id: 'b1000000-0000-0000-0000-000000000003',
        event_id: 'e1000000-0000-0000-0000-000000000005',
        document_id: 'd1000000-0000-0000-0000-000000000003',
        page: 1,
      },
    ]);

    const seedStuckPipeRefs = JSON.stringify([
      {
        well_id: 'b1000000-0000-0000-0000-000000000002',
        event_id: 'e1000000-0000-0000-0000-000000000002',
        document_id: 'd1000000-0000-0000-0000-000000000006',
        page: 1,
      },
    ]);

    const seedGasCutRefs = JSON.stringify([
      {
        well_id: 'b1000000-0000-0000-0000-000000000003',
        event_id: 'e1000000-0000-0000-0000-000000000006',
        document_id: 'd1000000-0000-0000-0000-000000000001',
        page: 1,
      },
    ]);

    // Risk Predictions
    await sql`
      INSERT INTO risk_predictions (id, well_id, depth, depth_bucket, risk_type, score, risk_level, depth_range, evidence_refs, model_version, explanation) VALUES
        ('d1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 2850, 114, 'mud_loss', 0.82, 'high', '[2810, 2900]', ${seedEvidenceRefs}::jsonb, 'NWIS-Risk-v1', 'High risk of mud loss based on 2 nearby wells experiencing severe mud loss in Kopili Formation at similar depths (2810m and 2845m). Current torque trend is increasing, suggesting formation change.'),
        ('d1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 2850, 114, 'stuck_pipe', 0.58, 'medium', '[2850, 2920]', ${seedStuckPipeRefs}::jsonb, 'NWIS-Risk-v1', 'Medium risk of stuck pipe. LKW-A-102 experienced differential sticking at 2870m in same formation. Current drilling parameters show increasing WOB and decreasing ROP.'),
        ('d1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000001', 2850, 114, 'gas_cut', 0.45, 'medium', '[2780, 2850]', ${seedGasCutRefs}::jsonb, 'NWIS-Risk-v1', 'Moderate risk of gas-cut mud. LKW-B-201 encountered gas at 2780m in Kopili Formation.')
      ON CONFLICT (well_id, risk_type, depth_bucket) DO NOTHING
    `;

    // Alerts
    await sql`
      INSERT INTO alerts (id, well_id, risk_prediction_id, risk_type, severity, message, evidence_refs, status, generated_at) VALUES
        ('c1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'mud_loss', 'high', 'HIGH RISK: Mud loss probability 82% at current depth 2850m. Two nearby wells (LKW-A-102 and LKW-B-201) experienced severe mud loss in Kopili Formation between 2810-2845m. Recommend preparing LCM and reducing ROP.', ${seedEvidenceRefs}::jsonb, 'delivered', '2026-09-28 09:30:00+05:30'),
        ('c1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002', 'stuck_pipe', 'medium', 'MEDIUM RISK: Stuck pipe probability 58% approaching depth 2870m. LKW-A-102 experienced differential sticking at this depth. Monitor WOB and torque trends closely.', ${seedStuckPipeRefs}::jsonb, 'generated', '2026-09-28 09:35:00+05:30')
      ON CONFLICT (id) DO NOTHING
    `;

    // ── Migration: Convert legacy string evidence_refs to standard objects ───
    await sql`
      UPDATE alerts
      SET evidence_refs = (
        SELECT jsonb_agg(
          CASE
            WHEN jsonb_typeof(elem) = 'object' THEN elem
            WHEN jsonb_typeof(elem) = 'string' AND elem #>> '{}' LIKE '%:%' THEN
              jsonb_build_object(
                'well_id', split_part(elem #>> '{}', ':', 1),
                'event_id', split_part(elem #>> '{}', ':', 2),
                'document_id', NULL,
                'page', 1
              )
            ELSE jsonb_build_object('well_id', NULL, 'event_id', NULL, 'document_id', NULL, 'page', 1)
          END
        )
        FROM jsonb_array_elements(evidence_refs) AS elem
      )
      WHERE evidence_refs IS NOT NULL 
        AND jsonb_array_length(evidence_refs) > 0
        AND jsonb_typeof(evidence_refs->0) = 'string';
    `;

    await sql`
      UPDATE risk_predictions
      SET evidence_refs = (
        SELECT jsonb_agg(
          CASE
            WHEN jsonb_typeof(elem) = 'object' THEN elem
            WHEN jsonb_typeof(elem) = 'string' AND elem #>> '{}' LIKE '%:%' THEN
              jsonb_build_object(
                'well_id', split_part(elem #>> '{}', ':', 1),
                'event_id', split_part(elem #>> '{}', ':', 2),
                'document_id', NULL,
                'page', 1
              )
            ELSE jsonb_build_object('well_id', NULL, 'event_id', NULL, 'document_id', NULL, 'page', 1)
          END
        )
        FROM jsonb_array_elements(evidence_refs) AS elem
      )
      WHERE evidence_refs IS NOT NULL 
        AND jsonb_array_length(evidence_refs) > 0
        AND jsonb_typeof(evidence_refs->0) = 'string';
      `;
    }

    logger.info('✅ Database schema initialized successfully!');
  } catch (error) {
    logger.error({ err: error.message }, '❌ Error initializing database schema');
    throw error;
  }
}

if (require.main === module) {
  initDB()
    .then(() => {
      logger.info('Database schema migration finished successfully');
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err: err.message }, 'Database schema migration failed');
      process.exit(1);
    });
}

module.exports = initDB;
