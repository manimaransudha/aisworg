# Chapter 11 – Service: Implementation Traceability


**Date of report: 4-10-2026**

This supersedes the chapter's own embedded §18 audit (dated 2026-08-24, pre/at CR-064), which predates a materially significant later build: a governed **Service Definition** entity (`service_definitions` table, `serviceDefinitionsDB.ts`, `src/routes/seu/core/serviceDefinitions.ts`, CR-086 follow-on, migrations 152-188) now exists alongside the Pack-contributed `services` table (`servicesDB.ts`) that §18 described. Service Definition carries the chapter's own 6-state lifecycle verbatim, real Version Feature Plan event_type/version_event wiring, and a richer `ServiceLevelExpectation` shape — closing several gaps §18 reported as unbuilt. Both mechanisms coexist; this report evaluates both against each chapter intent.

Core files: `src/dblayer/servicesDB.ts`, `src/dblayer/serviceDefinitionsDB.ts`, `src/dblayer/seuTypes.ts` (`ServiceRow`, `ServiceDefinitionRow`, `ServiceLevelExpectation`), `src/routes/seu/core/serviceDefinitions.ts`, `src/domain/engine/dependencyDefinitionEngine.ts`, `src/domain/engine/materialiseDependencyGraph.ts`, `src/domain/engine/dispatchEngine.ts`, `src/routes/seu/core/packs.ts`, `src/dblayer/seed/data/transitionDefinitions.json`.

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">Service is the declared, contracted output a Capability exposes, without exposing how<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/seuTypes.ts:101-110</code> (<code>ServiceRow.contract_description</code>)<br><code>src/dblayer/seuTypes.ts:527-549</code> (<code>ServiceDefinitionRow</code>: <code>purpose</code>, <code>inputs</code>, <code>outputs</code>, <code>success</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Both <code>services</code> and <code>service_definitions</code> store only free-text/descriptive fields (description/purpose/inputs/outputs); no implementation/interface column exists on either.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Services declared by Capability Packs, not Participants, and do not select who fulfils them<br> Ref: §1 Purpose, SVC-001</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/routes/seu/core/packs.ts:587-597</code> (Pack-contributed <code>services</code> write path)<br><code>src/routes/seu/core/serviceDefinitions.ts</code> (catalog authoring path, actor-driven, no Participant coupling)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Only write paths are Pack publish (<code>servicesDB.upsertFromPack</code>) and the Service Definition authoring/transition flow; neither is reachable from a Participant action or Participant selection logic.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Architectural position: Pack → Capability+Service → Dependency Engine → Fulfilment/Dispatch → Telemetry<br> Ref: §3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/domain/engine/dependencyDefinitionEngine.ts:73-83</code><br><code>src/domain/engine/materialiseDependencyGraph.ts:70-123</code><br><code>src/domain/engine/dispatchEngine.ts:12-38</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Service remains stable through Fulfilment/Dispatch (§10, below). The Dependency Engine step of this chain is **retired for Capability-type edges** (owner, 2026-09-04, <code>materialiseDependencyGraph.ts:40-49</code>): "there is no Capability-type edge... deliverable dependency is what is real." Telemetry step (§11) is entirely unbuilt (see below).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Service declares a Service Level: target turnaround/quality bar/other measurable expectation<br> Ref: §4, SVC-004, FR-11.3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/seuTypes.ts:513-519</code> (<code>ServiceLevelExpectation</code>: <code>code,label,target_level,target,units</code>)<br><code>src/dblayer/servicesDB.ts:17-77</code> (<code>service_level</code> column, real upsert)<br><code>src/routes/seu/core/serviceDefinitions.ts</code> (<code>service_level</code> on <code>ServiceDefinitionRow</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Both mechanisms carry a real, structured Service Level. <code>ServiceDefinitionRow</code>'s shape (<code>target_level: minimum/maximum/exact</code>, numeric <code>target</code>, <code>units</code>) is strictly richer than <code>ServiceRow</code>'s own <code>{label,target}</code> pairs and matches §8's "measurable expectation" more precisely.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Service does not select/assign/evaluate Participants (remains Fulfilment/Dispatch's job)<br> Ref: §4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/seuTypes.ts:101-110</code>, <code>527-549</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No Participant FK or selection logic on either <code>services</code> or <code>service_definitions</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Service does not compute/store its own observed performance (remains Telemetry's job)<br> Ref: §4, SVC-006</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/routes/seu/core/telemetry.ts</code> (no match for "Service")</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Vacuously true: nothing writes performance back, but only because Telemetry has zero Service integration at all (see §11 finding below), not because a real boundary is enforced against an existing measurement path.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SVC-002: exposes what, never how<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/seuTypes.ts:101-110</code>, <code>527-549</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>contract_description</code>/<code>purpose</code> are free text; no interface/implementation columns exist to leak.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SVC-003: Service is coequal with Evidence/Knowledge/Decision, does not subsume them<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/domain/engine/compositionEngine.ts</code> (no Evidence/Knowledge/Decision table access from Service code)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No Service code path touches Evidence/Knowledge/Decision tables.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SVC-005: Service definitions versioned and immutable once published<br> Ref: §5, FR-11.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/servicesDB.ts:5-13,34-50</code> (<code>bumpVersion</code>, deactivate-old-insert-new)<br><code>src/routes/seu/core/serviceDefinitions.ts</code> + <code>assertServiceDefinitionCodeVersionFree</code> (semver, <code>(code,version)</code> uniqueness)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>services</code>: content-diffed minor-version bump on real change, prior row deactivated (not overwritten). <code>service_definitions</code>: author-declared semver, collision-checked per <code>(code,version,tenant)</code>, status-gated (no edit once past <code>Defined</code>/<code>Draft</code>-equivalent stage via <code>updateDraftContent</code> validators). Both are real, immutable-once-published mechanisms.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-11.1: globally unique identifier and version<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/servicesDB.ts</code> (<code>code</code> unique per <code>(originating_pack_id, code)</code>)<br><code>src/dblayer/serviceDefinitionsDB.ts:171-181</code> (<code>(code, version[, tenant])</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>id</code> is a real UUID PK on both tables; version is real and live on both (above).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-11.2: every Service declared by exactly one Capability, through exactly one Pack<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/routes/seu/core/packs.ts:587-597</code><br><code>src/dblayer/serviceDefinitionsDB.ts</code> (<code>capability_code</code> NOT NULL)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>providing_capability_id</code> is <code>NOT NULL</code> on <code>services</code>; Pack publish resolves <code>capabilityCode</code> only against that same Pack's own declared Capabilities (cross-Pack references rejected). <code>service_definitions.capability_code</code> is similarly required, validated against the <code>capability-name</code> Ontology concept.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-11.3: every Service declares a Service Level<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(same as SVC-004 above)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-11.4: Dependency Engine references specific Services, not Capabilities in the abstract<br> Ref: §6, §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/domain/engine/dependencyDefinitionEngine.ts:73-83</code> (<code>resolveNamedNode</code>, <code>Capability</code> branch, still Service-code-keyed for resolving *existing* rows)<br><code>src/domain/engine/materialiseDependencyGraph.ts:40-49,70-123</code> (authoring of new Capability-type rows commented out/retired)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§9's own worked example ("depends on the Approved Solution Architecture Service, not the Architecture Capability") has no live authoring path at all: Capability-type dependency materialisation was retired 2026-09-04 ("there is no Capability-type edge... deliverable dependency is what is real. Service describes the what/quality of it"). Only <code>Deliverable</code>-to-<code>Deliverable</code> dependency edges can be authored today. The old Service-keyed resolution code in <code>resolveNamedNode</code> is now dead for authoring purposes — it can only ever match rows nothing creates anymore.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-11.5: every Service publishes lifecycle and delivery events consumable by Engineering Telemetry<br> Ref: §6, §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/seed/data/transitionDefinitions.json</code> (<code>entityType:"Service"</code> rows, <code>eventType: ServiceDefinitionPublished/Activated/Deprecated/Retired/Archived</code>)<br><code>src/routes/seu/core/serviceDefinitions.ts:187-200</code> (<code>eventBus.publish</code>)<br><code>src/routes/seu/core/telemetry.ts</code> (no Service references)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>service_definitions</code> now genuinely publishes 5 real lifecycle events on each governed transition (not the chapter's exact 9 names — see §14 finding) with a real <code>actorId</code>/<code>authorityBadge</code> on every publish. Pack-contributed <code>services</code> publishes none. Neither delivery events (<code>ServiceRequested</code>/<code>ServiceDelivered</code>/<code>ServiceLevelMet</code>/<code>ServiceLevelBreached</code>) nor any Telemetry consumption of the lifecycle events exist.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-11.6: Service supports consumption by multiple Capabilities/external interactions concurrently<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/seuTypes.ts:527-549</code> (<code>consumers: string[]</code>, referential multi-select)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>service_definitions.consumers</code> is a real, unconstrained multi-value field (no cardinality limit); <code>services</code> has no consumer tracking at all (deliberately dropped, owner: derivable by querying <code>dependency_definitions</code>). Structurally unconstrained either way, matching "support... concurrently."</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-11.7: Service contracts remain independent of Participant implementation<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/seuTypes.ts:101-110</code>, <code>527-549</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No Participant coupling on either table.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Service Structure: Identifier, Name, Providing Capability, Contract Description, Service Level, Consuming Capabilities, Version, Originating Pack<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/servicesDB.ts:56-69</code><br><code>src/dblayer/seuTypes.ts:527-549</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All fields real on <code>services</code> except "Consuming Capabilities" (deliberately dropped — owner: derivable via <code>dependency_definitions</code> query). <code>service_definitions</code> instead carries <code>consumers</code> directly (richer than the chapter asks), plus <code>capability_code</code>/<code>version</code>/<code>service_level</code>, but has no <code>originating_pack_id</code> equivalent — it is tenant-scoped platform-catalog authored, not Pack-contributed, a structurally different originating concept than §7 assumes.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Service Level: target turnaround, quality bar, availability, exceptions/waivers; part of the Service's versioned definition<br> Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/seuTypes.ts:513-519</code><br><code>src/domain/engine/dispatchEngine.ts:12-30</code> (<code>resolveTurnaroundSeconds</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real structured field on both mechanisms (above). <code>dispatchEngine.ts</code>'s <code>resolveTurnaroundSeconds</code> is a real, working consumer that sets a Work Item's default deadline from a <code>services.service_level</code> item whose <code>label</code> matches <code>/turnaround/i</code> — but it only recognises a bare number of seconds in <code>target</code>, not a human duration string ("3 days"), so it returns <code>null</code> for content shaped like the owner's own worked example until a duration parser is added. No equivalent consumer reads <code>service_definitions.service_level</code> yet.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Dependency Engine: Capability Dependency shall reference the specific Service a Capability exposes, not the Capability in the abstract<br> Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/domain/engine/materialiseDependencyGraph.ts:40-123</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Retired, as in FR-11.4 above — this section's entire mechanism has no live authoring path today; only Deliverable-to-Deliverable edges exist.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Service does not determine who fulfils it; Fulfilment/Dispatch select the Participant; Service stays the stable reference<br> Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/domain/engine/dispatchEngine.ts:12-38</code> (reads <code>servicesDB.findByCapabilityId</code>, read-only)<br><code>src/dblayer/servicesDB.ts:80-85</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Dispatch reads Service data (for Service Level) but never writes to it and never performs Participant selection through Service; selection logic lives entirely in <code>dispatchStrategies.ts</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Service publishes delivery events Telemetry derives metrics from; Telemetry compares observed delivery against declared Service Level<br> Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/routes/seu/core/telemetry.ts</code> (no Service references anywhere)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No delivery events (<code>ServiceRequested</code>/<code>ServiceDelivered</code>) exist on either mechanism, and Telemetry has zero code path touching Service, <code>services</code>, or <code>service_definitions</code>. The lifecycle events now published by <code>service_definitions</code> (FR-11.5) are not delivery events and are not consumed by Telemetry either.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Service Composition: multiple Packs may contribute Services for the same Capability; composition shall be deterministic, resolved through the Composition Engine's existing rules<br> Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/domain/engine/compositionEngine.ts</code> (no Service references)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No composition-time handling of any kind for either mechanism. <code>services</code> uses a silent <code>(originating_pack_id, code)</code>-scoped upsert (no cross-Pack conflict detection, no Override-style warning the way Policy/Quality Gate get); <code>service_definitions</code> enforces <code>(code, version, tenant)</code> uniqueness at write time but performs no deterministic-resolution logic when two Packs/authors declare conflicting content under the same code.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Service Lifecycle: Defined → Published → Active → Deprecated → Retired → Archived; deprecation identifies a replacement; historical versions remain available<br> Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/seuTypes.ts:507</code> (<code>ServiceDefinitionStatus</code>)<br><code>src/dblayer/seed/data/transitionDefinitions.json</code> (<code>entityType:"Service"</code> rows)<br><code>src/routes/seu/core/serviceDefinitions.ts:159-200</code> (<code>transitionServiceDefinition</code>, <code>AUTHORING_NEXT_STATE</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>service_definitions</code> now implements this exact 6-state chain as a real, governed <code>transition_definitions</code>-backed state machine (CR-086 follow-on) — strictly linear, no reactivation, matching the chapter's own diagram verbatim. Historical versions remain queryable (<code>findByCodeAndVersion</code>). Deprecation does not structurally require naming a replacement Service — no "replacement" field exists on <code>ServiceDefinitionRow</code>, so that specific clause is unenforced. The Pack-contributed <code>services</code> table still has only an untransitioned <code>status</code> column (<code>CHECK</code> constraint, no <code>transition_definitions</code> rows, every live row sits at <code>Active</code>) — this half of the mechanism remains exactly as the chapter's own §18 audit found it.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Events: ServiceDefined, ServicePublished, ServiceActivated, ServiceRequested, ServiceDelivered, ServiceLevelMet, ServiceLevelBreached, ServiceDeprecated, ServiceRetired<br> Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/seed/data/transitionDefinitions.json</code><br><code>src/routes/seu/core/serviceDefinitions.ts:187-200</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">5 of 9 named events now have a real (if differently-named) counterpart from <code>service_definitions</code>' governed lifecycle: <code>ServiceDefinitionPublished</code>, <code>ServiceDefinitionActivated</code>, <code>ServiceDefinitionDeprecated</code>, <code>ServiceDefinitionRetired</code> (plus an un-named-in-spec <code>ServiceDefinitionArchived</code>). No event fires on reaching <code>Defined</code> (it is the creation state, not a transition target) — <code>ServiceDefined</code> has no equivalent. <code>ServiceRequested</code>, <code>ServiceDelivered</code>, <code>ServiceLevelMet</code>, <code>ServiceLevelBreached</code> (the delivery/telemetry-facing events) remain entirely unbuilt on both mechanisms.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: support composition from multiple Packs<br> Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/domain/engine/compositionEngine.ts</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same as §12 — no composition-time handling.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Fully met (for `services`)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: preserve complete traceability from Service to providing Capability and originating Pack<br> Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/routes/seu/core/traceability.ts:169-171</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>providing_capability_id</code>/<code>originating_pack_id</code> are real FKs on <code>services</code>, resolved and displayed by <code>traceability.ts</code>. <code>service_definitions.capability_code</code> gives the Capability link but has no Pack-origin concept to trace (platform-catalog authored, not Pack-contributed).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: support deterministic resolution of conflicting declarations<br> Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/domain/engine/compositionEngine.ts</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same as §12.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: remain independent of Participant implementations<br> Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/seuTypes.ts:101-110</code>, <code>527-549</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No Participant coupling on either mechanism.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: publish events sufficient for Telemetry without duplicate instrumentation<br> Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/routes/seu/core/telemetry.ts</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Zero Telemetry consumption of any Service event, real or otherwise (§11, §14).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: every Service declared by exactly one Capability through a Pack<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(FR-11.2 citations)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: every Service declares a Service Level<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(SVC-004 citations)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Capability Dependency evaluation references specific Services, not Capabilities in the abstract<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(FR-11.4/§9 citations)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capability-type dependency authoring is retired entirely, a stronger negative than §18's own earlier "real internally, not author-facing" finding.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Service definitions remain independent of Participant implementation<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(FR-11.7 citations)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: observed Service performance derived by Telemetry, never stored on Service definition<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/routes/seu/core/telemetry.ts</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Vacuously true (§4/§11 finding).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: multiple Packs can contribute Services for the same Capability deterministically<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/domain/engine/compositionEngine.ts</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Not built (§12).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Service domain model<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/seuTypes.ts:101-110,507-549</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>ServiceRow</code> and <code>ServiceDefinitionRow</code> both real.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Service registry<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/servicesDB.ts</code>, <code>src/dblayer/serviceDefinitionsDB.ts</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Both exist; <code>servicesDB</code> is minimal (by-capability/by-id/all only), <code>serviceDefinitionsDB</code> adds code+version, active-by-code, visible-to-tenant, platform-owned lookups.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Fully met (via `service_definitions`)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Service contract validation service<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/routes/seu/core/serviceDefinitionWriteValidator.ts</code><br><code>src/routes/seu/core/packs.ts</code> (capabilityCode resolution only)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>service_definitions</code> has a real structural write validator (<code>validateServiceDefinitionWriteAgainstSchema</code>). <code>services</code>' Pack-publish path still only resolves the providing Capability, no structural validation beyond that.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Service Level declaration framework<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(SVC-004 citations)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Service composition service<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/domain/engine/compositionEngine.ts</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Not built (§12).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Service APIs<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/routes/seu/web/serviceDefinitionRegistry.ts</code>, <code>src/routes/seu/web/sdkAuthoring.ts</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>service_definitions</code> has a real authoring/registry web surface including lifecycle transitions. No dedicated <code>src/routes/seu/api/*</code> JSON API for either mechanism was found (registry route is server-rendered web, not API).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Service events<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(§14 citations)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">5 lifecycle events real on <code>service_definitions</code>; delivery/telemetry events absent on both.</td>
    </tr>
  </tbody>
