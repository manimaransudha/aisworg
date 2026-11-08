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
import { deliverablesDB } from "../src/dblayer/deliverablesDB.js";
import { policiesDB } from "../src/dblayer/policiesDB.js";
import { packsDB } from "../src/dblayer/packsDB.js";
import { governedTransitionsFor } from "../src/domain/engine/policyChecks.js";
import { loadPolicyChecks } from "../src/domain/engine/policyChecks.js";
import { policyEngine } from "../src/domain/engine/policyEngine.js";
import pool from "../src/utils/db.js";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { profilesDB } from "../src/dblayer/profilesDB.js";
import { profileOwnCatalogue, resolveSeuOwningScope, loadSeuCatalogue, resolveDeliverableSource, catalogueFor } from "../src/domain/engine/deliverableSource.js";
import type { PolicyApplicabilityDeliverable, DeliverableRow, PolicyRow } from "../src/dblayer/seuTypes.js";
import { commissionFixtureSeu, commissionScenario, type FixtureSeu } from "./webScenarios.js";
import { FIXTURE_CODES } from "./schemaFixtures.js";
import { ROOT_ACTOR_ID, ROOT_ACTOR_BADGE, PLATFORM_TENANT_ID } from "./testFixtures.js";

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

let packId: string;
// The SEU is commissioned on the fixture Profile, so its EBM lists the Policies the fixture Pack contributes: a Policy and a Standard for the Deliverable transitions the fixtures govern.
let f: FixtureSeu;
let outputDeliverable: DeliverableRow;
let reviewPolicy: PolicyRow;
let coveragePolicy: PolicyRow;
let standard: PolicyRow;
before(async () => {
  const { data: pack } = await packsDB.findByCode("development");
  assert.ok(pack, "the development Pack is seeded");
  packId = pack.id;
  f = await commissionFixtureSeu("policy-engine");
  const { data: ebm } = await ebmsDB.findById(f.seu.active_ebm_id!);
  const listed = (await policiesDB.findByIds(ebm!.applicable_policy_ids)).data ?? [];
  const fixturePolicies = listed.filter((p) => p.originating_pack_id === f.fixtures.pack.id);
  const conditionOf = (p: PolicyRow) => (p.condition as { field?: string }).field;
  reviewPolicy = fixturePolicies.find((p) => p.constraint_type === "Policy" && conditionOf(p) === "reviewState")!;
  coveragePolicy = fixturePolicies.find((p) => p.constraint_type === "Policy" && conditionOf(p) === "coveragePercent")!;
  standard = fixturePolicies.find((p) => p.constraint_type === "Standard")!;
  assert.ok(reviewPolicy && coveragePolicy && standard, "the EBM lists the fixture Policies and the fixture Standard");
  const deliverables = (await deliverablesDB.findBySeuId(f.seu.id)).data ?? [];
  const byCode = (code: string) => deliverables.find((d) => d.code === code)!;
  outputDeliverable = byCode(FIXTURE_CODES.output.code);
  assert.ok(outputDeliverable, "commissioning made the Deliverable the fixture Service produces");
});

async function createPolicy(label: string, hop: string, fields: { constraintType?: "Policy" | "Standard"; condition?: Record<string, unknown>; names?: string[] }) {
  const { data, error } = await policiesDB.upsert({
    code: `zz-policy-${label}-${run}`, name: `policy-engine ${label}`, constraintType: fields.constraintType ?? "Policy", scope: "Transition", governedTransition: hop,
    condition: fields.condition ?? { type: "always_true" }, applicabilityDeliverableNames: fields.names ?? [], originatingPackId: packId, authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE,
  });
  assert.ok(data && !error, error?.message);
  return data;
}

const hopOf = (p: PolicyRow) => p.governed_transition!;
const evaluate = (hop: string, entityId: string | null, context?: Record<string, unknown>) => {
  const [entityType, fromState, toState] = hop.split("|");
  return policyEngine.evaluate({ entityType: entityType as "Deliverable", seuId: f.seu.id, entityId, fromState, toState, context, authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE });
};

