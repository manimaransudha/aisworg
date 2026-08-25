-- CR-065 — Capability: Pack-scoped identity, version copied from the owning
-- Pack. Was: capabilities_code_key UNIQUE (code), globally unique, silently
-- clobbered across Packs on republish (ON CONFLICT (code) DO UPDATE). Owner:
-- "This is already implemented in pack model" — same mechanical fix
-- Checklist/Policy/Service already got. No FK anywhere references `code`
-- directly (all 8 downstream tables — badge_grants, deliverables, evidence,
-- execution_targets, objective_capabilities, services, seu_capabilities,
-- template_capabilities — reference the stable `id`), so this touches
-- nothing else.
--
-- version (owner: "capabilities.version just copies over the pack's
-- version") — was an inert INTEGER always 1; becomes TEXT, matching
-- packs.pack_version's own semver shape, and gets set from the owning
-- Pack's real pack_version at upsert time. Not independent versioning —
-- Capability's own version genuinely IS the owning Pack's (CR-065's own
-- "Design, as settled").
ALTER TABLE capabilities
  ALTER COLUMN version DROP DEFAULT,
  ALTER COLUMN version TYPE TEXT USING version::text;

UPDATE capabilities c
   SET version = p.pack_version
  FROM packs p
 WHERE c.originating_pack_id = p.id;

ALTER TABLE capabilities DROP CONSTRAINT IF EXISTS capabilities_code_key;
ALTER TABLE capabilities DROP CONSTRAINT IF EXISTS capabilities_pack_code_key;
ALTER TABLE capabilities ADD CONSTRAINT capabilities_pack_code_key UNIQUE (originating_pack_id, code);
