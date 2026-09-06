-- CR-091 Part 2 — Configuration Parameters (Ch.7 §10). Owner: "In Ontology,
-- create profile-configuration concept type. Section 10 examples and other
-- similar have to be added here. There should also be concept-types for
-- each of these." Two layers:
--   profile-configuration — the parameter NAMES (catalogue only; doesn't
--     drive form rendering — each parameter is its own named schema field,
--     migration 175). §10's own 7 examples, plus development-methodology
--     (Ch.6 §13's own odd-one-out example, settled here per CR-088's own
--     "Explicitly not decided here" item) and participating-organisations
--     (§12, owner: "add this also to the configuration parameters... Will
--     be empty list for now").
--   One concept type PER parameter, named identically to its own code —
--     the parameter's own VALUES. participating-organisations intentionally
--     gets none (owner: "populated when implementing multi-tenancy").
--     environment-configuration intentionally gets no concept type at all
--     (owner: "has to be a json that is free text" — declared directly as
--     its own x-widget:"json" schema field, migration 175, no Ontology
--     involvement).
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('profile-configuration', 'target-cloud-provider', 'Target Cloud Provider', '11111111-1111-1111-1111-111111111111'),
  ('profile-configuration', 'primary-programming-language', 'Primary Programming Language', '11111111-1111-1111-1111-111111111111'),
  ('profile-configuration', 'source-control-provider', 'Source Control Provider', '11111111-1111-1111-1111-111111111111'),
  ('profile-configuration', 'deployment-strategy', 'Deployment Strategy', '11111111-1111-1111-1111-111111111111'),
  ('profile-configuration', 'ai-provider-preference', 'AI Provider Preference', '11111111-1111-1111-1111-111111111111'),
  ('profile-configuration', 'default-repository-structure', 'Default Repository Structure', '11111111-1111-1111-1111-111111111111'),
  ('profile-configuration', 'documentation-level', 'Documentation Level', '11111111-1111-1111-1111-111111111111'),
  ('profile-configuration', 'development-methodology', 'Development Methodology', '11111111-1111-1111-1111-111111111111'),
  ('profile-configuration', 'participating-organisations', 'Participating Organisations', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id) DO NOTHING;

-- CR-091 — generic, nullable, meaningful only for profile-configuration
-- concepts today; same discipline description/is_active already established
-- on this table (migrations 056/047). A tenant overrides a Platform default
-- by inserting their own (concept_type, code, tenant_id) row with the
-- opposite value — resolved automatically by ontologyDB.findConcept's own
-- tenant-preference ordering, no separate override mechanism needed.
ALTER TABLE ontology_concepts ADD COLUMN IF NOT EXISTS is_mandatory BOOLEAN;

-- Owner: "Development methodology should be mandatory... Primary
-- Programming Language and Source Control Provider" (settled in
-- conversation, not every parameter — "most... need values" but not all).
UPDATE ontology_concepts SET is_mandatory = TRUE
 WHERE concept_type = 'profile-configuration'
   AND code IN ('development-methodology', 'primary-programming-language', 'source-control-provider')
   AND tenant_id = '11111111-1111-1111-1111-111111111111';

UPDATE ontology_concepts SET is_mandatory = FALSE
 WHERE concept_type = 'profile-configuration'
   AND code IN ('target-cloud-provider', 'deployment-strategy', 'ai-provider-preference', 'default-repository-structure', 'documentation-level')
   AND tenant_id = '11111111-1111-1111-1111-111111111111';

-- participating-organisations stays is_mandatory = NULL (untouched) —
-- outside this mechanism entirely (§ CR-091 Part 2): no seeded values to
-- require until multi-tenancy exists.

INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('target-cloud-provider', 'aws', 'AWS', '11111111-1111-1111-1111-111111111111'),
  ('target-cloud-provider', 'azure', 'Azure', '11111111-1111-1111-1111-111111111111'),
  ('target-cloud-provider', 'gcp', 'Google Cloud Platform', '11111111-1111-1111-1111-111111111111'),
  ('target-cloud-provider', 'on-premises', 'On-Premises', '11111111-1111-1111-1111-111111111111'),
  ('target-cloud-provider', 'multi-cloud', 'Multi-Cloud', '11111111-1111-1111-1111-111111111111'),

  ('primary-programming-language', 'typescript', 'TypeScript', '11111111-1111-1111-1111-111111111111'),
  ('primary-programming-language', 'javascript', 'JavaScript', '11111111-1111-1111-1111-111111111111'),
  ('primary-programming-language', 'python', 'Python', '11111111-1111-1111-1111-111111111111'),
  ('primary-programming-language', 'java', 'Java', '11111111-1111-1111-1111-111111111111'),
  ('primary-programming-language', 'csharp', 'C#', '11111111-1111-1111-1111-111111111111'),
  ('primary-programming-language', 'go', 'Go', '11111111-1111-1111-1111-111111111111'),

  ('source-control-provider', 'github', 'GitHub', '11111111-1111-1111-1111-111111111111'),
  ('source-control-provider', 'gitlab', 'GitLab', '11111111-1111-1111-1111-111111111111'),
  ('source-control-provider', 'bitbucket', 'Bitbucket', '11111111-1111-1111-1111-111111111111'),
  ('source-control-provider', 'azure-devops', 'Azure DevOps', '11111111-1111-1111-1111-111111111111'),

  ('deployment-strategy', 'blue-green', 'Blue-Green', '11111111-1111-1111-1111-111111111111'),
  ('deployment-strategy', 'canary', 'Canary', '11111111-1111-1111-1111-111111111111'),
  ('deployment-strategy', 'rolling', 'Rolling', '11111111-1111-1111-1111-111111111111'),
  ('deployment-strategy', 'recreate', 'Recreate', '11111111-1111-1111-1111-111111111111'),

  ('ai-provider-preference', 'anthropic', 'Anthropic', '11111111-1111-1111-1111-111111111111'),
  ('ai-provider-preference', 'openai', 'OpenAI', '11111111-1111-1111-1111-111111111111'),
  ('ai-provider-preference', 'google', 'Google', '11111111-1111-1111-1111-111111111111'),
  ('ai-provider-preference', 'azure-openai', 'Azure OpenAI', '11111111-1111-1111-1111-111111111111'),
  ('ai-provider-preference', 'aws-bedrock', 'AWS Bedrock', '11111111-1111-1111-1111-111111111111'),

  ('default-repository-structure', 'monorepo', 'Monorepo', '11111111-1111-1111-1111-111111111111'),
  ('default-repository-structure', 'polyrepo', 'Polyrepo', '11111111-1111-1111-1111-111111111111'),
  ('default-repository-structure', 'multi-module', 'Multi-Module', '11111111-1111-1111-1111-111111111111'),

  ('documentation-level', 'minimal', 'Minimal', '11111111-1111-1111-1111-111111111111'),
  ('documentation-level', 'standard', 'Standard', '11111111-1111-1111-1111-111111111111'),
  ('documentation-level', 'comprehensive', 'Comprehensive', '11111111-1111-1111-1111-111111111111'),

  ('development-methodology', 'scrum', 'Scrum', '11111111-1111-1111-1111-111111111111'),
  ('development-methodology', 'kanban', 'Kanban', '11111111-1111-1111-1111-111111111111'),
  ('development-methodology', 'waterfall', 'Waterfall', '11111111-1111-1111-1111-111111111111'),
  ('development-methodology', 'safe', 'SAFe', '11111111-1111-1111-1111-111111111111'),
  ('development-methodology', 'lean', 'Lean', '11111111-1111-1111-1111-111111111111'),
  ('development-methodology', 'xp', 'Extreme Programming (XP)', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id) DO NOTHING;
