// CR-139: what the EBM saves for each table other than Services: the conflicts with the picks, and the final result the SEU takes.
import { test } from "node:test";
import assert from "node:assert/strict";

import { settleCapabilitiesFrom, INCLUDE } from "../src/domain/engine/conflicts/settleCapabilities.js";
import { settlePoliciesFrom } from "../src/domain/engine/conflicts/settlePolicies.js";
import { settleAuthorityRulesFrom } from "../src/domain/engine/conflicts/settleAuthorityRules.js";
import { settleQualityGatesFrom } from "../src/domain/engine/conflicts/settleQualityGates.js";
import { settleReviewGatesFrom } from "../src/domain/engine/conflicts/settleReviewGates.js";
import { settleObligationDefinitionsFrom } from "../src/domain/engine/conflicts/settleObligationDefinitions.js";
import { settleEngineeringCapitalFrom, INCLUDE as INCLUDE_ENTRY } from "../src/domain/engine/conflicts/settleEngineeringCapital.js";
import { settleDependenciesFrom } from "../src/domain/engine/conflicts/settleDependencies.js";
import { capabilityAdditionKey } from "../src/domain/engine/conflicts/capabilities.js";
import { policyCodeKey, policyStepKey } from "../src/domain/engine/conflicts/policies.js";
import { authorityRuleKey } from "../src/domain/engine/conflicts/authorityRules.js";
import { qualityGateKey } from "../src/domain/engine/conflicts/qualityGates.js";
import { reviewGateKey } from "../src/domain/engine/conflicts/reviewGates.js";
import { obligationStepKey } from "../src/domain/engine/conflicts/obligationDefinitions.js";
import { engineeringCapitalKey, engineeringCapitalMissingLinkKey } from "../src/domain/engine/conflicts/engineeringCapital.js";
import { serviceChoiceKey } from "../src/domain/engine/conflicts/services.js";
import type { PolicyRule } from "../src/domain/engine/conflicts/unravelPolicies.js";
import type { PackRow } from "../src/dblayer/seuTypes.js";

const STEP = "Deliverable|In Progress|Approved";

// Capabilities
const listA = [
  { deliverableCode: "d1", serviceCode: "s1", capabilityCode: "c1" },
  { deliverableCode: "d1", serviceCode: "s2", capabilityCode: "c2" },
  { deliverableCode: "d2", serviceCode: "s3", capabilityCode: "c3" },
];

test("capabilities: the SEU takes the Capability of the Service each Deliverable ends with", () => {
  const picked = settleCapabilitiesFrom({ listA, listB: [] }, { [serviceChoiceKey("d1")]: "s2" });
  assert.deepEqual(picked.result, [{ capability: "c2", deliverables: ["d1"], source: "service", definitionId: null }, { capability: "c3", deliverables: ["d2"], source: "service", definitionId: null }]);
  const withIds = settleCapabilitiesFrom({ listA, listB: [] }, { [serviceChoiceKey("d1")]: "s2" }, { c2: "def-2", c3: "def-3" });
  assert.deepEqual(withIds.result.map((r) => [r.capability, r.definitionId]), [["c2", "def-2"], ["c3", "def-3"]], "the EBM records the Definition id of each Capability it takes");
});

test("capabilities: a Deliverable whose Service is not decided takes no Capability yet", () => {
  assert.deepEqual(settleCapabilitiesFrom({ listA, listB: [] }).result.map((r) => r.capability), ["c3"]);
});

test("capabilities: a Capability a Pack names is taken only when the user included it, and the conflict is saved with the pick", () => {
  const listB = [{ capabilityCode: "cx", packId: "id-p", packCode: "pack-1" }];
  const key = capabilityAdditionKey("cx", "pack-1");
  const base = { [serviceChoiceKey("d1")]: "s1" };
  const included = settleCapabilitiesFrom({ listA, listB }, { ...base, [key]: INCLUDE });
  assert.deepEqual(included.result.filter((r) => r.source === "pack"), [{ capability: "cx", deliverables: [], source: "pack", definitionId: null }]);
  assert.deepEqual(included.conflicts.map((c) => [c.key, c.resolution]), [[key, INCLUDE]]);
  assert.deepEqual(settleCapabilitiesFrom({ listA, listB }, { ...base, [key]: "exclude" }).result.filter((r) => r.source === "pack"), []);
});

