// Policy Definition validation and inheritance (src/routes/seu/core/policyDefinitions.ts).
//
//   - validatePolicyDefinitionSeed is called directly with seeds that break one rule each, and the error text is asserted. The authoring
//     controller reaches only the valid path.
//   - Every Ontology code a valid seed uses is a test Ontology concept (tests/schemaFixtures.ts) or a Platform category concept.
//   - The parent rules and the two inheritance functions use the Active Policy of a schema fixture tenant, an Active Platform Policy,
//     and a bare Draft in a fixture tenant.
import "dotenv/config";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { policyDefinitionsDB } from "../src/dblayer/policyDefinitionsDB.js";
import { schemaDefinitionsDB } from "../src/dblayer/schemaDefinitionsDB.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { listActiveNouns } from "../src/routes/seu/core/authorityVocabulary.js";
import {
  validatePolicyDefinitionSeed, listInheritablePolicyDefinitions, inheritedPolicyDefinitionContent, listTransitionsForEntityType,
  type PolicyDefinitionSeedInput,
} from "../src/routes/seu/core/policyDefinitions.js";
import type { PolicyCondition } from "../src/dblayer/seuTypes.js";
import { PLATFORM_TENANT_ID, ROOT_ACTOR_ID, ROOT_ACTOR_BADGE } from "./testFixtures.js";
import { ensureFixtureTenant, buildStage1Fixtures, platformConceptCodes, authorityBadgeCodes, deliverableTransitions, FIXTURE_CODES, FIXTURE_VERSION } from "./schemaFixtures.js";

const run = randomUUID().slice(0, 8);
let category: string;
let severity: string;
let evidenceCategory: string;
let obligation: { category: string; origin: string; priority: string; severity: string };
let badge: string;
let deliverableTransition: string;
let eligibility: { noun: string; transition: string };

let ownerTenant: string;
let otherTenant: string;
let ownerActivePolicyId: string;
let ownerDraftPolicyId: string;

before(async () => {
  [category] = await platformConceptCodes("category:policy", 1);
  [severity] = await platformConceptCodes("category:policy-condition-severity", 1);
  [evidenceCategory] = await platformConceptCodes("category:evidence", 1);
  obligation = {
    category: (await platformConceptCodes("category:obligation", 1))[0],
    origin: (await platformConceptCodes("category:obligation-origin", 1))[0],
    priority: (await platformConceptCodes("category:obligation-priority", 1))[0],
    severity: (await platformConceptCodes("category:obligation-severity", 1))[0],
  };
  [badge] = await authorityBadgeCodes(1);
  [deliverableTransition] = await deliverableTransitions(1);

  let found: { noun: string; transition: string } | null = null;
  for (const noun of await listActiveNouns()) {
    const [transition] = await listTransitionsForEntityType(noun.code);
    if (transition) { found = { noun: noun.code, transition }; break; }
  }
  if (!found) throw new Error("no active Authority Vocabulary noun has a transition");
  eligibility = found;

  ownerTenant = await ensureFixtureTenant("policy-validation");
  otherTenant = await ensureFixtureTenant("policy-validation-other");
  const stage1 = await buildStage1Fixtures(ownerTenant);
  ownerActivePolicyId = stage1.policy.id;

  const { data: birth } = await transitionDefinitionsDB.findBirth("Policy");
  const { data: schema } = await schemaDefinitionsDB.findLatest("Policy");
  if (!birth || !schema) throw new Error("no birth Transition Definition or Policy schema");
  const { data: draft, error } = await policyDefinitionsDB.createDraft({
    tenantId: ownerTenant, code: `pdv-draft-${run}`, name: `Policy validation Draft ${run}`, category: "Engineering", version: "1.0.0",
    status: birth.to_state as never, authoredBy: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE, schemaDefinitionId: schema.id,
  });
  if (error || !draft) throw error ?? new Error("Policy Definition draft not created");
  ownerDraftPolicyId = draft.id;
});

