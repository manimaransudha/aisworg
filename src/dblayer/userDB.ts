import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import { participantsMasterDB } from "./participantsMasterDB.js";

export interface UserRow {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  auth_provider: string;
  provider_id: string | null;
  is_active: boolean;
  type: string;
  tenant_id: string;
  password_hash: string | null;
  verification_token: string | null;
  verification_expires: Date | null;
  created_at: Date;
  last_login: Date | null;
}

export const userDB = {

  async findByEmail(email: string): Promise<UserRow | null> {
    try {
      const { rows } = await query<UserRow>(
        'SELECT * FROM users WHERE email = $1 LIMIT 1',
        [email.toLowerCase()]
      );
      return rows[0] || null;
    } catch (err) {
      logger.error('[userDB] findByEmail error:', err as Error);
      throw err;
    }
  },

  async getSuperuserId(): Promise<{ userId: string; actorId: string; actorBadge: string }> {
    const email = (process.env.SUPERUSER_EMAIL || '').toLowerCase();
    if (!email) throw new Error('[userDB] getSuperuserId: SUPERUSER_EMAIL is not set');
    const user = await this.findByEmail(email);
    if (!user) throw new Error(`[userDB] getSuperuserId: superuser provisioning has to precede this activity`);
    const { data: participant, error } = await participantsMasterDB.findByUserId(user.id);
    if (error) throw error;
    if (!participant) throw new Error(`superuser not registered as a participant`);
    return { userId: user.id, actorId: participant.id, actorBadge: 'root' };
  },

  async findById(id: string): Promise<UserRow | null> {
    try {
      const { rows } = await query<UserRow>(
        'SELECT * FROM users WHERE id = $1 LIMIT 1',
        [id]
      );
      return rows[0] || null;
    } catch (err) {
      logger.error('[userDB] findById error:', err as Error);
      throw err;
    }
  },

  async findByVerificationToken(token: string): Promise<UserRow | null> {
    try {
      const { rows } = await query<UserRow>(
        `SELECT * FROM users
         WHERE verification_token = $1
           AND verification_expires > NOW()
         LIMIT 1`,
        [token]
      );
      return rows[0] || null;
    } catch (err) {
      logger.error('[userDB] findByVerificationToken error:', err as Error);
      throw err;
    }
  },

  async create({ email, name, avatar_url, auth_provider, provider_id, is_active = true, type, tenant_id }: {
    email: string;
    name: string;
    avatar_url?: string | null;
    auth_provider: string;
    provider_id?: string | null;
    is_active?: boolean;
    type: string;
    tenant_id: string;
  }): Promise<UserRow> {
    try {
      const { rows } = await query<UserRow>(
        `INSERT INTO users (email, name, avatar_url, auth_provider, provider_id, is_active, type, tenant_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [email.toLowerCase(), name, avatar_url, auth_provider, provider_id, is_active, type, tenant_id]
      );
      return rows[0];
    } catch (err) {
      logger.error('[userDB] create error:', err as Error);
      throw err;
    }
  },

  async createLocalPending({ email, name, verification_token, verification_expires, type, tenant_id }: {
    email: string;
    name: string;
    verification_token: string;
    verification_expires: Date;
    type: string;
    tenant_id: string;
  }): Promise<UserRow> {
    try {
      const { rows } = await query<UserRow>(
        `INSERT INTO users (email, name, auth_provider, is_active, verification_token, verification_expires, type, tenant_id)
         VALUES ($1, $2, 'local', FALSE, $3, $4, $5, $6)
         ON CONFLICT (email) DO UPDATE
           SET name                 = EXCLUDED.name,
               verification_token   = EXCLUDED.verification_token,
               verification_expires = EXCLUDED.verification_expires,
               is_active            = FALSE,
               type                 = EXCLUDED.type,
               tenant_id            = EXCLUDED.tenant_id
         RETURNING *`,
        [email.toLowerCase(), name, verification_token, verification_expires, type, tenant_id]
      );
      return rows[0];
    } catch (err) {
      logger.error('[userDB] createLocalPending error:', err as Error);
      throw err;
    }
  },

  async activateWithPassword(email: string, password_hash: string): Promise<UserRow | null> {
    try {
      const { rows } = await query<UserRow>(
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
      logger.error('[userDB] activateWithPassword error:', err as Error);
      throw err;
    }
  },

  async updateLastLogin(email: string): Promise<void> {
    try {
      await query(
        'UPDATE users SET last_login = NOW() WHERE email = $1',
        [email.toLowerCase()]
      );
    } catch (err) {
      logger.error('[userDB] updateLastLogin error:', err as Error);
    }
  },

  async setActive(email: string, is_active: boolean): Promise<UserRow | null> {
    try {
      const { rows } = await query<UserRow>(
        'UPDATE users SET is_active = $1 WHERE email = $2 RETURNING *',
        [is_active, email.toLowerCase()]
      );
      return rows[0] || null;
    } catch (err) {
      logger.error('[userDB] setActive error:', err as Error);
      throw err;
    }
  },

  async listManaged(superuserEmail: string): Promise<UserRow[]> {
    try {
      const { rows } = await query<UserRow>(
        `SELECT id, email, name, avatar_url, auth_provider, is_active, created_at, last_login
         FROM users
         WHERE email != $1
         ORDER BY created_at DESC`,
        [(superuserEmail || '').toLowerCase()]
      );
      return rows;
    } catch (err) {
      logger.error('[userDB] listManaged error:', err as Error);
      throw err;
    }
  },

  async delete(email: string): Promise<void> {
    try {
      await query('DELETE FROM users WHERE email = $1', [email.toLowerCase()]);
    } catch (err) {
      logger.error('[userDB] delete error:', err as Error);
      throw err;
    }
  },

  async setResetToken(email: string, token: string, expires: Date): Promise<{ email: string; name: string } | null> {
    try {
      const { rows } = await query<{ email: string; name: string }>(
        `UPDATE users
         SET verification_token = $2, verification_expires = $3
         WHERE email = $1 AND auth_provider = 'local' AND is_active = TRUE
         RETURNING email, name`,
        [email.toLowerCase(), token, expires]
      );
      return rows[0] || null;
    } catch (err) {
      logger.error('[userDB] setResetToken error:', err as Error);
      throw err;
    }
  },
};
