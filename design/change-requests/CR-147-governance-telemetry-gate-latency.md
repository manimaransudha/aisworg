# CR-147 — Governance Telemetry: Quality Gate latency per hop

**Raised:** 2026-11-17 · **Origin:** the test run after CR-145 failed `tests/telemetry.test.ts:123` ("friction must be reflected as positive latency"). The owner decided that telemetry needs a broader implementation and opened it as its own CR. Chapter references are not yet traced.
**Status:** 🟡 Proposed (not designed)
**Related CRs:** [CR-145](CR-145-quality-gate-alignment.md) (the gate evaluations and the baseline Pack that list one gate on two hops).

## Fix the following

- The Quality Gate latency of Governance Telemetry is measured for one hop of one Deliverable, so a gate that governs two hops gives each hop its own latency.
- The scope of the broader telemetry implementation is to be set by the owner.

## What the code does today (read 2026-11-17)

| # | Finding | Evidence |
|---|---|---|
| 1 | `findLatencies` groups the evaluations by `quality_gate_id`, `entity_id` and `seu_id`. The latency is the earliest Passed time minus the earliest Blocked time of the group, or zero when the group has no Blocked row. | src/dblayer/qualityGateEvaluationsDB.ts:43-62 |
| 2 | An evaluation row stores the gate, the SEU, the entity type and id, the outcome, a `detail` document and the author. It has no from-state and no to-state column. The content of `detail` was not read. | src/dblayer/qualityGateEvaluationsDB.ts:18-21 |
| 3 | The baseline Pack lists the gate `no-unresolved-obligations` at two hops, Defined to In Progress and In Progress to Approved. Both hops therefore share one gate id for a Deliverable. | src/dblayer/seed/data/platform-governance-baseline.pack.json:9-17 |
| 4 | In `tests/telemetry.test.ts`, the second Deliverable starts first, so the gate Passes at Defined to In Progress. The Obligation is attached afterwards, and the gate Blocks at In Progress to Approved. The earliest Passed row is older than the earliest Blocked row, so the latency is expected to be negative. This follows from the query and the baseline Pack. The evaluation rows of that Deliverable were not queried. | tests/telemetry.test.ts:98-124 |

## Still open

1. The scope of the broader telemetry implementation (owner).
2. Whether an evaluation records its hop, or telemetry measures from each Passed row back to the last Blocked row before it.
3. `tests/telemetry.test.ts:123` stays failing until this CR is decided. The first-try test of the same file passes.
4. The other consumers of the latency rows and the Chapter that defines the metric were not traced.
