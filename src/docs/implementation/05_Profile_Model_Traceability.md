# Implementation Traceability: Chapter 5 – Profile Model

**Date of report: 23-10-2026**

Specification: src/docs/SEU Studio Specifications/01_Engineering Definition/05_Profile.md

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Profile is reusable commissioning configuration for a Template. It holds no runtime state.<br>Ref: §1 Purpose, §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/profiles_schema_recovery.sql:3-12,16,20-21<br>src/dblayer/seuTypes.ts:301-319</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The profiles row holds identity, base Template, environment, status, version, parent and draft_content. It holds no execution state. One Profile row is referenced by many SEUs through seus.profile_id (seus_schema_recovery.sql:7).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Profile contributes configuration and no engineering behaviour. Behaviour comes from Packs and is composed into the EBM.<br>Ref: §1, §3, §5 (last paragraph)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:130-166,204-256<br>src/domain/engine/compositionEngine.ts:229-259</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Profile fields enter the composition pool only as configuration values. Capabilities, services, gates, policies and checklists are pooled only from composed Packs. The Composition Engine receives the Profile's Pack codes and resolves Active Packs.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Profile shall not define engineering practices, governance rules, quality rules, participant implementations or runtime workflows.<br>Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/profiles.ts:26-63<br>src/dblayer/seed/data/schemaDefinitions.json (Profile schema, no additionalProperties)<br>src/routes/seu/core/profileWriteValidator.ts:17-40</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the seed shape and the Profile schema define only configuration fields, and every write is validated against that schema.<br>Gap: the Profile schema does not set additionalProperties:false, so draft_content accepts keys outside the grammar. No check rejects behavioural content stored under an unlisted key.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Profile may define methodology, organisations, selected Packs, technologies, compliance, deployment targets, environment configuration, commissioning parameters, feature selections and optional capabilities.<br>Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/profiles.ts:26-63,174-184,189-196,219-298</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">ProfileSeedInput carries developmentMethodology, participatingOrganisationCodes, six Pack lists, deploymentTargets, environmentConfiguration, nine configuration parameters, featureFlagCodes and additionalCapabilityCodes. validateProfileSeed checks each against the Ontology or the Pack registry.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every commissioned SEU references exactly one Profile.<br>Ref: FR-5.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/seus_schema_recovery.sql:7<br>src/routes/seu/core/commissioning.ts:111-117,143-150<br>src/dblayer/seusDB.ts:16-27</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">seus.profile_id is a single NOT NULL foreign key. initiateSeu refuses to create an SEU without a chosen Profile and stores the chosen profile id. A second Profile cannot be attached.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Profiles are independently versioned.<br>Ref: FR-5.2, §13, §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/profiles_schema_recovery.sql:20,23-25<br>src/routes/seu/core/profiles.ts:224-225,449-456,502-515</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">profile_version is a column with UNIQUE(code, profile_version, tenant_id). The version is validated as semver. copyProfileAsNewDraft creates the next free patch version of the same code as a new row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Historical Profile versions remain available.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/profiles.ts:413-423<br>src/dblayer/profilesDB.ts:275-285<br>src/dblayer/seed/data/transitionDefinitions.json:1420-1446</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Activating a new version moves the previous Active row to Deprecated through the governed transition. The row is kept, and the lifecycle continues to Retired and Archived. findByCodeAndVersion reads any version.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every commissioned SEU permanently references the Profile version used at commissioning.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seusDB.ts:16-27<br>src/dblayer/ebmsDB.ts:9,22-28<br>src/routes/seu/core/commissioning.ts:44-49,95-97</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: seus.profile_id and ebms.profile_id point at one specific versioned row, and rows are not deleted by the flow.<br>Gap: the reference is honoured but not treated as permanent. checkEbmLiveness reports the Profile dead when its status is not Active, so a Deprecated version drives the EBM to Retired on Validate. Nothing records the version string on the SEU itself.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Profiles support inheritance.<br>Ref: FR-5.3, §9, §16, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/sdkAuthoring.ts:629-660,761-796<br>src/routes/seu/core/profiles.ts:339-346<br>src/dblayer/recovery/profiles_schema_recovery.sql:21<br>tests/sdk-authoring.test.ts:711-758</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: a Draft can be started from an Active parent. parent_profile_id is stored. The parent's configuration and Pack selections are copied into the Draft as its starting content. The derived Profile keeps the parent's code.<br>Gap: inheritance is copy at creation only. The test at tests/sdk-authoring.test.ts:711 confirms the Draft takes the parent's code, the inheriting tenant, the recorded parent_profile_id and a fresh 1.0.0 version, and says nothing about later parent changes. Nothing reads parent_profile_id after creation (the column is read only to carry it into copies and to check the code). Composition does not walk a parent chain, and later parent changes do not reach the derived Profile.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A derived Profile may add Packs, remove optional Packs, override configuration values and introduce new parameters.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/sdkAuthoring.ts:1057-1087<br>src/routes/seu/core/profiles.ts:530-546</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the derived Draft is fully editable, so Packs can be added or dropped, values changed and overrides added. Pack selections are rebuilt per list on publish.<br>Gap: the result is a full copy. No delta (added, removed, overridden) is recorded against the parent, so the operations named in §9 cannot be told apart from the stored content.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A derived Profile shall not modify its parent.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/sdkAuthoring.ts:629-637,782-796<br>src/routes/seu/core/profiles.ts:339-346<br>tests/sdk-authoring.test.ts:756-758</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The parent is read only. A new row is inserted for the derived Profile. The parent must be Active and visible to the tenant. validateProfileOnSave checks the parent exists and shares the code. The test at tests/sdk-authoring.test.ts:756-758 asserts the parent stays Active and untouched after a tenant inherits from it.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Profiles remain immutable after publication.<br>Ref: FR-5.4, §16, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/profilesDB.ts:135-166,107-133,309-324<br>src/routes/seu/core/sdkAuthoring.ts:1057-1081<br>src/routes/seu/core/profiles.ts:453-516</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the authoring save path uses updateDraftContent, which updates only rows in Draft (profilesDB.ts:159). Changes to a published Profile go through copyProfileAsNewDraft, which makes a new Draft row.<br>Gap: setDraftContent (:107), setPackSelection (:309), upsert (:10) and updateStatus (:169) have no state guard. setDraftContent and setPackSelection are called on a Validated row inside the Publish action (unravelProfile.ts:16, profiles.ts:536-543), by design. Immutability afterwards rests on callers.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Profiles support parameter substitution.<br>Ref: FR-5.5, §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/profiles.ts:65-115,353-364,530-546<br>src/domain/engine/profileCompositionUnravel.ts:183-202<br>src/policies/materialiseProfile.ts:5-15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: exposedParameterOverrides replace the base Template's overridable parameter values. Effective values are resolved per parameter and pooled with the Profile as source. Override values are checked against the Template's allowed options at validate and publish.<br>Gap: substitution covers only parameters the Template flags overridable. The nine configuration parameters are pooled as values. The only consumers found are the competency union for language and domain (profileCompositionUnravel.ts:51-63), the EBM pool, and the work item context. Nothing substitutes them into Pack content.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Parameter semantics are defined by the consuming Pack.<br>Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/profiles.ts:174-184,260-266<br>src/domain/engine/workItemGenerator.ts:70-84</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: parameter values are validated against Ontology concepts, which carry meaning, and are surfaced to execution as profileConfiguration.<br>Gap: no Pack-side declaration of which Profile parameters it consumes was found, so consumption is not defined by the Pack.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Profiles support organisation-specific Pack selection and identify the participating organisations.<br>Ref: FR-5.6, §12, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/profiles.ts:42-43,55,189-196,241-248,268-271<br>src/dblayer/profilesDB.ts:309-354<br>src/domain/engine/compositionEngine.ts:235-241</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">organisationPackCodes and engineeringPackCodes are stored per list in profile_packs, each Pack checked against its category. participatingOrganisationCodes are validated against the participating-organisations Ontology. All selected Pack codes feed compose as required Packs. The Composition Engine decides how they combine.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Profile specifies what participates and the Composition Engine determines how it is combined.<br>Ref: §12, §3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:229-259<br>src/domain/engine/profileCompositionUnravel.ts:104-128</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Profile supplies Pack codes only. Strategy, dependency closure, Active resolution and conflict detection are in the Composition Engine and the unravel function.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Profiles support environment-specific configuration.<br>Ref: FR-5.7, §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/profiles.ts:223,56<br>src/domain/engine/profileCompositionUnravel.ts:134,145<br>src/domain/engine/workItemGenerator.ts:70-84<br>src/routes/seu/core/commissioning.ts:418-419</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: environment is required and stored on the row. environmentConfiguration is pooled into the EBM and surfaced to work items as profileConfiguration.<br>Gap: environment is a single value per Profile. One Profile row does not hold differing configuration per environment. Environment variants are separate Profile rows. Auto-selection in commissioning.ts:419 prefers the development Profile.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Profile defines Identifier, Name, Description, Version, Base Template, Selected Packs, Technologies, Domains, Compliance Packs, Integration Packs, Environment, Configuration Parameters, Feature Flags and Composition Options.<br>Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:301-319<br>src/routes/seu/core/profiles.ts:26-63<br>src/dblayer/seed/data/schemaDefinitions.json (Profile schema required: name, baseTemplateCode, environment, profileVersion)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All fields exist. Description, feature flags and composition options are optional keys in draft_content.<br>Gap: §7 says every Profile shall define them. The schema requires only name, baseTemplateCode, environment and profileVersion.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Profiles enable or disable optional platform capabilities. Feature selection shall not modify platform architecture.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/profiles.ts:36,250-258<br>src/domain/engine/profileCompositionUnravel.ts:147-148,163-165<br>src/routes/seu/core/commissioning.ts:68-76</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: featureFlagCodes are validated against the feature-flag Ontology and pooled into the EBM. additionalCapabilityCodes are validated, pooled as capabilities and liveness-checked at commissioning.<br>Gap: featureFlagCodes have no consumer. They are pooled as one value and nothing found enables or disables a platform feature from them. The workItemGenerator context list (:70-75) omits them.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Profile categories (Startup, Enterprise, Healthcare, Banking, Prototype, Production) are available.<br>Ref: §8 (illustrative)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/profiles_schema_recovery.sql:22<br>src/dblayer/profilesDB.ts:189-211</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A category column exists and list queries sort by it. No category values, no seed Profiles named for these categories and no category-driven behaviour were found; the Profile schema has no category field. The section is illustrative and carries a remark in the spec asking why categories are not implemented.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Profile lifecycle is Draft, Validated, Published, Active, Deprecated, Retired, Archived.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1370-1446<br>src/domain/engine/entityAdapters.ts:177-192<br>src/routes/seu/core/profiles.ts:426-439</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A transition_definitions row exists for each forward hop. All are manual, with a verb, policies and a version event. A Validated to Draft reject hop with a required comment also exists. The adapter applies the state change. tests/profile-event-lifecycle-table.test.ts:127-143 check every row, and :231-240 check Draft cannot skip to Published and no state returns to Active.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Validation and publication of a Profile check its content and set its configuration up for commissioning.<br>Ref: §14 (Validated, Published), §18 Profile lifecycle services</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1384,1394-1395<br>src/policies/materialiseProfile.ts:5-15<br>src/actions/unravelProfile.ts:6-18<br>src/routes/seu/core/profiles.ts:530-546<br>tests/profile-event-lifecycle-table.test.ts:308-329</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Validate requires policy-validate-schema and policy-materialise-profile. Publish requires policy-validate-schema and policy-ontology-values-present, and runs unravel-profile, which writes Pack selections and drops overrides the Template does not flag. tests/profile-event-lifecycle-table.test.ts:308-329 confirms nothing is written at creation or Validate, the Pack selection is written at Publish, and an unflagged override is dropped.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Profile subsystem publishes ProfileCreated, ProfileValidated, ProfilePublished, ProfileActivated, ProfileDeprecated, ProfileRetired.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1375,1385,1396,1415,1425,1435<br>src/routes/seu/core/profiles.ts:399-408<br>src/domain/engine/entityTransition.ts:83-93</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the five transition events publish under the specified names through publishTransition. The birth event is published with the real actor and badge.<br>Gap: the creation event is named ProfileDefined, not ProfileCreated. tests/profile-event-lifecycle-table.test.ts:143 asserts there is no ProfileCreated. ProfileRejected and ProfileArchived are published in addition.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Profiles remain independent of runtime execution.<br>Ref: §2, §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/profiles_schema_recovery.sql:3-28<br>src/domain/engine/profileCompositionUnravel.ts:130-166</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Profile row holds no execution state. Composition reads it and writes to the EBM pool, not back to the Profile.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Profiles support deterministic commissioning.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:229-279<br>src/domain/engine/profileCompositionUnravel.ts:104-128<br>src/routes/seu/core/commissioning.ts:418-419</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the same Profile and Pack set composes through the same engine, and override disagreements between Profiles are detected and reported rather than resolved silently.<br>Gap: no test of repeated composition from one Profile was found (tests/profile-composition-strategies.test.ts covers Pack composition strategies on Packs only). Pack resolution depends on whichever version is Active at the time.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Profiles can be created and versioned.<br>Ref: §17 AC1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/profiles.ts:368-410,453-528<br>src/routes/seu/core/sdkAuthoring.ts:686-810</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">createProfileDraft and the authoring draft path create Drafts from the birth row with a unique code/version/tenant. copyProfileAsNewDraft creates the next version. tests/profile-event-lifecycle-table.test.ts:180-206 drive creation, copy and publish.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Profiles configure commissioning without defining engineering behaviour, support Pack selection and support organisation composition.<br>Ref: §17 AC3-5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/profiles.ts:189-217,241-248<br>src/domain/engine/compositionEngine.ts:235-241<br>src/domain/engine/profileCompositionUnravel.ts:104-166</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">See the §5, §12 and FR-5.6 rows. Pack selection and organisation lists are stored, validated and composed. Behaviour is pooled from Packs only.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Multiple SEUs can be commissioned from the same Template using different Profiles.<br>Ref: §17 AC6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:111-150<br>src/routes/seu/core/profiles.ts:21-24<br>tests/commission-profile-choice.test.ts:141</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Template is derived from the chosen Profile's base_template_id, and many Profiles may share one Template. The only uniqueness constraint is one SEU per Objective (commissioning.ts:130-135). The test at tests/commission-profile-choice.test.ts:141 publishes two Profiles on one Template (plain, and one selecting technology-nodejs), checks both are offered, then commissions the nodejs Profile through to Active.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables: domain model, registry, inheritance model, configuration parameter model, versioning services, lifecycle services, APIs and events.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/web/profileRegistry.ts:21-79<br>src/dblayer/seed/data/routeAuthority.json:379-385<br>src/routes/seu/api/index.ts:6-40</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: domain model, registry page with list controls, copy action, parameter model, versioning, lifecycle and events (rows above).<br>Gap: no Profile API. routeAuthority.json:380-385 has a row for POST /aisworg/api/seu/profiles with no badges or roles, and src/routes/seu/api has no Profile router mounted. The inheritance model is copy only (see FR-5.3).</td>
    </tr>
  </tbody>
</table>

## Summary

- Total intents analysed: 29
- Fully met: 15
- Partially met: 13
- Not met: 1
- Not verifiable: 0

Major implementation gaps:
- Inheritance is a copy at creation. parent_profile_id is not read afterwards, and no add, remove or override delta is stored.
- Feature flags are validated and pooled but nothing consumes them.
- The nine configuration parameters are pooled but not substituted into Pack content, and Packs do not declare which parameters they consume.
- Immutability after publication is held by callers. Only updateDraftContent carries a Draft guard.
- The Profile schema does not close additionalProperties, and requires only four fields where §7 lists fourteen.
- Deprecated Profile versions retire the EBMs that reference them, which departs from a permanent version reference.
- The creation event is ProfileDefined, not ProfileCreated.
- No Profile API exists; its route_authority row has no handler.
- Profile categories have no values or behaviour.
