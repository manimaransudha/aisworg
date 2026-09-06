-- CR-088 — Checklist item gains the `configurable` tag settled during the
-- Template/Profile configurable-parameters design, never actually built
-- until now (found while building Template's own "Exposable Parameters"
-- tab, which needs a real field to discover). Owner's own settled shape:
-- "In addition to group and a statement of the item, let us add an object
-- called {configurable: {type: required/mandatory/conditional, property2:
-- config1/config2...}}" — but `formGenerator.ts`'s own item-field kinds have
-- no "object" kind (the same limitation CR-089 hit for Policy's own
-- `configurable`, resolved there via flat fields), and a nested object would
-- be a THIRD level of nesting inside Checklist's own two-level
-- items[]-inside-checklists[] `nested-list` mechanism, which doesn't reach
-- that deep either. Resolved the same way: flat fields, not a nested
-- envelope — `configurableKey`/`configurableValue`, a single dimension/value
-- pair per item (not the arbitrary multi-key object originally sketched;
-- in practice one dimension per item covers every real example discussed —
-- an item needing more than one dimension can use a second, near-duplicate
-- item under the same statement, the same way Ch.24's own conditions[]
-- pattern would if it needed reuse).
--
-- Both Ontology-backed — "All enums have to be ontology driven" — as two
-- new, freely-extensible concept types (the same "Pack author picks or
-- adds" pattern capability-name/service-name/engineering-capital/
-- compliance-name already use), not a fixed platform-wide list:
--   checklist-configurable-dimension — the KEY (e.g. "type") — kept
--     freely-extensible since the whole point of this mechanism is letting
--     any Pack tag any named dimension it needs, not a closed set.
--   checklist-configurable-value — the VALUE (e.g. "required"/"mandatory"/
--     "conditional") — one shared, growing vocabulary across every
--     dimension, so two Packs tagging the same semantic value never drift
--     onto different spellings ("Required" vs "required" vs "mandatory").
-- Both optional — absence means "not tagged," matching the already-settled
-- "no configurable object = always included, unconditionally" default.
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('checklist-configurable-dimension', 'type', 'Type', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id) DO NOTHING;

INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('checklist-configurable-value', 'required', 'Required', '11111111-1111-1111-1111-111111111111'),
  ('checklist-configurable-value', 'mandatory', 'Mandatory', '11111111-1111-1111-1111-111111111111'),
  ('checklist-configurable-value', 'conditional', 'Conditional', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id) DO NOTHING;

-- CR-060's own nested-item-field convention (buildItemFields in
-- formGenerator.ts checks x-referential/x-ontology for an item field one
-- level inside a referential-list, NOT the top-level x-widget/
-- x-referential-source pair Policy's own top-level `category` field uses).
UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(
                    schema,
                    '{properties,contributionChecklists,items,properties,items,items,properties,configurableKey}',
                    '{"type": "string", "x-referential": "checklist-configurable-dimension", "x-ontology": true, "x-help": "Optional: which named dimension this item is tagged against (e.g. \"type\") — Template exposes this dimension as a configurable parameter; a Profile filters by its value. Leave blank if this item should always be included, unconditionally."}'::jsonb,
                    true
                  ),
                  '{properties,contributionChecklists,items,properties,items,items,properties,configurableValue}',
                  '{"type": "string", "x-referential": "checklist-configurable-value", "x-ontology": true, "x-help": "Optional: this item own value for the dimension named above (e.g. \"required\") — only meaningful when Configurable Dimension is also set."}'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');

UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{properties,contributionChecklists,items,properties,items,items,x-property-order}',
                  '["statement", "group", "configurableKey", "configurableValue"]'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');
