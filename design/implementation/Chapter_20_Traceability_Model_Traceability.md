# Chapter 20 – Traceability Model: Implementation Traceability

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">Traceability records relationships between engineering artefacts, surviving the lifecycle of Participants and SEUs<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:111-196</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>explainDeliverable</code> persists relationships via ordinary entity FK columns and <code>attestations</code>/<code>deliverable_references</code> rows, which outlive the producing Participant/SEU. <br>There is no dedicated relationship-registry table; survivability is an incidental property of normal row persistence, not an engineered guarantee.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Traceability enables explaining outcomes, knowledge support, decision influence, and evidence justification<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:111-196</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>explainDeliverable</code> assembles supporting evidence/decisions/knowledge/obligations for one Deliverable. <br>No equivalent exists with Decision, Knowledge, or Evidence as the subject.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Traceability is a permanent engineering asset, independent of Participant/SEU lifecycle<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No history/version/snapshot table exists anywhere in the schema (verified via live <code>\dt</code> sweep, no matches for history/audit/snapshot tables). <br>Current relationships are only as permanent as the FK row they live on; if the row is updated or deleted, the prior relationship state is lost.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❓</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Chapter defines traceability abstraction, relationships, lifecycle, provenance, impact analysis, explainability<br> Ref: §2 Scope</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">n/a</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Scope statement, not independently verifiable; covered by downstream intents (§4, §8, §9, §10, §11, §12).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Traceability spans every persistent architectural concept, sitting above the Engineering Behavior Model and feeding Explainability<br> Ref: §3 Architectural Position</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:1-30</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The only real traceability code is scoped to Deliverables; EBM, Knowledge, Evidence, Decisions, Obligations, Participants are reachable only as nested fields inside <code>explainDeliverable</code>'s output, not as independent subjects feeding a shared Explainability layer.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Traceability is the explicit recording of relationships between engineering artefacts<br> Ref: §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/evidenceDB.ts:33-61</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Relationships are recorded, but almost always as a bare FK column on the child entity (<code>decisions.knowledge_id</code>, <code>obligations.related_object_id</code>, <code>knowledge_items.evidence_id</code>) rather than an explicit, independently-identified relationship record. <code>evidence_relationships</code> is the one table giving a relationship its own row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every significant engineering object shall participate in the Traceability Model<br> Ref: §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/evidenceDB.ts:33-61</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every entity table carries some FK/related-object column connecting it to others, so no object is fully disconnected. <br>Nothing enforces that a *new* object type must participate — participation is per-module convention, not a platform-enforced contract.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Traceability shall be established automatically wherever practical<br> Ref: §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/evidenceDB.ts:33-61</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>evidenceDB.create()</code> inserts the <code>evidence</code> row and its <code>evidence_relationships</code> row in the same transaction — relationship creation is automatic for the entities that call it. <br>This is bespoke per-entity code, not a generic reflective or trigger-driven linking engine.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Manual traceability shall remain supported where automation is not possible<br> Ref: §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No manual relationship-authoring UI or API was found (<code>grep -rn "relationship" src/routes</code> returns no authoring route).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">TM-001: Traceability is intrinsic, not dependent on manual documentation<br> Ref: §5 TM-001</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/evidenceDB.ts:33-61</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">True for FK-based linking, which is code-enforced rather than documentation-dependent. <br>But each entity module hand-codes its own linking; there is no single intrinsic mechanism the chapter implies.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">TM-002: Relationships are first-class engineering objects<br> Ref: §5 TM-002</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/evidenceDB.ts (evidence_relationships)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Only <code>evidence_relationships</code> rows have independent identity (own <code>id</code>, own row). <br>Every other relationship in the schema (<code>decisions.knowledge_id</code>, <code>.related_object_id</code>, <code>obligations.related_object_id</code>, <code>knowledge_items.evidence_id</code>/<code>.deliverable_id</code>) is a plain FK column with no row of its own.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">TM-003: Traceability shall be preserved throughout the engineering lifecycle<br> Ref: §5 TM-003</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FK columns persist as long as the owning row exists. There is no explicit lifecycle-preservation guarantee beyond ordinary row persistence (no cascade-protection, no archival copy on delete).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">TM-004: Every significant engineering decision shall be explainable<br> Ref: §5 TM-004</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:111-196</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real only for Deliverable-approval-shaped outcomes via <code>explainDeliverable</code>. Decisions, Evidence, Knowledge, and Obligations have no dedicated explain function of their own.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">TM-005: Historical traceability shall never be lost<br> Ref: §5 TM-005</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No history/version/audit/snapshot table exists anywhere in the schema. <code>ebms.version</code> increments in place without retaining the prior row; <code>evidence.supersedes_evidence_id</code> is a pointer chain, not a reconstructable history.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❓</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">TM-006: Traceability shall remain independent of implementation technologies<br> Ref: §5 TM-006</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Architectural framing; not independently code-testable.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-20.1: Every persistent engineering object shall possess traceable identity<br> Ref: §6 FR-20.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/evidenceDB.ts, src/dblayer/decisionsDB.ts, src/dblayer/obligationsDB.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every relevant table uses <code>id uuid DEFAULT gen_random_uuid()</code>, giving every row a stable, unique identity.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-20.2: Relationships shall possess unique identifiers<br> Ref: §6 FR-20.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/evidenceDB.ts (evidence_relationships.id); src/dblayer/dependencyDefinitionsDB.ts:48 (dependency_definitions.id)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">True only for the two tables where a relationship is its own row. The far more common case (<code>decisions.knowledge_id</code>, <code>obligations.related_object_id</code>, <code>knowledge_items.evidence_id</code>, <code>evidence.originating_decision_id</code>) is a bare FK column with no relationship-row identity.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-20.3: Traceability shall support forward navigation<br> Ref: §6 FR-20.3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:205-252</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>impactOfDeliverable</code> walks <code>dependency_definitions</code> forward via <code>findBySourceName</code>, a transitive downstream traversal. Scoped to Deliverable-to-Deliverable dependency edges only.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-20.4: Traceability shall support backward navigation<br> Ref: §6 FR-20.4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:111-196</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>explainDeliverable</code> resolves <code>dependsOn</code> via <code>findByTargetName</code> plus a provenance timeline, a real backward traversal. Scoped to Deliverables as the subject.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-20.5: The platform shall support impact analysis<br> Ref: §6 FR-20.5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:205-252</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>impactOfDeliverable</code> performs a transitive BFS with a visited-set cycle guard, tested in tests/traceability.test.ts:75-100. Covers exactly one relationship type (Deliverable depends-on Deliverable).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-20.6: The platform shall preserve historical relationships<br> Ref: §6 FR-20.6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>dependency_definitions</code> and <code>evidence_relationships</code> hold only current state; no prior-version row is retained on update.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-20.7: Relationship provenance shall remain permanently available<br> Ref: §6 FR-20.7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/evidenceDB.ts (evidence_relationships.created_at); src/routes/seu/core/traceability.ts:111-196 (attestations/deliverable_references)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>evidence_relationships</code> carries only a <code>created_at</code> timestamp, not the chapter's full provenance set. Real, fuller provenance exists one layer up, at the entity/state-transition level (<code>attestations</code>, <code>deliverable_references</code>) consumed by <code>explainDeliverable</code>, not at the relationship/edge level the chapter specifies.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The 12 named objects (Deliverables, Knowledge, Evidence, Decisions, Obligations, EBMs, Packs, Templates, Profiles, Ontology Concepts, Participants, Capabilities) participate in traceability<br> Ref: §7 Traceability Objects</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:111-196</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every object has some real FK connecting it to others. Deliverables alone have a dedicated query surface (<code>explainDeliverable</code>/<code>impactOfDeliverable</code>); the other 11 are reachable only as read-only nested fields inside that output, never as an independent traceable subject.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Future architectural objects shall participate in traceability by default<br> Ref: §7 Traceability Objects</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No generic/reflective linking mechanism exists that a new object type would inherit automatically (consistent with §4 finding); participation today requires a new entity module to hand-code its own FK columns.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Relationship types: Produces (Capability→Deliverable)<br> Ref: §8 Relationship Types</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/deliverablesDB.ts (deliverables.producing_capability_id)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real, stored edge.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Relationship types: Supports (Evidence→Knowledge, Knowledge→Decision, Decision→Deliverable)<br> Ref: §8 Relationship Types</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/knowledgeItemsDB.ts (knowledge_items.evidence_id); src/dblayer/decisionsDB.ts (decisions.knowledge_id, .related_object_type/id)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Knowledge→Decision and Decision→Deliverable are real stored edges. Evidence→Knowledge is real but inverted: the FK is <code>knowledge_items.evidence_id</code> (Knowledge references Evidence), not a Evidence-pointing-to-Knowledge edge as named.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Relationship types: References (Deliverable→Knowledge, Deliverable→Evidence, Decision→Ontology Concept)<br> Ref: §8 Relationship Types</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No dedicated search performed found distinct stored edges matching this exact direction beyond what is already covered by the Supports/Depends-Upon FKs; no separate "References" vocabulary or column exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Relationship types: Depends Upon (Deliverable→Deliverable, Obligation→Deliverable, Knowledge→Evidence)<br> Ref: §8 Relationship Types</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/dependencyDefinitionsDB.ts:48</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable→Deliverable is real (<code>dependency_definitions</code>). Obligation→Deliverable and Knowledge→Evidence are not confirmed as distinct stored edges beyond the <code>related_object_id</code>/<code>evidence_id</code> FKs already counted under Supports.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Relationship types: Governs (EBM→Deliverable, Pack→Behaviour, Policy→Decision)<br> Ref: §8 Relationship Types</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No stored edge of any kind found for any of these three pairs.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Relationship types: Supersedes (version relationships)<br> Ref: §8 Relationship Types</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/evidenceDB.ts (evidence.supersedes_evidence_id); src/dblayer/ebmsDB.ts (ebms.status='Superseded')</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Exists only as two isolated, unrelated instances, not a general cross-entity Supersedes mechanism.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Additional relationship types may be introduced through Packs<br> Ref: §8 Relationship Types</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Live query <code>SELECT DISTINCT concept_type FROM ontology_concepts</code> returns 15 concept types, none named <code>category:relationship</code> or equivalent. No <code>contributed_by_pack</code>-style mechanism exists for relationship types at all, though the mechanism exists for 8 other concept categories.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Relationships transition through Created → Validated → Active → Superseded → Archived<br> Ref: §9 Traceability Lifecycle</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No relationship-shaped table (<code>evidence_relationships</code>, <code>dependency_definitions</code>) has a <code>status</code>/<code>state</code> column. The <code>dependency_edges.readiness_state</code> table is the closest historical attempt and has 0 live rows (superseded by <code>dependency_definitions</code>, which itself has no lifecycle column).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Relationship history shall remain permanently available<br> Ref: §9 Traceability Lifecycle</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No relationship history mechanism exists (same gap as FR-20.6/TM-005).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every relationship shall preserve provenance (originating SEU/Deliverable/Participant, timestamp, originating Decision, EBM version)<br> Ref: §10 Provenance</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/evidenceDB.ts (evidence.originating_deliverable_id/.participant_id/.capability_id/.decision_id)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The 6 required fields are never captured together on a relationship row. Real provenance exists at the entity level (<code>evidence.originating_*</code> columns) and at the state-transition level (<code>attestations</code>, <code>deliverable_references</code>), not at the relationship/edge level the chapter specifies.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Traceability shall support complete engineering reconstruction<br> Ref: §10 Provenance</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No reconstruction mechanism exists (see §13 finding below); provenance fields that exist cannot be assembled into a full past-state view.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The platform shall explain any significant engineering outcome (approval, technology selection, obligation closure, dependency satisfaction, capability fulfilment)<br> Ref: §11 Explainability</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:111-196</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>explainDeliverable</code> genuinely walks stored records (producing capability, dependency edges, supporting evidence/decisions/knowledge/obligations, reviews/findings, provenance timeline) and answers "why was this Deliverable approved." The other 4 named example questions (technology selection, obligation closure, dependency satisfaction, capability fulfilment by a Participant) have no dedicated function.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Explainability shall be generated from traceability rather than reconstructed from logs<br> Ref: §11 Explainability</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:111-196</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>explainDeliverable</code> is built from stored records (attestations, references, FK joins), not log replay, matching this intent for the one case it covers.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The platform shall support impact analysis across the complete engineering graph<br> Ref: §12 Impact Analysis</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:205-252; tests/traceability.test.ts:75-100</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>impactOfDeliverable</code> is a real, tested transitive-closure query, but scoped to exactly one relationship type (Deliverable depends-on Deliverable). The other named examples (Decisions invalidated by Evidence change, SEUs reusing Knowledge, Knowledge Items using Evidence) have no implementation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The platform shall support reconstruction of engineering state at any point in time (Deliverable/EBM/Ontology/Knowledge/Decision/Evidence/Obligation state)<br> Ref: §13 Historical Reconstruction</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No history/version/audit/snapshot table exists anywhere in the schema, confirmed by direct sweep. <code>ebms.version</code> increments in place without retaining prior rows. Nothing can answer "what was the engineering state as of date X" for any of the named object types.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Traceability queries: Explain this Deliverable<br> Ref: §14 Traceability Queries</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:111-196, <code>GET /deliverables/:id/traceability</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real, implemented, routed.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Traceability queries: Show the decisions supporting this architecture<br> Ref: §14 Traceability Queries</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:111-196 (supportingDecisions field)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Reachable only as a nested field inside <code>explainDeliverable</code>'s output, not a standalone query; no "architecture" object exists to query against.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Traceability queries: Show evidence supporting this knowledge<br> Ref: §14 Traceability Queries</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No Knowledge-centric query exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Traceability queries: Show all downstream impacts<br> Ref: §14 Traceability Queries</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:205-252</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real via <code>impactOfDeliverable</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Traceability queries: Show engineering lineage<br> Ref: §14 Traceability Queries</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>grep -rn lineage src/</code> hits are unrelated Template/Pack parent-lineage comments, not a traceability query.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Traceability queries: Show Pack contributions<br> Ref: §14 Traceability Queries</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No implementation found.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❓</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The query mechanism is implementation-defined<br> Ref: §14 Traceability Queries</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Framing statement, not independently verifiable beyond the queries already assessed above.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Traceability subsystem shall publish RelationshipCreated/Validated/Updated/Superseded/Archived, TraceabilityQueryExecuted<br> Ref: §15 Events</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:178-185, 245-252</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Live query <code>SELECT DISTINCT event_type FROM events WHERE event_type ILIKE '%relationship%' OR event_type ILIKE '%traceab%'</code> returns exactly one type, <code>TraceabilityQueryExecuted</code> (published from both <code>explainDeliverable</code> and <code>impactOfDeliverable</code>). The 5 <code>Relationship*</code> events have zero hits, both live and via source grep — no relationship-lifecycle mechanism exists to emit them from (consistent with §9 finding).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❓</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: support large engineering graphs<br> Ref: §16 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No dedicated graph structure exists to stress-test; not evaluable given the headline absence of a graph subsystem.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: preserve historical relationships<br> Ref: §16 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No relationship history anywhere (§9, §10).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: support deterministic explainability<br> Ref: §16 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:111-196</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real and deterministic for Deliverables only (§11).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: support efficient impact analysis<br> Ref: §16 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:205-252</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real but single-relationship-type only (§12).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❓</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: remain independent of storage technologies<br> Ref: §16 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Architectural framing, not code-testable.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: every persistent object participates in traceability<br> Ref: §17 Acceptance Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/evidenceDB.ts:33-61</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Only via ad hoc FKs, reachable solely through a Deliverable-rooted query (§7, §4).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: relationships possess independent identity<br> Ref: §17 Acceptance Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Mostly false; only <code>evidence_relationships</code>/<code>dependency_definitions</code> rows qualify (§6 FR-20.2).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: historical reconstruction is possible<br> Ref: §17 Acceptance Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Not built (§13).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: explainability is derived from traceability<br> Ref: §17 Acceptance Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:111-196</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real for Deliverables only (§11).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: impact analysis operates across the engineering graph<br> Ref: §17 Acceptance Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:205-252</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real, but one relationship type only (§12).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: relationship provenance is preserved<br> Ref: §17 Acceptance Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Entity/transition-level provenance is real; relationship-level provenance is not (§10).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Traceability domain model<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Does not exist as a dedicated artifact; the "model" is the union of each entity's own FK columns.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Relationship registry<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Does not exist. Closest analog, <code>ontology_concepts</code>, does not cover relationship types (§8).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Provenance service<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:111-196</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Does not exist as a standalone service; provenance is composed inline inside <code>explainDeliverable</code> from <code>attestationsDB</code>/<code>deliverableReferencesDB</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Impact analysis service<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:205-252</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Exists narrowly as one function, <code>impactOfDeliverable</code>, for one entity type.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Historical reconstruction service<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Does not exist.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Traceability APIs<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:111-252, <code>GET /deliverables/:id/traceability</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Exists narrowly as one endpoint.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Traceability events<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:178-185, 245-252</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Exists narrowly as one event type (<code>TraceabilityQueryExecuted</code>); the other 5 named events do not exist.</td>
    </tr>
  </tbody>
