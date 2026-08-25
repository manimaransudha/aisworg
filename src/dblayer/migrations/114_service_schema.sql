-- CR-064 — contributionServices[] authoring form redesign, same discipline
-- CR-058-062 each established: per-field help, x-property-order, real
-- Ontology-backed identity in place of free text.
--   code: real, Ontology-backed (service-name, migration 113) — was free
--     text, no cross-Pack canonical meaning.
--   serviceLevel: new nested repeatable sub-list (Checklist's own
--     "nested-list" mechanism, CR-060), {label, target} generic pairs —
--     owner: "The items will be the declared service level... {offshore: 3
--     days}, {onsite:1 day}" — a fixed-schema item can't hold a dynamic key
--     name, so label/target generalizes it (matches Ch.11 §8's own
--     non-exhaustive "may specify" framing rather than hardcoding turnaround/
--     quality-bar/availability/exceptions as four separate fields).
--   version: deliberately NOT an authored field here — real, definition-
--     side versioning (owner: "Versioning is definition side") follows
--     Quality Gate's own precedent (bump-on-real-change, a new immutable
--     row per version, computed by servicesDB.upsertFromPack), not
--     something a Pack author types in.
--   capabilityCode: unchanged, still same-Pack-only free text, validated by
--     validatePackSeed against this same Pack's own declared Capabilities.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{properties,contributionServices}',
                  '{
                    "type": "array",
                    "x-help": "§7 Services — the declared, contracted output a Capability delivers. Version is real but system-managed (bumped automatically on real content change), not authored here.",
                    "x-widget": "referential-list",
                    "items": {
                      "type": "object",
                      "required": ["code", "capabilityCode", "name", "contractDescription"],
                      "x-property-order": ["capabilityCode", "code", "name", "contractDescription", "serviceLevel"],
                      "properties": {
                        "capabilityCode": {"type": "string", "x-help": "Which of this Pack''s own declared Capabilities provides this Service."},
                        "code": {"type": "string", "x-referential": "service-name", "x-ontology": true, "x-help": "This Service''s canonical identifier — shared across Packs deliberately (e.g. the same code declared by a Development Pack and a Deployment Pack, each with their own Service Level)."},
                        "name": {"type": "string", "x-help": "A short, human-readable name."},
                        "contractDescription": {"type": "string", "x-help": "What this Service delivers, in plain language — never how."},
                        "serviceLevel": {
                          "type": "array",
                          "x-help": "The measurable expectations this Service declares for its own delivery (Ch.11 §8) — as many rows as needed.",
                          "items": {
                            "type": "object",
                            "required": ["label", "target"],
                            "x-property-order": ["label", "target"],
                            "properties": {
                              "label": {"type": "string", "x-help": "What this expectation covers, e.g. \"Offshore turnaround,\" \"Quality bar,\" \"Availability.\""},
                              "target": {"type": "string", "x-help": "The target value, e.g. \"3 days,\" \"99.9% uptime.\""}
                            }
                          }
                        }
                      }
                    }
                  }'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');
