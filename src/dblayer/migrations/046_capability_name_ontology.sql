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
UPDATE ontology_concepts
   SET code = 'architecture-solution-design', default_label = 'Architecture / Solution Design'
 WHERE concept_type = 'capability-name' AND code = 'architecture';

INSERT INTO ontology_concepts (concept_type, code, default_label) VALUES
  ('capability-name', 'requirements-analysis', 'Requirements Analysis'),
  ('capability-name', 'architecture-solution-design', 'Architecture / Solution Design'),
  ('capability-name', 'ux-ui-design', 'UX/UI Design'),
  ('capability-name', 'development', 'Development'),
  ('capability-name', 'data-engineering', 'Data Engineering'),
  ('capability-name', 'integration-engineering', 'Integration Engineering (third-party/APIs)'),
  ('capability-name', 'testing-qa', 'Testing / QA'),
  ('capability-name', 'security-engineering', 'Security Engineering'),
  ('capability-name', 'performance-engineering', 'Performance Engineering'),
  ('capability-name', 'configuration-management', 'Configuration Management'),
  ('capability-name', 'infrastructure-management', 'Infrastructure Management'),
  ('capability-name', 'production-deployment-release-management', 'Production Deployment / Release Management'),
  ('capability-name', 'monitoring-observability-sre', 'Monitoring & Observability (SRE)'),
  ('capability-name', 'production-support-incident-management', 'Production Support / Incident Management'),
  ('capability-name', 'devops-ci-cd-engineering', 'DevOps / CI-CD Engineering'),
  ('capability-name', 'documentation', 'Documentation'),
  ('capability-name', 'knowledge-management', 'Knowledge Management'),
  ('capability-name', 'compliance-audit', 'Compliance / Audit'),
  ('capability-name', 'data-migration', 'Data Migration'),
  ('capability-name', 'change-management', 'Change Management')
ON CONFLICT (concept_type, code) DO NOTHING;
