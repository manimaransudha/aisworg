-- Ontology (Ch.18) — capability-name concepts. Owner, 2026-08-18: "Capability
-- packs are essentially process fragments done by a team... The platform
-- uses code to identify the process fragment. The tenants may use the same
-- process, but call it by a different name." First concept_type to actually
-- get real content (it was seeded with 3 illustrative rows in migration 030
-- and never touched again — zero consumers anywhere in the codebase).
--
-- Naming discipline (owner: "simple rules. small case no spaces"): code is
-- lowercase-hyphenated; default_label carries the exact human wording. No
-- separate concept_types governance table (owner: "there will be no end to
-- this" — CRUD lands directly on ontology_concepts, this migration is only
-- the initial seed, not the only way in).
--
-- The 3 existing capability-name rows overlap this list — owner confirmed
-- "nothing that is live, so safe to" fold them in rather than leave
-- near-duplicates. "requirements-analysis" and "development" already match
-- the new wording exactly (no change needed); "architecture" becomes
-- "architecture-solution-design" to match "Architecture / Solution Design".
-- Scoped to the ontology_concepts row ONLY — the real `capabilities.code =
-- 'architecture'` row (referenced by ~30 test files + 3 seed JSON files) is
-- untouched: nothing consumes capability-name concepts today, so this rename
-- has zero blast radius; reconciling real capability codes with these
-- canonical names is the later "code engine" step, not this one.
-- CR-059 build-time fix — migration 030 (the ORIGINAL 'architecture' row's
-- source) unconditionally re-INSERTs it on every replay (ON CONFLICT DO
-- NOTHING only guards against a duplicate 'architecture' row, not against
-- recreating one this migration already renamed away) — so on a second
-- replay, this UPDATE's own target ('architecture-solution-design') already
-- exists from the FIRST replay, and renaming the freshly-resurrected
-- 'architecture' row into it violates the unique constraint outright. Any
-- stale resurrected 'architecture' row is deleted first when the real,
-- renamed target already exists; the UPDATE then handles the normal
-- (first-run) case safely.
DELETE FROM ontology_concepts a
 WHERE a.concept_type = 'capability-name' AND a.code = 'architecture'
   AND EXISTS (
     SELECT 1 FROM ontology_concepts b
      WHERE b.concept_type = 'capability-name' AND b.code = 'architecture-solution-design' AND b.tenant_id = a.tenant_id
   );

UPDATE ontology_concepts
   SET code = 'architecture-solution-design', default_label = 'Architecture / Solution Design'
 WHERE concept_type = 'capability-name' AND code = 'architecture';

INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('capability-name', 'requirements-analysis', 'Requirements Analysis', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'architecture-solution-design', 'Architecture / Solution Design', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'ux-ui-design', 'UX/UI Design', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'development', 'Development', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'data-engineering', 'Data Engineering', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'integration-engineering', 'Integration Engineering (third-party/APIs)', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'testing-qa', 'Testing / QA', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'security-engineering', 'Security Engineering', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'performance-engineering', 'Performance Engineering', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'configuration-management', 'Configuration Management', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'infrastructure-management', 'Infrastructure Management', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'production-deployment-release-management', 'Production Deployment / Release Management', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'monitoring-observability-sre', 'Monitoring & Observability (SRE)', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'production-support-incident-management', 'Production Support / Incident Management', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'devops-ci-cd-engineering', 'DevOps / CI-CD Engineering', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'documentation', 'Documentation', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'knowledge-management', 'Knowledge Management', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'compliance-audit', 'Compliance / Audit', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'data-migration', 'Data Migration', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'change-management', 'Change Management', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'code-review', 'Code Review', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'catalog-management', 'Catalog Management', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'circulation-management', 'Circulationtalog Management', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id) DO NOTHING;

-- CR-059 build-time fix — same class of bug already fixed in migration
-- 030: superseded by migration 055's tenant-scoping (ON CONFLICT target
-- widened to (concept_type, code, tenant_id), tenant_id gained NOT NULL
-- with no column default). Diagnosed once already this session but the
-- fix was never actually applied to this file — caught on a later full
-- replay. Explicit Platform tenant_id + the 3-column ON CONFLICT restore
-- both, matching migration 030's own fix.
