BEGIN;
DROP TABLE IF EXISTS participants_master CASCADE;
CREATE TABLE participants_master (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  type              TEXT NOT NULL,
  display_name      TEXT NOT NULL,
  capabilities      JSONB NOT NULL DEFAULT '[]',
  competency        JSONB NOT NULL DEFAULT '{}',
  behaviour_context JSONB NOT NULL DEFAULT '[]',
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  user_id           UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE participants_master ADD COLUMN IF NOT EXISTS cost NUMERIC;
ALTER TABLE participants_master ADD COLUMN IF NOT EXISTS authorised_role JSONB NOT NULL DEFAULT '[]';
ALTER TABLE participants_master
  ALTER COLUMN authorised_role SET DEFAULT '[{"role":"general","effective_till":"9999-12-31","seu_ids":[]}]'::jsonb;
ALTER TABLE participants_master ADD COLUMN IF NOT EXISTS authorised_badges JSONB NOT NULL DEFAULT '[]';
-- ALTER TABLE tenants
--   ADD CONSTRAINT tenants_author_id_fkey FOREIGN KEY (author_id) REFERENCES participants_master(id);
GRANT ALL PRIVILEGES ON TABLE participants_master TO weirdo;
COMMIT;
