# Implementation Traceability: Chapter 39 – SEU Design Kit (SDK) Architecture

**Date of report: 23-10-2026**

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK gives Platform Core and Elements developers a stable contract.<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/schemaRegistry.ts:99-140<br>src/policies/validateSchema.ts:8-27<br>src/dblayer/schemaDefinitionsDB.ts:6-26</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each schema version is a new row (version = highest + 1). No function updates the schema column of an existing row.<br>An Element row pins its schema_definition_id and is validated against that exact version, so a later schema version never changes the meaning of existing content.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Engineering behaviour, governance, domain capability and customisation are introduced through SDK Elements, not Runtime Kernel changes.<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/sdk/schemaCompiler.ts:3-8<br>src/domain/sdk/formGenerator.ts:167-287<br>src/policies/index.ts:16-22<br>src/actions/index.ts:25-34</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: a new field on any of the 7 authorable kinds is a new schema_definitions row, with no code change, provided it uses an existing widget kind.<br>Gap: a new widget kind needs code in formGenerator.ts and schemaCompiler.ts. A new implemented Policy and a new transition Action need code entries in the two fixed registries.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SDK is the sole supported mechanism for creating production Schemas.<br> Ref: §3 Architectural Position</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/schemaRegistry.ts:18,99-140<br>src/routes/seu/web/schemaRegistry.ts:129-144<br>src/dblayer/seed/seedSchemaDefinitions.ts:32-49<br>src/dblayer/recovery/schema_definitions_schema_recovery.sql:11-13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: createSchemaVersion is the only runtime path that writes schema_definitions; it is reached from the Schema Registry publish route.<br>Gap: the baseline rows are written by db:clean-slate through bulkInsert, outside that path. The entity_kind CHECK admits TransitionDefinition, but SCHEMA_ENTITY_KINDS and SCHEMA_KINDS exclude it, so that kind has a seeded v1 schema and no SDK path to a new version.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Elements flow from the SDK through an Element Package and Element Registry to the Composition Engine, the Engineering Behavior Model and the Runtime Kernel.<br> Ref: §3 Architectural Position</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/templates.ts:211-221<br>src/routes/seu/core/commissioning.ts:474-480<br>src/routes/seu/core/sdkAuthoring.ts:1161-1253</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: published Elements are Active rows in their own tables, which act as the registry. Template capability derivation reads Active Pack rows, and commissioning calls compositionEngine.merge.<br>Gap: there is no Element Package stage between the SDK and the registry (see §11).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SDK is a development framework for versioned, declarative Elements that conform to platform standards.<br> Ref: §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/sdkAuthoring.ts:686-1010<br>src/domain/sdk/formGenerator.ts:167-287<br>src/utils/version.ts:4-6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Elements are authored as schema-driven forms, stored as declarative rows with a semver version, and validated against the pinned schema.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SDK provides authoring support.<br> Ref: §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/sdkAuthoring.ts:686-1010,1012-1153<br>src/domain/sdk/schemaCompiler.ts:427-445,525-537<br>src/routes/seu/web/schemaRegistry.ts:42-65</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Forms are generated from the pinned schema for all 7 kinds. The Schema Registry page edits a schema as a widget tree and converts it to and from JSON Schema.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SDK provides schema validation, dependency validation, testing tools, packaging tools and publishing tools.<br> Ref: §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/schemaRegistry.ts:32-56,84-97<br>src/policies/validateSchema.ts:8-27</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: schema validation and publishing. Dependency validation exists per kind (see FR-39.3).<br>Gap: the Tested and Packaged states are reached by automatic hops that run no test and build no package (see FR-39.5 and FR-39.6).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SDK defines how Elements are produced and does not define what Elements contain.<br> Ref: §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/sdk/formGenerator.ts:167-287<br>src/domain/sdk/formGenerator.ts:433-452</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: generateFields and validateAgainstSchema take any schema document and name no element kind.<br>Gap: formGenerator.ts holds Pack-specific text (CONTRIBUTION_SECTION_HELP for contributionCapabilities, contributionServices, contributionPolicies and others), so one part of the SDK code knows Pack content.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK-001: Every production Platform Element is created using the SDK.<br> Ref: §5 SDK-001</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/sdkAuthoring.ts:686-1010<br>src/dblayer/seed/seedCapabilityDefinitions.ts:42<br>src/dblayer/seed/seedServiceDefinitions.ts:73<br>src/dblayer/seed/seedCapabilityPatternPacks.ts:192</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: all 7 kinds are created through createAuthoringDraft against a pinned schema, and seeded Packs go through publishPack, which also pins the latest schema.<br>Gap: baseline Capability and Service Definitions are written by seed scripts that only look up the latest schema, outside the authoring pipeline. Transition Definitions are authored on their own page, outside the schema registry.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK-002: The SDK remains independent of the Runtime Kernel implementation.<br> Ref: §5 SDK-002</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/sdk/formGenerator.ts:1-44<br>src/domain/sdk/schemaCompiler.ts:540-614<br>src/routes/seu/core/schemaRegistry.ts:6-10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: formGenerator.ts and schemaCompiler.ts work on plain JSON and import no kernel module.<br>Gap: schemaRegistry.ts imports transitionEngine, entityTransition, eventBus and transitionDefinitionsDB, and validateSchema.ts reads through the kernel entity adapters. Schema creation cannot run without the kernel.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK-003: SDK outputs are deterministic.<br> Ref: §5 SDK-003</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/sdk/schemaCompiler.ts:427-445,609-614<br>tests/schema-registry-widget-tree.test.ts:48-60</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">widgetTreeToJsonSchema and diffSchemaVersions are pure functions with no date, random or id source. A test round-trips each seeded baseline schema through the widget tree without loss.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK-004: The SDK validates before publication.<br> Ref: §5 SDK-004</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:935-960<br>src/policies/validateSchema.ts:8-27<br>src/routes/seu/core/schemaRegistry.ts:99-102<br>src/dblayer/seed/data/transitionDefinitions.json:1727-1786</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the Draft to Validated and Validated to Published hops of Pack, Template, Profile, Deliverable, Service, Capability and Policy require policy-validate-schema, so an invalid Element cannot be published. A new schema must parse as a JSON object before its row is born.<br>Gap: the Validated and Tested hops of a SchemaDefinition declare no policy and no action, so a schema reaches Packaged after only the JSON shape check.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK-005: The SDK supports automation.<br> Ref: §5 SDK-005</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/pack-sdk-cli.ts:1-2<br>package.json:12-13<br>src/routes/seu/api/packs.ts:59-64</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the core functions (createAuthoringDraft, publishAuthoringDraft, createSchemaVersion, publishPack) are exported, and Pack lifecycle transitions have API routes.<br>Gap: pack:validate and pack:publish point at pack-sdk-cli.ts, which is an empty file (2 bytes), so both commands do nothing. No API route creates or edits an Element or a schema.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK-006: The SDK evolves independently of the Runtime Kernel.<br> Ref: §5 SDK-006</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/schemaDefinitions.json<br>src/routes/seu/core/schemaRegistry.ts:99-140</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: SDK grammar changes ship as schema_definitions rows, with no kernel release.<br>Gap: the SDK code and the kernel are one deployable, and the SDK has no version of its own.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-39.1: The SDK provides Element widgets.<br> Ref: §6 FR-39.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/sdk/schemaCompiler.ts:3-8<br>src/domain/sdk/formGenerator.ts:64-75,167-287</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">8 top-level and 12 item widget kinds are defined. generateFields renders json, referential-list, referential-select, referential-multi-select, db-select, textarea and version widgets, with nested lists and objects.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-39.2: The SDK validates Element schema definitions.<br> Ref: §6 FR-39.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/schemaRegistry.ts:32-56<br>src/routes/seu/web/schemaRegistry.ts:92-127</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: a schema must be a JSON object, its properties must be an object, and its entity kind must be one of the 7. The widget form coerces an unknown widget kind to text (schemaCompiler.ts:465-466).<br>Gap: nothing checks that required names exist in properties, that referential sources resolve, or that widget names are unique, and widgetTreeToJsonSchema silently overwrites a repeated name. The raw schemaJson path (web/schemaRegistry.ts:98-101) accepts any x-widget value.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-39.3: The SDK validates Element dependencies.<br> Ref: §6 FR-39.3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:399-405<br>src/routes/seu/core/templates.ts:236-275,296-322,338-341<br>src/routes/seu/core/profiles.ts:219-245<br>src/domain/engine/profileCompositionUnravel.ts:362-368</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: Template validation checks every dependencyGraph endpoint and rejects cycles. Profile validation resolves its base Template and Pack codes. A Pack resolves each required dependency by code. Composition flags unsatisfied required and violated incompatible dependencies.<br>Gap: Pack validation ignores the declared dependency version and does not check optional, conditional or incompatible dependencies.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-39.4: The SDK validates compatibility declarations.<br> Ref: §6 FR-39.4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:107-110,142-408</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: a Pack stores supportedPlatformVersion, minSupportedPlatformVersion, maxSupportedPlatformVersion and incompatiblePackVersions as free text. validatePackSeed never reads them and no other code compares them with a platform version or another Pack version.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-39.5: The SDK supports automated testing.<br> Ref: §6 FR-39.5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">package.json:21,25<br>src/dblayer/seed/data/transitionDefinitions.json:1747-1756</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the repository has an automated node:test suite with fixtures.<br>Gap: that suite tests the platform. The SDK offers no way to run tests on an Element or schema a developer authors, and the Validated to Tested hop declares no policy or action.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-39.6: The SDK packages an Element into a deployable artefact.<br> Ref: §6 FR-39.6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1757-1766<br>src/routes/seu/core/sdkAuthoring.ts:1161-1253</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: Pack, Template, Profile, Deliverable, Service, Capability and Policy rows are published in place. No package, manifest or export is produced for any of them.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-39.7: The SDK supports publishing to Element Registries.<br> Ref: §6 FR-39.7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/web/schemaRegistry.ts:146-164<br>src/dblayer/seed/data/transitionDefinitions.json:1767-1776<br>src/dblayer/schemaDefinitionsDB.ts:52-63<br>src/routes/seu/core/packs.ts:147,421<br>src/routes/seu/web/sdkAuthoring.ts:553-556</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: Packaged to Published is a governed, badge-gated, event-publishing hop. Elements are published by transition in their own tables.<br>Gap: findLatest has no lifecycle_state filter, and validatePackSeed and createPackDraft call it. A schema is used by new forms and validation as soon as it is Created, and a PublicationRejected schema stays in use. Publishing changes no behaviour.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Schema Generator: creates Element Schemas using standard layouts.<br> Ref: §7 Schema Generator</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/sdk/schemaCompiler.ts:91-93,427-445,525-537<br>src/routes/seu/web/schemaRegistry.ts:42-65,92-109</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A new schema version starts from the latest version of the kind and is built from groups, notes and typed widgets, then compiled to JSON Schema.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Schema Validator: validates declarative Element Schema definitions.<br> Ref: §7 Schema Validator</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/schemaRegistry.ts:32-56<br>src/domain/sdk/formGenerator.ts:494-541</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: structural check of a schema (FR-39.2) and validation of Element content against a schema (required, enum, pattern, minLength, referential-list rows).<br>Gap: the schema definition itself receives only the shallow check.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Dependency Validator: ensures dependency consistency.<br> Ref: §7 Dependency Validator</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/templates.ts:236-275<br>src/routes/seu/core/packs.ts:399-405</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same finding as FR-39.3. Template has graph and cycle checks. Pack has an existence check for required dependencies only.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Compatibility Validator: checks a new schema against the existing Element Schema versions.<br> Ref: §7 Compatibility Validator</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/schemaRegistry.ts:64-70,99-116<br>src/domain/sdk/schemaCompiler.ts:540-614<br>tests/schema-compatibility.test.ts:15-95</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">diffSchemaVersions classifies removals, type changes, newly required fields and other changes as breaking or not, recursing into nested objects and list items. The result is stored as compatible_versions and incompatible_versions and shown at review.<br>Note: the stored lists are display data. instancesCompatible (schemaDefinitionsDB.ts:88-100) has no caller, and publishing is not blocked by an incompatible result.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Compatibility Validator: checks compatibility against platform versions.<br> Ref: §7 Compatibility Validator</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:107-110</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: no platform version exists in the code to compare against, and the Pack platform-version fields are never read.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Test Framework: executes Element Schema validation tests.<br> Ref: §7 Test Framework</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1747-1756<br>src/routes/seu/core/schemaRegistry.ts:84-97</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: the Tested state is entered by autoAdvanceGoverned, which follows the next governed hop. No test is run and no result is recorded.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Packaging Service: creates immutable Element Schema artefacts.<br> Ref: §7 Packaging Service</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1757-1766<br>src/routes/seu/core/schemaRegistry.ts:84-97</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: the Packaged state is reached by the same automatic hop, with no policy and no action. Nothing is built, signed or exported. The schema row exists from creation and is unchanged by the hop.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Publishing Service: publishes validated Element Schemas to authorised registries.<br> Ref: §7 Publishing Service</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/web/schemaRegistry.ts:146-164<br>src/dblayer/seed/data/routeAuthority.json:1612-1673<br>tests/schema-definition-event-lifecycle-table.test.ts:184-196</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: publish and reject are manual hops that need the schemadefinition_publish or schemadefinition_reject badge and the sdk_author role, enforced by the transition engine and route_authority. A denied actor leaves the row Packaged.<br>Gap: there is one registry, and publication does not gate use (see FR-39.7).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An SDK element is a versioned, declarative package that contributes engineering behaviour or metadata.<br> Ref: §8 SDK Elements Taxonomy</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/sdkAuthoring.ts:686-1010<br>src/utils/version.ts:4-6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: Elements are versioned and declarative.<br>Gap: they are rows in 7 separate tables. No package form exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SDK is responsible for Element discovery.<br> Ref: §8 SDK Elements Taxonomy</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/sdkAuthoring.ts:390-421<br>src/routes/seu/web/sdkAuthoring.ts:154</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">listTenantAuthoringRows lists the rows of each kind, scoped to the viewer's tenant and the platform tenant.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SDK is responsible for validation.<br> Ref: §8 SDK Elements Taxonomy</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/policies/validateSchema.ts:8-27<br>src/routes/seu/core/sdkAuthoring.ts:333-342</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">See §9. The UI path validates against the schema and Ontology only.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SDK is responsible for dependency management.<br> Ref: §8 SDK Elements Taxonomy</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/templates.ts:236-275<br>src/routes/seu/core/packs.ts:399-405</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">See FR-39.3. Dependencies are checked, and nothing resolves or installs them.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SDK is responsible for version compatibility.<br> Ref: §8 SDK Elements Taxonomy</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/schemaRegistry.ts:64-70<br>src/dblayer/schemaDefinitionsDB.ts:88-100</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Schema versions are compared and the result is stored. Element versions are not compared with each other or with the platform (see FR-39.4).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SDK is responsible for composition.<br> Ref: §8 SDK Elements Taxonomy</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/sdkAuthoring.ts:1259-1337</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: composeAuthoringDraft applies specialization, merge, union, intersection, supplement and override to a Pack Draft through compositionEngine.<br>Gap: line 1260 returns an error for every other kind.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SDK is responsible for activation.<br> Ref: §8 SDK Elements Taxonomy</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:444-458<br>src/routes/seu/core/templates.ts:508-519<br>src/routes/seu/core/profiles.ts:413-424</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Activation moves a version to Active through the generic transition and retires or deprecates the version it replaces.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SDK is responsible for lifecycle management.<br> Ref: §8 SDK Elements Taxonomy</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/sdkAuthoring.ts:469-485,1161-1253</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Row actions are computed from transition definitions and the held badges. Each action is a governed transition with a real actor and badge.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Runtime Kernel consumes the composed result through the Engineering Behavior Model.<br> Ref: §8 SDK Elements Taxonomy</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:474-480</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Commissioning composes the selected Packs with compositionEngine. The EBM chapter has its own traceability report. Only the SDK-side hand-off is cited here.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Validation covers manifest correctness.<br> Ref: §9 Validation</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:145,161-162<br>src/policies/validateSchema.ts:8-27<br>src/routes/seu/core/sdkAuthoring.ts:333-342,686-720</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: identity metadata (name, code, semver version) is checked by the schema's required and pattern rules at Draft to Validated, and by validatePackSeed.<br>Gap: validatePackSeed runs only inside createPackDraft (publishPack, seeds, tests). createAuthoringDraft and saveAuthoringDraft for Pack never call it. validateAuthoredContent, which dispatches to the per-kind validators, has no caller.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Validation covers schema compliance.<br> Ref: §9 Validation</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/policies/validateSchema.ts:8-27<br>src/domain/sdk/formGenerator.ts:494-541<br>src/dblayer/seed/data/transitionDefinitions.json:935-960</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The pinned schema is applied to the stored content, then Ontology fields and referential fields are checked. A false result blocks both the Validated and the Published hops.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Validation covers the dependency graph.<br> Ref: §9 Validation</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/templates.ts:236-275,338-341<br>src/routes/seu/core/packs.ts:399-405</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">See FR-39.3. The graph and cycle check is Template only.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Validation covers compatibility rules.<br> Ref: §9 Validation</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/schemaRegistry.ts:64-70<br>src/routes/seu/core/packs.ts:107-110</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Schema compatibility is computed. Element compatibility rules are not validated (see FR-39.4).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Validation covers duplicate identifiers.<br> Ref: §9 Validation</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:193-223,265,274,329<br>src/dblayer/recovery/packs_schema_recovery.sql:26<br>src/dblayer/recovery/schema_definitions_schema_recovery.sql:9<br>tests/pack-sdk.test.ts:224-233</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: validatePackSeed rejects duplicate capability, service, authority rule, policy, quality gate, review gate, checklist and obligation codes. The database enforces UNIQUE (code, pack_version, tenant) for Packs and UNIQUE (entity_kind, version) for schemas.<br>Gap: the Pack code checks are in the validatePackSeed path only. A schema with a repeated widget name is not rejected.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Validation covers semantic integrity.<br> Ref: §9 Validation</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/policies/validateSchema.ts:22-26<br>src/routes/seu/core/packs.ts:225-251,288-313,377-397</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: Ontology values and referential fields are checked at each hop. validatePackSeed also checks quality gate transitions, policy resolution and service-to-capability alignment.<br>Gap: those Pack checks run only through the validatePackSeed path (see manifest correctness).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Validation covers required metadata.<br> Ref: §9 Validation</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/sdk/formGenerator.ts:494-499<br>src/policies/validateSchema.ts:8-27</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Fields listed in the schema's required array must be non-empty before the Validated hop passes.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Validation fails before packaging if errors are detected.<br> Ref: §9 Validation</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/schemaRegistry.ts:99-102<br>src/domain/engine/entityTransition.ts:47-50</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: an invalid schema is rejected before its row exists, and an Element that fails validation cannot leave Draft.<br>Gap: no Element packaging step exists, and the schema Packaged hop does not depend on any validation result.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SDK supports schema tests.<br> Ref: §10 Testing</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">tests/schema-registry.test.ts:28-109<br>tests/schema-registry-widget-tree.test.ts:48-60<br>tests/formGenerator.test.ts:44-107</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: tests cover schema versioning, widget-tree round-trip and form parsing.<br>Gap: these test the SDK itself. A developer cannot run schema tests on a schema they author.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SDK supports composition tests.<br> Ref: §10 Testing</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">tests/pack-sdk.test.ts:318-464<br>tests/pack-composition.test.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Tests drive compositionEngine through Pack publication. There is no SDK facility that runs composition tests on an authored Element.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SDK supports compatibility tests.<br> Ref: §10 Testing</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">tests/schema-compatibility.test.ts:15-95</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Ten pure unit tests cover diffSchemaVersions. There is no facility to test Element compatibility.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SDK supports regression tests.<br> Ref: §10 Testing</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">package.json:21,25</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: the repository suite can be rerun, but the SDK has no regression-test feature or stored baseline for authored Elements.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SDK supports example execution tests.<br> Ref: §10 Testing</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/schemaDefinitions.json</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: reference schemas and sample Pack data exist. No SDK feature executes an example Element and checks its outcome.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Tests execute independently of the Runtime Kernel.<br> Ref: §10 Testing</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">tests/schema-compatibility.test.ts:1-13<br>tests/schema-registry.test.ts:99-109<br>tests/pack-sdk.test.ts:75-119</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: schema-compatibility.test.ts and the formGenerator tests are pure and use no database.<br>Gap: schema-registry, schema-definition-event-lifecycle-table, sdk-authoring and pack-sdk tests need a live database, the transition engine and seeded transition definitions.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Packaging produces an immutable schema artefact.<br> Ref: §11 Packaging</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/schemaDefinitionsDB.ts:6-40<br>src/dblayer/recovery/schema_definitions_schema_recovery.sql:3-26</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the schema column is written once, and the only update function is advanceLifecycle.<br>Gap: no database trigger or constraint prevents an update. advanceLifecycle overwrites author_id and author_badge at every hop, so the creator record is replaced by the last actor.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The artefact contains declarative definitions.<br> Ref: §11 Packaging</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/schema_definitions_schema_recovery.sql:7<br>src/routes/seu/core/schemaRegistry.ts:111-120</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The schema JSONB column holds the full definition.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The artefact contains metadata.<br> Ref: §11 Packaging</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/schema_definitions_schema_recovery.sql:5-8,17-20</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The row records entity_kind, created_at, lifecycle_state, author_id and author_badge. It has no name, description, owner or publisher field.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The artefact contains documentation.<br> Ref: §11 Packaging</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/sdk/schemaCompiler.ts:10-14,122-132<br>src/domain/sdk/formGenerator.ts:7,31,43</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Field help (x-help) and dated notes (x-schema-notes) are stored inside the schema JSON. No separate documentation document is built.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The artefact contains a digital signature.<br> Ref: §11 Packaging</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/schema_definitions_schema_recovery.sql:3-26</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: the table has no signature or hash column. A search of src for signature, checksum, sha256 and createHash found no signing code.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The artefact contains version information.<br> Ref: §11 Packaging</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/schema_definitions_schema_recovery.sql:6,9<br>src/routes/seu/core/schemaRegistry.ts:104-105</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">version is an integer unique per kind, assigned as the highest existing version plus one.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The artefact contains compatibility declarations.<br> Ref: §11 Packaging</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/schema_definitions_schema_recovery.sql:14-16<br>src/routes/seu/core/schemaRegistry.ts:106-107,115-116</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">compatible_versions and incompatible_versions are written with every new version.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Packaging is deterministic.<br> Ref: §11 Packaging</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/sdk/schemaCompiler.ts:427-445<br>src/routes/seu/core/schemaRegistry.ts:84-97</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The schema content is deterministic. The Packaged hop transforms nothing, so determinism of a packaging step is trivially true and not demonstrated.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Publishing verifies Schema signatures.<br> Ref: §12 Publishing</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1767-1776</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: the publish hop declares no policy. No signature exists to verify.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Publishing validates permissions.<br> Ref: §12 Publishing</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/web/schemaRegistry.ts:146-164<br>src/dblayer/seed/data/routeAuthority.json:1612-1673<br>tests/schema-definition-event-lifecycle-table.test.ts:118-127,184-196</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The route needs the sdk_author role. The transition engine resolves the schemadefinition_publish or _reject badge for the actor and refuses without it. Tests cover the denied case.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Publishing enforces versioning rules.<br> Ref: §12 Publishing</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/schemaRegistry.ts:104-105<br>src/dblayer/recovery/schema_definitions_schema_recovery.sql:9<br>src/utils/version.ts:4-6<br>tests/pack-sdk.test.ts:224-233</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Schema versions increase by one and are unique. Element versions must be semver. Republishing the same (code, version, tenant) is rejected and the existing row is untouched.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Publishing updates registry metadata.<br> Ref: §12 Publishing</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/schemaDefinitionsDB.ts:28-40<br>src/domain/engine/entityAdapters.ts:44-57</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The hop sets lifecycle_state and the actor's badge on the registry row and publishes SDKElementSchemaPublished.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Publishing publishes Schema documentation.<br> Ref: §12 Publishing</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/web/docs.ts:15-60</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: the /docs route serves the repository markdown manual. Publishing a schema generates and publishes no documentation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Publishing does not modify Schema contents.<br> Ref: §12 Publishing</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/schemaDefinitionsDB.ts:28-40<br>src/domain/engine/entityAdapters.ts:44-57</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The publish hop runs advanceLifecycle, which updates only lifecycle_state, author_badge and author_id.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SDK supports extension through validators.<br> Ref: §13 SDK Extensibility</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/sdkAuthoring.ts:333-342<br>src/policies/index.ts:16-22</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: the per-kind validators are a fixed if-chain, and implemented Policies are a fixed code registry. No registration point exists for an external validator.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SDK supports extension through project templates.<br> Ref: §13 SDK Extensibility</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/sdkAuthoring.ts:564-660</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: authoring can start from an existing Template, Profile or Pack version. That is content inheritance, not an SDK project-template extension point.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SDK supports extension through testing modules.<br> Ref: §13 SDK Extensibility</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1747-1756</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: no mechanism registers a testing module. The Tested hop has no hook.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SDK supports extension through packaging plugins.<br> Ref: §13 SDK Extensibility</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1757-1766</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: no packaging plugin mechanism exists, and no packaging step exists to extend.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SDK supports extension through publishing targets.<br> Ref: §13 SDK Extensibility</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/entityAdapters.ts:44-57</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: publication writes to fixed database tables. No target interface exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❓</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK extensions do not modify SDK core behaviour.<br> Ref: §13 SDK Extensibility</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No extension mechanism exists, so the constraint has nothing to apply to.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SDK preserves version.<br> Ref: §14 Traceability</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/schema_definitions_schema_recovery.sql:6,9<br>src/routes/seu/core/packs.ts:421-424<br>src/policies/validateSchema.ts:13-19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every schema version is kept. Each Element row records the schema_definition_id it was authored against, and validation resolves that exact version.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SDK preserves validation results.<br> Ref: §14 Traceability</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/policies/validateSchema.ts:8-27</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: validateSchema returns a boolean to the transition gate. Neither the boolean nor the error list is stored.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SDK preserves test results.<br> Ref: §14 Traceability</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1747-1756</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: the Tested hop produces no result, and no table stores one.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SDK preserves publishing history.<br> Ref: §14 Traceability</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/eventBus.ts:67-76<br>tests/schema-definition-event-lifecycle-table.test.ts:128-170</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each hop appends an event with actor and authority badge. Tests assert the full event sequence for a published and for a rejected schema.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SDK preserves digital signatures.<br> Ref: §14 Traceability</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/schema_definitions_schema_recovery.sql:3-26</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: no signature is created, so none is stored.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every published Schema is reproducible.<br> Ref: §14 Traceability</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/schemaDefinitionsDB.ts:6-40<br>tests/schema-registry-widget-tree.test.ts:48-60</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the stored schema is returned unchanged and rebuilds to the same widget tree.<br>Gap: no hash or signature lets a consumer confirm that a retrieved schema matches the one that was published.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SDK publishes SDKElementSchemaCreated.<br> Ref: §15 Events</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1727-1736<br>src/routes/seu/core/schemaRegistry.ts:123-136<br>tests/schema-definition-event-lifecycle-table.test.ts:128-140</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">createSchemaVersion publishes the birth event with the actor and the birth badge after the row is written.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SDK publishes SDKElementSchemaValidated.<br> Ref: §15 Events</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1737-1746<br>src/routes/seu/core/schemaRegistry.ts:84-97</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the event is published for the Created to Validated hop.<br>Gap: the hop is automatic and runs no validation, so the event does not report a validation outcome.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SDK publishes SDKElementSchemaTested.<br> Ref: §15 Events</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1747-1756<br>src/routes/seu/core/schemaRegistry.ts:84-97</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the event is published for the Validated to Tested hop.<br>Gap: no test runs, so the event does not report a test outcome.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SDK publishes SDKElementSchemaPackaged.<br> Ref: §15 Events</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1757-1766<br>src/routes/seu/core/schemaRegistry.ts:84-97</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the event is published for the Tested to Packaged hop.<br>Gap: no package is built.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SDK publishes SDKElementSchemaPublished.<br> Ref: §15 Events</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1767-1776<br>src/routes/seu/web/schemaRegistry.ts:156-158<br>tests/schema-definition-event-lifecycle-table.test.ts:142-157</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The manual Packaged to Published hop publishes the event through publishTransition with the actor and publish badge.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SDK publishes SDKElementSchemaPublicationRejected.<br> Ref: §15 Events</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1777-1786<br>src/routes/seu/web/schemaRegistry.ts:156-158<br>tests/schema-definition-event-lifecycle-table.test.ts:159-169</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The manual Packaged to PublicationRejected hop publishes the event with the reject badge.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SDK supports automated pipelines.<br> Ref: §16 Non-Functional</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/pack-sdk-cli.ts:1-2<br>package.json:12-13<br>src/routes/seu/api/packs.ts:59-64</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">See SDK-005. The CLI file is empty, and the API covers Pack transitions only.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SDK supports offline development.<br> Ref: §16 Non-Functional</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:142-147<br>src/routes/seu/core/schemaRegistry.ts:64-70</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: validation and schema versioning read Ontology, Pack and schema rows from the database, and creation needs the transition engine. Only the pure compiler and form functions run without a database.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SDK remains platform-independent.<br> Ref: §16 Non-Functional</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/sdk/formGenerator.ts:1-44<br>src/routes/seu/core/schemaRegistry.ts:6-10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same finding as SDK-002. The compiler is independent, the registry and validators are bound to the platform database and kernel.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SDK produces deterministic outputs.<br> Ref: §16 Non-Functional</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/sdk/schemaCompiler.ts:427-445,609-614</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same finding as SDK-003.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SDK supports future SDK versions.<br> Ref: §16 Non-Functional</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/policies/validateSchema.ts:13-19<br>src/routes/seu/core/schemaRegistry.ts:99-140</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: a new schema version never invalidates content pinned to an older one.<br>Gap: the SDK has no version identifier of its own.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: SDK Elements can be created using Element Schema.<br> Ref: §17 Acceptance Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/sdkAuthoring.ts:686-1010<br>tests/sdk-authoring.test.ts:287-324,548-596,776-800</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Tests create Active Pack, Template, Profile and Deliverable Definition rows through the authoring functions.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Validation detects structural and semantic errors.<br> Ref: §17 Acceptance Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/policies/validateSchema.ts:8-27<br>src/routes/seu/core/packs.ts:142-408<br>tests/sdk-authoring.test.ts:408-433</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Structural errors and unresolved references are detected at the Validated hop. The deeper Pack semantic checks do not run on the UI path.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Packaging is deterministic.<br> Ref: §17 Acceptance Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/schemaRegistry.ts:84-97</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No packaging output exists to be deterministic (see §11).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Published Schemas are reproducible.<br> Ref: §17 Acceptance Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/schemaDefinitionsDB.ts:6-40</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">See §14: stored unchanged, with no integrity check.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: SDK supports automated build pipelines.<br> Ref: §17 Acceptance Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/pack-sdk-cli.ts:1-2<br>package.json:12-13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: the only build commands run an empty file.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: SDK evolves independently of the Runtime Kernel.<br> Ref: §17 Acceptance Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/schemaDefinitions.json<br>src/routes/seu/core/schemaRegistry.ts:99-140</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">See SDK-006.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: SDK framework.<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/sdkAuthoring.ts:333-1337<br>src/domain/sdk/schemaCompiler.ts<br>src/domain/sdk/formGenerator.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A shared generator and compiler plus per-kind create, save, publish and list branches in one file. Each kind keeps its own validator and activation function.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Project generator.<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/sdk/schemaCompiler.ts:91-93<br>src/routes/seu/web/schemaRegistry.ts:42-65<br>src/routes/seu/core/sdkAuthoring.ts:564-660</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A new schema starts from the latest version of its kind, and a new Template, Profile or Pack version starts from an existing one. There is no scaffold for a new Element project.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Validation framework.<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/policies/validateSchema.ts:8-27<br>src/domain/sdk/formGenerator.ts:494-541</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Schema, Ontology and referential validation run through the transition gate. See §9 for the Pack gap.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Testing framework.<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1747-1756</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: see §7 Test Framework.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Packaging service.<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1757-1766</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: see §7 Packaging Service.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Publishing service.<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/web/schemaRegistry.ts:146-164<br>src/routes/seu/core/sdkAuthoring.ts:1161-1253</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">See §7 Publishing Service.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: SDK documentation.<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/docs/user-manual/01_SDK_Authoring.md:5-19,278-285<br>src/routes/seu/web/docs.ts:15-60</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Part 1 of the user manual covers authoring of every kind, the workflow, versions, composition and the Schema Registry, and the app serves it at /docs.<br>Note: line 285 of the manual says new forms use the new version immediately. That is true of the code, including for unpublished versions (see FR-39.7).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Reference schemas.<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/schemaDefinitions.json<br>src/dblayer/seed/seedSchemaDefinitions.ts:32-49<br>tests/schema-registry-widget-tree.test.ts:48-60</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Nine baseline schemas (Pack, Template, Profile, Deliverable, Service, Capability, Policy v1 and v2, TransitionDefinition) are seeded and round-trip through the widget tree.</td>
    </tr>
  </tbody>
