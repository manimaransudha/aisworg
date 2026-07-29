-- Users table for role-based authentication
-- Supports Google OAuth and local (email/password) login
-- Run as DB owner once

CREATE TABLE IF NOT EXISTS users (
  id                   SERIAL PRIMARY KEY,
  email                TEXT NOT NULL UNIQUE,
  name                 TEXT,
  avatar_url           TEXT,
  role                 TEXT NOT NULL DEFAULT 'general'
                         CHECK (role IN ('general', 'power', 'super')),
  auth_provider        TEXT NOT NULL DEFAULT 'local'
                         CHECK (auth_provider IN ('google', 'facebook', 'local')),
  provider_id          TEXT,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  is_protected         BOOLEAN NOT NULL DEFAULT FALSE,
  password_hash        TEXT,
  verification_token   TEXT,
  verification_expires TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_email          ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_verify_token   ON users (verification_token) WHERE verification_token IS NOT NULL;


-- App Config: centralised key-value store for all tunable thresholds and settings.
-- value_type drives type coercion in AppConfig.get(): 'number' | 'boolean' | 'json' | 'string'
CREATE TABLE IF NOT EXISTS app_config (
  key          TEXT PRIMARY KEY,
  value        TEXT NOT NULL,
  value_type   TEXT NOT NULL DEFAULT 'string',
  category     TEXT NOT NULL DEFAULT 'general',
  label        TEXT,
  description  TEXT,
  updated_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO app_config (key, value, value_type, category, label, description) VALUES
  -- Trading / Donchian
  ('donchian.default_period',        '20',                      'number',  'trading',  'Default Lookback Period',          'Default number of trading days for the Donchian Channel'),
  ('donchian.valid_periods',         '[5,10,20,52,63,100,200]', 'json',    'trading',  'Valid Lookback Periods',            'Allowed period options shown in the Trading page selector (JSON array)'),
  ('donchian.good_entry_threshold',  '30',                      'number',  'trading',  'Good Entry Threshold (%)',          'Position % at or below which a BUY-rated stock is flagged as a Good Entry')
    
ON CONFLICT (key) DO NOTHING;