// Policies
const rule = (pack: string, policyCode: string, field: string | null, operator = ">", value: unknown = 2, statement = `${policyCode} statement`): PolicyRule => ({
  policyCode, packId: `id-${pack}`, packCode: pack, deliverable: "source-code", step: STEP, field, rule: field ? JSON.stringify({ operator, value }) : null, statement, scope: "Transition", governingCondition: field ? { type: "comparison", field, operator, value } : null,
});

test("policies: identical rules from two Packs are one rule that lists both Packs", () => {
  const settled = settlePoliciesFrom({ rules: [rule("a", "p1", "approvals"), rule("b", "p1", "approvals")] });
  assert.equal(settled.result.length, 1);
  assert.deepEqual(settled.result[0].packs, ["a", "b"]);
  assert.deepEqual(settled.result[0].rule, { operator: ">", value: 2 });
});

test("policies: the same Policy with two rules takes the rule the user picked", () => {
  const rules = [rule("a", "p1", "approvals", ">", 2), rule("b", "p1", "approvals", ">", 1)];
  const key = policyCodeKey("p1", "source-code", STEP, "approvals");
  assert.deepEqual(settlePoliciesFrom({ rules }, { [key]: { operator: ">", value: 1 } }).result.map((r) => r.rule), [{ operator: ">", value: 1 }]);
  assert.deepEqual(settlePoliciesFrom({ rules }).result, [], "until the conflict is resolved, no result is generated for it");
  assert.deepEqual(settlePoliciesFrom({ rules }).conflicts.map((c) => c.resolution), [null], "it stays in the conflict list");
});

test("policies: different Policies on one Deliverable and step take the Policies the user picked", () => {
  const rules = [rule("a", "p1", "approvals", ">", 2), rule("b", "p2", "reviewers", ">=", 1)];
  const key = policyStepKey("source-code", STEP);
  assert.deepEqual(settlePoliciesFrom({ rules }, { [key]: [{ policyCode: "p2", rules: [] }] }).result.map((r) => r.policyCode), ["p2"]);
  assert.deepEqual(settlePoliciesFrom({ rules }, { [key]: [{ policyCode: "p1", rules: [] }, { policyCode: "p2", rules: [] }] }).result.map((r) => r.policyCode), ["p1", "p2"]);
});

test("policies: a statement-only condition is always taken", () => {
  const settled = settlePoliciesFrom({ rules: [rule("a", "p1", null, "", null, "Coverage is met.")] });
  assert.deepEqual(settled.result.map((r) => [r.field, r.rule, r.statement]), [[null, null, "Coverage is met."]]);
});

// Authority rules
const authority = (pack: string | null, ...roles: string[]) => ({ packId: pack ? `id-${pack}` : null, packCode: pack, step: STEP, roles: [...roles].sort() });

test("authority rules: sources that agree give that set of roles", () => {
  assert.deepEqual(settleAuthorityRulesFrom({ rules: [authority("a", "lead"), authority(null, "lead")] }).result, [{ step: STEP, roles: ["lead"], packs: ["a"] }]);
});

test("authority rules: a conflict takes the roles of the sets the user picked, together", () => {
  const rules = [authority("a", "lead"), authority("b", "manager")];
  const key = authorityRuleKey(STEP);
  assert.deepEqual(settleAuthorityRulesFrom({ rules }, { [key]: [["manager"]] }).result[0].roles, ["manager"]);
  assert.deepEqual(settleAuthorityRulesFrom({ rules }, { [key]: [["manager"]] }).result[0].packs, ["b"], "the Packs behind the picked roles");
  assert.deepEqual(settleAuthorityRulesFrom({ rules }, { [key]: [["lead"], ["manager"]] }).result[0].roles, ["lead", "manager"]);
  assert.deepEqual(settleAuthorityRulesFrom({ rules }).result, [], "until the conflict is resolved, the step has no result");
});

// Quality gates
const qgate = (pack: string, fields: Record<string, unknown>, deliverable = "source-code", checklistIds: string[] = [], recommendedChecklistIds: string[] = []) => ({ packId: `id-${pack}`, packCode: pack, deliverable, step: STEP, fields, checklistIds, recommendedChecklistIds });

test("quality gates: the same gate from two Packs is one gate, and the checklists are a union", () => {
  const settled = settleQualityGatesFrom({ gates: [qgate("a", { name: "Review" }, "source-code", ["x"], ["r1"]), qgate("b", { name: "Review" }, "source-code", ["y"], ["r2"])] });
  assert.deepEqual(settled.result, [{ deliverable: "source-code", step: STEP, gates: [{ name: "Review" }], checklistIds: ["x", "y"], recommendedChecklistIds: ["r1", "r2"] }]);
});

