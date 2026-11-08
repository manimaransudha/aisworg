// Execution Engine (src/domain/engine/executionEngine.ts) and the Work Item Generator (workItemGenerator.ts): the governance refusals a commissioned
// pipeline does not reach, the persistence of a governance outcome and an eligible-Participant pool with a Command, and the Quality Gate that a
// Work Item records.
//
//   - The Deliverables belong to a plain SEU row with no EBM, so no Policy applies. Governance is evaluated with the real functions.
//   - The edges with a submit verb or with no verb are written for a Deliverable state that carries the run tag, so no real Deliverable
//     transition is touched. The edges are deleted when the file ends.
//   - Rows are not deleted, as in the other tests that create SEUs.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { deliverablesDB } from "../src/dblayer/deliverablesDB.js";
import { commandsDB } from "../src/dblayer/commandsDB.js";
import { workItemsDB } from "../src/dblayer/workItemsDB.js";
import { qualityGatesDB } from "../src/dblayer/qualityGatesDB.js";
import { packsDB } from "../src/dblayer/packsDB.js";
import { capabilityFulfilmentPoolsDB } from "../src/dblayer/capabilityFulfilmentPoolsDB.js";
import { governanceEvaluationOutcomesDB } from "../src/dblayer/governanceEvaluationOutcomesDB.js";
import { transitionDefinitionsDB, reloadIfLoaded } from "../src/dblayer/transitionDefinitionsDB.js";
import { executionEngine, type DeliverableGovernanceResult } from "../src/domain/engine/executionEngine.js";
import { workItemGenerator } from "../src/domain/engine/workItemGenerator.js";
import { eventBus } from "../src/domain/engine/eventBus.js";
import type { GovernanceEvaluationOutcomeDraft } from "../src/dblayer/seuTypes.js";
import { createObligationAsRoot, ROOT_ACTOR_ID, ROOT_ACTOR_BADGE } from "./testFixtures.js";

const run = randomUUID().slice(0, 8);
const state = (name: string) => `zz-${name}-${run}`;
let t: CommissionedSeu;
let capabilityId: string;
let packId: string;
let deliverableBirthState: string;
let verb: string;
const edges: Array<[string, string]> = [];

before(async () => {
  t = await commissionedSeu("execution-engine");
  const { rows } = await pool.query<{ id: string }>("SELECT id FROM capability_definitions ORDER BY created_at LIMIT 1");
  assert.ok(rows[0], "the database holds a Capability Definition");
  capabilityId = rows[0].id;
  const { data: pack } = await packsDB.findByCode("development");
  assert.ok(pack, "the development Pack is seeded");
  packId = pack.id;
  const { data: birth } = await transitionDefinitionsDB.findBirth("Deliverable");
  assert.ok(birth, "the Deliverable has a birth row");
  deliverableBirthState = birth.to_state;
  const verbRows = await pool.query<{ verb: string }>("SELECT verb FROM transition_definitions WHERE entity_type = 'Deliverable' AND verb IS NOT NULL LIMIT 1");
  assert.ok(verbRows.rows[0], "a seeded Deliverable edge names a verb");
  verb = verbRows.rows[0].verb;
});

after(async () => {
  for (const [from, to] of edges) await pool.query("DELETE FROM transition_definitions WHERE entity_type = 'Deliverable' AND from_state = $1 AND to_state = $2", [from, to]);
  await reloadIfLoaded();
});

async function createDeliverable(lifecycle: string = deliverableBirthState, on: CommissionedSeu = t, fields: { code?: string; producingCapabilityId?: string } = {}) {
  const { data, error } = await deliverablesDB.create({
    seuId: on.seu.id, ...fields, name: `execution-engine ${run} ${randomUUID()}`, state: lifecycle, authorId: on.systemParticipantId, authorBadge: ROOT_ACTOR_BADGE,
  });
  assert.ok(data && !error, error?.message);
  return data;
}

async function addEdge(from: string, to: string, withVerb: boolean): Promise<void> {
  const { error } = await transitionDefinitionsDB.upsert({ entityType: "Deliverable", fromState: from, toState: to, verb: withVerb ? verb : null });
  assert.ok(!error, error?.message);
  edges.push([from, to]);
}

function assertGovernanceOk(result: DeliverableGovernanceResult): asserts result is Extract<DeliverableGovernanceResult, { ok: true }> {
  assert.equal(result.ok, true, JSON.stringify(result));
}

