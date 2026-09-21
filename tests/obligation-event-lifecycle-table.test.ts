// Version Feature Plan.md, point 1: an executable check of Events and
// Lifecycles.md's Chapter 23 (Obligation) table, migration 252.
//
//   - DEFINITION: every real transition_definitions row for Obligation
//     carries the expected event_type and version_event ('VersionCreated' on
//     all of them, owner-directed), and exactly these 15 rows exist.
//   - DRIVEN: real transitionObligation calls publish BOTH the hop's own named
//     event and the generic ObligationTransitioned; Reopen and Escalate work;
//     Closed cannot skip verification; reviseObligation appends only the
//     changed fields to revision_history, publishes no event, and moves
//     neither status nor version.
import "dotenv/config";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { obligationsDB } from "../src/dblayer/obligationsDB.js";
import { createObligation, transitionObligation, reviseObligation } from "../src/routes/seu/core/obligations.js";
import { commissionFromFormSync, ensureEventSubscriptionsLoaded, resolveDispatchRejectionObligations } from "./testFixtures.js";

before(async () => {
  await ensureEventSubscriptionsLoaded();
});

interface Hop {
  description: string;
  fromState: string;
  toState: string;
  eventType: string;
}

const MAIN_CHAIN: Hop[] = [
  { description: "Analyse", fromState: "Identified", toState: "Analysed", eventType: "ObligationUpdated" },
  { description: "Assign", fromState: "Analysed", toState: "Assigned", eventType: "ObligationAssigned" },
  { description: "Begin work", fromState: "Assigned", toState: "In Progress", eventType: "ObligationProcessing" },
  { description: "Resolve", fromState: "In Progress", toState: "Resolved", eventType: "ObligationResolved" },
  { description: "Verify", fromState: "Resolved", toState: "Verified", eventType: "ObligationVerified" },
  { description: "Close", fromState: "Verified", toState: "Closed", eventType: "ObligationClosed" },
  { description: "Archive", fromState: "Closed", toState: "Archived", eventType: "ObligationArchived" },
];

const REOPEN_HOPS: Hop[] = [
  { description: "Reopen", fromState: "Closed", toState: "Reopened", eventType: "ObligationReopened" },
  { description: "Resume after reopen", fromState: "Reopened", toState: "In Progress", eventType: "ObligationProcessing" },
];

const ESCALATE_FROM = ["Identified", "Analysed", "Assigned", "In Progress", "Resolved", "Verified"];
const ESCALATE_HOPS: Hop[] = ESCALATE_FROM.map((fromState) => ({ description: `Escalate from ${fromState}`, fromState, toState: "Escalated", eventType: "ObligationEscalated" }));

const ALL_HOPS = [...MAIN_CHAIN, ...REOPEN_HOPS, ...ESCALATE_HOPS];

test("DEFINITION: every Obligation transition_definitions row matches Events and Lifecycles.md — event_type per hop, version_event always VersionCreated, exactly 15 rows", async () => {
  for (const hop of ALL_HOPS) {
    const { data: def } = await transitionDefinitionsDB.find("Obligation", hop.fromState, hop.toState);
    assert.ok(def, `no transition_definitions row for Obligation ${hop.fromState} -> ${hop.toState} (${hop.description})`);
    assert.equal(def!.event_type, hop.eventType, `${hop.description}: event_type`);
    assert.equal(def!.version_event, "VersionCreated", `${hop.description}: version_event`);
  }

  const { rows } = await pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM transition_definitions WHERE entity_type = 'Obligation'");
  assert.equal(Number(rows[0].count), ALL_HOPS.length, "unexpected extra/missing Obligation transition_definitions rows");

  // Closure requires verification — no shortcut into Closed.
  for (const shortcutFrom of ["Identified", "Analysed", "Assigned", "In Progress", "Resolved"]) {
    const { data: def } = await transitionDefinitionsDB.find("Obligation", shortcutFrom, "Closed");
    assert.equal(def ?? null, null, `${shortcutFrom} -> Closed must not exist (closure requires verification)`);
  }
});

let seuId: string;

async function freshObligation(title: string) {
  return createObligation({ relatedObjectType: "SEU", relatedObjectId: seuId, category: "Engineering", title: `${title} ${randomUUID()}`, severity: "Medium" });
}

async function driveTo(obligationId: string, states: string[]) {
  for (const targetState of states) {
    const result = await transitionObligation({ obligationId, targetState, actorRole: "super", actorId: "1001" });
    assert.equal(result.ok, true, !result.ok ? `-> ${targetState} failed: ${JSON.stringify(result)}` : undefined);
  }
}

async function eventTypesFor(obligationId: string): Promise<string[]> {
  const { data: events } = await eventsDB.findByOriginatingObject("Obligation", obligationId);
  return (events ?? []).map((e) => e.event_type);
}

