-- Profile §7's Selected Technologies/Domains/Compliance Packs/Integration
-- Packs (owner, 2026-08-19: "all missing fields have to be fixed at schema
-- level") need their own storage, distinct from the pre-existing
-- optionalPackCodes list — same profile_packs join table (still keyed by
-- Pack *code*, migration 013), disambiguated by a new `list_kind` column
-- rather than four new tables. 'optional' is the pre-existing list's own
-- kind, backfilled so every existing row keeps meaning exactly what it did.
ALTER TABLE profile_packs ADD COLUMN IF NOT EXISTS list_kind TEXT NOT NULL DEFAULT 'optional';
ALTER TABLE profile_packs DROP CONSTRAINT IF EXISTS profile_packs_pkey;
ALTER TABLE profile_packs ADD PRIMARY KEY (profile_id, pack_code, list_kind);
