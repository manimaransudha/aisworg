-- CR-051 item 4 (Ch.17 §15/§20.13) — Evidence versioning: a supersession
-- chain, not a (code, version, tenant) catalog identity like Template's
-- (Evidence has no `code`). Self-referential and nullable — most Evidence
-- never gets corrected. No backfill needed.
--
-- Deliberately no uniqueness constraint: a predecessor could in principle be
-- corrected more than once, by different actors, for different consuming
-- SEUs. Deliberately no cascade anywhere in this migration or the code that
-- uses this column — superseding is a fact recorded between two Evidence
-- rows only, never a bulk operation over evidence_relationships.
-- CR-059 build-time fix — missing IF NOT EXISTS broke a second replay.
ALTER TABLE evidence
  ADD COLUMN IF NOT EXISTS supersedes_evidence_id UUID REFERENCES evidence(id);
