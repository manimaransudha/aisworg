# Implementation Traceability: Chapter 41 – Version Management

**Date of report: 23-10-2026**

Specification: src/docs/SEU Studio Specifications/06_Platform Architectire/41_Version Management.md

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Versioned artefacts keep engineering execution reproducible. Every engineering decision can be explained by the exact versions that influenced it.<br>Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/eventBus.ts:78-95<br>src/dblayer/recovery/version_events_schema_recovery.sql:3-15<br>src/dblayer/recovery/seus_schema_recovery.sql:6-7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: a version-significant hop is indexed in version_events with actor, badge, state pair and time. SEU and EBM rows point at the exact Template and Profile rows, which are one row per version.<br>Gap: nothing links a decision or execution event to the version rows that influenced it, and no service rebuilds that explanation. See §12 and §13 rows.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Engineering Objects flow through Version Management into the Engineering Behavior Model and the Runtime Kernel. The Runtime Kernel consumes Versions.<br>Ref: §3 Architectural Position, §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ebmsDB.ts:22-23<br>src/dblayer/recovery/ebms_schema_recovery.sql:6-8<br>src/routes/seu/core/packs.ts:128-135</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: an EBM is composed for an SEU from a Template row, a Profile row and a list of composed Pack rows. Pack composition resolves only the Pack with status Active (packsDB.findActiveByCode), so a Draft is not consumed.<br>Gap: the same status filter was verified for Pack only. Template, Profile and Policy resolution paths were not shown to refuse non-published rows by one shared rule.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Revision is the mutable working state during authoring and is never referenced by an active SEU.<br>Ref: §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packsDB.ts:104-107<br>src/dblayer/templatesDB.ts:83-86<br>src/dblayer/profilesDB.ts:157-160<br>src/dblayer/policyDefinitionsDB.ts:116-119<br>src/dblayer/capabilityDefinitionsDB.ts:98-101<br>src/dblayer/serviceDefinitionsDB.ts:122-125<br>src/dblayer/deliverableDefinitionsDB.ts:79-82</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: each definition entity edits its content only through an UPDATE guarded by the first lifecycle state (Draft or Defined). Draft rows stay mutable and carry the working version number.<br>Gap: the Revision is not a separate construct. It is the same row as the later Version, and the platform has no distinct revision counter apart from Objective's dual-use version column (documented in the Version Feature Plan).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Version is an immutable snapshot of an artefact. Versions are immutable.<br>Ref: §4 Definition, §5 VM-002, §11, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packsDB.ts:104-107<br>src/dblayer/templatesDB.ts:83-86<br>src/routes/seu/core/ontology.ts:360-399</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: after the first hop, no DB-layer function rewrites the content of Pack, Template, Profile, Policy Definition, Capability Definition, Service Definition or Deliverable Definition. Ontology evolves by inserting a new concept version row. Evolution creates a new row, for example copyProfileAsNewDraft and the Pack branch path.<br>Gap: immutability is a convention of the update functions only. No database trigger or constraint blocks an UPDATE on a published row, and the lifecycle status column itself changes on every hop. A direct write by any other code path is not prevented.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Only Versions may be referenced by Engineering Behavior Models, Transition Definitions, runtime execution and historical reconstruction.<br>Ref: §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ebmsDB.ts:22-23<br>src/dblayer/recovery/seus_schema_recovery.sql:6-7<br>src/dblayer/recovery/transition_definitions_schema_recovery.sql:3-30</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: EBM and SEU reference Template and Profile by row id, and each id is one version.<br>Gap: Transition Definitions carry required_policy_ids that point at Policy Definition rows and carry no version constraint. No rule rejects a reference to a row that is still a Revision. Reconstruction does not exist (see §12).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Versioned lifecycle artefacts: Packs, Profiles, Templates, Policy Definitions and Capability Definitions each carry a version number, a unique (code, version, tenant) key and a governed lifecycle that marks version-significant hops.<br>Ref: §5 VM-001, §7 Versioned Artefacts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/packs_schema_recovery.sql:8,26<br>src/dblayer/recovery/profiles_schema_recovery.sql:20,25<br>src/dblayer/recovery/templates_schema_recovery.sql:18-27<br>src/dblayer/recovery/policy_definitions_schema_recovery.sql:15,23<br>src/dblayer/recovery/capability_definitions_schema_recovery.sql:15,26-28<br>src/dblayer/seed/data/transitionDefinitions.json:925-997<br>src/dblayer/seed/data/transitionDefinitions.json:1218-1297<br>src/dblayer/seed/data/transitionDefinitions.json:1368-1447<br>src/dblayer/seed/data/transitionDefinitions.json:1528-1666</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each of the five has a semver version column, a uniqueness key on code plus version plus tenant, and Transition Definition rows with version_event set at Validate, Publish, Activate, Deprecate/Retire and Archive. Service, Deliverable Definition and Ontology follow the same shape (next rows).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Service Definitions, Deliverable Definitions and Ontology concepts are versioned with version-significant lifecycle hops.<br>Ref: §7 Versioned Artefacts, §11 ontology expansion</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/service_definitions_schema_recovery.sql:15,25-27<br>src/dblayer/recovery/deliverable_definitions_schema_recovery.sql:7,15<br>src/dblayer/recovery/ontology_concepts_schema_recovery.sql:16,25-27<br>src/routes/seu/core/ontology.ts:360-399<br>src/dblayer/seed/data/transitionDefinitions.json:1298-1367<br>src/dblayer/seed/data/transitionDefinitions.json:1448-1527<br>src/dblayer/seed/data/transitionDefinitions.json:1667-1726</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Version columns and (code, version, tenant) keys exist. createConceptVersion allocates the next unused version and publishes with the birth Transition Definition's version event. Transition rows for Service, DeliverableDefinition and Ontology carry version_event values.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Engineering Behavior Models are versioned.<br>Ref: §7 Versioned Artefacts, §5 VM-001</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ebmsDB.ts:22-23<br>src/dblayer/recovery/ebms_schema_recovery.sql:13<br>src/dblayer/seed/data/eventSubscriptions.json:11<br>src/dblayer/seed/data/transitionDefinitions.json:209-218</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: each new EBM row for an SEU gets MAX(version)+1 as an integer.<br>Gap: EBM Transition Definition rows carry no version_event, so no version_events row is ever written for an EBM hop. The EBMVersioned event is registered but never published, so a re-composition producing a second EBM version is not built.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Quality Gates and Reviews are versioned.<br>Ref: §7 Versioned Artefacts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/qualityGatesDB.ts:50-58<br>src/dblayer/reviewGatesDB.ts:42-50<br>src/dblayer/recovery/quality_gates_schema_recovery.sql:19-32<br>src/dblayer/recovery/reviews_schema_recovery.sql:15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: Quality Gate and Review Gate rows get a bumped version string on each authoring save, with a uniqueness key including version. Reviews have an integer version column.<br>Gap: Quality Gate has no Transition Definition rows and Review rows carry no version_event, so no version lifecycle, activation or version_events trail exists for them. Version formats differ (1.0, 1.0.0, integer).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authority Rules are versioned.<br>Ref: §7 Versioned Artefacts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/authority_rules_schema_recovery.sql:3-10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: authority_rules has code, governed_transition, authorised_role and originating_pack_id with no version column and no lifecycle. A rule is versioned only indirectly through the Pack that contributes it.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Runtime APIs are versioned.<br>Ref: §7 Versioned Artefacts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No supporting code found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: no API version identifier, versioned route prefix or version declaration exists for the platform API under src/routes/seu/api. Search for api version constructs found none.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Version management is independent of implementation technologies. Numbering strategy is implementation-defined.<br>Ref: §5 VM-006, §8 closing note</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/utils/version.ts:1-32<br>src/dblayer/recovery/transition_definitions_schema_recovery.sql:22-29</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Version numbers are plain x.y.z strings (semverError, bumpPatch, nextAvailablePatchVersion) and the version event vocabulary is data on the Transition Definition, with no dependency on source control or a repository technology.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every versioned artefact has a globally unique identifier, a version identifier, a creation timestamp and a lifecycle state.<br>Ref: §6 FR-41.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/packs_schema_recovery.sql:4-13<br>src/dblayer/recovery/templates_schema_recovery.sql:7-11<br>src/dblayer/recovery/service_definitions_schema_recovery.sql:15-23</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each versioned table has a UUID primary key, a version column, created_at and a status or lifecycle_state column.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every versioned artefact records its originating source.<br>Ref: §6 FR-41.1, §8 Publisher</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/packs_schema_recovery.sql:19-21<br>src/dblayer/recovery/ontology_concepts_schema_recovery.sql:39<br>src/routes/seu/core/packs.ts:100-117</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: Packs and Ontology concepts store the author participant and author badge. Pack metadata holds a publisher string.<br>Gap: the publisher is free text in a metadata map. No uniform originating-source field exists, and the author is recorded on the artefact while the publisher of each Version event is recorded separately in version_events.actor_id.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Version identifiers remain immutable.<br>Ref: §6 FR-41.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/templatesDB.ts:83-86<br>src/dblayer/packsDB.ts:104-107<br>src/dblayer/deliverableDefinitionsDB.ts:79-82</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the version column can change only through the Draft-guarded content update. After the first hop no update path in the DB layer rewrites it.<br>Gap: no database constraint prevents a later change. Objective's version column is bumped on every edit while Proposed by design.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Version compatibility is validated before activation.<br>Ref: §6 FR-41.3, §10, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:399-405<br>src/routes/seu/core/schemaRegistry.ts:64-69<br>src/routes/seu/core/schemaRegistry.ts:104-107<br>src/domain/engine/transitionEngine.ts:128-194</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: a required Pack dependency is checked for existence when the Pack seed is validated. Schema versions get a compatibility report against every earlier version when created. The Activate hop runs the generic governed evaluation (badge, policies, Quality Gates).<br>Gap: no step on the Activate hop evaluates compatibility. The Pack dependency check runs at draft creation and resolves by code only (packsDB.findByCode), not by the declared version. The schema report is stored at creation and not consulted at activation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Compatibility considers the platform version and the Runtime Kernel version.<br>Ref: §10 Compatibility</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:108-117</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: minSupportedPlatformVersion, maxSupportedPlatformVersion and supportedPlatformVersion are stored as metadata strings on a Pack. No platform version value exists in the code to compare them with, and nothing reads these keys. No Runtime Kernel version exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Compatibility considers Pack versions and dependency versions.<br>Ref: §10 Compatibility</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:399-405<br>src/domain/engine/profileCompositionUnravel.ts:362-369<br>src/dblayer/packsDB.ts:16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: dependencies carry packCode, version and type (required, optional, conditional, incompatible). During composition a required or conditional dependency missing from the composed set, or an incompatible one present, raises a conflict.<br>Gap: the version field is not compared. Satisfaction is judged by pack presence in the composed set. incompatiblePackVersions is stored as metadata text and never evaluated.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Compatibility considers the Engineering Behavior Model and supported capabilities.<br>Ref: §10 Compatibility</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No supporting code found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: no code evaluates a Version against an EBM or against a supported-capability declaration at activation or anywhere else.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Compatibility rules are declarative and are part of the engineering objects.<br>Ref: §10 Compatibility, §5 VM-004</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/schema_definitions_schema_recovery.sql:15-16<br>src/dblayer/schemaDefinitionsDB.ts:88-96<br>src/routes/seu/core/packs.ts:92-117</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: schema definition rows declare compatible_versions and incompatible_versions. Pack rows declare dependency types and platform bounds as data.<br>Gap: the only consumer, schemaDefinitionsDB.instancesCompatible, has no caller. Platform bounds and incompatible Pack versions are free text with no grammar.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Superseded versions remain available.<br>Ref: §6 FR-41.4, §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:444-457<br>src/routes/seu/core/templates.ts:508-518<br>src/routes/seu/core/sdkAuthoring.ts:591-597</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Activating a new Pack or Template version moves the previous Active row to Retired or Deprecated. The row is kept and can be branched from (Published, Active, Retired and Archived are branchable). No delete function exists for production lifecycle rows.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Historical execution references exact versions.<br>Ref: §6 FR-41.5, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/seus_schema_recovery.sql:6-7<br>src/dblayer/recovery/ebms_schema_recovery.sql:6-8<br>src/dblayer/recovery/events_schema_recovery.sql:3-12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: an SEU and its EBM name the Template row and Profile row, and the EBM lists the composed Pack rows.<br>Gap: events and work items record the originating object id and no version of Packs, Policies, Quality Gates or Ontology applied at the time of the event.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Version history remains permanently traceable.<br>Ref: §6 FR-41.6, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/versionEventsDB.ts:11-105<br>src/domain/engine/eventBus.ts:78-95</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: version_events is append-only through versionEventsDB (insert and reads only), keyed to the published event.<br>Gap: if the version_events insert fails, eventBus only logs the error and the event stays published, so a version hop can lose its trail silently. The insert is not in the transition's transaction. Only hops with a version_event are indexed.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The platform supports concurrent versions where compatible.<br>Ref: §6 FR-41.7, §16, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:444-457<br>src/routes/seu/core/templates.ts:508-518<br>src/dblayer/recovery/schema_definitions_schema_recovery.sql:6-9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: several versions of one code coexist in non-Active states, and schema definition versions all remain with compatibility arrays.<br>Gap: Pack, Template and Profile activation retires or deprecates the previous Active version of the same code and tenant, so only one Active version exists per code. No compatibility test decides whether two versions may stay Active together.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Version defines an identifier, a version number and a status.<br>Ref: §8 Version Structure</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/packs_schema_recovery.sql:4-9<br>src/dblayer/recovery/policy_definitions_schema_recovery.sql:15-23</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each versioned row has id, version and status, as in the FR-41.1 row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Version carries an Artefact Identifier, a Compatibility Declaration, a Publisher and Metadata.<br>Ref: §8 Version Structure</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/packs_schema_recovery.sql:9-21<br>src/routes/seu/core/packs.ts:100-117</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the code column serves as the artefact identifier shared by all versions. Packs have metadata JSON, dependencies and an author.<br>Gap: no artefact entity exists. Metadata and compatibility are Pack-only. Templates, Profiles and other artefacts have no compatibility declaration.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Version records its Parent Version and the Version that superseded it.<br>Ref: §8 Version Structure, §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/profiles.ts:502-516<br>src/routes/seu/core/templates.ts:576<br>src/routes/seu/core/deliverableDefinitions.ts:93<br>src/dblayer/recovery/templates_schema_recovery.sql:9<br>src/dblayer/recovery/profiles_schema_recovery.sql:21</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: the parent_template_id, parent_profile_id and parent_deliverable_definition_id columns are inheritance parents. The copy functions write the source's own inheritance parent (source.parent_profile_id and equivalents), not the source version. No parent_version or superseded_by column exists on any versioned table, so the next version row has no stored link to the one it replaced. The Version Feature Plan defers this linkage. Only Decision and Evidence carry supersession pointers, which are outside version management.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each artefact follows its own lifecycle that maps onto the general Version lifecycle.<br>Ref: §9 Version Lifecycle</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:290-397<br>src/dblayer/seed/data/transitionDefinitions.json:925-997<br>src/dblayer/seed/data/transitionDefinitions.json:1218-1297<br>src/dblayer/seed/data/transitionDefinitions.json:1448-1527<br>src/dblayer/recovery/transition_definitions_schema_recovery.sql:22-29<br>src/domain/engine/transitionEngine.ts:196-208</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Lifecycles are data per entity in transition_definitions. version_event maps hops onto Created, Validated, Published, Activated, Deprecated, Superseded and Archived, and the value is constrained to those names. Entities without a stage omit it, as the chapter allows.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Historical Versions remain immutable.<br>Ref: §9 Version Lifecycle, §11, §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packsDB.ts:104-107<br>src/dblayer/versionEventsDB.ts:11-105</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same basis as the immutability row. Retired and Archived rows keep their content because no update function targets them. No database-level guarantee exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The platform evolves by creating new Versions.<br>Ref: §11 Version Evolution</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/profiles.ts:449-452<br>src/routes/seu/core/profiles.ts:453-516<br>src/routes/seu/core/templates.ts:544-551<br>src/routes/seu/core/deliverableDefinitions.ts:71-78<br>src/routes/seu/core/ontology.ts:360-399</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Profile, Template, Deliverable Definition, Pack and Ontology concept changes create a new row with the next unused patch version.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every evolution preserves historical traceability.<br>Ref: §11 Version Evolution</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/profiles.ts:453-516<br>src/domain/engine/eventBus.ts:78-95</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the evolution hops are recorded in version_events.<br>Gap: the new version does not record which version it evolved from (see Parent Version row), so the evolution chain cannot be rebuilt from the data.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The platform reconstructs any historical engineering state from historical Versions, Events, EBMs and State Transitions.<br>Ref: §12 Historical Reconstruction, §16, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/versionEvents.ts:3-20<br>src/routes/seu/web/versionEvents.ts:13-42</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the inputs are retained. Version rows are kept, events are append-only, EBM versions are kept and version_events lists hops. A page lists version events by filter.<br>Gap: no service replays these to rebuild an engineering state at a point in time. getVersionReplay has no caller and only returns the version event list of one entity.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The reconstructed environment reproduces engineering behaviour as originally executed.<br>Ref: §12 Historical Reconstruction, §3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No supporting code found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: there is no reconstruction code, so no reproduction of behaviour exists. No test establishes reproducibility.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Version preserves its parent, successors, compatibility history, activation history, associated executions and originating publisher.<br>Ref: §13 Version Traceability</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/versionEventsDB.ts:11-105<br>src/dblayer/recovery/version_events_schema_recovery.sql:3-15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: activation history and the publisher of each version hop (actor_id and authority_badge) are stored in version_events.<br>Gap: parent, successors, compatibility history and associated engineering executions are not stored or derivable.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Version traceability is immutable.<br>Ref: §13 Version Traceability</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/versionEventsDB.ts:11-105<br>src/dblayer/eventsDB.ts:52-62</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: version_events has no update or delete function in the DB layer.<br>Gap: no database constraint enforces this, and the events table consumption_state column is updated after publish (eventsDB.updateConsumptionState).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Activation of a Version is governed by validation, approval and publication. Governance rules can be contributed through Packs.<br>Ref: §14 Version Governance</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/transitionEngine.ts:64-86<br>src/domain/engine/transitionEngine.ts:115-208<br>src/domain/engine/entityTransition.ts:24-62<br>src/routes/seu/core/packs.ts:460-473<br>src/routes/seu/core/sdkAuthoring.ts:596-612</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Activation is a governed hop: Validated and Published hops come first, the Transition Definition's verb resolves an authority badge, required policies and Quality Gates are evaluated, and a blocked outcome stops the hop. Packs contribute policies, authority rules and Quality Gates. Composition and compatibility checks are rows above.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The seven Version events are representable on Transition Definitions: VersionCreated, VersionValidated, VersionPublished, VersionActivated, VersionDeprecated, VersionSuperseded, VersionArchived.<br>Ref: §15 Events</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/transition_definitions_schema_recovery.sql:22-29<br>src/dblayer/seed/data/transitionDefinitions.json:290-397<br>src/dblayer/seed/data/transitionDefinitions.json:1218-1297</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The version_event and submit_version_event columns are constrained to these seven names and the seed uses all seven.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Version Management subsystem publishes the seven Version events.<br>Ref: §15 Events, §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/eventBus.ts:67-95<br>src/domain/engine/entityTransition.ts:64-77</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: on a version-significant hop the domain event (for example PackActivated) is published and a version_events row carries the version event name.<br>Gap: no event named VersionCreated or the others is published on the bus. They are not in the event subscription seed, so no subscriber can receive them. The Version Feature Plan chose this design.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Long-term archival is supported.<br>Ref: §16 Non-Functional Requirements</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1218-1297</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: an Archived state with VersionArchived exists for most versioned entities and rows are not deleted.<br>Gap: no archival store, retention rule or partitioning exists. Archived rows stay in the live tables.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❓</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Behaviour stays deterministic across Versions.<br>Ref: §16 Non-Functional Requirements</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No supporting code found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No test or code in the repository establishes deterministic replay of composition or execution across versions. Evidence needs runtime comparison, which the repository does not contain.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: a Version Registry.<br>Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/versionEventsDB.ts:11-105<br>src/dblayer/seed/data/transitionDefinitions.json:925-997<br>src/dblayer/seed/data/transitionDefinitions.json:1218-1297</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: version rows live in each entity's own table, indexed by version_events and Transition Definitions.<br>Gap: no single registry resolves an artefact and version across kinds. The Version Feature Plan decided on no versions table.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: a Version lifecycle service.<br>Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/transitionEngine.ts:89-99<br>src/domain/engine/transitionEngine.ts:115-208<br>src/domain/engine/entityTransition.ts:24-93</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">transitionEngine and transitionEntity are the generic lifecycle service. They resolve the definition, enforce authority and policies, change state and return the event with its version event for publishing.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: a Compatibility evaluation service.<br>Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/schemaRegistry.ts:64-69</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: the only compatibility computation is a private report builder for schema definitions. No service evaluates compatibility for Packs, Templates, Profiles or others.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: a Version traceability service.<br>Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/versionEvents.ts:3-20<br>src/routes/seu/web/versionEvents.ts:13-42<br>src/dblayer/versionEventsDB.ts:49-60</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: a paged, filterable read of version_events and a per-entity query, shown on the Version Replay page.<br>Gap: it returns only version events, with no parent, successor or execution links.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: a Historical reconstruction service.<br>Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No supporting code found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: no such service exists (see §12 rows).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Version APIs.<br>Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/web/versionEvents.ts:13-42<br>src/dblayer/seed/data/routeAuthority.json:1022-1029</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: one web route, GET /version-events, governed by a route_authority row for the superuser role.<br>Gap: no JSON API under src/routes/seu/api exposes versions, version history or compatibility.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Version events.<br>Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/eventBus.ts:78-95</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same basis as the §15 publishing row: version events are persisted as version_events rows and not published as events.</td>
    </tr>
  </tbody>
</table>

## Summary

- Total intents analysed: 47
- Fully met: 11
- Partially met: 26
- Not met: 9
- Not verifiable: 1

Major implementation gaps: no historical reconstruction service; no compatibility evaluation before activation (platform, kernel, EBM, capability and Pack version checks are absent or by code only); no parent or superseded-by version links; Version events recorded as version_events rows and not published on the bus; Authority Rules and Runtime APIs unversioned; EBM, Quality Gate and Review versions carry no lifecycle; no single Version Registry or version API.
