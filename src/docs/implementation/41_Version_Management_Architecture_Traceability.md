# Traceability Analysis: Chapter 41 – Version Management Architecture

**Date of report: 5-10-2026**

---

**References**: 

`design/foundations/03_Book 3 (Refined)/06_Part 6/Chapter 41.md`

`design/mvp-build-plan/Version Feature Plan.md`


---

## Traceability Table


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
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Revision is a mutable, pre-publication working state, never referenced by an active SEU<br> Ref: §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>design/mvp-build-plan/Version Feature Plan.md:26-27,50</code> <br> e.g. <code>src/routes/seu/core/objectives.ts</code> (<code>updateObjective</code>, edit-in-Proposed path)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each entity's own "Draft"/"Proposed" (pre-freeze) status row is mutable.<br> The entity's existing edit guard (e.g. <code>status !== "Proposed"</code> check) blocks edits once the row leaves that state. No entity-wide <code>Revision</code> type exists.<br> This is realized per-entity via each entity's own status column.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Version is an immutable snapshot, consumable by the Runtime Kernel / EBM / Transition Definitions / historical reconstruction<br> Ref: §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/transitionDefinitionsDB.ts:86-96</code> <br> <code>src/domain/engine/transitionEngine.ts:211-220</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Once an entity's row passes its first governed hop (e.g. Objective's Queue-to-Validate, Pack/Template/Profile's Draft→Validated), it is frozen<br> <code>transition_definitions.version_event</code> tags which published domain events correspond to a version-significant state change, per entity. No entity has a structurally separate "Version" record distinct from its own row — the row itself, post-freeze, is the Version.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every significant engineering artefact shall be versioned<br> Ref: §5 VM-001</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>transition_definitions</code> rows for Objective, Pack, Template, Profile, Service Definition, Policy Definition, Ontology (migrations 183-221, per <code>Version Feature Plan.md</code> Implementation status §1-8)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">9 of the chapter's own illustrative artefact types (§7) have real, populated <code>event_type</code>/<code>version_event</code> columns. SEU and EBM are deliberately excluded (<code>version_event</code> NULL by owner decision — SEU is a runtime-execution lifecycle, not an authoring lifecycle<br> EBM versioning is a separate, not-yet-built <code>EBMVersioned</code> concern, per <code>Version Feature Plan.md</code> item 6). Quality Gates, Authority Rules, Reviews, Runtime APIs (also named in §7) have no <code>transition_definitions</code> rows at all.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Versions are immutable<br> Ref: §5 VM-002</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/packsDB.ts:270-285</code> (<code>findActiveByCode</code>, <code>findVersionsByCode</code>) <br> entity edit guards per-entity (e.g. <code>objectivesDB.update</code> status check)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Once an entity row is frozen (post first governed hop), no code path updates that row's content in place — evolution is always a new row (<code>copyPackAsNewDraft</code>, <code>reactivateAsNewVersion</code>). Enforcement is per-entity (each entity's own guard), not a single shared immutability mechanism.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Historical engineering execution shall remain reproducible<br> Ref: §5 VM-003</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/seusDB.ts:91</code> (<code>active_ebm_id</code>) <br> <code>src/dblayer/ebmsDB.ts:13,53</code> (<code>compositionReport</code> persisted verbatim)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A SEU's <code>active_ebm_id</code> points at one immutable EBM row whose <code>compositionReport</code> snapshot is stored as-authored. This lets a SEU's active configuration be identified after the fact. No reconstruction/replay mechanism exists that reassembles a point-in-time engineering state from this data (see §12 row below) — the data needed for reproducibility is retained, but "reproducible" in the active sense the spec describes is not built.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Compatibility shall be explicitly declared as part of the engineering objects<br> Ref: §5 VM-004</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/routes/seu/core/packs.ts:226-251</code> (<code>supportedPlatformVersion</code>/<code>minSupportedPlatformVersion</code>/<code>maxSupportedPlatformVersion</code>/<code>incompatiblePackVersions</code> fields) <br> <code>PackDependencyType</code> incl. <code>"incompatible"</code> at <code>packs.ts:207,270</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">These platform-version fields have zero read sites anywhere in <code>src</code> (confirmed by grep, not inferred from the code's own comment). Compatibility IS declared and evaluated at the Pack-dependency level (<code>incompatible</code> type, see FR-41.3 row). A separate, built-but-unwired mechanism also exists: CR-114's <code>schemaDefinitionsDB.instancesCompatible</code> diffs two entities' schema versions, but has no call site in <code>src</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Version relationships shall remain traceable<br> Ref: §5 VM-005</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/packsDB.ts:287-289</code> (<code>findVersionsByCode</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A full version-history read path exists for Pack (<code>findVersionsByCode</code>, cited by the Pack Registry screen per its own comment). Chapter 41 §8's own "Parent Version" / "Superseded By" fields have no column anywhere in the schema (confirmed: no <code>parent_version</code>/<code>superseded_by</code> column found in any <code>*DB.ts</code> or <code>*_schema_recovery.sql</code>), and <code>Version Feature Plan.md:52</code> explicitly defers this as not yet designed. Traceability exists via <code>created_at</code> ordering and status, not an explicit parent/successor graph.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Version management shall remain independent of implementation technologies<br> Ref: §5 VM-006</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/transitionDefinitionsDB.ts</code> <br> <code>src/domain/engine/transitionEngine.ts</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The mechanism is a data-driven table (<code>transition_definitions</code>) read generically by one engine function, with no entity-specific or technology-specific code required to add a new versioned transition (per <code>Version Feature Plan.md:92</code>, "a new entity needs none of that added").</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every versioned artefact possesses global ID, version ID, creation timestamp, originating source, lifecycle state<br> Ref: §6 FR-41.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">e.g. <code>src/dblayer/packsDB.ts</code> (<code>id</code>, <code>pack_version</code>, <code>created_at</code>, <code>status</code>) <br> <code>SEMVER_RE</code> check at <code>src/routes/seu/core/packs.ts:324</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each entity row carries id/version/timestamp/status<br> "originating source" is realized as <code>tenant_id</code>/<code>publisher</code>/<code>author_id</code> depending on entity, not a single uniform field. Version identifier format is validated as semver for Pack at authoring time.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Version identifiers shall remain immutable<br> Ref: §6 FR-41.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/recovery/packs_schema_recovery.sql:27</code> (<code>UNIQUE(code, pack_version, tenant_id)</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The version identifier is a DB primary/unique-constraint column<br> no update path in any <code>*DB.ts</code> mutates a <code>version</code>/<code>pack_version</code> column after row creation for a frozen row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Version compatibility shall be validated before activation<br> Ref: §6 FR-41.3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/domain/engine/profileCompositionUnravel.ts:540-553</code> (incompatible-dependency conflict detection) <br> <code>src/routes/seu/core/packs.ts:294-356</code> (<code>validatePackSeed</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Pack-dependency-level incompatibility (<code>type: "incompatible"</code>, <code>satisfiedInComposedSet</code>) is checked during composition and raises a conflict. Platform-version-range compatibility is declared but never evaluated (see VM-004 row) — activation is not gated on it. CR-114's schema-diff compatibility check also exists but is unwired (no call site), so it gates nothing either.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Superseded versions shall remain available<br> Ref: §6 FR-41.4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/packsDB.ts:287-289</code> <br> per-entity status values include <code>Deprecated</code>/<code>Superseded</code>/<code>Archived</code> (e.g. Template/Profile six-hop lifecycle, <code>Version Feature Plan.md:112</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Rows are never deleted on supersession<br> status transitions to <code>Deprecated</code>/<code>Superseded</code>/<code>Archived</code> while the row persists and remains queryable.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Historical execution shall reference exact versions<br> Ref: §6 FR-41.5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/seusDB.ts:91</code> <br> <code>src/routes/seu/core/commissioning.ts:595-599</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A SEU's <code>active_ebm_id</code> is a foreign-key-style reference to one immutable EBM row, resolved and used directly (e.g. for attention-item linkage) rather than resolved dynamically by code/label.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Version history shall remain permanently traceable<br> Ref: §6 FR-41.6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/packsDB.ts:287-289</code> <br> <code>events</code> table (immutable once published, per Ch.30 §9, read by <code>eventsDB.findByOriginatingObject</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Version-significant events remain in the immutable <code>events</code> table indefinitely (no delete path), and <code>transition_definitions.version_event</code> lets a reader classify which of those recorded events are version-significant for a given entity type. No dedicated "Version Traceability Service" or API exists<br> this is a read pattern over existing tables, confirmed by design (<code>Version Feature Plan.md:48</code>, "a read, not a write path... no new service").</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Platform shall support concurrent versions where compatible<br> Ref: §6 FR-41.7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/packsDB.ts:270-274</code> (comment + query, CR-026 Part 2)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Exactly one <code>Active</code> row is permitted per <code>(code, tenant_id)</code> — activating a new version supersedes the tenant's own prior Active row (enforced behaviourally by the activation flow, confirmed by the function's own comment "two tenants... can each have their own Active row... without superseding each other"). Concurrency exists only *across* tenants/Platform for the same code, not within one tenant for the same code — the spec's "concurrent versions" is not realized within a single scope.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Illustrative versioned artefacts (EBM, Pack, Profile, Template, Ontology, Policy, Authority Rules, Reviews, Quality Gates, Capability Definitions, Runtime APIs)<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>Version Feature Plan.md</code> Implementation status, items 1-8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Versioned (event_type/version_event populated): Objective, Pack, Template, Profile, Service Definition, Policy Definition, Ontology Concept. Explicitly not versioned by owner decision: SEU, EBM. Never addressed in this mechanism: Authority Rules, Reviews, Quality Gates, Capability Definitions, Runtime APIs — no <code>transition_definitions</code> rows of these <code>entity_type</code>s carry <code>version_event</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Version Structure<br> Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">e.g. <code>src/dblayer/packsDB.ts</code> row shape (<code>id</code>, <code>pack_version</code>, <code>code</code>, <code>status</code>, <code>publisher</code>, <code>created_at</code>, metadata blob via <code>packMetadataFromSeed</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">7 of 10 fields exist per entity (Identifier, Version Number, Artefact Identifier via <code>code</code>, Status, Publisher, Creation Timestamp, Metadata). <code>Parent Version</code> and <code>Superseded By</code> have no column on any entity (confirmed absent in every <code>*_schema_recovery.sql</code> checked). <code>Compatibility Declaration</code> exists for Pack (the metadata fields) but, per the FR-41.3/VM-004 findings, is declaration-only, not an evaluated compatibility contract on every versioned artefact.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Generic 7-stage lifecycle (Draft→Validated→Published→Active→Deprecated→Superseded→Archived)<br> each entity may define its own lifecycle<br> Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>Version Feature Plan.md:16-18</code> ("Resolved framing")</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Confirmed design decision, not a gap: the generic chain is explanatory vocabulary only. Each entity's own chapter-defined lifecycle is authoritative (e.g. Objective has no <code>Validated</code> state<br> Service Definition has no <code>Validated</code> state<br> Ontology Concept has no Draft prefix at all). §9's literal chain is not implemented as a literal state machine anywhere, by design.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Compatibility shall be evaluated before activation<br> may consider platform version, Pack versions, Runtime Kernel version, EBM, dependency versions, supported capabilities<br> compatibility rules shall be declarative<br> Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/domain/engine/profileCompositionUnravel.ts:540-553</code> <br> <code>src/routes/seu/core/packs.ts:226-251</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Declarative, evaluated: Pack-dependency compatibility (<code>incompatible</code> type). Declarative, never evaluated: platform-version range fields. Never represented at all: Runtime Kernel version, EBM compatibility, "supported capabilities" as a compatibility axis.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Platform evolution occurs by creating new Versions<br> existing Versions never modified<br> evolution preserves historical traceability<br> Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>copyPackAsNewDraft</code> (<code>src/routes/seu/core/packs.ts:223-224</code> comment) <br> <code>reactivateAsNewVersion</code> (<code>src/routes/seu/core/profiles.ts:900</code>, <code>templates.ts:1084</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evolution paths for Pack/Template/Profile are real functions that create a new draft/row rather than mutating the existing one, each citing "copying is versioning, never a change of ownership." Traceability is via <code>created_at</code>/status ordering, not an explicit lineage field (same gap as VM-005).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Platform shall support reconstruction of any historical engineering state, using historical Versions/Events/EBMs/State Transitions, reproducing engineering behaviour as originally executed<br> Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/versionEventsDB.ts</code> (<code>findByEntity</code>) <br> <code>src/routes/seu/core/versionEvents.ts</code> (<code>getVersionReplay</code>) <br> CR-117</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">CR-117 added a real reconstruction reader: <code>version_events</code> indexes each real published event by its <code>version_event</code> classification, written by <code>eventBus.publish()</code> itself (never a second publish). <code>getVersionReplay(entityType, entityId)</code> walks an entity's own version-classified hops in order, each pointing at the real immutable <code>events</code> row to rehydrate. This is a reader over existing immutable data, not a full environment-replay engine — it reconstructs the entity's own version chain and lets a caller rehydrate each hop's event payload, which is what §12 and VM-003 ask for; it does not spin up a running reconstructed system.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Version preserves parent Version, successor Versions, compatibility history, activation history, associated engineering executions, originating publisher<br> traceability remains immutable<br> Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/packsDB.ts:287-289</code> <br> per-entity <code>publisher</code>/<code>author_id</code> fields <br> <code>src/dblayer/versionEventsDB.ts:findByEntity</code> (CR-117)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Originating publisher and activation history are derivable. CR-117's <code>version_events</code> now gives a real, queryable per-entity version chain ordered by <code>occurred_at</code> (parent/successor by position in that order) — the Version Replay page (<code>/aisworg/seu/version-events</code>) reads it directly, not just creation-time ordering inferred indirectly. Parent Version / successor Version as explicit stored fields (a <code>parent_version</code>/<code>superseded_by</code> column) and compatibility history still do not exist anywhere (same gap as §8, VM-005).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Activation of a new Version may require validation, compatibility evaluation, governance approval, Pack composition, publication<br> governance rules may be contributed through Packs<br> Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/domain/engine/transitionEngine.ts:96-124</code> (badge authority + policy gating before a transition is <code>allowed</code>) <br> <code>src/domain/engine/compositionEngine.ts</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Activation (a governed transition to <code>Active</code>) is gated by authority badge, policy, and (where declared) quality gates — real governance evaluated before the state change is permitted. "Governance rules contributed through Packs" maps to Policy Definitions, which are themselves Pack-composable (Ch.24), satisfying this generically rather than per-artefact.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Version Management subsystem shall publish VersionCreated/Validated/Published/Activated/Deprecated/Superseded/Archived<br> Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/domain/engine/transitionEngine.ts:218-219</code> <br> <code>src/domain/engine/eventBus.ts</code> (<code>publish()</code>'s <code>version_events</code> insert, CR-117) <br> <code>src/dblayer/versionEventsDB.ts</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§15 asks only that these 7 moments be published as real, identifiable events — it says nothing about subscription/reaction (that's Ch.30's own concept, not this chapter's). CR-117 satisfies this as written: <code>version_event</code> is written for real by <code>eventBus.publish()</code> itself, alongside the real event (never discarded, never a second publish), and is queryable per entity (<code>version_events.version_event</code>) via the Version Replay page. The classification is not the literal <code>eventType</code> on the bus, but the chapter's own requirement — that these 7 named moments exist as published, identifiable events — is met.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Concurrent Versions, deterministic behaviour, complete historical reconstruction, technology-independence, long-term archival<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">See FR-41.7, §12, VM-006, FR-41.4 rows</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deterministic behaviour and technology-independence: met (same evidence as VM-006). Concurrent versions: partially met (cross-tenant only). Historical reconstruction: not met. Long-term archival: met (rows are retained indefinitely, <code>Archived</code> status, no delete path found).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance Criteria (6 checkmarked items)<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Aggregate of rows above</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">"Every significant artefact is versioned": partially (7 of ~11 named artefact types). "Versions are immutable": met. "Historical execution is reproducible": partially (data retained, no reconstruction mechanism). "Compatibility is validated": partially (dependency-level yes, platform-version-range no). "Version history remains permanently available": met. "Multiple compatible Versions may coexist": partially (cross-tenant only).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables — Version Registry, Version lifecycle service, Compatibility evaluation service, Version traceability service, Historical reconstruction service, Version APIs, Version events<br> Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/transitionDefinitionsDB.ts</code> <br> <code>src/domain/engine/transitionEngine.ts</code> <br> <code>src/dblayer/versionEventsDB.ts</code>, <code>src/routes/seu/core/versionEvents.ts</code>, <code>src/routes/seu/web/versionEvents.ts</code> (CR-117)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Intent-level check, not a name match: none of the 7 exists as a standalone module, but 6 of 7 intents are now satisfied in substitute form — <strong>Version Registry</strong> (each entity's own versioned rows), <strong>Version lifecycle service</strong> (<code>transitionEngine.evaluate</code> enforces the state graph generically), <strong>Version traceability service</strong> (author_id/badge + event history per transition, now backed by a real queryable <code>version_events</code> chain, CR-117), <strong>Version events</strong> (named <code>VersionCreated</code>/<code>VersionPublished</code>/etc. literally present as <code>version_event</code> values, now actually written and indexed by <code>eventBus.publish()</code>, not discarded — see §15 row for why this is still not a literal second publish), <strong>Historical reconstruction service</strong> (CR-117's <code>getVersionReplay</code> reader, see §12 row), and <strong>Version APIs</strong> (CR-117's <code>GET /aisworg/seu/version-events</code> — filterable, paginated, scoped by entity/tenant) are deliberate, working equivalents, confirmed per <code>Version Feature Plan.md</code>/CR-117 — not a gap. The one remaining genuine intent gap is <strong>Compatibility evaluation service</strong> (#5 below — no platform/runtime-kernel version compatibility is ever evaluated, only Pack-to-Pack <code>incompatible</code> dependency type).</td>
    </tr>
  </tbody>
</table>

---

## Summary

- Total intents analysed: 27
- Fully met: 13
- Partially met: 14
- Not met: 0
- Not verifiable: 0

---

**Major implementation gaps**

1. **§18 — 6 of 7 named deliverables are satisfied in substitute form** (Version Registry, lifecycle service, traceability service, Version events, Historical reconstruction service, Version APIs — the last two added by CR-117), via `transition_definitions`/`transitionEngine`/`version_events` plus each entity's own DB layer. The one remaining real intent gap is Compatibility evaluation service (#4 below).
2. **§12 — a reconstruction reader now exists (CR-117), not a full replay engine.** `version_events` + `getVersionReplay` give an ordered, per-entity version chain pointing at each real immutable event to rehydrate. This satisfies §12's "reconstruction... using historical Versions/Events" as a read path; it does not spin up a running reconstructed system reproducing engineering behaviour live.
3. **§8/§13/VM-005 — no Parent Version / Superseded By / compatibility-history fields exist on any entity.** Explicitly deferred in `Version Feature Plan.md`, not yet designed. CR-117 narrows this: a real, queryable version chain exists via `version_events` ordering, but not as an explicit stored `parent_version`/`superseded_by` column.
4. **VM-004/FR-41.3/§10 — platform-version compatibility fields (`minSupportedPlatformVersion` etc.) are declaration-only**, never read or validated anywhere in `src`. Only Pack-to-Pack `incompatible` dependency type is actually enforced. CR-114's `instancesCompatible` schema-diff check is built but has no call site, so it enforces nothing either. Untouched by CR-117 — still the one open §18 deliverable gap (Compatibility evaluation service).
5. **FR-41.7/§16 — "concurrent compatible versions" holds only across tenants**, not within one tenant for the same artefact code (CR-026 Part 2 enforces exactly one Active row per code per tenant).
