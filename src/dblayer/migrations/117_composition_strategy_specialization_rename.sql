-- CR-067 — "The alias and specialisation are the same. So let us call it
-- Specialization" (resolves a naming collision with Ontology's own,
-- unrelated "Alias" concept — Ch.18 §7 organisation-specific terminology
-- synonyms). Renamed in place (UPDATE, not delete+insert) — no seed data
-- references the old `alias` code (confirmed by search), so this is a clean
-- rename with nothing left pointing at the old value.
UPDATE ontology_concepts
   SET code = 'specialization',
       default_label = 'Specialization',
       description = 'Creation is an exact copy of the parent — one originating id. Code and/or name may be changed (a code change is registered into the Ontology); every other field may be changed or left as-is, free to diverge in any direction once created. Starts at version 1.0.0, goes through the same entity lifecycle as any other instance of its type. The mechanism behind Template''s own "inheritance" and Profile''s own "inherit from other Profiles," generalised.'
 WHERE concept_type = 'composition-strategy' AND code = 'alias' AND tenant_id = '11111111-1111-1111-1111-111111111111';

-- CR-067 — "Conflict Detection... not an independent, author-selectable
-- strategy. It's the escalation path inside Merge and Union." Retired
-- (is_active = FALSE), not deleted — listConceptsForType's own default
-- (includeInactive: false) removes it from every picker without losing the
-- row's own description/labeling elsewhere.
UPDATE ontology_concepts
   SET is_active = FALSE
 WHERE concept_type = 'composition-strategy' AND code = 'conflict-detection' AND tenant_id = '11111111-1111-1111-1111-111111111111';
