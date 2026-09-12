-- Owner: "All configuration parameters in the profile should have been
-- ontology driven. If typescript is not in Ontology, that should have not
-- been allowed for selection." `primaryProgrammingLanguage`'s own value
-- ("typescript", among the 6 seeded by migration 174) is a valid
-- `primary-programming-language` concept but had no matching `technology`
-- concept — the competency dimension CR-101 unions it into at EBM
-- composition — so it silently entered a SEU's Technology competency
-- requirement as a value no real Participant or Pack `technology`
-- competency could ever hold. Every other `primary-programming-language`
-- value (javascript/python/java/csharp/go) already has a `technology`
-- counterpart (migration 196) — `typescript` was the one gap. Closes it as
-- real data; `validateProfileSeed`'s own new cross-vocabulary check
-- (core/profiles.ts) now also blocks this class of gap from being
-- introduced again at Profile-publish time.
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id, text_type, ui_grouping) VALUES
  ('technology', 'typescript', 'TypeScript', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies')
ON CONFLICT (concept_type, code, tenant_id, version) DO NOTHING;
