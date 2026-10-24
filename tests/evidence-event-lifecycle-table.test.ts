// CR-128 Entity 13: the Evidence birth row and the governed hops.
//
//   - DEFINITION: the birth row None -> Collected (verb collect, trigger governed, event EvidenceCollected, no version
//     event) and the six hop rows; Collected -> Validated is the only row with VersionCreated.
//   - DRIVEN: createEvidence writes the birth state and publishes the birth event, EvidenceSuperseded follows it when a
//     predecessor is given; every hop publishes the row's event and then EvidenceTransitioned with one correlation id;
//     Collected -> Validated writes a version event with the SEU's tenant; a refused hop writes and publishes nothing;
//     an actor with no participant row in the SEU is refused.
//   - GUARD: only the Evidence adapter writes the status and no code names the birth event as a literal.
import "dotenv/config";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import pool from "../src/utils/db.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { evidenceDB } from "../src/dblayer/evidenceDB.js";
import { transitionEvidence } from "../src/routes/seu/core/evidence.js";
import { nextActionsFor } from "../src/domain/engine/entityTransition.js";
import { createEvidenceAsRoot as createEvidence, commissionFromFormSync, ensureEventSubscriptionsLoaded, resolveDispatchRejectionObligations, TESTER_ALL_ID, TESTER_ACCEPTANCE_JOURNEY } from "./testFixtures.js";

before(async () => {
  await ensureEventSubscriptionsLoaded();
});

const HOPS = [
  { fromState: "Collected", toState: "Validated", eventType: "EvidenceValidated", versionEvent: "VersionCreated" },
  { fromState: "Validated", toState: "Accepted", eventType: "EvidenceAccepted", versionEvent: null },
  { fromState: "Accepted", toState: "Referenced", eventType: "EvidenceReferenced", versionEvent: null },
  { fromState: "Referenced", toState: "Archived", eventType: "EvidenceArchived", versionEvent: null },
  { fromState: "Collected", toState: "Rejected", eventType: "EvidenceRejected", versionEvent: null },
  { fromState: "Validated", toState: "Rejected", eventType: "EvidenceRejected", versionEvent: null },
];

test("DEFINITION: the birth row and the six hop rows", async () => {
  const { data: birth } = await transitionDefinitionsDB.findBirth("Evidence");
  assert.ok(birth, "the Evidence birth row exists");
  assert.equal(birth!.to_state, "Collected");
  assert.equal(birth!.verb, "collect");
  assert.equal(birth!.trigger, "governed");
  assert.equal(birth!.event_type, "EvidenceCollected");
  assert.equal(birth!.version_event, null);

  for (const hop of HOPS) {
    const { data: def } = await transitionDefinitionsDB.find("Evidence", hop.fromState, hop.toState);
    assert.ok(def, `no row for Evidence ${hop.fromState} -> ${hop.toState}`);
    assert.equal(def!.event_type, hop.eventType, `${hop.fromState} -> ${hop.toState}: event_type`);
    assert.equal(def!.version_event, hop.versionEvent, `${hop.fromState} -> ${hop.toState}: version_event`);
  }
  const { rows } = await pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM transition_definitions WHERE entity_type = 'Evidence'");
  assert.equal(Number(rows[0].count), HOPS.length + 1, "unexpected extra/missing Evidence rows (the hops plus the birth row)");
});

let seuId: string;
let deliverableId: string;

async function freshEvidence(title: string, supersedesEvidenceId?: string) {
  return createEvidence({ seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverableId, category: "Validation Evidence", title: `${title} ${randomUUID()}`, supersedesEvidenceId });
}

async function eventTypesFor(evidenceId: string): Promise<string[]> {
  const { data: events } = await eventsDB.findByOriginatingObject("Evidence", evidenceId);
  return (events ?? []).map((e) => e.event_type);
}

