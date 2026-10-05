# Chapter 24 – Policy Model: Implementation Traceability

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">Policy declares conditions that govern engineering actions; does not execute work, grant authority, or perform reviews<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/policyEngine.ts:1-133</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>policyEngine.evaluate</code> only reads candidate Policy rows and evaluates a <code>governingCondition</code> against context; it never mutates engineering state, authority, or review records. Authority is checked separately by <code>transitionEngine</code>/<code>requireBadge</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Constraint Type (Policy = mandatory/blocking, Standard = preferred/non-blocking) is the enforcement axis; both are Policies<br> Ref: §1, §4, §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/policy_definitions_schema_recovery.sql:9-10<br>src/domain/engine/policyEngine.ts:114-129</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>constraint_type</code> is a DB-level CHECK (<code>'Policy'</code>/<code>'Standard'</code>). <code>policyEngine.evaluate</code> returns <code>Blocked</code> only for <code>constraint_type === "Policy"</code>; a <code>"Standard"</code> violation is recorded as <code>deviatedPolicyIds</code> and a <code>StandardPolicyDeviation</code> event, non-blocking.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Policies never directly modify engineering state<br> Ref: §4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/policyEngine.ts:31-133</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>evaluate</code> is read-only: it queries SEU/EBM/Policy/Deliverable rows and publishes events; no write call to any entity's own state column.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PM-001 Policies are declarative<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/policyDefinitionsDB.ts:14-94<br>src/dblayer/policiesDB.ts:11-63</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>policy_definitions</code>/<code>policies</code> rows store <code>conditions</code>/<code>condition</code> as structured JSON data consumed by a separate evaluator (<code>governingCondition.ts</code>), not executable code.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PM-002 Policies are composable<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/policiesDB.ts:95-109<br>src/domain/engine/compositionEngine.ts:241-290</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>policiesDB.findByPackIds</code> aggregates every Policy row across a SEU's composed Packs; <code>compositionEngine.ts</code> applies the same Merge/Union/Override combination logic used for every other composable kind. No Policy-specific combination rule exists, but the generic mechanism applies.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PM-003 Policies are independently versioned<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/policy_definitions_schema_recovery.sql:15,24<br>src/dblayer/policiesDB.ts:6-10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>policy_definitions</code> carries its own <code>version</code> with a <code>UNIQUE(code, version, tenant_id)</code> constraint — independent versioning at the canonical-definition level. The Pack-owned <code>policies</code> row (§19.2) is explicitly NOT versioned (<code>originating_pack_id, code</code> identity, no version column) — by design, since it is materialized fresh at each Pack republish rather than independently versioned itself.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PM-004 Policies are traceable<br> Ref: §5, §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/policyEngine.ts:85-129<br>src/dblayer/eventsDB.ts:227-246</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every evaluation publishes <code>PolicyApplied</code>/<code>PolicyViolated</code>/<code>StandardPolicyDeviation</code> with <code>policyCode</code>, entity/transition and actor/badge. Events are the durable record; no separate <code>policy_evaluations</code> audit table exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PM-005 Policies are context-sensitive<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/policyEngine.ts:83<br>src/domain/engine/governingCondition.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>evaluateCondition(policy.condition, input.context)</code> evaluates against the caller-supplied context (e.g. <code>{ deliverable }</code>), so outcome varies with runtime state.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PM-006 Policies remain independent of Participant implementations<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/policyEngine.ts:1-133</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Policy evaluation never references a Participant's own implementation/code; it reads Deliverable/EBM/context data only. Participant-facing eligibility use (scope "Eligibility") reads the same declarative <code>condition</code>/<code>governingCondition</code> shape, not Participant internals.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PM-007 Every Policy declares a Constraint Type, independent of Severity<br> Ref: §5, §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:697-724 (PolicyCondition.severity)<br>src/dblayer/recovery/policy_definitions_schema_recovery.sql:9-10 (constraint_type)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>constraint_type</code> is a top-level Definition field; <code>severity</code> is a per-condition field (<code>PolicyCondition.severity</code>), stored and validated independently — no shared column or coupling between the two.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-24.1 Every Policy has a globally unique identifier<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/policy_definitions_schema_recovery.sql:4,24<br>src/dblayer/policiesDB.ts:6-10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>policy_definitions.id</code> is a UUID primary key; canonical identity is <code>(code, version, tenant_id)</code> not a bare global code. The Pack-owned <code>policies</code> row's identity is <code>(originating_pack_id, code)</code> — explicitly not globally unique (two Packs may share a code; <code>policiesDB.findByCode:74-82</code>'s own comment flags this as a known, deliberately-unaddressed risk for Transition Definition authoring's policy-code lookup).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-24.2 Policies are contributed through Packs<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/policiesDB.ts:11-63 (originating_pack_id NOT NULL in INSERT path)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every <code>policies</code> row is created via Pack-publish materialization (<code>originatingPackId</code> required). No path writes a Pack-owned Policy row outside Pack publication.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-24.3 Policies support composition from multiple organisations<br> Ref: §6, §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/policiesDB.ts:95-109<br>src/domain/engine/compositionEngine.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>findByPackIds</code> pulls Policy rows from every Pack composed into a SEU's EBM (Platform Policy Pack + tenant/customer/compliance Packs), matching the §10 diagram.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-24.4 Policies are evaluated during governance evaluation<br> Ref: §6, §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:247-264<br>src/routes/seu/core/commissioning.ts:573</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>evaluateDeliverableTransition</code> calls <code>policyEngine.evaluate</code> for Deliverable transitions; <code>commissioning.ts</code> calls it for the SEU's own Activated→Operational hop. Both sit alongside Quality Gate/Authority checks in the governed-transition path.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-24.5 Policy evaluations remain fully traceable<br> Ref: §6, §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/policyEngine.ts:85-129</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same evidence as PM-004: every evaluated Policy (satisfied, violated-blocking, or violated-deviating) publishes an event carrying policy/entity/transition identity.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Partially met — see Gap</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-24.6 Policies support explicit exceptions<br> Ref: §6, §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts: PolicyExceptionRule shape (via PolicyCondition.exceptionRules)<br>src/routes/seu/core/policyDefinitions.ts:241-257</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>exceptionRules[]</code> is authored and validated (statement, approvers against real badges, composition all/any) per condition, gated to <code>constraintType === "Policy"</code> (§12).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-24.6 Gap<br> Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/policyEngine.ts:1-133</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>exceptionRules</code> is declarative only. No runtime path lets an actor request or approve an exception, and <code>policyEngine.evaluate</code> never checks for an approved exception before blocking — a declared exception has no effect on the <code>Blocked</code> outcome. <code>PolicyExceptionRequested</code>/<code>PolicyExceptionApproved</code> (§15) are never published anywhere in the codebase.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-24.7 Policy conflicts are detected<br> Ref: §6, §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:241-290</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Only the generic cross-source field-disagreement detector applies (same-code Override collision, or a Merge/Union field mismatch flagged in <code>conflicts[]</code>). There is no Policy-specific content-level conflict detection (e.g. two different Policies whose conditions logically contradict), matching §19.12's own stated gap.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-24.8 Every Policy declares a Constraint Type of Policy or Standard<br> Ref: §6, §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/policy_definitions_schema_recovery.sql:9-10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">DB CHECK constraint enforces exactly these two values at both <code>policy_definitions</code> and <code>policies</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-24.9 Governance evaluation blocks on Policy violation, proceeds on Standard deviation<br> Ref: §6, §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/policyEngine.ts:114-129</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Exactly this branching: <code>constraint_type === "Policy"</code> → <code>Blocked</code>; otherwise → <code>deviatedPolicyIds</code> + <code>StandardPolicyDeviation</code> event, loop continues.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§7 Policy Categories (Engineering/Security/Quality/Operational/Documentation/Customer/Organisation), extensible via Packs<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/ontologyConcepts.json:2037-2091,5466-5484</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">10 <code>category:policy</code> Ontology concepts seeded: the 7 named plus Compliance/Privacy/Ethics (§19.3). <code>category</code> on <code>policy_definitions</code> is validated against this Ontology type (<code>policyDefinitions.ts:287-292</code>), so additional categories can be proposed without a code change.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§8 Policy Structure — Identifier, Name, Description, Category, Constraint Type, Applicability, Conditions, Required Evidence, Related Obligations, Exception Rules, Severity, Version, Originating Pack<br> Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/policy_definitions_schema_recovery.sql:4-24<br>src/dblayer/seuTypes.ts:697-724</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All named fields exist: <code>id</code>/<code>code</code> (identifier), <code>name</code>, <code>description</code>, <code>category</code>, <code>constraint_type</code>, <code>applicability_environments</code> + per-condition <code>applicabilityDeliverables</code> (applicability), <code>conditions[]</code>, <code>conditions[].requiredEvidence</code>, <code>conditions[].relatedObligations</code>, <code>conditions[].exceptionRules</code>, <code>conditions[].severity</code>, <code>version</code>. "Originating Pack" exists only on the Pack-owned <code>policies</code> row (<code>originating_pack_id</code>), not on <code>policy_definitions</code> itself — the canonical catalog has no originating-Pack field, consistent with §19.2's "no relationship to any other entity," but a literal reading of §8 names this as a Policy-level field.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§8 Constraint Type and Severity are independent fields<br> Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:697-706 (severity on PolicyCondition) vs. recovery sql:9-10 (constraint_type on policy_definitions)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Confirmed independent: different tables/levels, no shared column, no derivation of one from the other anywhere in <code>policyDefinitions.ts</code>'s validation.</td>
    </tr>
