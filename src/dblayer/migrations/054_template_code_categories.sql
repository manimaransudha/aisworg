-- Template `code`: owner, 2026-08-19 (CR-021): "The code is not UUID, but
-- one of these values [template-categories]. So make corresponding change
-- to the template schema and the UI form."
--
-- Migration 045 had removed `code` from the Template grammar entirely
-- (system UUID, minted server-side, never shown — the same treatment CR-015
-- gave Pack, extended to Template/Profile). This reverses that for Template
-- specifically: `code` is now a required referential-select, x-ontology:true,
-- pointed at the template-categories concepts (migration 053) — same generic
-- mechanism CR-020 Part 2 built for Pack's code/category/
-- installationClassification, so no formGenerator/view code changes are
-- needed here at all; the schema change alone is sufficient.
-- toTemplateSeedInput's randomUUID() fallback (core/sdkAuthoring.ts) stays as
-- a defensive default for a JSON import that omits it.
--
-- Profile is UNCHANGED by this migration — the owner's instruction was
-- Template-specific ("the template schema"); Profile's `code` stays a system
-- UUID (migration 045) until/unless a similar decision is made for it.
--
-- Development-time schema correction to the shipped v1 baseline grammar, in
-- place — same convention migrations 038/045/050/052 already used.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(
                    schema,
                    '{properties,code}',
                    '{"type":"string","minLength":1,"x-help":"Template category (Ch.18 Ontology, concept type template-categories; Ch.6 §8)","x-widget":"referential-select","x-referential-source":"template-categories","x-ontology":true}'::jsonb,
                    true
                  ),
                  '{required}',
                  '["code","name"]'::jsonb,
                  true
                )
 WHERE entity_kind = 'Template' AND version = 1;
