# Chapter 17 — Evidence Model: Implementation Traceability

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evidence is a first-class engineering asset supporting Deliverables, Knowledge, Decisions, Obligations, Governance<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/evidenceDB.ts:109-123<br>src/routes/seu/core/evidence.ts:44-110</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>evidence</code> is its own table with its own lifecycle, not an attachment on another entity. <code>evidence_relationships</code> makes it referenceable from any <code>TransitionEntityType</code>, not just Deliverable.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evidence abstraction, lifecycle, relationships, validation, provenance, reuse are all defined (§2 scope)<br> Ref: §2 Scope</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/evidence.ts (whole file)<br>src/dblayer/evidenceDB.ts (whole file)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Abstraction, lifecycle, relationships, validation and provenance are all implemented (see individual rows below). Reuse is the one scope item left aspirational — see FR-17.7/§14 row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Architectural position: Evidence sits between Engineering Activity and Knowledge/Decision/Deliverable transition<br> Ref: §3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/compliance.ts:76-81<br>src/routes/seu/core/traceability.ts:119-193</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>requires_accepted_evidence</code> Quality Gate criterion gates Deliverable transitions on Evidence; <code>explainDeliverable</code> surfaces <code>supportingEvidence</code> in the Deliverable's own traceability view. No equivalent code path was found feeding Evidence into Knowledge or Decision specifically.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evidence is verifiable information supporting an engineering assertion, independent of Participants<br> Ref: §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/evidence_schema_recovery.sql:1-38</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>evidence</code> table carries no participant-attribution/ownership column (an <code>author_id</code>/<code>author_badge</code> pair records who authored the record for audit, not an ownership or assertion-subject link). Access is gated by badge, not by participant identity (see EM-006/§17 row).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evidence is immutable once accepted (§4)<br> Ref: §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/evidenceDB.ts:13-219</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No update/content-mutation function exists on <code>evidence</code> beyond <code>updateStatus</code> (lifecycle state only) and <code>appendValidationAssessment</code> (append-only, never overwrites). No function writes to <code>category</code>, <code>title</code>, <code>description</code>, or <code>source</code> after creation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evidence may support multiple engineering objects simultaneously (§4)<br> Ref: §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/evidenceDB.ts:66-94<br>src/dblayer/recovery/evidence_relationships_schema_recovery.sql:3-10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>evidence_relationships</code> is a genuine many-to-many join table (<code>UNIQUE(evidence_id, related_object_type, related_object_id)</code>); <code>addRelationship</code>/<code>findRelationshipsByEvidenceId</code> confirm one Evidence row can carry N relationship rows.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">EM-001 Evidence precedes trust<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/evidence.ts:239-276</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>transitionEvidence</code> requires passing <code>transitionEngine.evaluate</code> and <code>qualityGateEngine.evaluate</code> before any state change; no code path allows an entity to rely on Evidence before it exists as a row. Architectural principle, not independently testable beyond this.</td>
    </tr>
