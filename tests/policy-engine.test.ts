// Policy checks, the Policy Engine and the Deliverable source (src/domain/engine/policyChecks.ts, policyEngine.ts, deliverableSource.ts).
//
//   - governedTransitionsFor is a pure function, so its cases are hand-built applicability rows.
//   - The Policy Engine reads the Policies that the SEU's active EBM lists. The test writes its own Policies for fabricated Deliverable
//     transitions, one hop for each case, and an EBM that lists them. Policies are not deleted, as in the other tests that write Policies.
//   - The Deliverable source reads the Template, the Profile and the EBM of a plain SEU row, and the source an EBM recorded.
import "dotenv/config";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { ebmsDB } from "../src/dblayer/ebmsDB.js";
import { seusDB } from "../src/dblayer/seusDB.js";
import { deliverablesDB } from "../src/dblayer/deliverablesDB.js";
import { policiesDB } from "../src/dblayer/policiesDB.js";
import { packsDB } from "../src/dblayer/packsDB.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { governedTransitionsFor } from "../src/domain/engine/policyChecks.js";
import { policyEngine } from "../src/domain/engine/policyEngine.js";
import { profileOwnCatalogue, resolveSeuOwningScope, loadSeuCatalogue } from "../src/domain/engine/deliverableSource.js";
import type { PolicyApplicabilityDeliverable } from "../src/dblayer/seuTypes.js";
import { createTestSeu, createTestEbm, type TestSeu } from "./engineFixtures.js";
import { ROOT_ACTOR_ID, ROOT_ACTOR_BADGE } from "./testFixtures.js";

const run = randomUUID().slice(0, 8);
const DEFAULT_HOP = "Deliverable|Approved|Baselined";
const applicability = (rows: Array<Partial<PolicyApplicabilityDeliverable>>) =>
  rows.map((r) => ({ name: "", transitions: [], governingCondition: null, ...r })) as PolicyApplicabilityDeliverable[];

test("an Eligibility Policy has no governed transition, and one row for each Deliverable it names", () => {
  assert.deepEqual(governedTransitionsFor("Eligibility", []), [{ governedTransition: null, deliverableNames: [], governingCondition: null }]);
  const rows = applicability([{ name: "Spec", governingCondition: { type: "always_true" } }, { name: "Plan" }]);
  assert.deepEqual(governedTransitionsFor("Eligibility", rows), [
    { governedTransition: null, deliverableNames: ["Spec"], governingCondition: { type: "always_true" } },
    { governedTransition: null, deliverableNames: ["Plan"], governingCondition: null },
  ]);
});

test("a Transition Policy governs the baseline hop when it names no transition, and each transition it names otherwise", () => {
  assert.deepEqual(governedTransitionsFor("Transition", []), [{ governedTransition: DEFAULT_HOP, deliverableNames: [], governingCondition: null }]);
  const rows = applicability([
    { name: "Spec", transitions: ["Deliverable|A|B", "Deliverable|C|D"], governingCondition: { type: "always_true" } },
    { name: "", transitions: ["Deliverable|E|F"] },
    { name: "Plan", transitions: [] },
  ]);
  assert.deepEqual(governedTransitionsFor("Transition", rows), [
    { governedTransition: "Deliverable|A|B", deliverableNames: ["Spec"], governingCondition: { type: "always_true" } },
    { governedTransition: "Deliverable|C|D", deliverableNames: ["Spec"], governingCondition: { type: "always_true" } },
    { governedTransition: "Deliverable|E|F", deliverableNames: [], governingCondition: null },
    { governedTransition: DEFAULT_HOP, deliverableNames: ["Plan"], governingCondition: null },
  ]);
});

let t: TestSeu;
let packId: string;
before(async () => {
  t = await createTestSeu("policy-engine");
  const { data: pack } = await packsDB.findByCode("development");
  assert.ok(pack, "the development Pack is seeded");
  packId = pack.id;
});

async function createPolicy(label: string, hop: string, fields: { constraintType?: "Policy" | "Standard"; condition?: Record<string, unknown>; names?: string[] }) {
  const { data, error } = await policiesDB.upsert({
    code: `zz-policy-${label}-${run}`, name: `policy-engine ${label}`, constraintType: fields.constraintType ?? "Policy", scope: "Transition", governedTransition: hop,
    condition: fields.condition ?? { type: "always_true" }, applicabilityDeliverableNames: fields.names ?? [], originatingPackId: packId, authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE,
  });
  assert.ok(data && !error, error?.message);
  return data;
}

async function activateEbm(policyIds: string[]) {
  const { data: birth } = await transitionDefinitionsDB.findBirth("EBM");
  assert.ok(birth, "the EBM has a birth row");
  const { data: ebm, error } = await ebmsDB.create({
    seuId: t.seu.id, templateId: t.seu.template_id, profileId: t.seu.profile_id, authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE,
    status: birth.to_state as never, composedPacks: [], compositionReport: {} as never, behaviors: null, applicablePolicyIds: policyIds,
  });
  assert.ok(ebm && !error, error?.message);
  await seusDB.setActiveEbm(t.seu.id, ebm.id);
}

const evaluate = (hop: string, entityId: string | null, context: Record<string, unknown> = {}) => {
  const [entityType, fromState, toState] = hop.split("|");
  return policyEngine.evaluate({
    entityType: entityType as "Deliverable", seuId: t.seu.id, entityId, fromState, toState, context, authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE,
  });
};

