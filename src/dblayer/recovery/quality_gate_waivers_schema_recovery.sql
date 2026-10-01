BEGIN;
DROP TABLE IF EXISTS quality_gate_waivers CASCADE;
CREATE TABLE quality_gate_waivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quality_gate_id UUID NOT NULL REFERENCES quality_gates(id),
  seu_id UUID NOT NULL REFERENCES seus(id),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  rationale TEXT NOT NULL,
  granted_by UUID REFERENCES participants_master(id),
  authority_badge TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quality_gate_waivers_lookup ON quality_gate_waivers (quality_gate_id, entity_id, status);
GRANT ALL PRIVILEGES ON TABLE quality_gate_waivers TO weirdo;
COMMIT;
