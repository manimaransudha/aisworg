// CR-128 (Entity 11, SEU) and Events and Lifecycles.md Ch.2 and Ch.8. The SEU's birth row (the Save button), the Validate
// hop with its action code, the governed Failed rows, the manual lifecycle rows, the buttons and the guards. The EBM flow and
// the commissioning hops on a full run are covered by tests/seu-ebm-event-lifecycle-table.test.ts.
//
//   - DEFINITION: the SEU rows: verb, trigger, event, action code, no version event.
//   - SAVE: initiateSeu writes the birth row's state and publishes CommissionInitiated with the real actor and badge.
//   - VALIDATE: a live SEU moves to Validated and publishes CommissionValidated; a dead reference moves it to Failed and
//     publishes CommissionFailed once, with { stage, reason, references, checks }.
//   - LIFECYCLE: suspend, resume, retire and archive publish their events.
//   - BUTTONS AND GUARDS: nextActionsFor lists only manual hops the viewer holds the badge for; no skips, no way back.
import "dotenv/config";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { BIRTH_STATE, VALIDATE_SEU_REQUEST_ACTION_CODE } from "../src/dblayer/constants.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { seusDB } from "../src/dblayer/seusDB.js";
import { createObjective } from "../src/routes/seu/core/objectives.js";
import { publishProfile } from "../src/routes/seu/core/profiles.js";
import { initiateSeu, validateSeu } from "../src/routes/seu/core/commissioning.js";
import { nextActionsFor } from "../src/domain/engine/entityTransition.js";
import { createActiveObjective, ensureWebAppTemplateFixture, ensureEventSubscriptionsLoaded, transitionAndPublish, ROOT_ACTOR_ID, TESTER_ALL_ID, TESTER_OBJECTIVE_ACHIEVE_ONLY } from "./testFixtures.js";

before(async () => {
  await ensureEventSubscriptionsLoaded();
});

