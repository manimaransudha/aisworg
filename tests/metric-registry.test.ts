// Engineering Telemetry — Plan (design/mvp-build-plan/Engineering Telemetry
// — Plan.md), Build order step 1 — Metric Registry. Proves the dispatch
// mechanism itself (metricRegistryEngine.compute), not just that
// getFlowMetrics/getGovernanceMetrics still return the right numbers
// (tests/telemetry.test.ts already covers that, unchanged, since this pass
// kept their output shape identical):
//   1. A real metric_definitions row resolves to its registered
//      calculation_method and publishes MetricCalculated.
//   2. An unknown identifier and an unrecognised calculation_method both
//      fail closed, distinctly, rather than crashing or silently no-oping.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { metricRegistryEngine } from "../src/domain/engine/metricRegistryEngine.js";
import { metricDefinitionsDB } from "../src/dblayer/metricDefinitionsDB.js";
import { query } from "../src/utils/db.js";

after(async () => {
  await pool.end();
});

test("metricRegistryEngine.compute resolves a real metric_definitions row to its calculation_method and publishes MetricCalculated", async () => {
  const result = await metricRegistryEngine.compute("deliverable-cycle-time");
  assert.equal(result.outcome, "Computed");
  if (result.outcome !== "Computed") return;
  assert.equal(result.definition.identifier, "deliverable-cycle-time");
  assert.ok(result.value && typeof result.value === "object" && "averageCycleTimeSeconds" in (result.value as object));

  const { rows } = await query<{ payload: { identifier: string } }>(
    "SELECT payload FROM events WHERE event_type = 'MetricCalculated' AND originating_object_id = $1 ORDER BY occurred_at DESC LIMIT 1",
    [result.definition.id]
  );
  assert.equal(rows[0]?.payload.identifier, "deliverable-cycle-time");
});

test("metricRegistryEngine.compute fails closed for an unknown identifier", async () => {
  const result = await metricRegistryEngine.compute(`no-such-metric-${randomUUID()}`);
  assert.equal(result.outcome, "NotFound");
});

test("metricRegistryEngine.compute fails closed for a metric_definitions row naming an unrecognised calculation_method", async () => {
  const identifier = `metric-registry-test-${randomUUID()}`;
  const { error } = await query(
    `INSERT INTO metric_definitions (identifier, name, category, unit_of_measure, aggregation_strategy, calculation_method)
     VALUES ($1, 'Metric Registry test row', 'Flow', 'seconds', 'Average', 'no-such-calculation-method')`,
    [identifier]
  );
  assert.equal(error, undefined);

  const result = await metricRegistryEngine.compute(identifier);
  assert.equal(result.outcome, "UnrecognisedMethod");
  if (result.outcome === "UnrecognisedMethod") assert.equal(result.definition.calculation_method, "no-such-calculation-method");

  const { data: stillThere } = await metricDefinitionsDB.findByIdentifier(identifier);
  assert.ok(stillThere, "the row itself is unaffected by its own calculation_method being unrecognised");
});
