-- Owner (2026-09-01): "The compliance tab in pack model is just a
-- placeholder. It has to be expanded to pick from one of the existing
-- compliance codes." Settled: a code-only tag (same shape as
-- featureFlagCodes/mandatoryPackCodes — a referential-list of single-value
-- cards, no real Pack link, unlike Dependencies), sourced from
-- compliance-name (migration 144), replacing contributionsCompliance
-- entirely (owner: "Replace entirely"), on every Pack regardless of its own
-- category (owner: "Every Pack, any category").
UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema #- '{properties,contributionsCompliance}',
                  '{properties,contributionComplianceCodes}',
                  '{
                    "type": "array",
                    "x-help": "Which existing Compliance Packs (by their own compliance-name code) this Pack must satisfy — a reference, not a copy of their content.",
                    "x-widget": "referential-list",
                    "items": {
                      "type": "object",
                      "required": ["complianceCode"],
                      "properties": {
                        "complianceCode": {"type": "string", "x-referential": "compliance-name"}
                      }
                    }
                  }'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');
