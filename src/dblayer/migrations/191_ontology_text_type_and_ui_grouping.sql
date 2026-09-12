-- Owner: "a few things to add so it gets easy and this becomes a data change
-- than code change every time." Two additive columns on ontology_concepts,
-- replacing two things CR-096 had to put in code:
--
-- 1. text_type — CR-094 made every concept's `description` render as
--    markdown unconditionally. Some descriptions are a plain sentence with
--    no need for the editor toolbar/sanitize-html round trip; text_type
--    ('text' | 'markdown') lets the AUTHOR decide per concept, as data, not
--    a hardcoded rule. Defaults to 'markdown' — every existing row keeps
--    rendering exactly as CR-094 already built it.
--
-- 2. ui_grouping — CR-096 detected a "group" by a coincidence (a
--    concept_type's own codes happening to name other real concept_types)
--    and labelled it via a small hardcoded map in core/ontology.ts
--    (GROUP_LABEL_OVERRIDES). This column replaces BOTH: a row's own
--    ui_grouping value (set directly on profile-configuration's 8
--    parameter-name rows here) both marks its `code` as a group MEMBER and
--    supplies the group's own display label, in one place, as data. A new
--    group going forward is a row edit, not a code change — set ui_grouping
--    on whichever rows should belong to it, nothing else to touch.
ALTER TABLE ontology_concepts ADD COLUMN IF NOT EXISTS text_type TEXT NOT NULL DEFAULT 'markdown';
ALTER TABLE ontology_concepts DROP CONSTRAINT IF EXISTS ontology_concepts_text_type_check;
ALTER TABLE ontology_concepts ADD CONSTRAINT ontology_concepts_text_type_check
  CHECK (text_type IN ('text', 'markdown'));

ALTER TABLE ontology_concepts ADD COLUMN IF NOT EXISTS ui_grouping TEXT;

-- profile-configuration's own 8 value-bearing parameter rows (Ch.7 §10,
-- migration 174) — the exact set CR-096 inferred by name-coincidence,
-- now declared directly. participating-organisations is deliberately left
-- out (it names no concept_type of its own — no values exist yet, migration
-- 174's own "will be empty list for now" — nothing to group under a tab).
UPDATE ontology_concepts SET ui_grouping = 'SEU Configurations'
 WHERE concept_type = 'profile-configuration'
   AND code IN ('ai-provider-preference', 'default-repository-structure', 'deployment-strategy', 'development-methodology',
                'documentation-level', 'primary-programming-language', 'source-control-provider', 'target-cloud-provider');