test("governance refuses a Deliverable while an Obligation that blocks the hop is open on it", async () => {
  const deliverable = await createDeliverable();
  await createObligationAsRoot({
    relatedObjectType: "Deliverable", relatedObjectId: deliverable.id, category: "Operational", title: `Blocks the hop ${run}`, blockedFromState: deliverableBirthState, blockedToState: "In Progress",
  });
  const result = await executionEngine.evaluateDeliverableTransition({ deliverable, targetState: "In Progress", actorId: ROOT_ACTOR_ID });
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.reason === "obligation_blocked" && result.detail.includes(`Blocks the hop ${run}`), JSON.stringify(result));
});

test("governance passes a Deliverable that has no producing Capability, and the governance outcome is stored with a Command and an eligible-Participant pool", async () => {
  const deliverable = await createDeliverable();
  const governance = await executionEngine.evaluateDeliverableTransition({ deliverable, targetState: "In Progress", actorId: ROOT_ACTOR_ID });
  assertGovernanceOk(governance);
  assert.equal(governance.fromState, deliverableBirthState);

  const common = {
    seuId: t.seu.id, entityType: "Deliverable" as const, entityId: deliverable.id, fromState: governance.fromState, toState: "In Progress", commandType: `zz-execute-${run}`,
    producingCapabilityId: capabilityId, requestedBy: ROOT_ACTOR_ID, actorId: ROOT_ACTOR_ID, actingBadgeType: ROOT_ACTOR_BADGE, correlationId: randomUUID(),
  };
  await assert.rejects(() => executionEngine.execute({ ...common, actorId: "" }), /without a real actorId/);
  await assert.rejects(() => executionEngine.execute({ ...common, actingBadgeType: "" }), /without a resolved acting badge/);

  await executionEngine.execute({ ...common, governanceOutcome: governance.governanceOutcome });
  const { data: commands } = await commandsDB.findBySeuId(t.seu.id);
  const command = (commands ?? []).find((c) => c.command_type === common.commandType);
  assert.ok(command, "the Command is stored");
  assert.ok(command.governance_outcome_id, "the Command carries the governance outcome");
  assert.ok(command.eligible_participant_pool_id, "the Command carries the pool");
  const { data: pool } = await capabilityFulfilmentPoolsDB.findById(command.eligible_participant_pool_id);
  assert.deepEqual(pool?.participant_ids, [], "the SEU does not require the Capability, so nobody fulfils it");
});

test("applying a hop with no Transition Definition is refused, and a hop whose Deliverable has already moved is refused as in flight", async () => {
  const deliverable = await createDeliverable();
  const governance = await executionEngine.evaluateDeliverableTransition({ deliverable, targetState: "In Progress", actorId: ROOT_ACTOR_ID });
  assertGovernanceOk(governance);
  const base = { deliverable, fromState: deliverableBirthState, requestedBy: ROOT_ACTOR_ID, actingBadgeType: ROOT_ACTOR_BADGE, governanceOutcome: governance.governanceOutcome, correlationId: randomUUID() };

  const nowhere = await executionEngine.applyGovernedDeliverableTransition({ ...base, toState: state("nowhere") });
  assert.ok(!nowhere.ok && nowhere.reason === "no_transition_definition", JSON.stringify(nowhere));

  const moved = await executionEngine.applyDeliverableTransition({ ...base, fromState: state("not-current"), toState: "In Progress" });
  assert.ok(!moved.ok && moved.reason === "already_in_flight");
});

test("governance refuses an edge with a submit verb until the Deliverable has been submitted, and an edge that declares no verb is an error", async () => {
  const from = state("open");
  const to = state("done");
  await addEdge(from, to, true);
  await pool.query("UPDATE transition_definitions SET submit_verb = $3 WHERE entity_type = 'Deliverable' AND from_state = $1 AND to_state = $2", [from, to, verb]);
  await reloadIfLoaded();
  const deliverable = await createDeliverable(from);

  const refused = await executionEngine.evaluateDeliverableTransition({ deliverable, targetState: to, actorId: ROOT_ACTOR_ID });
  assert.ok(!refused.ok && refused.reason === "not_submitted" && refused.detail.includes(`deliverable_${verb}`), JSON.stringify(refused));

  await eventBus.publish({
    eventType: `Deliverable${from}`, originatingObjectType: "Deliverable", originatingObjectId: deliverable.id, seuId: t.seu.id,
    correlationId: randomUUID(), actorId: ROOT_ACTOR_ID, authorityBadge: ROOT_ACTOR_BADGE,
  });
  assertGovernanceOk(await executionEngine.evaluateDeliverableTransition({ deliverable, targetState: to, actorId: ROOT_ACTOR_ID }));

  const noVerbFrom = state("open-no-verb");
  const noVerbTo = state("done-no-verb");
  await addEdge(noVerbFrom, noVerbTo, false);
  const noVerbDeliverable = await createDeliverable(noVerbFrom);
  await assert.rejects(() => executionEngine.evaluateDeliverableTransition({ deliverable: noVerbDeliverable, targetState: noVerbTo, actorId: ROOT_ACTOR_ID }), /declares no verb/);
});

