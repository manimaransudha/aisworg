# Chapter 26 – Quality Gate Model: Implementation Traceability

**Date of report: 4-10-2026**

Independent code-verified audit, 2026-10-04. The chapter itself carries an embedded §19 "Implementation Status & Gaps" audit dated 2026-08-22 (post-CR-058). This document is a fresh, independent trace against the live repository, not a restatement of §19. Where direct code inspection below contradicts or supersedes a §19 claim, that is called out explicitly in the Finding column.

Core files inspected: `src/domain/engine/qualityGateEngine.ts`, `src/dblayer/qualityGatesDB.ts`, `src/dblayer/qualityGateEvaluationsDB.ts`, `src/dblayer/qualityGateWaiversDB.ts`, `src/domain/engine/compositionEngine.ts`, `src/domain/engine/compositionCompleted.ts`, `src/routes/seu/core/governanceModel.ts`, `src/routes/seu/core/packs.ts`, `src/routes/seu/core/objectives.ts`, `src/domain/engine/transitionEngine.ts`, `src/dblayer/recovery/quality_gates_schema_recovery.sql`, `src/dblayer/recovery/quality_gate_evaluations_schema_recovery.sql`.

**Headline independent finding, not reflected in the chapter's own §19:** the chapter's §19 opening note and Summary item 1 both state the single-global-table / no-SEU-scoping problem remains open. Direct code inspection shows this has since been closed by two mechanisms the chapter's own audit predates: (1) migration 248, which scoped the active-slot unique index to include `originating_pack_id` (`quality_gates_active_scope_category_pack_key`), so different Packs no longer collide on the same (transition, category) slot at the table level; and (2) **CR-104**, which added `ebms.applicable_quality_gate_ids`, materialised once at commissioning (`compositionCompleted.ts:108-144`) from exactly the Packs actually composed into that SEU's EBM, and consumed by `qualityGateEngine.evaluate` (`qualityGateEngine.ts:102-118`) for every SEU-scoped entity. Per-SEU, Pack-composed Quality Gate enforcement — the chapter's central §12 concern — is real and live-enforced, not merely reported, as of this inspection.

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Quality Gate determines readiness for a governed state transition; it evaluates but does not perform or authorise engineering work<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">qualityGateEngine.ts:159-281</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>evaluateGate</code> only reads obligations/evidence/decisions/reviews/policies and returns an outcome; it never mutates the evaluated entity or any governed object, and never performs engineering work itself.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Quality Gates sit between engineering state (Policies/Reviews/Evidence/Knowledge/Decisions/Obligations) and Governance's state-transition decision<br> Ref: §3 Architectural Position</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">transitionEngine.ts:184-207</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>transitionEngine.evaluate</code> calls <code>qualityGateEngine.evaluateByIds</code> and, on block, returns <code>quality_gate_blocked</code> to the caller, which is a Governance-layer decision point distinct from the gate evaluation itself — matches the described layering.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Quality Gate is a declarative contract specifying conditions for a transition; it evaluates but does not modify engineering state<br> Ref: §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">qualityGatesDB.ts:16-94; qualityGateEngine.ts:159-281</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gates are rows (<code>criteria</code> JSONB, <code>governedTransition</code>) authored via Pack publish, and <code>evaluateGate</code> is read-only. Confirmed.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">QG-001 Quality Gates are declarative<br> Ref: §5 QG-001</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">qualityGateEngine.ts:163, 173, 184, 232, 262</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>criteria.type</code> is real data read from the DB row, but only 4 hardcoded type strings are interpretable (<code>no_unresolved_obligations</code>, <code>requires_accepted_evidence_or_approved_decision</code>, <code>requires_accepted_review</code>, <code>requires_active_policy</code>); any other value falls through to an unrecognised-type block (line 280). Declarative in storage, closed-set in interpretation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">QG-002 Quality Gates evaluate readiness (read-only)<br> Ref: §5 QG-002</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">qualityGateEngine.ts:301-360</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>recordAndPass</code>/<code>recordAndBlock</code>/<code>recordAndWaive</code> each write exactly one append-only evaluation row and publish one event; no entity/object mutation anywhere in the module.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">QG-003 Quality Gates are composable<br> Ref: §5 QG-003</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">qualityGateEngine.ts:68-133; compositionEngine.ts:522-539</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No AND/OR combination exists inside one gate's own criteria (one <code>criteria.type</code> per gate). Composability exists only at the multi-gate-list level: <code>evaluate()</code> iterates all active gates for a slot, first block/waive wins (lines 129-133), and cross-Pack composition is detected at <code>compositionEngine.ts:526-539</code>. This is a deliberate single-criteria-per-gate design (documented in-code, e.g. qualityGateEngine.ts:255-261), not an oversight.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">QG-004 Quality Gates remain independent of Participants<br> Ref: §5 QG-004</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">qualityGateEngine.ts:159-281</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No read of <code>actorId</code>, role, or any Participant attribute anywhere in <code>evaluateGate</code>'s branches; <code>authorId</code>/<code>authorBadge</code> on the input are used only for recording who ran the evaluation, not as evaluation input.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">QG-005 Quality Gate outcomes are traceable<br> Ref: §5 QG-005</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">qualityGateEvaluationsDB.ts (create-only); qualityGateEngine.ts:305, 328, 348</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every outcome path writes a row with <code>detail</code>. See FR-26.6/§14 below for the specific gap: a Passed outcome's <code>detail</code> is always <code>{}</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">QG-006 Quality Gates are deterministic given identical state<br> Ref: §5 QG-006</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">qualityGateEngine.ts:159-281</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No randomness, no network/external call, no wall-clock dependency in any branch; pure DB reads plus static status-set membership checks (<code>RESOLVED_OBLIGATION_STATUSES</code> etc., lines 33-55).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-26.1 Every Quality Gate has a globally unique identifier<br> Ref: §6 FR-26.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">quality_gates_schema_recovery.sql:4, 31-36</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>id</code> is a UUID primary key. The real content-identity constraint is <code>(entity_type, from_state, to_state, category, version, originating_pack_id)</code> (line 31-32), and the active-slot uniqueness additionally includes <code>originating_pack_id</code> (line 34-36) — narrower than a bare globally-unique code, but <code>id</code> itself is globally unique as required.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-26.2 Quality Gates are contributed through Packs<br> Ref: §6 FR-26.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">qualityGatesDB.ts:24-94; compositionCompleted.ts:123-127</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>qualityGatesDB.upsert</code> is the real Pack-publish write path (confirmed reachable from Pack publish, not a disconnected seed script), and <code>compositionCompleted.ts</code> reads exactly the Packs actually composed into an SEU (<code>qualityGatesDB.findByPackIds(composedPackIds)</code>) to materialise that SEU's own gate set. Both the authoring and the composition-scoping halves are real.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-26.3 Quality Gates support composition from multiple organisations<br> Ref: §6 FR-26.3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">compositionEngine.ts:522-539; compositionCompleted.ts:108-144; qualityGateEngine.ts:102-118</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Multiple Packs contributing different-category gates to the same transition is detected as non-conflicting and both compose into <code>ebms.applicable_quality_gate_ids</code>; same-transition-same-category contributions from different Packs are flagged as a commissioning-time conflict requiring resolution (compositionEngine.ts:535-538), consistent with §12's "Conflicts shall be resolved through Governance composition rules." Enforcement at transition time consults this materialised, per-SEU set (qualityGateEngine.ts:111-118), not a bare global table scan — this independently updates the chapter's own §19.3/19.9 "enforcement bypasses composition" claim, which predates CR-104.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-26.4 Quality Gates evaluate one or more engineering objects<br> Ref: §6 FR-26.4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">quality_gates_schema_recovery.sql:16-17; qualityGateEngine.ts:74-134</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>entity_type</code> CHECK permits 14 types (SEU, Deliverable, Objective, Obligation, Evidence, Knowledge, Decision, KnowledgeScope, AttentionItem, ExternalInteraction, Pack, Participant, Review, Finding); <code>evaluate()</code>'s dispatch is generic over <code>TransitionEntityType</code>, not hardcoded to one entity.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-26.5 Quality Gate outcomes are immutable<br> Ref: §6 FR-26.5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">qualityGateEvaluationsDB.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Module exposes only a <code>create</code> operation on <code>quality_gate_evaluations</code>; no update/delete function exists in the DB layer for this table.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-26.6 Quality Gate evaluations preserve complete traceability<br> Ref: §6 FR-26.6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">qualityGateEngine.ts:305-359; quality_gate_evaluations_schema_recovery.sql</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evaluated object, gate id, SEU id, outcome, and timestamp are all persisted on every path. Gap: <code>recordAndPass</code> (line 305) calls <code>create</code> with no <code>detail</code> argument, so a Passed outcome's <code>detail</code> is always empty — the specific Evidence/Decision/Review/Policy that satisfied the gate is never recorded, only the fact that something did. Block/Waive paths do record specifics (lines 177-179, 213, 240, 267-273).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-26.7 Quality Gates support explicit waivers<br> Ref: §6 FR-26.7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">qualityGateWaiversDB.ts; qualityGateEngine.ts:283-299, 342-360; qualityGateWaivers.ts:14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>blockOrWaive</code> checks for an active waiver on the exact (gate, entity) pair before finalizing a block, turning it into a recorded <code>Waived</code> outcome with its own event. Granting requires the real <code>qualitygate_waive</code> badge (<code>QUALITY_GATE_WAIVE_BADGE</code>, core/qualityGateWaivers.ts:14), unlike the unguarded Compliance waiver route the code comment contrasts itself against.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Illustrative gate categories (Entry/Exit/Release/Compliance/Operational)<br> Ref: §7 Categories</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">qualityGatesDB.ts:50 (<code>category</code> field, default "Exit")</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>category</code> is a free-standing text column, not restricted to the chapter's 5 illustrative names — it is instead bound to the Evidence category vocabulary (<code>category:evidence</code>) per the gate's own code comments, a deliberate reuse rather than the chapter's literal taxonomy. No CHECK constraint in the schema file inspected restricts it to the 5 named categories.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Quality Gate defines Identifier/Name/Category/Scope/Transition/Criteria/Reviews/Evidence/Decisions/Obligations/Policies/Waiver Rules/Version/Originating Pack<br> Ref: §8 Structure</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">quality_gates_schema_recovery.sql:3-39</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Identifier(<code>id</code>)/Name(<code>name</code>)/Category(<code>category</code>)/Scope+Transition(<code>entity_type</code>,<code>from_state</code>,<code>to_state</code>)/Criteria(<code>criteria</code>)/Version(<code>version</code>,<code>is_active</code>)/Originating Pack(<code>originating_pack_id</code>) are all real columns. Required Reviews/Evidence/Decisions/Obligations/Policies are not separate fields on the row at all — they are implied entirely by which single <code>criteria.type</code> string is chosen (qualityGateEngine.ts:163-280); there is no mechanism for a gate to declare more than one of these simultaneously. Waiver Rules exist as a related table (<code>quality_gate_waivers</code>), not a field on <code>quality_gates</code> itself.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Criteria may reference Deliverable state, Review outcomes, Evidence, Decisions, Policies, Obligations, compliance requirements, engineering metrics<br> Ref: §9 Evaluation Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">qualityGateEngine.ts:173-276</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Four of the eight referenceable things are real executable criteria types: unresolved Obligations (line 173), accepted Evidence/approved Decisions (line 184), accepted/passing Review (line 232), active Policy (line 262). Deliverable state, compliance requirements, and engineering metrics have no corresponding criteria type anywhere in the module — a gate cannot be written to block on "Deliverable is in state X" or on a Compliance subsystem check or on a metric threshold.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Quality Gate may treat a "Standard" Policy's adherence as blocking, overriding that Policy's own non-blocking default elsewhere<br> Ref: §9 ¶2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">qualityGateEngine.ts:245-276</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>requires_active_policy</code> always blocks on non-satisfaction of a referenced Policy regardless of that Policy's own <code>constraint_type</code>, exactly matching the chapter's described override mechanism (code comment at line 245-253 quotes the spec language directly).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Quality Gates are evaluated whenever a governed lifecycle transition is requested<br> Ref: §10 Evaluation</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">transitionEngine.ts:184-207; qualityGateEngine.ts:68-134</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">True for every entity type whose transition routes call <code>qualityGateEngine.evaluate</code> directly (confirmed for Deliverable-class core/*.ts callers) and for any <code>transition_definitions</code> row declaring <code>required_quality_gate_ids</code> (transitionEngine.ts:184). Gap: <code>transitionPack</code> (packs.ts:1133-1152) calls <code>transitionEngine.evaluate</code> without a <code>seuId</code>, so the <code>required_quality_gate_ids</code> guard at transitionEngine.ts:184 (<code>&& input.seuId</code>) never fires for Pack, and the code's own comment (packs.ts:1108-1114) states this is a structural consequence of Pack having no <code>seu_id</code> at all (NOT NULL on <code>quality_gate_evaluations.seu_id</code>), documented as a real limitation rather than silently skipped. <code>transitionObjective</code> (objectives.ts:1059) has the same structural gap.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evaluation determines satisfied/unsatisfied criteria, applicable waivers, blocking conditions, and supporting rationale as distinct elements<br> Ref: §10 Evaluation</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">qualityGateEngine.ts:57-66, 290-299</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The real return type (<code>QualityGateEvaluationResult</code>/<code>QualityGateListEvaluationResult</code>) carries only <code>{outcome, gate?, reason?}</code> — one flat reason string, not the five itemized elements the chapter describes. <code>blockOrWaive</code> does decide the waiver question internally (line 290-298) but that decision isn't surfaced as a separate structured field to the caller beyond the final outcome.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evaluation does not modify engineering state<br> Ref: §10 ¶ last</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">qualityGateEngine.ts:159-281</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Confirmed — same evidence as §4/QG-002 above.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Outcomes: Passed / Passed with Conditions / Blocked / Waived / Deferred / Not Applicable<br> Ref: §11 Outcomes</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">quality_gate_evaluations_schema_recovery.sql:10; qualityGateEngine.ts:57-66, 119, 150, 301-360</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The CHECK constraint permits all 6 values. Only <code>Passed</code>, <code>Blocked</code>, <code>Waived</code> are ever written by <code>qualityGateEngine</code> (lines 305, 328, 348). <code>NotApplicable</code> is returned in-memory (lines 119, 150) but never persisted — there is no gate id to attach it to when no gate applies. <code>Passed with Conditions</code> and <code>Deferred</code> are not produced anywhere in the module; nothing in the codebase constructs either value.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The outcome becomes an input to Governance, which decides whether the transition proceeds<br> Ref: §11 ¶ last</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">transitionEngine.ts:184-207</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">On <code>Blocked</code>, <code>transitionEngine.evaluate</code> returns <code>{allowed:false, reason:"quality_gate_blocked", ...}</code> to its caller, which is the actual transition-proceeds decision point. Confirmed layering.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Multiple organisations contribute Quality Gates that compose into an Effective Quality Gate set per SEU<br> Ref: §12 Composition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">compositionCompleted.ts:108-144; governanceModel.ts:1-95; qualityGateEngine.ts:102-118</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>compositionCompleted.ts</code> computes a real per-SEU <code>applicable_quality_gate_ids</code> from the SEU's actually-composed Packs, once at commissioning, and <code>qualityGateEngine.evaluate</code> consults exactly this materialised set for SEU-scoped entities (lines 106-117) — not a bare global match. A separate read-only projection, <code>governanceModel.getEffectiveGovernanceModel</code> (governanceModel.ts:25-95), independently re-derives a similar "Effective Quality Gates" list directly from the EBM's <code>composed_packs</code> for display purposes; this one remains report-only and is not the enforcement path, but enforcement itself (via the materialised <code>applicable_quality_gate_ids</code>) is real and SEU-scoped. This independently contradicts the chapter's own §19.9/Summary#1 claim that enforcement "completely bypasses" composition — that claim predates CR-104.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition preserves deterministic behaviour; conflicts resolved through Governance composition rules<br> Ref: §12 ¶ last</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">compositionEngine.ts:498-541</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>detectGovernanceConflicts</code> deterministically flags two Packs targeting the same (transition, category) slot as a conflict to resolve before commissioning (lines 526-539); different-category contributions to the same transition are explicitly not flagged (comment at lines 522-525).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Quality Gates may define explicit waiver mechanisms with justification, approving authority, scope, duration, risks, compensating controls<br> Ref: §13 Waivers</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">qualityGateWaiversDB.ts; qualityGateEngine.ts:283-299</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>rationale</code>→justification, <code>authority_badge</code>+<code>granted_by</code>→approving authority, the <code>(quality_gate_id, entity_type, entity_id)</code> triple→scope, <code>expires_at</code>→duration are all real columns, badge-gated as noted under FR-26.7. "Associated risks" and "compensating controls" have no dedicated columns; they are not separately modeled and would have to be folded into the free-text <code>rationale</code> field if an actor chooses to note them.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A waiver does not remove the gate; it modifies evaluation for a defined context<br> Ref: §13 ¶ last</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">qualityGateEngine.ts:283-299</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>blockOrWaive</code> leaves the gate definition untouched; a waiver only changes the recorded outcome for the one blocked <code>(gate, entity)</code> pair that has an active, unexpired waiver on file — every other entity the same gate applies to is unaffected.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every evaluation preserves evaluated object, applicable EBM, governing Policies, supporting Reviews/Evidence/Decisions, active Obligations, outcome, and timestamp<br> Ref: §14 Traceability</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">quality_gate_evaluations_schema_recovery.sql; qualityGateEngine.ts:177-179, 213, 240, 267-273, 305, 328, 348</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>quality_gate_id</code>/<code>entity_type</code>/<code>entity_id</code>/<code>seu_id</code>/<code>outcome</code>/<code>evaluated_at</code> are real columns on every row (evaluated object + timestamp, confirmed). Supporting Obligations/Evidence/Decisions/Reviews/Policies appear only inside the unstructured <code>detail</code> JSONB, and only on <code>Blocked</code> paths (e.g. <code>unresolvedObligationIds</code> at line 178) — a <code>Passed</code> outcome's <code>detail</code> is always empty (line 305 passes no <code>detail</code> argument), so the specific evidence that made a gate pass is never recorded. No applicable-EBM reference and no governing-Policy reference exist on the evaluation row at all; Policies are only ever referenced when the criteria type is itself <code>requires_active_policy</code>, and even then only inside <code>detail</code> on a block.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Historical evaluations remain reproducible<br> Ref: §14 ¶ last</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">qualityGateEvaluationsDB.ts (create-only); qualityGateEngine.ts:159-281</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The evaluation function is pure/deterministic given identical DB state (QG-006), and evaluation rows are append-only/immutable, so the recorded outcome itself is permanent. True reproducibility of "what the engine would conclude again today" is limited by the thin <code>detail</code> on Passed outcomes (above) and by no EBM-version pinning on the row — the underlying gate/EBM state the evaluation ran against is not separately snapshotted.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Events: QualityGateEvaluated, QualityGatePassed, QualityGateBlocked, QualityGateWaived, QualityGateDeferred, QualityGateConfigurationChanged<br> Ref: §15 Events</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">qualityGateEngine.ts:309-318, 329-338, 349-358</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>QualityGatePassed</code>, <code>QualityGateBlocked</code>, <code>QualityGateWaived</code> are each published from their respective <code>record*</code> function. <code>QualityGateEvaluated</code> (a generic evaluation-happened event, distinct from the specific outcome events), <code>QualityGateDeferred</code>, and <code>QualityGateConfigurationChanged</code> are not published anywhere in this module or found elsewhere in the repository search performed.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: deterministic evaluation<br> Ref: §16 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">qualityGateEngine.ts:159-281</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same evidence as QG-006.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: composition from multiple Packs<br> Ref: §16 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">compositionCompleted.ts:108-144; qualityGateEngine.ts:102-118</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same evidence as §12 above — this is independently confirmed real, not bypassed, superseding the chapter's own earlier self-audit on this point.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: preserve complete traceability<br> Ref: §16 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evidence under §14 above</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real for evaluated-object/outcome/timestamp; thin for the specific supporting evidence behind a Passed outcome, and no EBM/Policy reference on the row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: support historical reconstruction<br> Ref: §16 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">qualityGateEvaluationsDB.ts (create-only)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Append-only log is real; no EBM-version pinning per row limits exact reconstruction of the gate/EBM state at evaluation time.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: remain independent of Participant implementations<br> Ref: §16 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">qualityGateEngine.ts:159-281</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same evidence as QG-004.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Quality Gates evaluate readiness without changing engineering state<br> Ref: §17 AC</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">qualityGateEngine.ts:159-281</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Confirmed, same evidence as §4.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Evaluation criteria are declarative<br> Ref: §17 AC</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">qualityGatesDB.ts:52; qualityGateEngine.ts:163-280</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real JSONB storage; 4 executable shapes, closed set. Same caveat as QG-001.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Quality Gates support multi-organisation composition<br> Ref: §17 AC</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">compositionCompleted.ts:108-144; compositionEngine.ts:522-539</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Confirmed real and enforced (see §12 above).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Waivers are explicit, governed and traceable<br> Ref: §17 AC</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">qualityGateWaiversDB.ts; core/qualityGateWaivers.ts:14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Confirmed, badge-gated.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Evaluation outcomes are reproducible<br> Ref: §17 AC</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">qualityGateEngine.ts:159-281</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Confirmed deterministic given identical state; see reproducibility caveat above for historical reconstruction specifically.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Historical Quality Gate evaluations remain available<br> Ref: §17 AC</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">qualityGateEvaluationsDB.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Append-only, no delete path, confirmed.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Quality Gate domain model<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">seuTypes.ts (QualityGateRow/QualityGateEvaluationRow/QualityGateWaiverRow types, referenced throughout qualityGateEngine.ts/qualityGatesDB.ts)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real typed rows for all three.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Quality Gate registry<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">qualityGatesDB.ts; quality_gates_schema_recovery.sql</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real table and DB-layer module; still a single table (not per-SEU), but per-SEU scoping is achieved by composition-time materialisation (§12), not by the registry itself being partitioned.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Quality Gate evaluation service<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">qualityGateEngine.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real, confirmed above.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Waiver management service<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">qualityGateWaiversDB.ts; core/qualityGateWaivers.ts; api/qualityGateWaivers.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real, confirmed above.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Quality Gate composition service<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">compositionEngine.ts:498-541; compositionCompleted.ts:108-144</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Both conflict detection and per-SEU materialisation are real and connected to live enforcement (§12).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Quality Gate APIs<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">api/qualityGateWaivers.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Only a waiver grant/list API exists; no dedicated <code>/quality-gates</code> CRUD route was found anywhere under <code>src/routes/seu/api/</code>. Gates themselves are authored only via Pack SDK authoring form fields, not a standalone API.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Quality Gate events<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">qualityGateEngine.ts:309-318, 329-338, 349-358</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">3 of the chapter's 6 named events are published (<code>QualityGatePassed</code>/<code>QualityGateBlocked</code>/<code>QualityGateWaived</code>); <code>QualityGateEvaluated</code>/<code>QualityGateDeferred</code>/<code>QualityGateConfigurationChanged</code> are not.</td>
    </tr>
  </tbody>
</table>
## Summary

- Total intents analysed: 42
- Fully met: 22
- Partially met: 20
- Not met: 0
- Not Verifiable: 0

## Major Implementation Gaps (independently confirmed)

1. **Criteria are a closed set of 4 hardcoded type strings**, not a generic declarative composition. §9's 8 referenceable categories are only 4/8 covered (Deliverable state, compliance requirements, and engineering metrics have no criteria type at all).
2. **No composite (AND/OR) logic within one gate.** One gate carries exactly one `criteria.type`; multi-condition gates don't exist at the single-gate level, only as separate gates in a list.
3. **Pack and Objective transitions never evaluate `required_quality_gate_ids`-style gates**, because `transitionEngine.evaluate` is called without a `seuId` for these two entity types, and the guard at `transitionEngine.ts:184` requires one. This is structurally rooted in `quality_gate_evaluations.seu_id` being NOT NULL — Pack/Objective have no `seu_id` to record against — and is documented in-code as a known limitation, not silently skipped.
4. **3 of 6 chapter-specified outcomes are producible** (`Passed`/`Blocked`/`Waived`); `Passed with Conditions` and `Deferred` are schema-only, never written.
5. **A Passed outcome's `detail` is always empty** — the specific Evidence/Decision/Review/Policy that satisfied a gate is never recorded, only the fact that one did. No EBM or Policy reference exists on any evaluation row.
6. **3 of 6 chapter-specified events are published** (`QualityGatePassed`/`QualityGateBlocked`/`QualityGateWaived`); `QualityGateEvaluated`, `QualityGateDeferred`, `QualityGateConfigurationChanged` are never published anywhere found in the repository.
7. **No dedicated Quality Gate CRUD API** — gates are authored only through Pack SDK authoring; only a waiver-specific API route exists.
8. **"Associated risks" and "compensating controls" on a waiver** have no dedicated columns; foldable only into free-text `rationale`.

## Correction to the Chapter's Own Embedded §19 Audit

This independent review found that the chapter's own §19 (dated 2026-08-22, post-CR-058) is now stale on its single most load-bearing claim: that per-SEU, Pack-composed Quality Gate enforcement bypasses composition and remains a global-table collision. Direct inspection of `compositionCompleted.ts`, `qualityGatesDB.ts`, and `qualityGateEngine.ts` shows this was closed by **CR-104** (`ebms.applicable_quality_gate_ids`, materialised once at commissioning from the SEU's actually-composed Packs, and consulted live by `qualityGateEngine.evaluate`) together with a migration (`248`) that scoped the active-slot unique index to include `originating_pack_id`. The chapter's §19 opening note and its ranked Summary item 1 should be treated as superseded by CR-104, not current.
