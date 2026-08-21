-- CR-043 — dependency_definitions generalises from a single, hardcoded
-- template_id owner to a polymorphic (owning_entity_type, owning_entity_id)
-- pair, matching the related_object_type/related_object_id pattern already
-- used for Obligation/Evidence/Decision/Review/Finding. A rule can now be
-- authored on a Template (a fact about that Template's own catalogue), a
-- Pack (applies wherever that Pack gets composed, across every Template
-- that pulls it in — the shape qualityGateEngine's Pack-contributed quality
-- gates already have), or a Profile (environment-specific). No real FK —
-- Postgres can't conditionally target three different tables from one
-- column, same tradeoff the existing polymorphic columns already accept.
-- This means the old ON DELETE CASCADE off templates.id is gone; cleanup on
-- Template/Profile/Pack deletion is now an explicit step (cleanSlate.ts),
-- not automatic.
ALTER TABLE dependency_definitions ADD COLUMN owning_entity_type TEXT;
ALTER TABLE dependency_definitions ADD COLUMN owning_entity_id UUID;

UPDATE dependency_definitions SET owning_entity_type = 'Template', owning_entity_id = template_id;

ALTER TABLE dependency_definitions ALTER COLUMN owning_entity_type SET NOT NULL;
ALTER TABLE dependency_definitions ALTER COLUMN owning_entity_id SET NOT NULL;
ALTER TABLE dependency_definitions ADD CONSTRAINT dependency_definitions_owning_entity_type_check
  CHECK (owning_entity_type IN ('Template', 'Pack', 'Profile'));

DROP INDEX IF EXISTS idx_dependency_definitions_target;
DROP INDEX IF EXISTS idx_dependency_definitions_source;
ALTER TABLE dependency_definitions DROP COLUMN template_id;

-- Narrower on the leading columns than the old template_id-first index: a
-- gating/push query is always a (to_entity_type, to_name, to_state) or
-- (from_entity_type, from_name, from_state) lookup first, then filtered down
-- by an OR/IN across however many owning scopes are relevant to one SEU
-- (its Template + every composed Pack + its Profile) — that filter doesn't
-- benefit from being the index's leading column the way a single equality
-- check on one template_id did.
CREATE INDEX IF NOT EXISTS idx_dependency_definitions_target
  ON dependency_definitions (to_entity_type, to_name, to_state);

CREATE INDEX IF NOT EXISTS idx_dependency_definitions_source
  ON dependency_definitions (from_entity_type, from_name, from_state);

-- The "everything owned by X" shape (deleteByOwner, findByOwner — replacing
-- findByTemplateId/deleteByTemplateId).
CREATE INDEX IF NOT EXISTS idx_dependency_definitions_owner
  ON dependency_definitions (owning_entity_type, owning_entity_id);