test("a Work Item records the Quality Gate of the governance outcome of its Command, and none when the Deliverable does not exist", async () => {
  const { data: gate, error: gateError } = await qualityGatesDB.upsert({
    name: `execution-engine gate ${run}`, entityType: "AttentionItem", fromState: state("gate-from"), toState: state("gate-to"),
    criteria: { type: "no_unresolved_obligations" }, originatingPackId: packId, authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE,
  });
  assert.ok(gate && !gateError, gateError?.message);

  const deliverable = await createDeliverable();
  const governance = await executionEngine.evaluateDeliverableTransition({ deliverable, targetState: "In Progress", actorId: ROOT_ACTOR_ID });
  assertGovernanceOk(governance);
  const draft: GovernanceEvaluationOutcomeDraft = { ...governance.governanceOutcome, outcome: "Waived", quality_gate_id: gate.id, quality_gate_outcome: "Waived", originating_pack_id: packId };
  const { data: outcome, error: outcomeError } = await governanceEvaluationOutcomesDB.create({ ...draft, author_id: t.systemParticipantId, author_badge: ROOT_ACTOR_BADGE });
  assert.ok(outcome && !outcomeError, outcomeError?.message);

  const create = async (entityId: string, governanceOutcomeId: string | null) => {
    const { data: command, error } = await commandsDB.create({
      seuId: t.seu.id, entityType: "Deliverable", entityId, commandType: `zz-work-item-${run}`, fromState: deliverableBirthState, toState: "In Progress",
      requestedBy: ROOT_ACTOR_ID, actingBadgeType: ROOT_ACTOR_BADGE, correlationId: randomUUID(), governanceOutcomeId,
    });
    assert.ok(command && !error, error?.message);
    return command;
  };

  const command = await create(deliverable.id, outcome.id);
  const workItem = await workItemGenerator.generate({ command, seuId: t.seu.id, correlationId: randomUUID(), causationEventId: null });
  const stored = (await workItemsDB.findById(workItem.id)).data;
  assert.deepEqual(stored?.execution_context?.qualityGate, { id: gate.id, name: gate.name, outcome: "Waived" });
  assert.equal(stored?.execution_context?.relevantDeliverable.id, deliverable.id);

  const orphan = await workItemGenerator.generate({ command: await create(randomUUID(), null), seuId: t.seu.id, correlationId: randomUUID(), causationEventId: null });
  assert.equal((await workItemsDB.findById(orphan.id)).data?.execution_context, null, "a Command for a Deliverable that does not exist has no execution context");
});

// ── Branches the first tests do not reach ─────────────────────────────────────────────────────────────────────────

import { qualityGateWaiversDB } from "../src/dblayer/qualityGateWaiversDB.js";
import { policiesDB } from "../src/dblayer/policiesDB.js";
import { ebmsDB } from "../src/dblayer/ebmsDB.js";
import { seusDB } from "../src/dblayer/seusDB.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { attentionItemsDB } from "../src/dblayer/attentionItemsDB.js";
import { createDecision } from "../src/routes/seu/core/decisions.js";
import { raiseAttentionItem } from "../src/routes/seu/core/attentionItems.js";
import { createEvidenceAsRoot } from "./testFixtures.js";
import { loadSettled, configurationParameter } from "../src/domain/engine/ebmSettled.js";
import { FIXTURE_CODES } from "./schemaFixtures.js";
import { commissionFixtureSeu, commissionedSeu, type CommissionedSeu } from "./webScenarios.js";
import { authorityRulesDB } from "../src/dblayer/authorityRulesDB.js";
import { deliverableDefinitionsDB } from "../src/dblayer/deliverableDefinitionsDB.js";

