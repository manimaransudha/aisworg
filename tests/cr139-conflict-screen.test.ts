// CR-139: what the Resolve Conflicts screen reads from the detectors' output.
import { test } from "node:test";
import assert from "node:assert/strict";

import { conflictStatus, summariseConflictTables, type ActionedConflict } from "../src/domain/engine/conflicts/index.js";
import { CONFLICT_ACTION_NONE, CONFLICT_ACTION_PICK_ONE, CONFLICT_TABLE_LABELS } from "../src/dblayer/constants.js";

const conflict = (over: Partial<ActionedConflict> = {}): ActionedConflict => ({
  table: "services", key: "k", kind: "service-choice", message: "m", options: [], resolvable: true, resolution: null, action: CONFLICT_ACTION_PICK_ONE, ...over,
});

test("a conflict is open without a pick, resolved with one, and a notice when it needs none", () => {
  assert.equal(conflictStatus(conflict()), "open");
  assert.equal(conflictStatus(conflict({ resolution: "svc-a" })), "resolved");
  assert.equal(conflictStatus(conflict({ notice: true, resolvable: false, action: CONFLICT_ACTION_NONE })), "notice");
});

test("a pick of false, zero or an empty list still counts as a pick", () => {
  assert.equal(conflictStatus(conflict({ resolution: false })), "resolved");
  assert.equal(conflictStatus(conflict({ resolution: 0 })), "resolved");
  assert.equal(conflictStatus(conflict({ resolution: [] })), "resolved");
});

test("one tab for each table, with how many conflicts it has and how many are open", () => {
  const tabs = summariseConflictTables({
    services: [conflict({ key: "a" }), conflict({ key: "b", resolution: "x" })],
    policies: [conflict({ key: "c", notice: true })],
  });
  assert.deepEqual(tabs.map((t) => t.table), ["services", "capabilities", "policies", "authorityRules", "qualityGates", "reviewGates", "obligationDefinitions", "engineeringCapital", "dependencies", "checklists", "competencies", "profileConfiguration"]);
  assert.deepEqual(tabs.find((t) => t.table === "services"), { table: "services", total: 2, open: 1 });
  assert.deepEqual(tabs.find((t) => t.table === "policies"), { table: "policies", total: 1, open: 0 });
  assert.deepEqual(tabs.find((t) => t.table === "capabilities"), { table: "capabilities", total: 0, open: 0 });
  assert.deepEqual(tabs.find((t) => t.table === "competencies"), { table: "competencies", total: 0, open: 0 }, "a tab that has a value and no conflict");
});

test("every tab has a label", () => {
  for (const tab of summariseConflictTables({})) assert.ok(CONFLICT_TABLE_LABELS[tab.table], tab.table);
});
