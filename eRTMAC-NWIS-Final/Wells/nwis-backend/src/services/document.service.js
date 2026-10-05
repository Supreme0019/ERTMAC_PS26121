// =============================================================================
// NWIS Backend — Document Service
// =============================================================================

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const documentRepository = require('../repositories/document.repository');
const storage = require('../config/storage');
const logger = require('../utils/logger');

const documentService = {
  /**
   * Upload and register a document.
   * Stores file to object storage, creates DB record, queues for processing.
   */
  async uploadDocument({ file, well_id, document_type, document_date, uploaded_by }) {
    // Generate storage key
    const ext = file.originalname.split('.').pop();
    const storageKey = `documents/${well_id || 'unassigned'}/${uuidv4()}.${ext}`;

    // Calculate checksum
    const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');

    // Store file
    const fileUri = await storage.putObject(storageKey, file.buffer);

    // Create DB record
    const doc = await documentRepository.create({
      well_id,
      document_type,
      original_filename: file.originalname,
      file_uri: fileUri,
      document_date,
      checksum,
      uploaded_by,
    });

    logger.info({ documentId: doc.id, filename: file.originalname }, 'Document uploaded');

    // Asynchronously trigger document ingestion job
    try {
      const documentIngestionJob = require('../jobs/documentIngestion.job');
      documentIngestionJob.enqueue(doc.id);
    } catch (jobErr) {
      logger.warn({ err: jobErr.message }, 'Failed to enqueue document for ingestion');
    }

    return doc;
  },

  /**
   * Get a document by ID.
   */
  async getDocument(id) {
    const doc = await documentRepository.findById(id);
    if (!doc) {
      throw Object.assign(new Error('Document not found'), { code: 'DOCUMENT_NOT_FOUND', status: 404 });
    }
    return doc;
  },

  /**
   * List documents.
   */
  async listDocuments(filters) {
    return await documentRepository.findAll(filters);
  },

  /**
   * Get document processing status.
   */
  async getStatus(id) {
    const doc = await this.getDocument(id);
    return {
      id: doc.id,
      original_filename: doc.original_filename,
      ocr_status: doc.ocr_status,
      processing_status: doc.processing_status,
      page_count: doc.page_count,
      text_length: doc.text_length,
    };
  },

  /**
   * Trigger reprocessing of a document.
   */
  async reprocess(id) {
    const doc = await this.getDocument(id);

    await documentRepository.updateStatus(id, {
      ocr_status: 'pending',
      processing_status: 'pending',
    });

    logger.info({ documentId: id }, 'Document queued for reprocessing');
    try {
      const documentIngestionJob = require('../jobs/documentIngestion.job');
      documentIngestionJob.enqueue(id);
    } catch (jobErr) {
      logger.warn({ err: jobErr.message }, 'Failed to enqueue document for reprocessing');
    }
    return { id, status: 'reprocessing' };
  },

  /**
   * Get chunks for a document.
   */
  async getChunks(documentId) {
    return await documentRepository.getChunks(documentId);
  },

  /**
   * Get entities for a document.
   */
  async getEntities(documentId) {
    return await documentRepository.getEntities(documentId);
  },

  /**
   * Delete a document and its file.
   */
  async deleteDocument(id) {
    const doc = await documentRepository.delete(id);
    if (!doc) {
      throw Object.assign(new Error('Document not found'), { code: 'DOCUMENT_NOT_FOUND', status: 404 });
    }

    // Try to delete file from storage
    try {
      const key = doc.file_uri.replace('local://', '');
      await storage.deleteObject(key);
    } catch (err) {
      logger.warn({ err, documentId: id }, 'Failed to delete file from storage');
    }

    return true;
  },
};

module.exports = documentService;
