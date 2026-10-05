// =============================================================================
// NWIS Backend — Auth Controller
// =============================================================================

const authService = require('../services/auth.service');
const auditService = require('../services/audit.service');
const { success, error, unauthorized } = require('../utils/response');

const authController = {
  async register(req, res, next) {
    try {
      const user = await authService.register(req.body);
      await auditService.log({ userId: user.id, action: 'REGISTER', resourceType: 'user', resourceId: user.id, newData: { email: user.email, role: user.role }, req });
      return success(res, { user }, 201);
    } catch (err) {
      if (err.code === 'EMAIL_EXISTS') return error(res, err.code, err.message, err.status);
      next(err);
    }
  },

  async login(req, res, next) {
    try {
      const result = await authService.login(req.body);
      await auditService.log({ userId: result.user.id, action: 'LOGIN', resourceType: 'user', resourceId: result.user.id, req });
      return success(res, result);
    } catch (err) {
      if (err.code === 'INVALID_CREDENTIALS') return unauthorized(res, err.message);
      if (err.code === 'ACCOUNT_INACTIVE') return error(res, err.code, err.message, err.status);
      next(err);
    }
  },

  async refresh(req, res, next) {
    try {
      const result = await authService.refresh(req.body.refreshToken);
      return success(res, result);
    } catch (err) {
      if (err.code === 'INVALID_REFRESH_TOKEN') return unauthorized(res, err.message);
      if (err.code === 'ACCOUNT_INACTIVE') return error(res, err.code, err.message, err.status);
      next(err);
    }
  },

  async logout(req, res, next) {
    try {
      await authService.logout(req.user.id);
      await auditService.log({ userId: req.user.id, action: 'LOGOUT', resourceType: 'user', resourceId: req.user.id, req });
      return success(res, { message: 'Logged out' });
    } catch (err) {
      next(err);
    }
  },

  async me(req, res, next) {
    try {
      const user = await authService.getProfile(req.user.id);
      return success(res, { user });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = authController;
