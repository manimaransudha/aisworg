# Chapter 3 – Engineering Behavior Model (EBM)

[Sudha: I think this chapter is a solid first version, but while writing it I noticed one concept that I deliberately did **not** define because I think it deserves its own chapter.

We keep referring to **Behavioural Rules**, but we haven't answered:

> **What is a Behaviour?**

That may sound philosophical, but I think it's actually a modelling question.

For example, is:

- "Every merge requires two reviewers."

a Behaviour?

Or is it a **Constraint**?

Is:

- "Use GitFlow."

a Behaviour?

Or is it a **Workflow**?

Is:

- "Validate all inputs."

a Behaviour?

Or is it a **Policy**?

I don't think we should answer that in this chapter because it would make it too broad. Instead, I think Book 3 should later introduce a **Behaviour Model** chapter that defines the taxonomy of behavioural rules contributed by Packs. That taxonomy will make the Composition Engine much more rigorous and will give every Pack a common language for contributing behaviour. I don't think it's a blocker for continuing, but I do think it's an important piece of the implementation model that deserves explicit treatment rather than being left implicit.
The EBM answers **what** governs an SEU.
]

# 1. Purpose

The **Engineering Behavior Model (EBM)** defines the behavioural contract governing the operation of a Software Engineering Unit (SEU).

Every commissioned SEU shall execute against exactly one Engineering Behavior Model.

The EBM defines **how** software engineering shall be performed within an SEU. It governs engineering behaviour but does not define engineering competence.

Engineering competence resides with Participants.

Engineering behaviour resides with the EBM.
 

# 2. Scope

This chapter defines:

- the Engineering Behavior Model;
- behavioural composition;
- behavioural categories;
- behavioural inheritance;
- behavioural constraints;
- runtime interaction with the SEU.

This chapter does not define:

- Pack composition algorithms;
- Pack lifecycle;
- individual Pack implementations;
- participant capabilities.

These are defined in later chapters.
 
# 3. Architectural Position

The Engineering Behavior Model occupies the boundary between the Composition Engine and the commissioned SEU.

```
Packs
    │
    ▼
Composition Engine
    │
    ▼
Engineering Behavior Model
    │
    ▼
Software Engineering Unit
    │
    ▼
Participants
```

The SEU consumes an EBM but never modifies it directly.
 

# 4. Definition

The Engineering Behavior Model is the complete behavioural specification governing a commissioned Software Engineering Unit.

It is produced by composing behavioural contributions from one or more Packs.

The EBM is authoritative for the lifetime of the commissioned SEU unless superseded through a governed recomposition process.
 

# 5. Architectural Responsibilities

The EBM shall:

- define engineering behaviour;
- define governance behaviour;
- define decision behaviour;
- define quality behaviour;
- define compliance behaviour;
- define collaboration behaviour;
- define lifecycle behaviour;
- define authority behaviour;
- define engineering terminology;
- define engineering constraints.

The EBM shall not:

- contain executable work;
- schedule execution;
- manage participants;
- preserve knowledge;
- execute workflows.



# 6. Functional Requirements

### FR-3.1

Every commissioned SEU shall reference exactly one active Engineering Behavior Model.



### FR-3.2

Every Engineering Behavior Model shall possess a globally unique identifier.



### FR-3.3

Every Engineering Behavior Model shall be versioned.



### FR-3.4

Every behavioural contribution shall be traceable to its originating Pack.



### FR-3.5

Every behavioural rule shall define its composition strategy.



### FR-3.6

Behavioural conflicts shall be detected before an SEU is commissioned.



### FR-3.7

Behavioural conflicts requiring human judgement shall prevent commissioning until resolved.



### FR-3.8

An Engineering Behavior Model shall be immutable during normal execution.



### FR-3.9

Modification of an Engineering Behavior Model shall occur only through recomposition.



### FR-3.10

All recompositions shall be versioned and fully traceable.



