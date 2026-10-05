# Implementation Traceability: Chapter 39 – SEU Design Kit (SDK) Architecture

**Date of report: 4-10-2026**

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK provides a stable contract between Platform Core and Elements developers<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/schemaRegistry.ts:61-108</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each schema version, once created, is immutable; new versions are new rows. <br>Content authored against a version is checked against that exact version indefinitely.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Platform evolves through SDK extension rather than Runtime Kernel modification<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/sdk/formGenerator.ts:15-283<br> src/routes/seu/core/schemaRegistry.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A new field on Pack/Template/Profile/etc. is added via a <code>schema_definitions</code> row with no code change, provided it reuses an existing widget type.<br> **A genuinely new widget type requires code changes to formGenerator.ts.**</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK is the sole supported mechanism for creating production Schemas<br> Ref: §3 Architectural Position</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/schemaRegistry.ts:17 (kind registry)<br> src/routes/seu/core/sdkAuthoring.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All 7 registered kinds (Pack, Template, Profile, Deliverable, Service, Policy, Capability) are created only through this authoring path. <br>TransitionDefinition is authored through a separate <code>/authority</code> form, outside this registry.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK-001: every production Platform Element created via SDK<br> Ref: §5 SDK-001</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/schemaRegistry.ts:17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">True for the 7 registered kinds. <br>TransitionDefinition is a documented exception, authored elsewhere.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK-002: SDK independent of Runtime Kernel implementation<br> Ref: §5 SDK-002</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/sdk/formGenerator.ts<br> src/routes/seu/core/sdkAuthoring.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Validators and generators operate on plain JSON; they call transitionEngine/compositionEngine as consumers but do not alter kernel behavior.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK-003: SDK outputs deterministic<br> Ref: §5 SDK-003</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/schemaRegistry.ts:61-108</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Validation and schema-version comparison are pure functions over input plus DB state, deterministic. <br>**No packaging step exists to evaluate determinism against** (see Packaging intents below).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK-004: SDK validates before publication<br> Ref: §5 SDK-004</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:732-736 <br>(validatePackSeed called before createPackDraft proceeds)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every publish path re-runs validation immediately before the governed state change.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK-005: SDK supports automation<br> Ref: §5 SDK-005</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/pack-sdk-cli.ts (72 lines)<br> package.json:12-13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Only Pack has a CLI (<code>pack:validate</code>/<code>pack:publish</code>). Template, Profile, Deliverable, Service, Policy, Capability have no CLI, web form only.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK-006: SDK evolves independently of Runtime Kernel<br> Ref: §5 SDK-006</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same as SDK-002</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same reasoning applies; no coupling found.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-39.1: SDK provides Element widgets<br> Ref: §6 FR-39.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/sdk/formGenerator.ts:73 <br>(widget dispatch: json, referential-list, referential-select, referential-multi-select, textarea, version, db-select, nested-list/nested-object)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A working widget library exists and is used across all 7 kinds.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-39.2: SDK validates Element schemas<br> Ref: §6 FR-39.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/sdkAuthoring.ts:478-487 <br>(validateAuthoredContent dispatcher)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Structural validation via formGenerator.ts; semantic/reference validation via a per-kind <code>validate*Seed</code> function, unified through one dispatcher.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❓</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-39.3: SDK validates Element dependencies<br> Ref: §6 FR-39.3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:693-701 <br>src/routes/seu/core/templates.ts:476-484,619</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Element definitions do not have dependencies. Composition checks dependencies. <br>Check composition engine for completeness</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-39.4: SDK validates compatibility declarations<br> Ref: §6 FR-39.4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/schemaRegistry.ts:61-108</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Schema-version compatibility is computed and stored on every new version.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-39.5: SDK supports automated testing<br> Ref: §6 FR-39.5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">tests/sdk-authoring.test.ts (829 lines)<br> tests/pack-sdk.test.ts (509 lines)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Automated tests exist and are substantial, but run against a real Postgres database and the real transitionEngine/compositionEngine rather than isolated fixtures, which conflicts with §10's independence requirement.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-39.6: SDK packages Element into a deployable artefact<br> Ref: §6 FR-39.6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:732-745</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No separate package file, manifest, or artefact is produced anywhere in the codebase.<br> A published Pack row is locked at the top level (createPackDraft will not create a duplicate row for an existing code+version+tenant), but that is row-locking, not artefact packaging.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-39.7: SDK supports publishing to Element Registries<br> Ref: §6 FR-39.7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:760-767,1153-1162</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Publishing is a governed state transition writing directly into the entity's own table, which doubles as the Registry, for all 7 kinds.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Schema Generator: creates Element Schemas using standard layouts<br> Ref: §7 Schema Generator</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/sdk/formGenerator.ts:15-283</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Generates form layouts from stored JSON Schema definitions across all 7 kinds.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Schema Validator: validates declarative Element Schema definitions<br> Ref: §7 Schema Validator</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/sdkAuthoring.ts:478-487</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same dispatcher as FR-39.2.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Dependency Validator: ensures dependency consistency<br> Ref: §7 Dependency Validator</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:693-701; src/routes/seu/core/templates.ts:476-484</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same finding as FR-39.3: inconsistent depth of checking across kinds.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Compatibility Validator: checks compatibility against platform versions and Element Schema dependencies<br> Ref: §7 Compatibility Validator</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/schemaRegistry.ts:61-108</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Schema-to-schema compatibility is real. Platform-version compatibility (the specific phrase used here) is not checked anywhere; see FR-39.4.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Test Framework: executes Element Schema validation tests<br> Ref: §7 Test Framework</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">tests/sdk-authoring.test.ts; tests/pack-sdk.test.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Present, but coupled to a live database, not isolated.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Packaging Service: creates immutable Element Schema artefacts<br> Ref: §7 Packaging Service</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:732-745,860-915</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No distinct packaging service exists. Worse, re-publishing an existing (code, version, tenant) row calls materializeContributions again, and its writes to capabilities/services/authority rules/policies are all upserts (src/routes/seu/core/packs.ts:871,897,909), not insert-only guards, so contents under an "already published" row can be silently overwritten.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Publishing Service: publishes validated Element Schemas to authorised registries<br> Ref: §7 Publishing Service</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:760-767</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real for all 7 kinds; gated by route_authority per this project's standing authorization mechanism.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK element is a versioned, declarative package with discovery, validation, dependency management, version compatibility, composition, activation, lifecycle management<br> Ref: §8 SDK Elements Taxonomy</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts; src/routes/seu/core/templates.ts; src/routes/seu/core/profiles.ts (equivalent per-kind files)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every listed capability exists, but each is implemented separately per entity kind (7 hand-written pipelines) rather than as one shared <code>SdkElement</code> abstraction. sdkAuthoring.ts only ties them together via a handful of dispatcher functions.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Fully met (different mechanism)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Validation covers manifest correctness<br> Ref: §9 Validation</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/sdkAuthoring.ts:478-487</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No "manifest" concept exists in the codebase; the Draft's own JSON content is validated directly against its JSON Schema. Functionally equivalent goal via a different mechanism.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Validation covers schema compliance<br> Ref: §9 Validation</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/sdk/formGenerator.ts; per-kind validate*Seed functions</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real, as in FR-39.2.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Validation covers dependency graph<br> Ref: §9 Validation</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:693-701; src/routes/seu/core/templates.ts:476-484</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same gap as FR-39.3: Pack has no graph, only existence-checking; Template has a real graph with cycle detection.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Validation covers compatibility rules<br> Ref: §9 Validation</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/schemaRegistry.ts:61-108; src/routes/seu/core/packs.ts:227-236</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Schema-version compatibility enforced; platform-version compatibility stored only, never enforced.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Validation covers duplicate identifiers<br> Ref: §9 Validation</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:359-405</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Duplicate-code checks are implemented in validatePackSeed.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Validation covers semantic integrity<br> Ref: §9 Validation</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts (Ontology-backed category checks via validatePackSeed)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Enforced through canonical Ontology concept checks.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Validation covers required metadata<br> Ref: §9 Validation</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/sdk/formGenerator.ts; JSON Schema <code>required</code> arrays in schema_definitions rows</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Enforced through the schema's own <code>required</code> list plus form-engine required-field marking.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❓</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Validation shall fail before packaging if errors are detected<br> Ref: §9 Validation</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:732-736</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Validation runs before the publish/write step, but there is no distinct packaging stage for this to gate, since FR-39.6/Packaging Service are Not met.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK supports schema tests<br> Ref: §10 Testing</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">tests/sdk-authoring.test.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Schema-shape assertions present.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK supports composition tests<br> Ref: §10 Testing</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">tests/pack-sdk.test.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Tests exercise compositionEngine indirectly through publish flows, not as an isolated named category.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK supports compatibility tests<br> Ref: §10 Testing</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">tests/sdk-authoring.test.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Some coverage of schema-version compatibility exists, not organized as a distinct "compatibility test" category.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK supports regression tests<br> Ref: §10 Testing</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">tests/sdk-authoring.test.ts; tests/pack-sdk.test.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Tests function as regression tests in practice, but are not organized or labeled by this category.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK supports example execution tests<br> Ref: §10 Testing</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">tests/sdk-authoring.test.ts; tests/pack-sdk.test.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Test data includes example seeds (e.g. src/dblayer/seed/data/test-pack-all-tabs.pack.json) exercised through the tests, but no distinct "example execution" test category exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Tests shall execute independently of the Runtime Kernel<br> Ref: §10 Testing</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">tests/sdk-authoring.test.ts; tests/pack-sdk.test.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Both suites run against a live Postgres database and the real transitionEngine/compositionEngine, not fakes or isolated fixtures. This directly contradicts the requirement.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Packaging produces an immutable artefact with declarative definitions<br> Ref: §11 Packaging</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:732-745</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No artefact is produced; the entity's own row holds the declarative definitions.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Packaging artefact contains metadata<br> Ref: §11 Packaging</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:227-236</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Metadata fields exist on the entity row itself, not in a separate artefact.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Packaging artefact contains documentation<br> Ref: §11 Packaging</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/sdk/formGenerator.ts:39-46 (x-help, x-schema-notes)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Inline help-text annotations exist on schema fields; nothing is generated or published as a documentation bundle.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Packaging artefact contains digital signature<br> Ref: §11 Packaging</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No signing mechanism exists anywhere in the codebase.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Packaging artefact contains version information<br> Ref: §11 Packaging</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/schemaRegistry.ts; each entity's own <code>*_version</code> column</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Version information is real and tracked, though not inside a packaging artefact.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Packaging artefact contains compatibility declarations<br> Ref: §11 Packaging</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:227-236</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Stored on the entity row (see FR-39.4); not part of any packaging artefact since none exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Packaging shall be deterministic<br> Ref: §11 Packaging</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:732-745,860-915</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">createPackDraft will not create a second row for an existing (code, version, tenant) triple — the top-level identity is locked. However, re-invoking it against that existing row still calls materializeContributions, whose writes to capabilities/services/authority rules/policies are upserts (packs.ts:871,897,909), not insert-only guards. Re-publishing the same version can silently change what that version contains, which is nondeterministic against the spec's intent.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Publishing verifies schema signatures<br> Ref: §12 Publishing</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No signature verification exists; consistent with the absence of signing in §11.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Publishing validates permissions<br> Ref: §12 Publishing</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">route_authority-gated publish routes (per project's route_authority mechanism, CR-110)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every publish action is gated by a badge/role check tied to a route_authority row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Publishing enforces versioning rules<br> Ref: §12 Publishing</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:319</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Version numbers are validated as semver and compared numerically to determine supersession.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Publishing updates registry metadata<br> Ref: §12 Publishing</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:760-767</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Direct update to the entity's own row, which doubles as the Registry.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Publishing publishes schema documentation<br> Ref: §12 Publishing</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/sdk/formGenerator.ts:39-46</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Only inline field-level annotations exist; nothing is generated or published as a standalone documentation artefact.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Publishing shall not modify Schema contents<br> Ref: §12 Publishing</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/schemaRegistry.ts (no update function over schema_definitions rows)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The schema_definitions table has no update path; a new version can only be inserted, never edited in place.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK supports extension through validators<br> Ref: §13 SDK Extensibility</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found; grep across src/domain/sdk and sdkAuthoring.ts for plugin/extension-point mechanisms returned no matches)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No plug-in or extension-point mechanism exists for validators. Each kind's validation logic is hand-written in its own core file.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK supports extension through project templates<br> Ref: §13 SDK Extensibility</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No scaffolding/project-template extension mechanism exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK supports extension through testing modules<br> Ref: §13 SDK Extensibility</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No pluggable test-module mechanism exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK supports extension through packaging plugins<br> Ref: §13 SDK Extensibility</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No packaging plugin mechanism exists; consistent with no packaging service existing at all.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK supports extension through publishing targets<br> Ref: §13 SDK Extensibility</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No pluggable publishing-target mechanism exists; publishing writes directly to a fixed set of Postgres tables.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❓</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK extensions shall not modify SDK core behaviour<br> Ref: §13 SDK Extensibility</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">N/A</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Not verifiable, since no extension mechanism exists to evaluate against this constraint.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK preserves version<br> Ref: §14 Traceability</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/schemaRegistry.ts; each entity's <code>*_version</code> column</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Version tracking is real at both the schema-definition and entity level.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK preserves validation results<br> Ref: §14 Traceability</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/sdkAuthoring.ts:478-487</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">validateAuthoredContent returns <code>{ok, errors}</code> synchronously to the caller; no persistence of past validation runs was found.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK preserves test results<br> Ref: §14 Traceability</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No storage of test run results exists in the application code (test results live only in CI/local test-runner output, outside the repository's runtime).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK preserves publishing history<br> Ref: §14 Traceability</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">state-transition history tables (per entity's general lifecycle, e.g. packs.ts transition recording)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An audit trail of state changes exists, but it is the entity's general lifecycle history, not an SDK-specific publishing-history record.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK preserves digital signatures<br> Ref: §14 Traceability</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No signing mechanism exists; same gap as §11/§12.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every published Schema shall be reproducible<br> Ref: §14 Traceability</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:732-745</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No packaging artefact exists to reproduce. Rebuilding a form from stored schema plus stored content is deterministic, but this is not equivalent to reproducing a published artefact as the chapter intends.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK publishes SDKElementSchemaCreated<br> Ref: §15 Events</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found; grep for "SDKElement" across src/ returned no matches)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Not implemented under this name.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK publishes SDKElementSchemaValidated<br> Ref: §15 Events</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Not implemented under this name.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK publishes SDKElementSchemaTested<br> Ref: §15 Events</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Not implemented under this name.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK publishes SDKElementSchemaPackaged<br> Ref: §15 Events</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Not implemented under this name; consistent with no packaging step existing.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK publishes SDKElementSchemaPublished<br> Ref: §15 Events</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:761 (eventType: "PackRegistered"); packs.ts:1154 (eventType: "PackTransitioned")</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A different, generic entity-lifecycle event is published instead (e.g. PackRegistered, PackTransitioned, and equivalents for the other 6 kinds). This covers a similar moment but under different names and semantics, not a rename of the specified event.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK publishes SDKElementSchemaPublicationRejected<br> Ref: §15 Events</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Not implemented under this name; failed publishes return an error result to the caller rather than emitting an event.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK supports automated pipelines<br> Ref: §16 Non-Functional</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/pack-sdk-cli.ts; package.json:12-13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Only Pack has a CLI; the other 6 kinds have no pipeline-automatable entry point besides the web form.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK supports offline development<br> Ref: §16 Non-Functional</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/sdkAuthoring.ts (validation functions query DB via ontologyDB/packsDB etc.)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every validation and authoring action requires a live database connection; there is no offline mode.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK remains platform-independent<br> Ref: §16 Non-Functional</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same as SDK-002</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No Runtime Kernel coupling found.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK produces deterministic outputs<br> Ref: §16 Non-Functional</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/schemaRegistry.ts:61-108</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">True for validation/compatibility computation. Not applicable to packaging since no packaging artefact exists, and the underlying upsert issue in §11 undermines determinism of a "published version" as a whole.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SDK supports future SDK versions<br> Ref: §16 Non-Functional</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No version identifier exists for the SDK itself, only for individual schemas and entities.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: SDK Elements can be created using Element Schema<br> Ref: §17 Acceptance Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/sdkAuthoring.ts; src/domain/sdk/formGenerator.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Confirmed working for all 7 kinds.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Validation detects structural and semantic errors<br> Ref: §17 Acceptance Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/sdkAuthoring.ts:478-487</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Confirmed.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Packaging is deterministic<br> Ref: §17 Acceptance Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:860-915</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Not met — the top-level row identity is locked, but materializeContributions upserts underlying contributions on re-publish, so a "published" version's contents can silently change.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Published Schemas are reproducible<br> Ref: §17 Acceptance Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:732-745</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Not met, for the same reason as above; no packaging artefact exists to reproduce.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: SDK supports automated build pipelines<br> Ref: §17 Acceptance Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/pack-sdk-cli.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Partially met — Pack-only CLI.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: SDK evolves independently of the Runtime Kernel<br> Ref: §17 Acceptance Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same as SDK-002</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Confirmed.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: SDK framework<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/sdkAuthoring.ts; per-kind core files (packs.ts, templates.ts, profiles.ts, etc.)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Present as 7 separate hand-written pipelines tied together by a thin dispatcher, not one shared framework.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Project generator<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No scaffolding tool exists to start a new Element from scratch.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Validation framework<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/sdkAuthoring.ts:478-487; src/domain/sdk/formGenerator.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Present.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Testing framework<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">tests/sdk-authoring.test.ts; tests/pack-sdk.test.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Present, but tied to a live database rather than isolated, per §10 finding.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Packaging service<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found as a distinct service)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Not implemented as a distinct service; see §11 findings for what partially substitutes for it.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Publishing service<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:760-767</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Present.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: SDK documentation<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found as generated/maintained documentation)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Not found as a generated or maintained document; only inline code comments exist.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Reference schemas<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">schema_definitions seed rows for all 7 kinds (per src/routes/seu/core/schemaRegistry.ts and seed data)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Present.</td>
    </tr>
  </tbody>
