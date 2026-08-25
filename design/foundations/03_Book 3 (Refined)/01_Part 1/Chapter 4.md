
# Chapter 4 – Composition Engine

[Remarks:

The EBM answers **what** governs an SEU.

Composition Engine answers **how** the EBM is created.

This chapter should **not** describe Pack internals. It describes the orchestration that transforms Packs into an executable Engineering Behavior Model.

This is the **compiler** of the platform.

The Composition Engine takes:

- Packs
- Templates
- Behavioural contributions,
- Governance,
- Engineering constraints
- Other definitions

and produces an executable **Engineering Behavior Model**.

Just as modern compilers produce diagnostics (warnings, errors and informational messages), the Composition Engine should produce a **Composition Report** as a first-class artefact.

The report should include:

- Packs used and their versions.
- Resolved dependencies.
- Automatic conflict resolutions.
- Conflicts requiring manual intervention.
- Warnings (for example, recommended packs not installed).
- Effective behavioural summary.
- Traceability matrix from Pack → Behaviour → EBM.

This report would be invaluable for governance, audits and debugging why a particular SEU behaves the way it does. I think it should become a permanent artefact attached to every commissioned SEU, alongside its Engineering Behavior Model. It also reinforces the platform's principle that behaviour is not only composable but fully explainable and traceable.
]


# 1. Purpose

The Composition Engine is responsible for constructing an **Engineering Behavior Model (EBM)** by composing behavioural contributions from one or more Packs.

The Composition Engine is the only platform component authorised to create, validate, version and activate an Engineering Behavior Model.

The Composition Engine performs no software engineering work itself. Its responsibility is limited to producing a complete, internally consistent and traceable behavioural model suitable for commissioning a Software Engineering Unit (SEU).



# 2. Scope

This chapter defines:

- Composition Engine responsibilities.
- Inputs and outputs.
- Composition lifecycle.
- Conflict detection.
- Behaviour resolution.
- Validation.
- Versioning.
- Activation.

This chapter does not define:

- Pack structure.
- Pack lifecycle.
- Engineering behaviour.
- Runtime execution.



# 3. Architectural Position

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



# 4. Responsibilities

The Composition Engine shall:

- discover Packs;
- resolve dependencies;
- validate compatibility;
- compose behavioural contributions;
- detect conflicts;
- resolve deterministic conflicts;
- identify non-deterministic conflicts;
- construct the Engineering Behavior Model;
- version the Engineering Behavior Model;
- activate the Engineering Behavior Model.

The Composition Engine shall not:

- execute Work Items;
- manage Participants;
- manage Deliverables;
- preserve Knowledge.



# 5. Inputs

The Composition Engine shall accept:

- one SEU Template;
- zero or more Organisation Packs;
- zero or more Domain Packs;
- zero or more Compliance Packs;
- zero or more Technology Packs;
- zero or more Integration Packs;
- Platform Packs.

Additional Pack categories may be introduced through the Extension Framework.



# 6. Output

The output of the Composition Engine shall be exactly one Engineering Behavior Model.

The Engineering Behavior Model shall contain:

- behavioural rules;
- governance rules;
- authority rules;
- engineering standards;
- terminology mappings;
- quality gates;
- review gates;
- behavioural metadata.

The Composition Engine shall not expose partially composed models.



# 7. Functional Requirements

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



# 8. Composition Lifecycle

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



# 9. Dependency Resolution

The Composition Engine shall determine:

- required Packs;
- optional Packs;
- conditional Packs;
- incompatible Packs;
- missing Packs.

Dependencies shall be declared by Packs.

Dependencies shall not be inferred.



# 10. Behaviour Composition

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



# 11. Conflict Detection

The Composition Engine shall identify behavioural conflicts.

Examples include:

- contradictory authority rules;
- incompatible workflows;
- conflicting quality gates;
- inconsistent terminology;
- incompatible compliance requirements;
- incompatible technology constraints.

Conflicts shall be classified as:

- deterministic;
- non-deterministic.



