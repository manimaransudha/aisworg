// CR-131: the Decision birth row, the governed hops and the supersession pointer.
//
//   - DEFINITION: the birth row None -> Identified (verb identify, trigger governed, event DecisionIdentified, no version
//     event), the seven hop rows with their events and version events, and the action on Applied -> Superseded.
//   - DRIVEN: createDecision writes the birth state, publishes the birth event last, and refuses a Decision that names
//     neither Evidence nor Knowledge; an SEU group is saved in related_objects; every hop publishes the row's event and
//     then DecisionTransitioned with one correlation id, and a hop with a version event writes a version_events row with
//     the SEU's tenant; a refused hop writes and publishes nothing; an actor with no participant row in the SEU is
//     refused; Supersede needs a replacing Decision and a comment and sets superseded_by.
//   - BUTTONS: nextActionsFor offers the manual verbs and nothing for the birth row.
//   - GUARD: only the Decision adapter writes the status and no code names the birth event as a literal.
import "dotenv/config";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import pool from "../src/utils/db.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { decisionsDB } from "../src/dblayer/decisionsDB.js";
import { createDecision, transitionDecision } from "../src/routes/seu/core/decisions.js";
import { nextActionsFor } from "../src/domain/engine/entityTransition.js";
import { createEvidenceAsRoot as createEvidence, commissionFromFormSync, ensureActorParticipant, ensureEventSubscriptionsLoaded, resolveDispatchRejectionObligations, ROOT_ACTOR_ID, TESTER_ALL_ID, TESTER_ACCEPTANCE_JOURNEY } from "./testFixtures.js";

before(async () => {
  await ensureEventSubscriptionsLoaded();
});

const HOPS = [
  { fromState: "Identified", toState: "Analysed", eventType: "DecisionAnalysed", versionEvent: null },
  { fromState: "Analysed", toState: "Proposed", eventType: "DecisionProposed", versionEvent: "VersionCreated" },
  { fromState: "Proposed", toState: "Reviewed", eventType: "DecisionReviewed", versionEvent: "VersionValidated" },
  { fromState: "Reviewed", toState: "Approved", eventType: "DecisionApproved", versionEvent: "VersionPublished" },
  { fromState: "Approved", toState: "Applied", eventType: "DecisionApplied", versionEvent: "VersionActivated" },
  { fromState: "Applied", toState: "Superseded", eventType: "DecisionSuperseded", versionEvent: "VersionSuperseded" },
  { fromState: "Superseded", toState: "Archived", eventType: "DecisionArchived", versionEvent: "VersionArchived" },
];

test("DEFINITION: the birth row, the seven hop rows and the supersede action", async () => {
  const { data: birth } = await transitionDefinitionsDB.findBirth("Decision");
  assert.ok(birth, "the Decision birth row exists");
  assert.equal(birth!.to_state, "Identified");
  assert.equal(birth!.verb, "identify");
  assert.equal(birth!.trigger, "governed");
  assert.equal(birth!.event_type, "DecisionIdentified");
  assert.equal(birth!.version_event, null);

  for (const hop of HOPS) {
    const { data: def } = await transitionDefinitionsDB.find("Decision", hop.fromState, hop.toState);
    assert.ok(def, `no row for Decision ${hop.fromState} -> ${hop.toState}`);
    assert.equal(def!.event_type, hop.eventType, `${hop.fromState} -> ${hop.toState}: event_type`);
    assert.equal(def!.version_event, hop.versionEvent, `${hop.fromState} -> ${hop.toState}: version_event`);
    assert.equal(def!.action_code, hop.toState === "Superseded" ? "supersede-decision" : null, `${hop.fromState} -> ${hop.toState}: action_code`);
  }
  const { rows } = await pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM transition_definitions WHERE entity_type = 'Decision' AND to_state NOT LIKE 'qg-%'");
  assert.equal(Number(rows[0].count), HOPS.length + 1, "unexpected extra/missing Decision rows (the hops plus the birth row)");
});

let seuId: string;
let deliverableId: string;

async function freshEvidenceId(): Promise<string> {
  const evidence = await createEvidence({ seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverableId, category: "Analytical Evidence", title: `decision support ${randomUUID()}` });
  return evidence.id;
}

async function freshDecision(title: string, extra: Partial<Parameters<typeof createDecision>[0]> = {}) {
  return createDecision({
    actorId: ROOT_ACTOR_ID,
    seuId,
    evidenceIds: [await freshEvidenceId()],
    relatedObjects: [{ related_object_type: "Deliverable", related_object_ids: [deliverableId] }],
    category: "Engineering Decisions",
    title: `${title} ${randomUUID()}`,
    ...extra,
  });
}

async function eventTypesFor(decisionId: string): Promise<string[]> {
  const { data: events } = await eventsDB.findByOriginatingObject("Decision", decisionId);
  return (events ?? []).map((e) => e.event_type);
}

