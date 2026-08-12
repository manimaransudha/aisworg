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
INSERT INTO ontology_concepts (concept_type, code, default_label) VALUES
  ('category:evidence', 'Validation Evidence', 'Validation Evidence'),
  ('category:evidence', 'Analytical Evidence', 'Analytical Evidence'),
  ('category:evidence', 'Validation', 'Validation'),
  ('category:evidence', 'Review', 'Review'),
  ('category:evidence', 'Test', 'Test'),
  ('category:evidence', 'Technical', 'Technical'),
  ('category:decision', 'Engineering Decisions', 'Engineering Decisions'),
  ('category:decision', 'Design Decisions', 'Design Decisions'),
  ('category:knowledge', 'Domain Knowledge', 'Domain Knowledge'),
  ('category:knowledge', 'Technical Knowledge', 'Technical Knowledge'),
  ('category:knowledge', 'Technical', 'Technical'),
  ('category:knowledge', 'Test', 'Test'),
  ('category:obligation', 'Security', 'Security'),
  ('category:obligation', 'Engineering', 'Engineering'),
  ('category:obligation', 'Compliance', 'Compliance'),
  ('category:obligation', 'Organisational Learning', 'Organisational Learning'),
  ('category:obligation', 'Review Finding', 'Review Finding'),
  ('category:deliverable', 'Documentation', 'Documentation'),
  ('category:deliverable', 'Implementation', 'Implementation'),
  ('category:deliverable', 'Architecture', 'Architecture'),
  ('category:deliverable', 'Design', 'Design'),
  ('category:deliverable', 'Requirements', 'Requirements'),
  ('category:policy', 'Coding Standard', 'Coding Standard'),
  ('category:policy', 'Documentation', 'Documentation'),
  ('category:policy', 'Domain Standard', 'Domain Standard'),
  ('category:policy', 'Domain', 'Domain'),
  ('category:policy', 'Engineering', 'Engineering'),
  ('category:policy', 'Exit', 'Exit'),
  ('category:policy', 'Implementation', 'Implementation'),
  ('category:policy', 'Platform', 'Platform'),
  ('category:policy', 'Quality', 'Quality'),
  ('category:policy', 'Technology', 'Technology'),
  ('deliverable-name', 'Requirements Specification', 'Requirements Specification'),
  ('deliverable-name', 'Architecture Document', 'Architecture Document'),
  ('deliverable-name', 'Source Code', 'Source Code'),
  ('capability-name', 'requirements-analysis', 'Requirements Analysis'),
  ('capability-name', 'architecture', 'Architecture'),
  ('capability-name', 'development', 'Development')
ON CONFLICT (concept_type, code) DO NOTHING;
