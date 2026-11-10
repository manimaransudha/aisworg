// A Profile that carries its own Deliverable Catalogue overrides only the Service Levels of Services that make one of its Deliverables.
// The candidate filter is a pure function: this file needs no database and no fixtures.
import { test } from "node:test";
import assert from "node:assert/strict";

import { candidatesForCatalogue, type ExposableParameterCandidate } from "../src/routes/seu/core/templates.js";

const candidate = (over: Partial<ExposableParameterCandidate>): ExposableParameterCandidate => ({
  sourceType: "service", sourceCode: "svc", sourceName: "Svc", parameterName: "level", parameterLabel: "Level", valueBearing: true, ...over,
});

test("candidatesForCatalogue: a Service Level stays only when its Service makes a Deliverable of the catalogue", () => {
  const rows = [
    candidate({ sourceCode: "a", deliverables: ["d1"] }),
    candidate({ sourceCode: "b", deliverables: ["d2", "d3"] }),
    candidate({ sourceCode: "c", deliverables: ["d9"] }),
    candidate({ sourceCode: "none", deliverables: [] }),
    candidate({ sourceType: "policy", sourceCode: "pol" }),
  ];
  assert.deepEqual(candidatesForCatalogue(rows, ["d1", "d3"]).map((r) => r.sourceCode), ["a", "b", "pol"]);
});

test("candidatesForCatalogue: a Profile with no catalogue of its own keeps every candidate", () => {
  const rows = [candidate({ sourceCode: "a", deliverables: ["d1"] }), candidate({ sourceCode: "c", deliverables: ["d9"] })];
  assert.equal(candidatesForCatalogue(rows, []).length, 2);
});
