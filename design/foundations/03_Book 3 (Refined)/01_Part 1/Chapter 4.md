# Chapter 4 – Composition Engine

## 1. Purpose

The Composition Engine is responsible for constructing an **Engineering Behavior Model (EBM)** by composing behavioural contributions from one or more Packs.

The Composition Engine is the only platform component authorised to create, validate, version and activate an Engineering Behavior Model.

The Composition Engine performs no software engineering work itself. Its responsibility is limited to producing a complete, internally consistent and traceable behavioural model suitable for commissioning a Software Engineering Unit (SEU).



## 2. Scope

This chapter defines:

- Composition Engine responsibilities
- Inputs and outputs
- Composition lifecycle
- Conflict detection
- Behaviour resolution
- Validation
- Versioning
- Activation

This chapter does not define:

- Pack structure
- Pack lifecycle
- Engineering behaviour
- Runtime execution



## 3. Architectural Position

```
Pack Registry
      │
      ▼
Composition Engine
      │
      ▼
Engineering Behavior Model
      │
      ▼
Commissioned SEU
```

The Composition Engine is a build-time service.

It is not part of normal SEU execution.



## 4. Responsibilities

The Composition Engine shall:

- discover Packs
- resolve dependencies
- validate compatibility
- compose behavioural contributions
- detect conflicts
- resolve deterministic conflicts
- identify non-deterministic conflicts
- construct the Engineering Behavior Model
- version the Engineering Behavior Model
- activate the Engineering Behavior Model

The Composition Engine shall not:

- execute Work Items
- manage Participants
- manage Deliverables
- preserve Knowledge



## 5. Inputs

The Composition Engine shall accept:

- one SEU Template
- zero or more Organisation Packs
- zero or more Domain Packs
- zero or more Compliance Packs
- zero or more Technology Packs
- zero or more Integration Packs
- Platform Packs

Additional Pack categories may be introduced through the Extension Framework.



## 6. Output

The output of the Composition Engine shall be exactly one Engineering Behavior Model.

The Engineering Behavior Model shall contain:

- behavioural rules
- governance rules
- authority rules
- engineering standards
- terminology mappings
- quality gates
- review gates
- behavioural metadata

The Composition Engine shall not expose partially composed models.



## 7. Functional Requirements

### FR-4.1

The platform shall invoke the Composition Engine before commissioning every SEU.



### FR-4.2

The Composition Engine shall construct exactly one Engineering Behavior Model for each commissioned SEU.



### FR-4.3

Every behavioural contribution shall retain its originating Pack reference.



### FR-4.4

The Composition Engine shall maintain complete composition traceability.



### FR-4.5

Composition shall be deterministic.

Identical inputs shall always produce identical Engineering Behavior Models.



### FR-4.6

The Composition Engine shall support incremental recomposition.



### FR-4.7

Recomposition shall produce a new Engineering Behavior Model version.



## 8. Composition Lifecycle

Every composition shall progress through the following stages.

```
Collect Inputs

↓

Resolve Dependencies

↓

Validate Packs

↓

Compose Behaviour

↓

Detect Conflicts

↓

Resolve Conflicts

↓

Validate Model

↓

Version Model

↓

Activate Model
```

Failure at any stage shall terminate the composition process.



## 9. Dependency Resolution

The Composition Engine shall determine:

- required Packs
- optional Packs
- conditional Packs
- incompatible Packs
- missing Packs

Dependencies shall be declared by Packs.

Dependencies shall not be inferred.



## 10. Behaviour Composition

The Composition Engine shall compose contributions according to declared composition strategies.

Supported strategies include:

- Merge
- Override
- Supplement
- Union
- Intersection
- Alias
- Conflict Detection

The platform shall permit future strategies without modification of the Runtime Kernel.



## 11. Conflict Detection

The Composition Engine shall identify behavioural conflicts.

Examples include:

- contradictory authority rules
- incompatible workflows
- conflicting quality gates
- inconsistent terminology
- incompatible compliance requirements
- incompatible technology constraints

