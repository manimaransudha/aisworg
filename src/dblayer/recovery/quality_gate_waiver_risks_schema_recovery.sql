BEGIN;
DROP TABLE IF EXISTS quality_gate_waiver_controls CASCADE;
DROP TABLE IF EXISTS quality_gate_waiver_risks CASCADE;
CREATE TABLE quality_gate_waiver_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waiver_id UUID NOT NULL REFERENCES quality_gate_waivers(id),
  seu_id UUID NOT NULL REFERENCES seus(id),
  risk TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quality_gate_waiver_risks_waiver ON quality_gate_waiver_risks (waiver_id);
CREATE TABLE quality_gate_waiver_controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id UUID NOT NULL REFERENCES quality_gate_waiver_risks(id),
  waiver_id UUID NOT NULL REFERENCES quality_gate_waivers(id),
  seu_id UUID NOT NULL REFERENCES seus(id),
  control_type TEXT NOT NULL,
  obligation_id UUID REFERENCES obligations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quality_gate_waiver_controls_risk ON quality_gate_waiver_controls (risk_id);
GRANT ALL PRIVILEGES ON TABLE quality_gate_waiver_risks TO weirdo;
GRANT ALL PRIVILEGES ON TABLE quality_gate_waiver_controls TO weirdo;
COMMIT;