</table>

## Summary

- **Total intents analysed**: 103
- **Fully met**: 28
- **Partially met**: 52
- **Not met**: 22
- **Not verifiable**: 1

**Major implementation gaps**:

1. The Validated, Tested and Packaged states of a SchemaDefinition are reached by automatic hops that declare no policy and no action. The events fire, and no validation, test or package is produced (§7, §11, §15).
2. A schema takes effect when it is created. `schemaDefinitionsDB.findLatest` ignores `lifecycle_state`, so Created, Packaged and PublicationRejected versions are used by new forms and validation (FR-39.7).
3. No digital signature, hash or artefact integrity check exists (§11, §12, §14).
4. No extension mechanism exists for validators, project templates, testing modules, packaging plugins or publishing targets (§13).
5. Element packaging does not exist. Elements are published in place in seven tables (FR-39.6).
6. `pack-sdk-cli.ts` is empty, so `pack:validate` and `pack:publish` do nothing (SDK-005, §16, §17).
7. The Pack authoring UI path does not call `validatePackSeed`, and `validateAuthoredContent` has no caller. Deeper Pack checks run only in `publishPack`, seeds and tests (§9).
8. Pack platform-version and incompatible-version declarations are stored and never validated (FR-39.4, §7).
9. Schema validation is a shallow shape check. Unknown widget kinds, unknown required names and repeated widget names are accepted (FR-39.2).
10. The SDK tests need a live database and the kernel, except two pure suites (§10).
11. `validationResults` and `testResults` are not preserved (§14).
