import { query } from '../utils/db.js';
import { logger } from '../utils/logger.js';

export const userDB = {

  async findByEmail(email) {
    try {
      const { rows } = await query(
        'SELECT * FROM users WHERE email = $1 LIMIT 1',
        [email.toLowerCase()]
      );
      return rows[0] || null;
    } catch (err) {
      logger.error('[userDB] findByEmail error:', err);
      throw err;
    }
  },

  async findByVerificationToken(token) {
    try {
      const { rows } = await query(
        `SELECT * FROM users
         WHERE verification_token = $1
           AND verification_expires > NOW()
         LIMIT 1`,
        [token]
      );
      return rows[0] || null;
    } catch (err) {
      logger.error('[userDB] findByVerificationToken error:', err);
      throw err;
    }
  },

  // CR-004: type ('Platform'|'Tenant') + tenant_id are now required columns.
  async create({ email, name, avatar_url, role, auth_provider, provider_id, is_active = true, type, tenant_id }) {
    try {
      const { rows } = await query(
        `INSERT INTO users (email, name, avatar_url, role, auth_provider, provider_id, is_active, type, tenant_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [email.toLowerCase(), name, avatar_url, role, auth_provider, provider_id, is_active, type, tenant_id]
      );
      return rows[0];
    } catch (err) {
      logger.error('[userDB] create error:', err);
      throw err;
    }
  },

  async createLocalPending({ email, name, role, verification_token, verification_expires, type, tenant_id }) {
    try {
      const { rows } = await query(
        `INSERT INTO users (email, name, role, auth_provider, is_active, verification_token, verification_expires, type, tenant_id)
         VALUES ($1, $2, $3, 'local', FALSE, $4, $5, $6, $7)
         ON CONFLICT (email) DO UPDATE
           SET name                 = EXCLUDED.name,
               role                 = EXCLUDED.role,
               verification_token   = EXCLUDED.verification_token,
               verification_expires = EXCLUDED.verification_expires,
               is_active            = FALSE,
               type                 = EXCLUDED.type,
               tenant_id            = EXCLUDED.tenant_id
         RETURNING *`,
        [email.toLowerCase(), name, role, verification_token, verification_expires, type, tenant_id]
      );
      return rows[0];
    } catch (err) {
      logger.error('[userDB] createLocalPending error:', err);
      throw err;
    }
  },

  async activateWithPassword(email, password_hash) {
    try {
      const { rows } = await query(
        `UPDATE users
         SET password_hash        = $1,
             is_active            = TRUE,
             verification_token   = NULL,
             verification_expires = NULL
         WHERE email = $2
         RETURNING *`,
        [password_hash, email.toLowerCase()]
      );
      return rows[0] || null;
    } catch (err) {
      logger.error('[userDB] activateWithPassword error:', err);
      throw err;
    }
  },

  async updateLastLogin(email) {
    try {
      await query(
        'UPDATE users SET last_login = NOW() WHERE email = $1',
        [email.toLowerCase()]
      );
    } catch (err) {
      logger.error('[userDB] updateLastLogin error:', err);
    }
  },

  async updateRole(email, role) {
    try {
      const { rows } = await query(
        'UPDATE users SET role = $1 WHERE email = $2 RETURNING *',
        [role, email.toLowerCase()]
      );
      return rows[0] || null;
    } catch (err) {
      logger.error('[userDB] updateRole error:', err);
      throw err;
    }
  },

  async setActive(email, is_active) {
    try {
      const { rows } = await query(
        'UPDATE users SET is_active = $1 WHERE email = $2 RETURNING *',
        [is_active, email.toLowerCase()]
      );
      return rows[0] || null;
    } catch (err) {
      logger.error('[userDB] setActive error:', err);
      throw err;
    }
  },

  /** List all users except the env-protected superuser. */
  async listManaged(superuserEmail) {
    try {
      const { rows } = await query(
        `SELECT id, email, name, avatar_url, role, auth_provider, is_active, created_at, last_login
         FROM users
         WHERE email != $1
         ORDER BY created_at DESC`,
        [(superuserEmail || '').toLowerCase()]
      );
      return rows;
    } catch (err) {
      logger.error('[userDB] listManaged error:', err);
      throw err;
    }
  },

  async delete(email) {
    try {
      await query('DELETE FROM users WHERE email = $1', [email.toLowerCase()]);
    } catch (err) {
      logger.error('[userDB] delete error:', err);
      throw err;
    }
  },

  async setResetToken(email, token, expires) {
    try {
      const { rows } = await query(
        `UPDATE users
         SET verification_token = $2, verification_expires = $3
         WHERE email = $1 AND auth_provider = 'local' AND is_active = TRUE
         RETURNING email, name`,
        [email.toLowerCase(), token, expires]
      );
      return rows[0] || null;
    } catch (err) {
      logger.error('[userDB] setResetToken error:', err);
      throw err;
    }
  },
};
