# Traceability Analysis: Chapter 41 – Version Management Architecture

**Date of report: 4-10-2026**

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Platform shall support reconstruction of any historical engineering state, using historical Versions/Events/EBMs/State Transitions, reproducing engineering behaviour as originally executed<br> Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">— (no citation found)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No reconstruction/replay function exists anywhere in <code>src</code> (grep for <code>reconstruct</code>/<code>replay</code> across the codebase finds only unrelated form-field-reconstruction helpers in <code>profiles.ts</code>/<code>templates.ts</code>/<code>seus.ts</code>, none touching engineering-state reconstruction). The data this would need (immutable EBM snapshots, immutable events, frozen versions) is retained, but no service reassembles or replays it into a reconstructed historical state.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Version preserves parent Version, successor Versions, compatibility history, activation history, associated engineering executions, originating publisher<br> traceability remains immutable<br> Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/packsDB.ts:287-289</code> <br> per-entity <code>publisher</code>/<code>author_id</code> fields</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Originating publisher and (via <code>findVersionsByCode</code>-style queries plus <code>events</code>) associated engineering executions and activation history are derivable. Parent Version / successor Versions / compatibility history are not stored as explicit fields anywhere (same gap as §8, VM-005) — only derivable indirectly via creation-time ordering, which is not the same as a preserved relationship.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Activation of a new Version may require validation, compatibility evaluation, governance approval, Pack composition, publication<br> governance rules may be contributed through Packs<br> Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/domain/engine/transitionEngine.ts:96-124</code> (badge authority + policy gating before a transition is <code>allowed</code>) <br> <code>src/domain/engine/compositionEngine.ts</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Activation (a governed transition to <code>Active</code>) is gated by authority badge, policy, and (where declared) quality gates — real governance evaluated before the state change is permitted. "Governance rules contributed through Packs" maps to Policy Definitions, which are themselves Pack-composable (Ch.24), satisfying this generically rather than per-artefact.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Version Management subsystem shall publish VersionCreated/Validated/Published/Activated/Deprecated/Superseded/Archived<br> Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/domain/engine/transitionEngine.ts:218-219</code> <br> <code>src/routes/seu/core/objectives.ts:1106</code>, <code>packs.ts:1188</code>, <code>templates.ts:979</code>, <code>profiles.ts:753</code>, <code>policyDefinitions.ts:357</code> (all publish <code>gate.eventType</code>, never <code>gate.versionEvent</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A full-codebase search confirms these 7 literal event names are never passed as <code>eventType</code> to <code>eventBus.publish</code> anywhere. <code>version_event</code> is stored as a classification label on the <code>transition_definitions</code> row and is read back later to classify which already-published domain events (e.g. <code>ObjectiveActivated</code>, <code>PackPublished</code>) are version-significant — the chapter's own named events are never themselves emitted on the bus. This is a confirmed, deliberate design deviation (<code>Version Feature Plan.md:48</code>), not an oversight, but it means §15's literal requirement — a subsystem publishing these 7 event types — is not met as written.</td>
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
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/transitionDefinitionsDB.ts</code> <br> <code>src/domain/engine/transitionEngine.ts</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Intent-level check, not a name match: none of the 7 exists as a standalone module, but 4 of 7 intents are satisfied by the <code>transition_definitions</code>/<code>transitionEngine</code> substitute plus each entity's own DB layer — <strong>Version Registry</strong> (each entity's own versioned rows), <strong>Version lifecycle service</strong> (<code>transitionEngine.evaluate</code> enforces the state graph generically), <strong>Version traceability service</strong> (author_id/badge + event history per transition), and <strong>Version events</strong> (named <code>VersionCreated</code>/<code>VersionPublished</code>/etc. literally present as <code>version_event</code> values, though see Major Gap #1 on how they're emitted) are deliberate, working equivalents, confirmed per <code>Version Feature Plan.md</code> — not a gap. The remaining 3 are genuine intent gaps, already itemized below: <strong>Compatibility evaluation service</strong> (#5 — no platform/runtime-kernel version compatibility is ever evaluated, only Pack-to-Pack <code>incompatible</code> dependency type), <strong>Historical reconstruction service</strong> (#3 — no replay mechanism), and <strong>Version APIs</strong> (no queryable cross-entity version/lineage endpoint exists; each entity's own CRUD routes are not a substitute for this). This row does not re-count those three as a separate finding.</td>
    </tr>
  </tbody>
</table>

---

## Summary

- Total intents analysed: 24
- Fully met: 10
- Partially met: 11
- Not met: 3
- Not verifiable: 0

**Major implementation gaps**

1. **§15 — the chapter's own named Version events are never published.** `version_event` is a classification label on `transition_definitions`, read back to tag existing domain events after the fact<br> no `VersionCreated`/`VersionPublished`/etc. event type is ever passed to `eventBus.publish`.
2. **§18 — Version Registry, lifecycle service, traceability service, and Version events are satisfied in substitute form**, via `transition_definitions`/`transitionEngine` plus each entity's own DB layer (confirmed, deliberate, `Version Feature Plan.md`) — intent met, not a gap. Of the 7 named deliverables, only Compatibility evaluation service (#5 below), Historical reconstruction service (#3 below), and a queryable cross-entity **Version API** (no endpoint exists; per-entity CRUD routes do not provide lineage/version lookup) are real intent gaps.
3. **§12 — no historical reconstruction/replay mechanism exists.** The raw data (immutable EBM snapshots, immutable events) is retained, but nothing reassembles it into a reconstructed historical engineering state.
4. **§8/§13/VM-005 — no Parent Version / Superseded By / compatibility-history fields exist on any entity.** Explicitly deferred in `Version Feature Plan.md`, not yet designed.
5. **VM-004/FR-41.3/§10 — platform-version compatibility fields (`minSupportedPlatformVersion` etc.) are declaration-only**, never read or validated anywhere in `src`. Only Pack-to-Pack `incompatible` dependency type is actually enforced. CR-114's `instancesCompatible` schema-diff check is built but has no call site, so it enforces nothing either.
6. **FR-41.7/§16 — "concurrent compatible versions" holds only across tenants**, not within one tenant for the same artefact code (CR-026 Part 2 enforces exactly one Active row per code per tenant).