</table>
## Summary

- Total intents analysed: 32
- Fully met: 17
- Partially met: 9
- Not met: 6
- Not Verifiable: 0

## Major Implementation Gaps

1. **Dependency Engine / §9's central claim is now a clean "Not met," stronger than the chapter's own embedded §18 audit found.** Capability-type dependency materialisation was retired outright (owner, 2026-09-04: "there is no Capability-type edge... deliverable dependency is what is real"). Only Deliverable-to-Deliverable edges can be authored today; §9's worked example (depend on "the Approved Solution Architecture Service," not "the Architecture Capability") has no live path at all, not even the under-the-hood Service-keyed resolution the embedded audit credited it with (that resolution code is now dead — nothing creates rows for it to match).
2. **Engineering Telemetry integration (§11) and delivery events (`ServiceRequested`/`ServiceDelivered`/`ServiceLevelMet`/`ServiceLevelBreached`, §14) remain entirely unbuilt** on both the Pack-contributed and catalog mechanisms.
3. **Service Composition (§12) has no implementation on either mechanism** — no deterministic conflict resolution, no Composition Engine involvement at all.
4. **A second, more mature mechanism now exists that the chapter's own embedded §18 audit (dated 2026-08-24) does not reflect**: `service_definitions` (CR-086 follow-on) implements the chapter's exact 6-state governed lifecycle with real event_type/version_event wiring, closing the lifecycle/versioning/event gaps the embedded audit reported as open — but only for this separately-authored catalog entity, not for the Pack-contributed `services` table the rest of the chapter (§7, §9, §10) assumes is the Service a Capability Dependency or Dispatch interacts with. The two mechanisms are not reconciled: `services.code` is Ontology-validated against the same `service-name` concept `service_definitions.code` publishes into, but no FK or lookup ties a Pack-contributed `services` row to a specific `service_definitions` catalog row/version.
5. **Deprecation does not require naming a replacement Service** (§13's "shall identify a replacement Service where one exists") — no such field exists on either row type.