test("DRIVEN setup: a real SEU and Deliverable to hang Decisions off", async () => {
  const result = await commissionFromFormSync({
    statement: `decision-lifecycle-table-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture-design", "software-construction"],
    actorId: TESTER_ALL_ID,
    requestedBy: TESTER_ALL_ID,
  });
  assert.equal(result.ok, true, result.ok ? "" : `${result.stage}: ${result.reason}`);
  if (!result.ok) return;
  seuId = result.seu.id;
  await resolveDispatchRejectionObligations(seuId);
  await ensureActorParticipant(seuId, ROOT_ACTOR_ID);
  const { rows } = await pool.query<{ id: string }>("SELECT id FROM deliverables WHERE seu_id = $1 LIMIT 1", [seuId]);
  deliverableId = rows[0].id;
});

test("DRIVEN: createDecision writes the birth state and publishes the birth event; a governed birth row offers no button", async () => {
  const decision = await freshDecision("birth");
  assert.equal(decision.status, "Identified");
  assert.equal(decision.superseded_by, null);
  assert.deepEqual(await eventTypesFor(decision.id), ["DecisionIdentified"]);

  const actions = await nextActionsFor("Decision", "Identified", TESTER_ALL_ID);
  assert.deepEqual(actions.map((a) => a.verb), ["analyse"]);
});

test("DRIVEN: a Decision needs Evidence or Knowledge on save: neither is refused, either one or both is accepted", async () => {
  const base = { actorId: ROOT_ACTOR_ID, seuId, relatedObjects: [{ related_object_type: "Deliverable", related_object_ids: [deliverableId] }], category: "Engineering Decisions", title: `support rule ${randomUUID()}` };
  await assert.rejects(createDecision({ ...base }), /at least one Evidence item or Knowledge item/);
  await assert.rejects(createDecision({ ...base, evidenceIds: [], knowledgeIds: [] }), /at least one Evidence item or Knowledge item/);
  const withEvidence = await createDecision({ ...base, evidenceIds: [await freshEvidenceId()] });
  assert.equal(withEvidence.status, "Identified");
  const { rows } = await pool.query<{ id: string }>("SELECT id FROM knowledge_items WHERE seu_id = $1 LIMIT 1", [seuId]);
  if (rows[0]) {
    const withKnowledge = await createDecision({ ...base, title: `support rule k ${randomUUID()}`, knowledgeIds: [rows[0].id] });
    assert.equal(withKnowledge.status, "Identified");
  }
});

test("DRIVEN: an SEU group in relatedObjects is saved with the Decision", async () => {
  const otherSeuId = randomUUID();
  const decision = await freshDecision("seu reference", {
    relatedObjects: [
      { related_object_type: "Deliverable", related_object_ids: [deliverableId] },
      { related_object_type: "SEU", related_object_ids: [otherSeuId] },
    ],
  });
  const { data: stored } = await decisionsDB.findById(decision.id);
  assert.ok(stored!.related_objects.some((g) => g.related_object_type === "SEU" && g.related_object_ids.includes(otherSeuId)));
  assert.equal(stored!.seu_id, seuId);
});

test("DRIVEN: every hop publishes the row's event and then DecisionTransitioned with one correlation id, and the versioned hops write version events with the SEU's tenant", async () => {
  const decision = await freshDecision("main chain");
  const replacement = await freshDecision("replacement");
  for (const targetState of ["Analysed", "Proposed", "Reviewed", "Approved", "Applied"]) {
    const result = await transitionDecision({ decisionId: decision.id, targetState, actorId: TESTER_ALL_ID });
    assert.equal(result.ok, true, !result.ok ? `-> ${targetState} failed: ${JSON.stringify(result)}` : "assertion failed");
  }
  const superseded = await transitionDecision({ decisionId: decision.id, targetState: "Superseded", actorId: TESTER_ALL_ID, context: { supersedingDecisionId: replacement.id, comment: "replaced" } });
  assert.equal(superseded.ok, true, !superseded.ok ? JSON.stringify(superseded) : "assertion failed");
  const archived = await transitionDecision({ decisionId: decision.id, targetState: "Archived", actorId: TESTER_ALL_ID });
  assert.equal(archived.ok, true);

  const { data: events } = await eventsDB.findByOriginatingObject("Decision", decision.id);
  const types = (events ?? []).map((e) => e.event_type);
  for (const t of HOPS.map((h) => h.eventType)) assert.ok(types.includes(t), `missing ${t}`);
  assert.equal(types.filter((t) => t === "DecisionTransitioned").length, HOPS.length, "DecisionTransitioned fires once per hop");

  const approved = (events ?? []).find((e) => e.event_type === "DecisionApproved")!;
  const genericForApprove = (events ?? []).find((e) => e.event_type === "DecisionTransitioned" && (e.payload as { toState?: string }).toState === "Approved")!;
  assert.equal(approved.correlation_id, genericForApprove.correlation_id);
  assert.deepEqual(approved.payload, genericForApprove.payload);

  const { rows } = await pool.query<{ tenant_id: string }>("SELECT tenant_id FROM version_events WHERE entity_type = 'Decision' AND entity_id = $1", [decision.id]);
  assert.equal(rows.length, HOPS.filter((h) => h.versionEvent).length, "one version event per versioned hop");
  const { rows: seuRows } = await pool.query<{ tenant_id: string }>("SELECT tenant_id FROM seus WHERE id = $1", [seuId]);
  for (const r of rows) assert.equal(r.tenant_id, seuRows[0].tenant_id);
});

test("DRIVEN: Supersede needs a replacing Decision and a comment, and sets superseded_by", async () => {
  const decision = await freshDecision("supersede");
  const replacement = await freshDecision("supersede by");
  for (const targetState of ["Analysed", "Proposed", "Reviewed", "Approved", "Applied"]) {
    const result = await transitionDecision({ decisionId: decision.id, targetState, actorId: TESTER_ALL_ID });
    assert.equal(result.ok, true, !result.ok ? JSON.stringify(result) : "assertion failed");
  }
  const stillApplied = async () => assert.equal((await decisionsDB.findById(decision.id)).data!.status, "Applied");

  await assert.rejects(transitionDecision({ decisionId: decision.id, targetState: "Superseded", actorId: TESTER_ALL_ID, context: { comment: "replaced" } }), /superseding entity's id/);
  await stillApplied();
  await assert.rejects(transitionDecision({ decisionId: decision.id, targetState: "Superseded", actorId: TESTER_ALL_ID, context: { supersedingDecisionId: replacement.id } }), /comment/);
  await stillApplied();
  await assert.rejects(transitionDecision({ decisionId: decision.id, targetState: "Superseded", actorId: TESTER_ALL_ID, context: { supersedingDecisionId: decision.id, comment: "self" } }), /cannot supersede itself/);
  await stillApplied();

  const result = await transitionDecision({ decisionId: decision.id, targetState: "Superseded", actorId: TESTER_ALL_ID, context: { supersedingDecisionId: replacement.id, comment: "replaced" } });
  assert.equal(result.ok, true, !result.ok ? JSON.stringify(result) : "assertion failed");
  const { data: after } = await decisionsDB.findById(decision.id);
  assert.equal(after!.status, "Superseded");
  assert.equal(after!.superseded_by, replacement.id);
});

test("DRIVEN: a hop with no Transition Definition is refused and writes and publishes nothing", async () => {
  const decision = await freshDecision("refused hop");
  const before = await eventTypesFor(decision.id);
  const result = await transitionDecision({ decisionId: decision.id, targetState: "Approved", actorId: TESTER_ALL_ID });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "no_transition_definition");
  assert.deepEqual(await eventTypesFor(decision.id), before);
  assert.equal((await decisionsDB.findById(decision.id)).data!.status, "Identified");
});

test("DRIVEN: a hop by an actor with no participant row in the SEU is refused and writes nothing", async () => {
  const decision = await freshDecision("no participant");
  // Holds every badge and has no participants row in this SEU, so only the SEU participant check can refuse it.
  await assert.rejects(
    transitionDecision({ decisionId: decision.id, targetState: "Analysed", actorId: TESTER_ACCEPTANCE_JOURNEY.participantId }),
    /No participants row/
  );
  assert.equal((await decisionsDB.findById(decision.id)).data!.status, "Identified");
});

test("BUTTONS: Reviewed offers approve only and Applied offers supersede", async () => {
  assert.deepEqual((await nextActionsFor("Decision", "Reviewed", TESTER_ALL_ID)).map((a) => a.verb), ["approve"]);
  const applied = await nextActionsFor("Decision", "Applied", TESTER_ALL_ID);
  assert.deepEqual(applied.map((a) => a.verb), ["supersede"]);
  assert.equal(applied[0].actionCode, "supersede-decision");
});

test("GUARD: only the Decision adapter writes the status and no code names the birth event as a literal", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".ts")) files.push(path);
    }
  };
  walk(join(process.cwd(), "src"));
  const statusWriters = files.filter((f) => /decisionsDB\.updateStatus\(/.test(readFileSync(f, "utf8")));
  assert.deepEqual(statusWriters.map((f) => f.slice(process.cwd().length + 1)), ["src/domain/engine/entityAdapters.ts"]);
  const birthLiterals = files.filter((f) => /["']DecisionIdentified["']/.test(readFileSync(f, "utf8")));
  assert.deepEqual(birthLiterals, []);
});
