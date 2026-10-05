# Chapter 38 — Pack SDK Architecture: Implementation Traceability

**Date of report: 4-10-2026**

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every engineering behaviour/governance/domain capability/customisation is introduced through Packs, not Runtime Kernel changes<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:294-710 (validatePackSeed)<br>src/domain/engine/compositionEngine.ts:370-456 (compose)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Pack contributions (capabilities, services, authority rules, policies, quality gates, review gates, checklists, obligation definitions, engineering capital, competencies) are the declared extensibility surface; <code>transitionEngine</code>/<code>compositionEngine</code> consume them generically, never a hardcoded Pack.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Pack SDK is the extensibility layer between Platform Core and Runtime Kernel<br> Ref: §3 Architectural Position</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:1-17 (header)<br>src/domain/engine/compositionEngine.ts:370-456</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>validatePackSeed</code>/<code>publishPack</code>/<code>materializeContributions</code> form the authoring+publish pipeline; <code>compositionEngine.compose</code> resolves Packs into the EBM the Runtime Kernel consumes. Header comment explicitly scopes this as "this MVP's Pack SDK (Ch.39, scoped down)" — several cuts named inline (see later rows).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Pack is a versioned, declarative package contributing engineering behaviour/metadata<br> Ref: §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packsDB.ts:23-95 (create)<br>src/dblayer/recovery/packs_schema_recovery.sql</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>packs</code> row holds <code>code</code>, <code>pack_version</code>, <code>contributions</code> (JSONB), <code>status</code>. Versions are immutable inserts (VM-002), never mutated once past Draft.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Runtime Kernel consumes the composed result via EBM; never interprets individual Packs directly<br> Ref: §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:370-456</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>compose()</code> returns <code>composedPacks</code>/<code>compositionReport</code>; downstream (commissioning) reads only this composed result, not individual Pack rows.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PP-001: Runtime Kernel remains Pack-agnostic<br> Ref: §5 PP-001</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:370-456</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition is the single seam; no Runtime Kernel code branches on a specific Pack code found in the repo's commissioning paths reviewed.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PP-002: every Pack independently versioned<br> Ref: §5 PP-002</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packsDB.ts:23-46, 241-251</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>(code, pack_version, tenant_id)</code> is the real unique identity (<code>packs_code_version_tenant_key</code>); <code>findByCodeAndVersion</code> enforces lookups against it.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PP-003: Pack composition deterministic<br> Ref: §5 PP-003</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:370-456</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>resolveActivePack</code> always resolves a code to the one Active row; <code>compose()</code> has no randomness/time-dependence; same Template/Profile set in, same <code>composedPacks</code> out.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PP-004: Packs independently deployable<br> Ref: §5 PP-004</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:737-880 (createPackDraft, advancePackLifecycle, publishPack)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each Pack advances its own lifecycle (Draft→Validated→Published→Active) independently via <code>transitionPack</code>, with no cross-Pack deployment coupling beyond declared dependencies.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PP-005: Packs never directly modify platform services<br> Ref: §5 PP-005</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:882-1090 (materializeContributions)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Pack writes only into Pack-scoped contribution tables (<code>capabilities</code>, <code>services</code>, <code>policies</code>, <code>quality_gates</code>, etc.) via each table's own DB-layer function; no Pack code path writes to platform service internals directly.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PP-006: platform evolution occurs primarily through new Packs<br> Ref: §5 PP-006</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:294-710</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">New engineering behaviour is added by publishing new/updated Pack contributions rather than code changes, for the contribution kinds this SDK supports.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-38.1: every Pack has globally unique identifier, semantic version, type, dependency declaration, compatibility declaration<br> Ref: §6 FR-38.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:207-236 (PackSeedInput)<br>src/routes/seu/core/packs.ts:272, 324 (SEMVER_RE)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>code</code>/<code>category</code>(type)/<code>packVersion</code>(semver-validated)/<code>dependencies[]</code> all present and validated. No distinct "compatibility declaration" field exists — Compatibility Matrix is explicitly marked "Not implemented" at §8.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-38.2: platform supports concurrent versions of compatible Packs; only one active<br> Ref: §6 FR-38.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packsDB.ts:268-285 (findActiveByCode)<br>src/routes/seu/core/packs.ts:795-810 (supersede on activate)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Multiple versions of a code coexist as rows (Published/Retired/Archived); activating a new version transitions the prior Active row to Retired, enforcing exactly one Active per (code, tenant). "Compatible" is not actually evaluated — any version can be concurrent regardless of declared compatibility (none exists).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-38.3: Pack compatibility validated before activation<br> Ref: §6 FR-38.3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No compatibility check runs anywhere in <code>transitionPack</code>/<code>advancePackLifecycle</code>/<code>publishPack</code>. §12 itself states compatibility rules are "Not implemented yet."</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-38.4: Pack dependencies resolved automatically<br> Ref: §6 FR-38.4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:699-707 (validatePackSeed dependency check)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Only a *required* dependency's existence in the Registry is checked at author time (<code>packsDB.findByCode</code>); there is no automatic pulling-in of a dependency's own contributions during composition — <code>compositionEngine.compose</code> resolves only the Pack codes a Template/Profile explicitly lists, not a dependency closure.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-38.5: Pack conflicts detected before commissioning an SEU<br> Ref: §6 FR-38.5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:436-449 (compose), 498-520+ (detectGovernanceConflicts)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>compose()</code> runs <code>detectGovernanceConflicts</code> (cross-Pack authorisedRole/quality-gate clashes) and <code>detectParameterOverrideConflicts</code> (cross-Profile parameter clashes) before the EBM is finalized, and returns them as a blocking report.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-38.6: Pack activation preserves engineering continuity where possible<br> Ref: §6 FR-38.6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:795-810, 831-849</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Activating a new version supersedes (Retires) the old Active row rather than deleting it; prior version history remains queryable (<code>findVersionsByCode</code>). No explicit "continuity" logic beyond this (e.g. no migration of in-flight SEUs between Pack versions) exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-38.7: Pack lifecycle operations fully traceable<br> Ref: §6 FR-38.7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:765-776, 1184-1196 (eventBus.publish calls)<br>src/dblayer/packsDB.ts:437-463 (addComment/getComments)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every transition publishes an event carrying real <code>actorId</code>/<code>authorityBadge</code>; Reject requires a persisted comment. Lifecycle history is reconstructable from the <code>events</code> table per pack id.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Pack Taxonomy: Platform/Organisation/Customer/Domain/Technology/Capability/Profile/Template Packs supported; new categories added without Kernel change<br> Ref: §7 Pack Taxonomy</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/ontology.ts (assertCanonicalCategory, category:pack)<br>src/routes/seu/core/packs.ts:298-323</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>category</code> is Ontology-backed (<code>category:pack</code> concept), not a hardcoded enum — adding a new category is a data change, matching "introduced without modifying the Runtime Kernel." Seed data (<code>src/dblayer/seed/data/*.pack.json</code>) demonstrates all named taxonomy examples (Domain, Technology, Compliance, Integration, SDLC-phase, etc.) actually exist as Packs.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Templates and Profiles kept as separate entities but reuse the same SDK (remark)<br> Ref: §7 remark</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/templates.ts, src/routes/seu/core/profiles.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Template/Profile have their own entity tables and lifecycle, distinct from Pack, but both reference Pack codes and compose through the same <code>compositionEngine</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Pack Structure: Identifier, Name, Version, Publisher, Description, Dependencies, Compatibility Matrix, Declared Contributions, Lifecycle State, Digital Signature, Metadata<br> Ref: §8 Pack Structure</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:207-251 (PackSeedInput, packMetadataFromSeed)<br>src/dblayer/packsDB.ts:23-46</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Identifier/Name/Version/Dependencies/Contributions/Lifecycle State are real, validated fields. Publisher/Description are free-text metadata (<code>metadata</code> JSONB), never verified. Compatibility Matrix and Digital Signature are explicitly marked "Not implemented" in the spec itself and are absent from the schema.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Pack Lifecycle: Defined → Validated → Published → Activated → Retired → Archived; history permanently available<br> Ref: §9 Pack Lifecycle</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/web/packs.ts:14-16 (PACK_STATES)<br>src/routes/seu/core/packs.ts:779-854</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented states are Draft/Validated/Published/Active/Retired/Archived — "Defined"/"Activated" are named Draft/Active in code (semantic match, terminology differs). Every version is an immutable row, so history is permanent (<code>findVersionsByCode</code>, <code>packsDB.create</code> never UPDATEs a non-Draft row).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Pack Registry: discovery, version lookup, dependency resolution, compatibility validation, publisher info, lifecycle status; authoritative catalogue<br> Ref: §10 Pack Registry</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/web/packs.ts:18-59<br>src/dblayer/packsDB.ts:289-387 (findVersionsByCode, findAllVisibleTo, findActiveVisibleTo)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Discovery/version lookup/lifecycle status and publisher metadata are all served by the Registry page and DB-layer queries. Dependency resolution and compatibility validation are not exposed in the Registry — no DB query or view surfaces a Pack's dependency graph or compatibility result.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Pack Composition: resolve dependencies, evaluate compatibility, merge contributions, detect conflicts, produce one EBM; deterministic<br> Ref: §11 Pack Composition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:370-456</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Merging contributions (via Template mandatory + Profile optional sets) and conflict detection are implemented and deterministic. "Resolve dependencies" is not performed here (see FR-38.4 gap) and "evaluate compatibility" does not run (no compatibility check exists anywhere in the pipeline).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition used to derive new Packs from existing ones via Composition Strategy (remark)<br> Ref: §11 remark</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:40-72 (STRATEGY_REQUIREMENTS), 128-342 (combine/merge/union/intersection/supplement)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>compositionStrategy</code> on a Pack (specialization/override/merge/union/intersection/supplement) drives <code>combineFields</code> et al. to derive one Pack's fields from its declared <code>compositionSources</code>, validated in <code>validatePackSeed</code> (packs.ts:337-362).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Compatibility evaluated across platform version, Pack versions, dependency versions, EBM version, Runtime Kernel version; rules declarative<br> Ref: §12 Compatibility</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No code evaluates compatibility across any of the five named axes. The spec itself flags this at the paragraph level ("Not implemented yet").</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Security: publisher verification, integrity validation, signature verification, provenance tracking; untrusted Packs not activated<br> Ref: §13 Security</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:1-17 (header note)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The chapter's own inline remark claims "the aspects are implemented," but no code implements publisher verification, integrity/signature verification, or an untrusted-Pack activation block — the header comment in packs.ts explicitly states "no digital signature/provenance verification (single-trusted-operator platform ... Blockchain rejection note)." The only "provenance" present is the plain <code>authored_by</code>/<code>originating_pack_id</code> FK trail (accountability, not security verification).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Traceability: Pack origin, publisher, version history, dependency history, activation history, composition history; every engineering decision traceable to influencing Pack versions<br> Ref: §14 Traceability</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packsDB.ts:289-297 (findVersionsByCode)<br>src/routes/seu/core/packs.ts:765-776, 1184-1196 (events)<br>EbmComposedPack (seuTypes.ts)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Version history, activation history (events), and composition history (<code>EbmComposedPack</code> records packId/packCode/packVersion per SEU) are all real and queryable. "Dependency history" (which dependency versions were actually resolved at a point in time) is not separately recorded — only the current <code>dependencies</code> field on the row itself.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Events: PackDefined, PackRejected, PackUpdated, PackValidated, PackActivated, PackDeprecated, PackRetired<br> Ref: §15 Events</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:765-774 (PackRegistered)<br>src/routes/seu/core/packs.ts:1184-1196 (gate.eventType ?? "PackTransitioned")<br>src/dblayer/seed/data/transitionDefinitions.json:753,775,797,808</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Actual event names differ from the spec list: creation publishes <code>PackRegistered</code> (spec: <code>PackDefined</code>), transitions publish <code>PackValidated</code>/<code>PackActivated</code>/<code>PackRetired</code>/<code>PackRejected</code> (4 of 7 match) via <code>transition_definitions.event_type</code>, falling back to generic <code>PackTransitioned</code> for others (e.g. Published). <code>PackUpdated</code> and <code>PackDeprecated</code> are never published — <code>PackDeprecated</code> is explicitly dropped per CR-080 (Deprecated state itself removed).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Events are asynchronous; differentiate revision vs version (mark)<br> Ref: §15 mark</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/eventBus.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>eventBus.publish</code> calls are awaited synchronously within the same request (per the project's own "no code after publish" rule, not fire-and-forget async dispatch); there is no separate "revision" concept distinct from <code>pack_version</code> anywhere in the schema or code.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❓</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: support thousands of Packs, deterministic composition, concurrent versions, horizontally scalable, offline validation, implementation-independent<br> Ref: §16 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packsDB.ts (plain indexed Postgres queries)<br>src/routes/seu/core/packs.ts:294-710 (validatePackSeed, pure validation against DB state)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deterministic composition and concurrent versions are demonstrated (see PP-003/FR-38.2 rows). Scale/horizontal-scalability and "offline validation" are not verifiable from the repository — they depend on deployment topology and are not exercised by any test or load-path in scope.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Export as JSON (remark)<br> Ref: §16 remark</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No export endpoint or function (<code>export</code>, <code>toJSON</code>, download route) for a Pack was found under src/routes/seu for Pack specifically.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Packs independently deployable<br> Ref: §17 AC</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:737-880</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same evidence as PP-004.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Pack composition deterministic<br> Ref: §17 AC</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:370-456</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same evidence as PP-003.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Compatibility validated before activation<br> Ref: §17 AC</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No compatibility check exists in <code>transitionPack</code>'s Published→Active hop or anywhere else.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Pack provenance preserved<br> Ref: §17 AC</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packsDB.ts:23-46 (authored_by, author_badge, tenant_id)<br>originating_pack_id FKs across capabilities/services/policies/etc.</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authorship and originating-Pack lineage are real, NOT NULL, DB-enforced fields. Cryptographic/signature-based provenance (§13) is absent, but the accountability-style provenance this platform actually implements is present and enforced.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Platform evolution occurs without Runtime Kernel modification<br> Ref: §17 AC</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts, src/routes/seu/core/ontology.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">New Pack categories/contribution values are Ontology data changes, not code changes, for the contribution kinds the SDK already models. A genuinely new contribution *kind* (not representable in today's <code>PackContributions</code> shape) would still require a code change — not exercised by existing Packs.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Engineering behaviour reproducible from historical Pack versions<br> Ref: §17 AC</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packsDB.ts:289-297 (findVersionsByCode), VM-002 immutability</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Because versions are immutable and never mutated, re-running composition against the same historical Pack version ids reproduces the same contributions every time.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables: Pack SDK, Pack Registry, Pack Composition Engine, Dependency Resolver, Compatibility Validator, Pack Lifecycle Manager, Pack APIs, Pack Events<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts (SDK)<br>src/routes/seu/web/packs.ts (Registry)<br>src/domain/engine/compositionEngine.ts (Composition Engine)<br>src/routes/seu/api/packs.ts (Pack APIs)<br>src/dblayer/packsDB.ts (Lifecycle Manager via transitionPack)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Pack SDK, Registry, Composition Engine, Lifecycle Manager, APIs, and Events all exist with real implementations. A standalone "Dependency Resolver" exists only as an existence check inside <code>validatePackSeed</code> (no resolution/closure logic). A "Compatibility Validator" does not exist at all — no file, function, or table implements it.</td>
    </tr>
  </tbody>
</table>
## Summary

- Total intents analysed: 33
- Fully met: 15
- Partially met: 13
- Not met: 4
- Not verifiable: 1

## Major implementation gaps

- **Compatibility** (§12, FR-38.3, Acceptance Criterion "Compatibility is validated before activation"): no compatibility check exists anywhere in the activation path; the spec itself flags this as not implemented.
- **Security / provenance verification** (§13): publisher verification, integrity validation, and signature verification are absent, contradicting the chapter's own inline remark that these aspects are implemented. Only accountability-style authorship (authored_by/originating_pack_id) exists, not cryptographic provenance.
- **Dependency resolution** (FR-38.4, §18 Dependency Resolver): limited to an existence check at author time; no automatic dependency-closure resolution feeds composition.
- **Events** (§15): `PackUpdated` and `PackDeprecated` are never published; the implemented event name for Pack creation (`PackRegistered`) differs from the spec's `PackDefined`.
- **Export as JSON** (§16 remark): no export mechanism found for Pack specifically.
- **Compatibility Matrix / Digital Signature** (§8): absent from the schema, consistent with the spec's own "Not implemented" remarks.
