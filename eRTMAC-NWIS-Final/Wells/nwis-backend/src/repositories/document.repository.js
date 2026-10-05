// =============================================================================
// NWIS Backend — Document Repository
// =============================================================================

const db = require('../config/database');

const documentRepository = {
  /**
   * Create a document record.
   */
  async create(docData) {
    const {
      well_id, document_type, original_filename, file_uri,
      document_date, checksum, uploaded_by,
    } = docData;

    const result = await db.query(
      `INSERT INTO documents (well_id, document_type, original_filename, file_uri, document_date, checksum, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [well_id, document_type, original_filename, file_uri, document_date, checksum, uploaded_by]
    );
    return result.rows[0];
  },

  /**
   * Find document by ID.
   */
  async findById(id) {
    const result = await db.query(
      `SELECT d.*, w.well_name, u.name AS uploader_name
       FROM documents d
       LEFT JOIN wells w ON d.well_id = w.id
       LEFT JOIN users u ON d.uploaded_by = u.id
       WHERE d.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * List documents with filters.
   */
  async findAll(filters = {}) {
    const params = [];
    const conditions = [];

    if (filters.well_id) {
      params.push(filters.well_id);
      conditions.push(`d.well_id = $${params.length}`);
    }
    if (filters.well_name) {
      params.push(filters.well_name);
      conditions.push(`w.well_name = $${params.length}`);
    }
    if (filters.document_type) {
      params.push(filters.document_type);
      conditions.push(`d.document_type = $${params.length}`);
    }
    if (filters.processing_status) {
      params.push(filters.processing_status);
      conditions.push(`d.processing_status = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    params.push(filters.limit || 20);
    const limitIdx = params.length;
    params.push(filters.offset || 0);
    const offsetIdx = params.length;

    const result = await db.query(
      `SELECT d.*, w.well_name
       FROM documents d
       LEFT JOIN wells w ON d.well_id = w.id
       ${whereClause}
       ORDER BY d.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    const countParams = params.slice(0, params.length - 2);
    const countResult = await db.query(
      `SELECT COUNT(*) FROM documents d LEFT JOIN wells w ON d.well_id = w.id ${whereClause}`,
      countParams
    );

    return {
      documents: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
    };
  },

  /**
   * Update document processing status.
   */
  async updateStatus(id, { ocr_status, processing_status, page_count, text_length }) {
    const fields = {};
    if (ocr_status !== undefined) fields.ocr_status = ocr_status;
    if (processing_status !== undefined) fields.processing_status = processing_status;
    if (page_count !== undefined) fields.page_count = page_count;
    if (text_length !== undefined) fields.text_length = text_length;

    const keys = Object.keys(fields);
    if (keys.length === 0) return null;

    const values = Object.values(fields);
    const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');

    const result = await db.query(
      `UPDATE documents SET ${setClause} WHERE id = $1 RETURNING *`,
      [id, ...values]
    );
    return result.rows[0] || null;
  },

  /**
   * Update document metadata (merge with existing).
   */
  async updateMetadata(id, newMeta) {
    const result = await db.query(
      `UPDATE documents SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb WHERE id = $1 RETURNING *`,
      [id, JSON.stringify(newMeta)]
    );
    return result.rows[0] || null;
  },

  /**
   * Delete a document.
   */
  async delete(id) {
    const result = await db.query('DELETE FROM documents WHERE id = $1 RETURNING id, file_uri', [id]);
    return result.rows[0] || null;
  },

  // ── Chunks ──────────────────────────────────────────────────────────────

  /**
   * Add document chunks.
   */
  async addChunks(chunks) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const inserted = [];
      for (const c of chunks) {
        const result = await client.query(
          `INSERT INTO document_chunks (document_id, page, section, chunk_index, text, confidence, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [c.document_id, c.page, c.section, c.chunk_index, c.text, c.confidence, c.metadata || {}]
        );
        inserted.push(result.rows[0]);
      }
      await client.query('COMMIT');
      return inserted;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Get chunks for a document.
   */
  async getChunks(documentId) {
    const result = await db.query(
      `SELECT * FROM document_chunks WHERE document_id = $1 ORDER BY chunk_index ASC`,
      [documentId]
    );
    return result.rows;
  },

  /**
   * Search chunks by text (keyword search).
   */
  async searchChunks(query, { wellId, limit = 20 } = {}) {
    const params = [`%${query}%`];
    let wellFilter = '';

    if (wellId) {
      params.push(wellId);
      wellFilter = `AND d.well_id = $${params.length}`;
    }

    params.push(limit);

    const result = await db.query(
      `SELECT dc.*, d.well_id, d.original_filename, d.document_type, w.well_name
       FROM document_chunks dc
       JOIN documents d ON dc.document_id = d.id
       LEFT JOIN wells w ON d.well_id = w.id
       WHERE dc.text ILIKE $1 ${wellFilter}
       ORDER BY dc.created_at DESC
       LIMIT $${params.length}`,
      params
    );
    return result.rows;
  },

  // ── Extracted Entities ──────────────────────────────────────────────────

  /**
   * Add extracted entities.
   */
  async addEntities(entities) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const inserted = [];
      for (const e of entities) {
        const result = await client.query(
          `INSERT INTO extracted_entities (document_id, entity_type, value, normalized_value, confidence, page, source_location, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
          [e.document_id, e.entity_type, e.value, e.normalized_value, e.confidence, e.page, e.source_location, e.metadata || {}]
        );
        inserted.push(result.rows[0]);
      }
      await client.query('COMMIT');
      return inserted;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Get entities for a document.
   */
  async getEntities(documentId) {
    const result = await db.query(
      `SELECT * FROM extracted_entities WHERE document_id = $1 ORDER BY page, entity_type`,
      [documentId]
    );
    return result.rows;
  },
};

module.exports = documentRepository;