const evidence = () => ({ title: "Evidence", category: evidenceCategory, description: "Evidence.", collectionMethod: "Attached." });

function validCondition(overrides: Partial<PolicyCondition> = {}): PolicyCondition {
  return {
    statement: "Every output is reviewed.",
    severity,
    applicabilityDeliverables: [{ name: FIXTURE_CODES.output.code, transitions: [deliverableTransition], governingCondition: { type: "always_true" } }],
    requiredEvidence: evidence(),
    relatedObligations: [{ ...obligation, title: "Record the review", description: "Raised when missing.", completionCriteria: "Review attached.", requiredEvidence: evidence() }],
    exceptionRules: [{ identifier: "ex-1", exceptionStatement: "Waived for unchanged output.", duration: "90 days", exceptionScope: "This SEU", exceptionApprovers: [badge], exceptionComposition: "all", reviewRequirements: "Checked at release." }],
    ...overrides,
  };
}

function seed(overrides: Partial<PolicyDefinitionSeedInput> = {}): PolicyDefinitionSeedInput {
  return { code: `pdv-${run}`, name: "Policy validation", category, constraintType: "Policy", scope: "Transition", version: "1.0.0", tenantId: ownerTenant, conditions: [validCondition()], ...overrides };
}

async function errorsOf(input: PolicyDefinitionSeedInput, draft = false): Promise<string> {
  const result = await validatePolicyDefinitionSeed(input, undefined, draft);
  return result.ok ? "" : result.errors.join("\n");
}

// A condition whose only applicability row is the given one.
const withRow = (row: Record<string, unknown>) => seed({ conditions: [validCondition({ applicabilityDeliverables: [row as never] })] });

test("a valid seed passes, including the Ontology check of its category and environments", async () => {
  assert.deepEqual(await validatePolicyDefinitionSeed(seed()), { ok: true });
});

test("the Ontology check refuses a category and an environment that are not canonical concepts", async () => {
  const text = await errorsOf(seed({ category: "not-a-category", applicabilityEnvironments: ["not-an-environment"] }));
  assert.match(text, /"category": "not-a-category" is not a canonical category:policy concept/);
  assert.match(text, /"not-an-environment" is not a canonical category:environment concept/);
});

test("code, name, category, version and scope are checked", async () => {
  const text = await errorsOf(seed({ code: " ", name: "", category: "", version: "x", scope: "Sideways" as never }));
  assert.match(text, /code is required/);
  assert.match(text, /name is required/);
  assert.match(text, /category is required/);
  assert.match(text, /version/);
  assert.match(text, /scope "Sideways" is not one of Transition\/Eligibility/);
});

test("a condition needs a statement and a canonical severity", async () => {
  const text = await errorsOf(seed({ conditions: [validCondition({ statement: " ", severity: "not-a-severity" })] }));
  assert.match(text, /condition 1: statement is required/);
  assert.match(text, /condition 1: "not-a-severity" is not a canonical category:policy-condition-severity concept/);
});

test("required evidence of a condition and of an obligation needs a canonical category", async () => {
  const bad = { ...evidence(), category: "not-an-evidence-category" };
  const text = await errorsOf(seed({ conditions: [validCondition({
    requiredEvidence: bad,
    relatedObligations: [{ ...validCondition().relatedObligations[0], requiredEvidence: bad }],
  })] }));
  assert.match(text, /condition 1 requiredEvidence: "not-an-evidence-category" is not a canonical category:evidence concept/);
  assert.match(text, /condition 1 relatedObligations 1 requiredEvidence: "not-an-evidence-category" is not a canonical category:evidence concept/);
});