Conflicts shall be classified as:

- deterministic
- non-deterministic



## 12. Conflict Resolution

Deterministic conflicts shall be resolved automatically.

Non-deterministic conflicts shall require explicit resolution before commissioning.

Every resolution shall be recorded.

Every resolution shall remain traceable.



## 13. Validation

The Composition Engine shall validate:

- behavioural completeness
- Pack compatibility
- governance completeness
- dependency completeness
- mandatory Pack availability
- mandatory behavioural rules
- terminology consistency

Validation shall fail if the resulting Engineering Behavior Model is incomplete.



## 14. Composition Traceability

Every behavioural rule in the Engineering Behavior Model shall be traceable to:

- originating Pack
- originating Pack version
- composition strategy
- conflict resolution (if applicable)

Composition traceability shall remain permanently available.



## 15. Activation

Only validated Engineering Behavior Models may be activated.

Activation shall:

- assign an identifier
- assign a version
- publish activation events
- make the Engineering Behavior Model available for SEU commissioning

Activation shall not modify existing Engineering Behavior Models.



## 16. Recomposition

Engineering Behavior Models may be recomposed when:

- Packs are upgraded
- behavioural conflicts are resolved
- governance changes
- new mandatory Packs become available
- authorised users request recomposition

Recomposition shall never modify historical Engineering Behavior Models.



## 17. Events

The Composition Engine shall publish domain events including:

- CompositionStarted
- DependencyResolved
- DependencyFailed
- PackValidated
- BehaviourComposed
- ConflictDetected
- ConflictResolved
- CompositionValidated
- EBMCreated
- EBMActivated
- CompositionFailed



## 18. Non-Functional Requirements

The Composition Engine shall:

- produce deterministic output
- support concurrent composition requests
- maintain complete auditability
- preserve historical versions
- support incremental recomposition
- remain independent of execution technologies



## 19. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Mandatory Packs are resolved.

✓ Behavioural contributions are successfully composed.

✓ Deterministic conflicts are resolved automatically.

✓ Non-deterministic conflicts prevent commissioning.

✓ Every Engineering Behavior Model is versioned.

✓ Every behavioural contribution is traceable to its source.

✓ Engineering Behavior Models are immutable after activation.



## 20. Deliverables

Implementation of this chapter shall produce:

- Composition Engine service
- Composition pipeline
- Dependency resolver
- Conflict detection service
- Conflict resolution framework
- Validation service
- Engineering Behavior Model builder
- Composition traceability service
- Composition APIs
- Domain events



## 21. Implementation Status & Gaps

Code-verified audit (2026-08-24), not from memory — every claim below carries a file:line citation, cross-checked against a live query against the running Postgres instance (`aisworg` DB). Core files: `src/domain/engine/compositionEngine.ts` (144 lines, its entire real implementation), `src/routes/seu/core/commissioning.ts` (its one and only call site), `src/dblayer/ebmsDB.ts`, `EbmRow`/`EbmComposedPack`/`EbmCompositionReport` (`src/dblayer/seuTypes.ts`). Live `ebms` schema: `id, seu_id, template_id, profile_id, composed_packs, composition_report, status, version, created_at`.

**Updated 2026-09-07, code-verified — the single most consequential change this pass found: `compositionEngine.compose()`/`detectGovernanceConflicts` are now genuinely dead code.** CR-092 Part 9 removed the "one and only call site" this audit's own intro names — confirmed directly, not assumed: `grep -rn "compositionEngine\.compose("` across `src/` returns zero real call sites, only comments. `compositionEngine.ts` itself is completely untouched — every finding below about the function's own internals is still accurate *as a description of unreachable code* — but the real commissioning pipeline now composes and detects conflicts through an entirely separate, new module this chapter doesn't otherwise cover: `src/domain/engine/profileCompositionUnravel.ts` (`unravelComposition`/`detectCompositionConflicts`, audited in depth as Chapter 3 §19's own 2026-09-07 update) and a new event-bus consumer, `src/domain/engine/ebmComposer.ts`. The individual composition-strategy *functions* `compositionEngine.ts` also exports (`specialize`/`merge`/`union`/`intersection`/`supplement`) are the one part of this file that gained a genuine new caller — `applyConflictStrategy` (`core/commissioning.ts`), for human-triggered conflict *resolution* (§12), a different use case than §10's own "compose Pack contents" framing. Each section below is marked inline where this changes its verdict; sections not marked are unchanged.

