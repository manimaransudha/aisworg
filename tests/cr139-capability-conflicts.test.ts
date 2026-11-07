// CR-139: the Capabilities conflict detector. Its core works on the two lists, so these tests build them by hand.
import { test } from "node:test";
import assert from "node:assert/strict";

import { detectCapabilityConflictsFrom, capabilityAdditionKey } from "../src/domain/engine/conflicts/capabilities.js";
import type { CapabilitiesUnraveled } from "../src/domain/engine/conflicts/unravelCapabilities.js";

const listA = (...capabilityCodes: string[]): CapabilitiesUnraveled["listA"] => capabilityCodes.map((capabilityCode, i) => ({ deliverableCode: `doc-${i}`, serviceCode: `svc-${i}`, capabilityCode }));
const listB = (pack: string, ...capabilityCodes: string[]): CapabilitiesUnraveled["listB"] => capabilityCodes.map((capabilityCode) => ({ capabilityCode, packId: `id-${pack}`, packCode: pack }));

test("in A and not in B is not a conflict", () => {
  assert.deepEqual(detectCapabilityConflictsFrom({ listA: listA("cap-a", "cap-b"), listB: [] }), []);
});

test("in A and in B is not a conflict", () => {
  assert.deepEqual(detectCapabilityConflictsFrom({ listA: listA("cap-a"), listB: listB("pack-1", "cap-a") }), []);
});

test("not in A and in B is a conflict that names the Pack", () => {
  const conflicts = detectCapabilityConflictsFrom({ listA: listA("cap-a"), listB: listB("pack-1", "cap-a", "cap-x") });
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].key, capabilityAdditionKey("cap-x", "pack-1"));
  assert.equal(conflicts[0].table, "capabilities");
  assert.equal(conflicts[0].kind, "capability-added");
  assert.equal(conflicts[0].options[0].sourceLabel, "pack-1");
  assert.equal(conflicts[0].resolution, null);
});

test("each Pack that names a Capability not in A is its own conflict", () => {
  const conflicts = detectCapabilityConflictsFrom({ listA: listA("cap-a"), listB: [...listB("pack-1", "cap-x"), ...listB("pack-2", "cap-x")] });
  assert.deepEqual(conflicts.map((c) => c.key), [capabilityAdditionKey("cap-x", "pack-1"), capabilityAdditionKey("cap-x", "pack-2")]);
});

test("the Capability of every candidate Service of a Deliverable is in A, so none of them is a conflict", () => {
  const a = [{ deliverableCode: "doc-1", serviceCode: "svc-a", capabilityCode: "cap-a" }, { deliverableCode: "doc-1", serviceCode: "svc-b", capabilityCode: "cap-b" }];
  assert.deepEqual(detectCapabilityConflictsFrom({ listA: a, listB: listB("pack-1", "cap-a", "cap-b") }), []);
});

test("a picked conflict is returned with its pick", () => {
  const key = capabilityAdditionKey("cap-x", "pack-1");
  assert.deepEqual(detectCapabilityConflictsFrom({ listA: listA("cap-a"), listB: listB("pack-1", "cap-x") }, { [key]: "exclude" }).map((c) => c.resolution), ["exclude"]);
});

// The example in the design table: d1 comes from s1 and s2, d2 from s3 and s4, d3 from s5, and the Services name c1 to c5.
const exampleA: CapabilitiesUnraveled["listA"] = [
  { deliverableCode: "d1", serviceCode: "s1", capabilityCode: "c1" },
  { deliverableCode: "d1", serviceCode: "s2", capabilityCode: "c2" },
  { deliverableCode: "d2", serviceCode: "s3", capabilityCode: "c3" },
  { deliverableCode: "d2", serviceCode: "s4", capabilityCode: "c4" },
  { deliverableCode: "d3", serviceCode: "s5", capabilityCode: "c5" },
];

test("the table's example: a Pack that names c1 to c5 is no conflict, and a Pack that also names c6 conflicts only on c6", () => {
  assert.deepEqual(detectCapabilityConflictsFrom({ listA: exampleA, listB: listB("pack-1", "c1", "c2", "c3", "c4", "c5") }), []);
  const conflicts = detectCapabilityConflictsFrom({ listA: exampleA, listB: listB("pack-1", "c1", "c2", "c3", "c4", "c5", "c6") });
  assert.deepEqual(conflicts.map((c) => c.key), [capabilityAdditionKey("c6", "pack-1")]);
});

test("the table's example: with no Pack naming any Capability there is no conflict", () => {
  assert.deepEqual(detectCapabilityConflictsFrom({ listA: exampleA, listB: [] }), []);
});