# 12. Conflict Resolution

Deterministic conflicts shall be resolved automatically.

Non-deterministic conflicts shall require explicit resolution before commissioning.

Every resolution shall be recorded.

Every resolution shall remain traceable.



# 13. Validation

The Composition Engine shall validate:

- behavioural completeness;
- Pack compatibility;
- governance completeness;
- dependency completeness;
- mandatory Pack availability;
- mandatory behavioural rules;
- terminology consistency.

Validation shall fail if the resulting Engineering Behavior Model is incomplete.



# 14. Composition Traceability

Every behavioural rule in the Engineering Behavior Model shall be traceable to:

- originating Pack;
- originating Pack version;
- composition strategy;
- conflict resolution (if applicable).

Composition traceability shall remain permanently available.



# 15. Activation

Only validated Engineering Behavior Models may be activated.

Activation shall:

- assign an identifier;
- assign a version;
- publish activation events;
- make the Engineering Behavior Model available for SEU commissioning.

Activation shall not modify existing Engineering Behavior Models.



# 16. Recomposition

Engineering Behavior Models may be recomposed when:

- Packs are upgraded;
- behavioural conflicts are resolved;
- governance changes;
- new mandatory Packs become available;
- authorised users request recomposition.

Recomposition shall never modify historical Engineering Behavior Models.



# 17. Events

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



# 18. Non-Functional Requirements

The Composition Engine shall:

- produce deterministic output;
- support concurrent composition requests;
- maintain complete auditability;
- preserve historical versions;
- support incremental recomposition;
- remain independent of execution technologies.



# 19. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Mandatory Packs are resolved.

✓ Behavioural contributions are successfully composed.

✓ Deterministic conflicts are resolved automatically.

✓ Non-deterministic conflicts prevent commissioning.

✓ Every Engineering Behavior Model is versioned.

✓ Every behavioural contribution is traceable to its source.

✓ Engineering Behavior Models are immutable after activation.



# 20. Deliverables

Implementation of this chapter shall produce:

- Composition Engine service.
- Composition pipeline.
- Dependency resolver.
- Conflict detection service.
- Conflict resolution framework.
- Validation service.
- Engineering Behavior Model builder.
- Composition traceability service.
- Composition APIs.
- Domain events.



# 21. Implementation Status & Gaps

Code-verified audit (2026-08-24), not from memory — every claim below carries a file:line citation, cross-checked against a live query against the running Postgres instance (`aisworg` DB). Core files: `src/domain/engine/compositionEngine.ts` (144 lines, its entire real implementation), `src/routes/seu/core/commissioning.ts` (its one and only call site), `src/dblayer/ebmsDB.ts`, `EbmRow`/`EbmComposedPack`/`EbmCompositionReport` (`src/dblayer/seuTypes.ts`). Live `ebms` schema: `id, seu_id, template_id, profile_id, composed_packs, composition_report, status, version, created_at`.

The chapter's own "compiler" framing (§0's design note) is the single most useful lens for this audit: what's built is roughly the *linker* stage (resolve which Pack files participate, in what order, flag duplicate symbols) — not the *compiler* (parse each Pack's own contributions, extract and categorize the rules within them, detect semantic conflicts between rule bodies, emit one unified program). `compositionEngine.compose()` produces an ordered list of whole Packs plus a thin report; it never opens up a Pack's own `contributions` JSONB and reassembles what's inside into the rich, categorized Engineering Behavior Model §6 describes (behavioural rules / governance rules / authority rules / engineering standards / terminology mappings / quality gates / review gates, each separately present and traceable). Every other finding in this section is a consequence of that one fact.

## 21.1 Inputs — Template + Profile only, not the flexible Pack-category list (§5)

