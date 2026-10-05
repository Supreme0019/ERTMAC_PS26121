// =============================================================================
// NWIS Backend — Zod Validation Middleware
// =============================================================================
// Wraps Zod schemas into Express middleware for request validation.
// =============================================================================

const { validationError } = require('../utils/response');

/**
 * Create a validation middleware from a Zod schema.
 * Validates req.body, req.query, and/or req.params.
 *
 * @param {object} schemas - { body?: ZodSchema, query?: ZodSchema, params?: ZodSchema }
 * @returns {import('express').RequestHandler}
 */
const validate = (schemas) => {
  return (req, res, next) => {
    const errors = [];

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        errors.push(
          ...result.error.issues.map((i) => ({
            field: `body.${i.path.join('.')}`,
            message: i.message,
          }))
        );
      } else {
        req.body = result.data;
      }
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        errors.push(
          ...result.error.issues.map((i) => ({
            field: `query.${i.path.join('.')}`,
            message: i.message,
          }))
        );
      } else {
        req.query = result.data;
      }
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        errors.push(
          ...result.error.issues.map((i) => ({
            field: `params.${i.path.join('.')}`,
            message: i.message,
          }))
        );
      } else {
        req.params = result.data;
      }
    }

    if (errors.length > 0) {
      return validationError(res, errors);
    }

    next();
  };
};

module.exports = { validate };