test("the Policy Engine applies a Policy that names Deliverables only to those Deliverables", async () => {
  const hop = `Deliverable|zz-named-from-${run}|zz-named-to-${run}`;
  const policy = await createPolicy("named", hop, { names: ["zz-code-a"] });
  await activateEbm([policy.id]);
  const named = await deliverablesDB.create({ seuId: t.seu.id, name: `policy-engine named ${run}`, code: "zz-code-a", state: "Defined", authorId: t.systemParticipantId, authorBadge: ROOT_ACTOR_BADGE });
  const other = await deliverablesDB.create({ seuId: t.seu.id, name: `policy-engine other ${run}`, code: "zz-code-b", state: "Defined", authorId: t.systemParticipantId, authorBadge: ROOT_ACTOR_BADGE });
  const uncoded = await deliverablesDB.create({ seuId: t.seu.id, name: `policy-engine uncoded ${run}`, state: "Defined", authorId: t.systemParticipantId, authorBadge: ROOT_ACTOR_BADGE });
  assert.ok(named.data && other.data && uncoded.data);

  const applied = await evaluate(hop, named.data.id);
  assert.deepEqual([applied.outcome, applied.satisfiedPolicyIds], ["Passed", [policy.id]]);
  assert.equal((await evaluate(hop, other.data.id)).outcome, "NotApplicable", "another code");
  assert.equal((await evaluate(hop, uncoded.data.id)).outcome, "NotApplicable", "a Deliverable with no code");
});

test("the Policy Engine blocks on a failed Policy, and records a failed Standard as a deviation", async () => {
  const blockedHop = `Deliverable|zz-block-from-${run}|zz-block-to-${run}`;
  const standardHop = `Deliverable|zz-standard-from-${run}|zz-standard-to-${run}`;
  const blocking = await createPolicy("blocking", blockedHop, { condition: { type: "field_in", field: "status", values: ["Ready"] } });
  const standard = await createPolicy("standard", standardHop, { constraintType: "Standard", condition: { type: "field_in", field: "status", values: ["Ready"] } });
  await activateEbm([blocking.id, standard.id]);

  const blocked = await evaluate(blockedHop, null, { status: "Draft" });
  assert.deepEqual([blocked.outcome, blocked.outcome === "Blocked" && blocked.policyCode], ["Blocked", blocking.code]);
  assert.equal((await evaluate(blockedHop, null, { status: "Ready" })).outcome, "Passed");

  const deviated = await evaluate(standardHop, null, { status: "Draft" });
  assert.deepEqual([deviated.outcome, deviated.deviatedPolicyIds], ["Passed", [standard.id]]);
  assert.equal((await evaluate(`Deliverable|zz-none-${run}|zz-none-to-${run}`, null)).outcome, "NotApplicable", "no Policy governs the hop");
});

// ── deliverableSource ─────────────────────────────────────────────────────────────────────────────────────────────

test("a Profile's own catalogue holds the entries that have a code, and nothing when it has none", () => {
  const profile = (draft: unknown) => ({ draft_content: draft }) as never;
  assert.deepEqual(profileOwnCatalogue(profile({ deliverableCatalogue: [{ code: "a" }, { code: "  " }, { name: "no code" }, null, { code: "b" }] })), [{ code: "a" }, { code: "b" }]);
  assert.deepEqual(profileOwnCatalogue(profile({ deliverableCatalogue: "not a list" })), []);
  assert.deepEqual(profileOwnCatalogue(profile(null)), []);
});

test("an SEU with no EBM takes its dependency rows and catalogue from its Template and Profile, and fails when they do not exist", async () => {
  const plain = await createTestSeu("deliverable-source-plain");
  const scope = await resolveSeuOwningScope(plain.seu);
  assert.ok(Array.isArray(scope.dependencyDefinitionIds));
  assert.ok(Array.isArray(await loadSeuCatalogue(plain.seu)));

  const dangling = { template_id: randomUUID(), profile_id: randomUUID(), active_ebm_id: null };
  await assert.rejects(() => resolveSeuOwningScope(dangling), /Template .* or Profile .* not found/);
  await assert.rejects(() => loadSeuCatalogue(dangling), /Template .* or Profile .* not found/);
});

test("an SEU with an EBM takes the source the EBM recorded, and fails when the EBM recorded none", async () => {
  const recorded = await createTestSeu("deliverable-source-recorded");
  const ebm = await createTestEbm(recorded.seu, null);
  const withSource = await ebmsDB.create({
    seuId: recorded.seu.id, templateId: recorded.seu.template_id, profileId: recorded.seu.profile_id, authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE,
    status: ebm.status, composedPacks: [], behaviors: null,
    compositionReport: { warnings: [], conflicts: [], parameterConflicts: [], resolutions: [], deliverableSource: { type: "Template", id: recorded.seu.template_id, dependencyDefinitionIds: ["dep-1", "dep-2"] } } as never,
  });
  assert.ok(withSource.data && !withSource.error, withSource.error?.message);

  const noSource = { template_id: recorded.seu.template_id, profile_id: recorded.seu.profile_id, active_ebm_id: ebm.id };
  await assert.rejects(() => resolveSeuOwningScope(noSource), /has no recorded Deliverable source/);
  await assert.rejects(() => loadSeuCatalogue(noSource), /has no recorded Deliverable source/);

  const recordedSeu = { template_id: recorded.seu.template_id, profile_id: recorded.seu.profile_id, active_ebm_id: withSource.data.id };
  assert.deepEqual(await resolveSeuOwningScope(recordedSeu), { dependencyDefinitionIds: ["dep-1", "dep-2"] });
  assert.ok(Array.isArray(await loadSeuCatalogue(recordedSeu)), "the Template is the source, so the catalogue is the Template's");
});
