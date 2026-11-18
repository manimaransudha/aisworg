// Quality Gate decision of a Deliverable hop (qualityGateEngine.decideQualityGate, recordDecision, and the Execution Engine that stores it).
//
//   - The gates are Quality Gate Definitions that a Pack of the SEU's Template lists. The composition settles them into the EBM (CR-139) and
//     qualityGateEngine.evaluate reads the EBM only. The test checks that the EBM names them.
//   - Each gate is on a hop of the Deliverable that carries the run tag, so no other gate can match it. Gates and Transition Definitions are
//     not deleted, except the edges, as in the other Quality Gate tests.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { SYSTEM_ACTOR_BADGE } from "../src/dblayer/constants.js";
import { deliverablesDB } from "../src/dblayer/deliverablesDB.js";
import { qualityGateOutcomesDB } from "../src/dblayer/qualityGateOutcomesDB.js";
import { qualityGateWaiversDB } from "../src/dblayer/qualityGateWaiversDB.js";
import { transitionDefinitionsDB, reloadIfLoaded } from "../src/dblayer/transitionDefinitionsDB.js";
import { executionEngine } from "../src/domain/engine/executionEngine.js";
import { qualityGateEngine } from "../src/domain/engine/qualityGateEngine.js";
import type { QualityGateDefinitionRow } from "../src/dblayer/seuTypes.js";
import { commissionedSeu, ebmGatesByCode, type CommissionedSeu } from "./webScenarios.js";
import { ROOT_ACTOR_ID, ROOT_ACTOR_BADGE, ensureQualityGateDefinition, decideGates } from "./testFixtures.js";

const run = randomUUID().slice(0, 8);
const state = (label: string) => `zz-${label}-${run}`;
const edges: Array<[string, string]> = [];
let t: CommissionedSeu;
let verb: string;
let birthState: string;
// The hop with two gates: one that blocks and one that passes.
const mixed = { from: state("mixed-open"), to: state("mixed-done") };
// The hop with one gate that passes.
const clean = { from: state("clean-open"), to: state("clean-done") };
// The hop with no gate.
const bare = { from: state("bare-open"), to: state("bare-done") };
const gates: Record<"blocking" | "passingMixed" | "passingClean", QualityGateDefinitionRow> = {} as never;

// A Quality Gate Definition on one hop of the Deliverable. The Pack lists it and the EBM takes it when the SEU is commissioned.
// A gate that names no Deliverable applies to the Deliverables of the catalogue, so the gates name the code of the Deliverables the test creates.
const gateDeliverableCode = "source-code";

function gateEntry(label: string, hop: { from: string; to: string }, criteriaType: string) {
  return ensureQualityGateDefinition({
    code: `quality-gate-outcome-${label}-${run}`, name: `quality-gate-outcome ${label} ${run}`, category: "Exit", governedTransition: `Deliverable|${hop.from}|${hop.to}`, criteriaType, deliverableName: gateDeliverableCode,
    ...(criteriaType === "requires_accepted_evidence_or_approved_decision" ? { evidenceCategory: "Validation Evidence" } : {}),
  });
}

async function addEdge(hop: { from: string; to: string }): Promise<void> {
  const { error } = await transitionDefinitionsDB.upsert({ entityType: "Deliverable", fromState: hop.from, toState: hop.to, verb });
  assert.ok(!error, error);
  edges.push([hop.from, hop.to]);
}

async function createDeliverable(lifecycle: string) {
  const { data, error } = await deliverablesDB.create({
    seuId: t.seu.id, code: gateDeliverableCode, name: `quality-gate-outcome ${run} ${randomUUID()}`, state: lifecycle, authorId: t.systemParticipantId, authorBadge: ROOT_ACTOR_BADGE,
  });
  assert.ok(data && !error, error);
  return data;
}