The chapter's own "compiler" framing (§0's design note) is the single most useful lens for this audit: what's built is roughly the *linker* stage (resolve which Pack files participate, in what order, flag duplicate symbols) — not the *compiler* (parse each Pack's own contributions, extract and categorize the rules within them, detect semantic conflicts between rule bodies, emit one unified program). `compositionEngine.compose()` produces an ordered list of whole Packs plus a thin report; it never opens up a Pack's own `contributions` JSONB and reassembles what's inside into the rich, categorized Engineering Behavior Model §6 describes (behavioural rules / governance rules / authority rules / engineering standards / terminology mappings / quality gates / review gates, each separately present and traceable). Every other finding in this section is a consequence of that one fact.

### 21.1 ⚠️ Inputs — Template + Profile only, not the flexible Pack-category list (§5)

The chapter describes accepting "zero or more Organisation Packs... Domain Packs... Compliance Packs... Technology Packs... Integration Packs... Platform Packs" directly. The real signature is narrower and indirect: `compose(input: {templateId, profileId})` (`compositionEngine.ts:34`) — Packs are never passed in as a flexible, categorized list. They're derived from exactly two sources: `templatesDB.getMandatoryPackCodes(templateId)` and `profilesDB.getOptionalPackCodes(profileId)`. A Pack's own `category:pack` value (Compliance/Domain/Engineering/Integration/Organisation/Technology) plays no role in composition at all — it's metadata on the Pack, never consulted by `compositionEngine.ts` to decide inclusion, ordering, or strategy.

### 21.2 ⚠️ Output — an ordered Pack list + a thin report, not a decomposed Engineering Behavior Model (§6)

`compose()` returns `{composedPacks: EbmComposedPack[], compositionReport: EbmCompositionReport}` — `composedPacks` is just `{packId, packCode, packVersion}` per Pack; `compositionReport` is `{warnings: string[], conflicts: string[], resolutions: string[]}` (`seuTypes.ts:391-401`). Neither field contains anything resembling the chapter's own named EBM contents: no extracted/merged behavioural rules, governance rules, authority rules, engineering standards, terminology mappings, quality gates, or review gates as their own first-class EBM structures. `ebms.composed_packs`/`ebms.composition_report` store exactly this same thin shape (migration `002_seu_platform.sql:141-151`). Whatever governance an SEU actually runs under still lives inside each individual Pack's own `contributions` JSONB, resolved ad hoc by whichever engine needs it (`qualityGateEngine.ts`, `transitionEngine.ts`, etc.) — never assembled into one queryable EBM object the way §6 describes.

### 21.3 ⚠️ Functional Requirements (FR-4.1–7) (§7)