# 7. Behaviour Categories

An Engineering Behavior Model may contain behavioural contributions in the following categories.

## Engineering Practices

Examples:

- Coding standards
- Documentation standards
- Branching strategy
- Review practices



## Governance

Examples:

- Decision rules
- Approval rules
- Escalation rules
- Delegation rules



## Quality

Examples:

- Definition of Ready
- Definition of Done
- Quality gates
- Acceptance criteria



## Compliance

Examples:

- HIPAA
- PCI-DSS
- SOX
- ISO 27001



## Domain

Examples:

- Domain terminology
- Domain ontology
- Business rules
- Domain-specific validation



## Technology

Examples:

- Java conventions
- Node.js conventions
- Kubernetes deployment rules



## Integration

Examples:

- GitHub workflow
- Jira integration
- Azure DevOps integration



## Decision Governance

Examples:

- Required approvers
- Evidence requirements
- Review boards
- Exception policies



## Obligations

Examples:

- Risk handling
- Audit findings
- Customer observations
- Security findings



# 8. Behavioural Rule

Every behavioural rule shall contain at least:

- Identifier
- Name
- Description
- Behaviour Category
- Originating Pack
- Version
- Composition Strategy
- Applicability Conditions
- Enforcement Level
- Traceability Reference

The internal representation shall be implementation-defined.



# 9. Composition Principles

The EBM is produced by composing behavioural contributions.

Supported composition strategies include:

- Override
- Merge
- Supplement
- Union
- Intersection
- Alias
- Conflict Detection

Additional strategies may be introduced through the Extension Framework.



# 10. Behavioural Inheritance

Behaviour shall be inherited from multiple Pack categories.

A typical Engineering Behavior Model may inherit behaviour from:

```
Platform Packs
        │
Organisation Packs
        │
Domain Packs
        │
Compliance Packs
        │
Technology Packs
        │
Integration Packs
        │
        ▼
Engineering Behavior Model
```

No assumptions shall be made regarding the number of contributing Packs.



# 11. Behaviour Resolution

When multiple Packs contribute behaviour affecting the same engineering concern, the Composition Engine shall resolve the behaviour according to declared composition strategies.

The Composition Engine shall produce a single, internally consistent Engineering Behavior Model.

Resolution shall be deterministic and repeatable.



# 12. Behaviour Enforcement

The Engineering Behavior Model defines expected behaviour.

Enforcement of behaviour is the responsibility of runtime services.

Examples include:

- Governance Runtime
- Dependency Engine
- Knowledge Runtime
- Obligation Runtime

The EBM itself performs no execution.



# 13. Runtime Interaction

During execution:

- Participants consult the EBM.
- Runtime services enforce the EBM.
- Deliverables are validated against the EBM.
- Decisions are evaluated against the EBM.
- Obligations are assessed against the EBM.

The EBM remains read-only.



# 14. Versioning

Every Engineering Behavior Model shall maintain:

- Version identifier
- Parent version
- Composition history
- Source Pack versions
- Change history
- Approval history

Historical versions shall remain reproducible.



# 15. Events

The platform shall publish at least the following domain events:

- EBMCreated
- EBMValidated
- EBMVersioned
- EBMActivated
- EBMRetired
- BehaviourConflictDetected
- BehaviourConflictResolved



# 16. Non-Functional Requirements

The Engineering Behavior Model shall:

- be deterministic;
- be reproducible;
- be immutable during execution;
- be fully traceable;
- support incremental evolution;
- support concurrent versions;
- remain independent of implementation technologies.



# 17. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Behaviour from multiple Packs is successfully composed.

✓ Behavioural conflicts are detected.

✓ Behavioural conflicts are resolved before commissioning.

✓ The resulting Engineering Behavior Model is versioned.

✓ Runtime services correctly consume the Engineering Behavior Model.

✓ The Engineering Behavior Model remains immutable during execution.



# 18. Deliverables

