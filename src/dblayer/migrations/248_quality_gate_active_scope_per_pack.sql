-- Bug fix, found via a real test run (Phase 8, tests/web-flow.e2e.test.ts):
-- quality_gates_active_scope_category_key (migration 091) scopes the
-- "at most one active gate" guarantee to (entity_type, from_state, to_state,
-- category) only, platform-wide, across every Pack. qualityGatesDB.upsert's
-- own "unchanged content -> return the existing row untouched" short-circuit
-- never reassigns originating_pack_id when a DIFFERENT Pack republishes the
-- exact same gate content at that identity — so ownership sticks forever to
-- whichever Pack got there first, even once that Pack is no longer composed
-- into any SEU. Since compositionCompleted.ts's real per-SEU enforcement
-- (qualityGatesDB.findByPackIds(composedPackIds)) matches strictly on
-- originating_pack_id, a SEU composing the new, rightful Pack never sees its
-- own gate — it silently never applies. Chapter 26 §8 defines Originating
-- Pack as a per-gate field (singular, not shared); §12's Quality Gate
-- Composition already treats two genuinely different Packs targeting the
-- same (transition, category) as a real conflict for Governance composition
-- rules to resolve (unravelComposition/detectCompositionConflicts already
-- does this, keyed on `qualityGate::${governedTransition}::${category}`) —
-- so two Packs owning distinct, coexisting rows here is correct; the
-- collision is the compositor's problem to surface, not the DB's to
-- silently arbitrate by publish order.
ALTER TABLE quality_gates DROP CONSTRAINT IF EXISTS quality_gates_active_scope_category_key;
DROP INDEX IF EXISTS quality_gates_active_scope_category_key;
CREATE UNIQUE INDEX IF NOT EXISTS quality_gates_active_scope_category_pack_key
  ON quality_gates (entity_type, from_state, to_state, category, originating_pack_id)
  WHERE is_active;

-- migration 093's own quality_gates_scope_category_version_key has the exact
-- same platform-wide-not-per-Pack gap: each Pack's own gate independently
-- starts its own version lineage at '1.0' (qualityGatesDB.upsert's
-- nextVersion), so two different Packs contributing to the same
-- (transition, category) always collide on this constraint even after the
-- active-scope fix above — found the hard way, a real insert failure on
-- Phase 8's own second Pack publish. Same fix: fold originating_pack_id into
-- the identity.
ALTER TABLE quality_gates DROP CONSTRAINT IF EXISTS quality_gates_scope_category_version_key;
ALTER TABLE quality_gates ADD CONSTRAINT quality_gates_scope_category_version_pack_key
  UNIQUE (entity_type, from_state, to_state, category, version, originating_pack_id);