before(async () => {
  const { data: birth } = await transitionDefinitionsDB.findBirth("Deliverable");
  assert.ok(birth, "the Deliverable has a birth row");
  birthState = birth.to_state;
  const verbRows = await pool.query<{ verb: string }>("SELECT verb FROM transition_definitions WHERE entity_type = 'Deliverable' AND verb IS NOT NULL LIMIT 1");
  assert.ok(verbRows.rows[0], "a seeded Deliverable edge names a verb");
  verb = verbRows.rows[0].verb;

  // The Pack validation refuses a gate on a transition that does not exist, so the edges come first.
  for (const hop of [mixed, clean, bare]) await addEdge(hop);
  const entries = {
    blocking: await gateEntry("blocking", mixed, "requires_accepted_evidence_or_approved_decision"),
    passingMixed: await gateEntry("passing-mixed", mixed, "no_unresolved_obligations"),
    passingClean: await gateEntry("passing-clean", clean, "no_unresolved_obligations"),
  };
  t = await commissionedSeu("quality-gate-outcome", "clean", { conflictSet: "gate-outcome", gates: Object.values(entries) });
  assert.ok(t.seu.active_ebm_id, "the SEU has an active EBM");
  const named = await ebmGatesByCode(t.seu);
  for (const [key, entry] of Object.entries(entries)) {
    const row = named[entry.qualityCode];
    assert.ok(row, `the EBM names gate ${entry.qualityCode}`);
    gates[key as keyof typeof gates] = row;
  }
});

after(async () => {
  for (const [from, to] of edges) await pool.query("DELETE FROM transition_definitions WHERE entity_type = 'Deliverable' AND from_state = $1 AND to_state = $2", [from, to]);
  await reloadIfLoaded();
});

const gateInput = (deliverableId: string, hop: { from: string; to: string }) => ({
  entityType: "Deliverable" as const, entityId: deliverableId, seuId: t.seu.id, fromState: hop.from, toState: hop.to,
  authorId: t.systemParticipantId, authorBadge: ROOT_ACTOR_BADGE, tenantId: t.seu.tenant_id,
});

test("every gate of the hop is evaluated and stored, and a Blocked gate does not stop the others", async () => {
  const deliverable = await createDeliverable(mixed.from);
  const results = await qualityGateEngine.evaluate(gateInput(deliverable.id, mixed));
  assert.deepEqual(results.map((r) => r.gate.id).sort(), [gates.blocking.id, gates.passingMixed.id].sort(), "both gates are evaluated, whichever comes first");
  assert.deepEqual(results.map((r) => r.outcome).sort(), ["Blocked", "Passed"]);

  const decision = await qualityGateEngine.decideQualityGate(results, [], { entityType: "Deliverable", entityId: deliverable.id, seuId: t.seu.id });
  assert.equal(decision.outcome, "Blocked");
  assert.deepEqual(decision.blocked.map((r) => r.gate.id), [gates.blocking.id]);
  assert.deepEqual(decision.waived, []);
  assert.equal(decision.confidenceLevel, 100);
  assert.deepEqual(decision.evaluationIds.slice().sort(), results.map((r) => r.evaluationId).sort());

  const stored = await pool.query<{ id: string; quality_gate_id: string; outcome: string }>("SELECT id, quality_gate_id, outcome FROM quality_gate_evaluations WHERE id = ANY($1::uuid[])", [decision.evaluationIds]);
  assert.equal(stored.rows.length, 2, "each gate has its own evaluation row");
  assert.deepEqual(stored.rows.map((r) => [r.quality_gate_id, r.outcome]).sort(), [[gates.blocking.id, "Blocked"], [gates.passingMixed.id, "Passed"]].sort());
});

test("the Execution Engine stores the decision of a Blocked hop, with the id of every gate evaluation", async () => {
  const deliverable = await createDeliverable(mixed.from);
  const result = await executionEngine.evaluateDeliverableTransition({ deliverable, targetState: mixed.to, actorId: ROOT_ACTOR_ID });
  assert.ok(!result.ok && result.reason === "quality_gate_blocked", JSON.stringify(result));

  const { data: rows } = await qualityGateOutcomesDB.findByDeliverableId(deliverable.id);
  assert.equal(rows?.length, 1, "the Blocked hop is stored");
  const [row] = rows!;
  assert.deepEqual([row.outcome, Number(row.confidence_level), row.seu_id, row.deliverable_id, row.tenant_id, row.actor_id, row.actor_badge],
    ["Blocked", 100, t.seu.id, deliverable.id, t.seu.tenant_id, t.systemParticipantId, SYSTEM_ACTOR_BADGE]);
  assert.match(row.rationale, /^Blocked by rule any-gate-blocked: (\d+ Passed, 1 Blocked|1 Blocked, \d+ Passed); confidence 100%$/);
  const evaluations = await pool.query<{ quality_gate_id: string }>("SELECT quality_gate_id FROM quality_gate_evaluations WHERE id = ANY($1::uuid[])", [row.evaluation_ids]);
  assert.deepEqual(evaluations.rows.map((r) => r.quality_gate_id).sort(), [gates.blocking.id, gates.passingMixed.id].sort(), "evaluation_ids names the evaluation of each gate");
});