| FR | Verdict | Note |
||||
| FR-4.1 invoked before every commissioned SEU | 🚩 **updated 2026-09-07** | No longer real for `compose()` specifically — it has zero call sites anywhere in `src/` now (checked directly). The *outcome* this FR asks for (something real composes before every commission) still holds, via `ebmComposer.ts`'s own `unravelComposition` instead — a different function this chapter doesn't audit. |
| FR-4.2 exactly one EBM per commissioned SEU | ✅ (via a different path) | `ebmsDB.create` still inserts exactly one row per commission — now called from `ebmComposer.ts` with `unravelComposition`'s own output, not `compose()`'s. |
| FR-4.3 every behavioural contribution retains its originating Pack reference | ⚠️ Pack-level only | `composedPacks` records each *Pack's* origin; no individual rule/contribution inside a Pack gets its own separate origin record (21.2) — trivially "retained" only because it was never extracted from the Pack in the first place. |
| FR-4.4 complete composition traceability | ⚠️ | Same shape as FR-4.3 — real at the Pack level (`ebms.composed_packs`), absent at the rule level. |
| FR-4.5 deterministic composition | ⚠️ | The code's own comment (`compositionEngine.ts:6-8`) names the tension directly: "the same set is evaluated fresh each time, not cached" — `resolveActivePack` always resolves to whichever Pack version is *currently* Active. Identical `{templateId, profileId}` input can produce a different `composedPacks` result at two different points in time if a Pack's Active version changed in between — deterministic only if "identical inputs" is read to include the full DB state at call time, not just the two ids. |
| FR-4.6 support incremental recomposition | ❌ | No incremental mechanism exists — `compose()` always fully re-resolves both code lists from scratch. Moot regardless per 21.12: nothing ever calls it a second time for an existing SEU. |
| FR-4.7 recomposition produces a new EBM version | ⚠️ unexercised | `ebmsDB.create`'s `version` column genuinely computes `COALESCE(MAX(version),0)+1` per `seu_id` (`ebmsDB.ts:16`) — real, working SQL — but since nothing ever triggers a second `compose()`+`create()` for the same SEU (21.12), this path has never run in practice beyond version 1. |

### 21.4 ⚠️ Composition Lifecycle — a flat function, not the 9-stage pipeline (§8)

The chapter names 9 distinct stages (Collect Inputs → Resolve Dependencies → Validate Packs → Compose Behaviour → Detect Conflicts → Resolve Conflicts → Validate Model → Version Model → Activate Model), each implying its own checkpoint ("failure at any stage shall terminate the composition process"). The real `compose()` is one flat async function: resolve mandatory codes → resolve optional codes → de-duplicate by Pack code (the one real "Override") → run 2 narrow conflict checks → return. There's no distinct "Validate Packs" step (a Pack's mere existence via `findActiveByCode` is all that's checked — no compatibility validation), no "Resolve Conflicts" step (conflicts are only ever reported, never resolved, 21.8), no "Validate Model" step against the resulting EBM's own completeness, and "Version Model"/"Activate Model" are collapsed into one immediate `INSERT ... status='Active'` in `ebmsDB.create` (21.11) rather than two distinct, separately-gated stages.

### 21.5 ✅ Dependency Resolution — not built inside `compositionEngine.ts` itself; real now, elsewhere (§9) — updated 2026-09-07

