-- Book 3 Ch.16 §7 / §20.4 audit finding (2026-09-19): migration 030's source
-- already declares all 6 chapter-named category:knowledge values, but this
-- repo's migration runner has no applied-migrations ledger (run.ts replays
-- every file unconditionally) — a database migrated before 030 was widened
-- to 6 values never picked up the other 4. Live-confirmed only 'Domain
-- Knowledge'/'Technical Knowledge' (Active) plus 'Technical'/'Test'
-- (Retired by migration 225) existed. This adds the missing 4, verbatim
-- against 030's own labels, so a targeted apply (not a full replay) closes
-- the gap without touching anything else.
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('category:knowledge', 'Architectural Knowledge', 'Architectural Knowledge', '11111111-1111-1111-1111-111111111111'),
  ('category:knowledge', 'Operational Knowledge', 'Operational Knowledge', '11111111-1111-1111-1111-111111111111'),
  ('category:knowledge', 'Governance Knowledge', 'Governance Knowledge', '11111111-1111-1111-1111-111111111111'),
  ('category:knowledge', 'Process Knowledge', 'Process Knowledge', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id, version) DO NOTHING;
