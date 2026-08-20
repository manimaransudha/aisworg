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
UPDATE ontology_concepts
   SET code = 'requirements-specification'
 WHERE concept_type = 'deliverable-name' AND code = 'Requirements Specification';

UPDATE ontology_concepts
   SET code = 'solution-architecture-document', default_label = 'Solution / Architecture Document'
 WHERE concept_type = 'deliverable-name' AND code = 'Architecture Document';

UPDATE ontology_concepts
   SET code = 'source-code'
 WHERE concept_type = 'deliverable-name' AND code = 'Source Code';

INSERT INTO ontology_concepts (concept_type, code, default_label) VALUES
  ('deliverable-name', 'requirements-specification', 'Requirements Specification'),
  ('deliverable-name', 'solution-architecture-document', 'Solution / Architecture Document'),
  ('deliverable-name', 'ux-ui-design-specification', 'UX/UI Design Specification'),
  ('deliverable-name', 'api-specification', 'API Specification'),
  ('deliverable-name', 'source-code', 'Source Code'),
  ('deliverable-name', 'database-schema-data-model', 'Database Schema / Data Model'),
  ('deliverable-name', 'integration-specification-interface-contracts', 'Integration Specification / Interface Contracts'),
  ('deliverable-name', 'configuration-files', 'Configuration Files'),
  ('deliverable-name', 'test-suite', 'Test Suite'),
  ('deliverable-name', 'test-report-results', 'Test Report / Results'),
  ('deliverable-name', 'security-assessment-report', 'Security Assessment Report'),
  ('deliverable-name', 'performance-load-test-report', 'Performance / Load Test Report'),
  ('deliverable-name', 'deployment-package', 'Deployment Package'),
  ('deliverable-name', 'infrastructure-as-code-environment-configuration', 'Infrastructure-as-Code / Environment Configuration'),
  ('deliverable-name', 'ci-cd-pipeline-definition', 'CI/CD Pipeline Definition'),
  ('deliverable-name', 'monitoring-alerting-configuration', 'Monitoring & Alerting Configuration'),
  ('deliverable-name', 'runbook-operational-documentation', 'Runbook / Operational Documentation'),
  ('deliverable-name', 'incident-report-post-mortem', 'Incident Report / Post-mortem'),
  ('deliverable-name', 'user-technical-documentation', 'User / Technical Documentation'),
  ('deliverable-name', 'knowledge-base-articles', 'Knowledge Base Articles'),
  ('deliverable-name', 'compliance-audit-evidence', 'Compliance / Audit Evidence'),
  ('deliverable-name', 'data-migration-plan', 'Data Migration Plan'),
  ('deliverable-name', 'release-notes-change-log', 'Release Notes / Change Log')
ON CONFLICT (concept_type, code) DO NOTHING;
