-- Owner: "category:templates should have text_type='Text' and
-- ui_grouping='Templates'." The real concept_type is `template-categories`
-- (Ch.6 §13 Template categorisation — ai-platform, api-platform,
-- enterprise-web-application, etc., migration 053) — there is no
-- `category:templates` concept_type in this schema. Already set live
-- through the Ontology Metadata page (CR-096) as a direct verification of
-- that feature; this migration codifies the same end state so a fresh
-- environment (db:clean-slate) lands on it too, not just the live DB.
--
-- text_type='text' (not markdown, CR-094/migration 191's default) — these
-- are short one-line category names ("AI Platform", "Enterprise Web
-- Application"), no markdown formatting need. ui_grouping='Templates'
-- collapses this concept_type into its own single navbar/tab entry
-- (Ch.18/CR-096), same mechanism profile-configuration's own 8 concept_types
-- already use for "SEU Configurations".
UPDATE ontology_concepts
   SET text_type = 'text', ui_grouping = 'Templates'
 WHERE concept_type = 'template-categories'
   AND status = 'Active';

UPDATE ontology_concepts
   SET text_type = 'text', ui_grouping = 'Environments'
 WHERE concept_type = 'category:environment'
   AND status = 'Active';

UPDATE ontology_concepts
   SET text_type = 'text', ui_grouping = 'Evidence'
 WHERE concept_type = 'category:evidence'
   AND status = 'Active';

UPDATE ontology_concepts
   SET text_type = 'text', ui_grouping = 'Obligation'
 WHERE concept_type = 'category:obligation'
   AND status = 'Active';

UPDATE ontology_concepts
   SET text_type = 'text', ui_grouping = 'Obligation'
 WHERE concept_type = 'category:obligation-origin'
   AND status = 'Active';

UPDATE ontology_concepts
   SET text_type = 'text', ui_grouping = 'Packs'
 WHERE concept_type = 'category:pack'
   AND status = 'Active';

UPDATE ontology_concepts
   SET text_type = 'text', ui_grouping = 'Packs'
 WHERE concept_type = 'category:policy'
   AND status = 'Active';

UPDATE ontology_concepts
   SET text_type = 'text', ui_grouping = 'Checklists'
 WHERE concept_type = 'checklist-configurable-value'
   AND status = 'Active';

UPDATE ontology_concepts
   SET text_type = 'text', ui_grouping = 'Checklists'
 WHERE concept_type = 'checklist-configurable-dimension'
   AND status = 'Active';

UPDATE ontology_concepts
   SET text_type = 'text', ui_grouping = 'Profiles'
 WHERE concept_type = 'profile-categories'
   AND status = 'Active';

UPDATE ontology_concepts
   SET text_type = 'markdown', ui_grouping = 'Capability'
 WHERE concept_type = 'capability-name'
   AND status = 'Active';

UPDATE ontology_concepts
   SET text_type = 'markdown', ui_grouping = 'Service'
 WHERE concept_type = 'service-name'
   AND status = 'Active';

UPDATE ontology_concepts
   SET text_type = 'text', ui_grouping = 'Packs'
 WHERE concept_type = 'technology-name'
   AND status = 'Active';

UPDATE ontology_concepts
   SET text_type = 'text', ui_grouping = 'Packs'
 WHERE concept_type = 'engineering-name'
   AND status = 'Active';

UPDATE ontology_concepts
   SET text_type = 'text', ui_grouping = 'Packs'
 WHERE concept_type = 'organisation-name'
   AND status = 'Active';

UPDATE ontology_concepts
   SET text_type = 'text', ui_grouping = 'Packs'
 WHERE concept_type = 'integration-name'
   AND status = 'Active';
  
UPDATE ontology_concepts
   SET text_type = 'text', ui_grouping = 'Packs'
 WHERE concept_type = 'domain-name'
   AND status = 'Active';

UPDATE ontology_concepts
   SET text_type = 'text', ui_grouping = 'Packs'
 WHERE concept_type = 'compliance-name'
   AND status = 'Active';

UPDATE ontology_concepts
   SET text_type = 'text', ui_grouping = 'Deliverables'
 WHERE concept_type = 'deliverable-name'
   AND status = 'Active';

UPDATE ontology_concepts
   SET text_type = 'text', ui_grouping = 'Features'
 WHERE concept_type = 'feature-flag'
   AND status = 'Active';

UPDATE ontology_concepts
   SET text_type = 'text', ui_grouping = 'General'
 WHERE concept_type = 'installation-classification'
   AND status = 'Active';

UPDATE ontology_concepts
   SET text_type = 'text', ui_grouping = 'General'
 WHERE concept_type = 'category:decision'
   AND status = 'Active';

UPDATE ontology_concepts
   SET text_type = 'text', ui_grouping = 'General'
 WHERE concept_type = 'category:deliverable'
   AND status = 'Active';

UPDATE ontology_concepts
   SET text_type = 'text', ui_grouping = 'General'
 WHERE concept_type = 'category:event-types'
   AND status = 'Active';

UPDATE ontology_concepts
   SET text_type = 'text', ui_grouping = 'General'
 WHERE concept_type = 'category:knowledge'
   AND status = 'Active';

UPDATE ontology_concepts
   SET text_type = 'text', ui_grouping = 'General'
 WHERE concept_type = 'composition-strategy'
   AND status = 'Active';

