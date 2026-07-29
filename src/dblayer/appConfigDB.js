import { query } from '../utils/db.js';
import { logger } from '../utils/logger.js';

export const appConfigDB = {
  /**
   * Load all config rows (key, value, value_type) for the in-memory cache.
   */
  async loadAll() {
    try {
      const res = await query('SELECT key, value, value_type FROM app_config');
      return { data: res.rows };
    } catch (err) {
      logger.error('[appConfigDB.loadAll] ' + err.message, err);
      return { error: err };
    }
  },

  /**
   * Update a single config value by key (must already exist in DB).
   */
  async setValue(key, value) {
    try {
      await query(
        'UPDATE app_config SET value = $1, updated_at = NOW() WHERE key = $2',
        [value, key]
      );
      return { success: true };
    } catch (err) {
      logger.error(`[appConfigDB.setValue] key=${key} ${err.message}`, err);
      return { error: err };
    }
  },

  /**
   * Upsert a config value — creates the row if it does not exist yet.
   */
  async upsertValue(key, value, { valueType = 'string', category = 'general', label = '', description = '' } = {}) {
    try {
      await query(
        `INSERT INTO app_config (key, value, value_type, category, label, description, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (key) DO UPDATE
           SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, value, valueType, category, label, description]
      );
      return { success: true };
    } catch (err) {
      logger.error(`[appConfigDB.upsertValue] key=${key} ${err.message}`, err);
      return { error: err };
    }
  },

  /**
   * Fetch all rows with metadata for the settings UI.
   */
  async getAll() {
    try {
      const res = await query(
        'SELECT key, value, value_type, category, label, description, updated_at FROM app_config ORDER BY category, key'
      );
      return { data: res.rows };
    } catch (err) {
      logger.error('[appConfigDB.getAll] ' + err.message, err);
      return { error: err };
    }
  }
};
