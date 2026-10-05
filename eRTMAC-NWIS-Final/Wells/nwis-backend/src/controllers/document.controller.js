// =============================================================================
// NWIS Backend — Document Controller
// =============================================================================

const documentService = require('../services/document.service');
const auditService = require('../services/audit.service');
const { success, paginated, notFound, error } = require('../utils/response');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

const documentController = {
  async upload(req, res, next) {
    try {
      if (!req.file) {
        return error(res, 'NO_FILE', 'No file was uploaded', 400);
      }

      const doc = await documentService.uploadDocument({
        file: req.file,
        well_id: req.body.well_id,
        document_type: req.body.document_type,
        document_date: req.body.document_date,
        uploaded_by: req.user.id,
      });

      await auditService.log({ userId: req.user.id, action: 'UPLOAD_DOCUMENT', resourceType: 'document', resourceId: doc.id, newData: { filename: doc.original_filename }, req });
      return success(res, { document: doc }, 202);
    } catch (err) { next(err); }
  },

  async getAll(req, res, next) {
    try {
      const { page, limit, offset } = parsePagination(req.query);
      const { documents, total } = await documentService.listDocuments({ ...req.query, limit, offset });
      return paginated(res, { documents }, buildPaginationMeta(total, page, limit));
    } catch (err) { next(err); }
  },

  async getById(req, res, next) {
    try {
      const doc = await documentService.getDocument(req.params.id);
      return success(res, { document: doc });
    } catch (err) {
      if (err.code === 'DOCUMENT_NOT_FOUND') return notFound(res, 'Document');
      next(err);
    }
  },

  async getStatus(req, res, next) {
    try {
      const status = await documentService.getStatus(req.params.id);
      return success(res, status);
    } catch (err) {
      if (err.code === 'DOCUMENT_NOT_FOUND') return notFound(res, 'Document');
      next(err);
    }
  },

  async reprocess(req, res, next) {
    try {
      const result = await documentService.reprocess(req.params.id);
      return success(res, result, 202);
    } catch (err) {
      if (err.code === 'DOCUMENT_NOT_FOUND') return notFound(res, 'Document');
      next(err);
    }
  },

  async getChunks(req, res, next) {
    try {
      const chunks = await documentService.getChunks(req.params.id);
      return success(res, { chunks });
    } catch (err) { next(err); }
  },

  async getEntities(req, res, next) {
    try {
      const entities = await documentService.getEntities(req.params.id);
      return success(res, { entities });
    } catch (err) { next(err); }
  },
};

module.exports = documentController;
