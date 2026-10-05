# Chapter 3 — Engineering Behavior Model (EBM) — Implementation Traceability

**Date of report: 4-10-2026**

Code-verified (2026-10-04). Supersedes the embedded "§19 Implementation Status & Gaps" audit inside the chapter file itself (last updated 2026-09-07) wherever this file's findings differ — the embedded section is now stale on several points (an `ebmComposer.ts` file it names no longer exists under that name; it undercounts real EBM consultation call sites; it reports zero real behavioural content when a real resolved-behaviour pool now exists, migration 182). Do not edit the chapter file; this file is the current source of truth going forward.

Core files verified this pass: `src/dblayer/ebmsDB.ts`, `EbmRow`/`EbmComposedPack`/`EbmCompositionReport`/`EbmStatus` (`src/dblayer/seuTypes.ts:770-845`), `src/domain/engine/compositionCompleted.ts` (the real EBM-creation handler, successor to the chapter's own former `ebmComposer.ts` naming), `src/domain/engine/profileCompositionUnravel.ts`, `src/routes/seu/core/commissioning.ts` (`transitionEbm`), `src/domain/engine/ebmActivated.ts`, `src/dblayer/seed/data/transitionDefinitions.json`, and all 16 real call sites of `ebmsDB.findById`.

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">EBM is the behavioural contract governing a commissioned SEU's operation<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionCompleted.ts:132-160<br>src/dblayer/seuTypes.ts:816-845</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A real <code>ebms</code> row is created per SEU, carrying composed Packs, a resolved behaviour pool, and materialised governance (quality gates/policies). It is set as the SEU's active EBM (<code>seusDB.setActiveEbm</code>).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every commissioned SEU executes against exactly one EBM<br> Ref: §1 Purpose; FR-3.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts (seus.active_ebm_id set once at commissioning)<br>src/dblayer/ebmsDB.ts:42-59</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>seus.active_ebm_id</code> is set exactly once per successful composition; one row, one SEU. Multiple versions per SEU are schema-supported (<code>version</code> column) but never exercised in practice (see Versioning row below).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">EBM governs behaviour, not competence; competence resides with Participants<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participantEligibility.ts:97</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>ebm.behaviors.competencyRequirements</code> (a union of Pack-contributed technology/domain competencies) is read by <code>findEligibleParticipants</code> as a *filter* over Participants' own competence — the EBM states the requirement, Participants carry the competence. Matches the chapter's own division of responsibility.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❓</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Chapter scope: composition, categories, inheritance, constraints, runtime interaction (not Pack composition algorithms/lifecycle/capabilities themselves)<br> Ref: §2 Scope</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">n/a</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Scope statement, not independently testable; covered by the rows below.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">EBM sits between Composition Engine and the SEU; SEU consumes but never modifies it<br> Ref: §3 Architectural Position</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ebmsDB.ts (no <code>update</code>/<code>delete</code> function exists, only <code>create</code>/<code>findById</code>/<code>updateStatus</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No code path lets an SEU or any caller mutate <code>composed_packs</code>/<code>behaviors</code>/<code>composition_report</code> post-creation. <code>updateStatus</code> changes lifecycle status only, not content.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">EBM is produced by composing behavioural contributions from one or more Packs<br> Ref: §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:39-60 (<code>unravelComposition</code>)<br>src/domain/engine/compositionCompleted.ts:102-106</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>unravelComposition</code>'s flat <code>pool</code> (propertyName/value/source per contributed property) is carried onto <code>ebm.behaviors.pool</code> verbatim. Real, Pack-sourced.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">EBM authoritative for SEU lifetime unless superseded through governed recomposition<br> Ref: §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:770 (<code>EbmStatus</code> includes <code>Superseded</code>)<br>no code path sets it</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No code anywhere calls <code>updateStatus(id, "Superseded")</code> and no recomposition flow exists that would produce a second <code>ebms</code> row superseding an Active one for the same SEU. The "unless superseded" clause has no live trigger.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">EBM shall define engineering/governance/decision/quality/compliance/collaboration/lifecycle/authority/terminology/constraint behaviour (§5 "shall")<br> Ref: §5 Architectural Responsibilities</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionCompleted.ts:124-143 (quality gates, policies)<br>src/domain/engine/profileCompositionUnravel.ts (pool, competencyRequirements)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None of the 10 named behaviour kinds exist as first-class, separately-typed content *on* the EBM. What is real and reachable through the EBM: materialised Quality Gates and Policies (governance/quality), the resolved pool (engineering/domain-ish properties), and competency requirements. Decision, collaboration, authority, and terminology behaviour are not carried by the EBM at all — they are reached, if at all, through Packs directly, not through <code>ebms</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">EBM shall not contain executable work, schedule execution, manage participants, preserve knowledge, or execute workflows (§5 "shall not")<br> Ref: §5 Architectural Responsibilities</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ebmsDB.ts (whole file — no scheduling, no workflow, no participant-management logic)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Holds cleanly. <code>ebmsDB</code>/<code>ebms</code> table contain only composition data, governance id lists, and status.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-3.2 EBM has a globally unique identifier<br> Ref: §6 FR-3.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ebmsDB.ts:42-45 (<code>id</code> UUID PK via <code>RETURNING *</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real UUID primary key.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-3.3 EBM is versioned<br> Ref: §6 FR-3.3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ebmsDB.ts:44 (<code>COALESCE(MAX(version),0)+1 ... WHERE seu_id=$1</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real per-SEU monotonic version column. No SEU has ever reached version 2 in practice — no recomposition flow exists to exercise it (consistent with the Definition row above).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-3.4 every behavioural contribution traceable to its originating Pack<br> Ref: §6 FR-3.4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:772-776 (<code>EbmComposedPack{packId,packCode,packVersion}</code>)<br>src/domain/engine/profileCompositionUnravel.ts (<code>PoolEntry.source</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Traceable at two levels now: <code>composed_packs</code> traces Packs, and each individual <code>pool</code> entry carries its own <code>source</code> (resolved from <code>PoolSource</code>), not just the Pack list. This is a real upgrade over Pack-level-only traceability — each contributed property, not only each Pack, resolves back to where it came from.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-3.5 every behavioural rule defines its composition strategy<br> Ref: §6 FR-3.5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts (<code>resolvedCompositionConflicts</code>)<br>src/routes/seu/core/commissioning.ts (<code>applyConflictStrategy</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No standalone "Behavioural Rule" entity exists carrying a <code>compositionStrategy</code> field (§8 is 0/10 real, see below). What is real: for properties that actually conflicted across Profiles, the human-chosen strategy (<code>specialize</code>/<code>merge</code>/<code>union</code>/<code>intersection</code>/<code>supplement</code>) is recorded in <code>resolvedCompositionConflicts</code> and carried onto <code>ebm.behaviors</code>. Non-conflicting contributions carry no explicit strategy field at all — they are simply pooled.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-3.6 behavioural conflicts detected before commissioning<br> Ref: §6 FR-3.6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts (<code>detectCompositionConflicts</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real, unconditional conflict detection across every composed Pack contribution type (Capabilities, Services, Policies, Checklists, Review Gates, Authority Rules, Quality Gates, Obligation Definitions, Engineering Capital, Pack Dependencies) plus Profile/Template fields — runs before the SEU can proceed past the Compose step.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-3.7 conflicts requiring human judgement prevent commissioning<br> Ref: §6 FR-3.7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionCompleted.ts:46-59 (<code>failComposition</code> → <code>seusDB.updateLifecycleState(seuId,"Failed")</code> + <code>CommissionFailed</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An unresolved conflict terminates commissioning into a real <code>Failed</code> SEU state; commissioning cannot silently proceed past it.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-3.8 EBM immutable during normal execution<br> Ref: §6 FR-3.8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ebmsDB.ts (only <code>create</code>/<code>updateStatus</code> exist; <code>updateStatus</code> touches <code>status</code> alone)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Content columns (<code>composed_packs</code>, <code>composition_report</code>, <code>behaviors</code>, governance id lists) have no write path after <code>create</code>. Only <code>status</code> is ever updated post-creation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-3.9 modification of EBM occurs only through recomposition<br> Ref: §6 FR-3.9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">n/a — no recomposition flow exists</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Vacuously true: nothing modifies an EBM's content at all, including through recomposition, because recomposition itself is never triggered.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-3.10 recompositions versioned and fully traceable<br> Ref: §6 FR-3.10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ebmsDB.ts:44</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same basis as FR-3.3 — the versioning mechanism is real but unexercised past version 1, since no recomposition ever runs.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Behaviour Categories: Engineering Practices/Governance/Quality/Compliance/Domain/Technology/Integration/Decision Governance/Obligations<br> Ref: §7 Behaviour Categories</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:39-43 (<code>PoolEntry{propertyName,value,source}</code> — no category field)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No behavioural contribution anywhere carries a tag matching this 9-value list. <code>category:pack</code> (a separate, 6-value Ontology vocabulary categorising Packs themselves — Compliance/Domain/Engineering/Integration/Organisation/Technology) exists but is a different, narrower list and is not read by <code>unravelComposition</code>/<code>compositionCompleted.ts</code> either.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Behavioural Rule: Identifier/Name/Description/Category/Originating Pack/Version/Composition Strategy/Applicability Conditions/Enforcement Level/Traceability Reference<br> Ref: §8 Behavioural Rule</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">— (no <code>BehaviouralRule</code> type/table anywhere in the codebase)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Confirmed absent. The closest real analogue is <code>PoolEntry</code> (propertyName, value, source) — covers roughly 2 of the 10 named fields in spirit (a name-like field, a traceability-like <code>source</code>) but is not the chapter's own structured entity, and carries no Category, Composition Strategy, Applicability Conditions, or Enforcement Level fields at all.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition strategies: Override/Merge/Supplement/Union/Intersection/Alias/Conflict Detection<br> Ref: §9 Composition Principles</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts (<code>applyConflictStrategy</code> → <code>compositionEngine.specialize</code>/<code>merge</code>/<code>union</code>/<code>intersection</code>/<code>supplement</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">5 of the 7 named strategies have real implementations, invoked at the individual conflicting-field level (not whole-Pack) whenever a human resolves a flagged conflict. <code>Alias</code>/<code>Override</code> both fall back to <code>specialize</code>, a rename/consolidation rather than two distinct strategies as named. Non-conflicting contributions are pooled without any explicit strategy applied — "Conflict Detection" itself is a precondition (FR-3.6), not a composition strategy that transforms a value.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Behavioural inheritance ordered Platform→Organisation→Domain→Compliance→Technology→Integration Packs<br> Ref: §10 Behavioural Inheritance</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts (<code>unravelComposition</code> resolves a Template's mandatory Pack codes then a Profile's optional Pack codes — no <code>category:pack</code> read at all)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition is category-blind: it resolves exactly two flat lists (mandatory, then optional Packs), never the chapter's own ordered category chain. "No assumptions on number of contributing Packs" holds trivially (both lists are unbounded), but the ordering itself has no mechanism behind it.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Behaviour Resolution: Composition Engine produces one internally consistent EBM; deterministic and repeatable<br> Ref: §11 Behaviour Resolution</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts (<code>detectCompositionConflicts</code>)<br>src/domain/engine/compositionCompleted.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">"Internally consistent" is checked broadly (FR-3.6) before the EBM is created at all, so a created EBM has no outstanding unresolved conflicts by construction. "Deterministic and repeatable" holds only relative to the DB's state at call time — Pack/Profile resolution always reads whichever version is currently Active, not a pure function of input ids alone.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Behaviour Enforcement is the responsibility of runtime services (Governance Runtime, Dependency Engine, Knowledge Runtime, Obligation Runtime); EBM itself performs no execution<br> Ref: §12 Behaviour Enforcement</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/qualityGateEngine.ts:89-113<br>src/domain/engine/policyEngine.ts:57-59<br>src/domain/engine/executionEngine.ts:244</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real engines consume the EBM's materialised <code>applicable_quality_gate_ids</code>/<code>applicable_policy_ids</code>/<code>seu_scoped_policy_ids</code> directly, rather than re-deriving scope per check — a stronger and more direct form of enforcement than a bare Pack-list lookup. The platform's own status dashboard (<code>src/routes/seu/core/dashboard.ts:39,41</code>) groups these into "Governance Runtime" (Authority+Policy+Obligation+Quality Gate) and "Knowledge Runtime" (Evidence+Knowledge+Decision) — Obligation is folded into Governance Runtime, not a standalone "Obligation Runtime" as this chapter names it; a naming/grouping mismatch only, not a missing engine. <code>ebms</code>/<code>ebmsDB.ts</code> itself performs no execution.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Runtime Interaction: Participants consult the EBM; runtime services enforce it; Deliverables/Decisions/Obligations evaluated against it; EBM remains read-only<br> Ref: §13 Runtime Interaction</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">16 real call sites of <code>ebmsDB.findById</code> across src/routes/seu/core/{governanceModel,traceability,obligations,compliance,commissioning,seus,participantEligibility}.ts and src/domain/engine/{policyEngine,seuCompositionScope,dispatchStrategies,ebmActivated,workItemGenerated,workItemGenerator,redispatch,qualityGateEngine}.ts, src/adapters/assignmentDelivery.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Far broader real consultation than a Pack-scope pointer alone: beyond <code>composed_packs</code>, callers read <code>ebm.behaviors.pool</code> (work item generation, dispatch/redispatch, obligations — src/domain/engine/workItemGenerator.ts:62, dispatchStrategies.ts:48, redispatch.ts:27, src/routes/seu/core/obligations.ts:275) and <code>ebm.behaviors.competencyRequirements</code> (participant eligibility). Obligations, work-item generation, and dispatch decisions are genuinely driven by EBM-resolved content, not only by each Pack's own separately-materialized governance. EBM remains read-only throughout (no mutation path exists, per §3/FR-3.8 rows).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Versioning: version identifier, parent version, composition history, source Pack versions, change history, approval history<br> Ref: §14 Versioning</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:816-845 (<code>ebms</code> columns)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real: <code>version</code> (version identifier), <code>composed_packs[].packVersion</code> (source Pack versions). Absent: no <code>parent_ebm_id</code> column (parent version), no composition-history-beyond-current-report, no change history, no approval history/concept for EBM versioning. 2 of 6 named fields real.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❓</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Historical versions remain reproducible<br> Ref: §14 Versioning</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">n/a — unexercised</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No SEU has ever produced a second <code>ebms</code> version, so reproducibility across versions has never been exercised in practice, though nothing in the schema would prevent it.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Events: EBMCreated, EBMValidated, EBMVersioned, EBMActivated, EBMRetired, BehaviourConflictDetected, BehaviourConflictResolved<br> Ref: §15 Events</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionCompleted.ts:161-174 (<code>EBMCreated</code>)<br>src/dblayer/seed/data/transitionDefinitions.json:16-31 + src/routes/seu/core/commissioning.ts:706-719 (<code>EBMValidated</code>,<code>EBMActivated</code> via <code>transitionEbm</code>)<br>src/routes/seu/core/commissioning.ts:663-697 (<code>EBMRetired</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">4 of 7 named events are now real and published for real transitions: <code>EBMCreated</code> (on composition), <code>EBMValidated</code>/<code>EBMActivated</code> (via <code>transitionEbm</code>, driven by <code>transition_definitions</code> rows), and <code>EBMRetired</code> (when a liveness check at Validate time finds a dead Pack/Profile/Template reference — a genuinely new, real trigger, not merely a status value). Still unbuilt: <code>EBMVersioned</code> (no recomposition ever produces a second version to announce), <code>BehaviourConflictDetected</code>/<code>BehaviourConflictResolved</code> (conflict detection/resolution happen synchronously inside the commissioning flow and are never announced individually on the event bus — only the aggregate <code>CommissionFailed</code>).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Non-Functional: deterministic, reproducible, immutable during execution, fully traceable, incremental evolution, concurrent versions, technology-independent<br> Ref: §16 NFRs</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ebmsDB.ts; src/domain/engine/profileCompositionUnravel.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Immutable during execution: real (FR-3.8 row). Technology-independent: real, no tech coupling in <code>ebmsDB.ts</code>/composition code. Deterministic/reproducible: real only relative to current DB state, same caveat as Behaviour Resolution row. Fully traceable: real at both Pack- and property-level now (FR-3.4 row) — stronger than previously, but Decision/Authority/Terminology behaviour (§5) still isn't traceable through the EBM since it isn't carried by it at all. Incremental evolution: no mechanism (no recomposition flow). Concurrent versions: schema supports multiple <code>ebms</code> rows per <code>seu_id</code>; never exercised.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance Criteria: multi-Pack composition, conflict detection/resolution before commissioning, versioned result, runtime consumption, immutability<br> Ref: §17 Acceptance Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(aggregated — see FR-3.6/3.7, Versioning, Runtime Interaction rows)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All 6 named criteria have real, working evidence. "Behaviour from multiple Packs is successfully composed" is now true both at the Pack level and, via the resolved <code>pool</code>, at the individual-property level — not Pack-composition-only as a prior pass found.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables: EBM domain object, behaviour catalogue, behavioural rule model, versioning model, behaviour validation/query services, composition interfaces, initial EBM API<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:816-845 (domain object)<br>src/domain/engine/profileCompositionUnravel.ts (validation/composition)<br>src/domain/engine/compositionCompleted.ts (API/handler)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">EBM domain object: real (<code>EbmRow</code>), now meaningfully richer than a thin Pack-list (behaviors pool + materialised governance ids). Behaviour catalogue / behavioural rule model: still absent as the chapter's own structured entities (§7/§8 rows) — the resolved <code>pool</code> is real content but not a queryable, category-tagged catalogue. Versioning model: 2 of 6 fields (Versioning row). Behaviour validation services: real and comprehensive (<code>detectCompositionConflicts</code>). Behaviour query services: <code>ebmsDB.findById</code> returns the whole row including <code>behaviors</code>/governance ids now, not just the Pack list — closer to a real query surface than before, though still no rule-level filter/search API. Composition interfaces: real (<code>unravelComposition</code>/<code>detectCompositionConflicts</code>). Initial EBM API: still no standalone HTTP API for EBM inspection/recomposition — creation/transition happen only as event-bus consequences of SEU commissioning actions.</td>
    </tr>
  </tbody>
</table>
## Summary

Total intents analysed: 29
- Fully met: 11
- Partially met: 14
- Not met: 3
- Not verifiable: 1

## Major Gaps (unranked, in spec order)

1. **No Behaviour Category tagging (§7)** — the chapter's 9 categories have no field anywhere; `category:pack` is a different, Pack-level, 6-value vocabulary.
2. **No Behavioural Rule entity (§8)** — 0 of the chapter's 10 named fields exist as a structured entity; the real `PoolEntry` (propertyName/value/source) is a related but materially thinner substitute.
3. **No ordered category-based Pack inheritance (§10)** — composition resolves two flat Pack-code lists (Template-mandatory, Profile-optional) with no awareness of `category:pack` or any ordering.
4. **No recomposition/supersession flow (§4, §9, §14, FR-3.9/3.10)** — `Superseded` status and the versioning columns exist, but nothing ever triggers a second EBM version for an existing SEU; this also leaves `EBMVersioned` unpublished and makes the "unless superseded" clause in the Definition inert.
5. **No standalone EBM API (§18)** — EBM creation/transition/retirement are all event-bus consequences of SEU-side actions; there is no HTTP surface to inspect or recompose an EBM directly.

## What materially improved since the chapter's own embedded 2026-09-07 audit

- A real resolved behaviour pool (`ebm.behaviors.pool`/`competencyRequirements`, migration 182) now drives work-item generation, dispatch/redispatch, obligation evaluation, and participant eligibility — not merely a Pack-scope pointer.
- Materialised `applicable_quality_gate_ids`/`applicable_policy_ids`/`seu_scoped_policy_ids` (CR-104) give Quality Gate and Policy engines a direct, pre-resolved scope instead of a bare `(entity_type, from_state, to_state)` match.
- `EBMRetired` is now a real, independently-triggered event (a liveness check at Validate time against dead Pack/Profile/Template references), not merely a named-but-unbuilt status.
- Per-property traceability (`PoolEntry.source`) now exists in addition to per-Pack traceability (`composed_packs`), partially closing FR-3.4 beyond the Pack level.
