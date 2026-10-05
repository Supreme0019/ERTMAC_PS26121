// =============================================================================
// NWIS Backend — Authentication Middleware
// =============================================================================
// Verifies JWT tokens and attaches user data to req.user.
// =============================================================================

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { unauthorized } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Authenticate a request using a Bearer JWT token.
 * On success, attaches decoded payload to req.user.
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return unauthorized(res, 'Missing or malformed authorization header');
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return unauthorized(res, 'Missing or malformed authorization header');
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    if (!decoded || typeof decoded !== 'object' || !decoded.id || !decoded.role) {
      return unauthorized(res, 'Invalid token payload');
    }
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return unauthorized(res, 'Token has expired');
    }
    logger.warn({ err: err.message }, 'JWT verification failed');
    return unauthorized(res, 'Invalid token');
  }
};

/**
 * Optional authentication — does not reject unauthenticated requests,
 * but attaches user data if a valid token is present.
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    req.user = decoded && typeof decoded === 'object' && decoded.id ? decoded : null;
  } catch {
    req.user = null;
  }
  next();
};

module.exports = { authenticate, optionalAuth };
