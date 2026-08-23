-- Template versioning/immutability, mirroring Pack exactly. Owner, 2026-08-19
-- (CR-024): "Versioning and immutability - Let us version the template
-- similar to pack." Closes Ch.6 §20.3 (FR-6.2, FR-6.8, §14): `template_version`
-- existed but was never read or written; `code` alone was the unique identity,
-- so republishing under an existing code silently overwrote the row in place
-- — the exact bug migration 010 already fixed for Pack.
--
-- 1. template_version was a plain INTEGER counter, never touched anywhere in
--    the codebase (confirmed by grep before this migration) — converted to a
--    semver TEXT string, matching pack_version exactly, not just renamed.
-- 2. (code) alone drops as the unique identity; (code, template_version)
--    becomes it — the same shape packs_code_version_key already has
--    (migration 010), for the same reason.
--
-- Every existing row today is (code) globally unique already (the old
-- constraint guaranteed it), so backfilling every row to '1.0.0' is exact,
-- not a guess — there is no real prior version history to reconstruct.
ALTER TABLE templates ALTER COLUMN template_version DROP DEFAULT;
ALTER TABLE templates ALTER COLUMN template_version TYPE TEXT USING '1.0.0';
ALTER TABLE templates ALTER COLUMN template_version SET DEFAULT '1.0.0';

ALTER TABLE templates DROP CONSTRAINT IF EXISTS templates_code_key;
ALTER TABLE templates DROP CONSTRAINT IF EXISTS templates_code_version_key;
ALTER TABLE templates ADD CONSTRAINT templates_code_version_key UNIQUE (code, template_version);