</table>
## Summary

- **Total intents analysed**: 76
- **Fully met**: 31
- **Partially met**: 25
- **Not met**: 36
- **Not verifiable**: 5

**Major implementation gaps**:

1. **Packaging (§11) is not implemented as a distinct artefact.** No package file, manifest, digital signature, or documentation bundle exists. Worse, the top-level row-locking that does exist (`createPackDraft`) is undermined by `materializeContributions` performing upserts on re-publish of an already-published version, so a "published" version's underlying contributions can be silently overwritten — directly contradicting §17's determinism and reproducibility acceptance criteria.
2. **SDK Extensibility (§13) does not exist.** No plug-in mechanism for validators, project templates, testing modules, packaging plugins, or publishing targets was found anywhere in the codebase.
3. **The six named SDK events (§15) do not exist.** Generic entity-lifecycle events (`PackRegistered`, `PackTransitioned`, and equivalents) are published instead, covering similar moments under different names and semantics.
4. **Testing (§10) contradicts its own independence requirement.** Both test suites run against a live Postgres database and the real transitionEngine/compositionEngine, not isolated fixtures.
5. **Non-functional requirements for offline development and SDK self-versioning (§16) are not met.** Every action requires a live database connection, and there is no version identifier for the SDK itself.
6. **Dependency and compatibility validation (FR-39.3, FR-39.4) are inconsistently implemented across the 7 element kinds.** Pack dependencies are a flat list with existence-checking only; Template has a real dependency graph with cycle detection. Pack's platform-version compatibility fields are captured and stored but never enforced by any code path.
7. **No single `SdkElement` abstraction exists (§8).** Each of the 7 kinds is implemented as its own hand-written pipeline in its own core file, tied together only by a thin dispatcher in `sdkAuthoring.ts`.
