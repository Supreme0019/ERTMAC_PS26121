// =============================================================================
// NWIS Backend — Document Ingestion Job
// =============================================================================
// Asynchronous pipeline for processing uploaded PDF/drilling reports.
// Flow: Validate → OCR / Extract → Chunking → Entity Extraction → Embeddings
// =============================================================================

const documentRepository = require('../repositories/document.repository');
const aiService = require('../services/ai.service');
const logger = require('../utils/logger');

// In-memory queue for hackathon MVP (can be replaced with Redis/BullMQ)
const queue = [];
let isProcessing = false;

const documentIngestionJob = {
  /**
   * Enqueue a document for asynchronous processing.
   * @param {string} documentId
   */
  enqueue(documentId) {
    queue.push(documentId);
    logger.info({ documentId, queueLength: queue.length }, 'Document enqueued for ingestion');
    this.processQueue();
  },

  /**
   * Process queued documents sequentially.
   */
  async processQueue() {
    if (isProcessing || queue.length === 0) return;
    isProcessing = true;

    while (queue.length > 0) {
      const documentId = queue.shift();
      try {
        await this.processDocument(documentId);
      } catch (err) {
        logger.error({ err, documentId }, 'Document ingestion job encountered unhandled error');
      }
    }

    isProcessing = false;
  },

  /**
   * Run the full ingestion pipeline for a single document.
   */
  async processDocument(documentId) {
    logger.info({ documentId }, 'Processing document in worker');

    const doc = await documentRepository.findById(documentId);
    if (!doc) {
      logger.warn({ documentId }, 'Document not found, skipping ingestion');
      return;
    }

    // Step 1: Set status to in_progress
    await documentRepository.updateStatus(documentId, {
      ocr_status: 'in_progress',
      processing_status: 'in_progress',
    });

    try {
      // Step 2: Attempt AI Service extraction
      const aiResult = await aiService.processDocument(documentId, doc.file_uri, doc.well_id);

      if (aiResult.success) {
        // AI service handles full pipeline (OCR, chunking, entity extraction, embeddings)
        // and persists results to its own database. We just update status here.
        await documentRepository.updateStatus(documentId, {
          ocr_status: 'completed',
          processing_status: 'completed',
          page_count: aiResult.pages || 1,
          text_length: aiResult.events_extracted || 0,
        });

        // Save the AI's document_id in backend metadata for cross-referencing
        if (aiResult.data?.document_id || aiResult.document_id) {
          const aiDocId = aiResult.data?.document_id || aiResult.document_id;
          try {
            await documentRepository.updateMetadata(documentId, {
              ai_document_id: aiDocId,
              ai_entities_extracted: aiResult.entities_extracted || 0,
              ai_events_extracted: aiResult.events_extracted || 0,
            });
          } catch (metaErr) {
            logger.debug('Failed to save AI document_id in metadata:', metaErr.message);
          }
        }

        logger.info({
          documentId,
          events: aiResult.events_extracted,
          entities: aiResult.entities_extracted,
        }, 'Document AI processing completed successfully');
      } else {
        // Fallback mode: AI service is not running or returned error.
        // Create baseline chunk from document metadata so RAG/search won't fail.
        logger.warn({ documentId, reason: aiResult.error }, 'AI service unavailable — generating metadata chunks as fallback');

        const fallbackText = `Document: ${doc.original_filename}\nType: ${doc.document_type}\nDate: ${doc.document_date || 'N/A'}\nWell: ${doc.well_name || 'N/A'}`;
        await documentRepository.addChunks([
          {
            document_id: documentId,
            page: 1,
            section: 'Document Summary',
            chunk_index: 0,
            text: fallbackText,
            confidence: 0.8,
            metadata: { fallback: true },
          },
        ]);

        await documentRepository.updateStatus(documentId, {
          ocr_status: 'degraded',
          processing_status: 'needs_review',
          page_count: 1,
          text_length: fallbackText.length,
        });
      }
    } catch (err) {
      logger.error({ err, documentId }, 'Document processing pipeline failed');
      await documentRepository.updateStatus(documentId, {
        ocr_status: 'failed',
        processing_status: 'failed',
      });
    }
  },
};

module.exports = documentIngestionJob;
