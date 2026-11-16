// Transition Definition authoring: the Mapping's Allow trigger and the transitions added through the CR-007 add/retire form (noun x verb).
//
// NOTE: Transition Definitions are NOT authored through an SDK pipeline. CR-019
// established they are authored through the CR-007 add/retire form (noun × verb),
// and the bug fix that made Pack/Template/Profile authoring entity-direct removed
// the old Deliverable-based SDK authoring pipeline entirely.
//
// Built on throwaway, randomized (fromState, toState) pairs: inserting against a real, seeded
// triple would be a permanent, global change to this shared dev database.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { addTransitionDefinition } from "../src/routes/seu/core/transitionDefinitions.js";
import { addVerb, addMapping, listAuthorityMapping } from "../src/routes/seu/core/authorityVocabulary.js";
import { ROOT_ACTOR_ID, ROOT_ACTOR_BADGE } from "./testFixtures.js";

// Owner: "the allow now has only [noun] and [verb]. It should also include
// the trigger" — and the bug found reviewing the first pass: trigger has no
// storage of its own on a mapping row, it's a live read-through off whichever
// transition_definitions rows already share the (noun, verb) pair. Applying
// the Allow form's chosen trigger straight onto those rows would silently
// overwrite an ALREADY-EXISTING mapping's real, deliberately-set transitions
// every time Allow is resubmitted (its own upsert is idempotent — re-adding
// an existing pair just reactivates it). The fix: store the choice as the
// mapping's own default_trigger (migration 128), applied only to a NEW
// transition definition added later — never retroactively.
test("Mapping's Allow trigger seeds a new Transition Definition, but re-Allowing an existing pair never rewrites an already-wired one", async () => {
  const verbCode = `verb-td-${randomUUID().slice(0, 8)}`;
  const nounCode = "AttentionItem";
  const fromState = `td-mapping-from-${randomUUID()}`;
  const toState = `td-mapping-to-${randomUUID()}`;

  const verbAdded = await addVerb(verbCode, "Test trigger verb", null, ROOT_ACTOR_ID, ROOT_ACTOR_BADGE);
  assert.equal(verbAdded.ok, true, !verbAdded.ok ? verbAdded.error : "assertion failed");

  const allowed = await addMapping(nounCode, verbCode, "governed", ROOT_ACTOR_ID, ROOT_ACTOR_BADGE);
  assert.equal(allowed.ok, true, !allowed.ok ? allowed.error : "assertion failed");

  const created = await addTransitionDefinition({ entityType: nounCode, fromState, toState, verb: verbCode, policyCodes: [], authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE });
  assert.equal(created.ok, true, !created.ok ? created.error : "assertion failed");

  const { data: rowAfterCreate } = await transitionDefinitionsDB.find(nounCode, fromState, toState);
  assert.equal(rowAfterCreate?.trigger, "governed", "a new transition under this pair starts at the mapping's chosen trigger");

  const mappingAfterCreate = (await listAuthorityMapping()).find((m) => m.nounCode === nounCode && m.verbCode === verbCode);
  assert.equal(mappingAfterCreate?.hasWiredTransitions, true);
  assert.equal(mappingAfterCreate?.trigger, "governed");

  // Re-submitting Allow for the SAME pair with a DIFFERENT trigger — this is
  // exactly what the first pass got wrong: it must move the mapping's own
  // default, but must never touch the transition that already exists.
  const reAllowed = await addMapping(nounCode, verbCode, "manual", ROOT_ACTOR_ID, ROOT_ACTOR_BADGE);
  assert.equal(reAllowed.ok, true, !reAllowed.ok ? reAllowed.error : "assertion failed");

  const { data: rowAfterReAllow } = await transitionDefinitionsDB.find(nounCode, fromState, toState);
  assert.equal(rowAfterReAllow?.trigger, "governed", "an already-wired transition's trigger must survive re-submitting Allow");

  const mappingAfterReAllow = (await listAuthorityMapping()).find((m) => m.nounCode === nounCode && m.verbCode === verbCode);
  assert.equal(mappingAfterReAllow?.defaultTrigger, "manual", "the mapping's own default DOES move on re-Allow");
  assert.equal(mappingAfterReAllow?.trigger, "governed", "the list still shows the real wired transition's trigger, not the new default");

  // A SECOND new transition under the same pair now starts at the updated default.
  const secondFromState = `td-mapping-from2-${randomUUID()}`;
  const secondToState = `td-mapping-to2-${randomUUID()}`;
  const createdSecond = await addTransitionDefinition({ entityType: nounCode, fromState: secondFromState, toState: secondToState, verb: verbCode, policyCodes: [], authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE });
  assert.equal(createdSecond.ok, true, !createdSecond.ok ? createdSecond.error : "assertion failed");
  const { data: secondRow } = await transitionDefinitionsDB.find(nounCode, secondFromState, secondToState);
  assert.equal(secondRow?.trigger, "manual", "a transition added after the re-Allow starts at the NEW default");
  await pool.query("DELETE FROM transition_definitions WHERE entity_type = $1 AND to_state = ANY($2::text[])", [nounCode, [toState, secondToState]]);
});
