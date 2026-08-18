-- Bug fix (corrects CR-014): authoring is entity-direct — a Pack/Template/
-- Profile is authored as a Draft row of that entity itself, driven through its
-- own noun_verb transitions by the REAL author (no bootstrap-SEU/Deliverable
-- indirection, no system actor). `authored_by` records which user is authoring
-- a given draft so the authoring surface can show "my drafts" and filter the
-- per-verb tabs to the logged-in author. Nullable + additive: rows seeded by
-- migrations/CLI (no human author) and every pre-existing row stay valid.
ALTER TABLE packs     ADD COLUMN IF NOT EXISTS authored_by BIGINT;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS authored_by BIGINT;
ALTER TABLE profiles  ADD COLUMN IF NOT EXISTS authored_by BIGINT;

CREATE INDEX IF NOT EXISTS idx_packs_authored_by     ON packs (authored_by);
CREATE INDEX IF NOT EXISTS idx_templates_authored_by ON templates (authored_by);
CREATE INDEX IF NOT EXISTS idx_profiles_authored_by  ON profiles (authored_by);

-- A Pack Draft holds its work-in-progress in its own real columns
-- (contributions/dependencies/metadata). Templates and Profiles have thinner
-- schemas and materialise their authored form content into join tables
-- (template_capabilities/template_packs/profile_packs) only at publish, so a
-- Draft needs somewhere to keep the raw authored form content (including
-- not-yet-resolvable capability/Pack codes) between saves. draft_content is
-- that scratch area; it is materialised into the real columns/join tables when
-- the Draft is published, and ignored thereafter.
ALTER TABLE templates ADD COLUMN IF NOT EXISTS draft_content JSONB NOT NULL DEFAULT '{}';
ALTER TABLE profiles  ADD COLUMN IF NOT EXISTS draft_content JSONB NOT NULL DEFAULT '{}';
