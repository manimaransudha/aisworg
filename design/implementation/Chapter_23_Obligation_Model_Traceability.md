# Chapter 23 – Obligation Model: Implementation Traceability

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">Obligation is a first-class engineering object representing a commitment that must be satisfied before governed outcomes complete<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/obligationsDB.ts<br>seuTypes.ts:1527-1551 (<code>ObligationRow</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real <code>obligations</code> table and typed row; participates in governance, dependency evaluation and execution as a real structural gate, not a passive record.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Chapter scope excludes risk methodologies/audit frameworks/compliance regulations/issue-tracking, contributed via Packs<br> Ref: §2 Scope</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/obligations.ts:264-370 (<code>raiseObligationsForPackDefinitions</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Categories and applicability are declared through Pack <code>contributionObligationDefinitions[]</code>, not hardcoded.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Architectural position: Governance → Obligations → Dependency Engine → Deliverable transitions<br> Ref: §3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/qualityGateEngine.ts:173<br>src/domain/engine/executionEngine.ts:61-114</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Obligation sits exactly in this chain: Policy/Pack-raised Obligations gate SEU/Deliverable transitions via Quality Gates and direct <code>seu_blocked</code> checks.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An Obligation is a governed commitment that may arise from governance, compliance, engineering practice, customer requirements, risk management, telemetry patterns, or Knowledge promotion<br> Ref: §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/obligations.ts:53-167 (<code>createObligation</code>), 169-262, 264-370</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>createObligation</code> is the single writer; 9 real call sites cover Quality Gates, Telemetry/Knowledge, Policies, Pack Obligation Definitions, Review Findings, Participant self-raise, and dispatch failure. Authority evaluations, Customer requests, and External systems have no automatic path — only the generic <code>POST /obligations</code> API.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">OM-001: every significant commitment represented as an Obligation<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/obligationsDB.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real table, real writes, but coverage of named sources is 7 of 11 mechanisms (see §10 row below).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">OM-002: Obligations independent of Participants<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/obligations_schema_recovery.sql (no Participant FK)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No Participant column/FK exists on <code>obligations</code>; independence holds trivially by absence of coupling.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">OM-003: Obligations participate in dependency evaluation<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/qualityGateEngine.ts:173<br>src/domain/engine/dependencyDefinitionEngine.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Quality Gate <code>no_unresolved_obligations</code> and the dependency engine both treat Obligation as a real blocking node via polymorphic <code>related_object_type/id</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">OM-004: Obligations remain fully traceable<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/obligations.ts (events)<br>migration 252 (<code>revision_history</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>events</code> gives a real transition timeline; Related Decisions/Evidence resolvable via reverse lookup; Related Authority Rules and Related Risks are not reachable from an Obligation at all.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">OM-005: Obligations support composition from multiple Packs<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/obligations.ts:264-370</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>raiseObligationsForPackDefinitions</code> reads a composed Pack's own Obligation Definitions at runtime — a real mechanism. No <code>originating_pack_id</code> column exists on <code>obligations</code>, so a raised instance cannot be traced back to the exact Pack that declared it.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">OM-006: Obligations possess explicit lifecycle states<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>transition_definitions WHERE entity_type='Obligation'</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Exact 8-state chain plus Reopen/Escalate additions (migration 252), fully table-driven.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-23.1: globally unique identifier<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">obligations_schema_recovery.sql (<code>id UUID PRIMARY KEY DEFAULT gen_random_uuid()</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real UUID PK.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-23.2: dependencies on Deliverables, Decisions, Evidence, other Obligations<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>dependency_definitions</code> (<code>from_entity_type</code>/<code>to_entity_type</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Mechanism supports all 4 entity types on either side; no seed data declares a row naming Obligation as either side, so it is unexercised, not unsupported.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-23.3: Obligations may block Deliverable state transitions<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/qualityGateEngine.ts:173<br>src/domain/engine/executionEngine.ts:114</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>qg-deliverable-in-progress-to-approved</code> blocks on unresolved Obligations; <code>transitionDeliverable</code> separately refuses (<code>seu_blocked</code>) when the owning SEU itself is blocked by an open commence-work Obligation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-23.4: every Obligation possesses measurable completion criteria<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/obligations.ts (<code>transitionObligation</code>)<br><code>completion_criteria TEXT</code> column</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Definition declares <code>classification</code> (machine-verifiable/judgment/human-attested) and a structured <code>governingCondition</code>, but <code>transitionObligation</code> never reads either at runtime; every Obligation closes only via a manual transition regardless of declared classification. <code>completion_criteria</code> stays free text.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-23.5: Obligations preserve complete engineering history<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>events</code> table; migration 252 <code>revision_history</code> (JSONB)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No dedicated history table; reconstructable from <code>events</code> (transition history) plus <code>revision_history</code> (plain field edits). Two separate, non-unified mechanisms rather than one complete history.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-23.6: Obligation state transitions remain fully traceable<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/obligations.ts (<code>transitionObligation</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Publishes <code>fromState</code>/<code>toState</code>/<code>actorId</code>/<code>authorityBadge</code> on every transition.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-23.7: Obligations support delegation without changing ownership<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No <code>delegat*</code> hits anywhere in <code>src/</code> for Obligation; no assignment/ownership field exists to delegate from in the first place.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-23.8: platform raises an Organisational Learning Obligation on sustained Telemetry pattern<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/telemetry.ts (quality-gate-blocking, policy-waiver, capability-shortage patterns)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">3 real, deduplicated triggers in <code>telemetry.ts</code>, each calling <code>createObligation</code> with <code>origin="Telemetry and Knowledge Model"</code>/<code>"Quality Gates"</code>/<code>"Policies"</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Obligation Categories: Engineering, Risk, Compliance, Audit, Security, Operational, Customer, Organisational Learning, extensible via Packs<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>ontology_concepts WHERE concept_type='category:obligation'</code><br>src/routes/seu/core/obligations.ts (<code>assertCanonicalCategory</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All 8 named categories seeded plus one unnamed (<code>Review Finding</code>, from Ch.25). A Pack's <code>contributionObligationDefinitions[]</code> declares a real Ontology-backed <code>category</code>, but a Pack cannot introduce a *new* category value — <code>contributed_by_pack</code> is NULL on every seeded row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Obligation Structure: Identifier, Title, Category, Description, Origin, Priority, Severity, Completion Criteria, Status, Related Deliverables/Decisions/Evidence/Risks/Policies/Authority Rules, Traceability References<br> Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/obligationsDB.ts<br>src/routes/seu/core/obligations.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Identifier/Title/Category/Description/Origin/Priority/Severity/Status/Completion Criteria are real columns, though Priority and Completion Criteria are populated only by some creation paths. Related Deliverables collapses into a generic polymorphic <code>related_object_type/id</code>. Related Decisions and Related Evidence are resolvable via reverse lookup (<code>findByRelatedObject</code>). Related Risks has no backing entity anywhere in the codebase. Related Policies is recoverable only as free text for Policy-raised Obligations. Related Authority Rules exists only on <code>governance_evaluation_outcomes</code>, not reverse-queryable from an Obligation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Obligation Lifecycle: Identified → Analysed → Assigned → In Progress → Resolved → Verified → Closed → Archived; closure requires verification<br> Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>transition_definitions WHERE entity_type='Obligation'</code><br>src/routes/seu/core/obligations.ts (<code>transitionObligation</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Exact 8-state chain present. No <code>Resolved→Closed</code> or <code>In Progress→Closed</code> row exists, so closure structurally requires passing through Verified; <code>transitionEngine.evaluate()</code> fails closed for any transition not in the table.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Obligation Sources: EBM, Policies, Authority evaluations, Reviews, Quality Gates, Compliance/Organisation Packs, Customer requests, Participants, External systems, Telemetry/Knowledge<br> Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/obligations.ts (9 call sites)<br>src/domain/engine/telemetry.ts<br>src/routes/seu/core/participantHome.ts (<code>raiseMyObligation</code>)<br>findings.ts (<code>convertFindingToObligation</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Quality Gates, Telemetry/Knowledge, Policies, EBM/Pack Definitions, Reviews, and Participants each have a real automatic or semi-automatic path. Authority evaluations, Customer requests, and External systems have no automatic path — manual creation only via the generic API. Origin is recorded on 7 of the 9 call sites; Review-conversion and dispatch-failure paths leave <code>origin</code> null.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Dependency Integration: Obligations participate directly in the Dependency Graph; a Deliverable cannot be approved until a blocking Obligation is verified; a blocked owning entity stays blocked until resolution<br> Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/qualityGateEngine.ts:173<br>src/domain/engine/dependencyDefinitionEngine.ts<br>src/domain/engine/executionEngine.ts:61-114<br>src/routes/seu/core/commissioning.ts (<code>attemptSeuCommenceWork</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Both the chapter's worked examples are live: the Quality Gate blocks Deliverable approval, and auto-unblock-on-resolution fires via <code>dependencyDefinitionEngine.evaluateAndPublishFromTransition</code> publishing <code>DeliverableReady</code>. Blocking is also enforced at SEU level (<code>attemptSeuCommenceWork</code>), which transitively blocks every Deliverable under a blocked SEU. The named-dependency-graph path (<code>dependency_definitions</code> rows naming Obligation) is unused in practice; only the Quality Gate path is exercised.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Resolution: explicit completion criteria; resolution may require new Deliverables/Evidence/Decisions/governance approval/Reviews/Quality Gates/a revised Pack version for Organisational Learning Obligations; resolution alone does not close, verification required<br> Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/obligations.ts (<code>transitionObligation</code>, lifecycle gate per §9)<br>src/domain/engine/executionEngineKickoff.ts<br>src/domain/engine/deliverableKickoff.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Verification-before-closure is structurally enforced (same mechanism as §9). <code>blocked_from_state</code>/<code>blocked_to_state</code> let the Execution Engine re-attempt the exact blocked hop once an Obligation (or its linked Attention Item) resolves, for both Policy- and Pack-raised Obligations. The chapter's own closing loop — resolution "composed by the Composition Engine into a new Engineering Behavior Model" — is absent: zero Obligation references in <code>compositionEngine.ts</code>. Resolving an Obligation unblocks the transition it names but never mints a new Pack version.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Ownership: Obligation belongs to the SEU; Participants may be assigned responsibility but do not own it; reassignment does not affect identity/lifecycle<br> Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">obligations_schema_recovery.sql (<code>seu_id</code> FK only)<br>src/routes/seu/core/participantHome.ts (<code>raiseMyObligation</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No <code>assigned_to</code>/<code>owner</code> column exists; "belongs to the SEU" holds only because <code>seu_id</code> is the sole ownership-adjacent FK present, not a designed ownership model. <code>raiseMyObligation</code> enforces a real check on who may create an Obligation against a given Deliverable, but this is a creation-time check, not a persisting owner/assignee field.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Escalation: Obligations may define escalation rules triggered by severity, prolonged unresolved state, repeated verification failures, approaching milestones, or dependency impact; governed through Packs<br> Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>transition_definitions</code> (<code>{6 pre-Closed states}→Escalated</code>, migration 252)<br>src/domain/engine/workItemHeartbeat.ts<br>src/domain/engine/telemetry.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A real <code>Escalated</code> state and <code>ObligationEscalated</code> event exist (migration 252), but no trigger logic evaluates any of the 5 named conditions — the hop exists without the driving logic. <code>workItemHeartbeat.ts</code>'s escalation logic explicitly excludes non-Deliverable entities. <code>telemetry.ts</code>'s "Escalation"-category Attention Item is a side effect of creating an Organisational Learning Obligation, not a state-driven trigger.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Events: ObligationCreated, ObligationAssigned, ObligationUpdated, ObligationResolved, ObligationVerified, ObligationClosed, ObligationEscalated, ObligationReopened<br> Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/obligations.ts (<code>createObligation</code>, <code>transitionObligation</code>)<br>migration 252</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every lifecycle hop now publishes its own named event in addition to the generic <code>ObligationTransitioned</code> (Version Feature Plan applied). 2 of the 8 named events (<code>ObligationProcessing</code>, <code>ObligationArchived</code>) are not named by the chapter but are real; mapping for <code>Identified→Analysed</code>, <code>Assigned→In Progress</code>, <code>Closed→Archived</code> uses non-chapter-given names since no 1:1 mapping exists in §15 for those hops. All 8 chapter-named events are real and fire.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: deterministic lifecycle transitions; Dependency Engine integration; complete traceability; composition from multiple governance sources; independence from Participant implementations<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>transition_definitions</code>-gated transitions<br>src/domain/engine/dependencyDefinitionEngine.ts, qualityGateEngine.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deterministic transitions, Dependency Engine integration, multi-source composition, and Participant independence are all real. Traceability is partial — Related Authority Rules/Risks remain unreachable from an Obligation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: every commitment is an Obligation; participates in dependency evaluation; closure requires verification; provenance/history preserved; independent of Participant changes; sustained Telemetry raises Organisational Learning Obligations producing a revised Pack version<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">See §6/§10/§9/§12 rows above</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All sub-criteria hold except: (a) commitment coverage is 7 of 11 named sources, and (b) resolving a Telemetry-raised Organisational Learning Obligation does not produce a revised Pack version — raising is real, the Composition Engine loop is not built.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables: domain model, registry, lifecycle service, verification service, escalation service, dependency integration interfaces, APIs, events<br> Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">seuTypes.ts:1527 (<code>ObligationRow</code>)<br>src/dblayer/obligationsDB.ts<br>src/routes/seu/core/obligations.ts<br>src/routes/seu/api/obligations.ts<br>src/routes/seu/core/participantHome.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Domain model, registry, lifecycle service, dependency integration interfaces, APIs, and events are all real. Verification service is not a separate service — verification is just another <code>transitionObligation</code> call to state <code>Verified</code>. Escalation service does not exist — no Obligation-scoped escalation code.</td>
    </tr>
  </tbody>
</table>
## Summary

- Total intents analysed: 28
- Fully met: 10
- Partially met: 17
- Not met: 1
- Not Verifiable: 0

## Major Implementation Gaps

1. **Delegation (FR-23.7) is entirely unbuilt.** No ownership/assignee field exists on `obligations` to delegate from, and no delegation logic exists anywhere in `src/`.
2. **Resolution does not close the Organisational Learning loop (§12, FR-23.8, §17).** Telemetry-triggered Organisational Learning Obligations are genuinely raised, but resolving one never produces a revised Capability/Service/Policy Pack version via the Composition Engine — zero Obligation references exist in `compositionEngine.ts`.
3. **Escalation (§14) has the lifecycle hop but no trigger logic.** `Escalated` state and `ObligationEscalated` event are real (migration 252), but none of the 5 named escalation conditions (severity, prolonged unresolved state, repeated verification failures, approaching milestones, dependency impact) are evaluated anywhere.
4. **Ownership (§13) is a column absence, not a model.** "Belongs to the SEU" holds only incidentally via the `seu_id` FK; there is no assigned-responsibility field distinct from ownership.
5. **Related Risks and Related Authority Rules (§8) are structurally unreachable** from an Obligation — no Risk entity exists in the codebase, and no reverse-query path exists from an Obligation to a governance evaluation outcome.
6. **Obligation Sources (§10) cover 7 of 11 named origins.** Authority evaluations, Customer requests, and External systems have no automatic raising path, only the generic manual API.
7. **Measurable completion criteria (FR-23.4) is declared but not executed.** The Definition's `classification`/`governingCondition` fields exist but are never read by `transitionObligation`; every Obligation closes via manual transition regardless of declared classification.