test("a governing condition is checked by its type", async () => {
  const cases: Array<[Record<string, unknown>, RegExp[]]> = [
    [{ field: "x" }, [/governingCondition must have a "type"/]],
    [{ type: "field_in" }, [/\(field_in\) requires a field/, /\(field_in\) requires at least one value/]],
    [{ type: "field_in", field: "x", values: [] }, [/\(field_in\) requires at least one value/]],
    [{ type: "comparison", operator: "between", value: "" }, [/\(comparison\) requires a field/, /\(comparison\) requires a value/, /operator "between" is not one of gt\/gte\/lt\/lte\/eq\/neq/]],
    [{ type: "threshold", field: "x", value: "1", operator: "lt" }, [/operator "lt" is not one of gte\/gt/]],
    [{ type: "sometimes" }, [/governingCondition type "sometimes" is not one of always_true\/field_in\/comparison\/threshold/]],
  ];
  for (const [governingCondition, patterns] of cases) {
    const text = await errorsOf(withRow({ name: FIXTURE_CODES.output.code, transitions: [deliverableTransition], governingCondition }));
    for (const pattern of patterns) assert.match(text, pattern, JSON.stringify(governingCondition));
  }
  assert.equal(await errorsOf(withRow({ name: FIXTURE_CODES.output.code, transitions: [deliverableTransition], governingCondition: null })), "", "a blank governing condition is a manual condition");
});