test("DRIVEN setup: a real SEU to hang Obligations off", async () => {
  const result = await commissionFromFormSync({
    statement: `obligation-lifecycle-table-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture-design", "software-construction"],
    actorRole: "super",
    actorId: "1001",
    requestedBy: 1001,
  });
  assert.equal(result.ok, true, result.ok ? undefined : `${result.stage}: ${result.reason}`);
  if (!result.ok) return;
  seuId = result.seu.id;
  await resolveDispatchRejectionObligations(seuId);
});

test("DRIVEN: every main-chain hop publishes its own named event AND the generic ObligationTransitioned", async () => {
  const obligation = await freshObligation("main chain");
  await driveTo(obligation.id, MAIN_CHAIN.map((h) => h.toState));

  const { data: events } = await eventsDB.findByOriginatingObject("Obligation", obligation.id);
  const types = (events ?? []).map((e) => e.event_type);
  assert.ok(types.includes("ObligationCreated"));
  for (const hop of MAIN_CHAIN) {
    assert.ok(types.includes(hop.eventType), `expected ${hop.eventType} for ${hop.description}, got: ${types.join(", ")}`);
  }
  assert.equal(types.filter((t) => t === "ObligationTransitioned").length, MAIN_CHAIN.length, "ObligationTransitioned must fire once per hop");

  // Named event and generic event share one correlation id and carry the same payload/actor/badge.
  const closed = (events ?? []).find((e) => e.event_type === "ObligationClosed")!;
  const genericForClose = (events ?? []).find((e) => e.event_type === "ObligationTransitioned" && (e.payload as { toState?: string }).toState === "Closed")!;
  assert.equal(closed.correlation_id, genericForClose.correlation_id);
  assert.deepEqual(closed.payload, genericForClose.payload);
  assert.equal(closed.actor_id, "1001");
});

test("DRIVEN: Closed -> Reopened -> In Progress works and publishes ObligationReopened; a Reopened Obligation is not Verified/Closed/Archived", async () => {
  const obligation = await freshObligation("reopen");
  await driveTo(obligation.id, ["Analysed", "Assigned", "In Progress", "Resolved", "Verified", "Closed", "Reopened"]);
  let types = await eventTypesFor(obligation.id);
  assert.ok(types.includes("ObligationReopened"));
  const { data: reopened } = await obligationsDB.findById(obligation.id);
  assert.equal(reopened!.status, "Reopened");

  await driveTo(obligation.id, ["In Progress"]);
  const { data: resumed } = await obligationsDB.findById(obligation.id);
  assert.equal(resumed!.status, "In Progress");
  types = await eventTypesFor(obligation.id);
  assert.equal(types.filter((t) => t === "ObligationProcessing").length, 2, "Assigned->In Progress and Reopened->In Progress both publish ObligationProcessing");
});

test("DRIVEN: Escalate is reachable from every pre-Closed state and publishes ObligationEscalated; not from Closed", async () => {
  for (const fromState of ESCALATE_FROM) {
    const obligation = await freshObligation(`escalate-${fromState}`);
    const path = MAIN_CHAIN.map((h) => h.toState);
    const idx = fromState === "Identified" ? -1 : path.indexOf(fromState);
    await driveTo(obligation.id, path.slice(0, idx + 1));
    await driveTo(obligation.id, ["Escalated"]);
    assert.ok((await eventTypesFor(obligation.id)).includes("ObligationEscalated"), `ObligationEscalated missing from ${fromState}`);
  }

  const closed = await freshObligation("no escalate from closed");
  await driveTo(closed.id, ["Analysed", "Assigned", "In Progress", "Resolved", "Verified", "Closed"]);
  const result = await transitionObligation({ obligationId: closed.id, targetState: "Escalated", actorRole: "super", actorId: "1001" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "no_transition_definition");
});

test("DRIVEN: closure cannot skip verification", async () => {
  const obligation = await freshObligation("no skip");
  await driveTo(obligation.id, ["Analysed", "Assigned", "In Progress", "Resolved"]);
  const result = await transitionObligation({ obligationId: obligation.id, targetState: "Closed", actorRole: "super", actorId: "1001" });
  assert.equal(result.ok, false);
});

test("DRIVEN: reviseObligation appends only changed fields to revision_history, publishes no event, and moves neither status nor version", async () => {
  const obligation = await freshObligation("revision");
  await driveTo(obligation.id, ["Analysed"]);
  const { data: before } = await obligationsDB.findById(obligation.id);
  const eventsBefore = await eventTypesFor(obligation.id);

  const oldDescription = before!.description;
  const revised = await reviseObligation({ obligationId: obligation.id, actorId: "1001", description: "new description", severity: before!.severity });
  assert.equal(revised!.description, "new description");
  assert.equal(revised!.status, before!.status);
  assert.equal(revised!.version, before!.version, "a Revision must not bump the version-significant counter");
  assert.equal(revised!.revision_history.length, 1);
  const entry = revised!.revision_history[0] as { actor_id: string; changes: Record<string, { from: unknown; to: unknown }> };
  assert.equal(entry.actor_id, "1001");
  assert.deepEqual(Object.keys(entry.changes), ["description"], "severity was unchanged — must not appear");
  assert.deepEqual(entry.changes.description, { from: oldDescription, to: "new description" });

  // Second revision appends, never overwrites the first.
  const again = await reviseObligation({ obligationId: obligation.id, actorId: "1001", description: "third description" });
  assert.equal(again!.revision_history.length, 2);
  assert.deepEqual((again!.revision_history[1] as { changes: Record<string, unknown> }).changes.description, { from: "new description", to: "third description" });

  // No-op revision writes nothing.
  const noop = await reviseObligation({ obligationId: obligation.id, actorId: "1001", description: "third description" });
  assert.equal(noop!.revision_history.length, 2);

  assert.deepEqual(await eventTypesFor(obligation.id), eventsBefore, "a Revision publishes no event of any kind");
});
