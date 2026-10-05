# Chapter 7 – Profile Model: Implementation Traceability

**Date of report: 4-10-2026**

Note: Chapter 7 §19 already carries an extensive, owner-maintained "Implementation Specifics" log (last updated 2026-09-06). This traceability pass independently re-verified the current code against §§1–18's own normative intents, and found the code has in places moved **past** what §19's own narrative still says — those divergences are called out explicitly below rather than silently repeated.

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Profile specifies the variable commissioning parameters for a Template, contributing configuration, not engineering behaviour<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/profiles.ts:87-181 (ProfileSeedInput)<br>src/domain/engine/compositionEngine.ts:370-455</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Profile's authored fields (Pack selections, Configuration Parameters, feature flags) are consumed only as composition inputs (Pack codes to resolve, competency values to union); no Profile field injects governance/engineering-practice logic itself.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every commissioned SEU shall reference one Profile (FR-7.1)<br> Ref: §6 FR-7.1, §7 Base Template</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/profilesDB.ts (profiles.base_template_id NOT NULL)<br>migration 002 (ebms.profile_id NOT NULL REFERENCES profiles(id))</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Structural FK guarantees, not just convention. The Profile→Template reference is pinned by row id at authoring time (CR-024 decision), never re-resolved.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Profiles shall be independently versioned (FR-7.2)<br> Ref: §6 FR-7.2, §13 Versioning</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/profiles.ts:608-706 (publishProfile)<br>migration 064 (profiles_code_version_tenant_key UNIQUE(code, profile_version, tenant_id))</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A publish under a new (code, profileVersion, tenantId) creates a genuinely new, immutable row; a repeat under the same key is idempotent. Historical versions remain queryable (profilesDB.findByCodeAndVersion / findAll).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every commissioned SEU shall permanently reference the Profile version used at commissioning (§13)<br> Ref: §13 Versioning</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">migration 002 (ebms.profile_id FK to immutable profiles row)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Because Profile rows are now immutable per version (no more overwrite-in-place), ebms.profile_id resolving a fixed row is sufficient on its own — no separate "pinned version" column is needed.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Profiles shall support inheritance (FR-7.3); derived Profiles keep parent's code, may add/remove optional Packs and override values, and shall not modify the parent (§9)<br> Ref: §6 FR-7.3, §9 Profile Inheritance</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/profiles.ts:594-601 (parentProfileId identity-lock check)<br>src/routes/seu/core/profiles.ts (listInheritableProfiles/inheritedProfileContent, core/sdkAuthoring.ts)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Derived Profile's <code>parentProfileId</code> is set once at Draft creation and the code is locked to the parent's own code (disambiguated by tenant_id). Profile has no "mandatory Pack" concept, so §9's "remove optional Packs" is allowed by construction, not a special case. Parent rows are never written to by a derived Draft.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Profiles shall remain immutable after publication (FR-7.4, §16)<br> Ref: §6 FR-7.4, §16 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/profiles.ts:608-706 (publishProfile idempotent-reseed path)<br>migration 064 unique key</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A second publish at the same (code, version, tenant) is a no-op reseed, never an overwrite; a changed version/tenant is a new row. No code path updates an Active/terminal row's authored content in place.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Profiles shall support parameter substitution (FR-7.5)<br> Ref: §6 FR-7.5, §10 Configuration Parameters</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/profiles.ts:233-274 (resolveEffectiveParameters)<br>src/domain/engine/compositionEngine.ts:443-486 (detectParameterOverrideConflicts)<br>src/domain/engine/profileCompositionUnravel.ts:216-249</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Profile's <code>exposedParameterOverrides</code> (Service Level metric / Policy constraintType) resolve against the base Template's own flagged-overridable candidates and feed a real effective-value computation, with cross-Profile disagreement surfaced as a structured conflict at the Validation page. Gap: the list/filter-shaped exposable candidates (Policy applicability dimensions, Checklist configurableKey) have no value-setting mechanism anywhere yet (Template itself never exposes a settable value for those either).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Profiles shall support organisation-specific Pack selection (FR-7.6)<br> Ref: §6 FR-7.6, §12 Organisation Composition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/profiles.ts:390-425 (PACK_SELECTION_SLOTS / getProfilePackSelections)<br>src/domain/engine/compositionEngine.ts:403-421</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All six category-scoped Pack slots (Technology/Domain/Compliance/Integration/Engineering/Organisation) plus the flat <code>optionalPackCodes</code> are authored, validated against the Pack's own category, and **now read back into <code>compositionEngine.compose()</code>** — resolved into the composed Pack set, not merely stored. This supersedes Chapter 7 §19.7's own "silently ignored at commissioning" finding (dated 2026-09-05); the gap it logged has since been closed in code without a corresponding update to §19.7's narrative.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Profiles shall support environment-specific configuration (FR-7.7)<br> Ref: §6 FR-7.7, §7 Environment</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/profiles.ts (profiles.environment NOT NULL column)<br>src/domain/engine/profileCompositionUnravel.ts:224-226 (environment carried into pool)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>environment</code> is a required column, carried into the conflict-detection/EBM pool alongside every other Configuration Parameter. Its one other reader, <code>findOrCreateDefaultProfile</code>-style default-profile selection, uses it to prefer a "development" Profile; no composition behaviour is conditioned on its value beyond that.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Profile shall define the 14 listed fields (§7 Profile Structure)<br> Ref: §7 Profile Structure</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/profiles.ts:87-181 (ProfileSeedInput)<br>migrations 064/065/066/174-176/196/199/229/246</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All 14 named fields (Identifier, Name, Description, Version, Base Template, Selected Packs [×6 categories], Selected Technologies/Domains/Compliance/Integration Packs, Environment, Configuration Parameters [9 fields], Feature Flags, Composition Options) are real, schema-registered, authored fields. Two §5 items with no §7 counterpart (Deployment Targets, Optional Capability Enablement) were separately added under CR-091.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Profile Categories are illustrative (§8)<br> Ref: §8 Profile Categories</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">CR-091 Part 3 retired the <code>category</code> field from active use entirely ("Profile is not supposed to be restrictive," owner) — the column and Ontology rows are left in place but unused. The chapter itself records this; no further code investigation changes the conclusion.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Profiles may enable/disable optional platform capabilities without modifying platform architecture (§11 Feature Selection)<br> Ref: §11 Feature Selection</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/profiles.ts (featureFlagCodes, Ontology-backed "feature-flag" concept)<br>src/domain/engine/profileCompositionUnravel.ts:238 (featureFlagCodes carried into pool)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>featureFlagCodes</code> is authored, validated against a real Ontology concept type, and carried into the EBM composition pool. "Shall not modify platform architecture" is satisfied by omission: nothing in <code>compositionEngine.ts</code>/<code>commissioning.ts</code> branches on a feature flag's value to alter composed behaviour — the flags are inert data riding alongside the composition, not yet consumed by any conditional logic.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Profile specifies what participates; the Composition Engine determines how they are combined (§12)<br> Ref: §12 Organisation Composition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:403-429 (byCode dedup)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Confirmed by the actual merge strategy: Profile contributes a flat set of selected Pack codes across all seven slots; the Composition Engine's own <code>byCode</code> map performs the actual combination (plain upsert-by-code dedup, not a Profile-driven ordering).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Profile subsystem shall publish ProfileCreated/Validated/Published/Activated/Deprecated/Retired (§15 Events)<br> Ref: §15 Events</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/profiles.ts:683-696 (ProfileCreated, publishProfile)<br>src/routes/seu/core/profiles.ts:752-761 (transitionProfile, event_type read off TransitionOutcome, migration 187)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All six named events, plus an unlisted <code>ProfileArchived</code>, are published from real transition/publish entry points with a real actorId/badge on every call — no <code>?? null</code> fallback found at either publish site.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Profile lifecycle: Draft → Validated → Published → Active → Deprecated → Retired → Archived (§14)<br> Ref: §14 Lifecycle</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/profiles.ts:994-1021 (AUTHORING_NEXT_STATE / advanceProfileOneStep)<br>src/routes/seu/core/profiles.ts:721-896 (TERMINAL_REACTIVATABLE_STATES / reactivateAsNewVersion)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All seven states and six forward hops exist and are authority-gated (noun × verb, e.g. profile_publish) via transitionEngine. Reactivating a terminal Profile back to Active creates a new immutable Version rather than resurrecting the old row, and supersedes whatever else is Active for that code within the tenant.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Non-functional: Profiles remain reusable, support inheritance, remain immutable after publication, support deterministic commissioning, remain independent of runtime execution (§16)<br> Ref: §16 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(see FR-7.2/FR-7.3/FR-7.4 rows above)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The first three are established by the rows above. "Deterministic commissioning" has no dedicated evaluation point of its own — composition/commissioning is a pure function of (Template, Profile, resolvedParameterOverrides) with no hidden randomness found in <code>compositionEngine.ts</code>/<code>commissioning.ts</code>. "Independent of runtime execution" holds: Profile rows carry no runtime/EBM state.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Profiles can be created and versioned (§17)<br> Ref: §17 AC 1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/profiles.ts:608-706</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Covered by FR-7.2/FR-7.4 rows.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Profiles support inheritance (§17)<br> Ref: §17 AC 2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/profiles.ts:594-601</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Covered by FR-7.3 row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Profiles configure commissioning without defining engineering behaviour (§17)<br> Ref: §17 AC 3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/profiles.ts:87-181</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No Profile field feeds a governance/engineering-practice decision directly; all behavioural content still originates from composed Packs.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Profiles support Pack selection (§17)<br> Ref: §17 AC 4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/profiles.ts:390-425<br>src/domain/engine/compositionEngine.ts:403-421</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Covered by FR-7.6 row — now reaching the composed EBM, not just authoring.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Profiles support organisation composition (§17)<br> Ref: §17 AC 5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/profiles.ts (organisationPackCodes, CR-091 Part 1)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Organisation Composition maps onto <code>organisationPackCodes</code> (owner-confirmed mapping, CR-091 Part 3) and is now composed (see FR-7.6 row). No separate multi-tenant mechanism exists; participating third-party organisations are onboarded as Packs under the primary tenant, by design.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Multiple SEUs can be commissioned from the same Template using different Profiles (§17)<br> Ref: §17 AC 6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts (templateIds/profileIds passed independently to compositionEngine.compose)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>compose()</code> takes <code>templateIds</code>/<code>profileIds</code> as independent arrays; nothing ties a Template to one specific Profile. Not verified against a live commissioning run (would require DB state), but no structural coupling prevents it.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables: Profile domain model, registry, inheritance model, configuration parameter model, versioning services, lifecycle services, Profile APIs, Profile events (§18)<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/web/profileRegistry.ts (Registry page)<br>src/routes/seu/core/profiles.ts (domain model/services)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Domain model, inheritance, versioning, lifecycle, and events are all real (see rows above). The Registry exists only as a web UI page (<code>web/profileRegistry.ts</code>), reading through <code>core/profiles.ts</code> directly. **No <code>routes/seu/api/profiles.ts</code> exists at all** (confirmed by direct file search) — Chapter 7 §19.10 still describes a "thin POST /profiles route" that no longer exists in the tree; the API deliverable has gone from thin to absent, a further divergence from §19's own narrative, not reflected there.</td>
    </tr>
  </tbody>
