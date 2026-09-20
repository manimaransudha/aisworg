-- Dispatch Strategy data gaps (Ch.33 §7/§9): Cost Optimisation needs a real
-- cost field on the Participant resource; competency needs a proficiency
-- level per code (not just membership) for Specialist/Locality-style
-- ranking. Confidence (SEU-history-derived) and Locality (Objective-span
-- overlap) need no schema change — both are computed from data that already
-- exists (participants.seu_id engagements, seus.objective_id).
ALTER TABLE participants_master ADD COLUMN IF NOT EXISTS cost NUMERIC;

INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('proficiency-level', 'Novice', 'Novice', '11111111-1111-1111-1111-111111111111'),
  ('proficiency-level', 'Intermediate', 'Intermediate', '11111111-1111-1111-1111-111111111111'),
  ('proficiency-level', 'Expert', 'Expert', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id, version) DO NOTHING;