Implementation of this chapter shall produce:

- Engineering Behavior Model domain object.
- Behaviour catalogue.
- Behavioural rule model.
- Versioning model.
- Behaviour validation services.
- Behaviour query services.
- Behaviour composition interfaces.
- Initial Engineering Behavior Model API.

---

# 19. Implementation Status & Gaps

Code-verified audit (2026-08-25), not from memory — every claim below carries a file:line citation, cross-checked against a live query against the running Postgres instance (`aisworg` DB). Core files: `src/dblayer/ebmsDB.ts`, `EbmRow`/`EbmComposedPack`/`EbmCompositionReport` (`src/dblayer/seuTypes.ts`), `src/domain/engine/compositionEngine.ts`, `src/routes/seu/core/commissioning.ts`, `governanceModel.ts`, `compliance.ts`, `traceability.ts`, `dependencyDefinitionEngine.ts`. This chapter shares its entire real implementation with Chapter 4 (Composition Engine) — the EBM is Chapter 4's own output — so this audit cross-references Chapter 4 §21 directly wherever the finding is identical, rather than re-deriving it, and focuses new investigation on what Chapter 3 asks for that Chapter 4 didn't already cover: Behaviour Categories, Behavioural Rule structure, Inheritance ordering, Enforcement service naming, and — the one genuinely new positive finding — whether anything actually *consults* the EBM at runtime.

