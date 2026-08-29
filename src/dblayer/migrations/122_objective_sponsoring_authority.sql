-- CR-071: Sponsoring Authority — a JSONB tenant-attribution field on every
-- Objective (not just Strategic roots), deliberately open-ended so a later
-- multi-tenancy phase (Phase 12) can add more than `{ tenant: tenant_id }`
-- without a schema change.
--
-- No NOT NULL/CHECK, deliberately — same app-enforced-not-schema-enforced
-- treatment CR-068 already established for objectives.requested_by.
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS sponsoring_authority JSONB;
