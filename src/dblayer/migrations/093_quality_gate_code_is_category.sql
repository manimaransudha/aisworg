-- CR-058 follow-up 2 — owner: "The gate's code = the category it gates.
-- Given 'one gate per category' (just confirmed), the code isn't a UUID or
-- a freeform Pack-specific string — it's the category identifier itself,
-- drawn from the same Ontology-governed vocabulary as Ch.17 §7's Evidence
-- Categories: analytical, validation, operational, review, decision,
-- external."
--
-- Confirmed against the primary source (Ch.17 §7): all 6 canonical values
-- (Analytical/Validation/Operational/Review/Decision/External Evidence)
-- already exist live in category:evidence — reused directly, not
-- duplicated into the now-retired category:quality-gate concept type
-- (migration 091's 5 seeded values were the wrong vocabulary: Ch.26 §7's
-- own illustrative lifecycle-stage list, not the evidence-category list
-- "one gate per category" was actually about all along). The 4 extra
-- drifted category:evidence values ("Review", "Technical", "Test",
-- "Validation" — not matching the chapter's own 6) are a pre-existing
-- Evidence-model gap, left untouched here — not this CR's scope to clean up
-- a vocabulary other entities already consume.
DELETE FROM ontology_concepts WHERE concept_type = 'category:quality-gate';

-- code is no longer independently meaningful (it now always mirrors
-- category) — the real versioning-identity key becomes the full slot +
-- category + version tuple. A bare (code, version) uniqueness no longer
-- makes sense once the same category string can legitimately appear on
-- many different transitions (a "Review Evidence" gate on Deliverable's
-- transition and a separate "Review Evidence" gate on Pack's are not the
-- same gate and must not collide on identity).
ALTER TABLE quality_gates DROP CONSTRAINT IF EXISTS quality_gates_code_version_key;
ALTER TABLE quality_gates DROP CONSTRAINT IF EXISTS quality_gates_scope_category_version_key;
ALTER TABLE quality_gates ADD CONSTRAINT quality_gates_scope_category_version_key UNIQUE (entity_type, from_state, to_state, category, version);

-- Pack authoring schema: category now sources from category:evidence
-- (reused, not a separate vocabulary); criteriaCategory is removed
-- entirely — it was redundant with the gate's own category once category
-- IS the thing requires_accepted_review/requires_accepted_evidence_or_
-- approved_decision filter by.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema #- '{properties,contributionQualityGates,items,properties,criteriaCategory}',
                  '{properties,contributionQualityGates,items,properties,category}',
                  '{"type": "string", "x-referential": "category:evidence"}'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');
