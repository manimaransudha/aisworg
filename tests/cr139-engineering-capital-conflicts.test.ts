// CR-139: the engineering capital conflict detector and its unravel, on hand-built Pack rows.
import { test } from "node:test";
import assert from "node:assert/strict";

import { detectEngineeringCapitalConflictsFrom, engineeringCapitalKey, engineeringCapitalMissingLinkKey } from "../src/domain/engine/conflicts/engineeringCapital.js";
import { unravelEngineeringCapital } from "../src/domain/engine/conflicts/unravelEngineeringCapital.js";
import type { ComposedPacks } from "../src/domain/engine/conflicts/composedPacks.js";
import type { PackContributions, PackRow } from "../src/dblayer/seuTypes.js";

const packs = (...entries: Array<[string, PackContributions]>): ComposedPacks => ({
  packs: entries.map(([code, contributions]) => ({ id: `id-${code}`, code, contributions }) as unknown as PackRow),
  directPackCodes: entries.map(([code]) => code),
  warnings: [],
  dependencyConflicts: [],
});
const detect = (...entries: Array<[string, PackContributions]>) => detectEngineeringCapitalConflictsFrom(unravelEngineeringCapital({ composedPacks: packs(...entries) }));
const A = "https://example.internal/a";
const B = "https://example.internal/b";

test("the same link from two Packs is no conflict", () => {
  assert.deepEqual(detect(["a", { engineeringCapital: [{ type: "Standard", url: A }] }], ["b", { engineeringCapital: [{ type: "Standard", url: A }] }]), []);
});

test("the table's example: the same type with link A in one Pack and link B in another is a conflict", () => {
  const conflicts = detect(["a", { engineeringCapital: [{ type: "Standard", url: A }] }], ["b", { engineeringCapital: [{ type: "Standard", url: B }] }]);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].key, engineeringCapitalKey("Standard"));
  assert.equal(conflicts[0].kind, "engineering-capital-different-links");
  assert.deepEqual(conflicts[0].options.map((o) => o.value), [{ type: "Standard", url: A }, { type: "Standard", url: B }]);
});

test("links of different types are no conflict", () => {
  assert.deepEqual(detect(["a", { engineeringCapital: [{ type: "Standard", url: A }] }], ["b", { engineeringCapital: [{ type: "Guide", url: B }] }]), []);
});

test("an entry with no link is a conflict, and so is one with a blank link", () => {
  assert.deepEqual(detect(["a", { engineeringCapital: [{ type: "Standard" }] }]).map((c) => [c.key, c.kind]), [[engineeringCapitalMissingLinkKey("a", "Standard"), "engineering-capital-missing-link"]]);
  assert.equal(detect(["a", { engineeringCapital: [{ type: "Standard", url: "   " }] }]).length, 1);
});

test("an entry with no link is not counted as a different link", () => {
  const conflicts = detect(["a", { engineeringCapital: [{ type: "Standard", url: A }] }], ["b", { engineeringCapital: [{ type: "Standard" }] }]);
  assert.deepEqual(conflicts.map((c) => c.kind), ["engineering-capital-missing-link"]);
});

test("a picked conflict is returned with its pick", () => {
  const facts = unravelEngineeringCapital({ composedPacks: packs(["a", { engineeringCapital: [{ type: "Standard", url: A }] }], ["b", { engineeringCapital: [{ type: "Standard", url: B }] }]) });
  assert.deepEqual(detectEngineeringCapitalConflictsFrom(facts, { [engineeringCapitalKey("Standard")]: [A, B] }).map((c) => c.resolution), [[A, B]]);
});
