// CR-128 Entity 19: the Participant birth row and the governed hops.
//
//   - DEFINITION: the birth row None -> Available (verb create, trigger governed, event ParticipantCreated, no version
//     event), the eleven hop rows with their events, and no version events.
//   - DRIVEN: createParticipant writes the birth state and publishes the birth event; every hop publishes the row's
//     event and then ParticipantTransitioned with one correlation id; a hop with no row writes and publishes nothing;
//     an actor with no participant row in the SEU is refused.
//   - AUTHORITY: the platform system actor resolves participant_* badges and a plain actor without the badge does not.
//   - GUARD: only the Participant adapter writes the state and no code names the birth event as a literal.
import "dotenv/config";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import pool from "../src/utils/db.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { participantsDB } from "../src/dblayer/participantsDB.js";
import { createParticipant, transitionParticipant } from "../src/routes/seu/core/participants.js";
import { badgeAuthorityEngine } from "../src/domain/engine/badgeAuthorityEngine.js";
import { getSystemActor } from "../src/dblayer/constants.js";
import { commissionFromFormSync, ensureEventSubscriptionsLoaded, resolveDispatchRejectionObligations, ROOT_ACTOR_ID, TESTER_ALL_ID, TESTER_ACCEPTANCE_JOURNEY, TESTER_OBJECTIVE_ACHIEVE_ONLY } from "./testFixtures.js";

before(async () => {
  await ensureEventSubscriptionsLoaded();
});

const HOPS = [
  { fromState: "Created", toState: "Available", eventType: "ParticipantActivated" },
  { fromState: "Available", toState: "Assigned", eventType: "ParticipantAssigned" },
  { fromState: "Assigned", toState: "Executing", eventType: "ParticipantExecuting" },
  { fromState: "Executing", toState: "Idle", eventType: "ParticipantIdle" },
  { fromState: "Assigned", toState: "Idle", eventType: "ParticipantIdle" },
  { fromState: "Idle", toState: "Assigned", eventType: "ParticipantAssigned" },
  { fromState: "Idle", toState: "Released", eventType: "ParticipantReleased" },
  { fromState: "Available", toState: "Released", eventType: "ParticipantReleased" },
  { fromState: "Assigned", toState: "Released", eventType: "ParticipantReleased" },
  { fromState: "Executing", toState: "Released", eventType: "ParticipantReleased" },
  { fromState: "Released", toState: "Archived", eventType: "ParticipantArchived" },
];

test("DEFINITION: the birth row, the eleven hop rows and their events", async () => {
  const { data: birth } = await transitionDefinitionsDB.findBirth("Participant");
  assert.ok(birth, "the Participant birth row exists");
  assert.equal(birth!.to_state, "Available");
  assert.equal(birth!.verb, "create");
  assert.equal(birth!.trigger, "governed");
  assert.equal(birth!.event_type, "ParticipantCreated");
  assert.equal(birth!.version_event, null);

  for (const hop of HOPS) {
    const { data: def } = await transitionDefinitionsDB.find("Participant", hop.fromState, hop.toState);
    assert.ok(def, `no row for Participant ${hop.fromState} -> ${hop.toState}`);
    assert.equal(def!.event_type, hop.eventType, `${hop.fromState} -> ${hop.toState}: event_type`);
    assert.equal(def!.version_event, null, `${hop.fromState} -> ${hop.toState}: version_event`);
  }
  const { rows } = await pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM transition_definitions WHERE entity_type = 'Participant' AND to_state NOT LIKE 'qg-%'");
  assert.equal(Number(rows[0].count), HOPS.length + 1, "unexpected extra/missing Participant rows (the hops plus the birth row)");
});

let seuId: string;

async function freshParticipant(label: string) {
  return createParticipant({ seuId, type: "Human", displayName: `${label} ${randomUUID()}`, actorId: ROOT_ACTOR_ID, authorBadge: "root" });
}

async function eventsFor(participantId: string) {
  const { data } = await eventsDB.findByOriginatingObject("Participant", participantId);
  return data ?? [];
}

