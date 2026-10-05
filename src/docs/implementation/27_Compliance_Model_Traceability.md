# Chapter 27 — Compliance Model — Implementation Traceability

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">Compliance represents regulatory/contractual/organisational/industry requirements, achieved via coordinated governance primitives (Policies, Authority, Reviews, Quality Gates, Obligations, Evidence)<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/compliance.ts:19-24,61-104</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>evaluateRequirement</code> dispatches on declarative criteria types that read Obligations, Evidence, Decisions and Reviews directly. <br>Policies and Authority are not consulted by any criteria type — no <code>requires_policy_applied</code> / <code>requires_authority_granted</code> case exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Compliance is an emergent evaluated outcome, not a single object<br> Ref: §1, §4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/compliance.ts:127-182</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>evaluateCompliance</code> computes status purely from current Obligation/Evidence/Decision/Review state plus Waivers; no single "Compliance object" is authored.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Chapter scope: Compliance abstraction, composition, evaluation, evidence, reporting, traceability (and explicitly excludes individual regulatory frameworks/legal interpretations, contributed via Packs)<br> Ref: §2 Scope</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/complianceDB.ts:9-23<br>src/dblayer/seed/seedCompliancePacks.ts:1-80 (entire file commented out)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>upsertFramework</code>/<code>upsertRequirement</code> exist as the abstraction layer, but the "contributed via Packs" half of §2 has no live pipeline: <code>seedCompliancePacks.ts</code> — the only code that would publish the 33 <code>compliance-*.pack.json</code> seed files as Compliance Frameworks/Requirements — is entirely commented out and not called from <code>cleanSlate.ts</code> (line 21 import also commented).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Architectural position: Compliance Packs → EBM → {Policies, Authority, Reviews, Quality Gates, Obligations, Evidence} → Compliance Evaluation → Compliance Status<br> Ref: §3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/compliance.ts:51-57,127-134</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>composedPackIds</code> reads the SEU's active EBM's <code>composed_packs</code>; <code>findApplicableFrameworks</code> filters frameworks by those pack ids (or platform-wide). <br>However, Compliance Packs today compose through the separate <code>compliancePackCodes</code> category-selection mechanism (profiles.ts:104,393; templates.ts:102,400; sdkAuthoring.ts:184,1069) which feeds Policies/Obligations/QualityGates via normal Pack contribution — it does not feed <code>compliance_frameworks</code>/<code>compliance_requirements</code>, so the diagram's top box ("Compliance Packs") is disconnected from the bottom evaluation box in the live system.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Definition: compliance is the demonstrable satisfaction of applicable governance requirements, evaluated from multiple components<br> Ref: §4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/compliance.ts:119-125,153-159</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>rollUp</code> computes one of the five statuses from satisfied/waived/unsatisfied counts across all applicable requirements.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">CM-001 Compliance is declarative<br> Ref: §5 CM-001</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/complianceDB.ts:25-53 (criteria: Record<string, unknown>)<br>compliance.ts:61-104</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Requirements store <code>criteria</code> as a declarative JSON object (<code>{type, category}</code>) interpreted by a fixed set of evaluators; no imperative code is authored per requirement.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">CM-002 Compliance is composable<br> Ref: §5 CM-002</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/compliance.ts:127-160</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Multiple frameworks/requirements compose freely per SEU via <code>findApplicableFrameworks</code>/<code>findRequirementsByFrameworkCodes</code>; conflicts across composed requirements are explicitly detected (<code>detectConflicts</code>).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">CM-003 Compliance is evidence-based<br> Ref: §5 CM-003</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/compliance.ts:61-104,134 (<code>supporting</code> ids)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each requirement result carries <code>supporting</code> ids of the real Obligation/Evidence/Decision/Review rows that satisfied it.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">CM-004 Compliance is continuously evaluated<br> Ref: §5 CM-004</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/compliance.ts:127 (pure function of current state)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evaluation is a pure, idempotent read over current state, callable at any time (API/web GET), so "continuous" holds by construction rather than via a scheduler. <br>No automatic re-evaluation on every relevant state change (e.g. on obligation transition) exists — it is evaluated on demand only.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">CM-005 Compliance shall remain fully traceable<br> Ref: §5 CM-005</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/complianceDB.ts:134-165</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each evaluation snapshot records <code>status</code>, <code>rationale</code> (counts, frameworks, conflicts) and <code>results</code> (with <code>supporting</code> ids), append-only. <br>§13's full traceability field set (applicable framework, contributing Packs, supporting Policies, supporting Reviews, supporting Evidence, related Deliverables, applicable Authority, timestamp) is not stored verbatim — Policies, Authority and "contributing Packs" per requirement are absent from the persisted snapshot.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">CM-006 Compliance shall remain independent of specific regulatory frameworks<br> Ref: §5 CM-006</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/complianceDB.ts:9-53</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Frameworks/requirements are generic rows with a <code>code</code>; no regulatory framework name is hard-coded in <code>compliance.ts</code> or <code>complianceDB.ts</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-27.1 Compliance requirements shall be contributed through Packs<br> Ref: §6 FR-27.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/seedCompliancePacks.ts:1-80 (commented out)<br>src/routes/seu/api/compliance.ts:33-72 (manual registration only)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The only live path to create a <code>compliance_frameworks</code>/<code>compliance_requirements</code> row is the manual config API (<code>POST /compliance/frameworks</code>, <code>POST /compliance/requirements</code>), confirmed by compliance-model.test.ts calling <code>complianceDB.upsertFramework/upsertRequirement</code> directly. <br><code>publishPack</code> (src/routes/seu/core/packs.ts) has no reference to <code>complianceDB</code>, and none of the 33 <code>compliance-*.pack.json</code> files contain a <code>complianceRequirements</code>/<code>complianceFrameworks</code> contribution field (contributions keys confirmed: capabilities, services, authorityRules, policies, checklists, reviewGates, qualityGates, obligationDefinitions).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-27.2 The platform shall support multiple compliance frameworks simultaneously<br> Ref: §6 FR-27.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/compliance.ts:128-131</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>findApplicableFrameworks</code>/<code>findRequirementsByFrameworkCodes</code> operate over arrays of codes; compliance-model.test.ts exercises multiple independent frameworks applying to the same SEU concurrently.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-27.3 Compliance evaluation shall be deterministic<br> Ref: §6 FR-27.3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/compliance.ts:61-104 (default case fails closed)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every criteria type is a pure function of current DB state; an unrecognised criteria type fails closed (<code>unsatisfied</code>) rather than being silently skipped, preserving determinism.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-27.4 Compliance shall be evaluated continuously throughout the SEU lifecycle<br> Ref: §6 FR-27.4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/web/compliance.ts:21-38</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evaluation is available at any SEU lifecycle point via the GET view/API route; it is on-demand (pull), not a push triggered by every lifecycle transition. Same gap as CM-004.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-27.5 Compliance evidence shall remain traceable<br> Ref: §6 FR-27.5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/compliance.ts:61-104 (<code>supporting</code> arrays)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Supporting record ids are attached per requirement result and persisted in the snapshot's <code>results</code> column.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-27.6 Compliance status shall be reproducible for any historical point in time<br> Ref: §6 FR-27.6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/complianceDB.ts:134-165<br>tests/compliance-model.test.ts:81-84</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>compliance_evaluations</code> is append-only (no UPDATE/DELETE path in <code>complianceDB</code>); <code>findEvaluationHistory</code> returns all past snapshots ordered by <code>created_at DESC</code>, each with its own status/results. <br>This reproduces the status AS OF each evaluation TIME, not an arbitrary point in time between evaluations (no point-in-time recomputation from historical obligation/evidence state).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-27.7 Compliance conflicts shall be detected and reported<br> Ref: §6 FR-27.7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/compliance.ts:108-117<br>tests/compliance-model.test.ts:107-120</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>detectConflicts</code> reports pairs of applicable requirements that declare each other in <code>conflicts_with</code>; verified by test. Conflicts are reported only, never auto-resolved, matching spec.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§7 Compliance sources: Regulatory/Customer/Organisation/Industry Standard/Internal Governance Packs, multiple coexisting<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/complianceDB.ts:68-79 (originating_pack_id nullable, ANY match)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The data model supports multiple originating Packs per framework and multiple frameworks per SEU. <br>Because FR-27.1's Pack-contribution pipeline is disabled (see above), no compliance-*.pack.json actually produces a framework/requirement row distinguishing Regulatory vs Customer vs Organisation vs Industry vs Internal Governance sources — that categorisation exists only in the Pack's own <code>category</code> field, not threaded into <code>compliance_frameworks</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§8 Compliance Components: Packs may contribute Policies, Authority Rules, Review Requirements, Quality Gates, Obligations, Evidence Requirements, Traceability Requirements, Ontology Concepts, Reporting Requirements<br> Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/compliance.ts:61-104</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Of the nine listed components, the evaluator consumes only four: Obligations (<code>no_unresolved_obligations</code>), Evidence (<code>requires_accepted_evidence</code>), Decisions (<code>requires_approved_decision</code>, not listed in §8 but used), and Reviews (<code>requires_accepted_review</code>). Policies, Authority Rules, Evidence "Requirements" (as distinct from Evidence items), Traceability Requirements, Ontology Concepts and Reporting Requirements have no corresponding criteria type.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§9 Compliance evaluation determines applicable requirements, satisfied requirements, outstanding obligations, missing evidence, failed reviews, applicable waivers, residual compliance risks; evaluation shall not modify engineering state<br> Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/compliance.ts:127-182<br>tests/compliance-model.test.ts:70-72</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Applicable requirements, satisfied/unsatisfied partition and active waivers are all computed and returned. <br>"Residual compliance risks" has no distinct representation beyond the unsatisfied-requirement list (no severity-weighted risk score). <br>Read-only is explicitly asserted by test (deliverable lifecycleState unchanged after evaluation).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§10 Compliance Status: one of Compliant / Compliant with Exceptions / Partially Compliant / Non-Compliant / Compliance Unknown, with supporting rationale<br> Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/compliance.ts:119-125<br>src/dblayer/complianceDB.ts:134-145</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>rollUp</code> produces exactly these five string values (ComplianceStatus type, seuTypes.ts:1428); <code>recordEvaluation</code> persists a <code>rationale</code> object (counts, frameworks, conflicts) alongside status.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§11 Compliance evidence shall reference Reviews, Deliverables, Decisions, Policies, Quality Gates, Obligations, Evidence Items, Traceability records; shall support external verification<br> Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/compliance.ts:68-98 (supporting ids from Obligations/Evidence/Decisions/Reviews)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Supporting ids are captured for Obligations, Evidence Items, Decisions and Reviews. Deliverables, Policies, Quality Gates and Traceability records are never referenced as supporting evidence by any criteria type. "External verification" support is limited to raw ids in the JSON snapshot; no export/verification-artifact format exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§12 The platform shall support generation of compliance reports, derived from engineering state rather than maintained separately<br> Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/compliance.ts:195-212<br>tests/compliance-model.test.ts:122-134</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>generateComplianceReport</code> calls <code>evaluateCompliance</code> fresh each time and projects its result into satisfied/outstanding/waived/waivers/conflicts — confirmed derived, not separately stored. Report includes applicable frameworks, satisfied requirements, outstanding findings, waivers and (via conflicts) part of §12's list, but omits an explicit "audit trail" section (history is a separate endpoint, not embedded in the report).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§13 Compliance traceability: every determination preserves applicable framework, contributing Packs, supporting Policies, supporting Reviews, supporting Evidence, related Deliverables, applicable Authority, timestamp; history immutable<br> Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/complianceDB.ts:134-165</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Persisted: applicable framework (via <code>frameworks</code> in rationale and <code>frameworkCode</code> per result), supporting Reviews/Evidence/Obligations/Decisions (via <code>supporting</code>), and timestamp (<code>created_at</code>). <br>Not persisted per-determination: contributing Packs (framework's <code>originating_pack_id</code> is not copied into the snapshot), supporting Policies, related Deliverables, or applicable Authority — none of these are captured anywhere in <code>rationale</code>/<code>results</code>. History is immutable (INSERT-only API, no UPDATE/DELETE in <code>complianceDB</code>).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§14 Compliance Lifecycle: Defined → Composed → Evaluated → Satisfied → Superseded → Archived; historical evaluations reproducible<br> Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/compliance_requirements_schema_recovery.sql:1-19<br>src/dblayer/recovery/compliance_frameworks_schema_recovery.sql:1-13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Neither <code>compliance_requirements</code> nor <code>compliance_frameworks</code> has a lifecycle/status column, and no <code>transition_definitions</code> rows exist for an entity_type representing a compliance requirement/framework (confirmed: no "Compliance" hits in transition-definition wiring). The six-state lifecycle in §14 is not modelled at all; only the evaluation OUTCOME (§10 status) has state, not the requirement/framework DEFINITION itself.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§15 Events: ComplianceEvaluated, ComplianceSatisfied, ComplianceViolationDetected, ComplianceWaiverGranted, ComplianceStatusChanged, ComplianceReportGenerated<br> Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/compliance.ts:170-177,189,199</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All six event types are published with real actorId/authorityBadge (via <code>resolveSystemActor</code>/<code>resolveAuthor</code>, no <code>?? null</code> fallback). <code>ComplianceStatusChanged</code> only fires when status differs from the previous snapshot; <code>ComplianceSatisfied</code>/<code>ComplianceViolationDetected</code> are mutually-exclusive-by-status as specified. No subscriber consumes these events, which is consistent with this project's event-subscriber rule (Compliance's effects stay within the SEU/Compliance entity itself; no cross-entity_type consequence is specified).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§16 NFR: simultaneous frameworks, deterministic evaluation, historical reconstruction, complete traceability, independence from regulatory implementation details<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(see FR-27.2, FR-27.3, FR-27.6, §13 rows above)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Simultaneous frameworks and deterministic evaluation are fully met; historical reconstruction is evaluation-time-only (not arbitrary-point-in-time); traceability is partial per §13's gaps above.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§17 AC: multiple frameworks coexist<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">tests/compliance-model.test.ts:46-120</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Three independent test frameworks (<code>sec-fw-*</code>, <code>waiver-fw-*</code>, <code>conflict-fw-*</code>) coexist and evaluate independently against the same SEU in the same test run.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§17 AC: compliance is continuously evaluated<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/web/compliance.ts:21-38</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">On-demand evaluation at any time satisfies this criterion literally (no scheduler required by the AC wording), consistent with CM-004's narrower finding above.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§17 AC: compliance is supported by traceable evidence<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/compliance.ts:61-104</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Per-requirement <code>supporting</code> ids trace to real Obligation/Evidence/Decision/Review rows.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§17 AC: compliance reports are generated from engineering state<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/compliance.ts:195-212</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Confirmed via <code>generateComplianceReport</code> calling <code>evaluateCompliance</code> fresh.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§17 AC: historical compliance status can be reconstructed<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/complianceDB.ts:157-165</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each past snapshot's status is retrievable verbatim; reconstruction is retrieval of a stored snapshot, not recomputation from historical engineering state as of an arbitrary past timestamp.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§17 AC: compliance remains independent of Participant implementations<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/compliance.ts:1-217</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No criteria type or evaluation path references a Participant implementation detail; evaluation operates over Obligation/Evidence/Decision/Review/Waiver rows only.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§18 Deliverables: Compliance domain model, evaluation service, reporting service, status registry, APIs, events, traceability services<br> Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/complianceDB.ts (model)<br>src/routes/seu/core/compliance.ts (evaluation+reporting)<br>src/dblayer/recovery/compliance_evaluations_schema_recovery.sql (status registry = append-only table)<br>src/routes/seu/api/compliance.ts, src/routes/seu/web/compliance.ts (APIs)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All six listed deliverables exist in some form. "Compliance traceability services" is the weakest of the six: it is the <code>rationale</code>/<code>supporting</code> fields embedded in the evaluation row rather than a dedicated service with the full §13 field set.</td>
    </tr>
  </tbody>