test("DRIVEN setup: a real SEU and Deliverable to hang Evidence off", async () => {
  const result = await commissionFromFormSync({
    statement: `evidence-lifecycle-table-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture-design", "software-construction"],
    actorId: TESTER_ALL_ID,
    requestedBy: TESTER_ALL_ID,
  });
  assert.equal(result.ok, true, result.ok ? "" : `${result.stage}: ${result.reason}`);
  if (!result.ok) return;
  seuId = result.seu.id;
  await resolveDispatchRejectionObligations(seuId);
  const { rows } = await pool.query<{ id: string }>("SELECT id FROM deliverables WHERE seu_id = $1 LIMIT 1", [seuId]);
  deliverableId = rows[0].id;
});

test("DRIVEN: createEvidence writes the birth state and publishes the birth event; a predecessor adds EvidenceSuperseded last; a governed birth row offers no button", async () => {
  const first = await freshEvidence("birth");
  assert.equal(first.status, "Collected");
  assert.deepEqual(await eventTypesFor(first.id), ["EvidenceCollected"]);

  const second = await freshEvidence("superseding", first.id);
  const types = await eventTypesFor(second.id);
  assert.deepEqual(types, ["EvidenceCollected", "EvidenceSuperseded"]);

  const actions = await nextActionsFor("Evidence", "Collected", TESTER_ALL_ID);
  assert.deepEqual(actions.map((a) => a.verb).sort(), ["reject", "validate"]);
});

test("DRIVEN: every hop publishes the row's event and then EvidenceTransitioned with one correlation id; Collected -> Validated writes a version event with the SEU's tenant", async () => {
  const evidence = await freshEvidence("main chain");
  for (const targetState of ["Validated", "Accepted", "Referenced", "Archived"]) {
    const result = await transitionEvidence({ evidenceId: evidence.id, targetState, actorId: TESTER_ALL_ID });
    assert.equal(result.ok, true, !result.ok ? `-> ${targetState} failed: ${JSON.stringify(result)}` : "assertion failed");
  }
  const { data: events } = await eventsDB.findByOriginatingObject("Evidence", evidence.id);
  const types = (events ?? []).map((e) => e.event_type);
  for (const t of ["EvidenceValidated", "EvidenceAccepted", "EvidenceReferenced", "EvidenceArchived"]) assert.ok(types.includes(t), `missing ${t}`);
  assert.equal(types.filter((t) => t === "EvidenceTransitioned").length, 4, "EvidenceTransitioned fires once per hop");

  const accepted = (events ?? []).find((e) => e.event_type === "EvidenceAccepted")!;
  const genericForAccept = (events ?? []).find((e) => e.event_type === "EvidenceTransitioned" && (e.payload as { toState?: string }).toState === "Accepted")!;
  assert.equal(accepted.correlation_id, genericForAccept.correlation_id);
  assert.deepEqual(accepted.payload, genericForAccept.payload);

  const { rows } = await pool.query<{ tenant_id: string }>("SELECT tenant_id FROM version_events WHERE entity_type = 'Evidence' AND entity_id = $1", [evidence.id]);
  assert.equal(rows.length, 1, "Collected -> Validated is the only hop with a version event");
  const { rows: seuRows } = await pool.query<{ tenant_id: string }>("SELECT tenant_id FROM seus WHERE id = $1", [seuId]);
  assert.equal(rows[0].tenant_id, seuRows[0].tenant_id);
});

test("DRIVEN: a hop with no Transition Definition is refused and writes and publishes nothing", async () => {
  const evidence = await freshEvidence("refused hop");
  const before = await eventTypesFor(evidence.id);
  const result = await transitionEvidence({ evidenceId: evidence.id, targetState: "Archived", actorId: TESTER_ALL_ID });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "no_transition_definition");
  assert.deepEqual(await eventTypesFor(evidence.id), before);
  const { data: after } = await evidenceDB.findById(evidence.id);
  assert.equal(after!.status, "Collected");
});

test("DRIVEN: a hop by an actor with no participant row in the SEU is refused and writes nothing", async () => {
  const evidence = await freshEvidence("no participant");
  // Holds every badge and has no participants row in this SEU, so only the SEU participant check can refuse it.
  await assert.rejects(
    transitionEvidence({ evidenceId: evidence.id, targetState: "Validated", actorId: TESTER_ACCEPTANCE_JOURNEY.participantId }),
    /No participants row/
  );
  const { data: after } = await evidenceDB.findById(evidence.id);
  assert.equal(after!.status, "Collected");
});

test("GUARD: only the Evidence adapter writes the status and no code names the birth event as a literal", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".ts")) files.push(path);
    }
  };
  walk(join(process.cwd(), "src"));
  const statusWriters = files.filter((f) => /evidenceDB\.updateStatus\(/.test(readFileSync(f, "utf8")));
  assert.deepEqual(statusWriters.map((f) => f.slice(process.cwd().length + 1)), ["src/domain/engine/entityAdapters.ts"]);
  const birthLiterals = files.filter((f) => /["']EvidenceCollected["']/.test(readFileSync(f, "utf8")));
  assert.deepEqual(birthLiterals, []);
});
