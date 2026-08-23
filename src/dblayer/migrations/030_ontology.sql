-- Ontology Model (Alias Vocabulary) — Plan (design/mvp-build-plan/Ontology
-- Plan.md), Phase 17 (Ch.18). A platform/Pack-owned canonical vocabulary with a
-- per-tenant rename-only alias layer. Identity is canonical and stored on every
-- row; the tenant's label is a read-time presentation concern (§0.1) — the core
-- reads/writes canonical codes only and never branches on a tenant label.
--
-- The canonical code IS the existing category string (default_label = same), so
-- existing rows are grandfathered automatically (no data migration) and current
-- writes pass; only genuinely novel values are rejected on the write path.
CREATE TABLE IF NOT EXISTS ontology_concepts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_type        TEXT NOT NULL,   -- category:deliverable | category:evidence | category:decision | category:knowledge | category:obligation | category:policy | deliverable-name | capability-name
  code                TEXT NOT NULL,   -- canonical identity (the stored value)
  default_label       TEXT NOT NULL,   -- platform default display label
  contributed_by_pack UUID REFERENCES packs(id),   -- null = platform default; set when a Pack contributes a concept (step 5, deferred)
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ontology_concepts_type_code_unique UNIQUE (concept_type, code)
);

-- The per-tenant relabelling. Absence => use ontology_concepts.default_label.
CREATE TABLE IF NOT EXISTS tenant_concept_aliases (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id),
  concept_type   TEXT NOT NULL,
  canonical_code TEXT NOT NULL,
  display_label  TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_concept_aliases_unique UNIQUE (tenant_id, concept_type, canonical_code)
);

-- Platform-default canonical set = the de-facto vocabulary currently in use
-- (code = string). Generous by design: over-inclusion only means fewer
-- rejections, never a broken existing write.
--
-- CR-059 build-time fix — superseded by migration 055 (CR-022 tenant
-- scoping): the unique constraint this INSERT's own ON CONFLICT targeted
-- widened from (concept_type, code) to (concept_type, code, tenant_id), and
-- tenant_id itself gained NOT NULL with no column default (055's own
-- backfill was a one-time UPDATE, not a DEFAULT) — so on replay this INSERT
-- failed twice over: no matching arbiter constraint, then a NOT NULL
-- violation once that's fixed. Explicit Platform tenant_id + the 3-column
-- ON CONFLICT below restore both, matching every other Platform-seeded
-- Ontology INSERT added after 055.
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('category:evidence', 'Validation Evidence', 'Validation Evidence', '11111111-1111-1111-1111-111111111111'),
  ('category:evidence', 'Analytical Evidence', 'Analytical Evidence', '11111111-1111-1111-1111-111111111111'),
  ('category:evidence', 'Validation', 'Validation', '11111111-1111-1111-1111-111111111111'),
  ('category:evidence', 'Review', 'Review', '11111111-1111-1111-1111-111111111111'),
  ('category:evidence', 'Test', 'Test', '11111111-1111-1111-1111-111111111111'),
  ('category:evidence', 'Technical', 'Technical', '11111111-1111-1111-1111-111111111111'),
  ('category:decision', 'Engineering Decisions', 'Engineering Decisions', '11111111-1111-1111-1111-111111111111'),
  ('category:decision', 'Design Decisions', 'Design Decisions', '11111111-1111-1111-1111-111111111111'),
  ('category:knowledge', 'Domain Knowledge', 'Domain Knowledge', '11111111-1111-1111-1111-111111111111'),
  ('category:knowledge', 'Technical Knowledge', 'Technical Knowledge', '11111111-1111-1111-1111-111111111111'),
  ('category:knowledge', 'Technical', 'Technical', '11111111-1111-1111-1111-111111111111'),
  ('category:knowledge', 'Test', 'Test', '11111111-1111-1111-1111-111111111111'),
  ('category:obligation', 'Security', 'Security', '11111111-1111-1111-1111-111111111111'),
  ('category:obligation', 'Engineering', 'Engineering', '11111111-1111-1111-1111-111111111111'),
  ('category:obligation', 'Compliance', 'Compliance', '11111111-1111-1111-1111-111111111111'),
  ('category:obligation', 'Organisational Learning', 'Organisational Learning', '11111111-1111-1111-1111-111111111111'),
  ('category:obligation', 'Review Finding', 'Review Finding', '11111111-1111-1111-1111-111111111111'),
  ('category:deliverable', 'Documentation', 'Documentation', '11111111-1111-1111-1111-111111111111'),
  ('category:deliverable', 'Implementation', 'Implementation', '11111111-1111-1111-1111-111111111111'),
  ('category:deliverable', 'Architecture', 'Architecture', '11111111-1111-1111-1111-111111111111'),
  ('category:deliverable', 'Design', 'Design', '11111111-1111-1111-1111-111111111111'),
  ('category:deliverable', 'Requirements', 'Requirements', '11111111-1111-1111-1111-111111111111'),
  ('category:policy', 'Coding Standard', 'Coding Standard', '11111111-1111-1111-1111-111111111111'),
  ('category:policy', 'Documentation', 'Documentation', '11111111-1111-1111-1111-111111111111'),
  ('category:policy', 'Domain Standard', 'Domain Standard', '11111111-1111-1111-1111-111111111111'),
  ('category:policy', 'Domain', 'Domain', '11111111-1111-1111-1111-111111111111'),
  ('category:policy', 'Engineering', 'Engineering', '11111111-1111-1111-1111-111111111111'),
  ('category:policy', 'Exit', 'Exit', '11111111-1111-1111-1111-111111111111'),
  ('category:policy', 'Implementation', 'Implementation', '11111111-1111-1111-1111-111111111111'),
  ('category:policy', 'Platform', 'Platform', '11111111-1111-1111-1111-111111111111'),
  ('category:policy', 'Quality', 'Quality', '11111111-1111-1111-1111-111111111111'),
  ('category:policy', 'Technology', 'Technology', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'requirements-analysis', 'Requirements Analysis', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'development', 'Development', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id) DO NOTHING;

-- CR-059 build-time fix — 'deliverable-name' 'Requirements Specification'/
-- 'Architecture Document'/'Source Code' and 'capability-name' 'architecture'
-- removed outright, not just left for 046/048 to rename: migrations 046/048
-- immediately supersede all 4 (real vocabulary, "zero consumers anywhere in
-- the codebase" for the originals), and this file kept re-inserting them
-- under their original codes on every replay — 046/048's own rename UPDATEs
-- then collided with their own already-renamed target on any replay after
-- the first, a real, observed failure (needed defensive DELETE guards there
-- too, kept as a backstop). Removing the source of the resurrection here is
-- the actual fix; 046/048's guards are defense in depth.