**The single most useful finding, not visible from Chapter 4's own audit alone**: the EBM genuinely *is* consulted at runtime by 5 real call sites (`governanceModel.ts`, `compliance.ts`, `traceability.ts`, `dependencyDefinitionEngine.ts`, `seus.ts`) — real, not aspirational. But every one of them reads `ebm.composed_packs` only, to resolve "which Packs are in scope for this SEU," then goes on to query each individual Pack's own materialized governance (Quality Gates, Policies, Obligations) directly. Nothing ever queries the EBM itself for a behavioural rule, a category, or a composition strategy — because none of those exist as EBM-native structures (§9's own "Definition, Output" finding). The EBM is real, working infrastructure — just as a resolved *Pack-scope pointer*, not as the queryable behavioural catalogue this chapter describes.

## 19.1 Definition — real, and the owner has since sharpened it further (§4)

"Produced by composing behavioural contributions from one or more Packs" — real, matches Chapter 4 §21 exactly (`compose()`'s `composedPacks`). "Authoritative for the lifetime of the commissioned SEU unless superseded through a governed recomposition process" — the "unless superseded" half is not yet built (Chapter 4 §21.12: recomposition is never triggered, nothing ever marks a prior EBM `'Superseded'`) — but the owner has since restated this exact sentence as the *governing principle* for CR-067's own Override/Supersession strategy definition (noted in CR-067, not yet built either) — so this line, unusually for this audit series, already has a settled design waiting on it, not just an open question.

## 19.2 Architectural Responsibilities — the "shall define" list names governance that's real but not EBM-native; the "shall not" list holds (§5)

None of the 10 named "shall define" behaviour kinds (engineering/governance/decision/quality/compliance/collaboration/lifecycle/authority/terminology/constraints) exist as first-class content *on* an EBM — but several of the underlying mechanisms are independently real elsewhere on the platform (Quality Gates, Policies, Authority Rules, Obligations, Decisions) and reachable *through* the EBM's own Pack-list pointer (19's own preamble finding). The 5 "shall not" items (no executable work, no scheduling, no participant management, no knowledge preservation, no workflow execution) hold cleanly — `ebms`/`ebmsDB.ts` do none of these.

## 19.3 Functional Requirements (FR-3.1–10) (§6)

| FR | Verdict | Note |
|---|---|---|
| FR-3.1 every commissioned SEU references exactly one active EBM | ✅ | `seus.active_ebm_id`, set once at commissioning (`commissioning.ts:166`). |
| FR-3.2 globally unique identifier | ✅ | `ebms.id` real UUID PK. |
| FR-3.3 versioned | ✅ real, ⚠️ unexercised beyond 1 | Same finding as Ch.4 §21.3 FR-4.7 — real `COALESCE(MAX(version),0)+1` SQL, never actually triggered a second time for any SEU. |
| FR-3.4 every behavioural contribution traceable to its originating Pack | ⚠️ Pack-level only | Same as Ch.4 §21.10 — `composed_packs` traces Packs, not individual rules within them (none exist as their own entities, 19.5). |
| FR-3.5 every behavioural rule defines its composition strategy | ❌ | No behavioural rule entity exists to carry this field at all (19.5) — moot, not partially true. |
| FR-3.6 conflicts detected before commissioning | ✅ | Same as Ch.4 §21.7 — 2 of the chapter's named conflict types real, checked before every commission. |
| FR-3.7 conflicts requiring human judgement prevent commissioning | ✅ | Same as Ch.4 §21.8 — the strongest-built claim in both chapters' audits; unconditional, not a warning. |
| FR-3.8 EBM immutable during normal execution | ✅ (by construction, not enforcement) | Same as Ch.4 §21.11 — no code path ever updates an `ebms` row post-creation. |
| FR-3.9 modification only through recomposition | ⚠️ vacuously true | Nothing modifies an EBM at all, including through recomposition — recomposition itself is never triggered (Ch.4 §21.12). |
| FR-3.10 recompositions versioned and fully traceable | ⚠️ unexercised | Same basis as FR-3.3. |

## 19.4 Behaviour Categories — 9 named, zero real tagging mechanism (§7)

No behavioural contribution anywhere carries a category tag matching this list (Engineering Practices / Governance / Quality / Compliance / Domain / Technology / Integration / Decision Governance / Obligations) — confirmed, no `behaviourCategory`/`behaviorCategory` field exists in the codebase. Worth not confusing with `category:pack` (Ch.5's own real, 6-value Ontology vocabulary: Compliance, Domain, Engineering, Integration, Organisation, Technology) — that categorizes *Packs themselves*, a different and narrower list, and is never consulted by composition either (19.7).

## 19.5 Behavioural Rule — 0 of 10 fields real; no such entity exists (§8)

Confirmed directly: there is no `BehaviouralRule`/`BehavioralRule` type, table, or structure anywhere in the codebase. All 10 named fields (Identifier, Name, Description, Behaviour Category, Originating Pack, Version, Composition Strategy, Applicability Conditions, Enforcement Level, Traceability Reference) are consequently absent — not because any one of them was deliberately dropped, but because the entity they'd belong to was never built (root cause already named in this section's own preamble).

## 19.6 Composition Principles — identical finding to Chapter 4 §21.6, now being redesigned generically via CR-067 (§9)

Same 7 named strategies, same real status: only `Override` has any implementation, and only at the whole-Pack level. CR-067 (raised 2026-08-24, design mostly settled) is actively redefining this set generically — `Alias` renamed `Specialization`, `Merge`/`Union`/`Intersection`/`Supplement` given real field-level definitions, `Conflict Detection` reframed as Merge/Union's own internal escalation path rather than an independent strategy. Not built yet.

## 19.7 Behavioural Inheritance — the Platform→Organisation→...→Integration ordering is not real; composition is category-blind (§10)

The chapter's own diagram implies a specific, ordered inheritance chain by Pack category. The real `compose()` (`compositionEngine.ts:34-87`, Ch.4 §21.1) never reads `category:pack` at all — it resolves exactly two flat lists (a Template's mandatory Pack codes, then a Profile's optional Pack codes) with no category-aware ordering or layering of any kind. "No assumptions shall be made regarding the number of contributing Packs" holds trivially (both lists can be any length) — but the ordered *category* chain itself has no mechanism behind it.

## 19.8 Behaviour Resolution (§11)

"Single, internally consistent EBM" — real in the narrow sense that `compose()` always returns exactly one `composedPacks`/`compositionReport` pair; "internally consistent" doesn't mean much more than that, since nothing checks consistency *across* the composed Packs' own contributions beyond the 2 conflict types (Ch.4 §21.7). "Deterministic and repeatable" carries the identical caveat Ch.4 §21.3 FR-4.5 found: real only relative to the DB's current state at call time (`resolveActivePack` always resolves whichever Pack version is *currently* Active), not a pure function of the two input ids alone.

## 19.9 Behaviour Enforcement — the 4 named runtime services are real work, organized slightly differently than named (§12)

`Dependency Engine` is real and named exactly this way (`dependencyDefinitionEngine.ts`). The platform's own status dashboard (`dashboard.ts:37-43`) independently groups its real engines into "Governance Runtime" (Authority + Policy + **Obligation** + Quality Gate, `dashboard.ts:39`) and "Knowledge Runtime" (Evidence + Knowledge + Decision, `dashboard.ts:41`) — real, working groupings, but **Obligation is folded into Governance Runtime, not its own standalone "Obligation Runtime"** the way this chapter names it separately. Not a gap in the underlying engines (Obligation's own lifecycle is real, Ch.23) — just a naming/grouping mismatch between this chapter and how the platform's own status page currently describes itself.

