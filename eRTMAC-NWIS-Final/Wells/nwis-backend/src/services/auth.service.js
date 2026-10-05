// =============================================================================
// NWIS Backend — Auth Service
// =============================================================================

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const userRepository = require('../repositories/user.repository');
const logger = require('../utils/logger');

const { ROLES } = require('../middleware/rbac');

const SALT_ROUNDS = 10;

const authService = {
  /**
   * Register a new user.
   * Public registration always assigns the least-privileged standard role (DRILLING_ENGINEER).
   * Any client-supplied role is strictly ignored.
   */
  async register({ name, email, password }) {
    // Check if email already exists
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw Object.assign(new Error('Email already registered'), { code: 'EMAIL_EXISTS', status: 409 });
    }

    // Always enforce the least-privileged standard role for public registration
    const role = ROLES.DRILLING_ENGINEER;

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await userRepository.create({ name, email, password_hash, role });

    logger.info({ userId: user.id, email, role: user.role }, 'User registered with default role');
    return user;
  },

  /**
   * Login with email and password.
   * Returns access token, refresh token, and user data.
   */
  async login({ email, password }) {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw Object.assign(new Error('Invalid credentials'), { code: 'INVALID_CREDENTIALS', status: 401 });
    }

    if (user.status !== 'active') {
      throw Object.assign(new Error('Account is not active'), { code: 'ACCOUNT_INACTIVE', status: 403 });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw Object.assign(new Error('Invalid credentials'), { code: 'INVALID_CREDENTIALS', status: 401 });
    }

    const payload = { id: user.id, email: user.email, role: user.role, name: user.name };

    const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN, algorithm: 'HS256' });
    const refreshToken = jwt.sign(
      { id: user.id },
      env.JWT_REFRESH_SECRET,
      { expiresIn: env.JWT_REFRESH_EXPIRES_IN, algorithm: 'HS256', jwtid: crypto.randomUUID() }
    );

    // Store refresh token
    await userRepository.updateRefreshToken(user.id, refreshToken);

    logger.info({ userId: user.id }, 'User logged in');

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  },

  /**
   * Refresh access token with rotation.
   */
  async refresh(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] });
      const user = await userRepository.findAuthById(decoded.id);

      if (!user) {
        throw new Error('User not found');
      }

      // Check account status
      if (user.status !== 'active') {
        throw Object.assign(new Error('Account is not active'), { code: 'ACCOUNT_INACTIVE', status: 403 });
      }

      // Detect refresh token reuse / mismatch
      if (user.refresh_token !== refreshToken) {
        // Invalidate stored refresh token as a safety measure against token replay attacks
        await userRepository.updateRefreshToken(user.id, null);
        throw new Error('Refresh token reuse or mismatch detected');
      }

      const payload = { id: user.id, email: user.email, role: user.role, name: user.name };
      const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN, algorithm: 'HS256' });
      const newRefreshToken = jwt.sign(
        { id: user.id },
        env.JWT_REFRESH_SECRET,
        { expiresIn: env.JWT_REFRESH_EXPIRES_IN, algorithm: 'HS256', jwtid: crypto.randomUUID() }
      );

      // Rotate: replace old refresh token with newly issued one
      await userRepository.updateRefreshToken(user.id, newRefreshToken);

      return { accessToken, refreshToken: newRefreshToken };
    } catch (err) {
      if (err.code === 'ACCOUNT_INACTIVE') throw err;
      throw Object.assign(new Error('Invalid refresh token'), { code: 'INVALID_REFRESH_TOKEN', status: 401 });
    }
  },

  /**
   * Logout — invalidate refresh token.
   */
  async logout(userId) {
    await userRepository.updateRefreshToken(userId, null);
    logger.info({ userId }, 'User logged out');
  },

  /**
   * Get current user profile.
   */
  async getProfile(userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw Object.assign(new Error('User not found'), { code: 'USER_NOT_FOUND', status: 404 });
    }
    return user;
  },
};

module.exports = authService;
