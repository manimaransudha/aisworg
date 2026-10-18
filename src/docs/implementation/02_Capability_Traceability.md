# Chapter 2 – Capability Model (SEU Studio Specifications): Implementation Traceability

**Date of report: 17-10-2026**

[Specification](../SEU%20Studio%20Specifications/01_Engineering%20Definition/02_Capability.md)

The **Capability Definition** is `<code>capability_definitions</code>` (authored, versioned, lifecycle-governed). 

The services provided by the capability are in 
`service_definitions`.

A **Pack contributes to a Capability** as an extension: `capabilities` rows are materialised from a Pack's `contributions.capabilities` and are what Templates, commissioning, Services, Deliverables and fulfilment bind to.

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">The platform maintains a Capability Catalogue.<br> Ref: §6 FR-2.1; §16; §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/capabilityDefinitionsDB.ts:123-194</code><br><code>src/routes/seu/web/capabilityDefinitionRegistry.ts:18-45</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"> <code><code>capability_definitions</code></code> is the catalogue. The registry page lists Definitions tenant-scoped with status filter, search and sort, and the DB layer finds them by id, code and version, active code and visibility.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Capability is a platform concept, independent of Participants, Organisations, Technologies and AI providers.<br> Ref: §4; §5 CM-001, CM-002</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/recovery/<code>capability_definitions</code>_schema_recovery.sql:3-12</code><br><code>src/dblayer/recovery/capabilities_schema_recovery.sql:3-12</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Neither the definition nor a Pack's extension row carries a Participant, provider or technology column. Participants link to a Capability only through <code>capability_fulfilments</code> and <code>participants_master.capabilities </code>. Platform-tenant definitions are visible to all tenants <code>(findAllVisibleTo)</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capabilities contain no runtime state (CM-005).<br> Ref: §5 CM-005</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/recovery/capabilities_schema_recovery.sql:3-12</code><br><code>src/dblayer/recovery/<code>seu_capabilities</code>_schema_recovery.sql:3-10</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The definition rows (<code>capabilities, <code>capability_definitions</code></code>) hold only identity, label, description, roles and lifecycle status. Fulfilled/Unfulfilled status lives on the SEU-scoped <code>seu_capabilities</code> row, not on the Capability.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capabilities remain independent of engineering behaviour (CM-006).<br> Ref: §5 CM-006; §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/recovery/capabilities_schema_recovery.sql:3-12</code><br><code>src/routes/seu/core/capabilityDefinitions.ts:111-145</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Neither the definition nor a Pack's extension row holds behaviour fields. Definition transitions go through the Transition Engine and carry no EBM reference.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Capability has a globally unique identifier.<br> Ref: §6 FR-2.3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/recovery/<code>capability_definitions</code>_schema_recovery.sql:4,30</code><br><code>src/dblayer/recovery/capabilities_schema_recovery.sql:4,16-18</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Both the definition and each Pack extension row have a UUID primary key. The code is the shared name: UNIQUE (code, version, tenant_id) on <code>capability_definitions</code> and <code>UNIQUE (originating_pack_id, code)</code> on capabilities so each Pack contributes at most one extension per code.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capabilities support versioning.<br> Ref: §6 FR-2.4; §13 new versions</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/capabilityDefinitionsDB.ts:9-72</code><br><code>src/dblayer/recovery/<code>capability_definitions</code>_schema_recovery.sql:14-16,30</code><br><code>src/dblayer/seed/data/transitionDefinitions.json:1207-1251</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Definitions carry a semver version, a copy-as-new-draft operation, and a lifecycle Defined, Published, Active, Deprecated, Retired, Archived with versionEvent wired on every transition. Activation of a newer Definition version is handled by the same lifecycle.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capabilities are independently extensible.<br> Ref: §6 FR-2.5; §9 specialise/extend</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/routes/seu/core/capabilityDefinitions.ts:79-107</code><br><code>src/dblayer/recovery/<code>capability_definitions</code>_schema_recovery.sql:19</code><br><code>src/routes/seu/core/packs.ts:525-540</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Definition can specialise an Active parent through parent_capability_definition_id (content copied at draft time). A Pack extends a Capability by contributing a capabilities row, which is independent of the Definition and of other Packs.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Deliverable requires one or more Capabilities.<br> Ref: §6 FR-2.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/recovery/deliverables_schema_recovery.sql:12</code><br><code>src/routes/seu/core/commissioning.ts:250-258</code><br><code>src/domain/engine/dispatchEngine.ts:74-79</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Deliverable carries producing_capability_id (a capabilities row). Commissioning derives the SEU's required Capabilities from the Templates and writes <code>seu_capabilities</code>. Dispatch rejects a Deliverable with no producing Capability (no_producing_capability_declared).<br>Gap:<br>The column is nullable, so one Capability at most is recorded, not one or more. The rule is enforced at dispatch, not at Deliverable creation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capabilities support fulfilment by multiple Participant types.<br> Ref: §6 FR-2.6; §8 Supported Participant Types; §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/routes/seu/core/capabilities.ts:33-55</code><br><code>src/routes/seu/core/capabilities.ts:122-178</code><br><code>src/dblayer/participantsMasterDB.ts:177-190</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">fulfilRequestedCapability accepts any Participant type from participants_master (AI, Human, External) after an eligibility check. fulfilment_strategy records the type or Composite. Eligibility combines the Participant's capabilities code list with Pack-contributed competency requirements and Eligibility-scope Policies (src/routes/seu/core/participantEligibility.ts:28-60).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capability fulfilment remains traceable.<br> Ref: §6 FR-2.7; §15; §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/routes/seu/core/capabilities.ts:57-178</code><br><code>src/dblayer/recovery/<code>capability_fulfilments</code>_schema_recovery.sql:3-12</code><br><code>src/dblayer/capabilityDefinitionsDB.ts:110-121</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each fulfilment writes <code>capability_fulfilments</code> with seu_capability_id, participant_id, author_id, author_badge, established_at and revoked_at, and publishes ParticipantCreated and CapabilityFulfilled with actor and badge.<br>Gap:<br>updateStatus overwrites authored_by and author_badge on the Definition row at every transition, so the original author is lost and only the latest actor is retained. The event stream holds the history.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Capability has Identifier, Name, Description, Category, Inputs, Outputs, Required Knowledge, Expected Deliverables, Success Criteria and Supported Participant Types.<br> Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/recovery/<code>capability_definitions</code>_schema_recovery.sql:3-12</code><br><code>src/dblayer/recovery/capabilities_schema_recovery.sql:3-12</code><br><code>src/dblayer/seed/data/schemaDefinitions.json (entity_kind Capability)</code><br><code>src/dblayer/seed/data/capabilityDefinitions.json</code><br><code>src/dblayer/seed/seedCapabilityDefinitions.ts</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>capability_definitions</code> holds id, code, default_label, description, category and roles[] with worktypes. The category is a NOT NULL column, declared as a required Ontology-driven property in the Capability schema (concept type category:capability, composable) and validated on seed and on authoring. The Service Definition bound to the Capability through capability_code holds Inputs (inputs), Outputs (outputs, which name the Expected Deliverables), Success Criteria (success), purpose, consumers, governance and service level. Packs supply Required Knowledge through contributions.competencies and contributions.engineeringCapital (src/routes/seu/core/packs.ts:365-382), composed into the SEU's competency requirements (src/domain/engine/profileCompositionUnravel.ts:66). Packs supply Supported Participant Types through Eligibility-scope Policies, applied with the competency match in src/routes/seu/core/participantEligibility.ts:28-60. The Pack extension row holds id, code, name, description and version; the Category is carried by the Definition only.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Capability can depend on, specialise, compose or extend other Capabilities.<br> Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/routes/seu/core/capabilityDefinitions.ts:79-92</code><br><code>src/dblayer/recovery/<code>capability_definitions</code>_schema_recovery.sql:19</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Specialise/extend is modelled as a single parent pointer.<br>Gap:<br>No dependency or composition relation exists between Capabilities. No relation table or column covers depends-on or composes. A Pack's extension row has no relationship fields.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capability relationships shall not create circular dependencies.<br> Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/routes/seu/core/capabilityDefinitions.ts:79-92</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>No cycle check exists. A parent must already be Active, which prevents a new draft from pointing at itself, but no traversal of the parent chain is made and no check exists for other relation types because none exist.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Capability follows a lifecycle, including deprecation.<br> Ref: §2 Capability lifecycle; §13 deprecation</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/routes/seu/core/capabilityDefinitions.ts:95-143</code><br><code>src/dblayer/seed/data/transitionDefinitions.json:1211-1254</code><br><code>src/dblayer/capabilityDefinitionsDB.ts:74-108</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Definitions move Defined, Published, Active, Deprecated, Retired, Archived through transitionEngine.evaluate with badge authority, policy gate and an event published with real actor and badge. The transition events are CapabilityPublished, CapabilityActivated, CapabilityDeprecated, CapabilityRetired and CapabilityArchived, each with its Version event. A draft is editable only while Defined. Publishing from the authoring path also requires every composable Ontology value on the draft, including the Capability code, to be approved (<code>src/routes/seu/core/sdkAuthoring.ts:1231</code>). Pack extension rows carry no status of their own.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Backward compatibility is preserved when Capabilities evolve.<br> Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/routes/seu/core/capabilityDefinitions.ts:161-183</code><br><code>src/dblayer/capabilitiesDB.ts:17-24</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A new Definition version is a new row. Older versions stay until retired.<br>Gap:<br>No compatibility check compares a new version with the prior one. For a Pack extension, ON CONFLICT (originating_pack_id, code) DO UPDATE replaces name, description and version in place with no check.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Capability can evolve by resolution of an Organisational Learning Obligation raised by Engineering Telemetry.<br> Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/obligationsDB.ts</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>An obligations table exists, but no code path ties an Obligation to a Capability Definition revision or raises one from telemetry about a Capability. No Capability code reads or writes obligations.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Pack contributes to a Capability as an extension, and new Capabilities can be introduced through Packs.<br> Ref: §7 last line; §9 extend; §13 Pack contributions; §15; §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/routes/seu/core/packs.ts:209-215</code><br><code>src/routes/seu/core/packs.ts:525-540</code><br><code>src/dblayer/capabilitiesDB.ts:6-30</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Pack declares contributions.capabilities[]. Validation checks that each code is a canonical capability-name Ontology concept and unique within the Pack. On activation materializeContributions upserts one capabilities row per code, with name and description from the Ontology concept, the Pack version, and the Pack's author and badge. Services, Templates and Deliverables then bind to that row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Pack&#x27;s extension refers to the Capability Definition it extends.<br> Ref: §4; §8 last line; §9 extend; §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/routes/seu/core/packs.ts:525-540</code><br><code>src/dblayer/recovery/capabilities_schema_recovery.sql:3-12</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Definition validates its code against the capability-name Ontology concept through the schema field, which is composable, so a new code is proposed with the draft and must be approved before the Definition publishes (src/routes/seu/core/sdkAuthoring.ts:1231), and the Pack contribution validates against the same concept (src/routes/seu/core/packs.ts:209-215). Both are tied by that shared concept identity.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capabilities are discoverable by identifier, category, engineering objective, Deliverable, Pack contribution and supported Participant type.<br> Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/capabilitiesDB.ts:32-60</code><br><code>src/routes/seu/api/objectives.ts:62-68</code><br><code>src/routes/seu/web/capabilityDefinitionRegistry.ts:18-45</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">By identifier: findById and findByCodes. By Pack contribution (extensions): findByOriginatingPackIds. By engineering objective: suggest-capabilities endpoint. By Deliverable: producing_capability_id. The Definition registry supports code and label search and a status filter.<br>Gap:<br>The Definition carries a category, but no finder or registry filter queries by it, and there is no discovery by supported Participant type. No Capability discovery service or API exists as a single surface.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Capability can be fulfilled by AI, Human, External or Hybrid teams.<br> Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/routes/seu/core/capabilities.ts:122-178</code><br><code>src/dblayer/capabilityFulfilmentPoolsDB.ts:1-37</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">fulfilRequestedCapability, the consumer of CapabilityRequested, assigns several Participants and sets strategy Composite when more than one is given. Pools are stored in capability_fulfilment_pools.<br>Gap:<br>Hybrid is modelled only as Composite over Participants. No separate Hybrid team construct exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Multiple Participants can fulfil the same Capability.<br> Ref: §5 CM-003; §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/routes/seu/core/capabilities.ts:122-178</code><br><code>src/dblayer/capabilityFulfilmentsDB.ts:44-55</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>capability_fulfilments</code> has no uniqueness on seu_capability_id, fulfilRequestedCapability loops over Participants, and findActiveManyBySeuCapabilityId returns all active ones.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">One Participant can fulfil multiple Capabilities.<br> Ref: §5 CM-004; §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/participantsMasterDB.ts:177-190</code><br><code>src/routes/seu/core/capabilities.ts:57-96</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A participants_master row lists several capability codes, and the same master Participant can be used in different SEU Capabilities.<br>Gap:<br>Each fulfilment creates a new SEU-scoped participants row, and findActiveByParticipantId returns one active fulfilment per such row. Releasing uses that single row, so one SEU Participant row holds one Capability.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Fulfilment strategies can change without changing the Capability Model.<br> Ref: §10; §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/routes/seu/core/capabilities.ts:57-96</code><br><code>src/dblayer/recovery/<code>capability_fulfilments</code>_schema_recovery.sql:8</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">fulfilment_strategy is free text with the CHECK constraint dropped, and the Capability tables carry no strategy field.<br>Gap:<br>The value is set to the Participant type or Composite in code, and the strategy list is not Ontology-backed in the files read.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">When a Deliverable becomes Ready the platform identifies required Capabilities, determines fulfilment, invokes the fulfilment service, assigns Participants and authorises execution.<br> Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/domain/engine/capabilityOnReady.ts</code><br><code>src/domain/engine/dependencyDefinitionEngine.ts:115-145</code><br><code>src/domain/engine/dispatchEngine.ts:64-117</code><br><code>src/domain/engine/workItemGenerator.ts:90-131</code><br><code>src/routes/seu/core/commissioning.ts:250-258</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Required Capabilities are fixed at commissioning (<code>seu_capabilities</code>). Dispatch reads the producing Capability of the Deliverable and selects only from the Participants fulfilling it, so execution is authorised for assigned Participants alone. A Deliverable is Ready when every dependency row governing its producing state is satisfied, announced by DeliverableReady, or when the SEU is Commissioned for a Deliverable with no such rows. The capabilityOnReady handler then publishes CapabilityRequested for the producing Capability, naming no Participant, unless it is Fulfilled or a request is in flight. The capabilityRequested handler identifies the Participants. An empty pool is handled as CapabilityUnavailable with a delayed re-request.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capability selection is independent of the Engineering Behavior Model.<br> Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/domain/engine/dispatchEngine.ts:74-117</code><br><code>src/routes/seu/core/commissioning.ts:250-258</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Selection reads the producing Capability and the fulfilment pool and uses no EBM data in these paths.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Capability subsystem publishes CapabilityRegistered, CapabilityUpdated, CapabilityDeprecated, CapabilityRequested, CapabilityFulfilled, CapabilityUnavailable and CapabilityReleased.<br> Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/routes/seu/core/capabilityDefinitions.ts:95-143</code><br><code>src/routes/seu/core/capabilityDefinitions.ts:146-176</code><br><code>src/routes/seu/core/sdkAuthoring.ts:949</code><br><code>src/dblayer/seed/seedCapabilityDefinitions.ts:77</code><br><code>src/routes/seu/core/capabilities.ts:98-178</code><br><code>src/domain/engine/deliverableKickoff.ts:58-72</code><br><code>src/routes/seu/core/capabilityRetrySweep.ts</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">CapabilityRegistered is published after each insert into <code>capability_definitions</code> (seed, authoring and copy as new draft), with actor and badge. CapabilityDeprecated is published by the Active to Deprecated hop. The Definition hops Published, Activated, Retired and Archived publish CapabilityPublished, CapabilityActivated, CapabilityRetired and CapabilityArchived. CapabilityRequested is published by requestCapabilityFulfilment as its last statement, and the capabilityRequested handler consumes it. The handler publishes one CapabilityFulfilled per request, or CapabilityUnavailable when the eligible pool is empty. deliverableKickoff consumes CapabilityUnavailable, raises a blocking Obligation and an AttentionItem for each In Progress Deliverable produced by that Capability, and holds the producing Command back. A retry sweep publishes CapabilityRequested again as the SEU system actor after the configured delay, within the redispatch attempt limit.<br>Gap:<br>CapabilityUpdated is deliberately not published, because draft revisions are not versioned. CapabilityReleased is not published (releaseParticipants publishes nothing). CapabilityFulfilled has originatingObjectType SEU, not Capability. The Chapter 2 §14 events for the definition side beyond Registered and Deprecated use the Capability prefix without a Chapter 2 counterpart for Published, Activated, Retired and Archived. The Obligation and AttentionItem raised for an unavailable Capability are not advanced automatically when a retry succeeds.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capability evolution does not require Runtime Kernel modification.<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/seed/data/capabilityDefinitions.json</code><br><code>src/routes/seu/core/sdkAuthoring.ts:945-975</code><br><code>src/routes/seu/core/packs.ts:525-540</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Definitions are seed data and authoring-path data. Pack Capabilities are Pack content. A new Capability code needs an Ontology concept (data) and no code change.<br>Gap:<br>Evolution of the Definition roles and worktypes also needs Ontology rows (data). No kernel-independence test exists for Capabilities.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capability authoring is gated by badge and tenant scope.<br> Ref: §17 Capability APIs; project rules</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/seed/data/routeAuthority.json:979-996</code><br><code>src/routes/seu/web/capabilityDefinitionRegistry.ts:36-56</code><br><code>src/routes/seu/web/sdkAuthoring.ts:159</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Registry and copy routes have route_authority rows (role participant). The copy action requires the capability_define badge via badgeAuthorityEngine. Authoring draft routes use requireTenantScope.forParam.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capability APIs and a Capability registry service exist.<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/routes/seu/web/capabilityDefinitionRegistry.ts:18-65</code><br><code>src/routes/seu/core/capabilityDefinitions.ts:185-198</code><br><code>src/routes/seu/api/objectives.ts:62-68</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A registry UI and core functions exist for Definitions. The only API touching Capabilities is suggest-capabilities and the execution-targets API keyed by capabilityId.<br>Gap:<br>No JSON API lists, reads or authors Capabilities, either Definitions or Pack extensions.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capability fulfilment interfaces exist.<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/routes/seu/core/capabilities.ts:98-215</code><br><code>src/domain/engine/capabilityOnReady.ts</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">requestCapabilityFulfilment, fulfilRequestedCapability and releaseParticipants cover request, assignment and release with eligibility, tenant and transition checks. A request may name Participants (a manual pick) or name none, in which case the eligible pool fulfils. The platform makes the request itself for each Ready Deliverable, through the capabilityOnReady handler on DeliverableReady and SEUCommissioned. The API route for fulfil is intentionally commented out and the web route is the live entry.</td>
    </tr>
  </tbody>
</table>

## Summary

- Total intents analysed: 30
- Fully met: 16
- Partially met: 12
- Not met: 2
- Not verifiable: 0

**Major implementation gaps**

- §9 relationships: only a parent pointer exists. Dependency and composition relations and the circular-dependency rule are absent.
- §13: the Organisational Learning Obligation path is absent. A Pack's extension row is overwritten in place on republish.
- §14 events: CapabilityUpdated (by decision) and CapabilityReleased are not published. The other five are published.
- §11 discovery: no category-based or Participant type discovery and no single discovery service or API.

