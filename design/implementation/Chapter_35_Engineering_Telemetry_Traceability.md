# Chapter 35 — Engineering Telemetry Model — Implementation Traceability

**Date of report: 4-10-2026**

<!-- multiline -->
**Legend:** ✅ Fully met  ⚠️ Partially met  ❌ Not met  ❓ Not verifiable

<table style="width:100%; table-layout:fixed;">
  <colgroup>
    <col style="width:4%;">
    <col style="width:32%;">
    <col style="width:27%;">
    <col style="width:37%;">
  </colgroup>
  <thead>
    <tr>
      <th></th>
      <th>Intent</th>
      <th>Code Citation</th>
      <th>Finding</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Telemetry measures engineering behaviour/flow/outcomes, derived from state and Events, never governs decisions<br> Ref: §1 Purpose, §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/telemetry.ts:1-9<br>src/domain/engine/metricRegistryEngine.ts:194-228</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All metric computations read existing <code>events</code>/<code>quality_gate_evaluations</code>/<code>deliverables</code>/Knowledge/Evidence rows; none write engineering state. The one exception (raising an Obligation on a sustained pattern) is the chapter's own named exception (§11), not a violation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Telemetry observes; never influences engineering state directly<br> Ref: §3 Architectural Position</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/metricRegistryEngine.ts (no mutation of deliverables/events)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Verified no metric computation function writes to any engineering entity table. Only <code>raiseSustainedPatternObligation</code> (§11's named exception) writes, and only an Obligation/Attention Item.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">ET-001 Telemetry is passive<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/metricRegistryEngine.ts:194-228<br>src/routes/seu/core/telemetry.ts:179-246</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Confirmed: metric functions are read-only queries. The sustained-pattern path is the chapter's own mandated exception, not a second violation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">ET-002 Telemetry is derived; no duplicate data entry<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/deliverablesDB.ts:82-98 (reads <code>events</code>)<br>src/dblayer/qualityGateEvaluationsDB.ts (reads <code>quality_gate_evaluations</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every live metric reads from tables already populated by Phases 3–6 (events, quality_gate_evaluations, deliverables, knowledge_items, evidence). No new manual-entry screen or table exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">ET-003 Telemetry measures systems, not individuals<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/metricRegistryEngine.ts:21-175</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every implemented metric is scoped to Deliverable/Gate/SEU/Capability/Policy aggregates. Participant utilisation (the one metric that would measure individual throughput) is explicitly not built (see Runtime Telemetry row below), so no metric currently attributes to a named Participant.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">ET-004 Telemetry shall remain reproducible<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/metricRegistryEngine.ts:48-175</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each calculation method is a pure function of current DB state plus optional <code>seuId</code> scope; identical inputs repeat identical outputs. No randomness or external calls.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">ET-005 Telemetry shall preserve historical trends<br> Ref: §5, FR-35.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/deliverablesDB.ts:82-98<br>src/dblayer/qualityGateEvaluationsDB.ts (findLatencies)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every metric is computed fresh from raw rows on each request; there is no snapshot/time-series storage. "Historical" availability holds only as long as the underlying <code>events</code>/<code>quality_gate_evaluations</code>/<code>deliverables</code> rows are retained and never pruned — there is no dedicated historical-trend mechanism.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">ET-006 Telemetry shall remain implementation-independent<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/metricRegistryEngine.ts:177-187</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Calculation is dispatched by a <code>calculation_method</code> string stored in <code>metric_definitions</code>, decoupled from any specific analytics technology; output is plain JSON consumed by both a web view and a JSON API.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-35.1 Telemetry derived automatically from state/Events<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/metricRegistryEngine.ts:48-175</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All 9 live metrics compute automatically from stored data on each request; §9's "no manual engineering reporting" is consistent with this.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-35.2 Historical telemetry remains available<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(same as ET-005 row)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same gap as ET-005: available only as a byproduct of retained raw rows, not a maintained historical series.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-35.3 Telemetry supports real-time and historical analysis<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/api/telemetry.ts:11-26<br>src/routes/seu/web/telemetry.ts:23-61</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real-time (on-request) computation is live via both routes. Historical analysis (trend-over-time view) has no implementation — no time-bucketed or time-series query exists anywhere in the metric registry.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-35.4 Telemetry supports custom metrics contributed through Packs<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/metric_definitions_schema_recovery.sql:1-32<br>src/domain/engine/metricRegistryEngine.ts:177-206<br>src/dblayer/recovery/metric_definitions_schema_recovery.sql:16 (<code>originating_pack_id UUID REFERENCES packs(id)</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Pack can declare a <code>metric_definitions</code> row (with <code>originating_pack_id</code>) naming an existing <code>calculation_method</code>, the same shape <code>qualityGateEngine</code> uses for <code>criteria.type</code> — no code change needed to add a metric that reuses an existing computation. A genuinely new aggregation/computation still requires a new TypeScript function registered in <code>CALCULATION_METHODS</code> (metricRegistryEngine.ts:177-187) — a Pack cannot supply a wholly new computation without a code change. All 9 seeded rows in <code>metricDefinitions.json</code> have no <code>originating_pack_id</code> populated, so Pack-contributed custom metrics are architecturally possible but not exercised by any existing Pack.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-35.5 Telemetry preserves engineering traceability<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/telemetry.ts:1-8 (comments only)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Telemetry reads from <code>events</code>/other source tables that themselves carry <code>originatingObjectId</code>/<code>correlationId</code>, so the underlying traceability chain exists at the source-data layer. But no returned metric value carries its own calculation version/provenance (see §14 row below) — traceability is implicit in the source rows, not surfaced by Telemetry itself.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-35.6 Telemetry calculations shall be reproducible<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/metricRegistryEngine.ts:48-175</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same evidence as ET-004; pure functions over DB state.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-35.7 Telemetry supports cross-SEU analysis<br> Ref: §6, §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/telemetry.ts:75-138 (optional <code>seuId</code> only)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every metric accepts an optional single <code>seuId</code> (platform-wide pooling when omitted) but there is no query or view that compares multiple specific SEUs against each other side by side. Per-SEU numbers exist; a cross-SEU comparison view does not.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-35.8 Telemetry raises an Organisational Learning Obligation on a sustained pattern affecting a Capability, Service, or Policy<br> Ref: §6, §11, Ch.23 §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/telemetry.ts:254-278 (Quality Gate)<br>src/routes/seu/core/telemetry.ts:289-312 (Policy waiver)<br>src/routes/seu/core/telemetry.ts:329-354 (Capability shortage)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Three of the chapter's four named bottleneck types raise a real Organisational Learning Obligation + Escalation Attention Item via the shared <code>raiseSustainedPatternObligation</code> helper, deduplicated by a marker substring: Quality Gate blocked ≥3 times in an SEU, a Standard Policy waived ≥3 times in an SEU, and a Capability unfulfilled across ≥3 SEUs (platform-wide dedup). The fourth named example — "the same architectural Decision independently reached across many Deliverables" — has no detection logic anywhere in the codebase (no matcher comparing Decision content across Deliverable rows). Service chronically missing its declared Service Level is also not detected (see §11 row below).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§7 Flow Telemetry — Deliverable throughput<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No calculation method or query computes a deliverable-per-unit-time throughput figure anywhere in <code>metricRegistryEngine.ts</code> or <code>deliverablesDB.ts</code>. Only cycle time is implemented.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§7 Flow Telemetry — Deliverable cycle time<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/metricRegistryEngine.ts:48-53<br>src/dblayer/deliverablesDB.ts:82-98<br>src/dblayer/recovery/metric_definitions_schema_recovery.sql:18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>deliverableCycleTime</code> reads <code>deliverablesDB.findCycleTimes(seuId)</code>, derived from <code>events</code> (<code>DeliverableTransitioned</code> rows per the plan's own comment), averaged. Registered as <code>metric_definitions</code> row <code>deliverable-cycle-time</code>, dispatched through <code>metricRegistryEngine.compute</code>, surfaced via <code>getFlowMetrics</code> (core/telemetry.ts:75-77) and both routes.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§7 Flow Telemetry — State transition latency<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found as a distinct metric)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Quality Gate latency (Governance) and dispatch latency (Runtime) exist as specific transition-latency measures, but no generic "state transition latency" metric covering arbitrary entity-type transitions exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§7 Flow Telemetry — Dependency wait time<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No calculation method reads Dependency Engine wait/blocked duration. Not implemented.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§7 Governance Telemetry — Review turnaround<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No <code>Review</code> entity exists in <code>TransitionEntityType</code> (confirmed absent from seuTypes.ts); the plan's own gap analysis names this explicitly as blocked on a Review entity that doesn't exist.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§7 Governance Telemetry — Quality Gate latency<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/metricRegistryEngine.ts:57-76<br>src/dblayer/qualityGateEvaluationsDB.ts (findLatencies)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>qualityGateLatency</code> reads <code>qualityGateEvaluationsDB.findLatencies(scope.seuId)</code>, aggregates per-gate average latency and sample count, registered as <code>quality-gate-latency</code>, surfaced via <code>getGovernanceMetrics</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§7 Governance Telemetry — Approval latency<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No metric distinct from Quality Gate latency measures generic approval-step latency. Not implemented.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§7 Governance Telemetry — Obligation closure time<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No calculation method reads <code>obligations</code> row open/close timestamps to compute closure time. Not implemented.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§7 Governance Telemetry — Policy compliance rate / Standard adherence rate, tracked as distinct metrics<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/transitionEngine.ts:134,172 (StandardPolicyDeviation published, not aggregated into a rate)<br>src/routes/seu/core/telemetry.ts:289-312 (count-based waiver check only)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A per-Policy waiver *count* feeds sustained-pattern detection, but no metric computes a compliance/adherence *rate* (e.g. violations ÷ evaluations) for either Constraint Type, and no <code>metric_definitions</code> row exists for either. The distinction the chapter requires between Policy (blocking) compliance and Standard (non-blocking) adherence is not represented as two measured rates anywhere.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§7 Knowledge Telemetry — Knowledge growth<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/metricRegistryEngine.ts:123-128<br>src/dblayer/knowledgeItemsDB.ts (countByAcquisitionScope)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>knowledgeGrowth</code> counts Knowledge Items by Acquisition Scope, registered as <code>knowledge-growth</code>, surfaced via <code>getKnowledgeMetrics</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§7 Knowledge Telemetry — Evidence generation<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/metricRegistryEngine.ts:135-138<br>src/dblayer/evidenceDB.ts (count)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>evidenceGeneration</code> is a plain count of Evidence rows, registered as <code>evidence-generation</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§7 Knowledge Telemetry — Decision reuse<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>decisions</code> rows carry a single <code>deliverable_id</code> each with no field or query grouping the same decision content across multiple Deliverables; no matcher exists. Confirmed no calculation method references <code>decisions</code> at all.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§7 Knowledge Telemetry — Ontology expansion<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No calculation method reads any Ontology table. Ch.18's own migration comment marks Ontology deliberately out of scope for this model, so there is no entity to measure.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§7 Runtime Telemetry — Command generation rate<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/metricRegistryEngine.ts:84-87<br>src/dblayer/runtimeTelemetryDB.ts (countCommandsGenerated)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented as a total count of Commands generated, not a true time-bucketed rate. Registered as <code>command-generation-rate</code>. Deviation: the metric's unit/strategy (<code>Count</code>, not a rate per unit time) does not match the spec's "rate" phrasing.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§7 Runtime Telemetry — Dispatch latency<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/metricRegistryEngine.ts:95-100<br>src/dblayer/runtimeTelemetryDB.ts (findDispatchLatencies)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Computed as elapsed time between <code>CommandGenerated</code> and <code>WorkItemDispatched</code> events correlated by <code>correlationId</code>, averaged. Registered as <code>dispatch-latency</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§7 Runtime Telemetry — Work Item execution duration<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/metricRegistryEngine.ts:108-113<br>src/dblayer/runtimeTelemetryDB.ts (findWorkItemDurations)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Computed as elapsed time between <code>WorkItemStarted</code> and <code>WorkItemCompleted</code> per Work Item, averaged. Registered as <code>work-item-duration</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§7 Runtime Telemetry — Participant utilisation<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No calculation method computes per-Participant utilisation. Capability Fulfilment is 1:1 today (single eligible Participant per Capability), so there is no comparative load to measure; this is a real functional gap against the chapter text, not merely an oversight.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§7 Quality Telemetry — Rework rate<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/metricRegistryEngine.ts:149-157<br>src/dblayer/qualityGateEvaluationsDB.ts (findReworkByEntity)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>reworkRate</code> computes, per entity that eventually passed a gate, whether/how many Blocked evaluations preceded the Pass; rate is <code>entitiesNeedingRework / totalEntitiesMeasured</code>. Registered as <code>rework-rate</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§7 Quality Telemetry — Defect escape rate<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No <code>Review</code> entity and no governed backward Deliverable transition exist to represent a defect "escaping" and later being caught. Not implemented.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§7 Quality Telemetry — Deliverable acceptance rate<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/metricRegistryEngine.ts:169-175<br>src/dblayer/deliverablesDB.ts:110-120 (findLifecycleStateDistribution)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Computed as the share of Deliverables with <code>lifecycle_state = 'Baselined'</code> against the full distribution. Deviation: Deliverable has no Archived/rejected terminal state, so this is not "accepted vs. rejected," only "reached Baselined vs. everything else" — a narrower measure than the spec's plain "acceptance rate" might imply, though a reasonable derivation given the available lifecycle. Registered as <code>deliverable-acceptance-rate</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§7 Quality Telemetry — Review effectiveness<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same blocker as Review turnaround / defect escape rate: no Review entity exists. Not implemented.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§7 Collaboration Telemetry — Cross-capability interactions, Knowledge sharing, Decision dependencies, Review participation<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No calculation method, <code>metric_definitions</code> row, or query addresses any Collaboration Telemetry example. Entire category is unbuilt, consistent with its explicitly lowest-priority status in the plan.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§7 "Additional categories may be contributed through Packs"<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/metric_definitions_schema_recovery.sql:5 (<code>category</code> CHECK constraint: Flow/Governance/Runtime/Knowledge/Quality/Collaboration)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The <code>category</code> column is a fixed CHECK-constrained enum of exactly the six categories the chapter itself names. A Pack cannot introduce a genuinely new category without a migration altering the CHECK constraint — contradicts the chapter's framing of categories as open-ended via Packs.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§8 Telemetry Structure — Identifier, Name, Description, Category, Unit of Measure, Version<br> Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/metric_definitions_schema_recovery.sql:3-15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>metric_definitions</code> carries <code>identifier</code>, <code>name</code>, <code>description</code>, <code>category</code>, <code>unit_of_measure</code>, <code>version</code> columns exactly as named.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§8 Telemetry Structure — Measurement Method<br> Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/metric_definitions_schema_recovery.sql:10 (<code>calculation_method</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Present as <code>calculation_method</code>, a code naming a hardcoded TS evaluator function — semantically equivalent to "Measurement Method," differently named.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§8 Telemetry Structure — Aggregation Strategy<br> Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/metric_definitions_schema_recovery.sql:7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Present as <code>aggregation_strategy</code>, CHECK-constrained to Average/Count/Rate/Distribution.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§8 Telemetry Structure — Time Window<br> Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/metric_definitions_schema_recovery.sql:1-20</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No <code>time_window</code> column or equivalent field exists anywhere in <code>metric_definitions</code>. Every metric is computed over the entire unbounded history of the underlying table (all-time), with no way to declare or request a bounded window.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§8 Telemetry Structure — Provenance<br> Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/metric_definitions_schema_recovery.sql:16-18 (<code>originating_pack_id</code>, <code>author_id</code>, <code>author_badge</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Partial: the *definition's* provenance (which Pack/author declared the metric) is captured. But provenance of a *computed value* — which source events/rows contributed to a given result — is not captured anywhere (same gap as §14 below).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§8 "Metric definitions are declarative"<br> Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/metricRegistryEngine.ts:177-187, 194-206</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Confirmed: <code>metric_definitions</code> rows are pure metadata; the executable part (<code>CALCULATION_METHODS</code>) is code, matched to the chapter's own allowance that measurement mechanics are implementation-defined while the definition itself is a declarative row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§9 Metric Sources — State transitions, Events, Deliverables, Services, Reviews, Decisions, Knowledge, Evidence, Obligations, Runtime services<br> Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/metricRegistryEngine.ts:48-175</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Of the ten named sources, five are actually read by a live metric (state transitions/Events via <code>events</code> table, Deliverables, Knowledge, Evidence, runtime services). Services, Reviews, Decisions, and Obligations are not read by any calculation method — Obligations only ever receive writes (§11's exception), never contribute a metric value themselves.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§9 Services contribute declared Service Level and delivery events on the same footing as other sources<br> Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No calculation method reads <code>services.service_level</code> or any Service delivery event. Confirmed via <code>grep</code> that no file under <code>src/domain/engine/metricRegistryEngine.ts</code> or <code>core/telemetry.ts</code> references a Service table. This is a documented gap: the plan itself names Service SLA breach detection as blocked on an undefined notion of "meeting the declared service_level."</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§9 "No manual engineering reporting shall be required"<br> Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/metricRegistryEngine.ts:48-175</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every live metric is fully automated from existing tables; no UI form or write path for manually entering a telemetry value exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§10 Engineering Health — Flow/Governance/Knowledge/Runtime/Collaboration/Delivery Health<br> Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No calculation method, service, or route computes a composite health score for any dimension. Confirmed absent from <code>metricRegistryEngine.ts</code>, <code>core/telemetry.ts</code>, and both routes.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§11 Bottleneck Analysis — identification of blocked Deliverables, governance delays, dependency congestion, review queues, unresolved Obligations, capability shortages<br> Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/telemetry.ts:254-278 (Quality Gate blocking)<br>src/routes/seu/core/telemetry.ts:329-354 (capability shortage)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Of the six illustrative bottleneck types, two are detected (recurring Quality-Gate blocking as a proxy for "blocked Deliverables"/"governance delays," and capability shortage). Dependency congestion, excessive review queues, and unresolved-Obligation accumulation have no detection logic.</td>
    </tr>
| §11 Sustained pattern raises an Organisational Learning Obligation; transient/one-off left to engineering judgement | §11 | src/routes/seu/core/telemetry.ts:179-246 (`raiseSustainedPatternObligation`) | The shared helper deduplicates on a marker substring so a repeat detection of the same already-raised pattern does not re-raise; below-threshold occurrences are left unflagged (`if (!blockedCount || blockedCount < SUSTAINED_BLOCK_THRESHOLD) return { raised: false }` at telemetry.ts:261), matching the "transient is left to judgement" requirement for the three implemented pattern types. | Fully met |
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§11 Telemetry does not decide the fix, only that a pattern warrants an Obligation<br> Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/telemetry.ts:272,303,345 (description text explicitly states "Telemetry does not decide...")</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each of the three raised Obligations' description text explicitly defers the remediation judgement to engineering review; no code path auto-resolves or auto-fixes the underlying Capability/Service/Policy.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§11 "What counts as sustained... is a Pack-contributed policy, not fixed by this chapter"<br> Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/telemetry.ts:147 (<code>SUSTAINED_BLOCK_THRESHOLD = 3</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The threshold is a hardcoded TypeScript constant shared across all three pattern types, not a Pack-contributed or otherwise configurable Policy value. The code's own comment (telemetry.ts:140-146) names this gap and attributes it to Policy not yet having a general config-carrying role. Direct contradiction of the chapter's explicit requirement.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§11 bottleneck (a): same Decision independently reached across many Deliverables<br> Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No matcher compares decision content across Deliverable rows; <code>decisions.deliverable_id</code> is singular per row with no cross-row grouping logic anywhere in the codebase.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§11 bottleneck (b): Service chronically missing its declared Service Level<br> Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No read path measures actual Service delivery performance against <code>services.service_level</code>, and no definition exists of what "breach" means for an arbitrary declared target. Confirmed absent from every telemetry/metric file searched.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§11 bottleneck (c): Policy repeatedly waived<br> Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/transitionEngine.ts:134,172 (publishes <code>StandardPolicyDeviation</code>)<br>src/dblayer/eventsDB.ts:235-246 (<code>countStandardPolicyDeviations</code>)<br>src/routes/seu/core/telemetry.ts:289-312 (<code>checkSustainedPolicyWaivers</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Standard Policy's discarded "not satisfied but non-blocking" evaluation result is now published as an event and counted per Policy+SEU; ≥3 waivers in one SEU raises the Obligation via the shared helper.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§11 bottleneck (d): capability shortage recurring across multiple SEUs<br> Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuCapabilitiesDB.ts (findUnfulfilledByCapability)<br>src/routes/seu/core/telemetry.ts:329-354</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Capability unfulfilled (<code>status = 'Unfulfilled'</code>) across ≥3 SEUs raises one Obligation, attached to a "most recently affected" representative SEU because <code>obligations.seu_id</code> is <code>NOT NULL</code> and the pattern itself is genuinely cross-SEU. Deviation/known limitation documented in the code itself (telemetry.ts:163-178): if the representative SEU shifts between two checks, a duplicate Obligation for the same underlying shortage can be raised under a different representative SEU — no platform-wide dedup registry prevents this; dedup here only catches the *same* representative reappearing, via <code>dedupScope: "platform"</code> matching on the capability id embedded in the marker, which does correctly prevent most repeats but not every case the code's own comment names.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§12 Predictive Telemetry — projected delivery completion, governance backlog growth, review capacity shortages, dependency risk, engineering congestion<br> Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No predictive model, forecast, or trend-projection logic exists anywhere in the repository for any of the five named examples.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§13 Cross-SEU Analytics — throughput/governance efficiency/knowledge reuse/review effectiveness/delivery predictability comparison across SEUs<br> Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/web/telemetry.ts:25,32,53-54 (single <code>seuId</code> filter + SEU picker)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The web dashboard lets a user pick one SEU at a time (or platform-wide) via a dropdown; there is no side-by-side multi-SEU comparison table or chart. Per-SEU numbers exist for Flow/Governance/Runtime/Knowledge/Quality, but none of the five specifically named comparison examples (review effectiveness, knowledge reuse, delivery predictability especially) have an underlying metric built at all, so even a future comparison view would have nothing to compare for those three.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❓</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§13 "Comparisons shall preserve organisational isolation where required"<br> Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(not verifiable — no comparison feature exists)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Since no actual cross-SEU comparison view exists, there is nothing to evaluate for tenant/organisational isolation in that context. Tenancy scoping on the underlying per-SEU queries themselves was not re-verified here as it is outside this chapter's own intent (covered by the platform's general tenancy middleware).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§14 Telemetry Traceability — originating engineering objects, contributing Events, aggregation rules, calculation version, timestamp preserved per metric<br> Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/metricRegistryEngine.ts:194-228 (publishes <code>MetricCalculated</code> with <code>identifier</code>/<code>category</code>/<code>seuId</code> only)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The <code>MetricCalculated</code> event payload carries only <code>identifier</code>, <code>category</code>, and <code>seuId</code> — no list of originating object ids, no contributing Event ids, no calculation version, and no distinct timestamp beyond the event's own. A displayed metric value cannot be traced back to the exact set of rows/events that produced it.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§14 "Telemetry shall remain explainable"<br> Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/metricRegistryEngine.ts:48-175</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each calculation method's logic is simple and readable in source, satisfying "explainable" only in the sense that the computation is auditable by reading code — not in the sense of a returned, user-facing explanation of what fed a given number.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§15 Events — MetricCalculated<br> Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/metricRegistryEngine.ts:216-225</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Published on every <code>metricRegistryEngine.compute</code> call, carrying <code>identifier</code>/<code>category</code>/<code>seuId</code>, attributed to a real superuser actor+badge (no silent fallback).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§15 Events — HealthAssessmentUpdated<br> Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Not published anywhere; no Engineering Health assessment exists (§10 gap), so there is nothing to emit this for yet.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§15 Events — BottleneckDetected<br> Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Not published anywhere. The implemented bottleneck-adjacent logic instead publishes <code>SustainedPatternDetected</code> (a related but narrower concept — only the sustained case, not every detected bottleneck instance).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§15 Events — TrendIdentified<br> Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Not published anywhere; no trend-analysis logic exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§15 Events — ThresholdExceeded<br> Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Not published anywhere, despite threshold logic (<code>SUSTAINED_BLOCK_THRESHOLD</code>) existing internally — crossing that threshold triggers <code>SustainedPatternDetected</code> directly, with no separate generic <code>ThresholdExceeded</code> event.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§15 Events — SustainedPatternDetected<br> Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/telemetry.ts:219-228</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Published by <code>raiseSustainedPatternObligation</code>, the shared helper backing all three implemented pattern types, carrying <code>obligationId</code> plus pattern-specific payload fields.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§15 Events — TelemetrySnapshotGenerated<br> Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Not published anywhere; no snapshot mechanism exists (consistent with the ET-005/FR-35.2 gap above — there is no persisted "snapshot" concept at all).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§16 NFR — near real-time analysis<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/api/telemetry.ts:11-26<br>src/routes/seu/web/telemetry.ts:23-61</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Both routes compute metrics synchronously on each request against live DB state; there is no caching/staleness window, so results are as real-time as the underlying data.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§16 NFR — preserve historical trends<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(same as ET-005)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same gap: no dedicated historical-trend storage; relies on raw rows never being pruned.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§16 NFR — support extensible metrics<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/metric_definitions_schema_recovery.sql:1-32<br>src/domain/engine/metricRegistryEngine.ts:177-187</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">New metrics reusing an existing <code>calculation_method</code> need only a new <code>metric_definitions</code> row (no code change); a genuinely new computation needs a new function registered in <code>CALCULATION_METHODS</code>. Extensible for the metadata layer, not for wholly new computation logic.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§16 NFR — remain reproducible<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/metricRegistryEngine.ts:48-175</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same evidence as ET-004.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§16 NFR — remain independent of analytics technologies<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/api/telemetry.ts, src/routes/seu/web/telemetry.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Metric values are returned as plain JSON/view-model data with no coupling to any specific analytics/BI product.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§17 AC — Metrics are automatically derived<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/metricRegistryEngine.ts:48-175</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Confirmed, same evidence as FR-35.1.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§17 AC — Telemetry measures engineering systems rather than individuals<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/metricRegistryEngine.ts:21-175</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Confirmed, same evidence as ET-003.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§17 AC — Engineering health is continuously assessed<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No health-assessment logic exists anywhere (§10 gap).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§17 AC — Bottlenecks can be identified<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/telemetry.ts:254-354</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Partially true: 3 of 6 illustrative bottleneck types (and the "same Decision reused," Service SLA breach, dependency congestion, review-queue types remain undetected) are identified; the acceptance criterion as stated is not qualified to "some," so it is only partly satisfied.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§17 AC — Metrics are traceable and reproducible<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/metricRegistryEngine.ts:216-225</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Reproducible: yes (same evidence as ET-004). Traceable: only to <code>identifier</code>/<code>category</code>/<code>seuId</code>, not to the originating rows/events (same gap as §14).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§17 AC — Custom metrics can be introduced through Packs<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/metric_definitions_schema_recovery.sql:16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Architecturally possible (schema supports <code>originating_pack_id</code>, dispatch is metadata-driven) but not exercised by any existing Pack in the seed data, and limited to reusing an existing <code>calculation_method</code> — same caveat as FR-35.4.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§17 AC — Sustained patterns raise an Organisational Learning Obligation rather than being left for judgement each time<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/telemetry.ts:179-354</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">True for 3 of the 4 named pattern types (Quality Gate, Policy waiver, Capability shortage); Decision-reuse pattern and Service SLA breach are not detected at all.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§18 Deliverables — Engineering Telemetry Engine<br> Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/metricRegistryEngine.ts (whole file)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Exists as <code>metricRegistryEngine</code>, dispatching calculation methods by identifier.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§18 Deliverables — Metric registry<br> Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/metric_definitions_schema_recovery.sql (whole file)<br>src/dblayer/metricDefinitionsDB.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Exists as the <code>metric_definitions</code> table plus its DB-layer access functions.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§18 Deliverables — Metric calculation service<br> Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/metricRegistryEngine.ts:48-175</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The 9 calculation-method functions collectively serve this role.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§18 Deliverables — Health assessment service<br> Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Does not exist (§10 gap).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§18 Deliverables — Analytics interfaces<br> Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/web/telemetry.ts<br>src/views/seu/telemetry/index.ejs</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The web dashboard with per-category sections and an SEU picker is the analytics interface built. No deeper analytics (trend charts, comparisons, predictive views) exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§18 Deliverables — Telemetry APIs<br> Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/api/telemetry.ts:11-26</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>GET /telemetry?seuId=</code> returns Flow/Governance/Runtime/Knowledge/Quality metrics as JSON.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§18 Deliverables — Telemetry events<br> Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/metricRegistryEngine.ts:216-225<br>src/routes/seu/core/telemetry.ts:219-228</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">2 of the 7 named events (§15) are implemented (<code>MetricCalculated</code>, <code>SustainedPatternDetected</code>); the other 5 do not exist.</td>
    </tr>
  </tbody>
</table>
## Summary

- Total intents analysed: 66
- Fully met: 24
- Partially met: 22
- Not met: 19
- Not Verifiable: 1

## Major implementation gaps

- Only 2 of 6 Telemetry Categories (§7) have full coverage (Flow, Governance partially — only cycle time/gate latency exist, not throughput/review turnaround/approval latency/obligation closure/policy-compliance-vs-standard-adherence rates). Knowledge and Quality are partially covered; Runtime is partially covered (participant utilisation missing); Collaboration Telemetry is entirely unbuilt.
- Metric Registry (§8) exists as a declarative row + hardcoded dispatch, matching the chapter's declarative-definition intent, but has no `Time Window` field, and "custom metrics through Packs" (FR-35.4) is limited to reusing an existing calculation method — a Pack cannot contribute a genuinely new computation without a code change.
- Sustained-pattern detection (§11, FR-35.8) covers 3 of 4 named bottleneck types (Quality Gate blocking, Policy waiver, Capability shortage) but not "same Decision reached independently across Deliverables" or "Service chronically missing its declared Service Level." The "sustained" threshold is a hardcoded constant, not the Pack-contributed policy §11 explicitly requires.
- Historical trend preservation (ET-005, FR-35.2, §16) is not actually implemented as a mechanism — it is an incidental byproduct of raw source rows never being pruned, with no snapshot/time-series storage.
- Engineering Health (§10) and Predictive Telemetry (§12) are entirely unbuilt.
- Cross-SEU Analytics (§13) has only single-SEU filtering, no multi-SEU comparison view, and several of its named comparison dimensions (knowledge reuse, review effectiveness, delivery predictability) have no underlying metric at all.
- Telemetry Traceability (§14) and most of the Events list (§15) are thin: only `MetricCalculated` and `SustainedPatternDetected` of the 7 named events exist; calculation version/provenance of a computed value is not captured.
- The `category` column's CHECK constraint fixes the six categories named in the chapter, which contradicts §7's statement that "additional categories may be contributed through Packs" without a migration.
