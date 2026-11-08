// Composition Completed handler (src/domain/engine/compositionCompleted.ts): the EBM an SEU gets from the composition its commissioning stashed,
// and the failures that take the SEU to Failed.
//
//   - Each case has an SEU of its own, in its first state (Initiated), with the composition report the case needs. The handler is called with the
//     CompositionCompleted event it would receive. Event subscriptions are not loaded in this file, so the events the handler publishes run no handler.
//   - Rows are not deleted, as in the other tests that create SEUs.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { seusDB } from "../src/dblayer/seusDB.js";
import { ebmsDB } from "../src/dblayer/ebmsDB.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { compositionCompletedHandler } from "../src/domain/engine/compositionCompleted.js";
import { createTestSeu, publishTestEvent } from "./engineFixtures.js";
import { ROOT_ACTOR_BADGE } from "./testFixtures.js";

const completed = (seuId: string, seuIdInPayload: string, authorBadge: string | undefined) =>
  publishTestEvent({ eventType: "CompositionCompleted", originatingObjectType: "SEU", originatingObjectId: seuId, seuId, payload: { seuId: seuIdInPayload, authorBadge } });

const lifecycleOf = async (seuId: string) => (await seusDB.findById(seuId)).data?.lifecycle_state;

test("the handler ignores an event for an SEU that does not exist, and an event with no actor", async () => {
  const { seu } = await createTestSeu("composition-completed-ignored");
  await compositionCompletedHandler(await completed(seu.id, randomUUID(), ROOT_ACTOR_BADGE));
  await compositionCompletedHandler({ ...(await completed(seu.id, seu.id, ROOT_ACTOR_BADGE)), actor_id: "" });
  assert.equal((await seusDB.findById(seu.id)).data?.active_ebm_id, null, "no EBM is created");
  assert.equal(await lifecycleOf(seu.id), "Initiated");
});

test("the handler creates the EBM from the stashed composition, makes it the SEU's active EBM and publishes the EBM's birth event", async () => {
  const { seu } = await createTestSeu("composition-completed-success");
  await seusDB.setCompositionReport(seu.id, { composedPacks: [], settled: { policies: { result: [] } }, recordedConflicts: [] });
  await compositionCompletedHandler(await completed(seu.id, seu.id, ROOT_ACTOR_BADGE));

  const { data: reloaded } = await seusDB.findById(seu.id);
  assert.ok(reloaded?.active_ebm_id, "the EBM is the SEU's active EBM");
  assert.equal(reloaded.lifecycle_state, "Initiated");
  const { data: ebm } = await ebmsDB.findById(reloaded.active_ebm_id);
  assert.deepEqual((ebm?.behaviors as { settled?: unknown } | null)?.settled, { policies: { result: [] } });
  const { data: events } = await eventsDB.findByOriginatingObject("EBM", reloaded.active_ebm_id);
  assert.equal(events?.length, 1, "the birth event is published");
});

test("the handler fails the SEU when the stashed composition cannot be read", async () => {
  const { seu } = await createTestSeu("composition-completed-unreadable");
  await seusDB.setCompositionReport(seu.id, { composedPacks: [null] });
  await compositionCompletedHandler(await completed(seu.id, seu.id, ROOT_ACTOR_BADGE));
  assert.equal(await lifecycleOf(seu.id), "Failed");
  assert.equal((await seusDB.findById(seu.id)).data?.active_ebm_id, null);
});

test("the handler fails the SEU when the EBM cannot be written", async () => {
  const { seu } = await createTestSeu("composition-completed-unwritable");
  await seusDB.setCompositionReport(seu.id, { composedPacks: [] });
  await compositionCompletedHandler(await completed(seu.id, seu.id, undefined));
  assert.equal(await lifecycleOf(seu.id), "Failed", "an EBM needs the badge it is authored under");
  assert.equal((await seusDB.findById(seu.id)).data?.active_ebm_id, null);
});
