-- CR-077 — mark the 7 statement/prompt fields (Checklist item; Quality Gate;
-- Review Gate; Obligation Definition) as markdown-formatted, so the SDK
-- authoring form gives them a formatting toolbar and the view-mode render
-- runs them through marked+sanitize-html instead of a plain pre-wrap div.
-- x-format is a new, orthogonal marker (form CONTROL SHAPE stays x-widget's
-- job) — additive, no existing key removed. Same "mutate the live max-version
-- row directly" convention migration 120 used, not a new schema version.
-- jsonb_set replaces the whole value at a path (no deep merge), so each SET
-- below reproduces that field's current full definition plus x-format.

-- Checklist item's own statement (Ch.47; no prompt field — CR-060 dropped it,
-- execution-side concerns live on the referencing gate, not the item).
UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{properties,contributionChecklists,items,properties,items,items,properties,statement}',
                  '{"type": "string", "x-help": "The claim being verified, in plain language.", "x-format": "markdown"}'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');

-- Quality Gate (Ch.26).
UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(
                    schema,
                    '{properties,contributionQualityGates,items,properties,statement}',
                    '{"type": "string", "x-help": "The human-readable standard this gate enforces, in plain language (e.g. \"No hardcoded passwords\").", "x-label": "Description", "x-format": "markdown"}'::jsonb,
                    true
                  ),
                  '{properties,contributionQualityGates,items,properties,prompt}',
                  '{"type": "string", "x-help": "The instruction given to the AI participant executing this check (machine-verifiable or judgment classifications).", "x-format": "markdown"}'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');

-- Review Gate (Ch.25).
UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(
                    schema,
                    '{properties,contributionReviewGates,items,properties,statement}',
                    '{"type": "string", "x-help": "The human-readable standard this review confirms, in plain language.", "x-label": "Description", "x-format": "markdown"}'::jsonb,
                    true
                  ),
                  '{properties,contributionReviewGates,items,properties,prompt}',
                  '{"type": "string", "x-help": "The instruction given to the AI/human participant performing this review.", "x-format": "markdown"}'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');

-- Obligation Definition (Ch.23) — statement/prompt carry no x-help today;
-- reproduced as-is plus x-format, nothing else added.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(
                    schema,
                    '{properties,contributionObligationDefinitions,items,properties,statement}',
                    '{"type": "string", "x-format": "markdown"}'::jsonb,
                    true
                  ),
                  '{properties,contributionObligationDefinitions,items,properties,prompt}',
                  '{"type": "string", "x-format": "markdown"}'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');
