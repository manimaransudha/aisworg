-- Ch.13 §7 revision (owner): Participant Types go from three (AI/Human/
-- External) to four. Automated Participant takes over External's old
-- examples (Static Analysis Platform, CI/CD Pipeline, Security Scanner,
-- Cloud Deployment Service); External is redefined to outside oversight/
-- authority parties (Auditors, Certifying Authorities).
--
-- ParticipantType becomes Ontology-backed (concept_type 'participant-types')
-- rather than a hardcoded TS union + DB CHECK — same discipline CR-086 gave
-- Service code: a new/renamed Participant Type going forward is a data
-- change, not a code change. Nothing in the engine pattern-matches a
-- Participant Type's own code (participantsDB/capabilities.ts/participants.ts
-- only ever pass it through), so this is the plain descriptive-concept case,
-- not the engine-bound one core/ontology.ts's header reserves for later.
--
-- Both CHECKs that hardcoded the old 3-value set are dropped in favour of
-- dynamic validation (assertCanonicalCategory, core/ontology.ts) — same
-- precedent deliverables.lifecycle_state already set (migration 002, Ch.15
-- §10): no migration-gated enum for a value the Ontology may extend.
ALTER TABLE participants DROP CONSTRAINT IF EXISTS participants_type_check;
ALTER TABLE capability_fulfilments DROP CONSTRAINT IF EXISTS capability_fulfilments_fulfilment_strategy_check;

INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id, text_type, ui_grouping) VALUES
  ('participant-types', 'AI', 'AI', '11111111-1111-1111-1111-111111111111', 'text', 'General'),
  ('participant-types', 'Human', 'Human', '11111111-1111-1111-1111-111111111111', 'text', 'General'),
  ('participant-types', 'Automated', 'Automated', '11111111-1111-1111-1111-111111111111', 'text', 'General'),
  ('participant-types', 'External', 'External', '11111111-1111-1111-1111-111111111111', 'text', 'General')
ON CONFLICT (concept_type, code, tenant_id, version) DO NOTHING;
