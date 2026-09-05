-- Ontology (Ch.18) — deliverable-name concepts, reworked (owner, 2026-09-03,
-- alongside the CR-086 capability/service rework: a canonical Deliverable
-- list highlighted against Book 3, deduplicated against this migration's own
-- original 23-item seed).
--
-- Same discipline as capability-name's own full rewrite (migration 046):
-- DELETE-then-INSERT rather than the original's rename-in-place UPDATE, so
-- this migration is naturally idempotent across replays. code is
-- lowercase-hyphenated, default_label carries the exact human wording.
--
-- All 23 original codes/labels are carried over UNCHANGED — nothing here was
-- renamed or dropped, only added to — so this replace has zero impact on any
-- Template's already-seeded `deliverableCatalogue`/`dependencyGraph` entries
-- (CR-049's own guarantee: those reference these codes directly, no
-- migration needed for existing seed data). 31 new codes added, deduplicated
-- against the highlighted list — several of the highlighted items turned out
-- to just be reworded versions of an existing entry (e.g. "Architecture" =
-- solution-architecture-document, "Test Results" = test-report-results) and
-- were folded in rather than duplicated; "Deployment Manifest," "Technical
-- Notes," "Root Cause Analysis Report," and "Release Package" were confirmed
-- by the owner as genuinely distinct from their nearest existing neighbour
-- (infrastructure-as-code-environment-configuration, user-technical-
-- documentation, incident-report-post-mortem, and deployment-package
-- respectively) and kept as their own codes. A further 8 codes (system-model
-- through capability-evolution-roadmap) were added afterward, surfaced while
-- remapping `service_definitions.inputs`/`outputs` onto this vocabulary —
-- genuine document/record-shaped deliverables the Service catalog produces
-- that the Book highlight pass hadn't listed. 62 total; a further 9 (CR-087,
-- see this file's own trailing comment above the final INSERT block) brings
-- it to 71.
--
-- CR-049 note: `deliverable-name` concepts are a derived mirror of the
-- `deliverable_definitions` catalog (synced on Active/retire,
-- core/deliverableDefinitions.ts) — this migration only touches the Ontology
-- side. migration 084's own backfill (`... AND NOT EXISTS (SELECT 1 FROM
-- deliverable_definitions dd WHERE dd.code = oc.code AND dd.tenant_id =
-- oc.tenant_id)`) already re-runs safely on top of this: it will insert a
-- deliverable_definitions row for each of the 31 new codes below and leave
-- the 23 existing rows (and any tenant-derived children of them) completely
-- untouched. No edit to 084 needed or wanted — deleting/reinserting
-- deliverable_definitions would reissue surrogate ids for rows
-- parent_deliverable_definition_id may already point at.

-- DELETE FROM ontology_concepts WHERE concept_type = 'deliverable-name' AND tenant_id = '11111111-1111-1111-1111-111111111111';

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
  ('deliverable-name', 'release-notes-change-log', 'Release Notes / Change Log', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'domain-model', 'Domain Model', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'vision', 'Vision', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'requirements-analysis-model', 'Requirements Analysis Model', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'business-analysis-plan', 'Business Analysis Plan', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'requirements-backlog', 'Requirements Backlog', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'requirements-prioritisation-record', 'Requirements Prioritisation Record', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'solution-options-analysis', 'Solution Options Analysis', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'business-case', 'Business Case', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'security-design', 'Security Design', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'detailed-design-specification', 'Detailed Design Specification', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'integration-build', 'Integration Build', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'reuse-assessment', 'Reuse Assessment', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'change-request', 'Change Request', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'review-report', 'Review Report', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'defect-log', 'Defect Log', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'risk-assessment-report', 'Risk Assessment Report', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'root-cause-analysis-report', 'Root Cause Analysis Report', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'known-error-record', 'Known Error Record', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'architecture-decision-record', 'Architecture Decision Record', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'technical-notes', 'Technical Notes', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'traceability-matrix', 'Traceability Matrix', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'lessons-learned-report', 'Lessons Learned Report', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'engineering-standard', 'Engineering Standard', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'capability-maturity-assessment', 'Capability Maturity Assessment', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'policy-conflict-report', 'Policy Conflict Report', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'impact-analysis-report', 'Impact Analysis Report', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'vendor-contract', 'Vendor Contract', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'vendor-assessment', 'Vendor Assessment', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'objective-alignment-report', 'Objective Alignment Report', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'deployment-manifest', 'Deployment Manifest', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'release-package', 'Release Package', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'system-model', 'System Model', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'decision-record', 'Decision Record', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'configuration-baseline-record', 'Configuration Baseline Record', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'confidence-assessment', 'Confidence Assessment', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'operational-intelligence-report', 'Operational Intelligence Report', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'benchmark-report', 'Benchmark Report', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'vendor-performance-record', 'Vendor Performance Record', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'capability-evolution-roadmap', 'Capability Metrics / Evolution Roadmap', '11111111-1111-1111-1111-111111111111'),
  -- CR-087 — 9 codes added 2026-09-03: 8 for the 3 new capabilities
  -- (training-and-evaluating-models/engineering-embedded-firmware/
  -- engineering-data-pipelines, migration 046) each of their real Service
  -- Definitions (migration 161) produces, plus 1 for Mobile Application's own
  -- gap — confirmed NOT a new-capability case, just a new deliverable under
  -- the already-available software-release capability.
  ('deliverable-name', 'training-data-specification', 'Training Data Specification', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'model-card', 'Model Card', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'model-evaluation-report', 'Model Evaluation Report', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'firmware-build', 'Firmware Build', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'hardware-interface-specification', 'Hardware Interface Specification', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'hardware-compatibility-report', 'Hardware Compatibility Report', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'data-pipeline-specification', 'Data Pipeline Specification', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'data-quality-report', 'Data Quality Report', '11111111-1111-1111-1111-111111111111'),
  ('deliverable-name', 'app-store-submission-package', 'App Store Submission Package', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id) DO NOTHING;
