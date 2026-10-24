# Implementation Traceability: Chapter 20 – Traceability Model

**Date of report: 23-10-2026**

Specification: src/docs/SEU Studio Specifications/03_Trust Pipeline/20_Traceability.md

## Traceability Table

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">Traceability records relationships between engineering artefacts and explains how outcomes were produced.<br>Ref: §1, §4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:82-173<br>src/routes/seu/api/deliverables.ts:47-59</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">explainDeliverable gathers the producing Capability, state provenance, dependencies, Evidence, Decisions, Knowledge, Obligations, Reviews and Findings for a Deliverable. The result is exposed at GET /api/seu/deliverables/:id/traceability.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Traceability is a permanent asset that survives the lifecycle of individual Participants and SEUs.<br>Ref: §1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/deliverable_references_schema_recovery.sql:3-13<br>src/dblayer/recovery/version_events_schema_recovery.sql:3-15<br>src/routes/seu/core/traceability.ts:103-126</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Provenance rows (deliverable_references, attestations) and version_events are append-only tables keyed by ids. The Traceability queries read them without deleting anything.<br>Gap:<br>The evidence_relationships and decisions links are plain rows with no lifecycle. No rule or test shows that relationships outlive an SEU or a Participant.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Traceability is established automatically wherever practical, with manual traceability supported.<br>Ref: §4, §5 TM-001</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/evidence_relationships_schema_recovery.sql:3-15<br>src/dblayer/recovery/decisions_schema_recovery.sql:22-25<br>src/routes/seu/core/traceability.ts:92-101</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Links arise as a by-product of governed actions. A transition writes a reference or attestation row, Evidence is linked through evidence_relationships, and a Decision stores related_objects and evidence_ids.<br>Gap:<br>There is no generic manual relationship authoring surface for arbitrary artefact pairs. Manual links exist only as per-entity form fields.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Relationships are first-class engineering objects (TM-002).<br>Ref: §5 TM-002, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/evidence_relationships_schema_recovery.sql:3-15<br>src/dblayer/recovery/dependency_definitions_schema_recovery.sql:3-13<br>src/dblayer/recovery/decisions_schema_recovery.sql:22-25</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>evidence_relationships and dependency_definitions are rows with their own UUID, author and badge.<br>Gap:<br>Decision to Evidence and Knowledge links are UUID arrays inside the decision row. Knowledge to Deliverable is a column. Obligation, Review and Finding links are related_object columns. These are not independent relationship objects. No unified relationship registry exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Traceability is preserved throughout the lifecycle and historical traceability is never lost.<br>Ref: §5 TM-003, TM-005, §6 FR-20.6, §9, §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/decisions_schema_recovery.sql:29<br>src/dblayer/recovery/evidence_schema_recovery.sql:22<br>src/dblayer/recovery/version_events_schema_recovery.sql:3-15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Provenance and version_events are insert-only. Decisions and Evidence keep superseded rows through superseded_by and supersedes_evidence_id.<br>Gap:<br>A relationship has no superseded or archived state, so a changed link such as a removed Evidence link has no history of its own. Nothing guards against deleting link rows.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every significant engineering decision is explainable (TM-004).<br>Ref: §5 TM-004, §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:82-173</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>explainDeliverable returns the supporting Decisions, Evidence and Knowledge of a Deliverable.<br>Gap:<br>No explanation is produced for a Decision itself. Decision rationale and alternatives are not part of the explanation output.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Traceability is independent of implementation technologies.<br>Ref: §5 TM-006, §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>The traceability queries call PostgreSQL DB-layer modules directly. No abstraction separates the Traceability Model from storage. The specification states the independence as a principle and no Traceability domain model exists in the code.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every persistent engineering object possesses a traceable identity.<br>Ref: §6 FR-20.1, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:92-101</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The traced entities (Deliverable, Evidence, Decision, Knowledge, Obligation, Review, Finding, Capability) have UUID primary keys and are reachable by id.<br>Gap:<br>Packs, Templates, Profiles, Ontology Concepts and Participants are not reachable through any traceability query.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Relationships have unique identifiers.<br>Ref: §6 FR-20.2, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/evidence_relationships_schema_recovery.sql:4<br>src/dblayer/recovery/dependency_definitions_schema_recovery.sql:4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Only dependency_definitions and evidence_relationships rows carry an id.<br>Gap:<br>Decision, Knowledge, Obligation, Review and Finding links have no identifier of their own. explainDeliverable returns no relationship id for most links. Relationship identity is therefore not met across the model.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Traceability supports forward navigation.<br>Ref: §6 FR-20.3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:175-224<br>tests/traceability.test.ts:72-97</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>impactOfDeliverable walks downstream Deliverable dependencies breadth-first and reports each dependency edge id. A test confirms the downstream Architecture Decision Record is found.<br>Gap:<br>Forward navigation covers Deliverable to Deliverable only. It does not follow Evidence to Knowledge, Knowledge to Decision or Decision to Deliverable.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Traceability supports backward navigation.<br>Ref: §6 FR-20.4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:82-173<br>tests/traceability.test.ts:35-70</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>explainDeliverable returns producing Capability, dependencies, provenance and linked artefacts. A test checks the producing Participant, reference and attestation.<br>Gap:<br>Navigation starts only from a Deliverable. There is no backward navigation from a Decision, Evidence or Knowledge item.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The platform supports impact analysis.<br>Ref: §6 FR-20.5, §12, §16, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:175-224</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Downstream Deliverable impact with readiness state.<br>Gap:<br>The specified questions on Decisions, Evidence and Knowledge reuse are unanswered. Examples are which Knowledge uses this Evidence, which SEUs reuse this Knowledge and which Decisions become invalid when Evidence changes. The traversal reads one dependency table, not the complete engineering graph.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Historical relationships are preserved.<br>Ref: §6 FR-20.6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:103-126</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Transition provenance is retained as append-only rows.<br>Gap:<br>Same gap as TM-005. Relationship rows have no history, supersession or archive.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Relationship provenance remains permanently available.<br>Ref: §6 FR-20.7, §10, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:20-28<br>src/routes/seu/core/traceability.ts:103-126<br>src/dblayer/recovery/evidence_relationships_schema_recovery.sql:3-15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Provenance entries carry state change, reference, Participant, acting badge and time. Evidence and dependency rows record author and badge.<br>Gap:<br>Originating SEU, originating Decision and Engineering Behavior Model version are not recorded per relationship.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Listed object kinds participate in traceability.<br>Ref: §7, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:82-173<br>src/routes/seu/core/dashboard.ts:35</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Deliverables, Knowledge, Evidence, Decisions, Obligations and Capabilities appear in the explanation. Reviews and Findings appear too.<br>Gap:<br>Engineering Behavior Models, Packs, Templates, Profiles, Ontology Concepts and Participants have no traceability participation. Dashboard notes that no Traceability Model exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Future architectural objects participate by default.<br>Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>Participation is hard-wired in explainDeliverable through a fixed list of DB modules. No registry makes a new object type participate automatically.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Relationship type Produces (Capability to Deliverable).<br>Ref: §8 Produces</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:128-132</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>deliverables.producing_capability_id is resolved to a Capability label.<br>Gap:<br>The link is a column, not a typed relationship.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Relationship type Supports (Evidence to Knowledge, Knowledge to Decision, Decision to Deliverable).<br>Ref: §8 Supports</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/decisions_schema_recovery.sql:22-25<br>src/dblayer/decisionsDB.ts:61-77</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Decision stores knowledge_ids and evidence_ids. Decision to Deliverable is read through related_objects.<br>Gap:<br>Evidence to Knowledge is not stored or traversed.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Relationship type References (Deliverable to Knowledge and Evidence, Decision to Ontology Concept).<br>Ref: §8 References</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:166-168<br>src/dblayer/knowledgeItemsDB.ts:51-59<br>src/dblayer/evidenceDB.ts:91-105</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Knowledge and Evidence of a Deliverable are listed.<br>Gap:<br>Decision to Ontology Concept is not traced.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Relationship type Depends Upon (Deliverable to Deliverable, Obligation to Deliverable, Knowledge to Evidence).<br>Ref: §8 Depends Upon</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:134-147<br>src/dblayer/obligationsDB.ts:56-67</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Deliverable to Deliverable dependency is read from dependency_definitions. Obligations of a Deliverable are listed.<br>Gap:<br>Knowledge to Evidence is not traced.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Relationship type Governs (EBM to Deliverable, Pack to Behaviour, Policy to Decision).<br>Ref: §8 Governs</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:77-80</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>explainDeliverable reads no Engineering Behavior Model, Pack or Policy governance links. The EBM is used only to resolve dependency scope.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Relationship type Supersedes covers version relationships.<br>Ref: §8 Supersedes</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/decisions_schema_recovery.sql:29<br>src/dblayer/recovery/evidence_schema_recovery.sql:22</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Decision superseded_by and Evidence supersedes_evidence_id exist.<br>Gap:<br>Superseding links are not returned by any traceability query.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Packs may introduce additional relationship types.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/dependency_definitions_schema_recovery.sql:19-23</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>The relationship_kind check is a closed list of four values. Packs cannot register a relationship type.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Relationships move through Created, Validated, Active, Superseded and Archived.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>No relationship lifecycle, state column or transition_definitions rows exist for relationships.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Relationship history remains permanently available.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Underlying rows are not deleted by the traceability code.<br>Gap:<br>Relationships have no history of their own.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Provenance covers originating SEU, Deliverable, Participant, timestamp, Decision and EBM version.<br>Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:20-28<br>src/dblayer/recovery/deliverable_references_schema_recovery.sql:3-13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Deliverable, Participant, timestamp and badge are captured for state changes.<br>Gap:<br>Originating Decision and EBM version are missing. SEU appears only through the Deliverable.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Traceability supports complete engineering reconstruction.<br>Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:126</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Provenance sorted by time gives the state history of one Deliverable.<br>Gap:<br>Reconstruction of the wider graph is not offered.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The platform explains significant outcomes such as why a Deliverable was approved.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:115-125<br>src/routes/seu/core/traceability.ts:166-171</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The attestation entry for the Approved state shows the Participant, badge and time. Linked Decisions and Evidence are listed.<br>Gap:<br>Why a technology was selected, an obligation closed, a dependency satisfied or a Capability fulfilled by a Participant has no explanation function.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Explainability is generated from traceability rather than reconstructed from logs.<br>Ref: §11, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:90-101</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">explainDeliverable reads relationship and provenance tables. It does not read the events log.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Impact analysis operates across the complete engineering graph.<br>Ref: §12, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:184-206</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Transitive closure over Deliverable dependencies.<br>Gap:<br>Other artefact kinds are not nodes of the traversal. See §12 questions.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Engineering state can be reconstructed at any point in time.<br>Ref: §13, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/versionEvents.ts:18-21<br>src/dblayer/versionEventsDB.ts:49-60<br>src/routes/seu/web/versionEvents.ts:13-39</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>version_events hold per-entity from and to states with time. getVersionReplay returns one entity's history. A web page lists version events.<br>Gap:<br>No service reconstructs Deliverable state, EBM, Ontology, Knowledge, Decision and Evidence versions and active Obligations at a chosen instant. Replay is per entity and has no traceability route.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Query: Explain this Deliverable.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:82-173<br>src/dblayer/seed/data/routeAuthority.json:61-66</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented through explainDeliverable and the API route. Authority for the route is a route_authority row with no badge requirement.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Queries: decisions supporting an architecture and evidence supporting knowledge.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:166-168</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Decisions and Evidence of a Deliverable are listed.<br>Gap:<br>There is no query from an architecture-level Decision or from a Knowledge item to its Evidence.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Query: Show all downstream impacts.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:175-224</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented for Deliverables through impactOfDeliverable. Other artefact kinds are not covered.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Queries: Show engineering lineage and Show Pack contributions.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>No lineage query and no Pack contribution query exists under the traceability module.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The subsystem publishes RelationshipCreated, Validated, Updated, Superseded, Archived and TraceabilityQueryExecuted.<br>Ref: §15, §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:149-159<br>src/routes/seu/core/traceability.ts:208-218</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>TraceabilityQueryExecuted is published by both queries with a system actor and badge.<br>Gap:<br>The five Relationship events are not published anywhere. Both queries publish after reading and then return, so each call writes an event row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The model supports large graphs, deterministic explainability and efficient impact analysis.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:134-147<br>src/routes/seu/core/traceability.ts:188-206</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>Impact analysis issues one query per node and per edge inside a loop. Explanation issues one query per sibling lookup. No pagination or indexing evidence for graph scale. No test of scale exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables: Traceability domain model, relationship registry, provenance service, impact analysis service, historical reconstruction service, APIs and events.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:82-224<br>src/routes/seu/api/deliverables.ts:47-59</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>An impact service, an explanation function and one API route exist.<br>Gap:<br>No domain model, relationship registry, dedicated provenance service or historical reconstruction service exists.</td>
    </tr>
  </tbody>
</table>

## Summary

- Total intents analysed: 38
- Fully met: 2
- Partially met: 27
- Not met: 9
- Not verifiable: 0
- Major implementation gaps: no relationship object model, registry or lifecycle; no Relationship events; traversal limited to Deliverable dependencies; no point-in-time reconstruction service; no Pack-defined relationship types; no lineage or Pack contribution queries.