test("DRIVEN setup: a real commissioned SEU to hang Participants off", async () => {
  const result = await commissionFromFormSync({
    statement: `participant-lifecycle-table-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture-design", "software-construction"],
    actorId: TESTER_ALL_ID,
    requestedBy: TESTER_ALL_ID,
  });
  assert.equal(result.ok, true, result.ok ? "" : `${result.stage}: ${result.reason}`);
  if (!result.ok) return;
  seuId = result.seu.id;
  await resolveDispatchRejectionObligations(seuId);
});

test("DRIVEN: createParticipant writes the birth state and publishes the birth event", async () => {
  const participant = await freshParticipant("birth");
  assert.equal(participant.state, "Available");
  assert.deepEqual((await eventsFor(participant.id)).map((e) => e.event_type), ["ParticipantCreated"]);
});

test("DRIVEN: every hop publishes the row's event and then ParticipantTransitioned with one correlation id", async () => {
  const participant = await freshParticipant("hops");
  const steps: Array<{ target: string; event: string }> = [
    { target: "Assigned", event: "ParticipantAssigned" },
    { target: "Executing", event: "ParticipantExecuting" },
    { target: "Idle", event: "ParticipantIdle" },
    { target: "Assigned", event: "ParticipantAssigned" },
    { target: "Idle", event: "ParticipantIdle" },
    { target: "Released", event: "ParticipantReleased" },
    { target: "Archived", event: "ParticipantArchived" },
  ];
  for (const step of steps) {
    const before = (await eventsFor(participant.id)).length;
    const result = await transitionParticipant({ participantId: participant.id, targetState: step.target, actorId: TESTER_ALL_ID });
    assert.equal(result.ok, true, !result.ok ? `-> ${step.target} failed: ${JSON.stringify(result)}` : "assertion failed");
    const added = (await eventsFor(participant.id)).slice(before);
    assert.deepEqual(added.map((e) => e.event_type), [step.event, "ParticipantTransitioned"], `-> ${step.target}`);
    assert.equal(added[0].correlation_id, added[1].correlation_id);
    assert.deepEqual(added[0].payload, added[1].payload);
  }
});

test("DRIVEN: a hop with no Transition Definition is refused and writes and publishes nothing", async () => {
  const participant = await freshParticipant("refused hop");
  const before = (await eventsFor(participant.id)).map((e) => e.event_type);
  const result = await transitionParticipant({ participantId: participant.id, targetState: "Executing", actorId: TESTER_ALL_ID });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "no_transition_definition");
  assert.deepEqual((await eventsFor(participant.id)).map((e) => e.event_type), before);
  assert.equal((await participantsDB.findById(participant.id)).data!.state, "Available");
});

test("DRIVEN: a hop by an actor with no participant row in the SEU is refused and writes nothing", async () => {
  const participant = await freshParticipant("no participant row");
  // Holds every badge and has no participants row in this SEU, so only the SEU participant check can refuse it.
  await assert.rejects(
    transitionParticipant({ participantId: participant.id, targetState: "Assigned", actorId: TESTER_ACCEPTANCE_JOURNEY.participantId }),
    /No participants row/
  );
  assert.equal((await participantsDB.findById(participant.id)).data!.state, "Available");
});

test("AUTHORITY: the platform system actor resolves participant badges and a plain actor without the badge does not", async () => {
  const system = await getSystemActor(seuId);
  assert.equal(await badgeAuthorityEngine.resolveAuthorBadge(system.actorId, "participant_assign"), "participant_assign");
  assert.equal(await badgeAuthorityEngine.resolveAuthorBadge(system.actorId, "participant_idle"), "participant_idle");
  await assert.rejects(
    badgeAuthorityEngine.resolveAuthorBadge(TESTER_OBJECTIVE_ACHIEVE_ONLY.participantId, "participant_assign"),
    /does not hold participant_assign/
  );
});

test("GUARD: only the Participant adapter writes the state and no code names the birth event as a literal", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".ts")) files.push(path);
    }
  };
  walk(join(process.cwd(), "src"));
  const stateWriters = files.filter((f) => /participantsDB\.updateStatus\(/.test(readFileSync(f, "utf8")));
  assert.deepEqual(stateWriters.map((f) => f.slice(process.cwd().length + 1)), ["src/domain/engine/entityAdapters.ts"]);
  const eventLiterals = files.filter((f) => /["']ParticipantCreated["']|["']ParticipantIdle["']|["']ParticipantAssigned["']/.test(readFileSync(f, "utf8")));
  assert.deepEqual(eventLiterals, []);
});