| §9 Applicability by Deliverable, Deliverable lifecycle state, Environment; dynamically evaluated | §9 | src/dblayer/seuTypes.ts:691-696<br>src/domain/engine/policyEngine.ts:62-78 | `applicabilityEnvironments` and per-condition `applicabilityDeliverables[].name`/`.transitions` exist and are read at evaluation time (`policyEngine.ts:72-77` filters live by the actual Deliverable's name). "Deliverable lifecycle state" as its own applicability axis is not a separate field — applicability is expressed as a transition edge (`Deliverable|From|To`) rather than a bare lifecycle-state value; §19.5 explains this as a deliberate implementation choice. Evaluation is dynamic (live DB read + live context), matching §9's requirement. | Fully met |
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§10 Policy Composition — multiple Packs combine into an Effective Policy Set; deterministic; conflicts detected/resolved per Governance rules<br> Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/policiesDB.ts:95-109<br>src/domain/engine/compositionEngine.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition is deterministic (same inputs, same <code>combineFields</code> output) and multi-Pack (confirmed under FR-24.3). Conflict detection is the generic cross-field mechanism, not Governance-rule-specific resolution — see FR-24.7 gap.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§11 Policy evaluation determines applicable policies, satisfied/violated conditions, required evidence/obligations, applicable exceptions<br> Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/policyEngine.ts:49-131</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Determines applicable policies (relevantPolicyIds→governedTransition filter) and satisfied/violated outcome per policy. <code>requiredEvidence</code>/<code>relatedObligations</code> are authored fields but are not consulted or surfaced by <code>policyEngine.evaluate</code> itself (no evidence/obligation check performed during evaluation); "applicable exceptions" are never resolved during evaluation (same gap as FR-24.6).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§11 Policy "Policy" violation blocks the transition; "Standard" deviation proceeds and is traceable through Engineering Telemetry (Ch.35)<br> Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/policyEngine.ts:104-129<br>src/routes/seu/core/telemetry.ts:285-290<br>src/dblayer/eventsDB.ts:227-246</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Exact branching confirmed (see FR-24.9). <code>telemetry.ts:285-290</code> reads <code>countStandardPolicyDeviations</code> off the <code>StandardPolicyDeviation</code> event type for sustained-pattern surfacing, matching the Ch.35 cross-reference.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§11 Evaluation shall not itself change engineering state<br> Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/policyEngine.ts:31-133</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Confirmed under the earlier "never directly modify engineering state" row — no state write inside <code>evaluate</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§12 Exceptions specify justification, approving authority, duration, scope, review requirements<br> Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts (PolicyExceptionRule, referenced via conditions[].exceptionRules)<br>src/routes/seu/core/policyDefinitions.ts:241-257</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All five named sub-fields are present and authored: <code>exceptionStatement</code>, <code>exceptionApprovers</code> (real Authority Vocabulary badges), <code>duration</code>, <code>exceptionScope</code>, <code>reviewRequirements</code>, plus <code>identifier</code>/<code>exceptionComposition</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§12 Exceptions apply only to Constraint Type "Policy"; Standard deviations never need a formal exception<br> Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/policyDefinitions.ts:235-240</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Validation explicitly rejects <code>exceptionRules</code> on a <code>"Standard"</code> Definition.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§12 Exceptions shall remain fully traceable<br> Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/policyEngine.ts:1-133</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No runtime exception request/approval exists (FR-24.6 gap), so there is nothing to trace — <code>exceptionRules</code> is traceable only as static authored content (via the Definition's own version history), not as an exercised exception event.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§13 Policy lifecycle: Draft → Validated → Published → Active → Deprecated → Retired → Archived<br> Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/policy_definitions_schema_recovery.sql:16-17<br>src/routes/seu/core/policyDefinitions.ts:371-378</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">DB CHECK constraint and <code>AUTHORING_NEXT_STATE</code> map both carry exactly this 7-state sequence, verbatim from §13 (§19.4 — Service Definition's leaner 6-state lifecycle was explicitly rejected for Policy).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§13 Historical Policies remain available for engineering reconstruction<br> Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/policyDefinitionsDB.ts:160-224</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>findById</code>/<code>findByCodeAndVersion</code> read any row regardless of status; no delete path exists for <code>policy_definitions</code>, so superseded Versions remain queryable. No dedicated "reconstruction" API was found (e.g. resolving which exact Policy Version an historical EBM evaluation used) beyond the raw row lookup.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§14 Policy Traceability — identifier, originating Pack, EBM version, applicable Deliverables, applicable Decisions, outcome, timestamp, rationale, immutable history<br> Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/policyEngine.ts:85-129</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each event carries <code>policyCode</code> (identifier), entity/transition context (applicable Deliverable), outcome (<code>PolicyApplied</code>/<code>PolicyViolated</code>), and an implicit timestamp (event row). "Originating Pack," "EBM version," "applicable Decisions," and explicit "rationale" are not carried in the event payload — the event's <code>originatingObjectId</code> resolves to the Policy row, from which <code>originating_pack_id</code> could be joined, but it is not denormalized into the trace record itself. Events are append-only (no update/delete path in <code>eventsDB.ts</code>), so immutability holds for what is recorded.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§15 Events: PolicyCreated, PolicyValidated, PolicyPublished, PolicyApplied, PolicyViolated, PolicyExceptionRequested, PolicyExceptionApproved, PolicyRetired<br> Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/policyDefinitions.ts:356-365 (lifecycle, Definition-suffixed names)<br>src/domain/engine/policyEngine.ts:92-129 (PolicyApplied/PolicyViolated)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Lifecycle events are published under <code>PolicyDefinitionValidated/Published/Activated/Deprecated/Retired/Archived</code> naming (§19.4/§19.10 — Definition-suffixed, not §15's literal <code>PolicyCreated</code>/<code>PolicyValidated</code>/<code>PolicyRetired</code> names; there is also no distinct "PolicyCreated" event — Draft creation is a plain DB insert with no event). <code>PolicyApplied</code>/<code>PolicyViolated</code> match §15 literally. <code>PolicyExceptionRequested</code>/<code>PolicyExceptionApproved</code> are not published anywhere in the codebase (confirmed by repository-wide search).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§16 NFRs: deterministic evaluation, composition support, traceability, versioning, technology independence<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/policyEngine.ts; src/domain/engine/compositionEngine.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evaluation is deterministic (pure function of stored condition + context). Composition and traceability covered above. Versioning covered under PM-003 (partial — Pack-owned row not independently versioned). Technology independence: <code>condition</code>/<code>conditions</code> are plain JSON, evaluated by a generic TypeScript evaluator with no external technology dependency.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§17 Acceptance: Constraint Type "Policy" blocks; "Standard" does not<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/policyEngine.ts:114-129</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Directly satisfied; already confirmed under FR-24.9.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§17 Acceptance: Exceptions are explicitly governed<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/policyEngine.ts:1-133</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Not satisfied at runtime — same gap as §12/FR-24.6: an authored exception has no governed approval workflow and is never consulted by the blocking evaluation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§17 Acceptance: Historical Policy versions remain reproducible<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/policyDefinitionsDB.ts:160-180</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Rows are retained and queryable by id/code+version; "reproducible" in the sense of re-reading exact historical content is supported. Whether a *consumer* (e.g. a past EBM's evaluation) can be replayed against that exact historical Version is not separately implemented — only the EBM's materialized <code>applicable_policy_ids</code> snapshot (current Pack-owned rows, not versioned) is used at evaluation time.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§18 Deliverables: domain model, registry, evaluation service, composition service, exception management service, APIs, events<br> Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/policyDefinitionsDB.ts; src/dblayer/policiesDB.ts; src/routes/seu/web/policyDefinitionRegistry.ts; src/domain/engine/policyEngine.ts; src/domain/engine/compositionEngine.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Domain model, registry, evaluation service, composition service (generic), and web/API surface all exist and were traced above. "Exception management service" does not exist as a runtime component — <code>exceptionRules</code> is authored data only, with no request/approval service behind it (same gap as §12).</td>
    </tr>
  </tbody>
</table>
## Summary

- Total intents analysed: 31
- Fully met: 17
- Partially met: 11
- Not met: 3
- Not Verifiable: 0

## Major implementation gaps

- **Exception governance is not built** (§12, FR-24.6, §17, §18). `exceptionRules` is fully structured and authored (justification, approvers, duration, scope, review requirements), but no runtime path exists to request or approve an exception, and `policyEngine.evaluate` never checks for an approved exception before returning `Blocked`. `PolicyExceptionRequested`/`PolicyExceptionApproved` (§15) are never published anywhere.
- **No Policy-specific conflict detection** (§10, FR-24.7). Only the generic cross-source composition conflict detector (same-code Override collision, Merge/Union field mismatch) applies; there is no evaluation of whether two distinct Policies' conditions logically contradict.
- **Policy Traceability record is incomplete relative to §14's literal field list.** Evaluation events carry identifier, entity/transition context, outcome and timestamp, but not originating Pack, EBM version, applicable Decisions, or an explicit rationale field.
- **§15 event names diverge from the literal specification.** Lifecycle events use `PolicyDefinition*`-suffixed names rather than §15's bare `PolicyCreated`/`PolicyValidated`/`PolicyRetired`; there is no event at all for Draft creation.
- **Pack-owned `policies` row identity is not globally unique** (FR-24.1), and is not itself independently versioned (PM-003) — versioning exists only at the canonical `policy_definitions` level.
- **Chapter's own §19.11 self-assessment does not match the seed data inspected.** §19.11 states all 34 seeded canonical Policies "still carry the pre-redesign flat `conditions[]` shape." The seed file sampled (`policy-adr-required.json`) already uses the current structured shape (`statement`/`severity`/`applicabilityDeliverables`/`requiredEvidence`/`relatedObligations`/`exceptionRules` per condition), though every sampled file's `applicabilityDeliverables`/`exceptionRules` arrays are empty and `severity` uses free-text values not yet validated against the seeded `category:policy-condition-severity` Ontology type (since seed data is inserted directly, bypassing `validatePolicyDefinitionSeed`).
