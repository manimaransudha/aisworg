-- CR-080 — Pack lifecycle simplified: Draft -> Validated -> Published ->
-- Active -> Retired -> Archived. Deprecated dropped entirely — confirmed by
-- reading every call site (findActiveByCode, TERMINAL_REACTIVATABLE_STATES)
-- that it was never actually distinguished from Retired anywhere in the
-- running code; owner: "Let us just use retired." Reactivation from a
-- terminal state removed too — owner: "Remove: Retired -> Active
-- (reactivation) / Remove: Archived -> Active (reactivation)." Once Retired
-- or Archived, a Pack Version is permanently done; the only way back into the
-- pipeline is a new Version via copyPackAsNewDraft (lands in Draft, not a
-- reactivation of the old row). New: Validated -> Draft (reject) — owner:
-- "From Validation, it can also be rejected and go to the Draft state...
-- There has to be a comment field" — mirrors Objective's CR-073
-- mandatory/always-new-comment discipline, not its target state (Pack's own
-- schema validation makes "go back and fix it in Draft" meaningful in a way
-- Objective's own Reject never was — owner: "Validation validates against
-- packs' schema. Objective has no schema").

-- 1. Existing Deprecated rows have nowhere functionally different to go —
--    Deprecated and Retired were never actually distinguished at runtime —
--    move them to Retired before the CHECK constraint stops allowing
--    'Deprecated' at all.
UPDATE packs SET status = 'Retired' WHERE status = 'Deprecated';

ALTER TABLE packs DROP CONSTRAINT packs_status_check;
ALTER TABLE packs ADD CONSTRAINT packs_status_check
  CHECK (status IN ('Draft', 'Validated', 'Published', 'Active', 'Retired', 'Archived'));

-- 2. Pack's own comment thread — mirrors objective_comments (migration 125)
--    exactly. No generic/shared comment table exists to reuse.
CREATE TABLE IF NOT EXISTS pack_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id       UUID NOT NULL REFERENCES packs(id),
  comment_text  TEXT NOT NULL,
  actor_id      INTEGER REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pack_comments_pack_id ON pack_comments (pack_id, created_at);

-- 3. transition_definitions — replace Pack's 9 rows with the new 6. Direct
--    patch of the live table (this repo's convention: migrations apply
--    directly, never via the fragile migrate:seu replay) — the real source
--    of truth for a full reseed is transitionDefinitions.json/
--    authorityVocabulary.json (updated alongside this migration), reseeded by
--    db:clean-slate's own seedTransitionDefinitions()/seedAuthorityVocabulary().
DELETE FROM transition_definitions WHERE entity_type = 'Pack';

INSERT INTO transition_definitions (entity_type, from_state, to_state, required_authority_rule_id, required_policy_ids, trigger, verb)
SELECT 'Pack', v.from_state, v.to_state,
       (SELECT id FROM authority_rules WHERE code = v.authority_rule_code),
       ARRAY(SELECT id FROM policies WHERE code = 'policy-pack-transition-baseline'),
       'manual', v.verb
FROM (VALUES
  ('Draft',     'Validated', 'authority-transition-pack',          'validate'),
  ('Validated', 'Published', 'authority-transition-pack',          'publish'),
  ('Validated', 'Draft',     'authority-transition-pack',          'reject'),
  ('Published', 'Active',    'authority-transition-pack-elevated', 'activate'),
  ('Active',    'Retired',   'authority-transition-pack-elevated', 'retire'),
  ('Retired',   'Archived',  'authority-transition-pack-elevated', 'archive')
) AS v(from_state, to_state, authority_rule_code, verb);
