-- CR-113 item 4 — Ontology Management's own "Add/Save" per group/tab, on a
-- genuinely new code (no prior version at all), now inserts the concept as
-- 'Draft' instead of 'Active' and publishes OntologyComposed instead of
-- ConceptCreated (see core/ontology.ts addConcept). Widening the status
-- check to admit the new value.
ALTER TABLE ontology_concepts DROP CONSTRAINT IF EXISTS ontology_concepts_status_check;
ALTER TABLE ontology_concepts ADD CONSTRAINT ontology_concepts_status_check
  CHECK (status IN ('Draft', 'Active', 'Deprecated', 'Retired', 'Archived'));
