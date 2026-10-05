// =============================================================================
// NWIS Backend — User Repository
// =============================================================================

const db = require('../config/database');

const userRepository = {
  /**
   * Create a new user.
   */
  async create({ name, email, password_hash, role }) {
    const result = await db.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, status, created_at`,
      [name, email, password_hash, role]
    );
    return result.rows[0];
  },

  /**
   * Find user by email.
   */
  async findByEmail(email) {
    const result = await db.query(
      `SELECT id, name, email, password_hash, role, status, refresh_token, created_at, updated_at
       FROM users WHERE email = $1`,
      [email]
    );
    return result.rows[0] || null;
  },

  /**
   * Find user by ID.
   */
  async findById(id) {
    const result = await db.query(
      `SELECT id, name, email, role, status, created_at, updated_at
       FROM users WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Find user by ID including auth secrets (for token refresh/authentication only).
   */
  async findAuthById(id) {
    const result = await db.query(
      `SELECT id, name, email, password_hash, role, status, refresh_token, created_at, updated_at
       FROM users WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * List all users (admin).
   */
  async findAll({ limit = 20, offset = 0 }) {
    const result = await db.query(
      `SELECT id, name, email, role, status, created_at, updated_at
       FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const countResult = await db.query('SELECT COUNT(*) FROM users');
    return { users: result.rows, total: parseInt(countResult.rows[0].count, 10) };
  },

  /**
   * Update refresh token.
   */
  async updateRefreshToken(userId, refreshToken) {
    await db.query(
      'UPDATE users SET refresh_token = $1 WHERE id = $2',
      [refreshToken, userId]
    );
  },

  /**
   * Update user fields.
   */
  async update(id, fields) {
    const keys = Object.keys(fields);
    const values = Object.values(fields);
    const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');

    const result = await db.query(
      `UPDATE users SET ${setClause} WHERE id = $1
       RETURNING id, name, email, role, status, updated_at`,
      [id, ...values]
    );
    return result.rows[0] || null;
  },

  /**
   * Delete user.
   */
  async delete(id) {
    const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    return result.rowCount > 0;
  },
};

module.exports = userRepository;
