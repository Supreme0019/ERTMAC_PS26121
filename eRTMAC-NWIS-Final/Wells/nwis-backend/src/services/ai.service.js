// =============================================================================
// NWIS Backend — AI Service (Node Orchestrator)
// =============================================================================
// Orchestrates calls to the Python AI microservice.
// Node does NOT perform OCR/LLM/ML itself — it delegates and validates.
// =============================================================================

const aiClient = require('../config/ai');
const logger = require('../utils/logger');

const aiService = {
  /**
   * Process a document through the AI pipeline.
   * Sends the document file to the Python AI service for:
   * OCR → NLP → Entity Extraction → Embeddings
   * The AI service handles the full pipeline internally.
   */
  async processDocument(documentId, fileUri, wellId = null) {
    logger.info({ documentId }, 'Starting AI document processing');

    try {
      const result = await aiClient.processDocument(documentId, fileUri, wellId);

      if (result.success && result.data) {
        return {
          success: true,
          chunks: result.data.chunks || null,
          events_extracted: result.data.events_extracted || 0,
          entities_extracted: result.data.entities_extracted || 0,
          document_id: result.data.document_id,
        };
      }

      return { success: false, error: result.error || 'AI processing returned no data' };
    } catch (err) {
      logger.error({ err, documentId }, 'AI document processing failed');
      return { success: false, error: err.message };
    }
  },

  /**
   * Check AI service health.
   */
  async checkHealth() {
    return await aiClient.healthCheck();
  },
};

module.exports = aiService;