test("quality gates: a conflict takes the gates the user picked", () => {
  const gates = [qgate("a", { name: "Code review" }), qgate("b", { name: "Review gate" })];
  const key = qualityGateKey(STEP, "source-code");
  assert.deepEqual(settleQualityGatesFrom({ gates }, { [key]: [{ name: "Review gate" }] }).result[0].gates, [{ name: "Review gate" }]);
  assert.deepEqual(settleQualityGatesFrom({ gates }).result, [], "until the conflict is resolved, no result is generated for it");
});

// Review gates
const rgate = (pack: string, fields: Record<string, unknown>, checklistIds: string[] = []) => ({ packId: `id-${pack}`, packCode: pack, step: STEP, fields, checklistIds, recommendedChecklistIds: [] });

test("review gates: gates with different codes are all taken, and the checklists are a union", () => {
  const gates = [rgate("a", { code: "rg1" }, ["x"]), rgate("b", { code: "rg2" }, ["y"])];
  assert.deepEqual(settleReviewGatesFrom({ gates }).result, [{ step: STEP, gates: [{ code: "rg1" }, { code: "rg2" }], checklistIds: ["x", "y"], recommendedChecklistIds: [], packs: ["a", "b"] }]);
});

test("review gates: a conflict between gates of one code takes the gate the user picked, and the other codes are still taken", () => {
  const gates = [rgate("a", { code: "rg1", name: "One" }, ["x"]), rgate("b", { code: "rg1", name: "Two" }, ["y"]), rgate("c", { code: "rg2" })];
  const key = reviewGateKey(STEP, "rg1");
  assert.deepEqual(settleReviewGatesFrom({ gates }, { [key]: [{ code: "rg1", name: "Two" }] }).result, [{ step: STEP, gates: [{ code: "rg1", name: "Two" }, { code: "rg2" }], checklistIds: ["x", "y"], recommendedChecklistIds: [], packs: ["b", "c"] }]);
  assert.deepEqual(settleReviewGatesFrom({ gates }).result, [{ step: STEP, gates: [{ code: "rg2" }], checklistIds: [], recommendedChecklistIds: [], packs: ["c"] }], "the gates of the open conflict are left out until it is resolved");
});

// Obligation definitions
const odef = (pack: string, fields: Record<string, unknown>) => ({ packId: `id-${pack}`, packCode: pack, deliverable: "source-code", step: STEP, fields });

test("obligation definitions: the same definition is one definition, and a conflict takes the definitions the user picked", () => {
  assert.equal(settleObligationDefinitionsFrom({ definitions: [odef("a", { code: "o1" }), odef("b", { code: "o1" })] }).result[0].definitions.length, 1);
  const definitions = [odef("a", { code: "o1", priority: "High" }), odef("b", { code: "o1", priority: "Low" })];
  const settled = settleObligationDefinitionsFrom({ definitions }, { [obligationStepKey("source-code", STEP, "o1")]: [{ code: "o1", priority: "Low" }] });
  assert.deepEqual(settled.result[0].definitions, [{ fields: { code: "o1", priority: "Low" }, packs: [{ id: "id-b", code: "b" }] }]);
});

test("obligation definitions: definitions with different codes are all taken, and an open conflict leaves out only its own code", () => {
  assert.equal(settleObligationDefinitionsFrom({ definitions: [odef("a", { code: "o1" }), odef("b", { code: "o2" })] }).result[0].definitions.length, 2);
  const definitions = [odef("a", { code: "o1", priority: "High" }), odef("b", { code: "o1", priority: "Low" }), odef("c", { code: "o2" })];
  assert.deepEqual(settleObligationDefinitionsFrom({ definitions }).result[0].definitions.map((d) => d.fields), [{ code: "o2" }], "the definitions of the open conflict are left out until it is resolved");
});

// Engineering capital
const entry = (pack: string, type: string, url: string) => ({ packId: `id-${pack}`, packCode: pack, type, url });

test("engineering capital: the same link from two Packs is one entry that lists both Packs", () => {
  assert.deepEqual(settleEngineeringCapitalFrom({ entries: [entry("a", "Standard", "A"), entry("b", "Standard", "A")] }).result, [{ type: "Standard", url: "A", packs: ["a", "b"] }]);
});