| EM-002 Evidence is immutable after acceptance | §5 | src/dblayer/evidenceDB.ts:167-200 | `updateStatus` only ever changes `status`/`updated_at`; `appendValidationAssessment` only appends to `validation_dimensions` via `||` (jsonb concat), never overwrites prior entries. No function updates `title`/`description`/`source`/`category` at any lifecycle stage. | Fully met |
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">EM-003 Evidence is independently identifiable<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/evidence_schema_recovery.sql:4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>id UUID PRIMARY KEY DEFAULT gen_random_uuid()</code> — identity is self-contained, not derived from a parent object's id.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">EM-004 Evidence may support multiple engineering artefacts<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/evidenceDB.ts:66-123</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same <code>evidence_relationships</code> mechanism as the §4 row above.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">EM-005 Evidence shall preserve provenance<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/evidenceDB.ts:14-61<br>src/routes/seu/core/evidence.ts:44-77</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>evidenceDB.create</code> always inserts a <code>related_object_type: 'SEU'</code> relationship row plus the triggering object's own relationship row at creation time; these rows are never deleted by any function in the file. Provenance is preserved via relationship rows rather than dedicated originating-* columns (see §12 row for the column-level detail and the one dropped field).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">EM-006 Evidence shall remain independently reusable<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No function or route found that tracks "Evidence reused in context X" or checks applicability of a cross-context reuse. See §14 row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-17.1 unique identifier<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/evidence_schema_recovery.sql:4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">UUID primary key, generated server-side, never user-supplied.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-17.2 provenance<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/evidenceDB.ts:14-61, 83-94</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same <code>evidence_relationships</code> mechanism; every <code>create</code> call records at minimum the originating SEU and the originating related object.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-17.3 versioning<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/evidenceDB.ts:133-144<br>src/routes/seu/core/evidence.ts:91-107<br>src/dblayer/seed/data/transitionDefinitions.json:445-455</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>supersedes_evidence_id</code> self-reference plus <code>findSupersededBy</code> reverse lookup form a supersession chain. The <code>Collected→Validated</code> transition_definitions row carries <code>"versionEvent": "VersionCreated"</code>; Supersede itself publishes <code>EvidenceSuperseded</code> with <code>payload.versionEvent: "VersionSuperseded"</code> directly (not via a transition_definitions row, since Supersede creates a new row rather than moving an existing one between states).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-17.4 multiple relationships<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/evidenceDB.ts:66-94</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same mechanism as EM-004.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-17.5 immutable after acceptance<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/evidenceDB.ts:167-200</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same mechanism as EM-002.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-17.6 fully traceable<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:119-193</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>explainDeliverable</code> queries <code>evidenceDB.findByRelatedObject("Deliverable", deliverableId)</code> and surfaces it as <code>supportingEvidence</code>. This establishes traceability in the Deliverable direction only; no equivalent explain/traceability function was found for Knowledge, Decision, Obligation, or SEU that surfaces linked Evidence the same way.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-17.7 reusable across multiple engineering objects<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/evidence.ts:134-163</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>linkEvidenceToObject</code> lets an already-created Evidence row be attached to an additional object after the fact, and <code>findByRelatedObject</code> is not ownership-filtered, so a given Evidence row is discoverable and attachable across SEUs. This satisfies "reusable" in the sense of "re-attachable," but there is no mechanism recording which attachments are reuses, nor an applicability check on reuse (§14).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evidence categories: Analytical, Validation, Operational, Review, Decision, External, extensible via Packs<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/ontologyConcepts.json:3-1938 (category:evidence concepts)<br>src/routes/seu/core/evidence.ts:56</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>createEvidence</code> calls <code>assertCanonicalCategory("category:evidence", input.category)</code> — category is Ontology-governed, not a hardcoded enum, so Pack-contributed categories are supported by construction. The 6 chapter-named categories exist as seeded <code>category:evidence</code> concepts.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evidence Structure: Identifier, Title, Category, Description, Status, Source, Collection Method, Confidence Level, Timestamp, Related Deliverables/Knowledge/Decisions/Obligations, Provenance<br> Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/evidence_schema_recovery.sql:3-38</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Present as real columns/mechanisms: <code>id</code>, <code>title</code>, <code>category</code>, <code>description</code>, <code>status</code>, <code>source</code>, <code>confidence_level</code>, <code>created_at</code>/<code>updated_at</code>, and <code>evidence_relationships</code> (covering related Deliverables/Knowledge/Decisions/Obligations and provenance uniformly). **Missing**: no <code>collection_method</code> column or equivalent field exists anywhere in the schema or <code>EvidenceRow</code> type usage. The chapter lists Collection Method as a field distinct from Source.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evidence Lifecycle: Collected → Validated → Accepted → Referenced → Archived, with Rejected preserved for audit<br> Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:445-505<br>src/routes/seu/core/evidence.ts:230-293</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All 5 forward hops exist as <code>transition_definitions</code> rows with authority/policy gates. Two <code>Rejected</code> branches exist (<code>Collected→Rejected</code>, <code>Validated→Rejected</code>); <code>evidenceDB.updateStatus</code> only changes <code>status</code>, so a rejected row's content remains in the table (preserved, not deleted) — satisfies "remain preserved for audit."</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evidence may support Deliverables, Knowledge, Decisions, Obligations, Quality Gates, Reviews, Policies; one Evidence Item may support many artefacts<br> Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/evidenceDB.ts:109-123<br>src/routes/seu/core/compliance.ts:76-81</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>findByRelatedObject</code> is generic over <code>TransitionEntityType</code> and <code>evidence_relationships.related_object_type</code> is an unconstrained TEXT column, so Deliverable/Knowledge/Decision/Obligation/Quality-Gate linkage is all reachable through the one mechanism, and multiple simultaneous links are supported (confirmed above). No code path was found creating an <code>evidence_relationships</code> row with <code>related_object_type</code> of <code>'Review'</code> or <code>'Policy'</code> — Review and Policy linkage is schema-capable but has no producing code path.</td>
    </tr>