Still true of `compositionEngine.ts` specifically: `compose()` never read `packs.dependencies[]`, and never will now that it has no callers (intro). **But the real commissioning pipeline does this for real now, just in `profileCompositionUnravel.ts` instead**: `resolveComposedPacksTransitively` walks every composed Pack's own `dependencies[]` transitively (cycle-safe), and every dependency entry becomes a real pool entry checked for `satisfiedInComposedSet` — a `required`/`conditional` dependency whose target isn't in the composed set, or an `incompatible` one whose target is, is a genuine blocking conflict (`detectCompositionConflicts`), not a warning. This is a real, if belated, instance of exactly what this section asks for — "missing Packs" specifically is no longer just a warning either (21.9's own update).

### 21.6 ⚠️ Behaviour Composition / Composition Strategies — 1 of 7 real for whole-Pack composition (unchanged, now dead code); 5 of 7 real for a different use case — conflict resolution (§10) — updated 2026-09-07

`compositionEngine.ts`'s own `compose()`-level Override (a Pack `code` in both mandatory and optional sets — later wins, wholesale) is unchanged in substance, now moot since nothing calls `compose()` (intro). **Merge, Supplement, Union, Intersection** — and Alias, under CR-067's own already-noted rename to Specialization — are no longer zero-mechanism: `applyConflictStrategy` (`core/commissioning.ts`) invokes the real `compositionEngine.specialize`/`merge`/`union`/`intersection`/`supplement` functions for real, whenever a human resolves a conflict `detectCompositionConflicts` (21.7) flagged. This is a genuinely different use case than §10's own "compose Pack contents together" framing, worth being precise about: it operates on exactly one disagreeing *sub-field* at a time (never a whole Pack, never a whole containing object), only fires when a human explicitly picks a strategy and which sources participate (never automatic, never inferred), and only reconciles a *disagreement* — it doesn't compose non-conflicting content at all (two Packs each contributing their own, non-overlapping Capability still just coexist side by side, unchanged from the original finding). `Conflict Detection` itself, listed here as a 7th "strategy," is real as a separate mechanism (21.7) but was never a composition strategy in the sense the other 6 are.

### 21.7 ⚠️ Conflict Detection — `detectGovernanceConflicts` now dead code; its real successor covers 2 of this section's own 6 named types too, but is comprehensive on a different, orthogonal axis (§11) — updated 2026-09-07

`detectGovernanceConflicts` (`compositionEngine.ts:100-144`, unreachable now, intro) checked exactly two things: contradictory authority rules and conflicting quality gates (narrower than "plain," since CR-058 established one gate per category can coexist). Its real successor, `detectCompositionConflicts` (`profileCompositionUnravel.ts`), covers the *same* 2 of this section's 6 named types — still nothing for **incompatible workflows, inconsistent terminology, incompatible compliance requirements, incompatible technology constraints** (no first-class "workflow"/"terminology mapping" entity exists to compare, unchanged; compliance requirements specifically are Policies, and Part 8 of CR-092 deliberately keeps Policies informational-only, never compared against each other — owner: *"two policies do not have to agree on constraintType at all"* — so this isn't a gap so much as a settled design choice not to check it). **What's genuinely new is comprehensiveness on a different axis this section doesn't name at all**: every other Pack contribution type (Capabilities, Services/Service Levels, Checklists, Review Gates, Obligation Definitions, Engineering Capital, Pack Dependencies) and every Profile/Template field is now checked for cross-source disagreement too — not more of these 6 categories, but a much wider set of *content* the chapter's own §11 never enumerated. §11's own deterministic/non-deterministic classification still doesn't exist as a concept anywhere in either mechanism.

### 21.8 ✅ Conflict Resolution — blocking is still real (now via a different, comprehensive mechanism); real resolution exists for the first time, but always human-triggered, never automatic (§12) — updated 2026-09-07

**Blocking, still the strongest-built claim, now via `detectCompositionConflicts`/`CommissionFailed` instead of `compositionReport.conflicts.length > 0`/`SEUCommissionRejected`** — real, unconditional, not a warning, and now covering every contribution type 21.7 names, not just 2. §12's own "non-deterministic conflicts shall require explicit resolution before commissioning" — real resolution exists for the first time now: `applyConflictStrategy` (21.6) genuinely resolves a flagged conflict via a real strategy function. But there's still no deterministic/non-deterministic *classification* for §12's own "resolved automatically" half to apply to — and by explicit design, never will: owner, correcting an early draft that assumed some default source should win, *"you dont assume any base — i have been repeating this saying user has to choose."* Every resolution is a human's own explicit pick, always — "automatic" resolution was deliberately rejected, not merely unbuilt. `EbmCompositionReport.resolutions` (`seuTypes.ts`) is still real as a field and still always `[]` — confirmed directly in both `ebmComposer.ts` and `commissionSeu`'s own EBM-report construction — the new resolution mechanism doesn't write to this specific field, it resolves the conflict before ever reaching the point an EBM report gets built.

### 21.9 ⚠️ Validation — "mandatory Pack availability" now genuinely blocks, via a sibling mechanism this chapter never named; the other 6 axes are still unbuilt (§13) — updated 2026-09-07

