// =============================================================================
// NWIS Backend — Users Controller
// =============================================================================
// Admin management of system users and roles.
// =============================================================================

const userRepository = require('../repositories/user.repository');
const auditService = require('../services/audit.service');
const { success, paginated, notFound, forbidden, badRequest } = require('../utils/response');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');
const { ROLES } = require('../middleware/rbac');

const usersController = {
  /**
   * List all users (admin).
   */
  async list(req, res, next) {
    try {
      const { page, limit, offset } = parsePagination(req.query);
      const { users, total } = await userRepository.findAll({ limit, offset });
      return paginated(res, { users }, buildPaginationMeta(total, page, limit));
    } catch (err) {
      next(err);
    }
  },

  /**
   * Create a user directly with a specified role (system admin only).
   */
  async create(req, res, next) {
    try {
      const { name, email, password, role = ROLES.DRILLING_ENGINEER } = req.body;
      if (!name || !email || !password) {
        return badRequest(res, 'Name, email, and password are required');
      }
      if (!Object.values(ROLES).includes(role)) {
        return badRequest(res, `Invalid role. Allowed roles: ${Object.values(ROLES).join(', ')}`);
      }
      const existing = await userRepository.findByEmail(email);
      if (existing) {
        const { error } = require('../utils/response');
        return error(res, 'EMAIL_EXISTS', 'Email already registered', 409);
      }
      const bcrypt = require('bcryptjs');
      const password_hash = await bcrypt.hash(password, 10);
      const user = await userRepository.create({ name, email, password_hash, role });
      await auditService.log({
        userId: req.user.id,
        action: 'CREATE_USER',
        resourceType: 'user',
        resourceId: user.id,
        newData: { email: user.email, role: user.role },
        req,
      });
      return success(res, { user }, 201);
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get user by ID.
   * Users can view their own profile; admins can view any profile.
   */
  async getById(req, res, next) {
    try {
      const isAdmin = [ROLES.DATA_ADMIN, ROLES.SYSTEM_ADMIN].includes(req.user.role);
      if (!isAdmin && req.user.id !== req.params.id) {
        return forbidden(res, 'You do not have permission to view this user profile');
      }

      const user = await userRepository.findById(req.params.id);
      if (!user) return notFound(res, 'User');
      return success(res, { user });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Update user details (e.g. role, status).
   * Privileged role changes are strictly restricted to SYSTEM_ADMIN.
   */
  async update(req, res, next) {
    try {
      const targetUser = await userRepository.findById(req.params.id);
      if (!targetUser) return notFound(res, 'User');

      const allowedFields = ['name', 'role', 'status'];
      const updateData = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }

      if (Object.keys(updateData).length === 0) {
        return badRequest(res, 'No valid fields provided for update');
      }

      // Privileged role change validation
      if (updateData.role !== undefined) {
        if (!Object.values(ROLES).includes(updateData.role)) {
          return badRequest(res, `Invalid role. Allowed roles: ${Object.values(ROLES).join(', ')}`);
        }

        // Only SYSTEM_ADMIN is authorized to change any user's role
        if (req.user.role !== ROLES.SYSTEM_ADMIN) {
          return forbidden(res, 'Only SYSTEM_ADMIN can modify user roles');
        }
      }

      // Status change validation
      if (updateData.status !== undefined) {
        const allowedStatuses = ['active', 'inactive', 'suspended'];
        if (!allowedStatuses.includes(updateData.status)) {
          return badRequest(res, `Invalid status. Allowed statuses: ${allowedStatuses.join(', ')}`);
        }
      }

      const user = await userRepository.update(req.params.id, updateData);
      if (!user) return notFound(res, 'User');

      await auditService.log({
        userId: req.user.id,
        action: 'UPDATE_USER',
        resourceType: 'user',
        resourceId: req.params.id,
        newData: updateData,
        req,
      });

      return success(res, { user });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Delete user.
   */
  async delete(req, res, next) {
    try {
      const targetUser = await userRepository.findById(req.params.id);
      if (!targetUser) return notFound(res, 'User');

      // Prevent non-SYSTEM_ADMIN from deleting a SYSTEM_ADMIN
      if (targetUser.role === ROLES.SYSTEM_ADMIN && req.user.role !== ROLES.SYSTEM_ADMIN) {
        return forbidden(res, 'Only SYSTEM_ADMIN can delete another SYSTEM_ADMIN');
      }

      // Prevent user from deleting their own active account
      if (targetUser.id === req.user.id) {
        return forbidden(res, 'Cannot delete your own account');
      }

      const deleted = await userRepository.delete(req.params.id);
      if (!deleted) return notFound(res, 'User');

      await auditService.log({
        userId: req.user.id,
        action: 'DELETE_USER',
        resourceType: 'user',
        resourceId: req.params.id,
        req,
      });

      return success(res, { message: 'User deleted' });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = usersController;
