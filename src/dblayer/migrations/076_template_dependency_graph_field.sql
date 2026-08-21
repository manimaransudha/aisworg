-- CR-041 — Template's own dependencyGraph field: a repeatable-row widget for
-- authoring real dependency_definitions rows directly (owner: "This
-- authoring has to finally be inside the template"), replacing the retired
-- embedded dependsOnDeliverableCodes/dependsOnCapabilityServiceCodes shape
-- (owner: "no bridge. templates seed has to be corrected" — the 11 seeded
-- Templates' own JSON files were converted to this same shape directly).
--
-- toName uses the new self-referential x-widget:"referential-list" source
-- form ("self:deliverableCatalogue") — CR-041's actual mechanism addition:
-- resolved server-side from THIS SAME DRAFT'S OWN deliverableCatalogue
-- content, not an external registry (formGenerator.ts's existing
-- kind:"referential" rendering needs no change; only the web route's
-- options-loading gained a new source). fromName stays plain free text for
-- v1 (a Deliverable name OR a Capability's Service code, depending on
-- fromType) — not self-referential, to avoid a single field needing two
-- different resolution sources depending on a sibling field's value.
--
-- requiredState carries a schema `default` ("Approved") — pre-filled, not
-- fixed; the author can change it (e.g. to "Fulfilled" for a Capability-type
-- row) — owner: "the author should be able to change. Show a default. And
-- author can change."
--
-- Development-time schema correction to the shipped v1 baseline grammar, in
-- place — same convention migrations 038/045/050/052/054/058/061 already used.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{properties,dependencyGraph}',
                  '{
                    "type": "array",
                    "x-widget": "referential-list",
                    "x-help": "What each Deliverable in the catalogue above requires before it can start — pick the gated Deliverable, whether the prerequisite is another Deliverable or a Capability, name it, and (optionally) the state it must reach.",
                    "items": {
                      "type": "object",
                      "properties": {
                        "toName": { "type": "string", "x-referential": "self:deliverableCatalogue" },
                        "fromType": { "type": "string", "enum": ["Deliverable", "Capability"] },
                        "fromName": { "type": "string" },
                        "requiredState": { "type": "string", "default": "Approved" }
                      }
                    }
                  }'::jsonb,
                  true
                )
 WHERE entity_kind = 'Template' AND version = 1;