`compositionEngine.ts`'s own `resolveActivePack` still only warns, unchanged, now moot (dead code, intro). **But "mandatory Pack availability" — one of this section's own 7 named axes — is genuinely real and blocking now**, just enforced earlier, before composition even starts: `checkRequestLiveness` (`core/commissioning.ts`, built for Chapter 8 §9's own "Validate Request") re-checks every mandatory/selected Pack code, failing commissioning outright (not a warning) if any has no Active version. This is a real instance of exactly what this section asks for, living in a sibling chapter's own mechanism rather than inside the Composition Engine itself — worth noting since §13 frames this as the Composition Engine's own responsibility. "Dependency completeness" is also now real (21.5's own update). Pack compatibility, governance completeness, mandatory behavioural rules, and terminology consistency remain entirely unbuilt, unchanged.

### 21.10 ⚠️ Composition Traceability — real at the Pack level in the persisted EBM; real at the rule level too, but only transiently, during validation (§14) — updated 2026-09-07

`ebms.composed_packs` still gives real, permanent traceability from an EBM back to exactly which Pack + which Pack version contributed to it — genuinely real, not aspirational, unchanged. **New**: `unravelComposition`'s own flat pool (`profileCompositionUnravel.ts`) tags every individual contribution — not just each Pack as a whole — with its own `source: {kind, id, code, label}`, real per-rule traceability for the first time. The caveat: this is real only *during* Compose EBM/conflict detection, shown to a human resolving a conflict — none of it is persisted onto the `ebms` row itself, which still stores only the same thin Pack-level list it always did. "Composition strategy"/"conflict resolution" per rule still don't exist as permanent trace fields.

### 21.11 ✅ Activation — real for the first time: a separate stage, a real `EBMActivated` event, and a status that starts `'Composed'`, not hardcoded `'Active'` (§15) — updated 2026-09-07

**This finding no longer holds.** `ebmsDB.create` now inserts a new row with `status = 'Composed'` (migration 178 widened the `CHECK` constraint to allow it) — the row genuinely sits in that state, not hardcoded to `'Active'` immediately. A real, separate, human-gated Activate stage exists now: `transitionEbm` (`core/commissioning.ts`), `Validated → Active`, publishing a real `EBMActivated` event (21.13's own update) — matching this section's own name for the first time. "Activation shall not modify existing Engineering Behavior Models" now holds for a genuine reason, not by accident: `ebmsDB.updateStatus` only ever writes the `status` column, never `composed_packs`/`composition_report` — the behavioural content itself is still never touched post-creation.

### 21.12 🚩 Recomposition — the version-increment SQL still exists and has still never run past 1; `ebms.status` is no longer write-only for `'Active'`, but still never `'Superseded'` (§16) — updated 2026-09-07

Still true: none of the chapter's 5 named recomposition triggers invoke anything a second time for an existing SEU — `unravelComposition`/`ebmComposer.ts` compose fresh once per commission, same as `compose()` always did, and nothing re-triggers them for an already-commissioned SEU. `ebmsDB.create`'s own `version` computation is unchanged, still real, still unexercised past 1. **One precise correction**: "zero writes to `ebms.status` anywhere besides the initial insert" is no longer true — `ebmsDB.updateStatus` is real now and genuinely called (`Composed → Validated → Active`, 21.11) — but confirmed directly, no code path anywhere ever writes `'Superseded'`. So two `'Active'` rows still can't coexist in practice (nothing ever produces a second EBM for the same SEU to begin with, 21.5's own "not triggered" finding still holds) — the original risk this section flagged is narrower now, but for the same underlying reason: recomposition itself is still never triggered.

### 21.13 ⚠️ Events — 3 of 11 named events real as of 2026-09-07, up from 0, published from `ebmComposer.ts`/`transitionEbm`, not `compositionEngine.ts` (§17)

