-- CR-061 — Policy's definition is tied to its own Pack, not global (owner:
-- "anything in the pack like a policy, review gate etc has a definition
-- part and an execution part. So the definition is tied to a pack. it is
-- not global so no versioning required similar to checklist") — same
-- treatment CR-060 gave Checklist. `policies_code_key` (a bare, cross-Pack-
-- unique constraint on `code` alone) is itself wrong: two different Packs
-- should each be able to declare their own Policy sharing the same `code`
-- without colliding. Replaced with `(originating_pack_id, code)`, the same
-- shape `checklists_pack_name_key` uses — the upsert key that keeps a
-- Policy's `id` stable across every republish of its own Pack.
ALTER TABLE policies DROP CONSTRAINT IF EXISTS policies_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS policies_pack_code_key ON policies (originating_pack_id, code);
