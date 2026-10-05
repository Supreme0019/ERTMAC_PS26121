// =============================================================================
// NWIS Backend — AI Database Synchronization Script
//
// Reads documents, chunks, and extracted entities from the AI service Neon database
// and syncs them into the NWIS backend database with proper UUID foreign keys.
// =============================================================================

require('dotenv').config();
const path = require('path');
const { Client } = require('pg');

const BACKEND_DB_URL = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:YOUR_BACKEND_PASSWORD@ep-cool-mode-azhu0msn-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

const AI_DB_URL = process.env.AI_DATABASE_URL ||
  'postgresql://neondb_owner:YOUR_AI_PASSWORD@ep-rough-forest-b3gdcweh-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

async function syncAIData() {
  console.log('=============================================================================');
  console.log('  eRTMAC-NWIS — Synchronizing AI Data to Backend Database');
  console.log('=============================================================================');

  const backendClient = new Client({ connectionString: BACKEND_DB_URL });
  const aiClient = new Client({ connectionString: AI_DB_URL });

  try {
    await backendClient.connect();
    console.log(' Connected to NWIS backend database');

    await aiClient.connect();
    console.log(' Connected to AI service database');

    // ── Step 1: Ensure metadata column exists on backend documents ───────────
    console.log('\n--- Step 1: Schema Checks ---');
    await backendClient.query(`
      ALTER TABLE documents ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
    `);
    console.log(' Verified documents.metadata column exists');

    // ── Step 2: Load backend wells map ───────────────────────────────────────
    console.log('\n--- Step 2: Loading Backend Wells ---');
    const wellsRes = await backendClient.query('SELECT id, well_name FROM wells');
    const wellMap = new Map();
    for (const w of wellsRes.rows) {
      wellMap.set(w.well_name, w.id);
    }
    console.log(` Loaded ${wellMap.size} wells from backend`);

    // Get default uploader
    const userRes = await backendClient.query('SELECT id FROM users LIMIT 1');
    const uploaderId = userRes.rows[0]?.id || null;

    // ── Step 3: Fetch all documents from AI database ─────────────────────────
    console.log('\n--- Step 3: Fetching AI Documents ---');
    const aiDocsRes = await aiClient.query('SELECT * FROM documents ORDER BY id ASC');
    console.log(` Found ${aiDocsRes.rows.length} documents in AI database`);

    const aiToBackendDocMap = new Map(); // aiDoc.id -> backend doc UUID
    const syncedDocUuids = [];
    let docsUpdated = 0;
    let docsInserted = 0;

    for (const aiDoc of aiDocsRes.rows) {
      const wellName = aiDoc.well_id;
      const wellId = wellMap.get(wellName);
      if (!wellId) {
        console.warn(` No matching backend well found for ${wellName} (AI doc ID: ${aiDoc.id})`);
        continue;
      }

      const originalFilename = path.basename(aiDoc.file_uri);
      const fileUri = `data/reports/${originalFilename}`;
      const docMetadata = {
        ai_document_id: aiDoc.id,
        ocr_used: !!aiDoc.ocr_used,
        is_synthetic: !!aiDoc.is_synthetic,
        doc_type: aiDoc.doc_type,
      };

      // Check if document already exists for this well
      const existingDocRes = await backendClient.query(`
        SELECT id, original_filename FROM documents
        WHERE well_id = $1 AND (
          document_type = 'daily_drilling_report' OR
          original_filename LIKE $2
        )
        LIMIT 1
      `, [wellId, `${wellName}%`]);

      let backendDocId;

      if (existingDocRes.rows.length > 0) {
        // Update existing document with correct filename and AI metadata
        backendDocId = existingDocRes.rows[0].id;
        await backendClient.query(`
          UPDATE documents SET
            original_filename = $1,
            file_uri = $2,
            page_count = $3,
            ocr_status = 'completed',
            processing_status = 'completed',
            metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb
          WHERE id = $5
        `, [originalFilename, fileUri, aiDoc.pages || 5, JSON.stringify(docMetadata), backendDocId]);
        docsUpdated++;
      } else {
        // Insert new document (e.g. SYN-035, SYN-037)
        const insertRes = await backendClient.query(`
          INSERT INTO documents (
            well_id, document_type, original_filename, file_uri, document_date,
            ocr_status, processing_status, uploaded_by, page_count, metadata, created_at
          ) VALUES (
            $1, 'daily_drilling_report', $2, $3, '2026-08-15',
            'completed', 'completed', $4, $5, $6::jsonb, NOW()
          ) RETURNING id
        `, [wellId, originalFilename, fileUri, uploaderId, aiDoc.pages || 5, JSON.stringify(docMetadata)]);
        backendDocId = insertRes.rows[0].id;
        docsInserted++;
      }

      aiToBackendDocMap.set(aiDoc.id, { backendDocId, wellId, wellName });
      syncedDocUuids.push(backendDocId);
    }

    console.log(` Documents synchronized: ${docsUpdated} updated, ${docsInserted} inserted (Total: ${syncedDocUuids.length})`);

    // ── Step 4: Sync Document Chunks ─────────────────────────────────────────
    console.log('\n--- Step 4: Synchronizing Document Chunks ---');
    const aiChunksRes = await aiClient.query('SELECT * FROM document_chunks ORDER BY document_id, id ASC');
    console.log(` Found ${aiChunksRes.rows.length} chunks in AI database`);

    // Remove existing chunks for the synced documents to prevent duplicates
    if (syncedDocUuids.length > 0) {
      await backendClient.query(`
        DELETE FROM document_chunks WHERE document_id = ANY($1::uuid[])
      `, [syncedDocUuids]);
      console.log(' Cleared old/dummy chunks for synced documents');
    }

    let chunksInserted = 0;
    // Batch insert chunks
    const chunkBatchSize = 50;
    for (let i = 0; i < aiChunksRes.rows.length; i += chunkBatchSize) {
      const batch = aiChunksRes.rows.slice(i, i + chunkBatchSize);
      for (const c of batch) {
        const docInfo = aiToBackendDocMap.get(c.document_id);
        if (!docInfo) continue;

        const chunkMeta = {
          ai_chunk_id: c.id,
          well_name: docInfo.wellName,
        };

        const embStr = c.embedding ? (typeof c.embedding === 'string' ? c.embedding : JSON.stringify(c.embedding)) : null;

        await backendClient.query(`
          INSERT INTO document_chunks (
            document_id, well_id, page, section, chunk_index, text, confidence, metadata, embedding, created_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, NOW()
          )
        `, [
          docInfo.backendDocId,
          docInfo.wellId,
          c.page || 1,
          c.section || 'General Operations',
          chunksInserted,
          c.text,
          c.ocr_confidence != null ? c.ocr_confidence : 0.95,
          JSON.stringify(chunkMeta),
          embStr,
        ]);
        chunksInserted++;
      }
    }
    console.log(` Inserted ${chunksInserted} real document chunks from AI database`);

    // ── Step 5: Sync Extracted Entities ──────────────────────────────────────
    console.log('\n--- Step 5: Synchronizing Extracted Entities ---');
    const aiEntitiesRes = await aiClient.query('SELECT * FROM extracted_entities ORDER BY document_id, id ASC');
    console.log(` Found ${aiEntitiesRes.rows.length} extracted entities in AI database`);

    // Remove existing entities for the synced documents
    if (syncedDocUuids.length > 0) {
      await backendClient.query(`
        DELETE FROM extracted_entities WHERE document_id = ANY($1::uuid[])
      `, [syncedDocUuids]);
      console.log(' Cleared old entities for synced documents');
    }

    let entitiesInserted = 0;
    const entityBatchSize = 100;
    for (let i = 0; i < aiEntitiesRes.rows.length; i += entityBatchSize) {
      const batch = aiEntitiesRes.rows.slice(i, i + entityBatchSize);
      for (const e of batch) {
        const docInfo = aiToBackendDocMap.get(e.document_id);
        if (!docInfo) continue;

        const normalizedVal = e.unit ? `${e.value} ${e.unit}` : e.value;
        const entityMeta = {
          unit: e.unit || null,
          text: e.text || null,
          snippet: e.snippet || null,
          start_char: e.start_char || null,
          end_char: e.end_char || null,
          ai_entity_id: e.id,
          well_name: docInfo.wellName,
        };

        await backendClient.query(`
          INSERT INTO extracted_entities (
            document_id, entity_type, value, normalized_value, confidence, page, source_location, metadata
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8::jsonb
          )
        `, [
          docInfo.backendDocId,
          e.entity_type,
          e.value,
          normalizedVal,
          e.confidence != null ? e.confidence : 0.85,
          e.page || 1,
          e.source_location || (e.page ? `p${e.page}` : null),
          JSON.stringify(entityMeta),
        ]);
        entitiesInserted++;
      }
    }
    console.log(` Inserted ${entitiesInserted} extracted entities from AI database`);

    // ── Step 6: Final Verification ───────────────────────────────────────────
    console.log('\n--- Step 6: Final Backend Counts ---');
    const finalDocs = await backendClient.query('SELECT count(*) FROM documents');
    const finalChunks = await backendClient.query('SELECT count(*) FROM document_chunks');
    const finalEntities = await backendClient.query('SELECT count(*) FROM extracted_entities');

    console.log(` Backend Documents: ${finalDocs.rows[0].count}`);
    console.log(` Backend Document Chunks: ${finalChunks.rows[0].count}`);
    console.log(` Backend Extracted Entities: ${finalEntities.rows[0].count}`);

    console.log('\n=============================================================================');
    console.log(' Synchronization Completed Successfully!');
    console.log('=============================================================================');

  } catch (err) {
    console.error(' Sync failed with error:', err);
    process.exitCode = 1;
  } finally {
    await backendClient.end().catch(() => {});
    await aiClient.end().catch(() => {});
  }
}

if (require.main === module) {
  syncAIData();
}

module.exports = syncAIData;
