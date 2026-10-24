# Implementation Traceability: Chapter 38 – Pack SDK Architecture

**Date of report: 23-10-2026**

Specification: src/docs/SEU Studio Specifications/06_Platform Architectire/38_Pack Architecture.md

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">All engineering behaviour, governance and domain capability is introduced as Pack data rather than Runtime Kernel changes.<br>Ref: §1 Purpose, PP-006</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:417-441<br>src/routes/seu/core/packs.ts:499-647<br>src/domain/engine/profileCompositionUnravel.ts:204-265</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Pack is created as a schema-validated row. Its contributions (Capabilities, Services, Authority Rules, Policies, Checklists, Review Gates, Quality Gates) are materialised as rows by materializeContributions. Composition reads those rows through the pool. No kernel code changes when a Pack is added.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The flow is Platform Core, Pack SDK, Pack Registry, Pack Composition, Runtime Kernel, SEU, with each layer as a distinct stage.<br>Ref: §3 Architectural Position</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:417-485<br>src/dblayer/packsDB.ts:8-338<br>src/domain/engine/profileCompositionUnravel.ts:104-273<br>src/domain/engine/compositionCompleted.ts:47-92</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Authoring and validation (packs.ts), storage and lookup (packsDB.ts), composition (unravelComposition) and EBM creation (compositionCompleted.ts) exist as separate modules in that order.<br>Gap:<br>There is no separate Pack SDK or Pack Registry component. The dashboard lists Extension Registry as deferred (src/routes/seu/core/dashboard.ts:41-44).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Pack is a versioned declarative package that contributes engineering behaviour or metadata.<br>Ref: §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/packs_schema_recovery.sql:3-27<br>src/dblayer/packsDB.ts:72-126</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The packs table holds only definition fields: code, name, category, pack_version, status, contributions, dependencies, composition_sources, metadata. Content can change only while status is Draft (updateDraftContent WHERE status = 'Draft').</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Pack SDK performs Pack discovery.<br>Ref: §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/web/packs.ts:14-47<br>src/routes/seu/core/packs.ts:702-710</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The Packs page lists every Pack visible to the tenant with search, sort and category and status filters.<br>Gap:<br>Discovery is a list of rows already in the packs table. No mechanism discovers Packs from an external source (dashboard.ts:41 states that Packs are seeded at deploy time).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Pack SDK validates a Pack.<br>Ref: §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:142-408<br>src/routes/seu/core/packWriteValidator.ts:23-50<br>src/dblayer/packsDB.ts:25-39<br>src/policies/validateSchema.ts:8-27</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">validatePackSeed checks the schema grammar, Ontology values, semantic version, composition strategy arity, duplicate codes, quality gate, review gate, checklist, policy, obligation, service and dependency references. packsDB.create re-validates against the pinned schema. The Draft to Validated and Validated to Published hops require policy-validate-schema, which re-validates the stored row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Pack SDK manages Pack dependencies.<br>Ref: §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:399-405<br>src/domain/engine/profileCompositionUnravel.ts:76-102<br>src/domain/engine/profileCompositionUnravel.ts:258-264<br>src/domain/engine/profileCompositionUnravel.ts:362-369</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Dependencies of type required, optional, conditional and incompatible are declared and a required dependency must exist in the Registry. Composition walks the dependency closure and reports violated required, conditional and incompatible dependencies as conflicts.<br>Gap:<br>The declared dependency version is never evaluated. Resolution takes the newest Active Pack by code (see FR-38.4).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Pack SDK manages version compatibility.<br>Ref: §4 Definition, §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Compatibility fields (supportedPlatformVersion, minSupportedPlatformVersion, maxSupportedPlatformVersion, incompatiblePackVersions) are stored in Pack metadata (packs.ts:114-126) and nothing reads them to accept or reject a Pack. The specification remark at §12 also records this as not implemented.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Pack SDK performs composition.<br>Ref: §4 Definition, §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:163-223<br>src/routes/seu/core/sdkAuthoring.ts:1259-1337<br>src/routes/seu/core/packs.ts:168-191</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">compositionEngine provides specialize, merge, union, intersection and supplement. composeAuthoringDraft applies the strategy chosen on a Draft Pack to its composition sources and returns the combined fields with unresolved conflicts.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Pack SDK performs activation and lifecycle management.<br>Ref: §4 Definition, §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:444-474<br>src/domain/engine/entityTransition.ts:24-78<br>src/dblayer/seed/data/transitionDefinitions.json:925-1009</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every lifecycle hop runs through transitionEntity, which evaluates the Transition Definition, checks the authority badge and policies, writes the status and returns the event to publish.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Runtime Kernel consumes the composed result through the Engineering Behavior Model and never interprets individual Packs.<br>Ref: §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionCompleted.ts:48-92<br>src/domain/engine/profileCompositionUnravel.ts:104-273</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition produces a pool of contributions with their source. compositionCompleted stores the pool, the composed Pack identifiers and the applicable Quality Gate and Policy identifiers on the EBM row. Runtime consumers (src/domain/engine/workItemGenerator.ts:46-64) read the pool and the EBM. The only direct Pack read at commissioning is the liveness check in src/routes/seu/core/commissioning.ts:99-102.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PP-001: The Runtime Kernel remains Pack-agnostic.<br>Ref: §5 PP-001</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionCompleted.ts:56-92<br>src/domain/engine/workItemGenerator.ts:46-64<br>src/domain/engine/executionEngine.ts:203</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engines read EBM data and contribution rows that carry originating_pack_id. No engine branches on a Pack code or Pack category.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PP-002: Every Pack is independently versioned.<br>Ref: §5 PP-002</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/packs_schema_recovery.sql:26<br>src/routes/seu/core/packs.ts:161-162<br>src/routes/seu/core/packs.ts:665-695<br>src/utils/version.ts:19-35</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each Pack version is its own row with UNIQUE(code, pack_version, tenant_id). The version must be valid semver. nextUnusedPatchVersion proposes the next version for a code.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PP-003: Pack composition is deterministic.<br>Ref: §5 PP-003, §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:104-273<br>src/dblayer/packsDB.ts:191-200<br>tests/engine.test.ts:36-68</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Composition iterates ordered arrays and Maps built from the selection, so the same inputs give the same pool.<br>Gap:<br>findActiveByCodes selects the newest Active row per code with no tenant filter, so the resolved Pack can change when another tenant publishes the same code. The determinism test exercises compositionEngine.compose, which no production path calls. The live path is unravelComposition and has no determinism test.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PP-004: Packs are independently deployable.<br>Ref: §5 PP-004</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/sdkAuthoring.ts:1161-1170<br>src/routes/seu/core/packs.ts:444-458<br>src/dblayer/packsDB.ts:306-314</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Pack is published and activated by its own transitions without touching other Packs. Activation retires only the previous Active version of the same code.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PP-005: Packs never directly modify platform services.<br>Ref: §5 PP-005</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:499-647</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Pack contributes data. materializeContributions writes only through the DB-layer upsertFromPack and upsert functions with originating_pack_id set. A Pack holds no executable code.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PP-006: Platform evolution occurs primarily through new Packs.<br>Ref: §5 PP-006</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:417-441<br>src/routes/seu/core/sdkAuthoring.ts:592-627</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">New behaviour is added as a new Pack or a new Pack version (branch from an existing Pack via inheritedPackVersionContent). See §1.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-38.1: A Pack has a globally unique identifier.<br>Ref: §6 FR-38.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/packs_schema_recovery.sql:4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">id is a generated UUID primary key.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-38.1: A Pack has a semantic version.<br>Ref: §6 FR-38.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:161-162<br>src/utils/version.ts:4-7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">semverError rejects a packVersion that is not valid semantic versioning. The schema marks packVersion required (schemaDefinitions.json:122-128).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-38.1: A Pack has a Pack type.<br>Ref: §6 FR-38.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/schemaDefinitions.json:157-164<br>src/dblayer/seed/data/ontologyConcepts.json:1343-1397</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">category is required and is validated against the category:pack Ontology concepts (Compliance, Domain, Engineering, Organisation, Integration, Technology).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-38.1: A Pack has a dependency declaration.<br>Ref: §6 FR-38.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:92-100<br>src/routes/seu/core/packs.ts:399-405<br>src/dblayer/packsDB.ts:44-64</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">dependencies is a JSONB column of packCode, version and type and is validated on save.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-38.1: A Pack has a compatibility declaration.<br>Ref: §6 FR-38.1, §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:105-111<br>src/dblayer/seed/data/schemaDefinitions.json:962-977</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Four optional free-text compatibility fields exist in the Pack schema and metadata.<br>Gap:<br>They are not required and not validated as version ranges.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-38.2: Concurrent versions of compatible Packs are supported and only one is Active.<br>Ref: §6 FR-38.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/packs_schema_recovery.sql:26<br>src/routes/seu/core/packs.ts:444-458<br>src/routes/seu/web/sdkAuthoring.ts:865-882<br>src/routes/seu/api/packs.ts:59-64<br>src/dblayer/packsDB.ts:178-188</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Several versions of a code coexist as rows. Activation through the SDK publish path (activatePackSupersedingPrevious) moves the previous Active version to Retired.<br>Gap:<br>The API activate route (packs.ts:62) and the web /transition route call transitionEntity directly and do not retire the previous Active version. No database constraint limits a code to one Active row. Compatibility between concurrent versions is not evaluated.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-38.3: Pack compatibility is validated before activation.<br>Ref: §6 FR-38.3, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:962-973</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Published to Active hop requires only policy-pack-transition-baseline. No policy or action evaluates platform version, Pack version, dependency version, EBM version or kernel version. The specification remark at §12 records this as not implemented.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-38.4: Pack dependencies are resolved automatically.<br>Ref: §6 FR-38.4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:76-102<br>src/routes/seu/core/packs.ts:399-405</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>resolveComposedPacksTransitively adds the dependencies of every selected Active Pack, level by level, until the closure is complete.<br>Gap:<br>The closure includes all dependency types, including optional and incompatible ones. A declared version is ignored and only the newest Active row per code is used.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-38.5: Pack conflicts are detected before an SEU is commissioned.<br>Ref: §6 FR-38.5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:347-372<br>src/routes/seu/web/objectives.ts:520-538<br>src/routes/seu/core/commissioning.ts:441-462</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">detectCompositionConflicts reports value conflicts between sources and violated required, conditional and incompatible dependencies. CompositionCompleted is published only when compositionConflicts is empty, so an SEU with unresolved conflicts is not composed.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-38.6: Pack activation preserves engineering continuity where possible.<br>Ref: §6 FR-38.6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionCompleted.ts:76-92<br>src/routes/seu/core/packs.ts:444-458<br>src/routes/seu/core/commissioning.ts:95-102</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>An EBM stores the composed Pack identifiers and versions and the pool, so a running SEU keeps the Pack version it was composed with. A retired Pack row is never deleted.<br>Gap:<br>Activation does not assess or report the effect on SEUs composed from the retired version. The commissioning liveness check reports a code with no Active version.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-38.7: Pack lifecycle operations are fully traceable.<br>Ref: §6 FR-38.7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/entityTransition.ts:55-77<br>src/domain/engine/eventBus.ts:67-95<br>src/dblayer/versionEventsDB.ts:22-31<br>src/dblayer/packsDB.ts:326-337</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each hop records the actor and the noun_verb authority badge, appends an event to the event log, inserts a version_events row for hops that name a version event, and stores any comment with the actor and badge.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The platform supports Platform, Organisation, Customer, Domain, Technology, Capability, Profile and Template Packs.<br>Ref: §7 Pack Taxonomy</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/ontologyConcepts.json:1343-1397<br>src/dblayer/seed/data/schemaDefinitions.json:157-164</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Organisation, Domain and Technology categories exist. Compliance, Engineering and Integration categories are also defined.<br>Gap:<br>No Platform, Customer, Capability, Profile or Template category exists. Platform scope is the Platform tenant. Customer scope is a tenant. Capabilities, Profiles and Templates are separate entities.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Templates and Profiles are separate entities that reuse the same SDK.<br>Ref: §7 remark</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/sdkAuthoring.ts:1161-1215<br>src/domain/engine/profileCompositionUnravel.ts:104-166</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Templates and Profiles use the same authoring, publish and transition functions and select Packs by code at composition time.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">New Pack categories are introduced without Runtime Kernel changes.<br>Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/schemaDefinitions.json:157-164<br>src/routes/seu/core/packs.ts:142-160</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">category is an Ontology-validated field. A new category:pack concept is a data change.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Pack defines an Identifier, Name and Version.<br>Ref: §8 Pack Structure</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/packs_schema_recovery.sql:4-8<br>src/dblayer/seed/data/schemaDefinitions.json:122-128</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">id, code, name and pack_version are NOT NULL columns and required schema properties.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Pack defines a Publisher.<br>Ref: §8 Pack Structure, §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:105<br>src/routes/seu/core/packs.ts:114-126<br>src/dblayer/seed/data/schemaDefinitions.json:962-977</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>publisher is an optional metadata key that seed input can set.<br>Gap:<br>The Pack schema has no publisher property, so authoring forms cannot set it. It is not required or verified. authored_by and tenant_id record who created the row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Pack defines a Description.<br>Ref: §8 Pack Structure</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/schemaDefinitions.json:962-977<br>src/routes/seu/core/packs.ts:114-117</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">description is a Pack schema property stored in metadata.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Pack defines its Dependencies.<br>Ref: §8 Pack Structure</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:399-405<br>src/dblayer/packsDB.ts:44-64</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">See FR-38.1.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Pack defines a Compatibility Matrix.<br>Ref: §8 Pack Structure, §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/schemaDefinitions.json:962-977</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Only four independent free-text fields exist. There is no matrix of platform, Pack, EBM and kernel versions. The specification remark records this as not implemented.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Pack defines Declared Contributions.<br>Ref: §8 Pack Structure</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:93-99<br>src/routes/seu/core/packs.ts:499-647<br>src/domain/engine/entityAdapters.ts:102-126</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">contributions holds Capabilities, Services, Authority Rules, Policies, Quality Gates, Checklists, Review Gates, Obligation Definitions, Engineering Capital and Competencies, each validated in validatePackSeed.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Pack has a Lifecycle State.<br>Ref: §8 Pack Structure</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/packs_schema_recovery.sql:9<br>src/dblayer/seed/data/transitionDefinitions.json:925-1009</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">status is a NOT NULL column that only transitionEntity changes.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Pack carries a Digital Signature.<br>Ref: §8 Pack Structure, §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No signature field or verification code exists. The specification remark records this as not implemented.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Pack carries Metadata.<br>Ref: §8 Pack Structure</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/packs_schema_recovery.sql:17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">metadata is a JSONB column filled by packMetadataFromSeed.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The internal packaging format is implementation-defined.<br>Ref: §8 Pack Structure</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/entityAdapters.ts:102-126</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Pack is stored as relational columns with JSONB contributions and presented as a flattened content document.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Pack progresses through Defined, Validated, Published, Activated, Retired and Archived.<br>Ref: §9 Pack Lifecycle</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:925-1009<br>src/routes/seu/core/packs.ts:460-474</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Transition Definitions are None to Draft (Defined), Draft to Validated, Validated to Published, Published to Active, Active to Retired and Retired to Archived. Validated to Draft is a rejection. The Defined state is named Draft and Activated is named Active.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Pack history remains permanently available.<br>Ref: §9 Pack Lifecycle</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packsDB.ts:214-222<br>src/routes/seu/core/packs.ts:665-695<br>src/routes/seu/web/versionEvents.ts:13-38</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No delete path exists for Packs. Retired and Archived rows stay queryable and every hop is kept in events and version_events.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Registry provides discovery and lifecycle status.<br>Ref: §10 Pack Registry</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/web/packs.ts:14-47<br>src/routes/seu/core/packs.ts:702-710<br>src/routes/seu/api/packs.ts:19-28</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Web and API lists return Packs visible to the viewer with status and the manual next states.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Registry provides version lookup.<br>Ref: §10 Pack Registry</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packsDB.ts:156-222<br>src/routes/seu/core/packs.ts:665-695</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Lookups by code and version, all versions of a code, and per-code version summaries exist.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Registry provides dependency resolution.<br>Ref: §10 Pack Registry</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:76-102</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Resolution exists inside composition and ignores declared versions. See FR-38.4.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Registry provides compatibility validation.<br>Ref: §10 Pack Registry, §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No compatibility evaluation exists. See FR-38.3.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Registry provides publisher information.<br>Ref: §10 Pack Registry</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:114-126<br>src/routes/seu/web/packs.ts:14-47</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>publisher can be held in metadata.<br>Gap:<br>The list does not show it and the schema cannot set it. See §8.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Registry is the authoritative catalogue of Packs.<br>Ref: §10 Pack Registry</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packsDB.ts:8-338<br>src/domain/engine/profileCompositionUnravel.ts:77-102</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The packs table is the only source composition reads.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition resolves dependencies.<br>Ref: §11 Pack Composition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:76-102</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">See FR-38.4.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition evaluates compatibility.<br>Ref: §11, §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:104-273</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">unravelComposition performs no compatibility check.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition merges declarative contributions.<br>Ref: §11 Pack Composition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:204-265</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capabilities, Services, Authority Rules, Quality Gates, Checklist items, Review Gates, Obligation Definitions, Engineering Capital and Policies of every composed Pack are added to one pool with their source.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition detects conflicts.<br>Ref: §11 Pack Composition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:294-372<br>src/domain/engine/compositionEngine.ts:281-320</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Differing values for the same property, differing authorised roles for a transition and two Packs filling the same Quality Gate slot are reported as conflicts.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition produces one Engineering Behavior Model.<br>Ref: §11 Pack Composition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionCompleted.ts:76-92<br>src/dblayer/ebmsDB.ts:5-31</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">One EBM row is created per composition with the pool, composed Packs and report, and set as the SEU's active EBM.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The same Pack set always gives an identical configuration.<br>Ref: §11 Pack Composition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:104-273<br>src/dblayer/packsDB.ts:191-200</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">See PP-003. Selection order and ordering by creation time are stable, but selection of the Active row is tenant-agnostic.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Pack composition derives new Packs from existing ones using the Composition Strategy.<br>Ref: §11 remark</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/sdkAuthoring.ts:1259-1337<br>src/routes/seu/core/packs.ts:168-191<br>src/domain/engine/compositionEngine.ts:32-39</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Draft Pack names a strategy and source Packs. validatePackSeed enforces source count and same-code rules and composeAuthoringDraft combines the sources.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Compatibility is evaluated across platform version, Pack versions, dependency versions, EBM version and Runtime Kernel version.<br>Ref: §12 Compatibility</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None of the five evaluations exists. The remark states it is not implemented yet.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Compatibility rules are declarative.<br>Ref: §12 Compatibility</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:105-111</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The four stored fields are not interpreted as rules by any code.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Publisher verification is supported.<br>Ref: §13 Security</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No code verifies a publisher. The metadata value is never compared with an identity.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Integrity validation is supported.<br>Ref: §13 Security</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:142-408<br>src/policies/validateSchema.ts:8-27<br>src/dblayer/packsDB.ts:106</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Schema, Ontology and reference validation run before Validated and Published, and non-Draft content cannot be edited.<br>Gap:<br>No checksum or hash of Pack content is stored or checked.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Signature verification is supported.<br>Ref: §13 Security</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No signature exists. See §8.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Provenance tracking is supported.<br>Ref: §13 Security</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/packs_schema_recovery.sql:18-23<br>src/routes/seu/core/packs.ts:499-647<br>src/dblayer/packsDB.ts:326-337</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>authored_by, author_badge and tenant_id are NOT NULL and each contributed row stores originating_pack_id.<br>Gap:<br>Publisher and source location are not recorded.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Untrusted Packs are not activated.<br>Ref: §13 Security</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:962-973<br>src/dblayer/seed/data/routeAuthority.json:322-330</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Activation needs the pack_activate badge and a Published row that passed policy-validate-schema.<br>Gap:<br>The platform holds no trust state for a Pack or publisher, so trust is not a condition of activation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Publishing generates a report that is checked and persisted.<br>Ref: §13 remark</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:476-485<br>src/domain/engine/entityTransition.ts:55-77</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Validation errors are returned to the caller, and a failed hop is reported as a rejection. No publish report is stored.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The platform preserves Pack origin.<br>Ref: §14 Traceability</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/packs_schema_recovery.sql:18-23<br>src/routes/seu/core/packs.ts:424</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">authored_by, author_badge and tenant_id are stored on every row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The platform preserves the Pack publisher.<br>Ref: §14 Traceability</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:114-126</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">See §8. The value is optional metadata.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The platform preserves version history.<br>Ref: §14 Traceability</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packsDB.ts:214-222<br>src/domain/engine/eventBus.ts:78-95</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every version is a retained row and the version_events table records each versioned hop.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The platform preserves dependency history.<br>Ref: §14 Traceability</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packsDB.ts:44-64<br>src/domain/engine/compositionCompleted.ts:76-92</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Each version row holds its own dependencies and an EBM records the composed Packs.<br>Gap:<br>No history of resolved dependency closures exists apart from the EBM.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The platform preserves activation history.<br>Ref: §14 Traceability</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:962-973<br>src/domain/engine/eventBus.ts:67-95</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PackActivated and VersionActivated are recorded with actor and badge.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The platform preserves composition history.<br>Ref: §14 Traceability</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionCompleted.ts:76-92<br>src/routes/seu/core/sdkAuthoring.ts:1259-1337</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Each EBM version keeps its pool and composition report.<br>Gap:<br>Composing a Draft from sources leaves only composition_sources on the row and publishes no event.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every engineering decision is traceable to the Pack versions that influenced it.<br>Ref: §14 Traceability</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/decisions_schema_recovery.sql:1-38<br>src/domain/engine/compositionCompleted.ts:76-92<br>src/routes/seu/core/traceability.ts:76-80</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The SEU's EBM names the Pack versions, and gates, policies and checklists carry originating_pack_id.<br>Gap:<br>A Decision row stores no Pack or EBM reference. The link is reachable only through the SEU's active EBM.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PackDefined is published.<br>Ref: §15 Events</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:925-934<br>src/routes/seu/core/packs.ts:429-438</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The birth hop names PackDefined and createPackDraft publishes it with actor and badge.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PackRejected is published.<br>Ref: §15 Events</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:998-1009<br>src/routes/seu/api/packs.ts:61</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Validated to Draft hop names PackRejected and requires a comment.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PackUpdated is published.<br>Ref: §15 Events</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packsDB.ts:72-126</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">updateDraftContent publishes no event and no Transition Definition names PackUpdated.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PackValidated is published.<br>Ref: §15 Events</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:935-947</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Draft to Validated hop names PackValidated.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PackActivated is published.<br>Ref: §15 Events</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:962-973</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Published to Active hop names PackActivated.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PackDeprecated is published.<br>Ref: §15 Events</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:986-997</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No PackDeprecated event exists. The Active to Retired hop names PackRetired and carries the version event VersionDeprecated.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PackRetired is published.<br>Ref: §15 Events</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:986-997</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Active to Retired hop names PackRetired.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Events are asynchronous.<br>Ref: §15 note</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/eventBus.ts:67-104<br>src/domain/engine/entityTransition.ts:80-93</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">publish appends the event and starts subscribers without awaiting them. No Pack event has a subscriber because every Pack hop only changes the Pack itself.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Revision and version are differentiated.<br>Ref: §15 note</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packsDB.ts:72-126<br>src/domain/engine/eventBus.ts:78-95</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A version is a Pack row with semver and a version_event. Draft edits overwrite the row.<br>Gap:<br>Draft revisions are not recorded and PackUpdated does not exist.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❓</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Pack SDK supports thousands of Packs.<br>Ref: §16 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:702-710</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No load evidence exists. listPacksWithNextStates reads every visible Pack and issues one transition query per Pack, which cannot be evaluated for scale from the repository.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Pack SDK supports deterministic composition.<br>Ref: §16 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:104-273</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">See PP-003.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Pack SDK supports concurrent Pack versions.<br>Ref: §16 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:444-458</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">See FR-38.2.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❓</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Pack SDK remains horizontally scalable.<br>Ref: §16 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/eventBus.ts:15-61</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">State is in Postgres but event subscribers are held in process memory. Behaviour with several instances cannot be established from the repository.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Pack SDK supports offline validation.<br>Ref: §16 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:142-408</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">validatePackSeed queries the database for the schema, Ontology, Transition Definitions, Policies and Service Definitions. No stand-alone validator exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Pack SDK remains implementation-independent.<br>Ref: §16 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/entityAdapters.ts:102-126<br>src/routes/seu/core/sdkAuthoring.ts:53-80</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Pack is a schema-governed JSON document converted to a seed input; no Pack content depends on a runtime class or code.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Export Packs as JSON.<br>Ref: §16 remark</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/web/sdkAuthoring.ts:823-846</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A JSON document can be imported into a Draft after validation against the schema.<br>Gap:<br>No export route or download of a Pack as JSON exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Packs are independently deployable.<br>Ref: §17 Acceptance</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:444-458</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">See PP-004.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Pack composition is deterministic.<br>Ref: §17 Acceptance</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:104-273</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">See PP-003.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Compatibility is validated before activation.<br>Ref: §17 Acceptance</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">See FR-38.3.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Pack provenance is preserved.<br>Ref: §17 Acceptance</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:499-647</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">See §13 and §14.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Platform evolution occurs without Runtime Kernel modification.<br>Ref: §17 Acceptance</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:417-441</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">See §1.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Engineering behaviour is reproducible from historical Pack versions.<br>Ref: §17 Acceptance</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionCompleted.ts:56-92<br>src/dblayer/packsDB.ts:106</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An EBM stores the composed Pack identifiers and versions and the pool snapshot. Non-Draft Pack rows are immutable, so the Quality Gates and Policies found by pack id remain those of the composed version.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Pack SDK is delivered.<br>Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/sdkAuthoring.ts:1161-1337<br>src/routes/seu/core/packs.ts:417-485</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authoring, validation, publishing and composition functions exist. They do not form a separately packaged SDK.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Pack Registry is delivered.<br>Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packsDB.ts:8-338<br>src/routes/seu/web/packs.ts:14-47</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Table, DB layer and list page. Discovery and compatibility gaps are recorded above.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Pack Composition Engine is delivered.<br>Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:163-223<br>src/domain/engine/profileCompositionUnravel.ts:104-273</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Strategy functions and the unravel and conflict detection pipeline.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Dependency Resolver is delivered.<br>Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:76-102</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Resolution exists as a function inside composition and ignores versions.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Compatibility Validator is delivered.<br>Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No compatibility validator exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Pack Lifecycle Manager is delivered.<br>Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:444-474<br>src/domain/engine/entityTransition.ts:24-78</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Lifecycle hops are governed by Transition Definitions and applied by transitionEntity.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Pack APIs are delivered.<br>Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/api/packs.ts:19-64<br>src/dblayer/seed/data/routeAuthority.json:315-380</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">List and six transition endpoints exist with route_authority rows.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Pack Events are delivered.<br>Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:925-1009</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Five of the seven named events exist. PackUpdated and PackDeprecated are missing. PackPublished and PackArchived exist beyond the list.</td>
    </tr>
  </tbody>
</table>

## Summary

- Total intents analysed: 100
- Fully met: 53
- Partially met: 29
- Not met: 16
- Not verifiable: 2

Major implementation gaps:

- No compatibility evaluation of any kind (platform, Pack, dependency, EBM, kernel). Compatibility fields are stored but never read.
- No digital signature, publisher verification, integrity hash or persisted publish report.
- Only one Active version per code is enforced on the SDK publish path. The API activate route and the web transition route do not retire the previous Active version, and no constraint backs it.
- Dependency resolution ignores the declared dependency version. findActiveByCodes is not tenant-scoped.
- PackUpdated and PackDeprecated events do not exist.
- No Pack export as JSON and no offline validator.
- A Decision row holds no Pack or EBM reference.
