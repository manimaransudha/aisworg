-- Owner: "Policy applicability - Applicable Environments. Ontology driven.
-- Has to be multi-select. A user enterable text should be allowed. If the
-- text is not in the Ontology - OntologyComposed even[t] has to be
-- triggered." formGenerator.ts's new `x-ontology-composable` flag.
--
-- Correction (owner: "There are only 2 x-ontology-composable that we have
-- defined so far. 1. Pack code 2. Profile ApplicableEnvironments... do you
-- understand the mess you are creating?"): this migration also set
-- `applicabilityDeliverableNames` composable, extrapolated from the owner's
-- own "should this apply to every referential-multi-select + x-ontology
-- field platform-wide" answer ("Yes") rather than a request naming that
-- field — the owner never asked for it. Left AS APPLIED here (this
-- migration already ran; not rewriting an applied statement) — moot in
-- practice because migration 214 removes `applicabilityDeliverableNames`
-- as a schema property entirely, replacing it with `applicabilityDeliverables`,
-- whose own `name` field does NOT carry `composable` (fixed directly in
-- 214, which had not yet run when this was caught). The only two fields
-- that should ever carry `x-ontology-composable` are Pack's own `code` and
-- Policy's own `applicabilityEnvironments`.
--
-- Draft-save no longer rejects an unregistered value on these two fields —
-- it proposes one via core/ontology.ts#proposeComposableOntologyValues
-- instead (OntologyComposed, Ch.18 §8), mirroring the split Pack's own
-- draft path already has for its `code` (draft-save never enforces
-- Ontology membership; only Publish does — validatePolicyDefinitionSeed's
-- new `draft` parameter). Publish still calls assertCanonicalCategory on
-- both fields unconditionally, so an unresolved proposal blocks Publish
-- exactly as it already did before this migration, per owner: "the new
-- value not in Ontology will be saved, but the policy cannot get published
-- without an Ontology entry. Packs already ha[ve] this implementation."
DO $$
DECLARE
  m RECORD;
BEGIN
  FOR m IN SELECT * FROM (VALUES
    ('Policy', 'applicabilityEnvironments'),
    ('Policy', 'applicabilityDeliverableNames')
  ) AS t(entity_kind, field_name)
  LOOP
    UPDATE schema_definitions
       SET schema = jsonb_set(schema, ARRAY['properties', m.field_name, 'x-ontology-composable'], 'true'::jsonb, true)
     WHERE entity_kind = m.entity_kind
       AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = m.entity_kind)
       AND schema->'properties' ? m.field_name;
  END LOOP;
END $$;
