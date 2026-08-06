# Engineering Telemetry — Plan

*Book 3 Ch.35. Separated out from `SDK UI Layer Plan.md` per Sudha's instruction not to combine the two. Written 2026-08-06 after reading the actual live code, not just the chapter or the `Post-MVP Build Sequence.md` phase list — that document still describes Phase 7 as future work; it isn't. A real baseline is already running.*

## What's already live — this corrects the "not yet built" framing

`Post-MVP Build Sequence.md`'s Phase 7 entry says Telemetry is deferred until Phases 3–6 exist to measure. Phases 3–6 are now built, and so is a real slice of Phase 7 itself — not a stub:

- **Flow Telemetry (Ch.35 §7) — Deliverable cycle time.** `deliverablesDB.findCycleTimes()` derives it from the `events` table (`DeliverableTransitioned` rows), platform-wide. Live.
- **Governance Telemetry (§7) — Quality Gate latency.** `qualityGateEvaluationsDB.findLatencies()` measures Blocked→Passed friction per gate, platform-wide. Live.
- **Sustained-pattern detection → Organisational Learning Obligation (§11, Ch.23 §7).** `checkSustainedQualityGateBlocking` — called from `deliverables.ts` on every Quality-Gate-blocked transition — raises an Obligation and an Escalation Attention Item (Ch.34 §7) once a gate has blocked the same SEU 3+ times. Live, one bottleneck type.
- **A real dashboard**, not just an API: `/aisworg/seu/telemetry` (web) and `/telemetry` (api), showing both categories.
- **The substrate this all reads from already exists and isn't being rebuilt**: the `events` table + `eventBus`, populated by Phases 3–6's own work. This is why ET-002 ("no engineering metric shall require duplicate data entry") is already satisfied for what's built — the plan below keeps reading from what's already recorded, never adds a parallel manual-entry path.

Everything below is genuinely the remaining gap against what Ch.35 itself specifies, not a restatement of Phase 7 as if it hadn't started.

## Principles carried forward from Ch.35 (§5) — nothing here should violate these

- **ET-001 Passive** — Telemetry never writes engineering state. The one existing exception, raising an Obligation on a sustained pattern, is the chapter's own mandated exception (§11), not a precedent for anything else to also write state.
- **ET-002 Derived** — every metric added below reads from data Phases 3–6 already produce (`events`, `quality_gate_evaluations`, Evidence/Decision/Knowledge rows, Command/Work Item records). None of this needs a new manual-entry screen.
- **ET-003 Systems, not individuals** — every new metric stays scoped to a Deliverable, SEU, Gate, Service, or Capability, never to a named Participant's throughput.
- **ET-005 / FR-35.2 Historical trends preserved** — not actually true yet even for the two live metrics: they're computed fresh from raw rows on every request, with no snapshot mechanism, so "historical" only holds as long as the raw `events`/`quality_gate_evaluations` rows are never pruned. Worth naming now so it isn't silently assumed solved.

## The real gap, mapped to Ch.35's own structure

1. **Metric structure isn't data yet — no Metric Registry (§8).** The two live metrics are hardcoded TypeScript functions, not declarative rows carrying Identifier, Name, Description, Category, Measurement Method, Aggregation Strategy, Time Window, Unit of Measure, Provenance, Version — the shape §8 actually specifies. FR-35.4 ("Telemetry shall support custom metrics contributed through Packs") can't be satisfied while metrics are compiled code — a Pack can't contribute a TypeScript function at install time. Same shape of problem the Schema Registry just solved for Pack/Template/Profile/Transition Definition in `SDK UI Layer Plan.md`: metric definitions as data, one interpreter reading them, not N hardcoded functions per category.

2. **Only 2 of 6 telemetry categories exist (§7).** Flow and Governance are live. Not built, despite the data already existing from earlier phases:
   - **Knowledge Telemetry** (growth, Evidence generation, Decision reuse, ontology expansion) — Phase 5/6 already writes this data.
   - **Runtime Telemetry** (Command generation rate, dispatch latency, Work Item execution duration, participant utilisation) — Phase 3's Command/Work Item/Dispatch pipeline already produces these events.
   - **Quality Telemetry** (rework rate, defect escape rate, Deliverable acceptance rate, review effectiveness) — needs Review outcomes, which Phase 4 already records.
   - **Collaboration Telemetry** (cross-capability interactions, knowledge sharing, decision dependencies, review participation) — lowest priority of the four; the least-defined measurement method in the chapter itself.