`compositionEngine.ts` itself still contains zero `eventBus` calls, unchanged — real now, from sibling files instead: `CompositionStarted` (`ebmComposer.ts`, on consuming `CommissionValidated`), `EBMCreated` (`ebmComposer.ts`, once the EBM row is persisted), `EBMActivated` (`transitionEbm`, on `Validated → Active`). Still not real, confirmed via direct search: `DependencyResolved`, `DependencyFailed`, `PackValidated`, `BehaviourComposed`, `ConflictDetected`, `ConflictResolved`. Two near-miss names worth being precise about, since this chapter and Chapter 8 each name a similarly-worded event that isn't the same string: this chapter's own `CompositionValidated`/`CompositionFailed` are *not* built under those exact names — what's real is Chapter 8's own `CommissionValidated`/`CommissionFailed` (`commissioning.ts`/`ebmComposer.ts`), a different, SEU-commissioning-scoped pair, not this chapter's Composition-Engine-scoped ones. The real events nearest this chapter's own domain that existed before 2026-09-07, still real: `SEUCommissioned` (Ch.2) — SEU-level, not Composition-Engine-named.

### 21.14 ⚠️ Non-Functional Requirements (§18)

| NFR | Verdict | Basis |
||||
| produce deterministic output | ⚠️ | 21.3 FR-4.5 — deterministic only relative to current DB state, not a pure function of `{templateId, profileId}` alone |
| support concurrent composition requests | ✅ (trivially) | Stateless function, no shared mutable state; concurrent calls don't interfere structurally |
| maintain complete auditability | ⚠️ | Pack-level real (21.10); rule-level absent |
| preserve historical versions | ⚠️ unexercised | Schema supports it (`version` column, 21.3 FR-4.7); no superseding mechanism (21.12) means it's never been exercised beyond version 1 |
| support incremental recomposition | ❌ | 21.3 FR-4.6 |
| remain independent of execution technologies | ✅ | No technology-specific coupling anywhere in `compositionEngine.ts` |

### 21.15 ⚠️ Acceptance Criteria (§19)

