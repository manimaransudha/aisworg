-- CR-062 — contributionObligationDefinitions[] authoring form redesign.
-- Was: code, obligationType (free text, unclear purpose against Ch.23 —
-- nothing in §8 names an "Obligation Type" distinct from Category), plus
-- the shared §20 verifiable-item fields. Design settled: no real Obligation
-- Definition table gets built (nothing cross-references a specific
-- Definition by id, unlike Checklist/Policy) — this is a schema/form-
-- correctness fix on the existing JSONB declaration only.
--   obligationType: dropped — redundant with category, no separate field.
--   category: real, Ontology-backed (category:obligation, already existed;
--     4 values added by migration 110) — was free text with no validation
--     at the declaration level at all (obligations.ts itself already
--     enforces it via assertCanonicalCategory on the real column; the
--     authoring form never exposed it).
--   origin: real, Ontology-backed, new concept type category:obligation-
--     origin (migration 110, seeded from Ch.23 §10's 11 named Obligation
--     Sources) — FR-23.5 "shall remain permanently recorded" had no
--     mechanism to record from at all before this; stays a categorical
--     declaration (which kind of source raises this), not a relational FK
--     back to a specific raising entity — same no-cross-reference reasoning
--     as the no-new-table decision above.
-- Priority/Completion Criteria/the five Related-* fields stay out of this
-- schema entirely — all settled execution-side (an Obligation instance's
-- own runtime values, not something a Pack-authored Definition can know in
-- the abstract; see CR-062's own "Design, as settled").
UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{properties,contributionObligationDefinitions}',
                  '{
                    "type": "array",
                    "x-help": "§9 Obligation Definitions — a declared type of Obligation this Pack can raise. A real Obligation instance is created at SEU-execution time (Telemetry, Knowledge promotion, manual API); this is the definition only.",
                    "x-widget": "referential-list",
                    "items": {
                      "type": "object",
                      "required": ["code", "category"],
                      "x-property-order": ["code", "category", "origin", "statement", "classification", "prompt", "participant", "outputContract", "assurance", "externalEvidence"],
                      "properties": {
                        "code": {"type": "string", "x-help": "A short, unique identifier for this Obligation Definition, scoped to this Pack."},
                        "category": {"type": "string", "x-referential": "category:obligation", "x-ontology": true, "x-help": "This Obligation''s category (Ch.23 §7)."},
                        "origin": {"type": "string", "x-referential": "category:obligation-origin", "x-ontology": true, "x-help": "Which kind of source raises this Obligation (Ch.23 §10). Declaration only — not yet wired to any automated raising mechanism beyond what already exists (Telemetry, Knowledge promotion)."},
                        "statement": {"type": "string"},
                        "classification": {"type": "string", "enum": ["machine-verifiable", "judgment", "human-attested"]},
                        "externalEvidence": {"type": "boolean"},
                        "prompt": {"type": "string"},
                        "participant": {"type": "string", "enum": ["AI", "AI+human", "human"]},
                        "outputContract": {"type": "string", "enum": ["passed-failed-notes", "assessment-acceptance"]},
                        "assurance": {"type": "string"}
                      }
                    }
                  }'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');
