import { appConfigDB } from '../dblayer/appConfigDB.js';
import { logger } from '../utils/logger.js';

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

let _cache = new Map();
let _loadedAt = 0;
let _ready = false;

function coerce(raw, type, fallback) {
  if (raw === null || raw === undefined) return fallback;
  try {
    switch (type) {
      case 'number':  { const n = parseFloat(raw); return isNaN(n) ? fallback : n; }
      case 'boolean': return raw === 'true';
      case 'json':    return JSON.parse(raw);
      default:        return raw;
    }
  } catch {
    return fallback;
  }
}

async function loadFromDB() {
  const { data, error } = await appConfigDB.loadAll();
  if (error) throw error;
  const map = new Map();
  for (const row of data) {
    map.set(row.key, { raw: row.value, type: row.value_type });
  }
  _cache = map;
  _loadedAt = Date.now();
  _ready = true;
  logger.debug(`[AppConfig] Loaded ${map.size} config keys from DB.`);
}

export const appConfig = {
  /**
   * Load config from DB. Call once at app startup.
   * Safe to call multiple times — skips if cache is still fresh.
   */
  async init() {
    if (_ready && (Date.now() - _loadedAt) < CACHE_TTL) return;
    try {
      await loadFromDB();
    } catch (err) {
      logger.warn(`[AppConfig] DB load failed — all get() calls will use fallbacks. ${err.message}`);
      _ready = true;
    }
  },

  /**
   * Synchronous read. Returns fallback if key is missing or cache not yet warmed.
   */
  get(key, fallback = null) {
    const entry = _cache.get(key);
    if (!entry) return fallback;
    return coerce(entry.raw, entry.type, fallback);
  },

  /**
   * Persist a new value and update the in-memory cache immediately.
   */
  async set(key, value) {
    const strValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    await appConfigDB.setValue(key, strValue);
    const entry = _cache.get(key);
    if (entry) entry.raw = strValue;
  },

  /**
   * Upsert a value — creates the row if missing, updates otherwise.
   */
  async upsert(key, value, meta = {}) {
    const strValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    await appConfigDB.upsertValue(key, strValue, meta);
    if (_cache.has(key)) {
      _cache.get(key).raw = strValue;
    } else {
      _cache.set(key, { raw: strValue, type: meta.valueType || 'string' });
    }
  },

  /**
   * Force a full reload from DB (called after settings are saved).
   */
  async reload() {
    _ready = false;
    await loadFromDB();
  },

  /**
   * Return all rows with metadata for the settings UI.
   */
  async getAll() {
    const { data, error } = await appConfigDB.getAll();
    if (error) throw error;
    return data;
  }
};