test("the Policy Engine applies a Policy that names a Deliverable to that Deliverable", async () => {
  const hop = hopOf(reviewPolicy);
  const applied = await evaluate(hop, outputDeliverable.id, { reviewState: "reviewed" });
  assert.deepEqual([applied.outcome, applied.satisfiedPolicyIds], ["Passed", [reviewPolicy.id]]);
});

test("the Policy Engine blocks on a failed Policy, records a failed Standard as a deviation and finds no Policy for a hop nothing governs", async () => {
  const blocked = await evaluate(hopOf(reviewPolicy), outputDeliverable.id, { reviewState: "draft" });
  assert.deepEqual([blocked.outcome, blocked.outcome === "Blocked" && blocked.policyCode], ["Blocked", reviewPolicy.code]);
  assert.equal((await evaluate(hopOf(reviewPolicy), outputDeliverable.id, { reviewState: "waived" })).outcome, "Passed", "the other accepted value");

  const below = await evaluate(hopOf(coveragePolicy), outputDeliverable.id, { coveragePercent: 10 });
  assert.deepEqual([below.outcome, below.outcome === "Blocked" && below.policyCode], ["Blocked", coveragePolicy.code], "below the threshold");
  // Other Policies the EBM carries for the hop may also act, so the coverage Policy is what is read: it is satisfied at 90 and nothing else names it.
  const above = await evaluate(hopOf(coveragePolicy), outputDeliverable.id, { coveragePercent: 90 });
  assert.ok(above.outcome === "Blocked" ? above.policyCode !== coveragePolicy.code : above.satisfiedPolicyIds.includes(coveragePolicy.id), `above the threshold: ${JSON.stringify(above)}`);

  const deviated = await evaluate(hopOf(standard), outputDeliverable.id, { producingCapabilityStatus: "Unfulfilled" });
  assert.deepEqual([deviated.outcome, deviated.deviatedPolicyIds], ["Passed", [standard.id]]);
  const kept = await evaluate(hopOf(standard), outputDeliverable.id, { producingCapabilityStatus: "Fulfilled" });
  assert.deepEqual([kept.outcome, kept.satisfiedPolicyIds, kept.deviatedPolicyIds], ["Passed", [standard.id], []]);

  assert.equal((await evaluate(`Deliverable|zz-none-${run}|zz-none-to-${run}`, null)).outcome, "NotApplicable", "no Policy governs the hop");
});

test("the Policy Engine applies nothing outside an SEU, and evaluates a Policy with an empty context when none is given", async () => {
  const [entityType, fromState, toState] = hopOf(reviewPolicy).split("|");
  const base = { entityType: entityType as "Deliverable", fromState, toState, authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE };
  assert.equal((await policyEngine.evaluate({ ...base, seuId: null })).outcome, "NotApplicable");
  const noContext = await policyEngine.evaluate({ ...base, seuId: f.seu.id, entityId: outputDeliverable.id });
  const emptyContext = await policyEngine.evaluate({ ...base, seuId: f.seu.id, entityId: outputDeliverable.id, context: {} });
  assert.deepEqual(noContext, emptyContext);
});

// ── deliverableSource ─────────────────────────────────────────────────────────────────────────────────────────────

test("an SEU with no EBM takes its dependency rows and catalogue from its Template and Profile, and fails when they do not exist", async () => {
  // An SEU whose composition is blocked by open conflicts has no EBM.
  const plain = await commissionScenario("unsettled", "deliverable-source-plain", { conflictSet: "transition" });
  assert.equal(plain.seu.active_ebm_id, null);
  const scope = await resolveSeuOwningScope(plain.seu);
  assert.ok(Array.isArray(scope.dependencyDefinitionIds));
  assert.ok(Array.isArray(await loadSeuCatalogue(plain.seu)));

  const dangling = { template_id: randomUUID(), profile_id: randomUUID(), active_ebm_id: null };
  await assert.rejects(() => resolveSeuOwningScope(dangling), /Template .* or Profile .* not found/);
  await assert.rejects(() => loadSeuCatalogue(dangling), /Template .* or Profile .* not found/);
});

