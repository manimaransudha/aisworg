# Implementation Traceability: Chapter 3 – Service

**Date of report: 23-10-2026**

Specification: src/docs/SEU Studio Specifications/01_Engineering Definition/03_Service.md

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">Service is declared by a Capability Pack, not by a Participant.<br>Ref: §1, §5 SVC-001</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:516-540<br>src/dblayer/servicesDB.ts:11-69</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Services rows are written only by servicesDB.upsertFromPack, called while materialising a Pack's contributions.services. originating_pack_id and the Pack's author are stamped on the row. No Participant authoring path exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Service exposes what a Capability delivers and never how.<br>Ref: §1, §5 SVC-002</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/services_schema_recovery.sql:3-14<br>src/dblayer/recovery/service_definitions_schema_recovery.sql:3-24</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The model holds name, contract_description, service_level, inputs and outputs only. No Participant or execution detail is stored.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Service stays one of four coequal channels and does not subsume Evidence, Knowledge or Decision.<br>Ref: §3, §5 SVC-003</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:68-100<br>src/dblayer/evidenceDB.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evidence, Knowledge and Decision are separate entities with their own tables and dependency node types. The Capability dependency node is resolved through a Service code, so Service stays the link into Capability readiness. No defect was found against the channel separation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Service declares a Service Level.<br>Ref: §5 SVC-004, §6 FR-3.3, §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/service_definitions_schema_recovery.sql:31-36<br>src/dblayer/recovery/services_schema_recovery.sql:8,22<br>src/routes/seu/core/serviceDefinitionWriteValidator.ts:25-53<br>src/dblayer/seed/data/schemaDefinitions.json:1919-1923,2005-2007</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: service_level is NOT NULL JSONB on both tables, and the write validator checks it against the Service grammar.<br>Gap: the Service grammar requires only code, name and capabilityCode (schemaDefinitions.json:1919-1923). serviceLevel is optional and has no minItems (:2005-2007), and an empty array satisfies NOT NULL. A Service Definition can be created with no Service Level. The services table declares DEFAULT '{}' (services_schema_recovery.sql:8).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Service definitions are versioned and immutable once published.<br>Ref: §5 SVC-005</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/serviceDefinitionsDB.ts:122-126<br>src/dblayer/servicesDB.ts:25-59</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: Service Definition content can be updated only while status is 'Defined'. A Pack change to a Service inserts a new version row and deactivates the old one.<br>Gap: updateStatus and addComment have no state guard. Rows in the materialised services table keep a status column that is never advanced after the 'Active' default, so no published/immutable state is enforced there.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Observed performance is derived by Engineering Telemetry and never written to the Service definition.<br>Ref: §5 SVC-006, §11, §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/servicesDB.ts:11-69<br>src/dblayer/runtimeTelemetryDB.ts<br>src/dblayer/servicesDB.ts:42-45</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: neither Service table has an observed-performance column and no code writes measurements to them. The only UPDATE and INSERT against services in src are in servicesDB.upsertFromPack (servicesDB.ts:42-45).<br>Gap: no Telemetry derivation compares delivery to a Service Level, so the derived side of the rule is absent.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Service has a globally unique identifier and a version.<br>Ref: §6 FR-3.1, §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/services_schema_recovery.sql:4,11,19-25<br>src/dblayer/recovery/service_definitions_schema_recovery.sql:4,15,25-27</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: UUID primary key and a TEXT version on both tables.<br>Gap: the business code is unique only per (originating_pack_id, code, version) on services and per (code, version, tenant_id) on service_definitions. The same Service code can exist under several Packs.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Service is declared by exactly one Capability through a Capability Pack.<br>Ref: §6 FR-3.2, §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/services_schema_recovery.sql:5,12<br>src/routes/seu/core/packs.ts:376-386,516-523</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: providing_capability_id is NOT NULL. Pack validation requires the Service's Capability to be declared in the same Pack.<br>Gap: originating_pack_id is nullable on services. The Capability is resolved from the pinned Service Definition's capability_code, not declared on the Pack's Service entry.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Dependency Engine references a specific Service when evaluating a Capability Dependency.<br>Ref: §6 FR-3.4, §9, §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:43-52<br>src/routes/seu/core/traceability.ts:141-146<br>src/routes/seu/core/seus.ts:323-337</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the Capability node name is a Service code. The engine finds the Service and then the SEU Capability that provides it.<br>Gap: the lookup uses servicesDB.findAll() and the first code match, with no Pack or tenant scope. The satisfaction state is the SEU Capability status, not whether the Service output was delivered.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Service publishes lifecycle and delivery events consumable by Engineering Telemetry.<br>Ref: §6 FR-3.5, §11, §14, §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1449-1525</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: Service Definition transitions carry event types ServiceDefined, ServicePublished, ServiceActivated, ServiceDeprecated and ServiceRetired, and version events.<br>Gap: those belong to Service Definition authoring. No event is emitted from the materialised Service. Telemetry does not consume them. See the event rows below.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Service supports concurrent consumption by multiple Capabilities or external interactions.<br>Ref: §6 FR-3.6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/service_definitions_schema_recovery.sql:14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">consumers is a TEXT[] on the Service Definition, and it is validated against Capability names. No runtime consumption record, request or concurrency handling exists for Services.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Service contracts remain independent of Participant implementation.<br>Ref: §6 FR-3.7, §10, §15, §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dispatchEngine.ts:13-19,118-119<br>src/dblayer/servicesDB.ts:71-79</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Dispatch reads the Service Level turnaround through the providing Capability and picks the Participant separately. The Service tables hold no Participant reference.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Service defines Identifier, Name, Providing Capability, Contract Description, Service Level, Version and Originating Pack.<br>Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/services_schema_recovery.sql:3-14,15-25</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">services carries id, code, name, providing_capability_id, contract_description, service_level, version and originating_pack_id.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Service lists Consuming Capabilities where known.<br>Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/service_definitions_schema_recovery.sql:14<br>src/routes/seu/core/serviceDefinitions.ts:57-63</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: consumers is stored and validated against capability-name on the Service Definition.<br>Gap: the materialised services table has no consumers column, and servicesDB.upsertFromPack does not copy it.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Service Level may specify turnaround, quality bar, availability and exceptions or waivers.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:176-182<br>src/domain/engine/dispatchEngine.ts:13-19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: a Service Level is a list of {code, label, target_level, target, units}. Dispatch uses a label matching 'turnaround'.<br>Gap: no typed support exists for acceptance criteria, availability or waivers. Everything is a numeric target.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Service Level is part of the Service's own versioned definition from the declaring Pack.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:376-398,524-538</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Pack pins a Service Definition version and may override targets for declared Service Level codes only. The merged level is stored with the new service version.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Service Level states the expectation and does not measure it.<br>Ref: §8, §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:176-182<br>src/domain/engine/dispatchEngine.ts:13-19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the Service Level only holds targets. Dispatch uses the turnaround target as an SLA.<br>Gap: no Telemetry component compares delivery to the declared level.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Capability exposes one Service while the Fulfilment pool and Dispatch choose the delivering Participant. The Participant may change without altering the Service.<br>Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:33-38<br>src/domain/engine/dispatchEngine.ts:13-19<br>src/dblayer/capabilityFulfilmentsDB.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: eligibility and dispatch are separate engines and never write to services.<br>Gap: dispatch resolves Services per Capability, not per specific Service. A Work Item is not tied to a Service.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Telemetry compares delivery to the Service Level and decides met or breached.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/runtimeTelemetryDB.ts<br>src/dblayer/metricDefinitionsDB.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: metric definitions and runtime telemetry tables exist.<br>Gap: no metric or derivation refers to a Service Level, and ServiceLevelMet and ServiceLevelBreached are never produced. Events and Lifecycles.md lists these as out of scope.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Several Packs may each contribute Services for the same Capability.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/services_schema_recovery.sql:25-28<br>src/dblayer/servicesDB.ts:71-79</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the unique key is per Pack, so two Packs can contribute the same Capability. findByCapabilityId returns every active Service.<br>Gap: the effective set is only a list. No composed view of Services per Capability exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition is deterministic and conflicting Service declarations resolve through the Composition Engine rules.<br>Ref: §12, §15, §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">compositionEngine.ts has no reference to Services. Two Packs can declare the same Service code with different levels and both stay active. dependencyDefinitionEngine picks the first match by code without a rule.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Service lifecycle runs Defined, Published, Active, Deprecated, Retired, Archived.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1449-1525<br>src/domain/engine/entityAdapters.ts:77-100<br>src/dblayer/recovery/services_schema_recovery.sql:9-10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: Service Definition has all six states plus an extra Validated step, with manual transitions and version events.<br>Gap: the materialised services row has the same CHECK values but defaults to 'Active' and no code transitions it.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deprecation identifies a replacement Service where one exists.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1499-1505</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Active to Deprecated transition has no replacement field. The Service Definition table has parent_service_definition_id for inheritance only. Neither table has a replaced-by column.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Historical Service versions remain available for reconstructing past dependency evaluations.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/servicesDB.ts:41-59<br>src/dblayer/serviceDefinitionsDB.ts:167-177</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: old versions stay as inactive rows, and Service Definitions are found by code and version.<br>Gap: dependency evaluations do not record the Service version, so a past evaluation cannot be linked to the version used.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The subsystem publishes ServiceDefined, ServicePublished, ServiceActivated, ServiceDeprecated and ServiceRetired.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1449-1525<br>src/domain/engine/entityTransition.ts:83-93</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: each of the five transitions has an event_type and the transition engine publishes through the event bus.<br>Gap: they are authoring events on Service Definition. A Pack-materialised Service emits none.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The subsystem publishes ServiceRequested, ServiceDelivered, ServiceLevelMet and ServiceLevelBreached.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No implementation found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No code produces these four events. Events and Lifecycles.md marks them as execution-side and out of scope.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Service traceability runs to the providing Capability and originating Pack.<br>Ref: §2, §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/services.ts:16-32<br>src/routes/seu/core/traceability.ts:141-146</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: listServices returns the providing Capability code and name. The row stores originating_pack_id.<br>Gap: the Pack is not returned by listServices or shown in traceability.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Service domain model and registry are provided.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/serviceDefinitionsDB.ts:9-248<br>src/dblayer/servicesDB.ts:10-100<br>src/routes/seu/web/serviceDefinitionRegistry.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Two registries exist. The Service Definition registry holds the authored catalogue with lifecycle. The services table holds the Pack-materialised Services.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Service contract validation service is provided.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/serviceDefinitionWriteValidator.ts:25-53<br>src/routes/seu/core/serviceDefinitions.ts:32-91</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Validation covers the schema grammar, Ontology fields, canonical names, consumers, inputs, outputs and inheritance.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Service Level declaration framework and Service APIs are provided.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:176-182<br>src/routes/seu/core/services.ts:16-32<br>src/dblayer/seed/data/routeAuthority.json:416,1676,1685</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: a typed ServiceLevelExpectation, a list API at /aisworg/api/seu/services and web routes for the registry and copy. All have route_authority rows.<br>Gap: the API is list only. No read-by-id, create or transition API exists for Services.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Service composition service is provided.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No implementation found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Service composition is only the per-Pack upsert in packs.ts. No separate service composes the effective Service set.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Service events are provided as a deliverable.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No implementation found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">See the two event rows above.</td>
    </tr>
  </tbody>
</table>

## Summary

- Total intents analysed: 32
- Fully met: 8
- Partially met: 18
- Not met: 6
- Not verifiable: 0

Major implementation gaps:

- A Service can be created without a Service Level, because the Service grammar does not require serviceLevel (SVC-004).
- No Service delivery events (ServiceRequested, ServiceDelivered, ServiceLevelMet, ServiceLevelBreached) and no Telemetry comparison against Service Levels.
- No Service composition rule or conflict resolution across Packs.
- Dependency lookup by Service code is unscoped and checks the SEU Capability status.
- No replacement Service on deprecation.
- Materialised Service rows never leave the default Active status.
- No runtime consumption model for concurrent consumers.
