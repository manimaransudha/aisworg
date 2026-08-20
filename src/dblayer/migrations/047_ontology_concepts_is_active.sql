-- Ontology CRUD (owner, 2026-08-18: "Each of the concept_types should have a
-- CRUD UI... any further additions will be data changes"). ontology_concepts
-- had no is_active column — every other governed vocabulary in this codebase
-- (authority_nouns/authority_verbs, pack_category) is "add + soft-retire,
-- never hard delete" (existing rows/FKs stay intact; a retired row just
-- drops out of the "add new" pickers). Bringing ontology_concepts to the same
-- discipline rather than inventing a different one for this table alone.
ALTER TABLE ontology_concepts ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
