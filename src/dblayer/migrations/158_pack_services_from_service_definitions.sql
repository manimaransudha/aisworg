-- Owner: "onto the services tab in the pack. The services form should show
-- all services tied to the capabilities that are in contributions.capability
-- []. So Capability Code will be a display only field. Name and Contract
-- Description are display only. these fields do not have to be stored in
-- the contributionServices[]. The service level should show the Service's
-- service level and allow edits to the targets... The original service
-- definition should not be overwritten."
--
-- contributionServices[] narrows to exactly two stored fields:
--   code         — which canonical Service Definition (service_definitions,
--                  migration 153) this Pack composes. Rendered as a bespoke
--                  picker (_referentialListGroup.ejs's own "isServices"
--                  branch, not the generic per-item-field mechanism) whose
--                  options are every Active Service Definition, client-side
--                  filtered (referentialListGroup.js) to whichever this
--                  Pack's own declared contributionCapabilities[] currently
--                  cover.
--   serviceLevel — this Pack's own per-expectation TARGET overrides only
--                  ({code, target} — code identifies WHICH of the
--                  Definition's own service_level rows is being overridden;
--                  label/target_level/units are never re-typed, always read
--                  from the Definition itself). A row omitted here simply
--                  inherits the Definition's own target unchanged — the
--                  Definition row itself is never written to (core/packs.ts's
--                  seedContributions resolves + merges at publish time,
--                  writing only to the Pack-composed `services` table).
-- capabilityCode/name/contractDescription are no longer schema fields at
-- all (owner: "these fields do not have to be stored") — shown in the form
-- read straight off the chosen Service Definition (client-side, from the
-- same option data the picker already carries), never submitted.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{properties,contributionServices}',
                  '{
                    "type": "array",
                    "x-help": "§7 Services this Pack composes, from the canonical Service Definitions (Ch.11) aligned to this Pack own declared Capabilities.",
                    "x-widget": "referential-list",
                    "items": {
                      "type": "object",
                      "required": ["code"],
                      "x-property-order": ["code", "serviceLevel"],
                      "properties": {
                        "code": {"type": "string", "x-help": "Which canonical Service Definition this Pack composes."},
                        "serviceLevel": {
                          "type": "array",
                          "x-help": "This Pack own overrides of the Service Definition own Service Level targets -- leave a row unchanged to inherit the Definition own target.",
                          "items": {
                            "type": "object",
                            "required": ["code", "target"],
                            "properties": {
                              "code": {"type": "string"},
                              "target": {"type": "number"}
                            }
                          }
                        }
                      }
                    }
                  }'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');