test("governance refuses a Deliverable while an Obligation blocks its SEU, and while a Decision on it is not Approved", async () => {
  const blockedSeu = await commissionedSeu("execution-engine-seu-blocked");
  await createObligationAsRoot({
    relatedObjectType: "SEU", relatedObjectId: blockedSeu.seu.id, category: "Operational", title: `Blocks the SEU ${run}`, blockedFromState: "Activated", blockedToState: "Operational",
  });
  const seuBlocked = await executionEngine.evaluateDeliverableTransition({ deliverable: await createDeliverable(deliverableBirthState, blockedSeu), targetState: "In Progress", actorId: ROOT_ACTOR_ID });
  assert.ok(!seuBlocked.ok && seuBlocked.reason === "seu_blocked" && seuBlocked.detail.includes(`Blocks the SEU ${run}`), JSON.stringify(seuBlocked));

  const decisionSeu = await commissionedSeu("execution-engine-decision-blocked");
  const deliverable = await createDeliverable(deliverableBirthState, decisionSeu);
  const support = await createDeliverable(deliverableBirthState, decisionSeu);
  const evidence = await createEvidenceAsRoot({ seuId: decisionSeu.seu.id, relatedObjectType: "Deliverable", relatedObjectId: support.id, category: "Analytical Evidence", title: `support ${run}` });
  await createDecision({
    actorId: ROOT_ACTOR_ID, seuId: decisionSeu.seu.id, evidenceIds: [evidence.id], relatedObjects: [{ related_object_type: "Deliverable", related_object_ids: [deliverable.id] }],
    category: "Engineering Decisions", title: `Open decision ${run}`,
  });
  const decisionBlocked = await executionEngine.evaluateDeliverableTransition({ deliverable, targetState: "In Progress", actorId: ROOT_ACTOR_ID });
  assert.ok(!decisionBlocked.ok && decisionBlocked.reason === "decision_blocked" && decisionBlocked.detail.includes(`Open decision ${run}`), JSON.stringify(decisionBlocked));
});

test("a Quality Gate on the hop blocks the Deliverable and raises an Attention Item; a Waiver turns that into a waived outcome, and a gate that holds is a passed one", async () => {
  const gateSeu = await commissionedSeu("execution-engine-gates", "unsettled", { conflictSet: "execution" });
  const createGate = async (label: string, from: string, to: string, criteria: Record<string, unknown>) => {
    const { data, error } = await qualityGatesDB.upsert({
      name: `execution-engine ${label} ${run}`, entityType: "Deliverable", fromState: from, toState: to, criteria, originatingPackId: packId, authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE,
    });
    assert.ok(data && !error, error?.message);
    return data;
  };

  const blockedFrom = state("gate-open-a");
  const blockedTo = state("gate-done-a");
  await addEdge(blockedFrom, blockedTo, true);
  const gate = await createGate("blocking", blockedFrom, blockedTo, { type: "requires_active_policy", policyIds: [] });
  const deliverable = await createDeliverable(blockedFrom, gateSeu);
  const blocked = await executionEngine.evaluateDeliverableTransition({ deliverable, targetState: blockedTo, actorId: ROOT_ACTOR_ID });
  assert.ok(!blocked.ok && blocked.reason === "quality_gate_blocked" && blocked.detail.includes(gate.name), JSON.stringify(blocked));
  const { data: items } = await attentionItemsDB.findOpenByRelatedObjectAny("Deliverable", deliverable.id);
  assert.ok((items ?? []).some((i) => i.title.includes(gate.name)), "the block raises an Attention Item");

  const { error: waiverError } = await qualityGateWaiversDB.grant({
    qualityGateId: gate.id, seuId: gateSeu.seu.id, entityType: "Deliverable", entityId: deliverable.id, rationale: "execution-engine test", grantedBy: ROOT_ACTOR_ID, authorityBadge: ROOT_ACTOR_BADGE,
  });
  assert.ok(!waiverError, waiverError?.message);
  const waived = await executionEngine.evaluateDeliverableTransition({ deliverable, targetState: blockedTo, actorId: ROOT_ACTOR_ID });
  assertGovernanceOk(waived);
  assert.deepEqual([waived.governanceOutcome.outcome, waived.governanceOutcome.quality_gate_id, waived.governanceOutcome.originating_pack_id], ["Waived", gate.id, packId]);
  assert.ok(waived.governanceOutcome.rationale.includes(`Quality Gate "${gate.name}": Waived`), waived.governanceOutcome.rationale);

  const passedFrom = state("gate-open-b");
  const passedTo = state("gate-done-b");
  await addEdge(passedFrom, passedTo, true);
  await createGate("passing", passedFrom, passedTo, { type: "no_unresolved_obligations" });
  const passed = await executionEngine.evaluateDeliverableTransition({ deliverable: await createDeliverable(passedFrom, gateSeu), targetState: passedTo, actorId: ROOT_ACTOR_ID });
  assertGovernanceOk(passed);
  assert.deepEqual([passed.governanceOutcome.outcome, passed.governanceOutcome.quality_gate_outcome], ["Approved", "Passed"]);
  assert.ok(passed.governanceOutcome.rationale.includes("Quality Gate(s): Passed"));
});

