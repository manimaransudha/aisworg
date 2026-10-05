# Chapter 16 — Knowledge Model: Implementation Traceability

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">Knowledge is the permanent engineering asset of an SEU and survives the SEU's own lifecycle<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/knowledgeItemsDB.ts:1-197</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No delete method exists anywhere in <code>knowledgeItemsDB.ts</code> or <code>src/routes/seu/api/knowledge.ts</code>; <code>knowledge_items</code> rows are never removed by application code, and nothing ties a Knowledge Item's existence to its originating SEU's own state.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Knowledge represents understanding, independent of Participants, AI providers, runtime execution, individual projects<br> Ref: §4 Definition, KM-005</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/knowledge_items_schema_recovery.sql:27<br>src/routes/seu/core/knowledge.ts:18-22</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>author_id</code> is a nullable, provenance-only FK (who most recently acted); <code>resolveParticipantId</code> returns <code>null</code> when no Participant identity exists and the row is still created and valid. No coupling exists to any AI-provider or runtime-execution identifier.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">KM-001 Knowledge is permanent<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/knowledgeItemsDB.ts:1-197</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Confirmed by omission: no delete/archive-removal path exists in the DB layer or API routes.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">KM-002 Knowledge shall be independently identifiable<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/knowledge_items_schema_recovery.sql:4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>id UUID PRIMARY KEY DEFAULT gen_random_uuid()</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">KM-003 Knowledge shall possess supporting evidence<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/knowledge_items_schema_recovery.sql:6-22<br>src/routes/seu/core/knowledge.ts:42-77</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Knowledge Item is mandatorily grounded via <code>deliverable_id NOT NULL</code>. <code>evidence_references</code> (JSONB) is an additional, optional relationship, not enforced non-empty — a Knowledge Item with no distinct Evidence behind it (observed directly from a Deliverable) is a valid, createable state. This differs from a literal reading of "shall possess supporting evidence" as a hard requirement on Evidence specifically, but is a deliberate, documented design choice (grounding comes from the Deliverable link).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">KM-004 Knowledge shall remain reusable across SEUs<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/knowledge.ts:203-278<br>src/dblayer/knowledgeItemsDB.ts:153-173</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acquisition Scope and <code>findEngineeringCapital()</code> make non-SEU-scoped Knowledge discoverable platform-wide via a query, but no operation copies or attaches a Knowledge Item to a second SEU — "reuse" is a discoverability filter only.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">KM-005 Knowledge shall never depend upon a Participant<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/knowledge.ts:23-28, 61</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>resolveParticipantId</code> can return <code>null</code>; <code>author_id</code> is set-if-available, never required for creation or any transition to succeed.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">KM-006 Knowledge shall remain traceable to its origin<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/knowledge_items_schema_recovery.sql:5-6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>seu_id</code> and <code>deliverable_id</code> are both <code>NOT NULL</code> FKs, present on every row unconditionally.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-16.1 globally unique identifier<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/knowledge_items_schema_recovery.sql:4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>id UUID PK DEFAULT gen_random_uuid()</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-16.2 supporting Evidence<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/knowledgeItemsDB.ts:6-37</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>evidence_references</code> JSONB column exists and is written at creation; not enforced non-empty (same gap as KM-003).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-16.3 references originating Deliverables<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/knowledge_items_schema_recovery.sql:6, 21<br>src/routes/seu/core/knowledge.ts:57-70</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Both the singular provenance FK (<code>deliverable_id</code>, enforced <code>NOT NULL</code> and checked against <code>seuId</code> at creation) and the plural <code>deliverable_references</code> relationship set exist.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-16.4 Knowledge shall support versioning<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/knowledge_items_schema_recovery.sql:25</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>version TEXT NOT NULL DEFAULT '1.0.0'</code> exists as a real column, but no code path in <code>knowledge.ts</code> or <code>knowledgeItemsDB.ts</code> ever updates it — there is no Edit operation for a Knowledge Item's content, so the column never changes from its default.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-16.5 Knowledge shall support semantic relationships<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/knowledge_items_schema_recovery.sql:23-24<br>src/routes/seu/core/knowledge.ts:30-35, 313-318</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>knowledge_references</code> JSONB storage exists, keyed by relationship type, and <code>updateKnowledgeReferences</code> enforces the one explicit rule (no self-reference). No referential-integrity check that a referenced id exists, and no code elsewhere reads/renders the relationships.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-16.6 Knowledge shall remain reusable<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/knowledgeItemsDB.ts:153-173</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same as KM-004 — mechanism exists, not full reuse (no cross-SEU attach operation).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-16.7 Knowledge shall remain fully traceable<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/knowledge_items_schema_recovery.sql:5-6, 27-28</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>seu_id</code>/<code>deliverable_id</code> FKs enforced; <code>author_id</code>/<code>authority_badge</code> updated on every governed transition (<code>knowledgeItemsDB.ts:73-103</code>).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-16.8 Acquisition Scope: 4 values, inherited default, governed promotion<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/knowledge_items_schema_recovery.sql:11-12<br>src/routes/seu/core/knowledge.ts:69, 203-278</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>CHECK</code> constraint restricts <code>acquisition_scope</code> to the 4 named values; <code>createKnowledgeItem</code> defaults it from <code>deliverable.acquisition_scope</code> unless overridden; <code>promoteKnowledgeItemScope</code> runs promotion through <code>transitionEngine.evaluate()</code> against a dedicated <code>KnowledgeScope</code> transition track, requiring a real badge.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Illustrative Knowledge Categories (Architectural/Domain/Technical/Operational/Governance/Process); additional categories introducible via Packs<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/knowledge.ts:56<br>(category:knowledge Ontology concept, referenced via assertCanonicalCategory)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>assertCanonicalCategory("category:knowledge", input.category)</code> enforces an Ontology-governed category vocabulary at creation (code path is real, not aspirational). The "introduced through Packs" extension mechanism has no implementation: no code populates <code>contributed_by_pack</code> for any <code>category:knowledge</code> concept.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Knowledge Structure: 13 named fields (Identifier, Title, Category, Description, Status, Acquisition Scope, Evidence/Deliverable/Decision References, Related Knowledge, Version, Provenance, Confidence Level)<br> Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/knowledge_items_schema_recovery.sql:3-28</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">12 of 13 map to real, dedicated columns (<code>id</code>, <code>title</code>, <code>category</code>, <code>description</code>, <code>status</code>, <code>acquisition_scope</code>, <code>evidence_references</code>, <code>deliverable_references</code>, <code>decision_references</code>, <code>knowledge_references</code>, <code>confidence_level</code>, and <code>author_id</code>/<code>authority_badge</code> for Provenance). <code>version</code> exists as a column but is static (see FR-16.4). None of the JSONB reference columns carry FK/CHECK-level referential integrity.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Knowledge Lifecycle: Observed → Proposed → Validated → Accepted → Published → Deprecated → Archived<br> Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/knowledge.ts:124-185</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>transitionKnowledgeItem</code> calls the generic <code>transitionEngine.evaluate()</code>/<code>qualityGateEngine.evaluate()</code> pair against <code>entityType: "Knowledge"</code>, requiring a real <code>actorId</code> and resolving a real authority badge per hop (<code>gate.authorityBadge</code>, thrown if absent). The 7-state chain is the one <code>transition_definitions</code> governs; this matches the chapter's chain exactly, per transition rows the code reads at runtime.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Only Published Knowledge may be reused across SEUs by default<br> Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/knowledge.ts:94-116, 207-212</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Enforced in exactly one place: <code>promoteKnowledgeItemScope</code> rejects promotion unless <code>status === "Published"</code>. <code>listKnowledgeItemsBySeu</code>/<code>listKnowledgeItemsWithNextStates</code> apply no status filter — any status is returned to a caller within the same SEU. The gate covers scope-widening (how far Published Knowledge may travel), not general read access.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Knowledge Relationships: 7 named relation types, explicit semantics<br> Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/knowledge.ts:30-35, 313-318<br>src/dblayer/knowledgeItemsDB.ts:105-116</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Storage exists (JSONB columns keyed by relationship-type strings), and the one explicit behavioural rule stated for Related Knowledge — "must not refer to itself" — is enforced in <code>assertNoSelfReference</code>. No referential-integrity check on referenced ids, and no other code consumes/renders these relationships to give the "contradicts"/"supersedes"/etc. semantics any runtime effect beyond storage.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Knowledge Validation: not reusable until validated; validation may require Evidence, review, approval, automated verification, consistency checks; governed by the Engineering Behavior Model<br> Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/knowledge.ts:124-162 (qualityGateEngine.evaluate)<br>src/dblayer/knowledgeItemsDB.ts:121-146 (addValidationNote/listValidationNotes)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>qualityGateEngine.evaluate({entityType:"Knowledge",...})</code> runs on every transition — the hook is real — but no EBM reference exists anywhere coupling <code>ebms</code> to <code>knowledge_items</code>, and no gate content is attached to any Knowledge transition in the transition definitions this code reads. A separate append-only <code>knowledge_validation_notes</code> mechanism exists for review/consistency notes, but nothing in the lifecycle code requires a note before any transition.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Knowledge Ownership and Acquisition Scope: 4 scopes, default inheritance from producing Deliverable, governed promotion (same Authority mechanism), no silent demotion, demotion deprecates broader-scope item instead<br> Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/knowledge.ts:37-41, 69, 194-278</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">4-scope <code>CHECK</code> constraint; default-inherited from <code>deliverable.acquisition_scope</code>; promotion runs through <code>transitionEngine.evaluate()</code> with a real badge per hop, blocked unless <code>Published</code>. No demotion transition rows exist, so demotion is rejected via the ordinary <code>no_transition_definition</code> path — structurally prevented rather than explicitly validated against. The specific "demotion instead deprecates the broader-scoped item while a narrower-scoped successor may exist" behavior has no code path: no function automatically deprecates on an attempted demotion. Promotion preserves prior-scope history only via the <code>KnowledgeScopePromoted</code> event payload (<code>eventBus.publish</code>, knowledge.ts:245-254); the row itself is an in-place <code>UPDATE</code> (<code>knowledgeItemsDB.ts:89-103</code>) with no separate history table.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Knowledge Reuse and Engineering Capital: reusable by future SEUs/Composition Engine/Capability Fulfilment/AI Participants/governance/analytics; reuse respects Acquisition Scope discoverability (Capability/Enterprise/Tenant-scoped, Platform requires codification); Engineering Capital is a filterable, groupable query, not a persistent object<br> Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/knowledgeItemsDB.ts:148-173</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>findEngineeringCapital()</code> is a real query (<code>WHERE acquisition_scope != 'SEU'</code>), joined to Deliverable/SEU/Objective/Capability, ordered by scope — matching "not a distinct persistent object, a filterable query." No Tenant or Capability filter is applied to restrict *discoverability* to the correct Tenant/Capability (<code>knowledge_items</code> has no <code>tenant_id</code> column at all, confirmed in the schema recovery file), so the chapter's discoverability-boundary rule is unenforced. No evidence in this repository that Composition Engine, Capability Fulfilment, or AI Participants actually consume this query.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Organisational Learning Obligation raised when sustained reuse/Telemetry indicates formal codification<br> Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/knowledge.ts:256-275</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>promoteKnowledgeItemScope</code> calls <code>createObligation({category: "Organisational Learning", ...})</code> on every successful promotion, with a title/description referencing Ch.16 §13 codification. This fires on every promotion unconditionally, not specifically gated on "sustained reuse or Telemetry indicating" — the chapter frames codification as a judgment trigger; the code raises the Obligation as an automatic consequence of promotion itself.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Knowledge Provenance: originating SEU, originating Deliverable, originating Participant, supporting Evidence, supporting Decisions, validation history — never lost<br> Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/knowledge_items_schema_recovery.sql:5-7, 21-28<br>src/dblayer/knowledgeItemsDB.ts:121-146</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All 6 named provenance elements map to real, dedicated storage: <code>seu_id</code>, <code>deliverable_id</code>, <code>author_id</code> (originating Participant, nullable), <code>evidence_references</code>, <code>decision_references</code>, and <code>knowledge_validation_notes</code> (append-only validation history table). <code>decision_references</code> is not kept consistent with the reverse <code>decisions.knowledge_ids</code> array — nothing synchronizes the two sides, so provenance recorded from the Decision side does not guarantee the Knowledge side reflects it. No delete path exists on provenance fields, consistent with "never lost."</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Knowledge Versioning: historical versions remain available; superseded Knowledge remains traceable; consumers can determine which version a given SEU used<br> Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/knowledge_items_schema_recovery.sql:25</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The <code>version</code> column is static (no bump mechanism, no Edit path exists for Knowledge content at all). "Historical versions remain available" and "which version was used by a given SEU" have no implementation: there is no versions table, no historical snapshot, and the single <code>version</code> value never changes, so there is nothing to distinguish between versions for a consumer to resolve against.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Events: KnowledgeObserved, Proposed, Validated, Accepted, Published, Updated, ScopePromoted, Deprecated, Archived<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/knowledge.ts:79-89, 173-182, 245-254</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>KnowledgeObserved</code> fires as a direct literal at creation (ungoverned — no transition row exists for entry into <code>Observed</code>). <code>transitionKnowledgeItem</code> and <code>promoteKnowledgeItemScope</code> publish <code>gate.eventType</code> read from <code>transition_definitions</code>, giving real per-state events for Proposed/Validated/Accepted/Published/Deprecated/Archived and <code>KnowledgeScopePromoted</code>. <code>KnowledgeUpdated</code> from §16's list is used only as a fallback literal (<code>gate.eventType ?? "KnowledgeUpdated"</code>) if a transition row's <code>event_type</code> were ever null — in current code paths this fallback is not exercised for any of the 6 seeded Knowledge hops, since all 6 have <code>event_type</code> populated per the transition definitions this code reads.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Non-Functional: preserve provenance, support semantic relationships, support reuse across SEUs, remain independent of Participant implementations, support incremental evolution, preserve complete traceability<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(see §10, §13, §14, §15 rows above)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Provenance and traceability are fully met (§14 row); semantic relationships, reuse, and incremental evolution (versioning) are each partially met per their own rows above, since storage/mechanism exists but enforcement or consumption is incomplete; independence from Participants is fully met (KM-005 row).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance Criteria (§18): unique identity; Evidence referenced; reusable across SEUs; provenance preserved; historical versions accessible; independent of Participants; Acquisition Scope declared/respected/queryable as Engineering Capital<br> Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(aggregate of rows above)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Unique identity, provenance preservation, Participant independence, and Acquisition Scope declaration/respect/queryability are each fully or substantively met per their individual rows above. "Every Knowledge Item references supporting Evidence" is satisfied only as an optional relationship, not an enforced one (§8/KM-003 row). "Historical versions remain accessible" has no implementation (§15 row: Not met). "Reusable across SEUs" is a discoverability filter only (§13 row).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables (§19): domain model, repository interfaces, lifecycle service, versioning service, provenance model, APIs, events<br> Ref: §19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts (KnowledgeItemRow/EngineeringCapitalRow types)<br>src/dblayer/knowledgeItemsDB.ts:1-197<br>src/routes/seu/core/knowledge.ts:1-318<br>src/routes/seu/api/knowledge.ts:1-140</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Domain model, repository interfaces, lifecycle service, provenance model, APIs, and events all have real, substantive implementations as cited. "Knowledge versioning service" has no distinct service: the <code>version</code> column exists but nothing bumps it, and there is no dedicated versioning module — the closest equivalent is filtering <code>events</code> by the version-significant event types, which is a read-path convention, not a built service.</td>
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

