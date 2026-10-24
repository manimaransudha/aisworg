// CR-128 (Entity 9, EBM) and Events and Lifecycles.md Ch.3. The EBM's birth row, its governed Retire row with the
// Attention Item action, validateEbm, the buttons and the guards. The SEU/EBM event names on a full commissioning run
// are covered by tests/seu-ebm-event-lifecycle-table.test.ts.
//
//   - DEFINITION: the four EBM rows (birth and Retire are governed, Validate and Activate are manual).
//   - BIRTH: the composed EBM carries the birth row's state, and EBMCreated is published with the real actor and badge.
//   - DEAD REFERENCE: validateEbm takes the Retire row, publishes EBMRetired and raises the Attention Item.
//   - BUTTONS AND GUARDS: nextActionsFor lists only manual hops the viewer holds the badge for; no skips, no way back.
import "dotenv/config";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { BIRTH_STATE, RAISE_EBM_RETIRED_ATTENTION_ACTION_CODE } from "../src/dblayer/constants.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { ebmsDB } from "../src/dblayer/ebmsDB.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { seusDB } from "../src/dblayer/seusDB.js";
import { attentionItemsDB } from "../src/dblayer/attentionItemsDB.js";
import { validateEbm } from "../src/routes/seu/core/commissioning.js";
import { nextActionsFor } from "../src/domain/engine/entityTransition.js";
import { transitionAndPublish } from "./testFixtures.js";
import type { EbmRow } from "../src/dblayer/seuTypes.js";
import { commissionFromFormSync, ensureEventSubscriptionsLoaded, TESTER_ALL_ID, TESTER_OBJECTIVE_ACHIEVE_ONLY } from "./testFixtures.js";

before(async () => {
  await ensureEventSubscriptionsLoaded();
});

