-- Owner: "The navbar in Ontology should reflect ui grouping. When the ui
-- grouping is selected, the vertical tabs should be concept_types." Grouping
-- detection was redesigned same-day to be concept_type-level (a concept_type
-- belongs to a group when ITS OWN rows carry ui_grouping; concept_types
-- sharing a value merge into one navbar entry, each becoming a tab) —
-- ontologyDB.ts's findConceptTypeUiGroupings replaces findConceptTypeGroupRows.
--
-- The old mechanism read a row's `code` as NAMING a child concept_type —
-- correct only for profile-configuration's own parent-names-child shape
-- (its 8 codes are themselves other concept_types' names, migration 174).
-- Under the new one-rule model, profile-configuration's 8 CHILDREN need
-- ui_grouping set on THEIR OWN rows too, or they silently drop out of the
-- "SEU Configurations" group entirely — profile-configuration's own rows
-- already carry it (migration 191), the children never did (nothing set it
-- there before this).
UPDATE ontology_concepts
   SET ui_grouping = 'SEU Configurations'
 WHERE concept_type IN (
   'ai-provider-preference', 'default-repository-structure', 'deployment-strategy', 'development-methodology',
   'documentation-level', 'primary-programming-language', 'source-control-provider', 'target-cloud-provider'
 )
 AND status = 'Active';