The chapter describes accepting "zero or more Organisation Packs... Domain Packs... Compliance Packs... Technology Packs... Integration Packs... Platform Packs" directly. The real signature is narrower and indirect: `compose(input: {templateId, profileId})` (`compositionEngine.ts:34`) — Packs are never passed in as a flexible, categorized list. They're derived from exactly two sources: `templatesDB.getMandatoryPackCodes(templateId)` and `profilesDB.getOptionalPackCodes(profileId)`. A Pack's own `category:pack` value (Compliance/Domain/Engineering/Integration/Organisation/Technology) plays no role in composition at all — it's metadata on the Pack, never consulted by `compositionEngine.ts` to decide inclusion, ordering, or strategy.

## 21.2 Output — an ordered Pack list + a thin report, not a decomposed Engineering Behavior Model (§6)

`compose()` returns `{composedPacks: EbmComposedPack[], compositionReport: EbmCompositionReport}` — `composedPacks` is just `{packId, packCode, packVersion}` per Pack; `compositionReport` is `{warnings: string[], conflicts: string[], resolutions: string[]}` (`seuTypes.ts:391-401`). Neither field contains anything resembling the chapter's own named EBM contents: no extracted/merged behavioural rules, governance rules, authority rules, engineering standards, terminology mappings, quality gates, or review gates as their own first-class EBM structures. `ebms.composed_packs`/`ebms.composition_report` store exactly this same thin shape (migration `002_seu_platform.sql:141-151`). Whatever governance an SEU actually runs under still lives inside each individual Pack's own `contributions` JSONB, resolved ad hoc by whichever engine needs it (`qualityGateEngine.ts`, `transitionEngine.ts`, etc.) — never assembled into one queryable EBM object the way §6 describes.

## 21.3 Functional Requirements (FR-4.1–7) (§7)

| FR | Verdict | Note |
||||
| FR-4.1 invoked before every commissioned SEU | ✅ | `commissioning.ts:139` is the only call site, unconditionally on the commissioning path. |
| FR-4.2 exactly one EBM per commissioned SEU | ✅ | `ebmsDB.create` (`ebmsDB.ts:6-25`) inserts exactly one row per successful commission. |
| FR-4.3 every behavioural contribution retains its originating Pack reference | ⚠️ Pack-level only | `composedPacks` records each *Pack's* origin; no individual rule/contribution inside a Pack gets its own separate origin record (21.2) — trivially "retained" only because it was never extracted from the Pack in the first place. |
| FR-4.4 complete composition traceability | ⚠️ | Same shape as FR-4.3 — real at the Pack level (`ebms.composed_packs`), absent at the rule level. |
| FR-4.5 deterministic composition | ⚠️ | The code's own comment (`compositionEngine.ts:6-8`) names the tension directly: "the same set is evaluated fresh each time, not cached" — `resolveActivePack` always resolves to whichever Pack version is *currently* Active. Identical `{templateId, profileId}` input can produce a different `composedPacks` result at two different points in time if a Pack's Active version changed in between — deterministic only if "identical inputs" is read to include the full DB state at call time, not just the two ids. |
| FR-4.6 support incremental recomposition | ❌ | No incremental mechanism exists — `compose()` always fully re-resolves both code lists from scratch. Moot regardless per 21.12: nothing ever calls it a second time for an existing SEU. |
| FR-4.7 recomposition produces a new EBM version | ⚠️ unexercised | `ebmsDB.create`'s `version` column genuinely computes `COALESCE(MAX(version),0)+1` per `seu_id` (`ebmsDB.ts:16`) — real, working SQL — but since nothing ever triggers a second `compose()`+`create()` for the same SEU (21.12), this path has never run in practice beyond version 1. |

## 21.4 Composition Lifecycle — a flat function, not the 9-stage pipeline (§8)

The chapter names 9 distinct stages (Collect Inputs → Resolve Dependencies → Validate Packs → Compose Behaviour → Detect Conflicts → Resolve Conflicts → Validate Model → Version Model → Activate Model), each implying its own checkpoint ("failure at any stage shall terminate the composition process"). The real `compose()` is one flat async function: resolve mandatory codes → resolve optional codes → de-duplicate by Pack code (the one real "Override") → run 2 narrow conflict checks → return. There's no distinct "Validate Packs" step (a Pack's mere existence via `findActiveByCode` is all that's checked — no compatibility validation), no "Resolve Conflicts" step (conflicts are only ever reported, never resolved, 21.8), no "Validate Model" step against the resulting EBM's own completeness, and "Version Model"/"Activate Model" are collapsed into one immediate `INSERT ... status='Active'` in `ebmsDB.create` (21.11) rather than two distinct, separately-gated stages.