test("engineering capital: different links take the links the user picked", () => {
  const entries = [entry("a", "Standard", "A"), entry("b", "Standard", "B")];
  const key = engineeringCapitalKey("Standard");
  assert.deepEqual(settleEngineeringCapitalFrom({ entries }, { [key]: [{ type: "Standard", url: "B" }] }).result.map((e) => e.url), ["B"]);
  assert.deepEqual(settleEngineeringCapitalFrom({ entries }, { [key]: [{ type: "Standard", url: "A" }, { type: "Standard", url: "B" }] }).result.map((e) => e.url), ["A", "B"]);
});

test("engineering capital: an entry with no link is taken only when the user included it", () => {
  const entries = [entry("a", "Standard", "")];
  assert.deepEqual(settleEngineeringCapitalFrom({ entries }).result, []);
  assert.deepEqual(settleEngineeringCapitalFrom({ entries }, { [engineeringCapitalMissingLinkKey("a", "Standard")]: INCLUDE_ENTRY }).result, [{ type: "Standard", url: null, packs: ["a"] }]);
});

// Dependencies
test("dependencies: the result is the composed Packs, and the dependency conflicts are saved as found", () => {
  const packs = [{ id: "i1", code: "a", pack_version: "1.0.0" }, { id: "i2", code: "b", pack_version: "2.0.0" }] as unknown as PackRow[];
  const settled = settleDependenciesFrom({ packs, directPackCodes: ["a"], warnings: [], dependencyConflicts: [{ table: "dependencies", key: "dependency::a::z", kind: "dependency-required-missing", message: "m", options: [], resolution: null, resolvable: false }] });
  assert.deepEqual(settled.result, [{ id: "i1", code: "a", version: "1.0.0", direct: true }, { id: "i2", code: "b", version: "2.0.0", direct: false }]);
  assert.deepEqual(settled.conflicts.map((c) => [c.key, c.resolvable]), [["dependency::a::z", false]]);
});

// Checklists and competencies
import { settleChecklistsFrom } from "../src/domain/engine/conflicts/settleChecklists.js";
import { settleCompetenciesFrom } from "../src/domain/engine/conflicts/settleCompetencies.js";
import { COMPETENCY_DIMENSION_DOMAIN, COMPETENCY_DIMENSION_ROLE, COMPETENCY_DIMENSION_TECHNOLOGY, COMPETENCY_DIMENSION_WORK_TYPE } from "../src/dblayer/constants.js";

test("checklists: the SEU takes every checklist of every Pack with every item, and there is no conflict", () => {
  const settled = settleChecklistsFrom({
    checklists: [
      { packId: "i1", packCode: "a", name: "Review", description: null, items: [{ statement: "One" }, { statement: "Two" }] },
      { packId: "i2", packCode: "b", name: "Review", description: "d", items: [{ statement: "Three" }] },
    ],
  });
  assert.deepEqual(settled.conflicts, []);
  assert.deepEqual(settled.result.map((c) => [c.pack, c.checklist, c.items.length]), [["a", "Review", 2], ["b", "Review", 1]]);
});

test("competencies: the role types and work types of the Capabilities, the Profile's language and domain, and the Packs' competencies are added together", () => {
  const settled = settleCompetenciesFrom({
    capabilityRoles: [{ capability: "c1", roles: [{ name: "engineer", worktypes: ["build", "test"] }] }],
    profiles: [{ code: "prf", programmingLanguage: "python", domain: "banking" }],
    packCompetencies: [{ pack: "a", dimension: "Domain", value: "banking" }, { pack: "b", dimension: "Technology", value: "rust" }],
  });
  assert.deepEqual(settled.conflicts, []);
  const byDimension = (dimension: string) => settled.result.filter((r) => r.dimension === dimension).map((r) => r.value);
  assert.deepEqual(byDimension(COMPETENCY_DIMENSION_ROLE), ["engineer"]);
  assert.deepEqual(byDimension(COMPETENCY_DIMENSION_WORK_TYPE), ["build", "test"]);
  assert.deepEqual(byDimension(COMPETENCY_DIMENSION_TECHNOLOGY), ["python", "rust"]);
  assert.deepEqual(byDimension(COMPETENCY_DIMENSION_DOMAIN), ["banking"]);
});

test("competencies: a value from two places is one competency that lists both sources", () => {
  const settled = settleCompetenciesFrom({ capabilityRoles: [], profiles: [{ code: "prf", programmingLanguage: null, domain: "banking" }], packCompetencies: [{ pack: "a", dimension: "Domain", value: "banking" }] });
  assert.deepEqual(settled.result, [{ dimension: "Domain", value: "banking", sources: ["Profile prf", "Pack a"] }]);
});

