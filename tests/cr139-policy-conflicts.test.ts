// CR-139: the Policies conflict detector. Its core works on the gathered rules, so these tests build them by hand.
import { test } from "node:test";
import assert from "node:assert/strict";

import { detectPolicyConflictsFrom, policyCodeKey, policyStepKey } from "../src/domain/engine/conflicts/policies.js";
import type { PolicyRule } from "../src/domain/engine/conflicts/unravelPolicies.js";

const STEP = "Deliverable|In Progress|Approved";

function rule(pack: string, policyCode: string, field: string | null, operator: string, value: unknown, statement = `${policyCode} statement`, deliverable = "source-code"): PolicyRule {
  return { policyCode, packId: `id-${pack}`, packCode: pack, deliverable, step: STEP, field, rule: field ? JSON.stringify({ operator, value }) : null, statement, scope: "Transition", governingCondition: null };
}

test("one Policy has no conflict", () => {
  assert.deepEqual(detectPolicyConflictsFrom({ rules: [rule("pack-1", "p1", "approvals", ">", 2)] }), []);
});

test("the same code with the same rule from two Packs has no conflict", () => {
  assert.deepEqual(detectPolicyConflictsFrom({ rules: [rule("pack-1", "p1", "approvals", ">", 2), rule("pack-2", "p1", "approvals", ">", 2)] }), []);
});

test("the table's example: P1 with approvals > 2 against P1 with approvals > 1 is a conflict", () => {
  const conflicts = detectPolicyConflictsFrom({ rules: [rule("pack-1", "p1", "approvals", ">", 2), rule("pack-2", "p1", "approvals", ">", 1)] });
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].key, policyCodeKey("p1", "source-code", STEP, "approvals"));
  assert.equal(conflicts[0].kind, "policy-same-code");
  assert.deepEqual(conflicts[0].options.map((o) => o.value), [{ operator: ">", value: 2 }, { operator: ">", value: 1 }]);
});

test("the same code with a different operator is a conflict", () => {
  assert.deepEqual(detectPolicyConflictsFrom({ rules: [rule("pack-1", "p1", "approvals", ">", 2), rule("pack-2", "p1", "approvals", ">=", 2)] }).map((c) => c.kind), ["policy-same-code"]);
});

test("the table's example: P1 with approvals > 2 and P2 with reviewers >= 1 on the same Deliverable and step are a conflict", () => {
  const conflicts = detectPolicyConflictsFrom({ rules: [rule("pack-1", "p1", "approvals", ">", 2), rule("pack-2", "p2", "reviewers", ">=", 1)] });
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].key, policyStepKey("source-code", STEP));
  assert.equal(conflicts[0].kind, "policy-across-codes");
  assert.equal(conflicts[0].options.length, 2);
  assert.equal(conflicts[0].resolvable, true);
});

test("different codes with the same rule are no conflict", () => {
  assert.deepEqual(detectPolicyConflictsFrom({ rules: [rule("pack-1", "p1", "approvals", ">", 2), rule("pack-2", "p2", "approvals", ">", 2)] }), []);
});

test("different codes on different Deliverables are no conflict", () => {
  assert.deepEqual(detectPolicyConflictsFrom({ rules: [rule("pack-1", "p1", "approvals", ">", 2), rule("pack-2", "p2", "reviewers", ">=", 1, "s", "api-spec")] }), []);
});

test("a condition with only a statement is never compared and is shown as a notice", () => {
  const found = detectPolicyConflictsFrom({ rules: [rule("pack-1", "p1", null, "", null, "Line coverage is met."), rule("pack-2", "p2", null, "", null, "Branch coverage is met.")] });
  assert.deepEqual(found.map((c) => c.kind), ["policy-human-verified"]);
  assert.equal(found[0].notice, true);
  assert.equal(found[0].resolvable, false);
  assert.deepEqual(found[0].options.map((o) => o.value), ["Line coverage is met.", "Branch coverage is met."]);
});

test("a statement-only Policy beside a machine-rule Policy is not a conflict", () => {
  const found = detectPolicyConflictsFrom({ rules: [rule("pack-1", "p1", null, "", null, "Line coverage is met."), rule("pack-2", "p2", "approvals", ">", 2)] });
  assert.deepEqual(found.map((c) => c.kind), ["policy-human-verified"]);
});

test("a picked conflict is returned with its pick", () => {
  const rules = [rule("pack-1", "p1", "approvals", ">", 2), rule("pack-2", "p2", "reviewers", ">=", 1)];
  assert.deepEqual(detectPolicyConflictsFrom({ rules }, { [policyStepKey("source-code", STEP)]: ["p1", "p2"] }).map((c) => c.resolution), [["p1", "p2"]]);
});
