// =============================================================================
// NWIS Backend — Global Error Handler
// =============================================================================

const logger = require('../utils/logger');
const { serverError, error } = require('../utils/response');

/**
 * Express error-handling middleware (4 arguments).
 * Must be registered LAST in the middleware chain.
 */
const errorHandler = (err, req, res, _next) => {
  // Log the error
  logger.error(
    {
      err,
      method: req.method,
      url: req.originalUrl,
      userId: req.user?.id,
    },
    'Unhandled error'
  );

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return error(res, 'FILE_TOO_LARGE', 'File exceeds maximum allowed size', 413);
  }

  // Multer unexpected field
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return error(res, 'UNEXPECTED_FILE', 'Unexpected file field', 400);
  }

  // JSON parse error
  if (err.type === 'entity.parse.failed') {
    return error(res, 'INVALID_JSON', 'Request body contains invalid JSON', 400);
  }

  // PostgreSQL unique violation
  if (err.code === '23505') {
    return error(res, 'DUPLICATE_ENTRY', 'A record with this value already exists', 409);
  }

  // PostgreSQL foreign key violation
  if (err.code === '23503') {
    return error(res, 'FOREIGN_KEY_VIOLATION', 'Referenced record does not exist', 400);
  }

  // Default to 500
  return serverError(res, err.message || 'Internal server error');
};

module.exports = { errorHandler };