test("a commissioned SEU takes the source its EBM recorded: the dependency rows and the catalogue of the Profile", async () => {
  assert.ok(f.seu.active_ebm_id, "commissioning made the EBM");
  const scope = await resolveSeuOwningScope(f.seu);
  assert.ok(Array.isArray(scope.dependencyDefinitionIds));
  const codes = (await loadSeuCatalogue(f.seu)).map((entry) => entry.code);
  for (const code of [FIXTURE_CODES.input.code, FIXTURE_CODES.output.code, FIXTURE_CODES.review.code]) assert.ok(codes.includes(code), `the catalogue lists ${code}`);
});

test("the checks of a transition come from the materialised Policies, and from the Policy Definitions only for the hops they govern and only when no materialised Policy has their code", async () => {
  const { rows } = await pool.query<{ id: string; code: string; scope: string | null; conditions: Array<{ applicabilityDeliverables?: PolicyApplicabilityDeliverable[] }> | null }>(
    "SELECT id, code, scope, conditions FROM policy_definitions WHERE status = 'Active'"
  );
  let found: { id: string; code: string; hop: string } | null = null;
  for (const definition of rows) {
    for (const condition of definition.conditions ?? []) {
      const governed = governedTransitionsFor((definition.scope ?? "Transition") as "Transition", condition.applicabilityDeliverables ?? []).find((g) => g.governedTransition);
      if (governed?.governedTransition) found ??= { id: definition.id, code: definition.code, hop: governed.governedTransition };
    }
  }
  assert.ok(found, "an Active Policy Definition governs a transition");

  const checks = await loadPolicyChecks([found.id], found.hop);
  assert.ok(checks.length > 0 && checks.every((c) => c.code === found!.code), JSON.stringify(checks));
  assert.deepEqual(await loadPolicyChecks([found.id], `Deliverable|zz-other-${run}|zz-other-to-${run}`), [], "a definition governs only its own hops");
  assert.deepEqual(await loadPolicyChecks([randomUUID()], found.hop), [], "an id that names nothing");

  const materialised = await createPolicy("materialised", `Deliverable|zz-m-from-${run}|zz-m-to-${run}`, {});
  await pool.query("UPDATE policies SET code = $2 WHERE id = $1", [materialised.id, `${found.code}::zz-${run}`]);
  const both = await loadPolicyChecks([materialised.id, found.id], found.hop);
  assert.deepEqual(both.map((c) => c.id), [materialised.id], "the materialised Policy takes the place of the definition of the same code");
});

test("a Profile that carries its own catalogue is the source of the catalogue, and the Template is the source otherwise", async () => {
  const { data: template } = await templatesDB.upsert({ status: "Active", tenantId: PLATFORM_TENANT_ID, code: `zz-source-template-${run}`, name: "Source template", deliverableCatalogue: [{ code: "zz-from-template" }] as never });
  const { data: otherTemplate } = await templatesDB.upsert({ status: "Active", tenantId: PLATFORM_TENANT_ID, code: `zz-source-other-${run}`, name: "Other template", deliverableCatalogue: [{ code: "zz-from-other" }] as never });
  assert.ok(template && otherTemplate);
  const { data: profile } = await profilesDB.upsert({
    status: "Active", tenantId: PLATFORM_TENANT_ID, code: `zz-source-profile-${run}`, name: "Source profile", baseTemplateId: template.id, authoredBy: ROOT_ACTOR_ID, authorBadge: "root", environment: "development",
  });
  assert.ok(profile);

  const fromTemplate = await resolveDeliverableSource(template, profile);
  assert.deepEqual([fromTemplate.type, fromTemplate.id], ["Template", template.id]);
  assert.deepEqual(catalogueFor(template, profile, fromTemplate), [{ code: "zz-from-template" }]);

  await pool.query("UPDATE profiles SET draft_content = $2 WHERE id = $1", [profile.id, JSON.stringify({ deliverableCatalogue: [{ code: "zz-own" }] })]);
  const { data: withOwn } = await profilesDB.findById(profile.id);
  assert.ok(withOwn);
  const fromProfile = await resolveDeliverableSource(template, withOwn);
  assert.deepEqual([fromProfile.type, fromProfile.id], ["Profile", profile.id]);
  assert.deepEqual(catalogueFor(template, withOwn, fromProfile), [{ code: "zz-own" }]);
  assert.deepEqual(catalogueFor(otherTemplate, withOwn, fromProfile), [{ code: "zz-from-other" }], "the Profile is the source only for its own base Template");
});
