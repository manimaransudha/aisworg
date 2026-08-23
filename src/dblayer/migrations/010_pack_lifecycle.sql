-- Post-MVP Phase 9 — Pack Platform maturity (Ch.5, Ch.38, Ch.39, Ch.41).
-- Two real, pre-existing gaps closed here, both named explicitly in
-- Post-MVP Build Sequence.md's Phase 9 entry:
--
-- 1. "Packs currently carry a lifecycle status column that nothing drives."
--    `packs.status` already existed with the right CHECK values (matching
--    Ch.5 §11 / Ch.38 §9's Draft -> Validated -> Published -> Active ->
--    Deprecated -> Retired -> Archived exactly) but every Pack was written
--    directly as 'Active' by the old seed script's upsert, and nothing ever
--    transitioned it. Pack becomes the 11th TransitionEntityType, governed by
--    the same generic transitionEngine as everything else — zero new
--    evaluation code, only new transition_definitions/authority/policy rows
--    (seeded in core-engineering.pack.json, applied by seedSeu.ts).
--
-- 2. "Proper Revision/Version separation (Ch.41)." Ch.41 VM-002: "Versions
--    are immutable." packs.code was UNIQUE alone, so publishing a new
--    pack_version for an existing code silently overwrote the same row in
--    place (packsDB.upsert's ON CONFLICT (code) DO UPDATE) — a real
--    immutability violation once you look for it. Fixed by making
--    (code, pack_version) the unique identity instead: each published
--    version is now its own immutable row, and republishing under a new
--    version creates a new row rather than mutating the old one (see
--    core/packs.ts's publishPack, which also supersedes the previously-Active
--    version of the same code by transitioning it to Deprecated). Scope
--    note: this immutability fix is deliberately Pack-row-level only, not
--    extended to the individual contributed objects (capabilities, policies,
--    authority rules, quality gates) a Pack seeds — those still upsert by
--    code, same as before Phase 9. Generalising immutability to every
--    contributed sub-object is a real, larger undertaking flagged as a known
--    residual gap rather than solved here (see Technology Decisions.md's
--    post-Phase-9 note).
-- CR-059 build-time fix — the ADD half below is superseded by migration 063
-- (CR-026 tenant-scoped versioning): (code, pack_version) widened to
-- (code, pack_version, tenant_id) so two tenants can publish the identical
-- code+version independently. Replaying this file after 063 has already run
-- silently resurrected the old global constraint (unconditional ADD, no
-- guard against 063's later DROP), which reintroduced the exact cross-tenant
-- collision CR-026 fixed — caught by tests/pack-sdk.test.ts's own CR-026
-- coverage. Dropped only, matching 063's own settled design; not re-added.
ALTER TABLE packs DROP CONSTRAINT IF EXISTS packs_code_key;
ALTER TABLE packs DROP CONSTRAINT IF EXISTS packs_code_version_key;

ALTER TABLE packs ALTER COLUMN status SET DEFAULT 'Draft';

-- CR-059 build-time fix — superseded by migration 036 (CR-006, "the
-- constraint stays dropped"); this transient re-add was breaking replay
-- against real accumulated 'Template'/'Profile' rows. See 003's own note.

ALTER TABLE quality_gates DROP CONSTRAINT IF EXISTS quality_gates_entity_type_check;
ALTER TABLE quality_gates ADD CONSTRAINT quality_gates_entity_type_check
  CHECK (entity_type IN ('SEU', 'Deliverable', 'Objective', 'Obligation', 'Evidence', 'Knowledge', 'Decision', 'KnowledgeScope', 'AttentionItem', 'ExternalInteraction', 'Pack', 'Participant', 'Review', 'Finding'));