test("competencies: with nothing to add there are no competencies", () => {
  assert.deepEqual(settleCompetenciesFrom({ capabilityRoles: [], profiles: [{ code: "prf", programmingLanguage: null, domain: null }], packCompetencies: [] }).result, []);
});

test("a conflict that is still open gives no result for the other tables either", () => {
  const rg = [rgate("a", { code: "rg1", name: "One" }), rgate("b", { code: "rg1", name: "Two" })];
  assert.deepEqual(settleReviewGatesFrom({ gates: rg }).result, []);
  assert.deepEqual(settleObligationDefinitionsFrom({ definitions: [odef("a", { code: "o1", priority: "High" }), odef("b", { code: "o1", priority: "Low" })] }).result, []);
  const entries = [entry("a", "Standard", "A"), entry("b", "Standard", "B"), entry("a", "Guide", "G")];
  assert.deepEqual(settleEngineeringCapitalFrom({ entries }).result.map((e) => e.url), ["G"], "only the type whose conflict is open is left out");
});

test("an open conflict leaves out only its own item: other policy rules and other steps are still taken", () => {
  const rules = [rule("a", "p1", "approvals", ">", 2), rule("b", "p1", "approvals", ">", 1), { ...rule("c", "p3", "coverage", ">=", 80), deliverable: "api-spec" }];
  assert.deepEqual(settlePoliciesFrom({ rules }).result.map((r) => r.policyCode), ["p3"]);
  const gates = [authority("a", "lead"), authority("b", "manager"), { ...authority("a", "lead"), step: "Deliverable|Approved|Released" }];
  assert.deepEqual(settleAuthorityRulesFrom({ rules: gates }).result, [{ step: "Deliverable|Approved|Released", roles: ["lead"], packs: ["a"] }]);
});

// What the EBM leaves out, and why
import { leftOutOf } from "../src/domain/engine/conflicts/settleShared.js";
import { settleServicesFrom } from "../src/domain/engine/conflicts/settleServices.js";
import type { ServiceCandidate } from "../src/domain/engine/conflicts/unravelServices.js";

test("left out: an open conflict leaves out what it covers and says it is not decided yet", () => {
  const settled = settlePoliciesFrom({ rules: [rule("a", "p1", "approvals", ">", 2), rule("b", "p1", "approvals", ">", 1)] });
  assert.equal(settled.leftOut.length, 1);
  assert.match(settled.leftOut[0].reason, /Not decided yet/);
});

test("left out: a resolved conflict leaves out the options the user did not take, and says what the user picked", () => {
  const rules = [rule("a", "p1", "approvals", ">", 2), rule("b", "p1", "approvals", ">", 1)];
  const settled = settlePoliciesFrom({ rules }, { [policyCodeKey("p1", "source-code", STEP, "approvals")]: { operator: ">", value: 1 } });
  assert.equal(settled.leftOut.length, 1);
  assert.match(settled.leftOut[0].item, /"value":2/);
  assert.match(settled.leftOut[0].reason, /You picked/);
});

test("left out: a pick of one or both says which was not picked, and an excluded Capability says it was excluded", () => {
  const gates = [qgate("a", { name: "Code review" }), qgate("b", { name: "Review gate" })];
  const picked = settleQualityGatesFrom({ gates }, { [qualityGateKey(STEP, "source-code")]: [{ name: "Review gate" }] });
  assert.deepEqual(picked.leftOut.map((l) => l.reason), ["You did not pick it."]);
  const listB = [{ capabilityCode: "cx", packId: "id-p", packCode: "pack-1" }];
  const excluded = settleCapabilitiesFrom({ listA, listB }, { [serviceChoiceKey("d1")]: "s1", [capabilityAdditionKey("cx", "pack-1")]: "exclude" });
  assert.ok(excluded.leftOut.some((l) => l.reason === "You chose to exclude it."));
});

test("left out: the Capability of a Service that is not a Deliverable's Service is left out with the reason", () => {
  const settled = settleCapabilitiesFrom({ listA, listB: [] }, { [serviceChoiceKey("d1")]: "s2" });
  assert.ok(settled.leftOut.some((l) => l.item.includes("c1") && l.reason.includes("s2 is.")));
});

