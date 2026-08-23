-- Ontology (Ch.18) — tenant-scoped concepts. Owner, 2026-08-19 (CR-022):
-- "Include tenant_id as part of Ontology. So platform ones will be visible
-- to all + their own vocabulary." Same shape Pack already has (migration
-- 044): a Platform-tenant row is canonical/shared, a tenant's own row is
-- theirs alone — nobody overwrites anybody, uniqueness scoped per owner
-- instead of global.
--
-- All 8 concept_types seeded so far (category:*, capability-name,
-- deliverable-name, category:pack, installation-classification,
-- template-categories) are genuinely platform-canonical today — backfilled
-- to the Platform tenant, not left NULL/ambiguous.
-- CR-059 build-time fix — none of these 4 statements were replay-safe
-- (no IF NOT EXISTS / IF EXISTS guards): a second replay failed outright on
-- "column tenant_id already exists" before ever reaching the DROP/ADD
-- CONSTRAINT pair below, same "run.ts replays every file every boot"
-- contract every other migration in this file is held to.
ALTER TABLE ontology_concepts ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE ontology_concepts SET tenant_id = '11111111-1111-1111-1111-111111111111' WHERE tenant_id IS NULL;
ALTER TABLE ontology_concepts ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE ontology_concepts DROP CONSTRAINT IF EXISTS ontology_concepts_type_code_unique;
ALTER TABLE ontology_concepts DROP CONSTRAINT IF EXISTS ontology_concepts_type_code_tenant_unique;
ALTER TABLE ontology_concepts ADD CONSTRAINT ontology_concepts_type_code_tenant_unique UNIQUE (concept_type, code, tenant_id);
