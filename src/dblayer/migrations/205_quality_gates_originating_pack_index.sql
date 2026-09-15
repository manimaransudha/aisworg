-- CR-104 — qualityGatesDB.findByPackIds (compositionCompleted.ts, run on
-- every commissioning now) filters by originating_pack_id, which had no
-- index at all — a sequential scan on this long-lived, never-cleaned dev
-- database's own quality_gates table. policies already has one (via
-- policies_pack_code_key, migration 106); quality_gates never did.
CREATE INDEX IF NOT EXISTS idx_quality_gates_originating_pack_id ON quality_gates (originating_pack_id);
