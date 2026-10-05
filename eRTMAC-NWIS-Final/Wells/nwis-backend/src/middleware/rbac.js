// =============================================================================
// NWIS Backend — Role-Based Access Control Middleware
// =============================================================================
// Enforces role restrictions on routes. Must be used AFTER authenticate.
// =============================================================================

const { unauthorized, forbidden } = require('../utils/response');

/**
 * Supported roles as defined in the PS specification:
 * - DRILLING_ENGINEER
 * - SUPERVISOR
 * - DATA_ADMIN
 * - AI_ADMIN
 * - SYSTEM_ADMIN
 */
const ROLES = {
  DRILLING_ENGINEER: 'DRILLING_ENGINEER',
  SUPERVISOR: 'SUPERVISOR',
  DATA_ADMIN: 'DATA_ADMIN',
  AI_ADMIN: 'AI_ADMIN',
  SYSTEM_ADMIN: 'SYSTEM_ADMIN',
};

/**
 * Middleware factory: require the user to have one of the specified roles.
 * @param {...string} allowedRoles
 * @returns {import('express').RequestHandler}
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return unauthorized(res, 'Authentication required before role check');
    }

    if (!allowedRoles.includes(req.user.role)) {
      return forbidden(
        res,
        `Role '${req.user.role}' is not authorized. Required: ${allowedRoles.join(', ')}`
      );
    }

    next();
  };
};

/**
 * Require any authenticated user (no specific role).
 */
const requireAnyRole = (req, res, next) => {
  if (!req.user) {
    return unauthorized(res, 'Authentication required');
  }
  next();
};

/**
 * Require admin role (DATA_ADMIN or SYSTEM_ADMIN).
 */
const requireAdmin = requireRole(ROLES.DATA_ADMIN, ROLES.SYSTEM_ADMIN);

/**
 * Require system admin role (SYSTEM_ADMIN only).
 */
const requireSystemAdmin = requireRole(ROLES.SYSTEM_ADMIN);

/**
 * Require AI admin role (AI_ADMIN or SYSTEM_ADMIN).
 */
const requireAIAdmin = requireRole(ROLES.AI_ADMIN, ROLES.SYSTEM_ADMIN);

module.exports = {
  ROLES,
  requireRole,
  requireAnyRole,
  requireAdmin,
  requireSystemAdmin,
  requireAIAdmin,
};
