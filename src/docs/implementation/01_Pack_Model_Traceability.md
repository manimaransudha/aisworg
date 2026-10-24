# Implementation Traceability: Chapter 1 – Pack Model

**Date of report: 23-10-2026**

Specification: src/docs/SEU Studio Specifications/01_Engineering Definition/01_Pack.md

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Pack is the unit of extension; new Packs are added as data rows through the governed authoring path with no Runtime Kernel change.<br>Ref: §1 Purpose, §16, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:417-442<br>src/dblayer/packsDB.ts:10-72</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Packs are created as rows validated against a schema_definitions grammar. Contributions are materialised by materializeContributions (packs.ts:499). No kernel code change is needed to add a Pack.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every EBM is produced by composing contributions from Packs.<br>Ref: §1 Purpose, §3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:235-258<br>src/domain/engine/profileCompositionUnravel.ts:95-290</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition resolves Active Packs, unravels them into a contribution pool and records composedPacks on the EBM (src/dblayer/ebmsDB.ts:22-31).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Pack is versioned and composable and never holds project-specific runtime state.<br>Ref: §4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/packs_schema_recovery.sql:3-26<br>src/dblayer/packsDB.ts:82-120</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The packs table holds definition fields only: contributions, dependencies, composition_sources and metadata. Content edits are limited to status Draft (updateDraftContent WHERE status = 'Draft').</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Packs are reusable across multiple SEUs.<br>Ref: §4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:108-135<br>src/dblayer/packsDB.ts:292-303</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Packs are selected by code from Templates and Profiles at composition time and are not owned by a SEU. Mandatory Packs are pulled into every Template.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PM-001: A Pack represents one coherent engineering concern.<br>Ref: §5 PM-001</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:142-408</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Validation checks structure, references and duplicates inside a Pack.<br>Gap: no rule checks that a Pack addresses a single concern. A Pack may combine any contribution kinds. Coherence is an authoring judgement.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PM-002: A Pack declares how its contributions compose with other Packs.<br>Ref: §5 PM-002</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:168-181, 158-190<br>src/domain/engine/compositionEngine.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: compositionStrategy and compositionSources are stored and validated against the composition-strategy Ontology and the strategy's source arity.<br>Gap: compositionStrategy is optional (guarded by if (seed.compositionStrategy?.trim())), so a Pack may declare none.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PM-003: Packs are versioned independently.<br>Ref: §5 PM-003, §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/packs_schema_recovery.sql:26<br>src/routes/seu/core/packs.ts:161-162</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each row has its own pack_version, checked as semver and unique per (code, pack_version, tenant_id). Publishing one Pack does not touch other codes.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PM-004: A Pack may be replaced without Runtime Kernel modification.<br>Ref: §5 PM-004</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:444-458</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">activatePackSupersedingPrevious activates the new version and retires the previous Active version of the same code through the generic transition engine.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PM-005: Every contribution is traceable to its originating Pack.<br>Ref: §5 PM-005, §16, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:250-262<br>src/domain/engine/compositionEngine.ts:243-250<br>src/dblayer/recovery/capabilities_schema_recovery.sql:8<br>src/dblayer/recovery/authority_rules_schema_recovery.sql:8<br>src/dblayer/recovery/checklists_schema_recovery.sql:7<br>src/dblayer/recovery/services_schema_recovery.sql:12<br>src/dblayer/recovery/policies_schema_recovery.sql:13<br>src/dblayer/recovery/quality_gates_schema_recovery.sql:12<br>src/dblayer/recovery/review_gates_schema_recovery.sql:10<br>src/routes/seu/core/packs.ts:508,533,545</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every contribution kind that is persisted as its own row carries originating_pack_id, stamped when the Pack is materialised: Capabilities, Services, Policies, Authority Rules, Checklists, Quality Gates and Review Gates. Obligation definitions and engineering capital stay in the Pack contributions and enter the composition pool with the Pack as source. The EBM records composedPacks with packId, packCode and packVersion.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The platform recognises six Pack categories, and new categories can be added without kernel change.<br>Ref: §6, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packCategoriesDB.ts:12-34<br>src/dblayer/seed/data/ontologyConcepts.json</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Categories are rows in pack_category and Ontology concepts. Adding a category is a data change.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Platform Packs are maintained by the platform itself.<br>Ref: §6.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packsDB.ts:262-303</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Platform ownership is modelled by tenant_id equal to the platform tenant. Platform Packs are visible to all tenants.<br>Gap: no code was found that restricts maintenance of Platform Packs to the platform.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Organisation Packs should extend Platform Packs wherever practical.<br>Ref: §6.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: no rule or warning relates an Organisation Pack to a Platform Pack. The statement is advisory ('should'). composition_sources can express an extension but nothing encourages it.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each category carries its typical contributions, which are expressed as contribution kinds.<br>Ref: §6.3 to §6.5, §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:142-408</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Contribution kinds are free to combine under any category. Category-specific contribution sets are guidance in the specification and are not enforced, consistent with the text.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Integration Packs expose services rather than engineering behaviour.<br>Ref: §6.6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:373-398</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Services are a supported contribution kind with Service Definition pinning.<br>Gap: nothing restricts an Integration Pack to service contributions only.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Pack declares an installation classification from Mandatory, Recommended, Optional or Conditional.<br>Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:164-166<br>src/dblayer/seed/data/ontologyConcepts.json:1398-1426</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The value is validated against the installation-classification Ontology. packsDB defaults a missing value to Mandatory (packsDB.ts:23).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Mandatory Packs are required for every commissioned SEU.<br>Ref: §7 Mandatory, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:113-117<br>src/dblayer/packsDB.ts:292-303</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Active Mandatory Packs visible to the Template tenant are added to the composition roots for every Template.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Composition Engine generates warnings when a Recommended Pack is omitted.<br>Ref: §7 Recommended</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: no code reads the Recommended classification. Warnings in compositionEngine.ts:11-21 cover only Packs without an Active version.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Optional Packs are installed only when explicitly requested or indirectly required.<br>Ref: §7 Optional</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:235-244<br>src/domain/engine/profileCompositionUnravel.ts:80-103</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Roots come from Template mandatory sets and Profile selections. Required dependencies are pulled in transitively.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Conditional Packs are required only when declared conditions are satisfied, as determined by the Composition Engine.<br>Ref: §7 Conditional, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:361-367</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: a conditional dependency type is flagged as a conflict when it is not in the composed set.<br>Gap: the Conditional installation classification has no condition model and is never evaluated. Only the dependency-type usage exists, and it treats conditional like required.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Pack defines the twelve metadata attributes.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:93-126<br>src/dblayer/packsDB.ts:46-70</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Identifier, Name, Version, Category, Classification, Dependencies and Status are columns. Description, Owner, Publisher, Composition Strategy and Supported Platform Version go to a metadata JSON object.<br>Gap: only name is mandatory in validatePackSeed (packs.ts:145). The other attributes are optional.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Additional metadata can be added without kernel change.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packsDB.ts:61-66<br>src/domain/sdk/formGenerator.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Metadata is a JSON column and the grammar is a schema_definitions row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Pack may contribute the listed contribution kinds, and templates are treated separately.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:499-648</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">materializeContributions handles capabilities, services, policies, authority rules, quality gates, review gates, checklists, obligation definitions, engineering capital and ontology fields. Templates are a separate entity.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Pack declares dependencies of type Required, Optional, Conditional or Incompatible.<br>Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:92, 399-405</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The four types are validated.<br>Gap: Required is the only type checked for existence. Dependency version is stored but never compared against the target Pack's version.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Composition Engine resolves all required dependencies before commissioning.<br>Ref: §10, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:95-103, 258-262, 361-367</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: dependencies are followed transitively and an unmet Required or Conditional dependency becomes a composition conflict.<br>Gap: the conflict has hasAction false and no step in the files read shows it blocking commissioning. A dependency chain reaching a Pack with no Active version only yields a warning when it is a root.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Incompatible dependencies prevent composition.<br>Ref: §10, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:365</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An incompatible dependency whose target is in the composed set becomes a conflict.<br>Gap: the check ignores versions, and a conflict is reported for resolution. No evidence was found that it hard-blocks composition. Version-level incompatibility (§13) is not evaluated.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Packs follow the lifecycle Draft, Validated, Published, Active, Retired, Archived, plus Validated to Draft on reject.<br>Ref: §11 and remark</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:926-1009<br>src/domain/engine/entityTransition.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Seven transition rows exist with manual triggers, event types and version events. Each runs through the generic transition engine with a real actor and badge (packs.ts:444-474, api/packs.ts:36-55).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Reject requires a mandatory, always-new comment.<br>Ref: §11 remark</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1002-1008<br>src/routes/seu/api/packs.ts:40-43</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The reject row requires policy-comment-required. The comment is passed in the transition context.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Historical Pack versions remain available for reproducing past EBMs.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packsDB.ts:214-221<br>src/dblayer/recovery/packs_schema_recovery.sql:26</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Retired and Archived rows are never deleted. findVersionsByCode returns all versions. Only the status changes.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Updating one Pack does not require version changes to unrelated Packs.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:444-458</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Supersession acts only on the same code and tenant.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">EBMs record the exact Pack versions used.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:247-251<br>src/dblayer/ebmsDB.ts:22-31</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">composed_packs stores packId, packCode and packVersion for every composed Pack.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Packs declare minimum and maximum platform version, incompatible Pack versions and migration guidance.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:107-126</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All four fields are accepted and stored in metadata.<br>Gap: they are free strings with no format validation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Composition Engine validates compatibility before composition.<br>Ref: §13, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: no code compares the declared platform version range or incompatible Pack versions with anything. Fields are stored but never read by the engine.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Packs are visible to the Composition Engine, Pack Registry and Administration Services, and runtime services may query metadata.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/api/packs.ts:18-27, 31-38<br>src/dblayer/packsDB.ts:262-303</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Tenant-scoped listing is done with requireTenant and requireTenantScope. Composition reads Active Packs.<br>Gap: no distinct Pack Registry component exists. The packs table and the listing route serve as the registry.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Commissioned SEUs do not modify Packs.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packsDB.ts:82-120<br>src/dblayer/seed/data/routeAuthority.json:317-375</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Content updates are limited to Draft. State changes require pack_* badges through route_authority.<br>Gap: no rule ties Pack immutability to SEU commissioning. Protection rests on badges and Draft-only edits.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Pack subsystem publishes the nine named events.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:926-1009<br>src/routes/seu/core/packs.ts:424-435</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Published: PackDefined (in place of PackRegistered), PackValidated, PackPublished, PackActivated, PackRetired, PackRejected, plus PackArchived.<br>Gap: PackDependencyResolved and PackDependencyFailed have no definition and no publisher. PackRegistered is named PackDefined.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PackDeprecated is dropped.<br>Ref: §15 remark</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:988-996</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No Deprecated state exists. The Retired transition carries the version event VersionDeprecated.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The framework supports concurrent Pack versions.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/packs_schema_recovery.sql:15, 26<br>src/dblayer/recovery/packs_schema_recovery.sql:26</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The unique key is (code, pack_version, tenant_id). Several versions coexist, and one Active version is resolved per code.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition is deterministic.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:80-103<br>src/dblayer/packsDB.ts:178-183</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Resolution picks the newest Active row per code with ordered queries and strategy rules.<br>Gap: no constraint guarantees a single Active row per code, so ordering by created_at is the tiebreak.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The framework avoids Runtime Kernel modification for Pack additions.<br>Ref: §16, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/sdk/formGenerator.ts<br>src/dblayer/seed/data/schemaDefinitions.json<br>src/dblayer/packCategoriesDB.ts:12-34<br>src/routes/seu/core/packs.ts:164-166</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Pack fields and categories are data driven.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Packs can be independently created and versioned.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:417-488</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">createPackDraft and publishPack each create a Pack row with its own version through the governed path.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Multiple Pack categories coexist.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packsDB.ts:244-260</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Listing orders by category and no rule limits one category per Template.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Mandatory and conditional Packs are correctly enforced.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:113-117</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Mandatory is enforced. Conditional classification is not evaluated (see §7 Conditional).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Dependency resolution succeeds for compatible Packs and incompatible Packs prevent composition.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:77-102, 361-367<br>src/domain/engine/profileCompositionUnravel.ts:361-367</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Resolution succeeds for matching codes. See §10 and §13 for the gaps in blocking and version compatibility.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables: Pack domain model, Registry, metadata schema, dependency model, version management, compatibility validation, lifecycle services, APIs and events.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts<br>src/routes/seu/api/packs.ts:18-66<br>src/dblayer/packsDB.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Domain model, schema, dependency declaration, versioning, lifecycle services, list and transition APIs and events exist.<br>Gap: no compatibility validation service. The API offers listing and transitions only, with no create or update endpoint (creation goes through the SDK authoring routes).</td>
    </tr>
  </tbody>
</table>

## Summary

- Total intents analysed: 44
- Fully met: 24
- Partially met: 16
- Not met: 4
- Not verifiable: 0

Major implementation gaps:

- Compatibility validation (platform version range, incompatible Pack versions) is stored but never evaluated (§13).
- Recommended warnings are not generated (§7).
- Conditional classification has no condition model (§7).
- Dependency versions are not compared, and unmet Required or Incompatible dependencies surface as conflicts with no evidence of hard blocking (§10).
- PackDependencyResolved and PackDependencyFailed events do not exist, and PackRegistered is named PackDefined (§15).
- Platform Pack maintenance restriction and Organisation-extends-Platform guidance are not enforced (§6).