## 21.5 Dependency Resolution — not built as its own step; Pack `dependencies[]` never consulted here (§9)

The chapter says the Composition Engine itself shall determine required/optional/conditional/incompatible/missing Packs. In the real system, this doesn't happen inside `compositionEngine.ts` at all — `compose()` never reads `packs.dependencies[]` (the `required`/`optional`/`conditional`/`incompatible` array CR-066 already found only `required` has any real semantics for, and only at Pack *publish* validation time, `packs.ts:440-443` — a completely different, earlier stage than composition). The mandatory/optional Pack *codes* composition actually resolves come from the Template's/Profile's own pre-authored sets, not from walking any dependency graph at commissioning time. "Missing Packs" is the closest real behaviour: `resolveActivePack` produces a warning when a code has no Active Pack version — but see 21.9, this never blocks anything.

## 21.6 Behaviour Composition / Composition Strategies — 1 of 7 real, and only at the whole-Pack level (§10)

Only **Override** exists, and only for one specific case: a Pack `code` appearing in both the Template's mandatory set and the Profile's optional set — "later composition overrides earlier" (`compositionEngine.ts:55-65`), i.e. the *entire Pack* from the optional set wins over the mandatory one, wholesale. **Merge, Supplement, Union, Intersection, Alias, Conflict Detection** — zero mechanism for any of them. None of the 7 operate on Pack *contents* either way (two different Packs each contributing their own Capability/Policy/Quality Gate never get merged, unioned, or aliased together at the content level — they simply both exist, side by side, inside the composed Pack list, exactly as authored).

## 21.7 Conflict Detection — 2 of 6 named conflict types real; no deterministic/non-deterministic classification (§11)

`detectGovernanceConflicts` (`compositionEngine.ts:100-144`) checks exactly two things: (a) two different Packs assigning a different `authorisedRole` to the same `governedTransition` (contradictory authority rules — real, matches the chapter's first example), and (b) two different Packs both contributing a Quality Gate on the same `(governedTransition, category)` slot (conflicting quality gates — real, though narrower than the chapter's plain "conflicting quality gates," since CR-058 established one gate per category can coexist). **Incompatible workflows, inconsistent terminology, incompatible compliance requirements, incompatible technology constraints** — zero detection for any of them; no mechanism even has the data to check most of these (no first-class "workflow"/"terminology mapping" entity exists to compare). §11's own deterministic/non-deterministic classification doesn't exist as a concept anywhere — `conflicts` is a flat `string[]`, no type/severity field at all.

## 21.8 Conflict Resolution — conflicts genuinely block commissioning, but zero auto-resolution and `resolutions` is permanently empty (§12)

**The one genuinely strong, working mechanism in this whole chapter's audit**: `commissioning.ts:145-156` — if `compositionReport.conflicts.length > 0`, commissioning is rejected outright (`SEUCommissionRejected` published, the SEU never reaches `Commissioned`) — real, unconditional, not a warning. This is §12's "non-deterministic conflicts shall require explicit resolution before commissioning" genuinely holding, for the 2 conflict types that exist. But there's no deterministic/non-deterministic split to apply "resolved automatically" to in the first place — `EbmCompositionReport.resolutions` (`seuTypes.ts:400`) is a real field, but **nothing anywhere ever pushes an entry into it** — confirmed via search, the array is always `[]`. No conflict of any kind is ever auto-resolved; every one found simply blocks, permanently, until whatever produced it (typically a Pack republish) removes it.

## 21.9 Validation — missing mandatory Packs are a warning, not a block; most named checks don't exist (§13)