</table>
## Summary

- Total intents analysed: 30
- Fully met: 14
- Partially met: 14
- Not met: 2
- Not Verifiable: 0

### Major implementation gaps

1. **FR-27.1 / §7 / §3 — Pack-to-Compliance pipeline is disabled.** `seedCompliancePacks.ts` (the only code that would publish the 33 `compliance-*.pack.json` seed files into `compliance_frameworks`/`compliance_requirements`) is entirely commented out, and its import is commented out of `cleanSlate.ts`. The only live way to create a framework/requirement row is the manual config API (`POST /compliance/frameworks`, `POST /compliance/requirements`), which is how `tests/compliance-model.test.ts` populates them. The separate `compliancePackCodes` category-composition mechanism (profiles/templates/sdkAuthoring) feeds Policies/Obligations/QualityGates, not `compliance_frameworks`/`compliance_requirements` — so "Compliance Packs" in the §3 diagram do not actually reach the evaluation layer today.
2. **§14 — No Compliance Requirement/Framework lifecycle.** Neither table has a status column, and no `transition_definitions` rows exist for a Compliance entity_type. The Defined→Composed→Evaluated→Satisfied→Superseded→Archived progression in §14 is unimplemented; only the evaluation outcome (§10 status) carries state.
3. **§8 / §11 / §13 — Partial component coverage.** Of the nine components §8 lists Packs may contribute, only Obligations/Evidence/Decisions/Reviews are consumed by criteria types; Policies, Authority Rules, Traceability Requirements, Ontology Concepts and Reporting Requirements have no criteria type and are never referenced as supporting evidence (§11) or preserved in the evaluation snapshot (§13: no contributing-Pack, supporting-Policy or applicable-Authority field).
4. **CM-004 / FR-27.4 / FR-27.6 — "Continuous" and "any historical point in time" are weaker than literal reading.** Evaluation is pull-based (on-demand GET), not triggered by every relevant lifecycle event; historical reconstruction retrieves a previously stored snapshot rather than recomputing status as of an arbitrary past timestamp between evaluations.
