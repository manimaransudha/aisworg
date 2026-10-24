# Implementation Traceability: Chapter 2 – Capability Model

**Date of report: 23-10-2026**

Specification: src/docs/SEU Studio Specifications/01_Engineering Definition/02_Capability.md

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Capability Catalogue is maintained.<br>Ref: §6 FR-2.1, §16, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/capabilityDefinitionsDB.ts:8-195<br>src/dblayer/capabilitiesDB.ts:5-71<br>src/routes/seu/core/capabilityDefinitions.ts:137-145</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Two catalogues exist. capability_definitions holds authored, versioned Capability Definitions with a lifecycle. capabilities holds the Pack-materialised Capabilities that SEUs consume. Both are listable. Note: the two are not linked by a foreign key; they join by code only.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Deliverable requires one or more Capabilities.<br>Ref: §6 FR-2.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/deliverablesDB.ts:19<br>src/dblayer/recovery/deliverables_schema_recovery.sql:12<br>src/domain/engine/capabilityOnReady.ts:32</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: a Deliverable carries producing_capability_id and the Ready handler requests fulfilment of it.<br>Gap: the column is a single nullable reference. One Capability per Deliverable is supported and a Deliverable with none is accepted.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Capability has a globally unique identifier.<br>Ref: §6 FR-2.3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/capability_definitions_schema_recovery.sql (id UUID, UNIQUE code,version,tenant_id)<br>src/dblayer/recovery/capabilities_schema_recovery.sql (id UUID, UNIQUE originating_pack_id,code)<br>src/dblayer/recovery/capability_definitions_schema_recovery.sql:4,28<br>src/dblayer/recovery/capabilities_schema_recovery.sql:17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: every row has a UUID primary key.<br>Gap: the business code is unique only per tenant and version (definitions) or per originating Pack (capabilities), not globally.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capabilities support versioning.<br>Ref: §6 FR-2.4, §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/capabilityDefinitionsDB.ts:46-65<br>src/routes/seu/core/capabilityDefinitions.ts:93-130<br>src/dblayer/seed/data/transitionDefinitions.json:1529-1596</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: Capability Definitions carry a semver version, a copy-as-new-draft path and version events wired on the Capability transitions.<br>Gap: the capabilities table takes the Pack version, not the Definition version, and nothing records which Definition version a Pack-contributed Capability came from.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capabilities are independently extensible.<br>Ref: §6 FR-2.5, §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilityDefinitions.ts:63-91<br>src/routes/seu/core/sdkAuthoring.ts:964-990</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Definition is authored as data through the governed SDK path, may inherit from an Active parent and needs no kernel change.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capabilities support fulfilment by multiple Participant types.<br>Ref: §6 FR-2.6, §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/capability_fulfilments_schema_recovery.sql<br>src/routes/seu/core/capabilities.ts:57-97, 149</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Fulfilment records the Participant type as the strategy (AI, Human, External, Composite for several). Fulfilment goes through participants_master with type, not through the Capability.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capability fulfilment is traceable.<br>Ref: §6 FR-2.7, §15, §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/capabilityFulfilmentsDB.ts:6-25, 82-93<br>src/routes/seu/core/capabilities.ts:99-183</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each fulfilment row records the SEU Capability, Participant, strategy, author, badge, established_at and revoked_at. CapabilityRequested, CapabilityFulfilled and CapabilityUnavailable carry correlation and causation ids.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capabilities hold no runtime state.<br>Ref: §5 CM-005</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/seu_capabilities_schema_recovery.sql<br>src/dblayer/seuCapabilitiesDB.ts:11-29</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Fulfilled/Unfulfilled status lives on seu_capabilities, a per-SEU row. The capabilities and capability_definitions rows carry no execution state.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capabilities stay independent of Participants and of engineering behaviour.<br>Ref: §4, §5 CM-001, CM-002, CM-006, §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/capabilitiesDB.ts:5-30<br>src/routes/seu/core/capabilities.ts:33-38</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No Participant or behaviour field exists on a Capability. Eligibility is resolved at fulfilment time from participants_master and Policies.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Multiple Participants can fulfil the same Capability.<br>Ref: §5 CM-003, §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:129-153<br>src/dblayer/capabilityFulfilmentsDB.ts:40-51</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A request without a named pick fulfils with the whole eligible pool, creating one fulfilment per Participant with strategy Composite.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">One Participant can fulfil multiple Capabilities.<br>Ref: §5 CM-004, §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/capability_fulfilments_schema_recovery.sql<br>src/routes/seu/core/capabilities.ts:57-82<br>src/dblayer/recovery/capability_fulfilments_schema_recovery.sql:3-10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A fulfilment links one Participant to one SEU Capability. The schema has no uniqueness on participant, and the eligibility check works per Capability.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Capability defines Identifier, Name, Description, Category, Inputs, Outputs, Required Knowledge, Expected Deliverables, Success Criteria and Supported Participant Types.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/schemaDefinitions.json (Capability grammar)<br>src/dblayer/recovery/capability_definitions_schema_recovery.sql</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: code, default label, description, category and roles with worktypes are authored and validated against the grammar.<br>Gap: no fields exist for Inputs, Outputs, Required Knowledge, Expected Deliverables, Success Criteria or Supported Participant Types. Roles and worktypes are the closest match to fulfilment matching only. The Pack-materialised capabilities row holds only code, name, description and version.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Categories are drawn from a governed vocabulary and Packs can add Capabilities.<br>Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/schemaDefinitions.json (category:capability referential source)<br>src/routes/seu/core/packs.ts:200-205, 498-512</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Category is an Ontology-backed referential field. A Pack contribution of a capability-name concept is validated and materialised into capabilities.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">New Capabilities can be introduced through Packs.<br>Ref: §7, §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:499-512, 498-512</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">materializeContributions upserts each contributed Capability keyed on (Pack, code). No Runtime Kernel change is needed.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capabilities may depend on, specialise, compose or extend other Capabilities.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/capabilityDefinitionsDB.ts:21<br>src/routes/seu/core/capabilityDefinitions.ts:63-91</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: specialisation or extension through parent_capability_definition_id, limited to an Active, tenant-visible parent.<br>Gap: no depends-on or composes relationship exists between Capabilities. Pack-contributed Capabilities have no relationship fields.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capability relationships create no circular dependencies.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilityDefinitions.ts:63-73</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The parent check verifies existence, Active state and visibility only. No cycle detection exists for the parent chain, and a copied draft keeps the source parent. A new draft can only point to an already Active parent, which limits but does not forbid a cycle.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Fulfilment assigns Participants to provide a required Capability.<br>Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:99-183<br>src/routes/seu/web/seus.ts:208</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">requestCapabilityFulfilment publishes CapabilityRequested and the handler creates the Participants and fulfilments, marks the SEU Capability Fulfilled and publishes CapabilityFulfilled.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Fulfilment strategies evolve without changing the Capability Model.<br>Ref: §10, §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:33-38, 149<br>src/domain/engine/dispatchStrategies.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Strategy is a value on the fulfilment row and eligibility is Policy driven. A Capability row is untouched by a change of strategy.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Concurrent fulfilment is supported.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/capabilityOnReady.ts:32-48<br>src/routes/seu/core/capabilities.ts:149-153</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Several Capabilities of one SEU are requested together, and several Participants fulfil one Capability. An in-flight request is skipped to avoid a duplicate.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capabilities are discoverable by identifier, category, engineering objective, Deliverable, Pack contribution and supported Participant type.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/capabilitiesDB.ts:32-60<br>src/dblayer/capabilityDefinitionsDB.ts:133-156<br>src/routes/seu/core/objectives.ts (suggestCapabilityCodes)<br>src/routes/seu/api/objectives.ts<br>src/dblayer/capabilitiesDB.ts:52-58<br>src/routes/seu/core/objectives.ts:556</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: lookup by id, code, originating Pack, and a Capability suggestion for an Objective. The Definitions list view supports search and sort.<br>Gap: no discovery by category, by Deliverable, or by supported Participant type, and no dedicated discovery service or Capability API.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">When a Deliverable becomes Ready the platform identifies the required Capabilities, requests fulfilment, assigns Participants and authorises execution.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/capabilityOnReady.ts:14-49<br>src/domain/engine/capabilityRequested.ts<br>src/domain/engine/eventHandlerRegistry.ts:26<br>src/domain/engine/deliverableKickoff.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: DeliverableReady and SEUCommissioned trigger identification of the producing Capability, a CapabilityRequested event, Participant assignment from the eligible pool and a downstream kickoff that issues the producing Command.<br>Gap: the step to determine fulfilment requirements is not a separate step; the Capability is requested with no requirement object. Authorisation of execution is performed by the later dispatch, not at selection.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capability selection is independent of the Engineering Behavior Model.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/capabilityOnReady.ts:14-49<br>src/routes/seu/core/capabilities.ts:33-38</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Selection reads only the Deliverable, the SEU Capability status and the eligibility pool. No EBM rule is consulted.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capabilities evolve through new versions, Pack contributions, specialisations and deprecation.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1529-1596<br>src/routes/seu/core/capabilityDefinitions.ts:93-130<br>src/routes/seu/core/packs.ts:498-512</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: a Definition lifecycle Defined, Validated, Published, Active, Deprecated, Retired, Archived, copy to a new patch version, inheritance and Pack upsert.<br>Gap: Deprecated or Retired Definition status has no effect on Pack-contributed capabilities rows or on SEU use of a Capability, so deprecation is a label.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An Organisational Learning Obligation raised by Engineering Telemetry can obligate revision of a Capability.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/telemetry.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No code raises an Obligation against a Capability from a telemetry pattern, and no Capability revision is linked to resolving one.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evolution preserves backward compatibility where practical.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilityDefinitions.ts:93-130</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">New versions are created as copies with a bumped patch version and the previous Active version stays until superseded. No compatibility check is made between versions.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">CapabilityRegistered is published.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1529-1535<br>src/routes/seu/core/capabilityDefinitions.ts:100-128</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The birth transition None to Defined names CapabilityRegistered and the event is published with the actor and badge.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">CapabilityPublished is published.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1548-1556</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Validated to Published transition names CapabilityPublished and VersionPublished.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">CapabilityDeprecated, CapabilityRetired and CapabilityArchived are published.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1568-1596</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each lifecycle hop names its event and a version event.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">CapabilityRequested, CapabilityFulfilled and CapabilityUnavailable are published.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:108-118, 135-147, 172-182<br>src/dblayer/seed/data/eventSubscriptions.json:24-26, 57-60</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each event is published with a real actor and badge. Subscriptions route the request and the fulfilment to their handlers.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">CapabilityReleased is published.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:185-217</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">releaseParticipants transitions the Participant to Released and Archived and revokes the fulfilment. The Participant transition events are published, but no event named CapabilityReleased exists anywhere in the code or seed data.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capability fulfilment interfaces and APIs are delivered.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/api/executionTargets.ts:62-72<br>src/routes/seu/api/objectives.ts<br>src/dblayer/seed/data/routeAuthority.json:570, 1772-1786<br>src/routes/seu/web/seus.ts:200-220,222,250</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: web routes to fulfil, replace and release, and an API to sweep unavailable Capabilities.<br>Gap: the API router has no fulfil route (src/routes/seu/api has none), and no API lists or reads Capabilities or Capability Definitions.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capability domain model, catalogue, registry, discovery service and events are delivered.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts<br>src/dblayer/capabilitiesDB.ts<br>src/dblayer/capabilityDefinitionsDB.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Domain model, catalogue, registry and events exist. A discovery service does not exist as a unit (see §11).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capability evolution does not require Runtime Kernel modification.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:498-512<br>src/routes/seu/core/sdkAuthoring.ts:964-990</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Definitions and Pack contributions are data rows created through the governed authoring path.</td>
    </tr>
  </tbody>
</table>

## Summary

- Total intents analysed: 33
- Fully met: 19
- Partially met: 11
- Not met: 3
- Not verifiable: 0

Major implementation gaps:

- Capability structure lacks Inputs, Outputs, Required Knowledge, Expected Deliverables, Success Criteria and Supported Participant Types (§8).
- A Deliverable references one producing Capability, not one or more (§6).
- Capability relationships cover inheritance only. Depends-on and composes are absent, and no cycle check exists (§9).
- Discovery by category, Deliverable and Participant type is absent, and there is no discovery service or Capability read API (§11, §17).
- Deprecation of a Capability Definition has no effect on Pack-contributed capabilities or SEU use (§13).
- Organisational Learning Obligation raised by telemetry against a Capability is absent (§13).
- CapabilityReleased is not published (§14).
- Capability Definitions and Pack-materialised capabilities are two unlinked catalogues (§6, §13).