The chapter names 7 validation axes, all of which should fail composition if incomplete. The real system validates almost none of them as blocking conditions: a mandatory or optional Pack with no Active version produces a `warnings` entry (`resolveActivePack`, `compositionEngine.ts:25-31`) — **composition proceeds anyway**, with that Pack silently excluded from `composedPacks`. Only `conflicts` (21.8) actually blocks; `warnings` never does. Pack compatibility, governance completeness, dependency completeness, mandatory behavioural rules, and terminology consistency have no dedicated checks at all — the closest real proxy for any of them is the same 2-conflict-type check in 21.7.

## 21.10 Composition Traceability — real at the Pack level, absent at the rule level (§14)

`ebms.composed_packs` gives real, permanent traceability from an EBM back to exactly which Pack + which Pack version contributed to it (`EbmComposedPack`, `seuTypes.ts:391-395`) — genuinely real, not aspirational. "Composition strategy" and "conflict resolution (if applicable)" per rule don't exist as trace fields, consistent with 21.2/21.6/21.8 — there's no per-rule record to attach either to.

## 21.11 Activation — collapsed into creation; no separate stage, no `EBMActivated` event (§15)

`ebmsDB.create` inserts a new `ebms` row with `status` hardcoded to `'Active'` immediately (`ebmsDB.ts:16`) — despite the live `CHECK` constraint still listing `'Composed'` as a valid status (`002_seu_platform.sql:148-149`), no row is ever actually created in that state first. There's no separate validate-then-activate gate, no distinct identifier/version assignment step beyond the same `INSERT`, and no activation event of any kind (21.13). "Activation shall not modify existing Engineering Behavior Models" holds trivially — nothing ever updates an `ebms` row post-creation, but not because of a deliberate immutability guarantee; there's simply no code path that would.

## 21.12 Recomposition — the version-increment SQL exists but has never run past 1 (§16)

None of the chapter's 5 named recomposition triggers (Pack upgrade, conflict resolution, governance change, new mandatory Pack, authorised user request) invoke `compositionEngine.compose()` a second time for an existing SEU — confirmed via the single call site (21.1). `ebmsDB.create`'s own `version` computation is real, working SQL that *would* correctly increment on a second call — but nothing marks a prior `ebms` row `'Superseded'` when that happens (no code path sets that status at all, live-confirmed: zero writes to `ebms.status` anywhere in the codebase besides the initial `'Active'` insert) — so even if recomposition were triggered today, two `'Active'` rows could coexist for the same SEU, contradicting "recomposition shall never modify historical Engineering Behavior Models" only by accident, not by a real superseding mechanism.

## 21.13 Events — 0 of 11 named events real (§17)

Confirmed via direct search: none of `CompositionStarted`, `DependencyResolved`, `DependencyFailed`, `PackValidated`, `BehaviourComposed`, `ConflictDetected`, `ConflictResolved`, `CompositionValidated`, `EBMCreated`, `EBMActivated`, `CompositionFailed` are ever published — `compositionEngine.ts` itself contains zero `eventBus` calls. The only events published anywhere near composition are `SEUCommissionRejected` and `SEUCommissioned` (`commissioning.ts`), at the SEU level, not named after or scoped to the Composition Engine's own lifecycle at all.

## 21.14 Non-Functional Requirements (§18)

| NFR | Verdict | Basis |
||||
| produce deterministic output | ⚠️ | 21.3 FR-4.5 — deterministic only relative to current DB state, not a pure function of `{templateId, profileId}` alone |
| support concurrent composition requests | ✅ (trivially) | Stateless function, no shared mutable state; concurrent calls don't interfere structurally |
| maintain complete auditability | ⚠️ | Pack-level real (21.10); rule-level absent |
| preserve historical versions | ⚠️ unexercised | Schema supports it (`version` column, 21.3 FR-4.7); no superseding mechanism (21.12) means it's never been exercised beyond version 1 |
| support incremental recomposition | ❌ | 21.3 FR-4.6 |
| remain independent of execution technologies | ✅ | No technology-specific coupling anywhere in `compositionEngine.ts` |