test("a Standard that fails does not stop the hop: it is approved with conditions and the deviation is recorded", async () => {
  // The fixture Pack contributes a Standard for the output Deliverable that fails until its producing Capability is Fulfilled. The SEU is commissioned on it, so its EBM carries the Standard.
  const standardSeu = await commissionFixtureSeu("execution-engine-standard");
  const { data: ebm } = await ebmsDB.findById(standardSeu.seu.active_ebm_id!);
  const standards = ((await policiesDB.findByIds(ebm!.applicable_policy_ids)).data ?? []).filter((p) => p.constraint_type === "Standard");
  assert.ok(standards.length > 0, "the EBM carries the fixture Standard");
  const standard = standards[0];
  const [, from, to] = standard.governed_transition!.split("|");
  const deliverable = ((await deliverablesDB.findBySeuId(standardSeu.seu.id)).data ?? []).find((d) => d.code === FIXTURE_CODES.output.code);
  assert.ok(deliverable, "commissioning made the output Deliverable");
  // The Standard governs one hop, so the Deliverable is evaluated for it from the state that hop leaves.
  const governance = await executionEngine.evaluateDeliverableTransition({ deliverable: { ...deliverable, lifecycle_state: from }, targetState: to, actorId: ROOT_ACTOR_ID });
  assertGovernanceOk(governance);
  assert.ok(governance.governanceOutcome.deviated_policy_ids.includes(standard.id), "the failed Standard is recorded as deviated");
  assert.equal(governance.governanceOutcome.outcome, "Approved-with-Conditions");
  const { data: events } = await eventsDB.findByOriginatingObject("Policy", standard.id);
  assert.ok((events ?? []).some((e) => e.event_type === "StandardPolicyDeviation"));
});

