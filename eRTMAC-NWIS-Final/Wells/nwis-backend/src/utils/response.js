// =============================================================================
// NWIS Backend — Standardized API Response Helpers
// =============================================================================

/**
 * Send a success response.
 * @param {import('express').Response} res
 * @param {object} data
 * @param {number} [statusCode=200]
 */
const success = (res, data, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    data,
  });
};

/**
 * Send a paginated success response.
 * @param {import('express').Response} res
 * @param {object} data
 * @param {object} pagination - { page, limit, total, totalPages }
 */
const paginated = (res, data, pagination) => {
  return res.status(200).json({
    success: true,
    data,
    pagination,
  });
};

/**
 * Send an error response.
 * @param {import('express').Response} res
 * @param {string} code - Machine-readable error code
 * @param {string} message - Human-readable message
 * @param {number} [statusCode=400]
 * @param {object} [details] - Optional additional details
 */
const error = (res, code, message, statusCode = 400, details = undefined) => {
  const body = {
    success: false,
    error: { code, message },
  };
  if (details) body.error.details = details;
  return res.status(statusCode).json(body);
};

/**
 * Common error responses.
 */
const notFound = (res, resource = 'Resource') =>
  error(res, `${resource.toUpperCase().replace(/\s+/g, '_')}_NOT_FOUND`, `${resource} was not found`, 404);

const badRequest = (res, message = 'Bad request') =>
  error(res, 'BAD_REQUEST', message, 400);

const unauthorized = (res, message = 'Authentication required') =>
  error(res, 'UNAUTHORIZED', message, 401);

const forbidden = (res, message = 'Insufficient permissions') =>
  error(res, 'FORBIDDEN', message, 403);

const validationError = (res, details) =>
  error(res, 'VALIDATION_ERROR', 'Validation failed', 400, details);

const serverError = (res, message = 'Internal server error') =>
  error(res, 'INTERNAL_ERROR', message, 500);

module.exports = {
  success,
  paginated,
  error,
  notFound,
  badRequest,
  unauthorized,
  forbidden,
  validationError,
  serverError,
};