## 19.10 Runtime Interaction — real, but indirect: the EBM is consulted as a Pack-scope pointer, never as a behavioural catalogue (§13)

This section's own preamble finding, restated per claim: "Participants consult the EBM" / "Runtime services enforce the EBM" — real in spirit (`governanceModel.ts`, `compliance.ts`, `dependencyDefinitionEngine.ts`, `traceability.ts`, `seus.ts` all call `ebmsDB.findById(seu.active_ebm_id)`), but what gets consulted is always `composed_packs` — the Pack list — never a decomposed behavioural rule. "Deliverables are validated against the EBM" / "Decisions are evaluated against the EBM" / "Obligations are assessed against the EBM" happen *indirectly* — against each in-scope Pack's own real Quality Gates/Policies/Obligation Definitions, reached via the EBM's own Pack-list pointer, not literally against "the EBM" as a unified object. "The EBM remains read-only" — real (19.3 FR-3.8).

## 19.11 Versioning — 2 of 6 named fields real (§14)

| Named field | Real? |
|---|---|
| Version identifier | ✅ `ebms.version` |
| Source Pack versions | ✅ `composed_packs[].packVersion` |
| Parent version | ❌ absent — no `parent_ebm_id`/equivalent column |
| Composition history | ❌ absent beyond the single `composition_report` for the current version |
| Change history | ❌ absent |
| Approval history | ❌ absent — no approval concept exists for EBM versioning at all |

"Historical versions shall remain reproducible" is unexercised the same way FR-3.3/3.10 are (19.3) — no version has ever gone beyond 1 in practice.

## 19.12 Events — 0 of 7 named events real (§15)

Confirmed via direct search, consistent with and extending Chapter 4 §21.13's own 0-of-11 finding (this chapter's list overlaps but isn't identical — `EBMCreated`/`EBMActivated` appear in both; `EBMValidated`, `EBMVersioned`, `EBMRetired`, `BehaviourConflictDetected`, `BehaviourConflictResolved` are this chapter's own additions). None exist. The real events nearest this chapter's own domain are `SEUCommissioned`/`SEUCommissionRejected` (`commissioning.ts`) — SEU-level, not EBM-named.

## 19.13 Non-Functional Requirements (§16)