test("the Execution Engine stores an Approved decision, a Waived decision and an Approved decision of a hop with no Quality Gate", async () => {
  const approved = await createDeliverable(clean.from);
  const approvedResult = await executionEngine.evaluateDeliverableTransition({ deliverable: approved, targetState: clean.to, actorId: ROOT_ACTOR_ID });
  assert.equal(approvedResult.ok, true, JSON.stringify(approvedResult));
  const { data: approvedRows } = await qualityGateOutcomesDB.findByDeliverableId(approved.id);
  assert.deepEqual([approvedRows?.length, approvedRows?.[0].outcome, approvedRows?.[0].evaluation_ids.length], [1, "Approved", 1]);

  const waived = await createDeliverable(mixed.from);
  const { error } = await qualityGateWaiversDB.grant({
    qualityGateId: gates.blocking.id, seuId: t.seu.id, entityType: "Deliverable", entityId: waived.id, rationale: "quality-gate-outcome test", grantedBy: ROOT_ACTOR_ID, authorityBadge: ROOT_ACTOR_BADGE,
  });
  assert.ok(!error, error);
  const waivedResult = await executionEngine.evaluateDeliverableTransition({ deliverable: waived, targetState: mixed.to, actorId: ROOT_ACTOR_ID });
  assert.equal(waivedResult.ok, true, JSON.stringify(waivedResult));
  const { data: waivedRows } = await qualityGateOutcomesDB.findByDeliverableId(waived.id);
  assert.deepEqual([waivedRows?.length, waivedRows?.[0].outcome, waivedRows?.[0].evaluation_ids.length], [1, "Waived", 2]);

  const none = await createDeliverable(bare.from);
  const noneResult = await executionEngine.evaluateDeliverableTransition({ deliverable: none, targetState: bare.to, actorId: ROOT_ACTOR_ID });
  assert.equal(noneResult.ok, true, JSON.stringify(noneResult));
  const { data: noneRows } = await qualityGateOutcomesDB.findByDeliverableId(none.id);
  assert.deepEqual([noneRows?.length, noneRows?.[0].outcome, noneRows?.[0].evaluation_ids], [1, "Approved", []]);
});

test("a failed insert of a gate evaluation is an error, and a decision outside its Ontology concept is refused", async () => {
  const deliverable = await createDeliverable(clean.from);
  await assert.rejects(
    () => qualityGateEngine.recordAndPass({ id: gates.passingClean.id, code: gates.passingClean.code, name: gates.passingClean.name, category: gates.passingClean.category, criteria: { type: gates.passingClean.criteria_type }, originating_pack_id: null }, { seuId: t.seu.id, entityType: "Deliverable", entityId: deliverable.id, authorId: randomUUID(), authorBadge: ROOT_ACTOR_BADGE, tenantId: t.seu.tenant_id }, {}),
    /participants|foreign key|violates/i,
    "an author that is not a Participant fails the insert, and the engine does not report a pass"
  );

  const decision = (await decideGates(gateInput(deliverable.id, clean)));
  await assert.rejects(
    () => qualityGateEngine.recordDecision({ ...decision, outcome: `zz-unknown-${run}` as never }, { seuId: t.seu.id, deliverableId: deliverable.id, tenantId: t.seu.tenant_id, actorId: t.systemParticipantId, actorBadge: ROOT_ACTOR_BADGE }),
    /is not a quality-gate-decision-outcome concept/
  );
  const { data: rows } = await qualityGateOutcomesDB.findByDeliverableId(deliverable.id);
  assert.equal(rows?.length, 0, "the refused decision is not stored");
});
