-- Ontology (Ch.18) — generic `description` on ontology_concepts. Owner,
-- 2026-08-19 (CR-023): "For each of the template category add a text as
-- [describing] when the template can be used" — needs a place to live.
-- `default_label` is a short display label (e.g. "Enterprise Web
-- Application"); `description` is the longer "when to use this" guidance
-- text. Generic (nullable, any concept_type) rather than special-cased to
-- template-categories — the same discipline as every other Ontology column
-- (is_active, tenant_id): one shared shape for every concept, not a
-- per-concept-type table.
ALTER TABLE ontology_concepts ADD COLUMN description TEXT;