async function activeLeafObjective() {
  const { objective: root } = await createObjective({ statement: `seu-root-${randomUUID()}`, requiredCapabilityCodes: [], tier: "Strategic", requestedBy: TESTER_ALL_ID });
  const { objective } = await createActiveObjective({
    statement: `seu-lifecycle-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture-design", "software-construction"],
    tier: "Engineering",
    parentObjectiveId: root.id,
    requestedBy: TESTER_ALL_ID,
  });
  return objective;
}

async function publishedProfile(): Promise<string> {
  const { template } = await ensureWebAppTemplateFixture();
  const published = await publishProfile({
    seed: {
      code: `seu-lifecycle-profile-${randomUUID()}`,
      name: "SEU lifecycle test profile",
      baseTemplateCode: template.code,
      environment: "development",
      profileVersion: "1.0.0",
      developmentMethodology: "scrum",
      primaryProgrammingLanguage: "typescript",
      sourceControlProvider: "github",
    },
    actorId: ROOT_ACTOR_ID,
  });
  assert.equal(published.ok, true, published.ok ? "" : JSON.stringify(published.errors));
  if (!published.ok) throw new Error("unreachable");
  return published.profileId;
}

async function initiated(actorId: string = TESTER_ALL_ID) {
  const objective = await activeLeafObjective();
  const profileId = await publishedProfile();
  const result = await initiateSeu({ objectiveId: objective.id, profileId, actorId });
  assert.equal(result.ok, true, result.ok ? "" : result.reason);
  if (!result.ok) throw new Error("unreachable");
  return { seu: result.seu, objective, profileId };
}

test("DEFINITION: the SEU rows carry their verb, trigger, event and action code, and no version event", async () => {
  const rows: Array<{ from: string; to: string; verb: string; trigger: "manual" | "governed"; event: string; action?: string }> = [
    { from: BIRTH_STATE, to: "Initiated", verb: "commission", trigger: "manual", event: "CommissionInitiated" },
    { from: "Initiated", to: "Validated", verb: "validate", trigger: "manual", event: "CommissionValidated", action: VALIDATE_SEU_REQUEST_ACTION_CODE },
    { from: "Initiated", to: "Failed", verb: "fail", trigger: "governed", event: "CommissionFailed" },
    { from: "Validated", to: "Failed", verb: "fail", trigger: "governed", event: "CommissionFailed" },
    { from: "Configured", to: "Failed", verb: "fail", trigger: "governed", event: "CommissionFailed" },
    { from: "Commissioned", to: "Failed", verb: "fail", trigger: "governed", event: "CommissionFailed" },
    { from: "Validated", to: "Configured", verb: "configure", trigger: "governed", event: "SEUConfigured" },
    { from: "Configured", to: "Commissioned", verb: "commission", trigger: "governed", event: "SEUCommissioned" },
    { from: "Commissioned", to: "Activated", verb: "activate", trigger: "governed", event: "SEUActivated" },
    { from: "Activated", to: "Operational", verb: "operationalise", trigger: "governed", event: "SEUOperational" },
    { from: "Operational", to: "Suspended", verb: "suspend", trigger: "manual", event: "SEUSuspended" },
    { from: "Suspended", to: "Operational", verb: "resume", trigger: "manual", event: "SEUResumed" },
    { from: "Operational", to: "Retired", verb: "retire", trigger: "manual", event: "SEURetired" },
    { from: "Suspended", to: "Retired", verb: "retire", trigger: "manual", event: "SEURetired" },
    { from: "Retired", to: "Archived", verb: "archive", trigger: "manual", event: "SEUArchived" },
  ];
  for (const row of rows) {
    const { data: def } = await transitionDefinitionsDB.find("SEU", row.from, row.to);
    assert.ok(def, `no row for SEU ${row.from} -> ${row.to}`);
    assert.equal(def!.verb, row.verb, `${row.from} -> ${row.to}: verb`);
    assert.equal(def!.trigger, row.trigger, `${row.from} -> ${row.to}: trigger`);
    assert.equal(def!.event_type, row.event, `${row.from} -> ${row.to}: event_type`);
    assert.equal(def!.version_event, null, `${row.from} -> ${row.to}: version_event`);
    assert.equal(def!.action_code, row.action ?? null, `${row.from} -> ${row.to}: action_code`);
  }
  const { data: probe } = await transitionDefinitionsDB.find("SEU", "Pending", "Commissioned");
  assert.equal(probe, null, "the gate probe row Pending -> Commissioned is gone");
});

test("SAVE: initiateSeu writes the birth row's state and publishes CommissionInitiated as the only event", async () => {
  const { seu } = await initiated();
  assert.equal(seu.lifecycle_state, "Initiated");
  const { data: events } = await eventsDB.findByOriginatingObject("SEU", seu.id);
  assert.deepEqual((events ?? []).map((e) => e.event_type), ["CommissionInitiated"]);
  const event = events![0];
  assert.equal(event.actor_id, TESTER_ALL_ID);
  assert.equal(event.authority_badge, seu.author_badge, "the event carries the badge the birth resolved");
  assert.match(seu.author_badge, /seu_commission|root/);
});

test("SAVE: a missing Objective, a missing Profile, a second SEU for the Objective and an actor without seu_commission write no SEU", async () => {
  const objective = await activeLeafObjective();
  const profileId = await publishedProfile();

  const noObjective = await initiateSeu({ objectiveId: null, profileId, actorId: TESTER_ALL_ID });
  assert.equal(noObjective.ok, false);
  const noProfile = await initiateSeu({ objectiveId: objective.id, profileId: null, actorId: TESTER_ALL_ID });
  assert.equal(noProfile.ok, false);
  const { data: none } = await seusDB.findByObjectiveId(objective.id);
  assert.equal(none, null, "the refusals wrote nothing");

  await assert.rejects(() => initiateSeu({ objectiveId: objective.id, profileId, actorId: TESTER_OBJECTIVE_ACHIEVE_ONLY.participantId }), /seu_commission/);
  const { data: stillNone } = await seusDB.findByObjectiveId(objective.id);
  assert.equal(stillNone, null, "an actor without seu_commission wrote nothing");

  const first = await initiateSeu({ objectiveId: objective.id, profileId, actorId: TESTER_ALL_ID });
  assert.equal(first.ok, true);
  const again = await initiateSeu({ objectiveId: objective.id, profileId, actorId: TESTER_ALL_ID });
  assert.equal(again.ok && first.ok && again.seu.id === first.seu.id, true, "the same Profile reuses the Initiated SEU");
  const second = await initiateSeu({ objectiveId: objective.id, profileId: await publishedProfile(), actorId: TESTER_ALL_ID });
  assert.equal(second.ok, false, "an Objective has one SEU");
});

test("VALIDATE: live references move the SEU to Validated and publish CommissionValidated with the checks", async () => {
  const { seu } = await initiated();
  const result = await validateSeu({ seuId: seu.id, actorId: TESTER_ALL_ID });
  assert.equal(result.ok, true, result.ok ? "" : JSON.stringify(result));
  const { data: after } = await seusDB.findById(seu.id);
  assert.equal(after?.lifecycle_state, "Validated");

  const { data: events } = await eventsDB.findByOriginatingObject("SEU", seu.id);
  const types = (events ?? []).map((e) => e.event_type);
  assert.deepEqual(types, ["CommissionInitiated", "CommissionValidated"]);
  const validated = events!.find((e) => e.event_type === "CommissionValidated")!;
  const initiatedEvent = events!.find((e) => e.event_type === "CommissionInitiated")!;
  assert.equal(validated.correlation_id, initiatedEvent.correlation_id, "the commissioning keeps one correlation id");
  assert.equal(validated.causation_id, initiatedEvent.id);
  const checks = (validated.payload as { checks?: unknown[] }).checks;
  assert.ok(Array.isArray(checks) && checks.length > 0, "the payload carries the liveness checks");
});

test("VALIDATE: a dead reference moves the SEU to Failed and publishes CommissionFailed once, not CommissionValidated", async () => {
  const { seu, profileId } = await initiated();
  const retired = await transitionAndPublish({ entityType: "Profile", entityId: profileId, targetState: "Deprecated", actorId: ROOT_ACTOR_ID });
  assert.equal(retired.ok, true);

  const result = await validateSeu({ seuId: seu.id, actorId: TESTER_ALL_ID });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "commission_failed");
  const { data: after } = await seusDB.findById(seu.id);
  assert.equal(after?.lifecycle_state, "Failed");

  const { data: events } = await eventsDB.findByOriginatingObject("SEU", seu.id);
  const types = (events ?? []).map((e) => e.event_type);
  assert.equal(types.filter((t) => t === "CommissionFailed").length, 1);
  assert.ok(!types.includes("CommissionValidated"));
  const failed = events!.find((e) => e.event_type === "CommissionFailed")!;
  const payload = failed.payload as { stage?: string; reason?: string; references?: string[]; checks?: unknown[] };
  assert.equal(payload.stage, "validate_request");
  assert.equal(payload.reason, "stale_reference");
  assert.ok((payload.references ?? []).length > 0);
  assert.ok(Array.isArray(payload.checks));
});

test("LIFECYCLE: suspend, resume, retire and archive publish their events", async () => {
  const { seu } = await initiated();
  await seusDB.updateLifecycleState(seu.id, "Operational");
  const steps: Array<[string, string]> = [["Suspended", "SEUSuspended"], ["Operational", "SEUResumed"], ["Retired", "SEURetired"], ["Archived", "SEUArchived"]];
  for (const [toState, eventType] of steps) {
    const result = await transitionAndPublish({ entityType: "SEU", entityId: seu.id, targetState: toState, actorId: TESTER_ALL_ID, seuId: seu.id });
    assert.equal(result.ok, true, `${toState}: ${result.ok ? "" : JSON.stringify(result)}`);
    const { data: events } = await eventsDB.findByOriginatingObject("SEU", seu.id);
    assert.ok((events ?? []).some((e) => e.event_type === eventType), `${eventType} published`);
  }
});

test("BUTTONS: Initiated offers Validate to a holder of seu_validate, Operational offers suspend and retire, Validated offers none", async () => {
  const verbs = async (state: string, actor: string) => (await nextActionsFor("SEU", state, actor)).map((a) => a.verb).sort();
  assert.deepEqual(await verbs("Initiated", TESTER_ALL_ID), ["validate"]);
  assert.deepEqual(await verbs("Initiated", TESTER_OBJECTIVE_ACHIEVE_ONLY.participantId), []);
  assert.deepEqual(await verbs("Operational", TESTER_ALL_ID), ["retire", "suspend"]);
  assert.deepEqual(await verbs("Validated", TESTER_ALL_ID), []);
  assert.deepEqual(await verbs("Failed", TESTER_ALL_ID), []);
});

test("GUARD: no skip from Initiated to Activated and no way back from Failed", async () => {
  const { seu } = await initiated();
  const skip = await transitionAndPublish({ entityType: "SEU", entityId: seu.id, targetState: "Activated", actorId: TESTER_ALL_ID, seuId: seu.id });
  assert.equal(skip.ok, false);
  if (!skip.ok) assert.equal(skip.reason, "no_transition_definition");
  await seusDB.updateLifecycleState(seu.id, "Failed");
  const back = await transitionAndPublish({ entityType: "SEU", entityId: seu.id, targetState: "Validated", actorId: TESTER_ALL_ID, seuId: seu.id });
  assert.equal(back.ok, false);
});
