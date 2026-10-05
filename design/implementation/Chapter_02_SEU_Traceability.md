# Chapter 2 — Software Engineering Unit (SEU) — Implementation Traceability

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SEU is the primary execution entity, commissioned to achieve Objective(s); required Capabilities derive from the Objective(s)<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/seus_schema_recovery.sql:5<br>src/routes/seu/core/commissioning.ts:176</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>seus.objective_id</code> is a real <code>NOT NULL</code> FK. Capability derivation at commissioning time actually reads the Template's own Deliverable Catalogue producing-capability references (<code>templates.ts</code>'s <code>getRequiredCapabilities</code>), not the Objective directly — an indirect derivation chain (Objective → Template → Capabilities), not a direct one.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SEU is an executable runtime entity whose behaviour is determined by a composed EBM<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/seus_schema_recovery.sql:8<br>src/routes/seu/core/commissioning.ts:139-168</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>active_ebm_id</code> set once during commissioning, after <code>compose()</code> runs. Real.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SEU supports AI, human, and external-system participants<br> Ref: §1 Purpose, FR-2.5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/participants_schema_recovery.sql (type CHECK)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>participants.type CHECK IN ('AI','Human','External')</code> — real, enforced at the DB.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SEU preserves knowledge, governance, traceability independently of participants<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/knowledge_items_schema_recovery.sql</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>knowledge_items.seu_id</code> carries no <code>participant_id</code> coupling; no cascade exists from a Participant row to knowledge/evidence/deliverables. Participant replacement cannot invalidate these by construction, not by an explicit guard.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SEU shall not interact directly with Packs; all engineering behaviour inherited through the EBM<br> Ref: §3 Architectural Position</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts (active_ebm_id only)<br>no <code>pack_id</code>/<code>packs</code> FK on <code>seus</code> table</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>seus</code> table has no direct Pack reference. Runtime consumers (governance, compliance, dependency engine) reach Pack-contributed behaviour only via <code>seu.active_ebm_id → ebms.composed_packs</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SEU responsibilities: execute work, maintain governance, coordinate participants, maintain dependency graphs, manage obligations, preserve knowledge, maintain traceability, report state<br> Ref: §4 Responsibilities</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dispatchEngine.ts<br>src/routes/seu/core/obligations.ts<br>src/domain/engine/dependencyDefinitionEngine.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each responsibility maps to a real, separately-owned subsystem (Dependency Engine, Obligation lifecycle, Knowledge, Events) rather than SEU-owned logic — consistent with the chapter's own framing that these are "elaborated in later chapters."</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SEU not responsible for: composing practices, loading Packs, authenticating users, infrastructure management<br> Ref: §4 Responsibilities</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/seus.ts (no auth/composition/pack-load logic)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Confirmed by absence — none of these concerns appear in the SEU route/core layer.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-2.1 — platform permits authorised users to commission an SEU<br> Ref: §5 FR-2.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts (commission entry point, governed transition)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real, badge-gated via <code>transitionEngine.evaluate</code> / <code>badgeAuthorityEngine.authorise</code> (CR-006).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-2.2 — every SEU executes against exactly one EBM<br> Ref: §5 FR-2.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/seus_schema_recovery.sql:8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>active_ebm_id</code> is a single nullable UUID column, singular by construction.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-2.3 — an EBM shall exist before an SEU is commissioned<br> Ref: §5 FR-2.3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:139-168</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Strict order: <code>compose()</code> → <code>ebmsDB.create</code> → <code>Pending→Commissioned</code> transition.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-2.4 — every runtime object belongs to exactly one active SEU<br> Ref: §5 FR-2.4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/deliverables_schema_recovery.sql<br>src/dblayer/recovery/obligations_schema_recovery.sql:5<br>src/dblayer/recovery/knowledge_items_schema_recovery.sql</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>seu_id</code> is <code>NOT NULL</code> and a singular FK on <code>obligations</code>, <code>deliverables</code>, <code>knowledge_items</code>, and other runtime tables inspected.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-2.5 — human, AI, external-system participants<br> Ref: §5 FR-2.5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/participants_schema_recovery.sql</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same evidence as §1 row above.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-2.6 — SEU shall maintain complete engineering traceability<br> Ref: §5 FR-2.6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/events_schema_recovery.sql (if present)<br>eventBus.publish call sites across src/domain/engine/, src/routes/seu/core/</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Traceability exists as a side effect of the generic <code>events</code> table and FK trails, not as a dedicated traceability service or entity. The chapter states this as a first-class SEU responsibility; the implementation treats it as emergent.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-2.7 — knowledge preserved independently of participant lifecycle<br> Ref: §5 FR-2.7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/knowledge_items_schema_recovery.sql</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same evidence as §1 row above.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-2.8 — SEU exposes runtime state through published services<br> Ref: §5 FR-2.8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/api/seus.ts:1-113</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Ordinary HTTP CRUD read routes exist (list/detail). No distinct "published service" contract beyond standard REST reads — the spec's "published services" language implies more than what is built.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-2.9 — SEU maintains dependency relationships between deliverables<br> Ref: §5 FR-2.9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/dependency_definitions_schema_recovery.sql:3<br>src/domain/engine/dependencyDefinitionEngine.ts:1-223</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real, dedicated <code>dependency_definitions</code> table and engine, actively exercised.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-2.10 — execution occurs only when dependency conditions are satisfied<br> Ref: §5 FR-2.10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dispatchEngine.ts:1-232<br>src/domain/engine/dependencyDefinitionEngine.ts:211</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>dispatchEngine.ts</code> gates Work Item dispatch on <code>dependencyDefinitionEngine</code>'s readiness evaluation before publishing <code>WorkItemDispatched</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-2.11 — SEU manages engineering obligations<br> Ref: §5 FR-2.11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/obligations_schema_recovery.sql:1-30<br>src/routes/seu/core/obligations.ts:120,505</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>obligations</code> table now carries <code>priority</code>, <code>assigned_entity_type/id</code> (owner), <code>completion_criteria</code>, <code>blocked_from_state</code>/<code>blocked_to_state</code> (blocking conditions) — all real columns. This is materially more complete than the chapter's own earlier §19.11 claim that owner/priority/blocking-conditions were absent; that claim is stale against the current schema. "Required evidence" as a named, dedicated field is still not present.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-2.12 — SEU preserves a complete audit history<br> Ref: §5 FR-2.12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">same evidence as FR-2.6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same basis as FR-2.6 — real via <code>events</code>, not a dedicated audit-history service.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SEU lifecycle: Requested → Engineering Behavior Composition → Commissioned → Executing → Monitoring → Completing → Knowledge Preservation → Archived<br> Ref: §6 SEU Lifecycle</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/seus_schema_recovery.sql:9,18-20<br>src/dblayer/seusDB.ts:16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real <code>lifecycle_state CHECK</code> enforces 9 states: <code>Pending, Commissioned, Configured, Activated, Operational, Suspended, Retired, Archived, Failed</code> — one more state (<code>Failed</code>) than the chapter's implied closed set, and a different shape entirely. Only <code>Commissioned</code> and <code>Archived</code> match the chapter's own names exactly. The chapter's 8 stages are work-progress-oriented (Executing/Monitoring/Completing); the real graph is infrastructure-readiness-oriented (Configured/Activated/Operational/Suspended), plus an unnamed <code>Failed</code> terminal state the chapter never anticipates. "Engineering Behavior Composition" is not a persisted state — composition happens synchronously inside the <code>Pending→Commissioned</code> transition (src/routes/seu/core/commissioning.ts:139-168), never independently observable.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SEU-Objective relationship is 1:1 (commissioning uniqueness)<br> Ref: §6 (Requested stage), cross-referenced from Ch.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/seus_schema_recovery.sql:21-23</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The constraint is now <code>idx_seus_objective_id_active_unique</code>, a **partial** unique index scoped to <code>lifecycle_state IN ('Pending','Commissioned','Configured','Activated','Operational','Suspended')</code> — not a plain, permanent <code>UNIQUE(objective_id)</code>. An Objective can be re-commissioned into a new SEU once its prior SEU reaches <code>Retired</code>, <code>Archived</code>, or <code>Failed</code>. This directly contradicts the chapter's own earlier §19 preamble claim ("a real, enforced UNIQUE constraint... confirmed at the strongest possible level") — that claim was true of a since-dropped index (<code>idx_seus_objective_id_unique</code>, explicitly <code>DROP INDEX</code>-ed in the same recovery file) and is stale against the current schema. The 1:1 guarantee now holds only among *active* SEUs per Objective, not permanently.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SEU composition: Objectives, Participants, Capabilities, Services, Roles, Deliverables, Work Items, Dependency Graph, Knowledge, Evidence, Governance, Obligations, Traceability, Metrics, Runtime State<br> Ref: §7 SEU Composition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/{deliverables,work_items,knowledge_items,evidence,obligations,dependency_definitions}_schema_recovery.sql</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">13 of 15 named components have a real, directly corresponding table/entity. <code>Roles</code> has no table or entity anywhere in the schema recovery set — confirmed by absence (no <code>roles</code>/<code>CREATE TABLE.*role</code> match). <code>Traceability</code> and <code>Runtime State</code> are real only in an emergent sense (via <code>events</code> and <code>seus.lifecycle_state</code> respectively), not as dedicated entities.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Execution is dependency-driven, not elapsed-time-driven; Runtime Kernel executes only work items declared ready<br> Ref: §8 Execution Model</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dispatchEngine.ts<br>src/domain/engine/dependencyDefinitionEngine.ts:211</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same evidence as FR-2.10. No polling/timer-based readiness check found in the dispatch path.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SEU inherits all engineering behaviour from its EBM; SEU shall not modify the EBM directly; changes require recomposition<br> Ref: §9 Engineering Behavior Model</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts (no EBM-mutation path from SEU side)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No SEU-side EBM-update path exists, satisfying the "shall not modify" clause trivially. "Changes require recomposition by the Composition Engine" is aspirational — no code path triggers automatic recomposition on any EBM-affecting change; this is a pre-existing, separately-documented gap in the Composition Engine chapter, inherited here by reference.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants execute capabilities within assigned roles; participants are replaceable without invalidating knowledge/traceability/completed work<br> Ref: §10 Participants</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/participants_schema_recovery.sql</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Replaceability-without-invalidation holds by the same FK-absence argument as FR-2.7. The "within assigned roles" clause cannot be fully evaluated — no <code>Role</code> entity exists (§7 finding), so "roles" here is necessarily informal/attribute-based, not a modeled relationship.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❓</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Deliverable defines dependencies, producing capabilities, required evidence, acceptance criteria, completion status<br> Ref: §11 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/deliverables_schema_recovery.sql</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable's own required fields are a mix of real columns and Dependency-Engine-derived relationships; this chapter's own governing chapter (Deliverable Model) owns the field-by-field verification and was not re-derived here.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Work Items exist solely to produce/modify Deliverables; every Work Item references one or more Deliverables; Work Items shall not exist independently of Deliverables<br> Ref: §12 Work Items</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/work_items_schema_recovery.sql</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>work_items</code> carries a required FK to a Deliverable — confirmed directly against this chapter's own claim.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SEU maintains a dependency graph over Deliverables, Decisions, Obligations, Knowledge, Evidence, External dependencies; execution readiness determined exclusively from this graph<br> Ref: §13 Dependency Graph</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:1-223</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real and exercised for Deliverable readiness. Whether Decisions/Obligations/Knowledge/External-dependency edges are all represented in the same graph (vs. handled by separate gates, e.g. the Obligation-blocking Quality Gate mechanism) was not independently re-traced in this pass — the graph's Deliverable-centric path is confirmed; full coverage of all five named edge types is not.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SEU manages engineering obligations from risks, audits, customer observations, compliance, security/architecture reviews, dependency analysis; every obligation has owner, severity, priority, required evidence, blocking conditions, status<br> Ref: §14 Engineering Obligations</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/obligations_schema_recovery.sql:1-30</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>severity</code>, <code>status</code> ✅ original columns. <code>priority</code> ✅ real (<code>ALTER TABLE ... ADD COLUMN priority</code>). <code>assigned_entity_type</code>/<code>assigned_entity_id</code> ✅ real, functions as owner. <code>blocked_from_state</code>/<code>blocked_to_state</code> ✅ real, functions as blocking conditions. <code>origin</code> ✅ real, functions as the obligation-source taxonomy (risks/audits/etc.). "Required evidence" has no dedicated column.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SEU publishes domain events: SEUCommissioned, DeliverableReady, WorkItemStarted, WorkItemCompleted, DependencySatisfied, DependencyBlocked, ObligationRaised, ObligationResolved, KnowledgeAccepted, KnowledgeArchived, SEUArchived<br> Ref: §15 Events</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:392 (<code>step.eventType ?? \</code>SEU${to}\``)<br>src/domain/engine/dependencyDefinitionEngine.ts:211<br>src/domain/engine/dispatchEngine.ts:210<br>src/routes/seu/core/workItems.ts:208<br>src/domain/engine/executionEngine.ts:90<br>src/routes/seu/core/obligations.ts:120<br>src/routes/seu/core/knowledge.ts:81</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>SEUCommissioned</code> is real but dynamically derived — the generic transition handler defaults <code>eventType</code> to <code>SEU${toState}</code>, so <code>Pending→Commissioned</code> yields <code>"SEUCommissioned"</code> unless the transition_definitions row overrides it; not a literal string constant in commissioning.ts. <code>DeliverableReady</code> (not <code>DependencySatisfied</code>), <code>WorkItemDispatched</code> (not <code>WorkItemStarted</code>), <code>DeliverableBlocked</code> (not <code>DependencyBlocked</code>) — same consequence under different names. <code>WorkItemCompleted</code> ✅ exact. <code>ObligationCreated</code> (not <code>ObligationRaised</code>); no <code>ObligationResolved</code> equivalent found (only a generic <code>ObligationTransitioned</code>). <code>KnowledgeObserved</code> exists; no <code>KnowledgeAccepted</code>/<code>KnowledgeArchived</code>. No event publish found for any transition reaching <code>Archived</code> — <code>SEUArchived</code> would only emerge via the same <code>SEU${to}</code> default if/when such a transition is actually invoked and no override exists; no caller in commissioning.ts/seus.ts currently drives a SEU to <code>Archived</code>, so this was not observed as exercised.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Multiple SEUs execute concurrently<br> Ref: §16 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/seus_schema_recovery.sql (per-row FK subtree, no shared mutable state)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No cross-SEU shared mutable state found in the inspected schema/engine files.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SEU execution survives runtime restarts; runtime state recoverable<br> Ref: §16 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/seus_schema_recovery.sql</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All inspected state is DB-persisted (<code>lifecycle_state</code>, <code>commissioning_report</code>, <code>composition_report</code>); no in-memory-only runtime state found in the files inspected.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All engineering decisions remain traceable; all execution externally observable<br> Ref: §16 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">same evidence as FR-2.6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same basis — real via <code>events</code>/HTTP reads, not a dedicated observability service.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SEU remains independent of specific AI providers<br> Ref: §16 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/seus.ts, src/dblayer/recovery/participants_schema_recovery.sql</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No AI-provider-specific coupling found in the SEU/Participant schema or core route files inspected.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: SEU commissioned from EBM; participants assigned/replaced; deliverables drive execution; work items execute only when dependencies satisfied; obligations influence execution; knowledge survives archival; traceability complete<br> Ref: §17 Acceptance Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(aggregate of above rows)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each criterion resolves to the finding already given for its underlying FR/section above; obligation-influence is real via the blocking-conditions columns now present (§14); "knowledge survives archival" has no code path that deletes <code>knowledge_items</code> on archival, but is not separately exercised/tested as a guarantee.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables of this chapter: SEU domain model, lifecycle implementation, aggregate definition, dependency graph interfaces, Deliverable model, Work Item model, runtime services, event definitions, initial API spec<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts (SeuRow)<br>src/routes/seu/core/seus.ts<br>src/domain/engine/dependencyDefinitionEngine.ts<br>src/dblayer/recovery/{deliverables,work_items}_schema_recovery.sql<br>src/routes/seu/api/*.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">7 of 9 named deliverables have a direct, unambiguous artifact. "Runtime services" has no single consolidated service — logic is scattered per-concern across <code>core/*.ts</code>. "Event definitions" are only partially complete per §15's finding (several under different names, several entirely unbuilt).</td>
    </tr>
  </tbody>
</table>
## Summary

- Total intents analysed: 29
- Fully met: 13
- Partially met: 15
- Not met: 0
- Not verifiable: 1

### Major findings

1. **Stale prior audit — objective_id uniqueness.** Chapter 2 §19's own preamble claims a permanent, enforced `UNIQUE(seus.objective_id)`. The current schema recovery file shows that index was explicitly dropped and replaced with `idx_seus_objective_id_active_unique`, a **partial** unique index scoped to active lifecycle states only. An Objective can be re-commissioned into a new SEU after its prior SEU reaches `Retired`/`Archived`/`Failed`. The strict, permanent 1:1 claim in §19 is no longer accurate against the live schema definition.
2. **Stale prior audit — Obligation fields.** §19.11 claims `owner`, `priority`, and `blocking conditions` are absent from `obligations`. The current schema recovery file shows `priority`, `assigned_entity_type/id`, `completion_criteria`, and `blocked_from_state`/`blocked_to_state` all exist as real columns. Only a dedicated "required evidence" field remains absent.
3. **Lifecycle state count.** The real `lifecycle_state` CHECK enforces 9 states (adds `Failed`, not named or anticipated anywhere in the chapter), not 8.
4. **Roles — confirmed absent.** No `Role`/`roles` table or entity exists anywhere in the schema recovery set. This is the one SEU Composition component (§7) with no partial credit.
5. **Event naming drift, unchanged from prior audit.** `DeliverableReady`/`WorkItemDispatched`/`DeliverableBlocked`/`ObligationCreated`/`KnowledgeObserved` are the real equivalents of `DependencySatisfied`/`WorkItemStarted`/`DependencyBlocked`/`ObligationRaised`/`KnowledgeAccepted`. `ObligationResolved`, `KnowledgeArchived`, and `SEUArchived` remain unbuilt as named events; `SEUCommissioned` is real only as a dynamic default (`SEU${toState}`), not a literal constant.
6. **Traceability/audit history (FR-2.6, FR-2.12, NFR) remain emergent, not dedicated.** Consistent with every other chapter's own traceability claim this session — real via the generic `events` table and FK trails, never a first-class traceability service.