- **No Knowledge versioning service** (§15, FR-16.4): the `version` column is static; no Edit path exists for Knowledge content, so no mechanism bumps it, and there is no way for a consumer to resolve "which version a given SEU used" beyond manually filtering the event log.
- **No referential integrity on relationship/reference JSONB columns** (§8, §10): ids inside `evidence_references`, `deliverable_references`, `decision_references`, `knowledge_references` are never checked against their target tables; nothing outside the self-reference guard consumes these relationships at runtime.
- **Reuse across SEUs is a discoverability filter, not an operation** (§13, KM-004, FR-16.6): `findEngineeringCapital()` surfaces non-SEU-scoped items; no code attaches or copies a Knowledge Item into a second SEU's own working set.
- **Tenant/Capability discoverability boundaries unenforced** (§13): `knowledge_items` has no `tenant_id` column, so Capability- and Enterprise-scoped reuse cannot be restricted to the correct Tenant at the database level.
- **No demotion-deprecation behavior** (§12): the chapter's specific "demotion deprecates the broader-scoped item while a narrower successor may exist" rule has no implementing code; demotion is merely unreachable (no transition row), not actively handled per the stated semantics.
- **Decision/Knowledge cross-references not synchronized** (§14): `knowledge_items.decision_references` and `decisions.knowledge_ids` are independently maintained with no code keeping them consistent.
- **Pack-contributed Knowledge categories unbuilt** (§7): the extension point is schema-ready (`contributed_by_pack`) but no Pack seed or code path populates it for `category:knowledge`.
