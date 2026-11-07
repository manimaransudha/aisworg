// CR-139: the action that applies to each kind of conflict, and the resolver that checks a pick against it.
import { test } from "node:test";
import assert from "node:assert/strict";

import { CONFLICT_ACTION_BY_KIND, CONFLICT_ACTION_INCLUDE_OR_EXCLUDE, CONFLICT_ACTION_NONE, CONFLICT_ACTION_PICK_ANY, CONFLICT_ACTION_PICK_ONE } from "../src/dblayer/constants.js";
import { applyConflictPick, blockingEbmConflicts, resolveConflict, type ActionedConflict } from "../src/domain/engine/conflicts/index.js";
import { detectServiceConflictsFrom } from "../src/domain/engine/conflicts/services.js";
import type { ServiceCandidate, ServicesUnraveled } from "../src/domain/engine/conflicts/unravelServices.js";
import { withAction } from "../src/domain/engine/conflicts/resolve.js";
import type { EbmConflict } from "../src/domain/engine/conflicts/index.js";

// The Services detector's core runs on hand-built facts, so these tests need no database.
const twoServices = (): ServicesUnraveled => {
  const svc = (code: string): ServiceCandidate => ({ code, name: code, defaultLevels: {} });
  return { deliverableCodes: ["doc-1"], candidates: { "doc-1": [svc("svc-a"), svc("svc-b")] }, levelSettings: {}, deliverableNames: {} };
};
const servicesActioned = (resolutions: Record<string, unknown> = {}): { services: ActionedConflict[] } => ({ services: detectServiceConflictsFrom(twoServices(), [], resolutions).map(withAction) });

const conflict = (kind: string, over: Partial<EbmConflict> = {}): EbmConflict => ({
  table: "services", key: `k-${kind}`, kind, message: "m", resolvable: true, resolution: null,
  options: [{ sourceKind: "pack", sourceId: "1", sourceLabel: "a", value: "A" }, { sourceKind: "pack", sourceId: "2", sourceLabel: "b", value: "B" }], ...over,
});

test("every kind of conflict the detectors report has an action", () => {
  const kinds = [
    "service-choice", "level-different", "level-added", "level-omitted", "capability-added", "policy-same-code", "policy-across-codes", "policy-human-verified",
    "authority-different-roles", "quality-gate-different", "review-gate-different-rules", "obligation-different",
    "engineering-capital-different-links", "engineering-capital-missing-link", "dependency-required-missing", "dependency-incompatible-present",
  ];
  for (const kind of kinds) assert.ok(kind in CONFLICT_ACTION_BY_KIND, `no action for ${kind}`);
});

test("the Service choice and the service levels are a pick one", () => {
  for (const kind of ["service-choice", "level-different", "level-added", "level-omitted"]) assert.equal(CONFLICT_ACTION_BY_KIND[kind], CONFLICT_ACTION_PICK_ONE);
});

test("a kind with no action is read-only", () => {
  assert.equal(withAction(conflict("unknown-kind")).action, CONFLICT_ACTION_NONE);
});

test("pick one stores the value of the picked option and refuses zero, two or an unknown option", () => {
  const c = withAction(conflict("service-choice"));
  assert.deepEqual(resolveConflict(c, { optionIndexes: [1] }), { ok: true, value: "B" });
  assert.equal(resolveConflict(c, { optionIndexes: [] }).ok, false);
  assert.equal(resolveConflict(c, { optionIndexes: [0, 1] }).ok, false);
  assert.equal(resolveConflict(c, { optionIndexes: [5] }).ok, false);
});

test("pick any stores the picked values in order, one or all", () => {
  const c = withAction(conflict("policy-across-codes"));
  assert.equal(c.action, CONFLICT_ACTION_PICK_ANY);
  assert.deepEqual(resolveConflict(c, { optionIndexes: [1, 0] }), { ok: true, value: ["A", "B"] });
  assert.deepEqual(resolveConflict(c, { optionIndexes: [1] }), { ok: true, value: ["B"] });
  assert.equal(resolveConflict(c, { optionIndexes: [] }).ok, false);
});

test("include or exclude stores the decision and refuses anything else", () => {
  const c = withAction(conflict("capability-added"));
  assert.equal(c.action, CONFLICT_ACTION_INCLUDE_OR_EXCLUDE);
  assert.deepEqual(resolveConflict(c, { decision: "include" }), { ok: true, value: "include" });
  assert.deepEqual(resolveConflict(c, { decision: "exclude" }), { ok: true, value: "exclude" });
  assert.equal(resolveConflict(c, { decision: "maybe" }).ok, false);
});

test("a notice and a dependency conflict cannot be resolved", () => {
  assert.equal(resolveConflict(withAction(conflict("policy-human-verified", { resolvable: false })), { optionIndexes: [0] }).ok, false);
  assert.equal(resolveConflict(withAction(conflict("dependency-required-missing", { resolvable: false })), { optionIndexes: [0] }).ok, false);
});

test("the Services detector carries the stored pick", () => {
  const [open] = servicesActioned().services;
  assert.equal(open.action, CONFLICT_ACTION_PICK_ONE);
  const resolved = resolveConflict(open, { optionIndexes: [1] });
  assert.ok(resolved.ok);
  assert.deepEqual(servicesActioned({ [open.key]: resolved.ok ? resolved.value : null }).services.map((c) => c.resolution), ["svc-b"]);
});

test("blocking conflicts are every conflict without a pick except a notice", () => {
  assert.equal(blockingEbmConflicts(servicesActioned()).length, 1);
  assert.equal(blockingEbmConflicts(servicesActioned({ "serviceChoice::doc-1": "svc-a" })).length, 0);
});

test("applyConflictPick stores a valid pick under the conflict's key and refuses a pick for an unknown conflict", () => {
  const conflicts = servicesActioned();
  assert.deepEqual(applyConflictPick(conflicts, "serviceChoice::doc-1", { optionIndexes: [1] }), { ok: true, key: "serviceChoice::doc-1", value: "svc-b" });
  assert.equal(applyConflictPick(conflicts, "serviceChoice::unknown", { optionIndexes: [0] }).ok, false);
  assert.equal(applyConflictPick(conflicts, "serviceChoice::doc-1", { optionIndexes: [0, 1] }).ok, false);
});