test("a Work Item records what the EBM settled and what its governance outcome names: the locations, the checklists, the capital, the Policies, the Authority rule and the open Attention Items", async () => {
  // The SEU is commissioned on the fixture Profile, so its EBM settles the fixture Pack's content. The fixture tenant's Deliverable Definition for the input Deliverable has a guide location.
  const contextSeu = await commissionFixtureSeu("execution-engine-context");
  const fixtureTenant = contextSeu.tenantId;
  const code = contextSeu.fixtures.inputDeliverable.code;
  const { data: definition } = await deliverableDefinitionsDB.findActiveByCodeVisibleTo(code, fixtureTenant);
  assert.ok(definition?.guide_location, "the fixture Deliverable Definition has a guide location");
  const deliverable = ((await deliverablesDB.findBySeuId(contextSeu.seu.id)).data ?? []).find((d) => d.code === code);
  assert.ok(deliverable, `commissioning made the ${code} Deliverable`);
  // The Deliverable may already have been moved by the engine, so its hop is taken from the state it is in.
  const fromState = deliverable.lifecycle_state;
  const toState = ((await transitionDefinitionsDB.findPossibleNextStates("Deliverable", fromState)).data ?? [])[0];
  assert.ok(toState, `the Deliverable has a hop from ${fromState}`);

  const { data: rule, error: ruleError } = await authorityRulesDB.upsert({
    code: `zz-rule-${run}`, governedTransition: `Deliverable|zz-from-${run}|zz-to-${run}`, authorisedRole: "lead", authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE,
  });
  assert.ok(rule && !ruleError, ruleError?.message);
  const policy = (await policiesDB.upsert({
    code: `zz-context-${run}`, name: `execution-engine context ${run}`, condition: { type: "always_true" }, originatingPackId: packId, authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE,
  })).data;
  assert.ok(policy);
  const { attentionItem } = await raiseAttentionItem({
    seuId: contextSeu.seu.id, category: "Action Required", title: `Open item ${run}`, relatedObjectType: "Deliverable", relatedObjectId: deliverable.id, actorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE,
  });

  const governance = await executionEngine.evaluateDeliverableTransition({ deliverable, targetState: toState, actorId: ROOT_ACTOR_ID });
  assertGovernanceOk(governance);
  const { data: outcome, error } = await governanceEvaluationOutcomesDB.create({
    ...governance.governanceOutcome, satisfied_policy_ids: [policy.id], applicable_authority_rule_id: rule.id, open_attention_item_ids: [attentionItem.id],
    author_id: contextSeu.systemParticipantId, author_badge: ROOT_ACTOR_BADGE,
  });
  assert.ok(outcome && !error, error?.message);

  const { data: command } = await commandsDB.create({
    seuId: contextSeu.seu.id, entityType: "Deliverable", entityId: deliverable.id, commandType: `zz-context-${run}`, fromState, toState,
    requestedBy: ROOT_ACTOR_ID, actingBadgeType: ROOT_ACTOR_BADGE, correlationId: randomUUID(), governanceOutcomeId: outcome.id,
  });
  assert.ok(command);
  const workItem = await workItemGenerator.generate({ command, seuId: contextSeu.seu.id, correlationId: randomUUID(), causationEventId: null, targetCompletionAt: "2030-01-01T00:00:00.000Z" });
  const context = (await workItemsDB.findById(workItem.id)).data!.execution_context!;

  // What the EBM settled, as the commissioning recorded it.
  const settled = (await loadSettled(contextSeu.seu.id))!;
  const locations = configurationParameter(settled, "knowledgeLocations") as Array<{ deliverableCodes?: string[]; outputLocation?: string }>;
  assert.ok(locations?.length, "the EBM settled the Profile's knowledge locations");
  assert.deepEqual([context.inputLocation, context.outputLocation], [definition.guide_location, locations.find((l) => (l.deliverableCodes ?? []).includes(code))?.outputLocation ?? null]);
  assert.ok(context.outputLocation, "the fixture Profile names an output location for the input Deliverable");
  if (deliverable.producing_capability_id) {
    const expectedChecklists = (settled.checklists?.result ?? []).flatMap((c) => c.items.filter((i) => i.statement).map((i) => ({ packCode: c.pack, checklistName: c.checklist, statement: i.statement })));
    assert.deepEqual(context.applicableChecklists, expectedChecklists);
    assert.deepEqual(context.engineeringCapital.map((c) => [c.packCode, c.type]), (settled.engineeringCapital?.result ?? []).flatMap((e) => e.packs.map((pk) => [pk, e.type])));
  } else {
    assert.deepEqual([context.applicableChecklists, context.engineeringCapital], [[], []], "a Deliverable with no producing Capability takes no checklists or capital");
  }
  for (const [key, value] of Object.entries(context.profileConfiguration)) {
    assert.deepEqual(configurationParameter(settled, key), value, `the configuration value ${key} is the settled one`);
  }
  assert.deepEqual(context.governingPolicies, [{ id: policy.id, code: policy.code, name: policy.name }]);
  assert.deepEqual(context.applicableAuthority, { ruleId: rule.id, code: rule.code });
  assert.deepEqual(context.openAttentionItems.map((i) => i.id), [attentionItem.id]);
});

test("the Work Item Generator refuses a Command that has no requester or badge, a requester who is not a user and a requester who is not a Participant of the SEU", async () => {
  const strangerSeu = await commissionedSeu("execution-engine-requester", "rich", { rootParticipant: false });
  const { data: command } = await commandsDB.create({
    seuId: strangerSeu.seu.id, entityType: "SEU", entityId: strangerSeu.seu.id, commandType: `zz-requester-${run}`, fromState: "Initiated", toState: "Validated",
    requestedBy: ROOT_ACTOR_ID, actingBadgeType: ROOT_ACTOR_BADGE, correlationId: randomUUID(),
  });
  assert.ok(command);
  const generate = (changes: Record<string, unknown>) => workItemGenerator.generate({ command: { ...command, ...changes } as never, seuId: strangerSeu.seu.id, correlationId: randomUUID(), causationEventId: null });

  await assert.rejects(() => generate({ requested_by: null }), /has no requested_by/);
  await assert.rejects(() => generate({ acting_badge_type: "" }), /has no acting_badge_type/);
  await assert.rejects(() => generate({ requested_by: randomUUID() }), /No superuser provisioned/);
  await assert.rejects(() => generate({}), /No participants row for participants_master/);
});