</table>
## Summary

- Total intents analysed: 23
- Fully met: 17
- Partially met: 5 (FR-7.5 parameter substitution for list/filter-shaped candidates; FR-7.7 environment as inert field beyond default-selection; §11 Feature Selection flags uncomsumed by composition logic; §18 Profile APIs now fully absent as a REST surface)
- Not met: 1 (§8 Profile Categories — deliberately retired)
- Not verifiable: 0

## Major divergence from Chapter 7 §19's own narrative

Two of §19's own findings are now stale relative to the current code, independent of this pass's own investigation:

1. **§19.7's "silently ignored at commissioning" finding (2026-09-05) no longer holds.** `compositionEngine.compose()` (src/domain/engine/compositionEngine.ts:403-421) now reads all seven Profile Pack-selection slots (`optionalPackCodes` plus the six category-scoped fields), not just the original flat `optionalPackCodes`. The fix is in code; §19.7's text was not updated to reflect it.
2. **§19.10's "API remains thin" finding is now understated.** `routes/seu/api/profiles.ts` does not exist in the current tree at all — the Profile API surface went from "thin" to "none," with the Registry and all authoring reachable only through web routes.

Both are logged here as findings rather than silently repeating §19's outdated text, per this chapter's own §19.11 convention of correcting prior entries once the owner or code moves past them.