| Criterion | Verdict |
|||
| Mandatory Packs are resolved | ✅ **updated 2026-09-07** — genuinely blocks now, via `checkRequestLiveness` (21.9) |
| Behavioural contributions are successfully composed | ⚠️ Packs are composed; contributions *within* them are checked for conflicts (21.7) but still not assembled into a decomposed model (21.2) |
| Deterministic conflicts are resolved automatically | ❌ still no classification exists, and never will by design — every resolution is a human's own explicit choice (21.8's own 2026-09-07 update) |
| Non-deterministic conflicts prevent commissioning | ✅ **updated 2026-09-07** — no longer "for the 2 conflict types that exist" specifically; comprehensive across every Pack contribution type (21.7/21.8) |
| Every Engineering Behavior Model is versioned | ✅ schema-real, ⚠️ unexercised beyond version 1, unchanged (21.12) |
| Every behavioural contribution is traceable to its source | ⚠️ Pack-level persisted; rule-level real but only transiently, during validation (21.10's own 2026-09-07 update) |
| Engineering Behavior Models are immutable after activation | ✅ **updated 2026-09-07** — now a deliberate guarantee (`updateStatus` only ever touches `status`), not an accident of no update path existing — an update path exists now (21.11) |

### 21.16 ⚠️ Deliverables (§20)

| Named Deliverable | Real artifact | Verdict |
||||
| Composition Engine service | `compositionEngine.ts` | 🚩 **updated 2026-09-07** — still exists, but its own `compose()`/`detectGovernanceConflicts` have zero live callers now (intro); only its standalone strategy functions are still used, for a different purpose (21.6) |
| Composition pipeline | **Updated 2026-09-07**: `ebmComposer.ts` (event-driven), not `compose()` | ⚠️ not the 9-stage pipeline, but genuinely event-staged now for some of it (21.4) |
| Dependency resolver | **Updated 2026-09-07**: `resolveComposedPacksTransitively` (`profileCompositionUnravel.ts`) | ✅ real now, walks and validates `dependencies[]` for real, just outside `compositionEngine.ts` (21.5) |
| Conflict detection service | **Updated 2026-09-07**: `detectCompositionConflicts` | ✅ comprehensive across contribution types; still 2 of this chapter's own 6 named conflict *categories* (21.7) |
| Conflict resolution framework | **Updated 2026-09-07**: `applyConflictStrategy` | ✅ real now, human-triggered only — `EbmCompositionReport.resolutions` itself is still never populated (21.8) |
| Validation service | **Updated 2026-09-07**: `checkRequestLiveness` (Ch.8's own domain) | ✅ genuinely blocks now, for mandatory Pack availability specifically (21.9) |
| Engineering Behavior Model builder | `composedPacks`/`ebms` row, now built by `ebmComposer.ts` | ⚠️ still a Pack list, not a decomposed model (21.2) |
| Composition traceability service | `ebms.composed_packs`, plus (**new**) `unravelComposition`'s own per-entry `source` during validation | ⚠️ Pack-level persisted; rule-level real but transient (21.10) |
| Composition APIs | `ebmComposer.ts`'s own event consumption (**updated 2026-09-07**, replacing `commissioning.ts`'s inline call site) | ⚠️ invoked via a real event handler now; still no standalone recompose/inspect HTTP API |
| Domain events | **Updated 2026-09-07**: `CompositionStarted`/`EBMCreated`/`EBMActivated` | ⚠️ 3 of 11, up from 0 (21.13) |

### Summary — ranked

1. **[Architecture — updated 2026-09-07, but the underlying gap this finding names is unchanged]** `compositionEngine.ts` still composes *Packs*, not the *behavioural content inside them* — but it's no longer the thing actually running: it has zero live callers (intro). The real pipeline (`profileCompositionUnravel.ts`/`ebmComposer.ts`) fares better at *conflict detection* across contribution types (finding 2 below) but still doesn't produce the decomposed, categorized Engineering Behavior Model §6 describes either — every contribution still just exists inside its composed Pack, never extracted into a first-class, queryable EBM structure.
2. **[Governance, genuinely real and strong, comprehensive as of 2026-09-07]** Conflict detection — real, unconditional, and (CR-092 Part 8) now spans every Pack contribution type, not just the 2 of this chapter's own 6 named categories originally found; still only 2 of those 6 specifically (21.7). A real conflict still permanently blocks an SEU from ever reaching `Commissioned`, now via `CommissionFailed`/a real `Failed` state rather than `SEUCommissionRejected`. Still the strongest-built claim in this whole chapter (21.7, 21.8).
3. **[Code, updated 2026-09-07]** Composition Strategies — still 1 of 7 (`Override`) for whole-Pack composition, unchanged, now dead code. But 5 of 7 (`Merge`/`Union`/`Intersection`/`Supplement`/`Specialize`) are genuinely real now, for a different use case this chapter's own §10 doesn't name: human-triggered, field-level conflict *resolution* (21.6) — built ahead of CR-067's own generic redesign, for exactly the strategies CR-067 already said it would redefine.
4. **[Code, no longer a negative]** A missing mandatory Pack now genuinely blocks commissioning — `checkRequestLiveness` (Chapter 8 §9's own domain), not a `warnings` entry silently excluding it from the composed set. §13's own "mandatory Pack availability" now holds, just via a sibling chapter's mechanism, not the Composition Engine itself (21.9).
5. **[Code, updated 2026-09-07]** Real, human-triggered conflict resolution exists for the first time (`applyConflictStrategy`) — but `resolutions` is still permanently `[]`, and there's still no deterministic/non-deterministic classification for §12's own distinction, by deliberate design: every resolution is a human's own explicit choice, never automatic (21.8).
6. **[Code]** Recomposition (§16) still has schema support (a real, correct `version`-increment) but is still never triggered by anything, unchanged. `ebms.status` is no longer write-only for `'Active'` (Composed/Validated/Active are all real writes now, 21.11) — but still never `'Superseded'` (21.12).
7. **[Code, updated 2026-09-07]** 3 of 11 named events (§17) now exist — `CompositionStarted`/`EBMCreated`/`EBMActivated`, published from `ebmComposer.ts`/`transitionEbm`, not `compositionEngine.ts` itself, which still contains zero `eventBus` calls (21.13).