| NFR | Verdict | Basis |
|---|---|---|
| deterministic | ⚠️ | 19.8 — real only relative to current DB state |
| reproducible | ⚠️ | Same caveat; also unexercised beyond version 1 (19.11) |
| immutable during execution | ✅ | 19.3 FR-3.8 |
| fully traceable | ⚠️ | Pack-level real, rule-level absent (19.3 FR-3.4) |
| support incremental evolution | ❌ | No incremental recomposition mechanism (Ch.4 §21.3 FR-4.6) |
| support concurrent versions | ⚠️ unexercised | Schema supports multiple `ebms` rows per `seu_id`; never exercised past 1 |
| remain independent of implementation technologies | ✅ | No technology coupling anywhere in `compositionEngine.ts`/`ebmsDB.ts` |

## 19.14 Acceptance Criteria (§17)

| Criterion | Verdict |
|---|---|
| Behaviour from multiple Packs is successfully composed | ⚠️ Packs are composed; behaviour *within* them is not (19's own preamble) |
| Behavioural conflicts are detected | ⚠️ 2 of the chapter's own named conflict types (Ch.4 §21.7) |
| Behavioural conflicts are resolved before commissioning | ✅ — blocked, not auto-resolved, but commissioning genuinely cannot proceed (19.3 FR-3.7) |
| The resulting EBM is versioned | ✅ real, ⚠️ unexercised (19.3 FR-3.3) |
| Runtime services correctly consume the EBM | ✅ — as a Pack-scope pointer (19.10), not as the chapter's own richer model |
| The EBM remains immutable during execution | ✅ (19.3 FR-3.8) |

## 19.15 Deliverables (§18)

| Named Deliverable | Real artifact | Verdict |
|---|---|---|
| EBM domain object | `EbmRow` (`seuTypes.ts:403-413`), `ebms` table | ✅ (thin — Pack list + report, not a decomposed model) |
| Behaviour catalogue | — | ❌ no catalogue of behavioural rules exists (19.5) |
| Behavioural rule model | — | ❌ (19.5) |
| Versioning model | `ebms.version` | ⚠️ 2 of 6 named fields (19.11) |
| Behaviour validation services | `compositionEngine.ts`'s 2 conflict checks | ⚠️ narrow (19's preamble, Ch.4 §21.7) |
| Behaviour query services | `ebmsDB.findById` | ⚠️ returns the Pack list only, no rule-level query capability |
| Behaviour composition interfaces | `compositionEngine.compose()` | ✅ (minimal) |
| Initial EBM API | `commissioning.ts`'s own internal call site | ⚠️ invoked internally; no standalone EBM inspection/recompose API |

## Summary — ranked

1. **[Architecture — the one genuinely new finding this audit adds beyond Chapter 4's own]** The EBM is real, working infrastructure that 5 independent real call sites genuinely consult at runtime — but only ever as a resolved Pack-scope pointer (`composed_packs`), never as the queryable behavioural-rule catalogue this chapter describes. Every "X evaluated against the EBM" claim in §13 is true only indirectly, through each in-scope Pack's own separately-materialized governance (19.10, 19's own preamble).
2. **[Data model]** No Behavioural Rule entity exists anywhere — 0 of the chapter's own 10 named fields (§8) are real, and this single fact is the root cause of FR-3.4/3.5's own partial/failed status, Behaviour Categories (§7) having no tagging mechanism, and Versioning's own missing Composition/Change/Approval history (19.5, 19.4, 19.11).
3. **[Governance, genuinely real and strong]** Conflict detection and blocking — real, unconditional, shared verbatim with Chapter 4's own strongest finding (19.3 FR-3.6/3.7).
4. **[Architecture]** Behavioural Inheritance's own named Platform→Organisation→...→Integration ordering has no mechanism behind it — composition is entirely category-blind, resolving only a Template's mandatory Packs then a Profile's optional ones (19.7).
5. **[Data model]** Versioning is real for exactly 2 of 6 named fields, and even those have never been exercised past version 1 in practice — no recomposition has ever actually happened (19.11, 19.3 FR-3.3/3.10).
6. **[Code]** 0 of 7 named events exist — consistent with, and extending, Chapter 4's own 0-of-11 finding (19.12).