</table>
## Summary

- Total intents analysed: 54
- Fully met: 5
- Partially met: 30
- Not met: 16
- Not Verifiable: 5 (NFR independence/graph-scale, query-mechanism framing, TM-006, §2 Scope statement, §12/§16 graph-scale items counted where distinct)

Major implementation gaps:

1. No dedicated Traceability subsystem exists. The chapter's design (relationship registry, lifecycle engine, provenance service, impact-analysis service, historical-reconstruction service) is implemented today only as a single Deliverable-scoped query module (`src/routes/seu/core/traceability.ts`: `explainDeliverable`/`impactOfDeliverable`) plus scattered per-entity FK columns.
2. Relationships are almost never first-class rows with independent identity, lifecycle state, or provenance — `evidence_relationships` and `dependency_definitions` are the only exceptions, and neither carries a lifecycle or full provenance set.
3. §8's Relationship Types have no vocabulary at all, Ontology-backed or otherwise. The one real Pack-attribution precedent (`ontology_concepts.contributed_by_pack`) already backs 8 other concept categories but has never been extended to relationship types.
4. No historical reconstruction mechanism exists anywhere in the schema; only 1 of 6 named Traceability events is implemented; and explainability/impact-analysis are both real but scoped to Deliverables alone, leaving Knowledge/Decision/Evidence/Obligation as subjects entirely unimplemented.
