-- CR-087 — Template's deliverableCatalogue[].name becomes .code, genuinely
-- Ontology-backed by CODE rather than by the concept's default_label (owner:
-- "deliverableCatalogue[].name should actually be deliverableCatalogue[].code
-- and it has to be ontology backed").
--
-- Migration 079 already pointed this field at the deliverable-name Ontology
-- vocabulary, but via a PLAIN `x-referential` marker whose submitted value
-- was the concept's default_label ("Solution / Architecture Document") — not
-- validated server-side at all (CR-087 finding 1: every seeded Template's
-- actual stored names drifted from that vocabulary with nothing catching it).
-- Switching to `x-ontology: true` (same mechanism CR-086 gave Pack's own
-- contributionCapabilities[].code) makes this a real code-backed field:
-- options carry {code, label, description}, the submitted value is the
-- code, and core/templates.ts's validateTemplateSeed now asserts it against
-- the vocabulary via assertCanonicalCategory — the same discipline every
-- other Ontology-backed authoring field already has.
--
-- dependencyGraph.toName/fromName renamed to toCode/fromCode for the same
-- reason (self:deliverableCatalogue references deliverableCatalogue's own
-- new identity field) — loadSelfReferentialOptions (web/sdkAuthoring.ts)
-- already auto-detects `code` vs `name` as the identity key per-field from
-- the TARGET field's own item schema, so no code change was needed there,
-- only this rename. Side-effect bug fix: core/templates.ts's isRenameOf
-- (CR-049 Phase 2 locked-edge inheritance check) already called
-- deliverableDefinitionsDB.findActiveByCode(childName, ...) expecting a real
-- code — it was silently never matching anything while toName/fromName held
-- default_label text; it will now.
--
-- dependency_definitions/deliverables stay exactly as they are (name-keyed,
-- unchanged) — materialiseDependencyGraph.ts and commissioning.ts now
-- resolve code -> the concept's tenant-aware label at the point they write
-- to those tables, so runtime gating (string equality between
-- deliverables.name and dependency_definitions.to_name/from_name) is
-- unaffected by this authoring-layer change.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema #- '{properties,deliverableCatalogue,items,properties,name}',
                  '{properties,deliverableCatalogue,items,properties,code}',
                  '{"type": "string", "x-referential": "deliverable-name", "x-ontology": true, "x-help": "The deliverable-name Ontology concept this catalogue entry produces."}'::jsonb,
                  true
                )
 WHERE entity_kind = 'Template' AND version = 1;

UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(
                    schema #- '{properties,dependencyGraph,items,properties,toName}' #- '{properties,dependencyGraph,items,properties,fromName}',
                    '{properties,dependencyGraph,items,properties,toCode}',
                    '{"type": "string", "x-referential": "self:deliverableCatalogue", "x-help": "The gated deliverableCatalogue entry, by its own code."}'::jsonb,
                    true
                  ),
                  '{properties,dependencyGraph,items,properties,fromCode}',
                  '{"type": "string", "x-referential": "self:deliverableCatalogue", "x-help": "Only used when From Type is Deliverable — the prerequisite deliverableCatalogue entry, by its own code."}'::jsonb,
                  true
                )
 WHERE entity_kind = 'Template' AND version = 1;

UPDATE schema_definitions
   SET schema = jsonb_set(schema, '{properties,dependencyGraph,items,x-property-order}', '["toCode", "fromType", "fromCode", "fromCapabilityCode", "requiredState", "relationshipKind"]'::jsonb, true)
 WHERE entity_kind = 'Template' AND version = 1;