test("left out: the Services of the Packs that no catalogue Deliverable uses, and the Services not chosen for a Deliverable", () => {
  const svc = (code: string): ServiceCandidate => ({ code, name: code, defaultLevels: {} });
  const facts = { deliverableCodes: ["d1"], candidates: { d1: [svc("s1"), svc("s2")] }, levelSettings: {}, deliverableNames: {} };
  const packs = [{ source: { id: "i", code: "pack-1", label: "pack-1" }, services: [{ code: "s9", serviceLevel: [] }] }];
  const settled = settleServicesFrom(facts, packs, { [serviceChoiceKey("d1")]: "s1" });
  assert.ok(settled.leftOut.some((l) => l.item.includes("s9") && l.reason.includes("No Deliverable")));
  assert.ok(settled.leftOut.some((l) => l.item.includes("s2") && l.reason.includes("You picked")));
});

test("left out: a table with nothing to leave out has an empty list", () => {
  assert.deepEqual(settleChecklistsFrom({ checklists: [] }).leftOut, []);
  assert.deepEqual(leftOutOf([]), []);
});

// Profile configuration, and the readers of the settled result
import { settleProfileConfigurationFrom } from "../src/domain/engine/conflicts/settleProfileConfiguration.js";
import { unravelProfileConfiguration } from "../src/domain/engine/conflicts/unravelProfileConfiguration.js";
import { competencyRequirementsOf, configurationParameter, settledOf } from "../src/domain/engine/ebmSettled.js";
import type { ProfileRow } from "../src/dblayer/seuTypes.js";

const profileRow = (draft: Record<string, unknown>, environment = "development"): ProfileRow => ({ code: "prf", environment, draft_content: draft } as unknown as ProfileRow);

test("profile configuration: the SEU takes every parameter the Profile sets, and none it leaves empty", () => {
  const facts = unravelProfileConfiguration({ profiles: [profileRow({ primaryProgrammingLanguage: "python", featureFlagCodes: [], readme: "", redispatchMaxAttempts: 0, dispatchStrategyPreference: [{ strategy: "cost", order: 1 }], technologyPackCodes: ["x"], exposedParameterOverrides: [{ a: 1 }] })] });
  const settled = settleProfileConfigurationFrom(facts);
  assert.deepEqual(settled.conflicts, []);
  assert.deepEqual(settled.result.map((r) => r.parameter), ["environment", "primaryProgrammingLanguage", "dispatchStrategyPreference", "redispatchMaxAttempts"]);
  assert.deepEqual(settled.result.find((r) => r.parameter === "environment"), { parameter: "environment", value: "development", profile: "prf" });
});

test("profile configuration: the Profile's Pack codes and exposed parameter overrides are not configuration", () => {
  const names = unravelProfileConfiguration({ profiles: [profileRow({ technologyPackCodes: ["x"], optionalPackCodes: ["y"], exposedParameterOverrides: [{ a: 1 }] })] }).parameters.map((p) => p.parameter);
  assert.deepEqual(names, ["environment"]);
});

test("readers: a configuration parameter and the competency requirements come from the settled result, and a missing settled result is refused", () => {
  const settled = settledOf({ settled: { profileConfiguration: { result: [{ parameter: "redispatchMaxAttempts", value: 3 }] }, competencies: { result: [{ dimension: "Domain", value: "banking" }, { dimension: "Domain", value: "retail" }, { dimension: "Role", value: "engineer" }] } } });
  assert.equal(configurationParameter(settled, "redispatchMaxAttempts"), 3);
  assert.equal(configurationParameter(settled, "readme"), undefined);
  assert.deepEqual(competencyRequirementsOf(settled), { Domain: ["banking", "retail"], Role: ["engineer"] });
  assert.deepEqual(competencyRequirementsOf(null), {});
  assert.throws(() => settledOf({ pool: [] }), /records no settled result/);
});

import { eligibilityPoliciesOf } from "../src/domain/engine/ebmSettled.js";

test("eligibility Policies: the SEU takes the Policies of scope Eligibility with their governing condition, and none of the others", () => {
  const settled = settlePoliciesFrom({ rules: [
    { ...rule("a", "background-check", "cleared", "in", [true]), scope: "Eligibility", step: "", deliverable: "Participant", governingCondition: { type: "field_in", field: "cleared", values: [true] } },
    rule("b", "p1", "approvals", ">", 2),
  ] });
  assert.deepEqual(eligibilityPoliciesOf({ policies: { result: settled.result } }), [{ code: "background-check", condition: { type: "field_in", field: "cleared", values: [true] } }]);
  assert.deepEqual(eligibilityPoliciesOf(null), []);
});
