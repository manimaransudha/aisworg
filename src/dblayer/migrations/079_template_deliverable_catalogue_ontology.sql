-- CR-038 — Template's deliverableCatalogue moves from a hand-typed JSON
-- textarea (x-widget: "json") to a real repeatable-row widget: name picked
-- from the deliverable-name Ontology concept (migration 048, 23 codes —
-- zero consumers until now), category from category:deliverable, and
-- producingCapabilityCode from whichever Capabilities the Template's own
-- Pack selections (CR-038's other half) actually derive. `code` is gone
-- entirely (TemplateDeliverableSeed's own comment, seuTypes.ts) — name IS
-- the identity now, matching every other name-keyed place in the system
-- (deliverables.name, dependency_definitions).
--
-- x-referential values here aren't registry codes — 'deliverable-name' and
-- 'category:deliverable' are resolved from Ontology (the real concept's own
-- default_label, not its code — this field's submitted value has to BE the
-- human name that ends up in deliverables.name at runtime, same as
-- dependencyGraph's self-referential toName/fromName already expect);
-- 'derived:requiredCapabilityCodes' is resolved from the Draft's own
-- currently-selected Packs, same live-derivation deriveCapabilityCodesFromPackCodes
-- does at publish time. All three are new source kinds for the web route's
-- referentialOptions resolver (sdkAuthoring.ts) — the rendering mechanism
-- itself (_referentialListGroup.ejs) needs no change; it already renders any
-- key found in referentialOptions verbatim.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{properties,deliverableCatalogue}',
                  '{
                    "type": "array",
                    "x-widget": "referential-list",
                    "x-help": "What this Template''s SEU produces — pick from the deliverable-name Ontology vocabulary, its category, and (once Packs are selected above) which Capability produces it.",
                    "items": {
                      "type": "object",
                      "required": ["name", "category"],
                      "properties": {
                        "name": { "type": "string", "x-referential": "deliverable-name" },
                        "category": { "type": "string", "x-referential": "category:deliverable" },
                        "producingCapabilityCode": { "type": "string", "x-referential": "derived:requiredCapabilityCodes" }
                      }
                    }
                  }'::jsonb,
                  true
                )
 WHERE entity_kind = 'Template' AND version = 1;
