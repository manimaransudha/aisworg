-- Fixes a real bug found running CR-109's own new tests: workItemGenerator.ts
-- matched Profile knowledgeLocations[].deliverableCode against
-- deliverables.name — but deliverables.name is always the resolved Ontology
-- LABEL ("Source Code"), never the raw catalogue CODE ("source-code")
-- knowledgeLocations is actually keyed by (commissioning.ts's own
-- resolveLabels(tenantId, "deliverable-name") call, confirmed against
-- migration 048's real seed data). Labels are display text, not canonical —
-- they must never be the join key. Deliverables never had anywhere to store
-- their own originating catalogue code at all; this adds it.
ALTER TABLE deliverables
  ADD COLUMN IF NOT EXISTS code TEXT;

COMMENT ON COLUMN deliverables.code IS 'The deliverable-name Ontology code this row was created from (commissioning.ts''s own deliverableCatalogue entry). Null for the separate manual "add a Deliverable to a live SEU" path, which has no catalogue entry to draw one from. Canonical join key — deliverables.name is a display label only, never queried against.';