| Evidence shall be validated before acceptance, across authenticity/completeness/consistency/source credibility/engineering relevance; rules governed by Engineering Behavior Model | §11 | src/routes/seu/core/evidence.ts:165-207<br>src/dblayer/seed/data/ontologyConcepts.json:7725-7805 | `recordValidationAssessment` writes `{dimension, status, notes, assessedAt}` into `validation_dimensions` (append-only, enforced at the SQL level via jsonb `||` concat). `dimension` is validated against the Ontology-governed `evidence-validation-dimension` concept type (5 seeded concepts) and `status` against `evidence-validation-status` (4 seeded: Not Assessed/Pass/Partial/Fail) — i.e. validated via Ontology concepts, consistent with governance-by-concept rather than a separate "Engineering Behavior Model" module. The `transitionEngine`/`qualityGateEngine` gate (src/routes/seu/core/evidence.ts:239-276) enforces that a transition (including into Accepted) cannot proceed without passing its governing Quality Gate, which is where "validated before acceptance" is enforced procedurally. | Fully met |
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evidence Provenance: originating SEU, Deliverable, Participant, Capability, Decision, engineering activity; never discarded<br> Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/evidenceDB.ts:14-61<br>src/dblayer/recovery/evidence_schema_recovery.sql:16-20, 29-35</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Current schema carries no dedicated <code>originating_*</code> columns (they were added then dropped per the recovery script's own ALTER/DROP sequence, lines 16-20 then 29-35) — provenance is expressed as <code>evidence_relationships</code> rows of the relevant <code>related_object_type</code> instead (SEU, Deliverable, Participant, Capability, Decision are all valid <code>TransitionEntityType</code>/relationship-type values, and <code>create</code> always inserts at least the SEU + originating-object rows). **Gap**: <code>originating_activity</code> (free-text, not an entity reference) has no column and no relationship-row equivalent — it is dropped with no replacement, so "originating engineering activity" is not preserved for any Evidence row created under the current schema.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evidence Confidence: every item includes a confidence assessment, influenced by source reliability/validation outcome/corroborating evidence/engineering review, not replacing engineering judgement<br> Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/evidence.ts:172-179, 188-206<br>src/dblayer/recovery/evidence_schema_recovery.sql:10, 27-28</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>confidence_level</code> is nullable (no default — chapter line 27-28 drops the old NOT NULL/default) and only populated once <code>recordValidationAssessment</code> has been called at least once. <code>computeConfidenceLevel</code> derives it purely from the worst <code>validation_dimensions</code> status across full history (Fail→Low, else Partial→Medium, else High) — this operationalizes "influenced by validation outcome" but there is no code path incorporating "source reliability," "corroborating evidence," or "engineering review" as separate inputs into the computed value; those remain implicit in how a human records a <code>status</code> for the <code>source-credibility</code>/<code>engineering-relevance</code> dimensions, not as distinct signals the formula weighs.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evidence Reuse: reuse preserves provenance/original context/validation history/source references; consumers can determine current applicability<br> Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>linkEvidenceToObject</code> preserves provenance mechanically (nothing is ever deleted from <code>evidence_relationships</code>), and validation history/source are never overwritten (immutability, confirmed above), so the three preservation sub-requirements hold as a side effect of immutability. **Gap**: no function, route, or field was found that lets a consumer determine "whether reused evidence remains applicable to the current context" — there is no applicability flag, staleness check, or reuse-context record anywhere in <code>evidenceDB.ts</code>, <code>evidence.ts</code>, or <code>api/evidence.ts</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evidence Immutability: accepted Evidence not modified; corrections create new linked Evidence Items; historical Evidence remains accessible<br> Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/evidenceDB.ts:14-200<br>src/routes/seu/core/evidence.ts:44-110</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Confirmed per EM-002 row (no content-update path). <code>supersedesEvidenceId</code> on <code>createEvidence</code> is exactly "corrections create new Evidence Items linked to previous versions." <code>findById</code>/<code>findByRelatedObject</code>/<code>findSupersededBy</code> never filter out superseded or archived rows, so historical Evidence remains queryable.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Events: EvidenceCollected, EvidenceValidated, EvidenceAccepted, EvidenceRejected, EvidenceReferenced, EvidenceArchived<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/evidence.ts:80-89, 281-290<br>src/dblayer/seed/data/transitionDefinitions.json:445-504</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>EvidenceCollected</code> is published directly in <code>createEvidence</code>. The other 5 named events are published from <code>transitionEvidence</code> via <code>gate.eventType</code>, sourced from each transition's own <code>transition_definitions.eventType</code> column (<code>EvidenceValidated</code>/<code>EvidenceAccepted</code>/<code>EvidenceReferenced</code>/<code>EvidenceArchived</code>/<code>EvidenceRejected</code> all present at lines 453,464,474,484,494,504) — all 6 named events are reachable, data-driven rather than hardcoded.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: preserve provenance, maintain immutability, support traceability, support independent reuse, remain independent of Participant implementations<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/api/evidence.ts:10-11, 22-25</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Provenance/immutability confirmed above. Traceability confirmed partial (Deliverable-direction only, §6/FR-17.6 row). Independent reuse confirmed partial (§14 row). Participant-independence: <code>resolveHeldBadges</code>/<code>resolveAuthorBadge</code>/<code>lookupRouteAuthority</code> gate every write route by held badge resolved from <code>route_authority</code>, not by matching any participant-identity field — <code>evidence</code>/<code>evidence_relationships</code> schemas carry no participant-ownership column that access logic reads.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance Criteria: unique identity, immutable once accepted, supports multiple artefacts, provenance preserved, confidence available, historical Evidence accessible<br> Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(see individual rows above)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All six criteria map 1:1 to rows already verified above: unique identity (Fully met), immutable (Fully met), multiple artefacts (Fully met), provenance (Partially met — activity field gap), confidence (Partially met — narrower input set than specified), historical accessibility (Fully met).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables: Evidence domain model, repository interfaces, lifecycle service, Provenance service, Confidence assessment model, Evidence APIs, Evidence events<br> Ref: §19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/evidenceDB.ts<br>src/routes/seu/core/evidence.ts<br>src/routes/seu/api/evidence.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Domain model (<code>EvidenceRow</code>/<code>EvidenceRelationshipRow</code>/<code>EvidenceValidationAssessment</code> types), repository interface (<code>evidenceDB</code>), lifecycle service (<code>createEvidence</code>/<code>transitionEvidence</code>), confidence model (<code>computeConfidenceLevel</code>), APIs (5 routes in api/evidence.ts, each with a <code>route_authority</code> row confirmed present), and events (§16 row) are all present as distinct, locatable artefacts. A dedicated "Provenance service" is not a separate module — provenance is a property of <code>evidenceDB</code>'s relationship functions, not its own service — a naming/structure difference from the deliverable list, not a missing capability.</td>
    </tr>
  </tbody>
</table>
## Summary

- Total intents analysed: 27
- Fully met: 15
- Partially met: 11
- Not met: 1
- Not Verifiable: 0

## Major Implementation Gaps

1. **Collection Method field absent** (§8) — chapter names it as a field distinct from Source; no column or equivalent exists.
2. **`originating_activity` provenance dropped with no replacement** (§12) — free-text originating-engineering-activity has no column and no relationship-row equivalent under the current schema; every other provenance target (SEU/Deliverable/Participant/Capability/Decision) is preserved via `evidence_relationships`.
3. **EM-006 / FR-17.7 / §14 reuse-applicability tracking is absent** (not a partial — no mechanism at all) — no field, function, or route records that an Evidence Item was reused in a given context, or whether it remains applicable there.
4. **Review and Policy linkage has no producing code path** (§10) — schema-capable via `related_object_type`, but no function was found that ever creates such a row.
5. **Confidence computation uses a narrower input set than specified** (§13) — only `validation_dimensions` status feeds the computed value; "source reliability," "corroborating evidence," and "engineering review" as independent inputs are not represented separately.
6. **Traceability is Deliverable-directional only** (§6 FR-17.6) — no equivalent surfacing function found for Knowledge/Decision/Obligation/SEU.
