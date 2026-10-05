# Chapter 5 — Pack Model: Implementation Traceability

**Date of report: 4-10-2026**

Recorded 2026-10-04. Specification: `design/foundations/03_Book 3 (Refined)/01_Part 1/Chapter 5.md`. The chapter's own §19 "Implementation Specifics" already documents most realisation decisions; this traceability independently verifies those claims against the live source (`src/dblayer/packsDB.ts`, `src/routes/seu/core/packs.ts`, `src/routes/seu/core/packWriteValidator.ts`, `src/dblayer/packCategoriesDB.ts`, `src/domain/engine/compositionEngine.ts`, `src/dblayer/templatesDB.ts`, `src/dblayer/profilesDB.ts`) rather than restating §19 as given.

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Pack contributes behaviour/knowledge/governance/services/integrations without Runtime Kernel modification<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packsDB.ts:23-95<br>src/routes/seu/core/packs.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Pack is a <code>packs</code> row whose behaviour lives in declarative <code>contributions</code> JSONB; no executable code path exists for a Pack. New contribution kinds, categories and Ontology values are data changes, not code changes (see category/contribution-kind rows below).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every EBM is produced by composing contributions from one or more Packs<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:370-448</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>compose()</code> resolves a Template's mandatory Pack codes and a Profile's optional Pack codes to Active <code>packs</code> rows and folds their contributions together; <code>composedPacks</code> records the exact Pack+version used.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Pack never executes; execution is performed only by commissioned SEUs<br> Ref: §3 Architectural Position</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packsDB.ts (whole file — no execution path)<br>src/domain/engine/compositionEngine.ts:370-448</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Confirmed by absence: no code path invokes Pack content as logic. <code>seedContributions</code> interprets the JSONB into vocabulary rows at publish time; those rows are then consumed by other generic engines (Quality Gate engine, Review model, Dependency engine), never by Pack itself.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Pack is self-contained, versioned, composable; never holds project-specific runtime state<br> Ref: §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packsDB.ts:8-95 (create/updateDraftContent signature — no seu_id, no runtime-state field)<br>src/routes/seu/core/packs.ts:1133-1199 (transitionPack has no <code>seuId</code>, explicitly <code>seuId: null</code> on the published event)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>packs</code> carries no SEU/runtime-state column; the Pack-transition event payload is explicitly marked "platform catalog entity, not SEU-scoped" (packs.ts:1191).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Packs are reusable across multiple SEUs<br> Ref: §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:370-448</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Pack rows are resolved by code from any number of Templates/Profiles across any number of SEU compositions; no SEU-exclusive binding exists on <code>packs</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❓</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PM-001: A Pack shall represent one coherent engineering concern<br> Ref: §5 PM-001</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">This is an authoring-discipline principle, not a mechanically checkable one; no validator enforces "one concern per Pack." Not contradicted by any code, but nothing verifies it either.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PM-002: A Pack shall declare how its contributions compose with other Packs<br> Ref: §5 PM-002</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:332-358 (<code>compositionStrategy</code> validation, <code>strategyRequirements</code>)<br>src/domain/engine/compositionEngine.ts:244-290 (merge/union/override)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>compositionStrategy</code> is a real, Ontology-backed, validated field (<code>category:composition-strategy</code>) with arity rules enforced at save time (merge/union source-count and same-code requirements).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PM-003: Packs shall be versioned independently<br> Ref: §5 PM-003; §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packsDB.ts:23-95 (identity <code>(code, pack_version[, tenant_id])</code>, plain INSERT, no UPDATE-on-publish)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each published version is an immutable new row; updating one Pack's version has no effect on any other Pack's row. Confirmed by schema comment at packsDB.ts:9-22 and the plain-INSERT <code>create</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PM-004: A Pack may be replaced without requiring Runtime Kernel modification<br> Ref: §5 PM-004</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:380,416 (<code>resolveActivePack</code> by code)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition resolves the Active row for a code at compose time; swapping which version/row is Active (via lifecycle transition) requires no kernel change.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PM-005: Every contribution shall remain traceable to its originating Pack<br> Ref: §5 PM-005</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts (seedContributions writes <code>originating_pack_id</code>)<br>§19.10 confirms FK on capabilities/services/authority_rules/policies/metric_definitions/compliance</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>originating_pack_id</code> FK exists on every materialised contribution table, confirmed by <code>db:clean-slate</code>'s own reliance on it (per §19.10, verified structurally — the FK is load-bearing for the seed-reset boundary, not merely descriptive).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Pack Taxonomy: 6 named categories (Platform/Organisation/Domain/Compliance/Technology/Integration) can coexist<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packCategoriesDB.ts:1-38<br>src/dblayer/seed/data/*.pack.json (compliance-*, technology-*, domain-*, integration-*, sdlc-phase-* files present)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>pack_category</code> is a real data table (code/label/is_active); real seed Pack files exist spanning Compliance (33), Technology, Domain, Integration categories, confirmed by directory listing.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">New Pack categories can be introduced without Runtime Kernel modification<br> Ref: §6; §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packCategoriesDB.ts:1-38</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§19.6: the hardcoded <code>packs.category</code> CHECK constraint was dropped; category is now validated against active <code>pack_category</code> rows, so a new category is a data INSERT with no code change.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Mandatory Packs are required for every commissioned SEU<br> Ref: §7 Mandatory</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packsDB.ts:389-411 (<code>findActiveMandatoryVisibleTo</code>)<br>src/domain/engine/compositionEngine.ts:370-448</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: every Active Pack marked <code>installation_classification = 'Mandatory'</code> (visible to the tenant) is folded additively into every Template's composition, per packsDB.ts:389-411's own comment citing this chapter's §7 gap directly (CR-104 closed it).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Recommended Packs: Composition Engine shall generate warnings if omitted<br> Ref: §7 Recommended</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">— (no grep match for a "Recommended"-driven warning path)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No code path checks whether a Recommended-classified Pack was omitted from a composition and raises a warning. <code>installation_classification</code> stores the value but nothing consumes "Recommended" specifically.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Optional Packs: installed only when explicitly requested or indirectly required<br> Ref: §7 Optional</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/profilesDB.ts:462-502 (<code>getOptionalPackCodes</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Profile's <code>optionalPackCodes</code> is the explicit-request mechanism; composition includes only those codes from the optional set, not every Optional-classified Pack.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Conditional Packs: Composition Engine determines whether conditional Packs are required based on declared conditions<br> Ref: §7 Conditional</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">— (no condition-evaluation code found for Pack-level <code>installation_classification = 'Conditional'</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>installation_classification</code> stores the value "Conditional" but no code evaluates a declared condition to decide inclusion; this is open, per §19.7's own "Conditional conditions are not evaluated."</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Pack Metadata: Identifier, Name, Version, Description, Category, Owner, Publisher, Dependencies, Installation Classification, Composition Strategy, Supported Platform Version, Status<br> Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packsDB.ts:23-95 (code/name/category/packVersion/installationClassification/dependencies columns)<br>§19.5 (Description/Owner/Publisher/Composition Strategy/Supported Platform Version in <code>packs.metadata</code> JSONB, CR-018)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All eleven fields are present: some as first-class columns, the CR-018-added set in a validated <code>metadata</code> JSONB. <code>owner</code>/<code>publisher</code> are free text with no Identity-system linkage.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Additional metadata may be introduced without modifying the Runtime Kernel<br> Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts (schema-driven <code>metadata</code> validation)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Metadata is validated against the versioned schema (<code>schema_definitions</code>), which is itself form-authored (CR-017); a new metadata field is a schema change, not a Runtime Kernel code change.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Pack Contributions: Engineering Behaviour, Policies, Standards, Decision Rules, Ontology, Engineering Capital, Services, Reusable Components, Engineering Templates, Checklists, Quality Gates, Review Gates, Obligation Definitions, Engineering Metrics<br> Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packsDB.ts (<code>PackContributions</code> type, <code>contributions</code> JSONB)<br>§19.4 (per-kind build status)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Built and Pack-contributable: Capabilities, Services, Authority/Decision Rules, Policies+Standards, Quality Gates, Checklists, Review Gates, Obligation Definitions, and a unified <code>contributionEngineeringCapital[]</code> covering Engineering Behaviour/Engineering Metrics/Reusable Components/Engineering Templates (CR-082, minimal stub: <code>type</code>+<code>url</code> only). **Not built:** Ontology and Knowledge Assets ("Engineering Capital" in the §9 sense) remain not Pack-contributable. Compliance Frameworks/Requirements as a Pack *contribution* kind was deliberately removed — Compliance is now a Pack *category* (§6.4) referenced from Template/Profile instead.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Pack Dependencies: Required/Optional/Conditional/Incompatible declared; required dependencies resolved before commissioning<br> Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:294-358 (<code>validatePackSeed</code>, dependency type validation)<br>§19.9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All four dependency types are declared and stored in <code>dependencies</code> JSONB (CR-018). <code>validatePackSeed</code> resolves *required* deps at author time only. There is **no transitive dependency resolution at composition time** — composition uses the Template's/Profile's own Pack-code lists (§19.7), not each Pack's own declared <code>dependencies</code> array; optional/conditional/incompatible dependency types are recorded but never acted on anywhere in <code>compositionEngine.ts</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Pack Lifecycle: Draft → Validated → Published → Active → Retired → Archived, plus Validated → Draft (Reject) requiring a mandatory, always-new comment<br> Ref: §11 (as amended by Remarks)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:1133-1199 (<code>transitionPack</code>)<br>src/routes/seu/core/packs.ts:1161-1175 (comment-required check on Reject)<br>src/dblayer/packsDB.ts:433-463 (<code>addComment</code>/<code>getComments</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Six-state lifecycle (Deprecated dropped, migration 137) runs through the generic <code>transitionEngine</code>. Reject (Validated→Draft) is gated on <code>trimmedComment</code> being non-empty **and** different from the most recent existing comment (packs.ts:1166-1174) — exactly the amended requirement. No Pack-specific evaluation code; authority/policy are ordinary <code>transition_definitions</code> rows.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Historical Pack versions shall remain available for reproducing historical EBMs<br> Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packsDB.ts:289-297 (<code>findVersionsByCode</code>)<br>§19.2 (EBM records exact packCode+packVersion)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every published version is its own immutable row (never deleted/overwritten); <code>findVersionsByCode</code> returns the full history. Reactivation-from-terminal-state was removed entirely (CR-080) rather than resurrecting an old row, which preserves rather than threatens this guarantee.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Packs shall be independently versioned (§12, restated)<br> Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packsDB.ts:9-22</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same evidence as PM-003 above.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Updating one Pack shall not require version changes to unrelated Packs<br> Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packsDB.ts:23-95 (<code>create</code> takes a single Pack's fields; no cross-Pack version coupling)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No code path ties one Pack's version bump to another Pack's version.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">EBMs shall record the exact Pack versions used during composition<br> Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:370-448 (<code>composedPacks</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Confirmed by §19.2 and by <code>compose()</code>'s resolution of Active rows by <code>(code, pack_version)</code> identity, recorded on the EBM.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Compatibility: minimum/maximum supported platform version, incompatible Pack versions, migration guidance declared; Composition Engine validates compatibility before composition<br> Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§19.9 (fields declared, CR-018); no corresponding call found in compositionEngine.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The four fields (<code>supportedPlatformVersion</code>, <code>minSupportedPlatformVersion</code>, <code>maxSupportedPlatformVersion</code>, <code>incompatiblePackVersions</code>, <code>migrationGuidance</code>) are stored in <code>metadata</code> JSONB and schema-validated for shape at write time. **No platform-version concept exists to compare against**, and <code>compositionEngine.ts</code> has no compatibility-check call. Declaration only.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Runtime Visibility: Packs visible to Composition Engine, Pack Registry, Administration Services; commissioned SEUs shall not modify Packs<br> Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packsDB.ts:319-411 (findAll/findAllVisibleTo/findActiveVisibleTo/findActiveMandatoryVisibleTo)<br>src/routes/seu/core/packs.ts:1133-1199 (<code>transitionPack</code> only mutates <code>packs.status</code>, not SEU-triggered)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Visibility queries exist for the Registry and composition. No code path lets a commissioned SEU write to a <code>packs</code> row — all Pack mutation is through the authoring/lifecycle surface (§19.11), never SEU execution.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Runtime services may query Pack metadata where necessary<br> Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packsDB.ts:299-317 (findById/findByIds)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Generic read accessors exist and are used by dependency resolution/composition.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Events: PackRegistered, PackValidated, PackPublished, PackActivated, PackRetired, PackDependencyResolved, PackDependencyFailed, PackRejected (PackDeprecated dropped per Remarks)<br> Ref: §15 (as amended)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:765-766 (<code>PackRegistered</code> on draft creation)<br>src/routes/seu/core/packs.ts:1184-1196 (per-hop <code>gate.eventType</code>, Version Feature Plan wiring)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>PackRegistered</code> fires explicitly on <code>createPackDraft</code>. Every subsequent lifecycle hop (Validate/Publish/Activate/Retire/Archive/Reject) publishes through the generic <code>transitionPack</code> using <code>gate.eventType</code> resolved from the matching <code>transition_definitions</code> row (migration 184) — not a hardcoded per-state map, confirmed by the comment at packs.ts:1184-1186 explicitly replacing an older hardcoded <code>EVENT_BY_TARGET_STATE</code>. **<code>PackDependencyResolved</code>/<code>PackDependencyFailed</code> are not published anywhere** — consistent with dependency resolution at composition time not being built (see §10 row above).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Non-Functional: support concurrent Pack versions<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packsDB.ts:289-297,339-351</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Multiple versions of the same code coexist as distinct rows (confirmed by <code>findVersionsByCode</code>/<code>findAllVisibleTo</code> both returning every version).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Non-Functional: support deterministic composition<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:370-448 (Override "later wins", explicit warnings, no silent drops)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§19.8: a resolved Pack with no Active version is excluded with an explicit warning, never silently dropped; a Pack contributed more than once resolves by Override with a warning. Deterministic given fixed inputs.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Non-Functional: maintain complete traceability<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">— (same evidence as PM-005)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same FK-based traceability as PM-005.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Non-Functional: support independent evolution<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packsDB.ts:9-22,23-95</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same evidence as PM-003/§12.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Non-Functional: support backward compatibility where possible<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">— (no code evidence; §13's compatibility validation is open)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No mechanism evaluates or enforces backward compatibility between Pack versions; this depends on the same open compatibility-validation gap as §13.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Non-Functional: avoid Runtime Kernel modification for Pack additions<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packCategoriesDB.ts:1-38 (category as data)<br>§19.4 (new contribution kinds added via schema, e.g. CR-082's <code>contributionEngineeringCapital[]</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Confirmed structurally: new categories, new contribution kinds, and new Ontology values are all data/schema changes (schema_definitions rows, pack_category rows, concept-type seeds), not Runtime Kernel edits, across every example traced in §19.4-19.6.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Packs can be independently created and versioned<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packsDB.ts:23-95</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same evidence as PM-003.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Multiple Pack categories can coexist<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packCategoriesDB.ts:1-38; seed data across categories</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same evidence as §6 taxonomy row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Mandatory and conditional Packs are correctly enforced<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packsDB.ts:389-411 (Mandatory); — (Conditional, no evaluation code)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Mandatory is enforced (CR-104). Conditional is declared only — no condition-evaluation path exists anywhere in <code>compositionEngine.ts</code> or <code>packs.ts</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Dependency resolution succeeds for compatible Packs<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:294-358 (author-time required-dep check only)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Resolution exists only at Pack *authoring* time (<code>validatePackSeed</code>), not at composition time; no composition-time dependency-graph resolution exists for any dependency type.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Incompatible Packs prevent composition<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:436-448 (<code>detectGovernanceConflicts</code>, blocks commissioning)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§19.8: realised via *governance-conflict* detection (two Packs assigning different authorised roles to the same transition, or contributing a Quality Gate to the same <code>(entityType, fromState, toState)</code>), which blocks commissioning — not via the declared <code>incompatible</code> dependency type itself, which exists on the validator (CR-018) but is not read anywhere in <code>compositionEngine.ts</code>. The acceptance criterion is satisfied by a different, functionally equivalent mechanism than the one §10 describes.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Every Pack contribution remains traceable<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same as PM-005</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: New Pack categories can be introduced without changing the Runtime Kernel<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same as §6/§16 row</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables: Pack domain model, Pack Registry, Pack metadata schema, Dependency declaration model, Version management services, Compatibility validation services, Pack lifecycle services, Pack APIs, Pack events<br> Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/packsDB.ts (domain model); src/routes/seu/api/packs.ts, src/routes/seu/web/packs.ts (APIs/Registry); src/routes/seu/core/packs.ts (lifecycle services); packs.ts:1184-1196 (events)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All nine deliverables exist in some form. **Compatibility validation services** is the weak link: fields are stored and schema-validated for shape, but no service actually *validates compatibility* (no platform-version comparison exists) — matching the §13 gap above. Dependency declaration model exists (declaration only, per §10).</td>
    </tr>
  </tbody>
</table>
## Summary

- Total intents analysed: 40
- Fully met: 24
- Partially met: 12
- Not met: 3
- Not Verifiable: 1

## Major Implementation Gaps

1. **Composition-time dependency resolution is not built.** Required/optional/conditional/incompatible dependency *types* are declared and validated at author time only; `compositionEngine.ts` resolves Pack membership entirely from the Template's mandatory set and the Profile's optional set, never from a Pack's own `dependencies` array. (§10, §17 "dependency resolution", §18 "dependency declaration model")
2. **Conditional Packs are not evaluated anywhere.** `installation_classification = 'Conditional'` is stored but no code decides whether a declared condition is satisfied. (§7, §17)
3. **Compatibility validation (§13) is declaration-only.** The platform-version fields exist and are schema-validated for shape, but nothing compares them against an actual running platform version — because no platform-version concept exists yet to compare against. (§13, §16 backward compatibility, §18)
4. **Recommended-Pack omission warnings are not built.** No code path checks for an omitted Recommended Pack and raises a warning. (§7)
5. **`PackDependencyResolved`/`PackDependencyFailed` events are never published**, consistent with gap 1 — there is no dependency-resolution step at composition time to emit them from. (§15)
6. **"Incompatible Packs prevent composition" (§17) is satisfied by a different mechanism than §10 describes** — governance-conflict detection (role/Quality-Gate clashes), not the declared `incompatible` dependency type, which is validated but never consumed by composition.