## 21.15 Acceptance Criteria (§19)

| Criterion | Verdict |
|||
| Mandatory Packs are resolved | ⚠️ resolved-or-warned, not guaranteed — a missing mandatory Pack doesn't block (21.9) |
| Behavioural contributions are successfully composed | ⚠️ Packs are composed; contributions *within* them are not (21.2) |
| Deterministic conflicts are resolved automatically | ❌ no classification exists, nothing is ever auto-resolved (21.7/21.8) |
| Non-deterministic conflicts prevent commissioning | ✅ (for the 2 conflict types that exist) — the strongest-built claim in this chapter (21.8) |
| Every Engineering Behavior Model is versioned | ✅ schema-real, ⚠️ unexercised beyond version 1 (21.12) |
| Every behavioural contribution is traceable to its source | ⚠️ Pack-level only (21.10) |
| Engineering Behavior Models are immutable after activation | ✅ (by accident of no update path existing, not a deliberate guarantee — 21.11) |

## 21.16 Deliverables (§20)

| Named Deliverable | Real artifact | Verdict |
||||
| Composition Engine service | `compositionEngine.ts` | ✅ (minimal) |
| Composition pipeline | One flat `compose()` function | ⚠️ not the 9-stage pipeline (21.4) |
| Dependency resolver | — | ❌ not built as its own component (21.5) |
| Conflict detection service | `detectGovernanceConflicts` | ⚠️ 2 of 6 named conflict types (21.7) |
| Conflict resolution framework | `EbmCompositionReport.resolutions` | ❌ field exists, never populated (21.8) |
| Validation service | `resolveActivePack`'s warning path | ⚠️ warns, never blocks except via conflicts (21.9) |
| Engineering Behavior Model builder | `composedPacks`/`ebms` row | ⚠️ builds a Pack list, not a decomposed model (21.2) |
| Composition traceability service | `ebms.composed_packs` | ⚠️ Pack-level only (21.10) |
| Composition APIs | `commissioning.ts`'s own call site | ⚠️ invoked internally; no standalone recompose/inspect API |
| Domain events | — | ❌ 0 of 11 (21.13) |

## Summary — ranked

1. **[Architecture — the chapter's own "compiler" analogy names exactly what's missing]** The Composition Engine composes *Packs*, not the *behavioural content inside them* — it produces an ordered Pack list with a thin report, never the decomposed, categorized Engineering Behavior Model (rules/governance/authority/standards/terminology/gates, each first-class and traceable) §6 describes. Every other finding in this audit is downstream of this one (21.1, 21.2).
2. **[Governance, genuinely real and strong]** Conflict detection, though narrow (2 of 6 named types), is a real, unconditional, working gate on commissioning — a real conflict permanently blocks an SEU from ever reaching `Commissioned` until whatever caused it is removed. The strongest-built claim in this whole chapter (21.7, 21.8).
3. **[Code]** Composition Strategies — 1 of 7 (`Override`), and only at the whole-Pack level, never Pack-content level. This is exactly the gap the owner is about to design a generic Composition Strategy CR to close (21.6).
4. **[Code, surprising negative]** A missing mandatory Pack never blocks commissioning — only a `warnings` entry, silently excluded from the composed set. Contradicts §13's "mandatory Pack availability" as a validation requirement directly (21.9).
5. **[Code]** Zero auto-resolution exists for any conflict — `resolutions` is permanently `[]` — and there's no deterministic/non-deterministic classification for §12's own distinction to apply to (21.8).
6. **[Code]** Recomposition (§16) has schema support (a real, correct `version`-increment) but is never triggered by anything, and nothing marks a prior EBM `'Superseded'` even if it were (21.12).
7. **[Code]** 0 of 11 named events (§17) exist — composition happens silently; only the SEU-level `SEUCommissioned`/`SEUCommissionRejected` bookend it (21.13).