3. **Sustained-pattern detection covers one of the four bottleneck types §11 names.** The chapter's own examples: (a) the same architectural Decision independently reached across many Deliverables — not detected; (b) a Service chronically missing its declared Service Level — not detected; (c) a Policy repeatedly waived — not detected; (d) a capability shortage recurring across multiple SEUs — not detected, and would need cross-SEU scope (see 5, below). Only "Quality Gate blocked 3+ times in one SEU" is wired.

4. **The "sustained" threshold is a hardcoded constant, not the Pack-contributed policy §11 explicitly calls for.** `SUSTAINED_BLOCK_THRESHOLD = 3` in `core/telemetry.ts` — the code's own comment already flags this as a known simplification, blocked on Policy not yet having a general config-carrying role beyond gating transitions. Not solved by this plan; named so it isn't lost.

5. **No per-SEU breakdown — only platform-wide pooling, and no Cross-SEU Analytics (§13).** This is a deliberate, documented MVP scoping choice (`deliverablesDB.findCycleTimes`'s own comment: "same scoping choice as Engineering Capital, Phase 6"), not an oversight — but it means the chapter's own framing (*"the platform cares whether the SEU is healthy"*) isn't actually answerable per-SEU today, only in aggregate across every SEU at once. §13 Cross-SEU comparison needs per-SEU numbers to exist first; right now there's nothing to compare.

6. **No Engineering Health assessment (§10), no Predictive Telemetry (§12).** Both explicitly synthesize over categories and history that don't exist yet — correctly not attempted, listed for sequencing, not urgency.

7. **Telemetry Traceability (§14) and most of the Events list (§15) are thin.** Displayed metrics carry no calculation version or provenance. Of the seven events §15 names, only `SustainedPatternDetected` is published; `MetricCalculated`, `HealthAssessmentUpdated`, `BottleneckDetected`, `TrendIdentified`, `ThresholdExceeded`, `TelemetrySnapshotGenerated` don't exist yet.

## Build order

1. **Metric Registry** — a `metric_definitions` table per §8's shape. Convert the two *existing* metrics (cycle time, gate latency) to read from it first, proving the interpreter against known-good data before anything new depends on it. Publishes `MetricCalculated` on every computation — the first of §15's unpublished events, and the natural place to start since it fires for metrics that already exist.
2. **Per-SEU breakdown** on the two existing categories. Small: `quality_gate_evaluations` and `deliverables` already carry `seu_id` (confirmed reading the actual queries — nothing to add there), so this is a filter on the existing dashboard/API, not new data collection. Unblocks §13 as a later comparison view over numbers that now actually exist per-SEU.
3. **Runtime Telemetry** — Phase 3's pipeline already logs what this category needs (dispatch latency, Work Item duration); same read-only pattern as Flow/Governance, applied to a different event source.
4. **Knowledge Telemetry** — same pattern, reading Phase 5/6's Evidence/Decision/Knowledge-scope-promotion events.
5. **Generalise sustained-pattern detection** beyond Quality-Gate-blocking to the other three §11-named bottleneck types (Service SLA breach, Policy waiver, capability shortage). Same `createObligation` + `raiseAttentionItem` pair `checkSustainedQualityGateBlocking` already established — generalised the same way `SDK UI Layer Plan.md` just generalised the Quality-Gate mechanism for Transition Definition: one mechanism reused per pattern type, not four bespoke copies.
6. **Quality Telemetry, Collaboration Telemetry** — round out §7's remaining categories once the Metric Registry pattern is proven against Runtime/Knowledge.
7. **Engineering Health (§10), Predictive Telemetry (§12)** — held. Both explicitly synthesize over categories that need to exist first; do not start these before step 6.
8. **The Pack-contributed "sustained" threshold (§11)** and the rest of §14 Traceability (calculation version, provenance) — explicitly not solved by this plan; revisit once Policy has a general config-carrying role, per the existing code comment's own note.
