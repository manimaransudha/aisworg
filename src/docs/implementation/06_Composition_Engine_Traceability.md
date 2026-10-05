# Chapter 4 – Composition Engine: Implementation Traceability

**Date of report: 4-10-2026**

Independent code-verified audit (2026-10-04). Investigated directly against current repository state — not derived from Chapter 4's own embedded §21 audit (dated 2026-08-24/2026-09-07), which is materially stale: it names `ebmComposer.ts` as the live pipeline file, but that file no longer exists. The real pipeline today runs through `src/domain/engine/validateRequest.ts`, `src/domain/engine/compositionCompleted.ts`, `src/domain/engine/profileCompositionUnravel.ts`, `src/domain/engine/ebmActivated.ts`, and `src/routes/seu/core/commissioning.ts`/`src/routes/seu/web/objectives.ts` — all traced below from source, with line citations.

Core finding carried forward from the prior audit and reconfirmed directly: `compositionEngine.compose()`/`detectGovernanceConflicts` (`src/domain/engine/compositionEngine.ts`) have zero live call sites (`grep -rn "compositionEngine\.compose("` across `src/` returns only comments, including `commissioning.ts:948`'s own explicit commented-out call). The function was rewritten for multi-Template/multi-Profile (CR-092 Part 6) but is still unreachable — a real, maintained dead function, not an artifact of the old audit. The 6 standalone strategy functions (`specialize`/`merge`/`union`/`intersection`/`supplement`, plus `strategyRequirements`) are real and live, called from `commissioning.ts` (conflict resolution), `sdkAuthoring.ts` (Pack authoring composition sources), `packs.ts`, and `ontology.ts` (Ontology term specialization).

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition Engine builds an EBM by composing behavioural contributions from one or more Packs<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionCompleted.ts:79-144<br>src/domain/engine/profileCompositionUnravel.ts:102-566</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An EBM is built, but not by <code>compositionEngine.ts</code> (dead, see above). The real pipeline resolves Packs via <code>unravelComposition</code>, detects conflicts, and <code>compositionCompletedHandler</code> persists the EBM via <code>ebmsDB.create</code>. The behavioural content itself (a flat <code>pool</code> of every Profile/Template/Pack contribution) is now carried onto <code>ebm.behaviors</code> (compositionCompleted.ts:102-106), not just a Pack list.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition Engine is the only component authorised to create/validate/version/activate an EBM<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ebmsDB.ts:5-90</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>ebmsDB.create</code>/<code>updateStatus</code> are the only write paths onto <code>ebms</code>, confirmed by <code>grep</code> — no other module inserts/updates this table. But the orchestration isn't one "Composition Engine" component; it's split across <code>compositionCompleted.ts</code> (create), <code>commissioning.ts:transitionEbm</code> (validate/activate/retire), with <code>compositionEngine.ts</code> itself playing no role.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition Engine performs no software engineering work itself; produces a model suitable for commissioning<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:339-348</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>finalizeCommissioning</code> (the actual SEU-advancing work) is a clearly separate function/stage from EBM creation, triggered only after a human Activates the EBM (commissioning.ts:710-end, ebmActivated.ts). Boundary holds.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Not applicable</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Chapter scope: responsibilities/inputs/outputs/lifecycle/conflict detection/resolution/validation/versioning/activation<br> Ref: §2 Scope</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(scope statement only)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each item addressed in its own row below.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Architectural position: Pack Registry → Composition Engine → EBM → Commissioned SEU, build-time only<br> Ref: §3 Architectural Position</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/validateRequest.ts:1-157<br>src/domain/engine/compositionCompleted.ts:61-77</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The real shape is Pack/Template/Profile → <code>unravelComposition</code>/conflict detection → <code>ebms</code> row → SEU activation — same architectural position (build-time, pre-commissioning), different named component doing it. Confirmed never invoked from any SEU runtime/execution path (no caller outside the commissioning flow).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition Engine discovers Packs<br> Ref: §4 Responsibilities</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:126-160 (resolveActivePack, called per mandatory/optional code)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real: every mandatory Template Pack code and every Profile-selected Pack code (across all 7 category buckets, via <code>getProfilePackSelections</code>) is resolved to its Active Pack row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition Engine resolves dependencies<br> Ref: §4 Responsibilities</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:131,406 (resolveComposedPacksTransitively / dependency pool entries)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real: Pack <code>dependencies[]</code> walked transitively, cycle-safe; each dependency becomes a pool entry carrying <code>satisfiedInComposedSet</code> (line 406), checked against the actually-composed set. A <code>required</code>/<code>conditional</code> dependency unmet, or an <code>incompatible</code> one present, surfaces as a blocking <code>CompositionConflict</code> with <code>hasAction: false</code> (profileCompositionUnravel.ts:68-71).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition Engine validates compatibility<br> Ref: §4 Responsibilities</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:518 (detectCompositionConflicts)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real cross-source disagreement detection across the full pool (Profile params, Template fields, Pack contributions, dependencies) — not a Pack-existence check alone. No distinct notion of Pack "compatibility" beyond dependency satisfaction and content-level conflict; the spec doesn't define compatibility beyond this either.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition Engine composes behavioural contributions<br> Ref: §4 Responsibilities</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:102-130 (pool construction)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Profile Configuration Parameter, Template field, exposed parameter, and Pack contribution (including competencies, quality gates, policies) is placed into one flat pool, matched by key, compared to full depth. This is real composition of content, not just a Pack list — a material improvement over the dead <code>compositionEngine.compose()</code>'s whole-Pack-only approach.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition Engine detects conflicts<br> Ref: §4 Responsibilities</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:518-566</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">See §11 row below.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition Engine resolves deterministic conflicts automatically<br> Ref: §4 Responsibilities</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:1011-1095 (applyConflictStrategy)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No conflict is ever resolved automatically — every resolution requires a human to pick a composition strategy on the validate/compose-ebm page (objectives.ts:777-876). There is no deterministic/non-deterministic conflict *classification* anywhere in the code; this is a deliberate design choice recorded in comments (commissioning.ts, "you dont assume any base — i have been repeating this saying user has to choose"), not an oversight.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition Engine identifies non-deterministic conflicts<br> Ref: §4 Responsibilities</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:518-566</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every conflict found is treated uniformly (no deterministic/non-deterministic split exists); all conflicts block until a human resolves them, so the practical effect — conflicts needing explicit resolution — holds, but the named classification does not exist.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition Engine constructs the EBM<br> Ref: §4 Responsibilities</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionCompleted.ts:132-144</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>ebmsDB.create</code> called with <code>composedPacks</code>, <code>compositionReport</code>, <code>behaviors</code>, <code>applicableQualityGateIds</code>, <code>applicablePolicyIds</code>, <code>seuScopedPolicyIds</code>. Real construction, from the stashed <code>unravelComposition</code> output, not from dead <code>compositionEngine.compose()</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition Engine versions the EBM<br> Ref: §4 Responsibilities</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ebmsDB.ts:42-44</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>version = COALESCE(MAX(version),0)+1</code> per <code>seu_id</code>, genuinely computed SQL. See §16 row — never exercised past version 1 since nothing re-triggers composition for an existing SEU.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition Engine activates the EBM<br> Ref: §4 Responsibilities</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:636-719<br>src/domain/engine/ebmActivated.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>transitionEbm</code> with <code>targetState: "Active"</code>, gated by <code>transitionEngine.evaluate</code>, publishes <code>EBMActivated</code> (event_type read off transition_definitions). A real, separately human-triggered stage.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition Engine shall not execute Work Items / manage Participants / manage Deliverables / preserve Knowledge<br> Ref: §4 Responsibilities (negative)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionCompleted.ts, profileCompositionUnravel.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Confirmed by absence: no reference to Work Items, Deliverable persistence, or Knowledge preservation in any of the composition-path files; <code>finalizeCommissioning</code> (a separate function, triggered later, off EBMActivated) is where Engineering Assets/Work Items begin.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Inputs: one SEU Template, zero-or-more Packs across 6 categories, Platform Packs, extensible categories<br> Ref: §5 Inputs</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:146-160, 406</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real input is <code>{templateIds, profileIds}</code> (now plural, CR-092 Part 6 — one-or-more Templates were supported in <code>unravelComposition</code>/dead <code>compose()</code>, though <code>commissionSeu</code> itself (commissioning.ts:206) rejects more than one Profile at commit time). Packs are derived indirectly from Template mandatory codes + Profile's 7 category-keyed selection buckets (<code>getProfilePackSelections</code>), not accepted as a flexible list parameter. A Pack's own <code>category:pack</code> value plays no role in composition logic itself (only in which Profile UI bucket it was picked from) — confirmed, no <code>category</code> read in profileCompositionUnravel.ts's pack-resolution path.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Output: exactly one EBM containing behavioural/governance/authority rules, standards, terminology mappings, quality gates, review gates, metadata<br> Ref: §6 Output</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ebmsDB.ts:42-59<br>src/domain/engine/compositionCompleted.ts:102-144</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">One <code>ebms</code> row per commission, confirmed. It now contains real decomposed content: <code>behaviors.pool</code> (every contribution, individually sourced), <code>applicable_quality_gate_ids</code>, <code>applicable_policy_ids</code> (authority/governance), <code>seu_scoped_policy_ids</code>. Not present as first-class EBM fields: "engineering standards" and "terminology mappings" as named, separately queryable structures — these remain embedded inside Pack <code>contributions</code> JSONB, never extracted under those names. "Review gates" has no distinct field from "quality gates" (CR-058 established one Quality Gate per category; no separate Review Gate concept exists in the schema).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition Engine shall not expose partially composed models<br> Ref: §6 Output</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionCompleted.ts:132-158</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>ebmsDB.create</code> is a single INSERT; on <code>ebmErr</code>, nothing is persisted and <code>CommissionFailed</code> is published instead (lines 145-157). No intermediate/partial EBM row is ever visible.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-4.1: invoked before every commissioned SEU<br> Ref: §7 FR-4.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/validateRequest.ts:54-157<br>src/routes/seu/web/objectives.ts:777-876</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real composition (<code>unravelComposition</code>+conflict detection+<code>ebmsDB.create</code>) runs for every SEU that reaches <code>Commissioned</code> — but only via a human clicking "Compose"/"Apply & re-validate" on the Compose EBM page (confirmed: <code>eventSubscriptions.json</code> explicitly documents "Compose EBM is a manual transition"), not an automatic invocation "before commissioning." A commission cannot proceed to <code>finalizeCommissioning</code> without an Active EBM existing first, so the ordering constraint holds even though the trigger is manual, not automatic.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-4.2: exactly one EBM per commissioned SEU<br> Ref: §7 FR-4.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionCompleted.ts:132-160</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">One <code>ebmsDB.create</code> call per successful composition, followed by <code>seusDB.setActiveEbm</code>. Confirmed no second create path exists elsewhere.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-4.3: every behavioural contribution retains its originating Pack reference<br> Ref: §7 FR-4.3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:35-36, 102-106 (PoolSource)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Stronger than Pack-level now: every individual pool entry carries its own <code>source: {kind, id, code, label}</code> (profile/template/pack-level, not just Pack-level), and this is carried onto the persisted <code>ebm.behaviors.pool</code> (compositionCompleted.ts:102-106) — not transient-only as the prior audit found.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-4.4: maintain complete composition traceability<br> Ref: §7 FR-4.4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ebmsDB.ts:42-59 (composed_packs), compositionCompleted.ts:102-106 (behaviors.pool)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Both Pack-level (<code>composed_packs</code>) and per-contribution-level (<code>behaviors.pool</code>, with source) traceability are persisted permanently on the <code>ebms</code> row — not discarded after validation as the embedded audit (dated pre-CR-104/migration-182) found. "Composition strategy" per rule is still not separately recorded as its own trace field (only the resolved value is, via <code>resolvedCompositionConflicts</code>).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-4.5: composition is deterministic — identical inputs produce identical EBMs<br> Ref: §7 FR-4.5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:126-130 (resolveActivePack → findActiveByCode)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Still resolves to whichever Pack Version is currently Active at call time — identical <code>{templateIds, profileIds}</code> can yield a different composed set if a Pack's Active version changes between two calls. Deterministic only relative to full DB state at call time, not purely the two input ids. Unchanged from the prior audit's finding, reconfirmed in the current code.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-4.6: support incremental recomposition<br> Ref: §7 FR-4.6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionCompleted.ts, profileCompositionUnravel.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No incremental mechanism exists anywhere — every composition recomputes the full pool from scratch. Moot in practice per FR-4.7/§16 below: nothing re-triggers composition for an already-commissioned SEU.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-4.7: recomposition produces a new EBM version<br> Ref: §7 FR-4.7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ebmsDB.ts:42-44</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SQL is real and correct (<code>MAX(version)+1</code> per seu_id), but confirmed via <code>grep</code> that no code path calls <code>ebmsDB.create</code> a second time for an SEU that already has an EBM — never exercised beyond version 1.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition Lifecycle: Collect→Resolve Deps→Validate Packs→Compose→Detect Conflicts→Resolve Conflicts→Validate Model→Version→Activate, each a gated stage<br> Ref: §8 Lifecycle</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/web/objectives.ts:777-876 (compose-ebm route)<br>src/domain/engine/compositionCompleted.ts<br>src/routes/seu/core/commissioning.ts:636-719 (transitionEbm)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real, separately gated stages now exist for several of the 9: Collect+Resolve Dependencies+Compose+Detect Conflicts are one combined <code>unravelComposition</code>+<code>detectCompositionConflicts</code> pass (objectives.ts:815-841); Resolve Conflicts is real and separate (<code>applyConflictStrategy</code>, human-triggered per conflict); Version+Create is <code>ebmsDB.create</code> (status starts <code>'Composed'</code>); Validate Model and Activate are two distinct, separately human-triggered <code>transitionEbm</code> calls (<code>Composed→Validated</code>, <code>Validated→Active</code>), each independently gated by <code>transitionEngine.evaluate</code>. There is no distinct "Validate Packs" stage — a Pack's existence (<code>findActiveByCode</code>)/liveness (<code>checkRequestLiveness</code>, run during Validate Request, before composition) is the only Pack-level check; no separate per-Pack compatibility stage.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Failure at any stage terminates the composition process<br> Ref: §8 Lifecycle</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/validateRequest.ts:39-52, 105-138<br>src/domain/engine/compositionCompleted.ts:46-59, 145-158</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every stage's failure path updates <code>seus.lifecycle_state</code> to <code>Failed</code> and publishes <code>CommissionFailed</code> with a <code>stage</code> field identifying where it failed — real, consistent across both handlers, including a catch-all for thrown exceptions (failValidation/failComposition wrappers).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Dependency Resolution: required/optional/conditional/incompatible/missing Packs; dependencies declared, not inferred<br> Ref: §9 Dependency Resolution</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:131, 406</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>dependencies[]</code> is read directly off each Pack's own declared data (never inferred) and walked transitively; <code>type: dep.type</code> (required/conditional/incompatible) and <code>satisfiedInComposedSet</code> are both real, checked fields. Missing-mandatory-Pack is checked separately and earlier, in <code>checkRequestLiveness</code> (commissioning.ts, run during Validate Request) — blocking, not a warning.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Behaviour Composition: 7 named strategies (Merge/Override/Supplement/Union/Intersection/Alias/Conflict Detection), extensible without Runtime Kernel changes<br> Ref: §10 Behaviour Composition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:238-342<br>src/routes/seu/core/commissioning.ts:1011-1095</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">5 of 7 (Merge/Union/Intersection/Supplement/Specialization-as-Alias) are real, live functions — but used for human-triggered, single-field conflict *resolution* (<code>applyConflictStrategy</code>), never for composing whole Pack contents automatically as this section frames it. "Override" (whole-Pack, same-code dedup) exists only inside dead <code>compositionEngine.compose()</code>; in the live path, Pack-code collisions across Template/Profile selections are deduplicated implicitly (<code>byCode</code> map logic exists only in the dead function — the live <code>unravelComposition</code> path has not been confirmed to independently de-duplicate by code beyond <code>findActiveByCode</code>'s own per-code resolution). "Conflict Detection" is real as a separate mechanism (§11), not one of the 6 strategy functions. New strategy codes are data-driven (<code>CompositionStrategyCode</code>/Ontology vocabulary), requiring no Runtime Kernel change for a *known* code, but a genuinely new strategy *function* (not just a label) requires a code change to <code>compositionEngine.ts</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Conflict Detection: contradictory authority rules, incompatible workflows, conflicting quality gates, inconsistent terminology, incompatible compliance/technology constraints; classified deterministic/non-deterministic<br> Ref: §11 Conflict Detection</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:518-566</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>detectCompositionConflicts</code> is comprehensive across every pooled contribution type (Profile params, Template fields, Pack competencies/quality-gates/policies/dependencies) — a much wider net than the 6 named categories, but not keyed to them by name. No first-class "workflow" or "terminology mapping" entity exists to compare, so those two specific categories are not checked under those names. Compliance requirements (Policies) are deliberately never compared against each other — a settled design decision (commissioning.ts comment: "two policies do not have to agree... at all"), not a gap. No deterministic/non-deterministic classification exists anywhere (see FR-4.5/§4 rows).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Conflict Resolution: deterministic resolved automatically; non-deterministic requires explicit human resolution before commissioning; every resolution recorded and traceable<br> Ref: §12 Conflict Resolution</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:1011-1095 (applyConflictStrategy)<br>src/domain/engine/compositionCompleted.ts:104 (resolvedCompositionConflicts)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Blocking is real: any unresolved <code>CompositionConflict</code> prevents <code>CompositionCompleted</code>/EBM creation (objectives.ts:841-874 only proceeds when <code>compositionConflicts.length === 0</code>). Resolution is real and recorded: a human picks a strategy per conflict (<code>applyConflictStrategy</code>), and the resolved value is carried onto <code>ebm.behaviors.resolvedCompositionConflicts</code> — permanently, not just transiently. No conflict is ever resolved automatically — by explicit design, every resolution is a human choice; §12's "deterministic conflicts resolved automatically" half is never implemented and is not planned.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Validation: completeness, Pack compatibility, governance completeness, dependency completeness, mandatory Pack availability, mandatory rules, terminology consistency; fails if EBM incomplete<br> Ref: §13 Validation</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts (checkRequestLiveness, referenced validateRequest.ts:121)<br>src/domain/engine/profileCompositionUnravel.ts (dependency checks)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">"Mandatory Pack availability" is real and blocking, via <code>checkRequestLiveness</code> during Validate Request — a sibling mechanism to composition, not inside it, but functionally satisfying this requirement before composition proceeds. "Dependency completeness" is real (§9 row). Pack compatibility (beyond existence/dependency), governance completeness, mandatory behavioural rules, and terminology consistency have no dedicated check anywhere in the traced code.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition Traceability: every behavioural rule traceable to originating Pack, Pack version, composition strategy, conflict resolution; permanently available<br> Ref: §14 Composition Traceability</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ebmsDB.ts:42-59<br>src/domain/engine/compositionCompleted.ts:102-144</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Pack + Pack version traceable via <code>composed_packs</code> (permanent). Individual contribution-level source traceable via <code>behaviors.pool[].source</code> (permanent, migration 182 field) — improved over the prior audit's "transient only" finding. Conflict resolution outcome is permanent (<code>resolvedCompositionConflicts</code>). The specific composition *strategy* used per rule is not recorded as a standalone field anywhere — only the resolved value is.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Activation: only validated EBMs may be activated; assigns identifier/version, publishes activation events, makes EBM available for commissioning; does not modify existing EBMs<br> Ref: §15 Activation</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:636-719<br>src/domain/engine/ebmActivated.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>transitionEbm</code> enforces <code>fromState</code> via <code>transitionEngine.evaluate</code> (no path from <code>Composed</code> directly to <code>Active</code>; <code>transitionDefinitions.json</code> only defines <code>Composed→Validated</code>(EBMValidated)/<code>Validated→Active</code>(EBMActivated)) — only a Validated EBM reaches Active. Identifier (<code>id</code>)/version are assigned at <code>create</code> time, before activation; <code>EBMActivated</code> is published (event_type resolved from transition_definitions). <code>ebmsDB.updateStatus</code> only ever writes <code>status</code>, never <code>composed_packs</code>/<code>composition_report</code>/<code>behaviors</code> — existing EBM content is never modified by activation or any other transition.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Recomposition: triggered by Pack upgrade, conflict resolution, governance change, new mandatory Pack, or authorised user request; never modifies historical EBMs<br> Ref: §16 Recomposition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ebmsDB.ts:42-44, 81-89</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Historical EBMs are never modified — confirmed, <code>updateStatus</code> only touches <code>status</code>; no UPDATE touches <code>composed_packs</code>/<code>behaviors</code>. But none of the 5 named triggers actually re-invokes composition for an already-commissioned SEU anywhere in the traced code (<code>compositionCompletedHandler</code>/<code>unravelComposition</code> run exactly once per commission, during the Pending→Composed window, never again). The version-increment SQL is real but unexercised.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Events: CompositionStarted, DependencyResolved, DependencyFailed, PackValidated, BehaviourComposed, ConflictDetected, ConflictResolved, CompositionValidated, EBMCreated, EBMActivated, CompositionFailed<br> Ref: §17 Events</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionCompleted.ts:49,147,162<br>src/domain/engine/validateRequest.ts:42,108,127,141<br>src/routes/seu/core/commissioning.ts:312,675<br>src/routes/seu/web/objectives.ts:745,859</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">2 of 11 named events exist under their exact chapter-given name: <code>EBMActivated</code> (transitionEbm/transition_definitions) and a near-miss — <code>CommissionFailed</code>/<code>CommissionValidated</code> are real but under Chapter 8's SEU-commissioning-scoped naming, not this chapter's own <code>CompositionFailed</code>/<code>CompositionValidated</code>. <code>EBMCreated</code> is real (compositionCompleted.ts:162) and matches this chapter's name exactly. Not found anywhere, confirmed by <code>grep</code>: <code>CompositionStarted</code>, <code>DependencyResolved</code>, <code>DependencyFailed</code>, <code>PackValidated</code>, <code>BehaviourComposed</code>, <code>ConflictDetected</code>, <code>ConflictResolved</code> — <code>eventSubscriptions.json</code> itself documents <code>CompositionStarted</code> as "currently unpublished." Two real but differently-named events exist instead: <code>CommissionRequested</code>, <code>CompositionCompleted</code>, <code>EBMRetired</code>, <code>EBMValidated</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: deterministic output<br> Ref: §18 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:126-130</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same finding as FR-4.5 — deterministic relative to current DB state only.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: support concurrent composition requests<br> Ref: §18 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionCompleted.ts, profileCompositionUnravel.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Both modules are stateless functions operating on their own query results, no shared mutable state; nothing structurally prevents concurrent calls from interfering, though no explicit locking/idempotency-on-duplicate-trigger was found (not required by the NFR's own wording).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: maintain complete auditability<br> Ref: §18 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ebmsDB.ts; src/domain/engine/compositionCompleted.ts:102-106</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Pack-level and now contribution-level (behaviors.pool) auditability both real and permanent; "complete" is still bounded by the same gaps named in §14 (no per-rule strategy field).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: preserve historical versions<br> Ref: §18 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ebmsDB.ts:42-44, 81-89</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Schema/column support real (<code>version</code>, immutable prior rows); never exercised past version 1 (§16).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: support incremental recomposition<br> Ref: §18 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same as FR-4.6.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: remain independent of execution technologies<br> Ref: §18 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts, compositionCompleted.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No technology-specific coupling found in either file — operates on plain DB rows/JSON.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">AC: Mandatory Packs are resolved<br> Ref: §19 AC</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts (checkRequestLiveness, called from validateRequest.ts:121)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real, blocking.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">AC: Behavioural contributions are successfully composed<br> Ref: §19 AC</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:102-130</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real composition into one pool, with per-entry source — stronger than the prior audit's "Packs composed, contributions not assembled" finding, now that <code>behaviors.pool</code> is persisted. Not yet organized into the named categorized structures of §6 (standards/terminology mappings/review gates as distinct fields).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">AC: Deterministic conflicts are resolved automatically<br> Ref: §19 AC</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No classification exists; nothing is ever resolved automatically. By design, confirmed in commissioning.ts comments.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">AC: Non-deterministic conflicts prevent commissioning<br> Ref: §19 AC</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/web/objectives.ts:841-874</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real and comprehensive — any unresolved conflict blocks <code>CompositionCompleted</code>/EBM creation, across every pooled contribution type, not just a narrow category subset.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">AC: Every EBM is versioned<br> Ref: §19 AC</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ebmsDB.ts:42-44</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Schema-real; unexercised beyond version 1 (§16).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">AC: Every behavioural contribution is traceable to its source<br> Ref: §19 AC</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionCompleted.ts:102-106</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Now permanently persisted (<code>behaviors.pool[].source</code>), not merely transient during validation as the prior audit found — a genuine improvement, confirmed via migration 182's <code>behaviors</code> column and this handler's write path.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">AC: EBMs are immutable after activation<br> Ref: §19 AC</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ebmsDB.ts:81-89</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>updateStatus</code> is the only post-create write path and touches only <code>status</code>; confirmed no other UPDATE exists on <code>ebms</code>. A deliberate guarantee, not an accident.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables: Composition Engine service, pipeline, dependency resolver, conflict detection, conflict resolution framework, validation service, EBM builder, traceability service, Composition APIs, domain events<br> Ref: §20 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(see individual rows above)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>compositionEngine.ts</code> as a "service" is largely dead code (only its strategy functions live, repurposed for resolution). Pipeline/dependency resolver/conflict detection/conflict resolution/EBM builder/traceability all have real, working, differently-named implementations elsewhere (<code>profileCompositionUnravel.ts</code>, <code>compositionCompleted.ts</code>, <code>commissioning.ts</code>). Validation service exists but mostly in a sibling chapter's own mechanism (<code>checkRequestLiveness</code>, Ch.8). No standalone recompose/inspect HTTP API exists — only the web UI routes (<code>compose-ebm</code>). Domain events: 2-3 of 11 named events exist under this chapter's exact names; several real events use Chapter 8's own naming instead.</td>
    </tr>
  </tbody>
</table>
## Summary

- Total intents analysed: 38
- Fully met: 13
- Partially met: 20
- Not met: 4
- Not verifiable: 0
- Not applicable (scope statement, no independent intent): 1

## Major Implementation Gaps

1. **`compositionEngine.ts`'s own `compose()`/`detectGovernanceConflicts` are dead code.** The named "Composition Engine service" (§20) has zero live callers for its core composition function; the real pipeline lives in `profileCompositionUnravel.ts`/`compositionCompleted.ts`/`commissioning.ts` under different names. Only the 6 standalone strategy functions survive, repurposed for human-triggered, single-field conflict resolution — a narrower use case than §10's "compose Pack contents" framing.
2. **No deterministic/non-deterministic conflict classification exists anywhere**, and by explicit design decision (recorded in code comments) never will — every conflict resolution is a human's own explicit choice. §4/§11/§12/§19's repeated "deterministic conflicts resolved automatically" requirement is not implemented and is not planned.
3. **Composition is triggered manually, not automatically "before commissioning every SEU."** A human must click "Compose"/"Apply & re-validate" on the Compose EBM page; `eventSubscriptions.json` documents this explicitly. The ordering constraint (EBM must exist before SEU reaches Commissioned) still holds.
4. **Incremental recomposition and multi-version EBMs are unbuilt/unexercised.** The version-increment SQL is real and correct but no code path ever calls it a second time for an existing SEU; none of the 5 named recomposition triggers (§16) re-invoke composition.
5. **Events: only 2-3 of 11 named events exist under this chapter's own names** (`EBMActivated`, `EBMCreated`, and near-miss `CommissionValidated`/`CommissionFailed` under Chapter 8's naming instead of this chapter's `CompositionValidated`/`CompositionFailed`). `CompositionStarted`, `DependencyResolved`, `DependencyFailed`, `PackValidated`, `BehaviourComposed`, `ConflictDetected`, `ConflictResolved` are all unpublished, confirmed by direct search and by the seed data's own documentation.
6. **The EBM is closer to decomposed now than before** (improvement over the prior embedded audit): `ebm.behaviors.pool` persists every individual contribution with its own source, not just a Pack list — but engineering standards and terminology mappings still have no first-class, separately queryable EBM structure; they remain embedded inside each Pack's own `contributions` JSONB.