test("a Transition-scope row needs a canonical Deliverable name and a real Deliverable transition", async () => {
  assert.match(await errorsOf(withRow({ name: " ", transitions: [], governingCondition: null })), /applicabilityDeliverables 1: name is required/);

  const unknownName = await errorsOf(withRow({ name: "not-a-deliverable", transitions: [], governingCondition: null }));
  assert.match(unknownName, /applicabilityDeliverables 1: "not-a-deliverable" is not a canonical deliverable-name concept/);
  assert.equal(await errorsOf(withRow({ name: "not-a-deliverable", transitions: [], governingCondition: null }), true), "", "a Draft skips the name check");

  assert.match(await errorsOf(withRow({ name: FIXTURE_CODES.output.code, transitions: ["Deliverable|a|b"], governingCondition: null })), /transition "Deliverable\|a\|b" is not one of Deliverable's real transitions/);
});

test("an Eligibility row needs an active Authority Vocabulary noun and a real transition of that noun", async () => {
  const eligible = (row: Record<string, unknown>) => seed({ scope: "Eligibility", conditions: [validCondition({ applicabilityDeliverables: [row as never] })] });

  assert.equal(await errorsOf(eligible({ name: eligibility.noun, transitions: [eligibility.transition], governingCondition: null })), "");

  const unknownNoun = await errorsOf(eligible({ name: "not-a-noun", transitions: [], governingCondition: null }));
  assert.match(unknownNoun, /name "not-a-noun" is not one of this platform's real active Authority Vocabulary nouns/);
  assert.equal(await errorsOf(eligible({ name: "not-a-noun", transitions: [], governingCondition: null }), true), "", "a Draft skips the noun check");

  assert.match(await errorsOf(eligible({ name: eligibility.noun, transitions: ["x|y|z"], governingCondition: null })), new RegExp(`transition "x\\|y\\|z" is not one of ${eligibility.noun}'s real transitions`));
  assert.match(await errorsOf(eligible({ name: "not-a-noun", transitions: ["x|y|z"], governingCondition: null }), true), /transition "x\|y\|z" is not one of not-a-noun's real transitions \(\)/);
});

test("a related obligation needs a category, and its category, origin, priority and severity must be canonical", async () => {
  const base = validCondition().relatedObligations[0];
  assert.match(await errorsOf(seed({ conditions: [validCondition({ relatedObligations: [{ ...base, category: " " }] })] })), /relatedObligations 1: category is required/);

  const text = await errorsOf(seed({ conditions: [validCondition({ relatedObligations: [{ ...base, category: "bad-category", origin: "bad-origin", priority: "bad-priority", severity: "bad-severity" }] })] }));
  assert.match(text, /"bad-category" is not a canonical category:obligation concept/);
  assert.match(text, /"bad-origin" is not a canonical category:obligation-origin concept/);
  assert.match(text, /"bad-priority" is not a canonical category:obligation-priority concept/);
  assert.match(text, /"bad-severity" is not a canonical category:obligation-severity concept/);
});

test("exception rules need a statement, composition all or any, and approvers that are real badges, and only a Policy may declare them", async () => {
  const rule = validCondition().exceptionRules[0];
  const text = await errorsOf(seed({ conditions: [validCondition({ exceptionRules: [{ ...rule, exceptionStatement: " ", exceptionComposition: "some" as never, exceptionApprovers: ["not_a_badge"] }] })] }));
  assert.match(text, /exceptionRules 1: exceptionStatement is required/);
  assert.match(text, /exceptionComposition "some" is not one of all\/any/);
  assert.match(text, /exceptionApprovers "not_a_badge" is not one of this platform's real active badges/);

  assert.match(await errorsOf(seed({ constraintType: "Standard" })), /exceptionRules can only be declared when constraintType is "Policy" \(this Definition is "Standard"\)/);
});

test("a parent must exist, be Active and be visible to the tenant", async () => {
  const withParent = (parentPolicyDefinitionId: string, tenantId: string) => seed({ conditions: [], parentPolicyDefinitionId, tenantId });
  const [platformParent] = await listInheritablePolicyDefinitions();
  assert.ok(platformParent, "the database holds an Active Platform Policy Definition");

  const missingId = randomUUID();
  assert.match(await errorsOf(withParent(missingId, ownerTenant)), new RegExp(`parentPolicyDefinitionId "${missingId}" not found`));
  assert.match(await errorsOf(withParent(ownerDraftPolicyId, ownerTenant)), /a Policy Definition can only be inherited from an Active Version/);
  assert.match(await errorsOf(withParent(ownerActivePolicyId, otherTenant)), /parent Policy Definition is not visible to this tenant/);

  assert.equal(await errorsOf(withParent(ownerActivePolicyId, ownerTenant)), "", "a parent of the same tenant is visible");
  assert.equal(await errorsOf(withParent(platformParent.id, otherTenant)), "", "a Platform parent is visible to every tenant");
});

test("listInheritablePolicyDefinitions lists the Active Platform Policies by code", async () => {
  const listed = await listInheritablePolicyDefinitions();
  assert.ok(listed.length > 0);
  assert.deepEqual(listed.map((p) => p.code), [...listed.map((p) => p.code)].sort((a, b) => a.localeCompare(b)));
  for (const item of listed) {
    const { data: row } = await policyDefinitionsDB.findById(item.id);
    assert.equal(row?.tenant_id, PLATFORM_TENANT_ID);
    assert.equal(row?.status, "Active");
    assert.deepEqual(item, { id: row!.id, code: row!.code, name: row!.name, category: row!.category, version: row!.version });
  }
});

test("inheritedPolicyDefinitionContent returns the parent's content, and refuses a missing parent and one that is not Active", async () => {
  const { data: parent } = await policyDefinitionsDB.findById(ownerActivePolicyId);
  assert.ok(parent);
  assert.equal(parent.version, FIXTURE_VERSION);
  const result = await inheritedPolicyDefinitionContent(parent.id);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("unreachable");
  assert.deepEqual(result.content, {
    code: parent.code, name: parent.name, description: parent.description ?? "", category: parent.category, constraintType: parent.constraint_type,
    applicabilityEnvironments: parent.applicability_environments, conditions: parent.conditions, scope: parent.scope,
  });

  assert.deepEqual(await inheritedPolicyDefinitionContent(randomUUID()), { ok: false, error: "parent Policy Definition not found" });
  assert.deepEqual(await inheritedPolicyDefinitionContent(ownerDraftPolicyId), { ok: false, error: "a Policy Definition can only be inherited from an Active Version" });
});
