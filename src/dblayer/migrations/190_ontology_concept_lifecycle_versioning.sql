-- Ch.18 Ontology Model — real governed lifecycle + versioning for
-- ontology_concepts, replacing the flat is_active boolean. "Ontology" was
-- already a noun in authorityVocabulary.json (ontology_define authors a
-- concept) but had zero transition_definitions rows — §18.7's own audit
-- finding: "no version field, no history, is_active only hides going
-- forward." This migration is the fix, following the exact same
-- multi-version-row shape as Pack/Template/Profile/Service Definition
-- (migrations 063/117/153 etc: one row per version, unique on
-- (code, version, tenant), editing creates a new version row, the old
-- Active row auto-supersedes to Deprecated) rather than a lighter in-place
-- counter — Ch.18 §12 explicitly wants "historical Ontologies shall remain
-- available," which an in-place bump can't give.
--
-- Lifecycle: Active -> Deprecated -> Retired -> Archived (Ch.18 §11's own
-- "revised definitions" / "deprecated concepts" evolution actions), no
-- Draft/Validated/Published prefix — a concept goes live the moment it's
-- added today (no review workflow exists, §18.8), so the initial state on
-- creation is Active directly; per this codebase's own "creation authority
-- is not a transition" convention, that initial state needs no birth row in
-- transition_definitions, only the three real hops out of it do.
--
-- No skip-ahead edges (no direct Active->Retired) — same discipline
-- Pack/Template/Service Definition already hold themselves to.
-- Reactivation is not a separate edge either: for this entity "reactivating"
-- a Deprecated/Retired/Archived concept is just publishing a new Version
-- (createConceptVersion in core/ontology.ts), which lands Active and
-- supersedes whatever else is currently Active for that code — Template's
-- own reactivateAsNewVersion establishes this "reactivation is versioning,
-- not a bare state flip" precedent.
--
-- Composition (owner: "allow tenants to compose using the composition
-- strategy that packs already have implemented") — composition_strategy/
-- composition_sources are real columns here (not buried in a JSON metadata
-- blob the way Pack's own authored-draft carries them) since ontology_concepts
-- is a flat table, not a draft-authored entity. Scoped to Specialization
-- (copy a source concept's label/description into a new/own row, free to
-- diverge) + Override (this entity's own normal version-bump, just labelled)
-- — Merge/Union/Intersection/Supplement don't have clear meaning over a
-- 2-field (label, description) entity with a single composition source in
-- the common case, unlike Pack's own rich structured contributions.

-- 1. version + status, replacing is_active.
ALTER TABLE ontology_concepts ADD COLUMN IF NOT EXISTS version TEXT NOT NULL DEFAULT '1.0.0';
ALTER TABLE ontology_concepts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Active';

UPDATE ontology_concepts SET status = CASE WHEN is_active THEN 'Active' ELSE 'Retired' END;

ALTER TABLE ontology_concepts DROP CONSTRAINT IF EXISTS ontology_concepts_status_check;
ALTER TABLE ontology_concepts ADD CONSTRAINT ontology_concepts_status_check
  CHECK (status IN ('Active', 'Deprecated', 'Retired', 'Archived'));

ALTER TABLE ontology_concepts DROP COLUMN IF EXISTS is_active;

-- 2. Uniqueness widens to include version — the same row identity change
--    every multi-version entity in this codebase made (063_pack_tenant_
--    scoped_versioning.sql is the closest precedent).
ALTER TABLE ontology_concepts DROP CONSTRAINT IF EXISTS ontology_concepts_type_code_tenant_unique;
ALTER TABLE ontology_concepts ADD CONSTRAINT ontology_concepts_type_code_tenant_version_unique
  UNIQUE (concept_type, code, tenant_id, version);

-- 3. Composition — Specialization/Override only (see header). One row's own
--    composition_sources names the concept(s) it was specialized FROM, for
--    Ch.18 §12's "contributing Packs"/"compatibility information" (here:
--    contributing concepts), the same traceability idea one level down.
ALTER TABLE ontology_concepts ADD COLUMN IF NOT EXISTS composition_strategy TEXT;
ALTER TABLE ontology_concepts DROP CONSTRAINT IF EXISTS ontology_concepts_composition_strategy_check;
ALTER TABLE ontology_concepts ADD CONSTRAINT ontology_concepts_composition_strategy_check
  CHECK (composition_strategy IS NULL OR composition_strategy IN ('specialization', 'override'));
ALTER TABLE ontology_concepts ADD COLUMN IF NOT EXISTS composition_sources JSONB NOT NULL DEFAULT '[]';

-- 4. Real governed transitions (CR-006 noun x verb — badge codes derive as
--    ontology_deprecate/ontology_retire/ontology_archive; core/ontology.ts
--    passes alternateBadges: ['ontology_define'] on every evaluate() call so
--    every existing ontology_define/root holder keeps full access with no
--    new badge grants required). event_type/version_event per the Version
--    Feature Plan mechanism (migration 183) — ConceptDeprecated is one of
--    Ch.18 §14's own seven named events, matched verbatim; Retired/Archived
--    have no chapter-given name (neither do Template's own TemplateRetired/
--    TemplateArchived), so they follow this codebase's own EntityName +
--    PastTenseVerb convention instead.
INSERT INTO transition_definitions (entity_type, from_state, to_state, trigger, verb, event_type, version_event)
SELECT 'Ontology', v.from_state, v.to_state, 'manual', v.verb, v.event_type, v.version_event
FROM (VALUES
  ('Active',     'Deprecated', 'deprecate', 'ConceptDeprecated',        'VersionDeprecated'),
  ('Deprecated', 'Retired',    'retire',    'OntologyConceptRetired',   'VersionSuperseded'),
  ('Retired',    'Archived',   'archive',   'OntologyConceptArchived',  'VersionArchived')
) AS v(from_state, to_state, verb, event_type, version_event)
WHERE NOT EXISTS (
  SELECT 1 FROM transition_definitions td WHERE td.entity_type = 'Ontology' AND td.from_state = v.from_state AND td.to_state = v.to_state
);

-- Reference catalog only (authority/index.ejs's own admin listing) — NOT
-- consulted by transitionEngine.evaluate's actual authorisation check, which
-- derives the required badge mechanically from entity_type+verb and never
-- reads this table. Kept in sync anyway so the Authority admin screen lists
-- these 3 new (Ontology, verb) pairs without waiting on a full db:clean-slate
-- reseed of authorityVocabulary.json.
INSERT INTO authority_noun_verbs (noun_code, verb_code)
VALUES ('Ontology', 'deprecate'), ('Ontology', 'retire'), ('Ontology', 'archive')
ON CONFLICT (noun_code, verb_code) DO NOTHING;
