# Chapter 19 — Decision Model: Implementation Traceability

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">Decisions are first-class, preserved knowledge objects recording engineering judgement<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/decisions_schema_recovery.sql:3-18<br>src/dblayer/decisionsDB.ts:5-47</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>decisions</code> is a real table with no delete path anywhere in <code>decisionsDB.ts</code>; <code>createDecision</code> is the sole write entry point.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Decision records the engineering question, alternatives, rationale, selected outcome<br> Ref: §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:1969-1996<br>src/routes/seu/core/decisions.ts:30-95</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>engineering_question</code>, <code>alternatives[]</code> (each with <code>statement</code>/<code>assumptions</code>/<code>consequences</code>/<code>status</code>/<code>rationale</code>) are real columns. "Selected outcome" is the <code>alternatives[]</code> entry whose <code>status</code> is the Ontology concept <code>Approved</code>, not a separate field.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Decision is independent of the Participant that created it<br> Ref: §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/decisions.ts:17-28,59,172-174</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>participant_id</code> is captured at creation and overwritten on every governed transition via <code>resolveParticipantId</code>; independence means the acting Participant is replaceable, not that attribution is absent. Matches the chapter read literally only if "independent of" means "not bound to a single Participant" rather than "has none recorded" — code takes the former reading.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Decisions sit between Knowledge/Evidence and Deliverable state transitions<br> Ref: §3 Architectural Position</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/qualityGateEngine.ts:46,190-213<br>src/domain/engine/dependencyDefinitionEngine.ts:109-123</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>qualityGateEngine</code> and <code>dependencyDefinitionEngine</code> both treat an Approved/Applied Decision as equivalent to accepted Evidence for satisfying a gate/dependency on any governed entity type, not Deliverable alone.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">DM-001: every significant decision explicitly recorded<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/decisions.ts:30-95</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>createDecision</code> is the only write path into <code>decisions</code>; no other code path inserts a row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">DM-002: every decision possesses supporting Evidence<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/decisionsDB.ts:22-41<br>src/routes/seu/api/decisions.ts:11-16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>evidence_ids UUID[]</code> is a real plural column. Neither the API handler nor <code>createDecision</code> rejects an empty/absent <code>evidenceIds</code> array.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">DM-003: every decision references applicable Knowledge<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/decisionsDB.ts:22-41</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same shape and same gap as DM-002 — <code>knowledge_ids[]</code> accepted with no non-empty check.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">DM-004: every decision preserves engineering context<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/decisions.ts:30-53</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>seu_id</code> (pins EBM transitively), <code>originating_type/id</code>, <code>related_objects[]</code> (any entity type incl. Ontology/Obligation/Policy), <code>alternatives[].assumptions</code> together cover every context element named in §11.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">DM-005: decisions remain independently identifiable<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/decisions_schema_recovery.sql:4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>id UUID PRIMARY KEY DEFAULT gen_random_uuid()</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">DM-006: historical decisions never lost<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/decisionsDB.ts:5-111</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No delete/purge function exists on <code>decisionsDB</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-19.1: globally unique identifier<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/decisions_schema_recovery.sql:4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same as DM-005.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-19.2: references supporting Evidence<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/decisionsDB.ts:13,33</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same gap as DM-002 — plural, present, not enforced non-empty.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-19.3: references applicable Knowledge<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/decisionsDB.ts:12,32</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same gap as DM-003.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-19.4: records alternatives considered<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:1969-1979<br>src/routes/seu/core/decisions.ts:55-57</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>alternatives[]</code> structured; each entry's <code>status</code> validated against the Ontology concept type <code>decision-alternative-status</code> via <code>assertCanonicalCategory</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-19.5: maintains complete decision history<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:561-622<br>src/routes/seu/core/decisions.ts:177-186</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each of the 7 Decision transitions carries a distinct literal <code>eventType</code> (<code>DecisionAnalysed</code>…<code>DecisionArchived</code>); <code>transitionDecision</code> publishes <code>gate.eventType</code>, giving a full per-state event trail, not one generic transition event.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-19.6: decisions support supersession<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:605-612<br>src/dblayer/seuTypes.ts:1981-1998</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>Superseded</code> is a real lifecycle state (<code>Applied→Superseded</code>), but <code>DecisionRow</code> has no <code>supersedes</code>/<code>superseded_by</code> column; <code>related_objects[]</code> can link to another Decision generically but that is not a dedicated supersession pointer.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-19.7: decision provenance permanently available<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/decisions.ts:17-28,82-92<br>src/dblayer/seuTypes.ts:1981-1998</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>participant_id</code>/<code>authority_badge</code>/<code>originating_type</code>/<code>originating_id</code>/<code>related_objects</code>/<code>related_seu</code> all persisted; <code>decisionsDB.updateStatus</code> (decisionsDB.ts:93-110) only ever touches <code>status</code>/<code>participant_id</code>/<code>authority_badge</code>/<code>updated_at</code> — no path overwrites <code>title</code>/<code>alternatives</code>/etc.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Decision categories: Architecture, Design, Engineering, Operational, Governance<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/ontologyConcepts.json:21,30,7644,7653,7662<br>src/routes/seu/core/decisions.ts:44</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All 5 named categories exist as <code>concept_type: "category:decision"</code> Ontology rows; <code>assertCanonicalCategory("category:decision", input.category)</code> enforces membership at creation. Pack-contributed categories beyond the seeded 5 are not wired (tracked separately as CR-056, not re-verified here).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Decision Structure: Identifier/Title/Category/Engineering Question/Context/Alternatives/Selected Alternative/Supporting Knowledge/Supporting Evidence/Assumptions/Consequences/Status/Provenance/Version<br> Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:1981-1998</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">13 of 14 named fields map to real columns or structured sub-fields (Context via §11 fields below; Selected Alternative via <code>alternatives[].status</code>; Assumptions/Consequences per-alternative, not Decision-level). "Version" has no literal <code>version</code> column — see §15 finding below.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Decision Context: EBM version, SEU id, applicable Ontology, relevant Deliverables, applicable Constraints, active Obligations, engineering assumptions<br> Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/decisions.ts:30-53<br>src/dblayer/seuTypes.ts:1985-1996</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>seu_id</code> pins the EBM (EBM is SEU-scoped elsewhere in the platform, not re-verified in this pass); <code>related_objects[]</code> groups by <code>related_object_type</code> cover Ontology/Deliverable/Policy(Constraint)/Obligation generically; <code>alternatives[].assumptions</code> covers engineering assumptions. All 7 fields have a real mechanism; none is a dedicated named column — all share the one generic <code>related_objects[]</code> structure.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❓</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Decision shall never be interpreted outside its recorded context<br> Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No code enforces or checks this at read time; it is a usage/interpretation discipline, not a mechanism the code can verify or violate.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Decision Rationale explains why alternatives considered, why selected, why rejected, consequences<br> Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:1969-1979</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>rationale</code> is one free-text field per <code>alternatives[]</code> entry (alongside that entry's own <code>assumptions</code>/<code>consequences</code>/<code>status</code>). The four-part structure the chapter describes is not decomposed into four separate fields — all four land in one free-text string per alternative.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Decision Reuse: historical decisions inform future SEUs, considering context/Ontology/EBM/assumption/constraint differences<br> Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:1991-1993</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>related_seu[]</code> exists as a structured pointer to other SEUs/Packs, but no code reads, searches, recommends, or copies-forward from it. No search/match function over historical Decisions exists anywhere in the routes or domain engine checked.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Decision Provenance: originating SEU, originating Deliverable, contributing Participants, supporting Knowledge, supporting Evidence, approval history<br> Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/decisions.ts:17-28,59,82-92,172-186</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>seu_id</code>, <code>originating_type/id</code> + <code>related_objects[]</code>, <code>participant_id</code>, <code>knowledge_ids[]</code>, <code>evidence_ids[]</code> are all real. "Contributing Participants" is single-valued (most recent actor only, overwritten each transition) — full multi-actor history exists only implicitly, via the separate <code>events</code> stream keyed by <code>authorityBadge</code>/<code>actorId</code> per publish call, not as a field on <code>decisions</code> itself.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Decision provenance shall remain immutable<br> Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/decisionsDB.ts:93-110</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>updateStatus</code> is the only update function and touches only <code>status</code>/<code>participant_id</code>/<code>authority_badge</code>/<code>updated_at</code>; no function updates <code>title</code>, <code>alternatives</code>, <code>related_objects</code>, <code>knowledge_ids</code>, or <code>evidence_ids</code> after creation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Decision Versioning: modifications create new versions; superseded decisions remain available; historical Deliverables reference the version in effect at the time<br> Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:573-619<br>src/dblayer/seuTypes.ts:1981-1998</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>version_event</code> populated on 6 of 7 transitions (<code>VersionCreated→…→VersionSuperseded/Archived</code>), giving a read-time event-filter mechanism. There is no <code>version</code> column on <code>decisions</code>, no new-row-per-modification write path, and no mechanism by which a referencing Deliverable pins to "the version in effect at the time" — a reference to a Decision is always to the single current row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Events: DecisionIdentified/Analysed/Proposed/Reviewed/Approved/Applied/Superseded/Archived<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/decisions.ts:83-92,177-186<br>src/dblayer/seed/data/transitionDefinitions.json:561-622</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All 8 named events are real, distinct <code>eventType</code> string literals: <code>DecisionIdentified</code> published directly in <code>createDecision</code>; the other 7 resolved per-transition from <code>transition_definitions.event_type</code> and published in <code>transitionDecision</code>. The <code>"DecisionTransitioned"</code> fallback in <code>transitionDecision</code> (decisions.ts:178) is unreachable in practice since every seeded transition row carries its own literal <code>eventType</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: preserve complete rationale<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:1978</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real, per-alternative, but still a single unstructured free-text field — not decomposed per §12's four parts.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: support versioning<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:573-619</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same event-tag mechanism as §15; no version-row mechanism.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: maintain provenance<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/decisions.ts:17-28,82-92</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same as §14 finding.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: remain independent of Participants<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/decisions.ts:23-28,172-174</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same as §4 finding — Participant is captured but replaceable.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: support explainability<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:1969-1996</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Structured <code>alternatives[]</code>, plural <code>knowledge_ids</code>/<code>evidence_ids</code>, per-state events together give a readable trail of what was considered and why.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: support long-term reuse<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:1991-1993</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same as §13 — <code>related_seu</code> is an unconsumed field, no reuse mechanism exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: unique identities / Knowledge+Evidence referenced / alternatives preserved / rationale recorded / provenance maintained / historical decisions reusable<br> Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(see FR-19.1–7, §12, §13, §14 citations above)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same findings as the corresponding FR/§ rows above, restated as acceptance criteria.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables: domain model, repository, lifecycle service, versioning service, relationship model, APIs, events<br> Ref: §19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:1981-1998 (domain model)<br>src/dblayer/decisionsDB.ts (repository)<br>src/routes/seu/core/decisions.ts:30-189 (lifecycle service)<br>src/routes/seu/api/decisions.ts (APIs)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Domain model, repository, lifecycle service, relationship model (<code>related_objects</code>/<code>related_seu</code>/<code>knowledge_ids</code>/<code>evidence_ids</code>/<code>originating_type+id</code>), APIs, and events (8/8) are all real and distinct artifacts. No dedicated "Decision versioning service" exists as its own module — versioning is the shared platform-wide event-tag read path, not Decision-specific code.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every new route gets a <code>route_authority</code> row (CR-110 cross-cutting rule, not chapter-specific)<br> Ref: —</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/routeAuthority.json:57-72,1747-1757</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All 4 Decision routes (<code>POST/GET /api/seu/decisions</code>, <code>POST /api/seu/decisions/:id/transition</code>, and the two web-layer equivalents) have <code>route_authority</code> rows.</td>
    </tr>
  </tbody>
</table>
## Summary

- Total intents analysed: 30
- Fully met: 18
- Partially met: 9
- Not met: 2
- Not verifiable: 1

## Major gaps (unranked, in spec order)

1. **DM-002/DM-003/FR-19.2/FR-19.3** — `knowledge_ids[]`/`evidence_ids[]` are real, plural columns, but neither `createDecision` nor the API handler enforces non-empty, so "every decision shall reference supporting Evidence/Knowledge" is not actually guaranteed at the write path.
2. **FR-19.6 / §15 Decision Versioning** — no `supersedes`/`superseded_by` column and no literal version-row mechanism; `Superseded` is a real state and `version_event` tagging exists, but the chapter's literal ask (new row per modification, historical references pinned to the version in effect at the time) is unbuilt. This matches a platform-wide pattern — no entity on this platform currently has a per-version-row write path — not a Decision-specific regression.
3. **§12 Decision Rationale** — the four-part structure (why considered / why selected / why rejected / consequences) collapses into one free-text `rationale` string per alternative; no decomposition into four fields.
4. **§13 Decision Reuse / NFR long-term reuse** — entirely unimplemented as behavior. `related_seu[]` is a real, structured field but nothing reads, searches, or recommends from it.
5. **§8 Decision Structure "Version" field** — no literal `version` column exists on `decisions`; same root cause as gap 2.
