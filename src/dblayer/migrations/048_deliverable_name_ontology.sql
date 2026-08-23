-- Ontology (Ch.18) — deliverable-name concepts. Owner, 2026-08-19: "Add these
-- to the deliverable-name concept_type" (23-item list). Same situation as
-- capability-name (migration 046): concept_type='deliverable-name' had 3
-- illustrative rows from migration 030 seeded with the human wording AS the
-- code ("Requirements Specification", "Architecture Document", "Source
-- Code") and zero consumers anywhere in the codebase (confirmed via grep —
-- nothing reads concept_type='deliverable-name'; the platform's real
-- Deliverable.name values are a separate, unrelated column seeded straight
-- from Template/Pack JSON, untouched by this migration).
--
-- Folding the 3 existing rows into the new list under the same naming
-- discipline settled for capability-name ("simple rules. small case no
-- spaces"): lowercase-hyphenated code, default_label carries the exact human
-- wording. "Requirements Specification" and "Source Code" keep their wording
-- (only the code changes); "Architecture Document" becomes
-- "solution-architecture-document" to match the new list's "Solution /
-- Architecture Document". Zero blast radius — no code, view, or test reads
-- these codes today.
-- CR-059 build-time fix — same resurrection bug as migration 046: migration
-- 030 unconditionally re-INSERTs these 3 rows under their original
-- human-wording codes on every replay (ON CONFLICT DO NOTHING only guards
-- against re-inserting a duplicate, not against recreating one already
-- renamed away here) — so once a rename's target already exists (from a
-- prior successful replay), renaming the freshly-resurrected original row
-- into it violates the unique constraint. Any such resurrected row is
-- deleted first; the UPDATE then handles the normal (first-run) case.
DELETE FROM ontology_concepts a
 WHERE a.concept_type = 'deliverable-name' AND a.code = 'Requirements Specification'
   AND EXISTS (SELECT 1 FROM ontology_concepts b WHERE b.concept_type = 'deliverable-name' AND b.code = 'requirements-specification' AND b.tenant_id = a.tenant_id);
UPDATE ontology_concepts
   SET code = 'requirements-specification'
 WHERE concept_type = 'deliverable-name' AND code = 'Requirements Specification';

DELETE FROM ontology_concepts a
 WHERE a.concept_type = 'deliverable-name' AND a.code = 'Architecture Document'
   AND EXISTS (SELECT 1 FROM ontology_concepts b WHERE b.concept_type = 'deliverable-name' AND b.code = 'solution-architecture-document' AND b.tenant_id = a.tenant_id);
UPDATE ontology_concepts
   SET code = 'solution-architecture-document', default_label = 'Solution / Architecture Document'
 WHERE concept_type = 'deliverable-name' AND code = 'Architecture Document';

DELETE FROM ontology_concepts a
 WHERE a.concept_type = 'deliverable-name' AND a.code = 'Source Code'
   AND EXISTS (SELECT 1 FROM ontology_concepts b WHERE b.concept_type = 'deliverable-name' AND b.code = 'source-code' AND b.tenant_id = a.tenant_id);
UPDATE ontology_concepts
   SET code = 'source-code'
 WHERE concept_type = 'deliverable-name' AND code = 'Source Code';

INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('deliverable-name', 'requirements-specification', 'Requirements Specification', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'solution-architecture-document', 'Solution / Architecture Document', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'ux-ui-design-specification', 'UX/UI Design Specification', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'api-specification', 'API Specification', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'source-code', 'Source Code', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'database-schema-data-model', 'Database Schema / Data Model', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'integration-specification-interface-contracts', 'Integration Specification / Interface Contracts', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'configuration-files', 'Configuration Files', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'test-suite', 'Test Suite', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'test-report-results', 'Test Report / Results', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'security-assessment-report', 'Security Assessment Report', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'performance-load-test-report', 'Performance / Load Test Report', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'deployment-package', 'Deployment Package', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'infrastructure-as-code-environment-configuration', 'Infrastructure-as-Code / Environment Configuration', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'ci-cd-pipeline-definition', 'CI/CD Pipeline Definition', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'monitoring-alerting-configuration', 'Monitoring & Alerting Configuration', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'runbook-operational-documentation', 'Runbook / Operational Documentation', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'incident-report-post-mortem', 'Incident Report / Post-mortem', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'user-technical-documentation', 'User / Technical Documentation', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'knowledge-base-articles', 'Knowledge Base Articles', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'compliance-audit-evidence', 'Compliance / Audit Evidence', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'data-migration-plan', 'Data Migration Plan', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'release-notes-change-log', 'Release Notes / Change Log', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id) DO NOTHING;

-- CR-059 build-time fix — same class of bug as migrations 030/046:
-- superseded by migration 055's tenant-scoping (ON CONFLICT target
-- widened to (concept_type, code, tenant_id), tenant_id gained NOT NULL
-- with no column default). Explicit Platform tenant_id + the 3-column
-- ON CONFLICT restore both.
