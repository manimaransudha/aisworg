-- CR-107 follow-up (owner: "Add a new Platform-wide template-categories
-- concept in the ontology") — publishTemplate requires a Template's own
-- `code` to be a canonical `template-categories` concept (migration 053: one
-- Template per real category, all 9 existing ones already taken). A tenth,
-- genuinely a demo/test-fixture category, not a real business one — named
-- accordingly so it reads as such wherever the real 9 are listed (Ontology
-- Metadata page, Template registry "New Template" category picker).
--
-- text_type/ui_grouping set explicitly here, matching every existing
-- template-categories row (migration 192) directly — 192 already ran by the
-- time this migration exists, so a fresh db:clean-slate replay would insert
-- this row after 192's own bulk backfill already passed it by, leaving it
-- unset if not done here.
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id, description, text_type, ui_grouping)
VALUES (
  'template-categories',
  'cr104-demo-minimal',
  'CR-104 Demo Minimal (test fixture)',
  '11111111-1111-1111-1111-111111111111',
  'Not a real business category — a minimal 3-Capability (Requirements/Construction/Release) Template used to manually exercise CR-104/CR-107 (SEU-scoped Policy blocking, Deliverable-level gating). Do not use for real commissioning.',
  'text',
  'Templates'
)
ON CONFLICT ON CONSTRAINT ontology_concepts_type_code_tenant_version_unique DO NOTHING;
