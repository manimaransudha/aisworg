# Chapter 15 — Deliverable Model — Implementation Traceability

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Deliverable is the central, measurable engineering outcome of an SEU<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/deliverables_schema_recovery.sql:3-15<br>src/dblayer/deliverablesDB.ts:5-38</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A real <code>deliverables</code> table and DB layer exist, FK'd <code>NOT NULL</code> to <code>seus(id)</code>. Deliverables are created either at SEU commissioning (Template catalogue) or individually via <code>createDeliverable</code> (src/routes/seu/core/deliverables.ts:24-58).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Chapter scope: abstraction, lifecycle, state, ownership, relationships, governance, acceptance (§2)<br> Ref: §2 Scope</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(see per-topic rows below)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All seven listed scope items have corresponding implementation surfaces, reviewed individually below.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Architectural position: Objective → Deliverables → Dependencies → Capabilities → Participants → Execution → State Change (§3)<br> Ref: §3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:73-331<br>src/domain/engine/dependencyDefinitionEngine.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>evaluateDeliverableTransition</code> runs dependency readiness (<code>dependencyDefinitionEngine.isTargetReady</code>) before Quality Gate/Policy/Authority checks, then hands off to Command→Work Item dispatch (Participant execution), closing the loop back to a state change. The pipeline order matches the chapter's diagram.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable possesses identity, lifecycle state, dependencies, acceptance criteria, Acquisition Scope, engineering history; exists independently of Participants (§4)<br> Ref: §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/deliverables_schema_recovery.sql:4-14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Identity (<code>id</code>), lifecycle state, dependencies (via <code>dependency_definitions</code> edges keyed by name/state, not a column), and Acquisition Scope columns are real. Acceptance Criteria exists as a JSONB column but is never read or written by any code path (confirmed: only hit is the type declaration, src/dblayer/seuTypes.ts:1019). Engineering history is distributed across <code>deliverable_references</code>, <code>attestations</code>, and <code>events</code>, not a single field. Independence from Participants holds: no FK from <code>deliverables</code> to any participant table.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">DM-001 Deliverables are the primary execution objects<br> Ref: §5 DM-001</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:73-331</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All governance, Command generation and Work Item dispatch are keyed off a Deliverable transition.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">DM-002 Deliverables evolve through states<br> Ref: §5 DM-002</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/deliverablesDB.ts:125-136</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>updateLifecycleState</code> is the sole write path to <code>lifecycle_state</code>, called only from Work Item completion (src/routes/seu/core/workItems.ts:122).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">DM-003 Deliverables are persistent<br> Ref: §5 DM-003</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/deliverables_schema_recovery.sql:3-15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Ordinary persisted Postgres row, no TTL/ephemeral behaviour.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">DM-004 Deliverables own engineering history<br> Ref: §5 DM-004</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/deliverable_references_schema_recovery.sql<br>src/dblayer/recovery/attestations_schema_recovery.sql</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">History is real but lives in satellite tables keyed by <code>deliverable_id</code>, not on the Deliverable row itself; see also §21.9/"Evolution" row below for the versioning gap within that history.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">DM-005 Deliverables are governed by the Engineering Behavior Model<br> Ref: §5 DM-005</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/transition_definitions_schema_recovery.sql (implied by <code>UNIQUE(entity_type, from_state, to_state)</code>)<br>src/domain/engine/executionEngine.ts:172-174</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>transition_definitions</code> is scoped globally per <code>(entity_type, from_state, to_state)</code>, one row platform-wide — not one EBM per SEU/Tenant. Governance (Quality Gates, Policy, Authority) is real and enforced, but the specific rule set is the same for every SEU rather than an EBM instance each SEU could individually vary.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">DM-006 Deliverables are independent of Participants<br> Ref: §5 DM-006</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/deliverables_schema_recovery.sql:3-15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No participant FK on <code>deliverables</code>; Capability fulfilment (which participant performs the work) is resolved separately at dispatch time.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">DM-007 / FR-15.8 Every Deliverable declares an Acquisition Scope (SEU/Capability/Enterprise/Platform, default SEU), independent of Category and ownership, governing Knowledge propagation<br> Ref: §5 DM-007, §6 FR-15.8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/deliverables_schema_recovery.sql:10-11<br>src/dblayer/deliverablesDB.ts:14,31<br>src/routes/seu/core/knowledge.ts:48,69</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Column, CHECK constraint and default exactly match the spec. But no creation caller ever supplies a non-default value, and <code>deliverablesDB</code> has no setter for it post-creation (contrast <code>knowledgeItemsDB.updateAcquisitionScope</code>, src/routes/seu/core/knowledge.ts). Every Deliverable in the system is <code>SEU</code>-scoped in practice. The actual promotion/propagation behaviour §9 describes is implemented one level over, on <code>knowledge_items.acquisition_scope</code> (src/routes/seu/core/knowledge.ts:143-201, <code>promoteKnowledgeItemScope</code>), seeded from the Deliverable's scope at Knowledge-item creation (knowledge.ts:69) and then evolving independently of the Deliverable.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-15.1 Every Deliverable has a globally unique identifier<br> Ref: §6 FR-15.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/deliverables_schema_recovery.sql:4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>id UUID PRIMARY KEY DEFAULT gen_random_uuid()</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-15.2 Every Deliverable belongs to exactly one SEU<br> Ref: §6 FR-15.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/deliverables_schema_recovery.sql:5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>seu_id UUID NOT NULL REFERENCES seus(id)</code>, single FK, no many-to-many structure.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-15.3 Every Deliverable maintains its lifecycle state<br> Ref: §6 FR-15.3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/deliverables_schema_recovery.sql:8<br>src/dblayer/deliverablesDB.ts:125-136</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>lifecycle_state</code> column, written exclusively through the governed transition path.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-15.4 Every Deliverable defines acceptance criteria<br> Ref: §6 FR-15.4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/deliverables_schema_recovery.sql:9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The <code>acceptance_criteria</code> JSONB column exists but is never populated or read anywhere in the codebase — confirmed by grep across <code>src/</code>. The real acceptance mechanism that governs transitions is Quality Gates (see §14 row below), authored on Packs, not this column.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-15.5 Every Deliverable participates in the Deliverable Dependency Graph<br> Ref: §6 FR-15.5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts (isTargetReady, evaluateAndPublishFromTransition)<br>src/dblayer/dependencyDefinitionsDB.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>dependency_definitions</code> rows, scoped to the owning Template/Pack/Profile and keyed by <code>(entity_type, name, state)</code>, gate every Deliverable transition and publish <code>DeliverableReady</code>/<code>DeliverableBlocked</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-15.6 Every Deliverable preserves complete engineering history<br> Ref: §6 FR-15.6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/deliverable_references_schema_recovery.sql<br>src/dblayer/recovery/attestations_schema_recovery.sql<br>src/routes/seu/core/workItems.ts:154-181</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>deliverable_references</code> records one row per Work Item completion carrying an opaque VCS reference string the platform never parses or resolves; <code>attestations</code> is minted only at acceptance transitions. Together they are an append-only trail of pointers to external artefacts, not a retrievable history of the Deliverable's own prior content/state. "Complete" history in the sense of reconstructing what the Deliverable actually looked like at a past point requires resolving an external VCS reference outside the platform's own reach.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-15.7 Deliverable state transitions remain fully traceable<br> Ref: §6 FR-15.7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/workItems.ts:184-202</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every <code>DeliverableTransitioned</code> event carries a real <code>actorId</code> (<code>command.requested_by</code>) and <code>authorityBadge</code> (<code>command.acting_badge_type</code>), persisted via the events table's actor-accountability columns; no silent/system-substitute authorship.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable Categories: Analysis/Design/Construction/Validation/Deployment/Knowledge, extensible via Packs (§7)<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/deliverables.ts:25 (<code>assertCanonicalCategory</code>)<br>src/dblayer/seed/data/ontologyConcepts.json:138-174 (concept_type <code>category:deliverable</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Category is Ontology-enforced, not free text, but the real seeded vocabulary is a different 5-value set (<code>Documentation</code>, <code>Implementation</code>, <code>Architecture</code>, <code>Design</code>, <code>Requirements</code>) — only "Design" coincidentally overlaps with the chapter's six categories. "New categories may be introduced through Packs" has no implementation: no Pack anywhere contributes a <code>category:deliverable</code> Ontology concept. The Ontology check is also only enforced on the ad-hoc creation path (deliverables.ts:25); the bulk SEU-commissioning path calls <code>deliverablesDB.create</code> directly with no validation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable structure: Identifier, Name, Category, Description, Current State, Dependencies, Acceptance Criteria, Acquisition Scope, Producing/Consuming Capabilities, Knowledge/Evidence References, Engineering History (§8)<br> Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/deliverables_schema_recovery.sql:3-20</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Of the 13 declared fields: Identifier, Name, Category, Current State, Dependencies (as edges, not a field), Producing Capability (singular FK, not a collection as the chapter implies) are real. Acceptance Criteria is a dead column (see FR-15.4 row). Description, Consuming Capabilities, Knowledge References, Evidence References, and Engineering History (as a Deliverable-owned field) have no column or field anywhere — Knowledge/Evidence are only reachable as the *inverse* FK from <code>knowledge_items.deliverable_id</code> and Evidence's polymorphic <code>related_object_id</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acquisition Scope: SEU default, Capability/Enterprise/Platform propagation tiers, Platform scope requires governed Pack-publication to cross Tenant boundaries (§9)<br> Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/knowledge.ts:143-207 (<code>promoteKnowledgeItemScope</code>, <code>getEngineeringCapital</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The real, working tiered-propagation/promotion/Engineering Capital mechanism exists and is correctly implemented through <code>transitionEngine</code> with actor+badge accountability and a codification Obligation — but it is built entirely on <code>knowledge_items.acquisition_scope</code> via the <code>KnowledgeScope</code> transition-governed entity type, not on the Deliverable itself as §9 frames it. See the DM-007/FR-15.8 row above for the same gap from the Deliverable side. Platform-scope's "no Tenant's state exposed as a side effect" constraint is respected structurally — promotion never crosses a Tenant boundary automatically; it only marks eligibility.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable lifecycle: Defined → Planned → In Progress → Under Review → Approved → Baselined → Superseded → Archived, extensible by the EBM (§10)<br> Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json (3 <code>entityType: "Deliverable"</code> rows for the Instance lifecycle: Defined→In Progress, In Progress→Approved, Approved→Baselined)<br>src/dblayer/deliverablesDB.ts:104-109</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Only 4 of the chapter's 8 states exist for a running Deliverable *instance* (<code>Defined</code>, <code>In Progress</code>, <code>Approved</code>, <code>Baselined</code>); <code>Planned</code>, <code>Under Review</code>, <code>Superseded</code>, <code>Archived</code> have no transition rows and are confirmed absent by <code>deliverablesDB.ts</code>'s own comment. "Additional states via the EBM" is mechanically possible — <code>lifecycle_state</code> has no CHECK constraint — but no Pack has ever contributed one. (Note: <code>transitionDefinitions.json</code> also carries 9 further <code>entityType: "Deliverable"</code> rows for states <code>Draft/Validated/Published/Active/Deprecated/Retired/Archived</code> — these belong to the separate <code>deliverable_definitions</code> *authoring* lifecycle introduced by CR-049, not to the running SEU instance's own lifecycle this section describes; they do not add states to the §10 path.)</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable state transitions comply with the EBM (§11)<br> Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:172-181</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Of the chapter's five named transitions, only <code>Approved → Baselined</code> matches a real one; the platform collapses the chapter's 5-step path to 3 by eliding <code>Planned</code> and <code>Under Review</code> entirely. Every real transition does run through governed lookup (<code>transitionDefinitionsDB.find</code>) plus authority/policy/quality-gate evaluation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable relationships: dependency, derivation, refinement, validation, implementation, supersession, decomposition, with explicit semantics (§12)<br> Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/dependencyDefinitionsDB.ts:42,48-52 (<code>relationship_kind</code> column)<br>src/routes/seu/core/templates.ts:659-678 (inheritance enforcement)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">**Material change since §21.6 was last written (now outdated on this point): CR-049 Phase 2 is Built.** <code>dependency_definitions</code> now carries a <code>relationship_kind</code> column (<code>dependency</code> default / <code>derivation</code> / <code>implementation</code> / <code>decomposition</code>), authored on the Template <code>dependencyGraph</code> widget and enforced on Template Inheritance — Implementation/Decomposition edges are locked (must be preserved, possibly under a renamed Deliverable Definition) and Derivation edges are freely editable by an inheriting Template. 4 of the 7 named relationship types are now real (dependency + the three newly added). Refinement and Validation are deliberately not built as separate relationship fields — they are treated as already covered by the existing Quality/Review Gate mechanism (§14), per CR-049's own design note. Supersession remains genuinely unbuilt and undecided (CR-049 explicitly leaves it open).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables are owned by the SEU; Participants contribute but never own; ownership survives Capability-fulfilment changes (§13)<br> Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/deliverables_schema_recovery.sql:5<br>src/dblayer/deliverablesDB.ts:125-136</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>seu_id NOT NULL</code>, and the only <code>UPDATE deliverables</code> statement in the codebase touches <code>lifecycle_state</code> only — ownership is immutable in effect. There is no explicit ownership-validation function or transfer-prevention check; it holds because nothing attempts to write <code>seu_id</code>, not because something actively blocks it.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Deliverable defines measurable acceptance criteria; acceptance may require review, evidence, resolved obligations, approval, automated validation, governed by the EBM (§14)<br> Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:117-309 (obligation/decision checks, Quality Gate call)<br>src/dblayer/seed/data/core-engineering.pack.json:115,121 (seeded gates)<br>src/domain/engine/qualityGateEngine.ts:173-234</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The real acceptance chain is dependency readiness → Quality Gate → Authority/Policy → empty-centre reference check → dispatchability — not the dead <code>acceptance_criteria</code> column (§8/FR-15.4). Two Quality Gates are seeded for Deliverable: <code>no_unresolved_obligations</code> (In Progress → Approved) and <code>requires_accepted_evidence_or_approved_decision</code> (Approved → Baselined). A third criteria type, <code>requires_accepted_review</code>, is implemented in <code>qualityGateEngine.ts</code> but never seeded for any Deliverable transition. Of the chapter's five acceptance inputs, four exist in some form (review: built but unseeded; evidence: built+seeded; obligations: built+seeded; approval: built, badge-gated); automated validation is not built.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables evolve continuously, preserving engineering history, traceability, decision history, evidence, and superseded versions, with historical versions remaining accessible (§15)<br> Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/deliverables_schema_recovery.sql (no version column)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No <code>deliverable_versions</code> table or version column exists for a running SEU's Deliverable *instance* — a Deliverable is one mutable row, updated in place. "Historical versions remain accessible" resolves only to the append-only <code>deliverable_references</code>/<code>attestations</code>/<code>events</code> trails (see FR-15.6 row), which point at external, unparsed VCS references rather than storing retrievable prior versions. Decision/Evidence history is traceable via <code>core/traceability.ts</code>'s inverse-FK reads, not via anything stored on the Deliverable. CR-049 (Built) introduces real versioning, but on <code>deliverable_definitions</code> — the authored Definition entity — not on a running SEU's <code>deliverables</code> instance row, which is explicitly out of scope for that CR.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">State transitions triggered by completed execution, accepted decisions, approved evidence, resolved obligations, dependency satisfaction, governance approvals; never without traceability (§16)<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:85-331<br>src/routes/seu/core/workItems.ts:116-202</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All six named triggers are represented in the governance chain (dependency readiness, obligation/decision blocking checks, Quality Gate evaluation referencing evidence/decisions, and Participant-reported completion driving the actual state write). Every transition publishes <code>DeliverableTransitioned</code> with a real actor and badge — traceability holds in every real code path.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable subsystem publishes: DeliverableCreated, DeliverableUpdated, DeliverableStateChanged, DeliverableApproved, DeliverableBaselined, DeliverableSuperseded, DeliverableArchived (§17)<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/workItems.ts:193-202 (only <code>DeliverableTransitioned</code> found)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Zero of the seven named events exist anywhere in the codebase (confirmed by grep for each literal name). What is actually published is a single generic <code>DeliverableTransitioned</code> event carrying <code>{fromState, toState, commandId, workItemId, participantId, reference}</code>. There is no creation event at all — <code>createDeliverable</code> and the commissioning bulk-create path publish nothing. Two real, Deliverable-related events exist under different names from a different chapter's own scope — <code>DeliverableReady</code>/<code>DeliverableBlocked</code> (src/domain/engine/dependencyDefinitionEngine.ts:211) — but these are dependency-gating signals, not state-change events, and only fire on transitions a <code>dependency_definitions</code> row actually governs.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable Model supports versioning, preserves complete engineering history, remains independent of Participants, supports concurrent evolution, maintains deterministic state transitions (§18)<br> Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/deliverablesDB.ts:125-136</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Independent of Participants: ✅ (no participant FK). Deterministic transitions: ✅ (global one-row-per-triple governance, fail-closed Policy/Gate evaluation). Complete history: partial, see §15/FR-15.6 rows. Versioning: ❌ not built for the running instance (see §15 row). Concurrent evolution: ❌ — <code>updateLifecycleState</code> is an unconditional <code>UPDATE ... WHERE id = $2</code> with no expected-prior-state guard; two concurrent Work Item completions on the same Deliverable would last-write-win with no detection.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance Criteria (§19): identities unique, governed transitions, engineering history maintained, dependency participation, traceability, Participant independence, Acquisition Scope declared and Knowledge propagates accordingly<br> Ref: §19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(aggregated — see corresponding rows above)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Six of the seven checklist items individually verified above as Fully or Partially met (identity: full; governed transitions: full; history: partial; dependency participation: full; traceability: full; Participant independence: full). The seventh — "every Deliverable declares an Acquisition Scope and Knowledge it produces propagates accordingly" — is Partially met: the declaration exists and defaults correctly, but no caller ever varies it from <code>SEU</code>, and the propagation behaviour runs on Knowledge Items, not the Deliverable (see DM-007/§9 rows).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Required Deliverables per chapter: domain model, lifecycle service, state engine, registry, APIs, events, versioning service (§20)<br> Ref: §20</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/deliverablesDB.ts<br>src/domain/engine/executionEngine.ts<br>src/routes/seu/core/deliverables.ts<br>src/routes/seu/core/workItems.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Domain model (deliverablesDB + seuTypes), lifecycle/state engine (executionEngine's <code>evaluateDeliverableTransition</code> + <code>transitionDeliverable</code>), and APIs (deliverables.ts routes) all exist and are exercised. A "registry" exists in the sense of <code>findBySeuId</code>/<code>findByCategory</code> queries, not a dedicated registry UI for Deliverable instances (contrast the real Deliverable *Definition* Registry page CR-049 added, which is Definition-side, not this Instance-side deliverable). Events exist only as the single generic <code>DeliverableTransitioned</code> (see §17 row — Not met on completeness). A dedicated "versioning service" for the Instance does not exist (see §15/§18 rows).</td>
    </tr>
  </tbody>
</table>
## Summary

- Total intents analysed: 32
- Fully met: 11
- Partially met: 19
- Not met: 2
- Not Verifiable: 0

## Major implementation gaps

1. **Acceptance Criteria field (§4, §6 FR-15.4, §8) is entirely dead.** The `acceptance_criteria` JSONB column exists and is never read or written anywhere; real acceptance runs through Quality Gates authored on Packs instead.
2. **Named events (§17) are 0-for-7.** Only one generic `DeliverableTransitioned` event is published; no creation event exists at all. `DeliverableReady`/`DeliverableBlocked` exist but under different naming and narrower scope, from Chapter 9's own area.
3. **Acquisition Scope (§9, §5 DM-007, §6 FR-15.8) is schema-correct but behaviourally misplaced.** Every Deliverable is `SEU`-scoped in practice (no setter, no caller ever varies it); the real tiered-propagation/Engineering-Capital mechanism the chapter describes for the Deliverable is actually built on `knowledge_items.acquisition_scope`, one layer over.
4. **No versioning exists for a running SEU's Deliverable instance (§15, §18).** One mutable row, no `deliverable_versions` table, no version column; "historical versions" resolve to unparsed external VCS reference pointers. CR-049's real versioning work (Built) applies to the separate, upstream `deliverable_definitions` authoring entity, not to this instance row.
5. **Lifecycle collapses 8 chapter states to 4, and 5 named transitions to 3 (§10, §11).** `Planned`, `Under Review`, `Superseded`, `Archived` do not exist for a Deliverable instance.
6. **Relationship types: 4 of 7 now built (up from 1 of 7 at the last §21 review), via CR-049 Phase 2.** `dependency`, `derivation`, `implementation`, `decomposition` are real via `dependency_definitions.relationship_kind`. `Refinement`/`Validation` are deliberately treated as already covered by Quality Gates rather than built as distinct relationships. `Supersession` remains genuinely unbuilt and explicitly left open by CR-049.
7. **Structural fields missing entirely (§8):** Description, Consuming Capabilities, Knowledge References, Evidence References, and a Deliverable-owned Engineering History field have no column or field anywhere on the Instance row.
8. **No concurrency control (§18).** `updateLifecycleState` has no expected-prior-state guard.

**Note on currency of Chapter 15 §21 itself:** this review's single most significant finding relative to the chapter's own self-maintained §21 section is that CR-049 — described in §21.3 and §21.6 as "design in progress, not built" — is now fully Built (both Phase 1, the `deliverable_definitions` authoring entity, and Phase 2, the `relationship_kind` dimension on `dependency_definitions`). §21's own Summary (§21.13) is accordingly stale on this point as of this review's date.