// A commissioned SEU gives a real, Active EBM. A second Composed EBM is written beside it through ebmsDB.create (the
// state from the birth row), copying the composition of the first. It is not set as the SEU's active EBM.
async function commissionedSeu(): Promise<{ seuId: string; active: EbmRow }> {
  const result = await commissionFromFormSync({
    statement: `ebm-lifecycle-table-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture-design", "software-construction"],
    actorId: TESTER_ALL_ID,
    requestedBy: TESTER_ALL_ID,
  });
  assert.equal(result.ok, true, result.ok ? "" : `${result.stage}: ${result.reason}`);
  if (!result.ok) throw new Error("commissioning failed");
  const { data: seu } = await seusDB.findById(result.seu.id);
  const { data: active } = await ebmsDB.findById(seu!.active_ebm_id!);
  return { seuId: result.seu.id, active: active! };
}

async function composedCopy(source: EbmRow, packCodes?: string[]): Promise<EbmRow> {
  const { data: birth } = await transitionDefinitionsDB.findBirth("EBM");
  const { data: created, error } = await ebmsDB.create({
    seuId: source.seu_id,
    templateId: source.template_id,
    profileId: source.profile_id,
    authorId: (source as unknown as { author_id: string }).author_id,
    authorBadge: (source as unknown as { author_badge: string }).author_badge,
    status: birth!.to_state as EbmRow["status"],
    composedPacks: packCodes ? packCodes.map((packCode) => ({ ...source.composed_packs[0], packCode })) : source.composed_packs,
    compositionReport: source.composition_report,
  });
  if (error || !created) throw error ?? new Error("failed to create the second EBM");
  return created;
}

test("DEFINITION: the four EBM rows", async () => {
  const expected = [
    { from: BIRTH_STATE, to: "Composed", verb: "compose", trigger: "governed", eventType: "EBMCreated", actionCode: null },
    { from: "Composed", to: "Validated", verb: "validate", trigger: "manual", eventType: "EBMValidated", actionCode: null },
    { from: "Validated", to: "Active", verb: "activate", trigger: "manual", eventType: "EBMActivated", actionCode: null },
    { from: "Composed", to: "Retired", verb: "retire", trigger: "governed", eventType: "EBMRetired", actionCode: RAISE_EBM_RETIRED_ATTENTION_ACTION_CODE },
  ];
  for (const e of expected) {
    const { data: def } = await transitionDefinitionsDB.find("EBM", e.from, e.to);
    assert.ok(def, `no row for EBM ${e.from} -> ${e.to}`);
    assert.equal(def!.verb, e.verb, `${e.from} -> ${e.to}: verb`);
    assert.equal(def!.trigger, e.trigger, `${e.from} -> ${e.to}: trigger`);
    assert.equal(def!.event_type, e.eventType, `${e.from} -> ${e.to}: event_type`);
    assert.equal(def!.action_code, e.actionCode, `${e.from} -> ${e.to}: action_code`);
    assert.equal(def!.version_event, null, `${e.from} -> ${e.to}: EBM hops are not version-significant`);
  }
});

test("BIRTH: the composed EBM and its EBMCreated event", async () => {
  const { seuId, active } = await commissionedSeu();
  const { data: events } = await eventsDB.findByOriginatingObject("EBM", active.id);
  const created = (events ?? []).filter((e) => e.event_type === "EBMCreated");
  assert.equal(created.length, 1, "exactly one EBMCreated");
  assert.equal(created[0].seu_id, seuId);
  assert.ok(created[0].actor_id, "a real actor");
  assert.ok(created[0].authority_badge, "a real badge");
});

test("DEAD REFERENCE: validateEbm takes the governed Retire row, publishes EBMRetired and raises the Attention Item", async () => {
  const { active } = await commissionedSeu();
  const dead = await composedCopy(active, [`pack-that-does-not-exist-${randomUUID()}`]);

  const result = await validateEbm({ ebmId: dead.id, actorId: TESTER_ALL_ID });
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.reason === "ebm_retired", "ebm_retired result");

  const { data: after } = await ebmsDB.findById(dead.id);
  assert.equal(after!.status, "Retired");
  const { data: events } = await eventsDB.findByOriginatingObject("EBM", dead.id);
  assert.ok((events ?? []).some((e) => e.event_type === "EBMRetired"), "EBMRetired published from the row");
  assert.ok(!(events ?? []).some((e) => e.event_type === "EBMValidated"), "no EBMValidated");
  const { data: item } = await attentionItemsDB.findOpenByRelatedObject(dead.seu_id, "EBM Retired", "EBM", dead.id);
  assert.ok(item, "the Attention Item is raised by the action code");
  assert.equal((await nextActionsFor("EBM", "Retired", TESTER_ALL_ID)).length, 0, "a Retired EBM has no next action");
});

test("VALIDATE and BUTTONS: live references validate; only manual hops are offered, by badge", async () => {
  const { seuId, active } = await commissionedSeu();
  const live = await composedCopy(active);

  const verbs = (await nextActionsFor("EBM", "Composed", TESTER_ALL_ID)).map((a) => a.verb);
  assert.deepEqual(verbs, ["validate"], "Retire is governed and never a button");
  assert.deepEqual(await nextActionsFor("EBM", "Composed", TESTER_OBJECTIVE_ACHIEVE_ONLY.userId), [], "no badge, no button");

  const result = await validateEbm({ ebmId: live.id, actorId: TESTER_ALL_ID });
  assert.equal(result.ok, true, result.ok ? "" : String("detail" in result ? result.detail : result.reason));
  const { data: events } = await eventsDB.findByOriginatingObject("EBM", live.id);
  const validated = (events ?? []).find((e) => e.event_type === "EBMValidated");
  assert.ok(validated, "EBMValidated published");
  assert.equal(validated!.seu_id, seuId, "the event carries the SEU id passed by the caller");
  assert.deepEqual((await nextActionsFor("EBM", "Validated", TESTER_ALL_ID)).map((a) => a.verb), ["activate"]);
});

test("GUARD: no skip to Active and no way back", async () => {
  const { active } = await commissionedSeu();
  const composed = await composedCopy(active);
  const skip = await transitionAndPublish({ entityType: "EBM", entityId: composed.id, targetState: "Active", actorId: TESTER_ALL_ID, seuId: composed.seu_id });
  assert.ok(!skip.ok && skip.reason === "no_transition_definition", "Composed -> Active has no row");
  const back = await transitionAndPublish({ entityType: "EBM", entityId: active.id, targetState: "Composed", actorId: TESTER_ALL_ID, seuId: active.seu_id });
  assert.ok(!back.ok && back.reason === "no_transition_definition", "Active -> Composed has no row");
});
