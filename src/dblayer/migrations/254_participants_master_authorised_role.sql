-- Ch.13 participants_master — owner-directed addition. authorised_role holds
-- platform/tenant/SEU-scoped authorisation grants distinct from the noun_verb
-- badge model (requireBadge.ts governs transition authority; this is a
-- separate identity-level record of which standing role(s) a Participant
-- holds and until when). Shape: an array of
-- {"role": <authorised-role Ontology code>, "effective_till": <date>, "seu_ids": [<uuid>, ...]}
-- objects, e.g.
-- [{"role":"authoriser","effective_till":"2027-10-15","seu_ids":["<uuid>"]},
--  {"role":"escalation_level1","effective_till":"2027-01-01","seu_ids":[]}]
-- seu_ids empty = the role applies across every SEU (tenant/platform-wide),
-- same "unscoped means everywhere" convention role is not among Ontology
-- codes without a corresponding parent already establishes elsewhere.
-- role is Ontology-backed (concept_type 'authorised-role', seeded below) —
-- no DB CHECK, same dynamic-validation discipline this table's own
-- type/capabilities/competency columns already use (migration 195).
ALTER TABLE participants_master ADD COLUMN IF NOT EXISTS authorised_role JSONB NOT NULL DEFAULT '[]';

INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('authorised-role', 'superuser', 'Superuser', '11111111-1111-1111-1111-111111111111'),
  ('authorised-role', 'platform_admin', 'Platform Admin', '11111111-1111-1111-1111-111111111111'),
  ('authorised-role', 'tenant_admin', 'Tenant Admin', '11111111-1111-1111-1111-111111111111'),
  ('authorised-role', 'objective_sponsor', 'Objective Sponsor', '11111111-1111-1111-1111-111111111111'),
  ('authorised-role', 'seu_steward', 'SEU Steward', '11111111-1111-1111-1111-111111111111'),
  ('authorised-role', 'policy_steward', 'Policy Steward', '11111111-1111-1111-1111-111111111111'),
  ('authorised-role', 'escalation_level1', 'Escalation Level 1', '11111111-1111-1111-1111-111111111111'),
  ('authorised-role', 'escalation_level2', 'Escalation Level 2', '11111111-1111-1111-1111-111111111111'),
  ('authorised-role', 'escalation_level3', 'Escalation Level 3', '11111111-1111-1111-1111-111111111111'),
  ('authorised-role', 'objective_pmo', 'Objective PMO', '11111111-1111-1111-1111-111111111111'),
  ('authorised-role', 'auditor', 'Auditor', '11111111-1111-1111-1111-111111111111'),
  ('authorised-role', 'participant', 'Participant', '11111111-1111-1111-1111-111111111111'),
  ('authorised-role', 'general', 'General', '11111111-1111-1111-1111-111111111111'),
  ('authorised-role', 'sdk_author', 'SDK Author', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id, version) DO NOTHING;
