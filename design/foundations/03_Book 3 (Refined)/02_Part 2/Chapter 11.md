
# Chapter 11 – Service

[Sudha:
This chapter fills the largest actual gap the Book 1 comparison turned up. Book 1 gives Service full peer status alongside Objective and Capability — its own narrative chapter, its own formal chapter, and a central role in the Capability Reasoning Network as one of four things Capabilities exchange with one another (Service, Evidence, Knowledge, Decision). Book 3 had nothing. Not a chapter, not an entity, not a line in the Canonical Information Model.

The placement question resolved itself once I looked at where Capability (Chapter 10) and Capability Packs (Chapter 5) already sit. Book 1 says it precisely: "a capability is an enduring ability; a service is what that ability actually delivers." A Capability Pack that declares a Capability without also declaring what that Capability contracts to deliver is only telling half the story. So Service is declared alongside Capability, by the same Pack, as the natural second half of a Capability's declaration — not a separate concern bolted on afterward.

I want to be careful about scope here, because it would be easy to let Service become too much. Two guardrails:

First, Service is not the sole coordination mechanism between Capabilities. Book 1's own Capability Reasoning Network chapter is explicit that Evidence, Knowledge and Decision propagate independently of Service, and warns directly against "treating every interaction as a service call." Service gets exactly one job here: it's the concrete, contracted unit that sharpens what the Dependency Engine's existing "Capability Dependency" type (Chapter 9) actually means — not "Architecture Capability is available" in the abstract, but "the Approved Solution Architecture service has been delivered," specifically.

Second, Service is not a metrics database. It declares a Service Level — a target, part of its own versioned definition — but the *observed* performance against that target is Engineering Telemetry's job (Chapter 35), derived from Service's own events, never written back onto the Service object itself. That keeps faith with Telemetry's own stated principles: passive, derived, no duplicate data entry. Service defines what's measurable about it; it doesn't measure itself.
]

---

# 1. Purpose

A **Service** is the declared, contracted output through which a Capability exposes what it delivers to other Capabilities, Participants or external consumers, without exposing how that delivery is performed.

Where a Capability is an enduring ability, a Service is what that ability actually produces on terms other Capabilities can depend upon.

Services are declared by Capability Packs. They are not declared by Participants, and they do not themselves select who fulfils them.

---

# 2. Scope

This chapter defines:

- Service abstraction;
- Service contract structure;
- Service Level declaration;
- Service lifecycle;
- Service composition;
- Service traceability.

This chapter does not define:

- Capability definitions (Chapter 10);
- Participant selection or dispatch (Chapter 12, Chapter 33);
- Engineering Telemetry computation (Chapter 35);
- Evidence, Knowledge or Decision exchange, which remain separate, independent coordination channels (Chapters 17, 16, 19).

---

# 3. Architectural Position

```
Capability Pack

↓

Capability  +  Service (declared together)

↓

Dependency Engine (Capability Dependency references a specific Service)

↓

Capability Fulfilment / Dispatch Engine (fulfil the Service)

↓

Engineering Telemetry (derives from Service events and declared Service Level)
```

A Service is what is contracted. Capability Fulfilment and the Dispatch Engine determine who delivers it. Engineering Telemetry determines how well it was delivered. Service performs none of these roles itself.

---

# 4. Definition

A Service is a declared, versioned contract specifying what a Capability delivers, consumable by other Capabilities, Participants or external interactions, without exposing internal implementation.

A Service declares a Service Level: the target turnaround, quality bar or other measurable expectation against which its delivery is assessed.

A Service does not select, assign or evaluate Participants. That remains the responsibility of Capability Fulfilment (Chapter 12) and the Dispatch Engine (Chapter 33).

A Service does not compute or store its own observed performance. That remains the responsibility of Engineering Telemetry (Chapter 35).

---

# 5. Architectural Principles

## SVC-001

Services are declared by Capability Packs, not by Participants.

---

## SVC-002

A Service exposes what a Capability delivers. It never exposes how.

---

## SVC-003

Service is one of four coequal coordination channels between Capabilities — Service, Evidence, Knowledge and Decision. Service shall not subsume the other three.

---

## SVC-004

Every Service shall declare a Service Level.

---

## SVC-005

Service definitions are versioned and immutable once published.

---

## SVC-006

Observed Service performance is derived by Engineering Telemetry. It shall never be written back onto the Service definition itself.

---

# 6. Functional Requirements

### FR-11.1

Every Service shall possess a globally unique identifier and version.

---

### FR-11.2

Every Service shall be declared by exactly one Capability, through a Capability Pack.

---

### FR-11.3

Every Service shall declare a Service Level.

---

### FR-11.4

The Dependency Engine shall reference specific Services, not Capabilities in the abstract, when evaluating a Capability Dependency.

---

### FR-11.5

Every Service shall publish lifecycle and delivery events consumable by Engineering Telemetry.

---

### FR-11.6

A Service shall support consumption by multiple Capabilities or external interactions concurrently.

---

### FR-11.7

Service contracts shall remain independent of Participant implementation.

---

# 7. Service Structure

Every Service shall define:

- Identifier
- Name
- Providing Capability
- Contract Description (what is delivered)
- Declared Service Level
- Consuming Capabilities (where known)
- Version
- Originating Pack

The internal contract/interface representation is implementation-defined.

---

# 8. Service Level

A Service Level is the measurable expectation a Service declares for its own delivery.

A Service Level may specify:

- target turnaround time;
- quality bar or acceptance criteria;
- availability expectation;
- applicable exceptions or waivers.

A Service Level is part of the Service's own versioned definition, contributed by the same Capability Pack that declares the Service.

A Service Level declares what "meeting expectations" means for this Service. It does not itself measure whether that expectation was met — see Engineering Telemetry, §11 below.

---

# 9. Service and the Dependency Engine

The Dependency Engine's Capability Dependency type (Chapter 9 §8) evaluates whether a required Capability is available.

Where a Deliverable depends on a Capability for a specific contracted output, the dependency shall reference the specific Service that Capability exposes, not the Capability in the abstract.

For example, a Deliverable does not depend on "the Architecture Capability." It depends on the **Approved Solution Architecture** Service that the Architecture Capability exposes.

This sharpens dependency evaluation from "is this Capability generally available" to "has this specific contracted output been delivered" — a precise, evaluable condition.

---

# 10. Service and Fulfilment

A Service does not determine who fulfils it.

Capability Fulfilment (Chapter 12) determines which Participants are eligible to provide the Capability that exposes a given Service.

The Dispatch Engine (Chapter 33) selects, from that eligible pool, which Participant delivers the Service for a specific Work Item.

Service remains the stable contract throughout; the Participant delivering it may change without altering the Service definition.

---

# 11. Service and Engineering Telemetry

Every Service publishes delivery events (§14) that Engineering Telemetry (Chapter 35) derives metrics from, alongside its other existing sources.

Engineering Telemetry compares observed delivery against a Service's declared Service Level to determine whether it was met or breached.

Service itself performs no measurement. It only declares the target and emits the events; Telemetry does the deriving, consistent with Telemetry's own passive, derived-only principles.

This applies most directly to Flow, Governance, Collaboration and Quality telemetry, since each of these is fundamentally a measurement of Service delivery. Knowledge Telemetry remains independent, consistent with Book 1's own treatment of Knowledge as a separate coordination channel from Service.

---

# 12. Service Composition

Multiple Organisation, Domain or Customer Packs may each contribute Services for the same Capability.

Example:

```
Platform Capability Pack (Architecture)

+

Organisation Capability Pack (Architecture)

+

Customer Capability Pack (Architecture)

↓

Effective set of Services exposed by the Architecture Capability
```

Composition shall be deterministic. Conflicting Service declarations for the same contracted output shall be resolved through the same composition rules the Composition Engine (Chapter 4) applies elsewhere.

---

# 13. Service Lifecycle

Every Service shall progress through the following lifecycle.

```
Defined

↓

Published

↓

Active

↓

Deprecated

↓

Retired

↓

Archived
```

Deprecation shall identify a replacement Service where one exists. Historical Service versions remain available for reconstructing past dependency evaluations.

---

# 14. Events

The Service subsystem shall publish:

- ServiceDefined
- ServicePublished
- ServiceActivated
- ServiceRequested
- ServiceDelivered
- ServiceLevelMet
- ServiceLevelBreached
- ServiceDeprecated
- ServiceRetired

---

# 15. Non-Functional Requirements

The Service Model shall:

- support composition from multiple Packs;
- preserve complete traceability from Service to providing Capability and originating Pack;
- support deterministic resolution of conflicting declarations;
- remain independent of Participant implementations;
- publish events sufficient for Engineering Telemetry without requiring duplicate instrumentation.

---

# 16. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Every Service is declared by exactly one Capability, through a Capability Pack.

✓ Every Service declares a Service Level.

✓ Capability Dependency evaluation references specific Services, not Capabilities in the abstract.

✓ Service definitions remain independent of Participant implementation.

✓ Observed Service performance is derived by Engineering Telemetry, never stored on the Service definition.

✓ Multiple Packs can contribute Services for the same Capability deterministically.

---

# 17. Deliverables

Implementation of this chapter shall produce:

- Service domain model.
- Service registry.
- Service contract validation service.
- Service Level declaration framework.
- Service composition service.
- Service APIs.
- Service events.

---

# 18. Implementation Status & Gaps

Code-verified audit (2026-08-24), not from memory — every claim below carries a file:line citation, cross-checked against a live query against the running Postgres instance (`aisworg` DB). Core files: `src/dblayer/servicesDB.ts`, `ServiceRow` (`src/dblayer/seuTypes.ts`), `src/domain/engine/dependencyDefinitionEngine.ts`, `src/domain/engine/materialiseDependencyGraph.ts`, `src/domain/engine/dispatchEngine.ts`, `src/routes/seu/core/packs.ts`. Live `services` schema at audit time — 10 columns: `id, providing_capability_id, name, contract_description, service_level, status, version, originating_pack_id, created_at, code`. **CR-064, raised the same day, closed the Pack-contribution side of this audit** — Service Level, real versioning, and Pack-scoped identity are now built (18.2/18.4/18.5/18.9 updated below); the chapter's own 6-state `status` lifecycle, Composition Engine involvement, Telemetry integration, and the 9 named Events remain exactly as this audit found them.

The single strongest finding: **the Dependency Engine's "Capability" dependency type is, internally, already Service-keyed** — `resolveNamedNode`'s `Capability` branch (`dependencyDefinitionEngine.ts:73-83`) matches its `name` against `services.code`, not a Capability's own code, and `dependency_definitions` rows for a Capability-type dependency are created one-per-Service by `materialiseDependencyGraph.ts`. The chapter's own central sharpening principle (§9 — "not 'the Architecture Capability' in the abstract... the Approved Solution Architecture Service") is functionally real under the hood, just not surfaced under the name the chapter gives it (see 18.6) — **CR-064 deliberately left this exactly as found**, owner: "I do not understand CR042's relevance" — this stays Dependency Graph authoring territory (Ch.9), not a `contributionServices[]` question.

## 18.1 Definition (§4)

Matches the live schema closely for what exists: a Service is declared/versioned (`version` column, though never incremented — 18.9), specifies what a Capability delivers (`contract_description`), and doesn't select Participants (no Participant FK anywhere on `services`). `providing_capability_id` is `NOT NULL` — a Service cannot exist without exactly one providing Capability, matching FR-11.2 exactly.

## 18.2 Architectural Principles (SVC-001–006) (§5)

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| SVC-001 | Declared by Capability Packs, not Participants | ✅ | Only write path is `servicesDB.upsertFromPack` (`packs.ts:590`), called from Pack publish only. |
| SVC-002 | Exposes what, never how | ✅ (trivially) | `contract_description` is a free-text description field; no implementation/interface columns exist to leak. |
| SVC-003 | Coequal channel with Evidence/Knowledge/Decision, not subsuming them | ✅ | No Service code path touches Evidence/Knowledge/Decision tables at all — fully independent. |
| SVC-004 | Every Service shall declare a Service Level | ✅ built via CR-064 | `contributionServices[]` now has a real, nested `serviceLevel[]` sub-list (`{label, target}` pairs, migration 114) — a Pack author can genuinely declare one. Not retroactively populated for any of the 124 real, live-declared Services (none had any before either). |
| SVC-005 | Versioned and immutable once published | ✅ built via CR-064 | `version` is now `TEXT` (`"1.0"`-style, bump-on-real-change, migration 112) and `servicesDB.upsertFromPack` is a real content-diffed, versioned upsert (deactivate-old + insert-new-row on change) — same shape as Quality Gate's own SVC-equivalent mechanism, not an in-place overwrite. |
| SVC-006 | Observed performance derived by Telemetry, never written back | ⚠️ (vacuously true) | Nothing writes performance back to `services` — but only because `telemetry.ts` has zero references to Service at all (18.8), not because a real boundary is being respected. |

## 18.3 Functional Requirements (FR-11.1–7) (§6)

| FR | Verdict | Note |
|---|---|---|
| FR-11.1 unique id and version | ✅ built via CR-064 | `id` real; `version` now real and live (18.9, SVC-005). |
| FR-11.2 declared by exactly one Capability, through a Pack | ✅ | `providing_capability_id NOT NULL`; `packs.ts:587-597` resolves `capabilityCode` only against this same Pack's own declared `contributionCapabilities[]` — cross-Pack Capability references rejected. |
| FR-11.3 declare a Service Level | ✅ built via CR-064 | Same as SVC-004. |
| FR-11.4 Dependency Engine references specific Services, not Capabilities in the abstract | ⚠️ real underneath, not author-facing | See 18.6 — internally Service-code-keyed, but a Template author only ever picks a Capability; the system silently expands to *every* Service that Capability exposes, not the one specific Service the chapter's own example names. **Deliberately not touched by CR-064** (owner: "I do not understand CR042's relevance" — Dependency Graph authoring territory, Ch.9, not this chapter's Pack-contribution question). |
| FR-11.5 publish lifecycle/delivery events | ❌ | Zero of the 9 named events (§14) published anywhere — confirmed, no `"Service` event-type string exists in `src/`. Not in CR-064's scope (execution-side, same split CR-063 made for Obligation's own events). |
| FR-11.6 support concurrent consumption by multiple Capabilities/external interactions | ⚠️ | Structurally unconstrained (no FK limiting consumers) — "Consuming Capabilities" (§7) confirmed dropped by CR-064, not a gap: owner, "we can get this information by querying" `dependency_definitions` directly rather than storing it redundantly (18.4). |
| FR-11.7 independent of Participant implementation | ✅ | No Participant coupling anywhere on `services`. |

## 18.4 Service Structure — all 8 chapter fields now real; Consuming Capabilities deliberately dropped (§7; CR-064)

| Chapter field | Real column? |
|---|---|
| Identifier | ✅ `id` |
| Name | ✅ `name` |
| Providing Capability | ✅ `providing_capability_id` |
| Contract Description | ✅ `contract_description` |
| Declared Service Level | ✅ built via CR-064 — real, nested `serviceLevel[]` (18.5) |
| Consuming Capabilities (where known) | 🚫 deliberately dropped by CR-064 — owner: "we can get this information by querying" `dependency_definitions`, not worth storing redundantly |
| Version | ✅ built via CR-064 — real, system-computed (18.9) |
| Originating Pack | ✅ `originating_pack_id` |

`code` (migration `004_service_code.sql`) is a real, additional identity field the chapter doesn't name. **CR-064 fixed its identity scope** — was globally unique (`services_code_key UNIQUE (code)`), the same class of latent collision Checklist/Policy each had before their own CRs; now `(originating_pack_id, code, version)` (migration 112), matching Checklist/Policy's own corrected treatment. **`code` also became Ontology-backed** (new concept type `service-name`, migration 113, freely-extensible — the `capability-name`/`feature-flag` pattern) — owner: "They have to come from the ontology layer... This service code turn-around-time-high can be declared in development pack and deployment pack with different service levels." Two different Packs deliberately sharing the same canonical code, each with their own content, is now the *intended* shape, not a collision risk.

## 18.5 Service Level — built via CR-064, real declaration and a real, already-existing consumer (§8)

`dispatchEngine.ts`'s `resolveTurnaroundSeconds` (`dispatchEngine.ts:31-38`) genuinely reads Service Level to set a Work Item's default target-completion deadline when no explicit override is given (`dispatchEngine.ts:105-110`) — a real, working consumer, not aspirational, that predates this CR. Before CR-064, the write side was never built to match: `contributionServices[]`'s authoring schema had no `serviceLevel` field at all, so every Pack-declared Service published with an empty Service Level regardless of intent, and `resolveTurnaroundSeconds` always returned `null` in practice — the exact same shape gap CR-058/061 each found and fixed for Quality Gate's/Policy's own real-but-starved fields. **Now real**: `contributionServices[]` carries a nested `serviceLevel[]` sub-list (`{label, target}` generic pairs, Checklist's own `"nested-list"` mechanism, CR-060) — owner's own worked example (`{offshore: 3 days}`, `{onsite: 1 day}`) used varying per-item keys a fixed-schema item can't hold directly, so `label`/`target` generalizes it, matching this section's own open "may specify" framing rather than four hardcoded fields. `resolveTurnaroundSeconds` was updated to match (searches for a `label` matching `/turnaround/i`) — still only recognises a bare number of seconds in `target`, not a human duration string like "3 days," so it stays `null` in practice for content shaped like the owner's own example until/unless a duration parser is added, a deliberately minimal starting point (same discipline Policy's own `condition` field used).

## 18.6 Service and the Dependency Engine — internally real, not author-facing (§9)

The chapter's own worked example (§9 — a Deliverable depends on "the Approved Solution Architecture Service," not "the Architecture Capability" in the abstract) is **functionally true under the hood**: `dependency_definitions` rows for a Capability-type dependency are keyed by `to_name`/`from_name` matching a real `services.code` (`dependencyDefinitionEngine.ts:73-83`'s `resolveNamedNode`, `Capability` branch — despite the type literally being named `"Capability"`, not `"Service"`, in `DependencyDefinitionEntityType`, `seuTypes.ts:481`). `materialiseDependencyGraph.ts:49-56` confirms this is deliberate, documented behaviour (CR-042): one authored `fromCapabilityCode` row expands into **one `dependency_definitions` row per Service that Capability currently exposes** — every one of that Capability's Services becomes a separate, individually-required prerequisite.

**What this means against the chapter's own example, precisely**: a Template/Pack author can only ever pick a *Capability* when authoring this kind of dependency (`fromCapabilityCode`, `templates.ts:259-260` validates it against the Pack's own declared Capabilities, never against a Service code directly) — there is no way to author "depends on *this one specific* Service" the way the chapter's example describes. The system silently turns "depends on the Architecture Capability" into an implicit AND across *every* Service Architecture exposes, not the single Approved Solution Architecture Service the chapter names. Real, and considerably better than a true Capability-in-the-abstract check — but not what §9 literally describes either.

## 18.7 Service and Fulfilment (§10)

Real and working as described: Capability Fulfilment/Dispatch (`dispatchEngine.ts`) select the Participant, never Service; Service stays the stable reference throughout (`servicesDB.findByCapabilityId`, read-only from Dispatch's side). Starved only by 18.5's Service Level gap, not by anything wrong in this section's own mechanism.

## 18.8 Service and Engineering Telemetry (§11)

❌ Entirely unbuilt — `src/routes/seu/core/telemetry.ts` has zero references to Service, `services`, or any of the §14 event names. Nothing compares observed delivery against a declared Service Level (moot regardless, since no Service Level is ever populated — 18.5) and no Flow/Governance/Collaboration/Quality telemetry derives from Service events, contrary to §11's own claim that these are "fundamentally a measurement of Service delivery."

## 18.9 Service Lifecycle (§13) — still schema-only; Versioning (SVC-005) — built via CR-064, on Quality Gate's own precedent, not the §13 state machine

Two genuinely different mechanisms, worth keeping apart. **Versioning is now real** (owner: "Versioning is definition side") — `servicesDB.upsertFromPack` (migration 112) is a real content-diffed, versioned upsert: `version` (`TEXT`, `"1.0"`-style) bumps on real content change, deactivating the prior row rather than overwriting it, a new immutable row per version, `(originating_pack_id, code, version)` the real identity. Same mechanism as Quality Gate's own versioning (`qualityGatesDB.upsert`'s `bumpVersion`) — not the chapter's own governed `transition_definitions` state machine, since Quality Gate/Review Gate don't use that mechanism for their own versioning either.

**The chapter's own 6-state `status` lifecycle (Defined→Published→Active→Deprecated→Retired→Archived) stays exactly as this audit originally found it — untouched, deliberately.** `services.status` still carries the same `CHECK` constraint (`002_seu_platform.sql:80-81`), zero `transition_definitions` rows exist for `entity_type='Service'`, and `"Service"` still isn't a member of `TransitionEntityType` (`seuTypes.ts:533-552`) — every live row still sits at `status='Active'`, never transitioned by anything. CR-064 confirmed this split explicitly: real definition-side versioning, yes; the governed lifecycle/event-emission machinery, not this CR's job (same "definition vs execution" split CR-063 made for Obligation's own events).

## 18.10 Service Composition (§12)

❌ Not built at all — `compositionEngine.ts` has zero references to Service. Unlike Policy/Quality Gate (same-code collision at least produces an "Override" warning, `compositionEngine.ts`'s `detectGovernanceConflicts`), a same-`code` Service collision across two different Packs produces no warning whatsoever — just a silent `ON CONFLICT (code) DO UPDATE` overwrite (18.4). §12's "Composition shall be deterministic... resolved through the same composition rules the Composition Engine applies elsewhere" doesn't hold — there's no composition-time involvement of any kind.

## 18.11 Events — 0 of 9 named events real (§14)

Confirmed via direct search: no `"ServiceDefined"`, `"ServicePublished"`, `"ServiceActivated"`, `"ServiceRequested"`, `"ServiceDelivered"`, `"ServiceLevelMet"`, `"ServiceLevelBreached"`, `"ServiceDeprecated"`, or `"ServiceRetired"` event-type string exists anywhere in `src/`. Consistent with 18.9 (no lifecycle mechanism to emit lifecycle events from) and 18.8 (nothing for Telemetry to consume even if they existed).

## 18.12 Non-Functional Requirements (§15)

| NFR | Verdict | Basis |
|---|---|---|
| support composition from multiple Packs | ❌ | 18.10 — no composition-time handling at all, plus a latent same-code global-collision risk |
| preserve complete traceability from Service to Capability and Pack | ✅ | `providing_capability_id`/`originating_pack_id` both real FKs; `traceability.ts:169-171` resolves and displays this chain |
| support deterministic resolution of conflicting declarations | ❌ | 18.10 |
| remain independent of Participant implementations | ✅ | 18.2 SVC-002/FR-11.7 |
| publish events sufficient for Telemetry without duplicate instrumentation | ❌ | 18.8/18.11 — zero events, zero Telemetry consumption |

## 18.13 Acceptance Criteria (§16)

| Criterion | Verdict |
|---|---|
| Every Service declared by exactly one Capability, through a Pack | ✅ (18.2/18.3) |
| Every Service declares a Service Level | ✅ built via CR-064 (18.5) |
| Capability Dependency evaluation references specific Services, not Capabilities in the abstract | ⚠️ real internally, not author-facing — deliberately untouched by CR-064 (18.6) |
| Service definitions remain independent of Participant implementation | ✅ |
| Observed Service performance derived by Telemetry, never stored on the Service definition | ⚠️ vacuously true (18.2/18.8) |
| Multiple Packs can contribute Services for the same Capability deterministically | ❌ still (18.10) — CR-064 fixed identity/versioning, not Composition Engine involvement |

## 18.14 Deliverables (§17)

| Named Deliverable | Real artifact | Verdict |
|---|---|---|
| Service domain model | `ServiceRow` (`seuTypes.ts`), `services` table | ✅ |
| Service registry | `servicesDB.ts` | ✅ (minimal — no search/filter beyond by-capability/by-id/all) |
| Service contract validation service | `packs.ts`'s Service loop (`capabilityCode` resolution only) | ⚠️ resolves the providing Capability; validates nothing else (no required-field checks, no Service Level structural validation) |
| Service Level declaration framework | `service_level` JSONB column, `contributionServices[].serviceLevel[]` | ✅ built via CR-064 (18.5) |
| Service composition service | — | ❌ (18.10) |
| Service APIs | `src/routes/seu/api/*` (findAll/findByCapabilityId reachable) | ⚠️ read-only; no lifecycle-transition or Service Level API |
| Service events | — | ❌ (18.11) |

## Summary — ranked

1. **[Dependency Engine — the chapter's own central claim, more nuanced than pass/fail — deliberately untouched]** §9's "reference the specific Service, not the Capability in the abstract" is genuinely real at the data-model level (`dependency_definitions` rows are Service-code-keyed) but not at the authoring surface (a Template/Pack author can only pick a Capability, which silently expands to *every* Service that Capability exposes) — a real, working, but different mechanism than the chapter's own literal example. Raised as an open question in CR-064's own gap write-up; owner didn't see its relevance to `contributionServices[]`'s own redesign ("I do not understand CR042's relevance"), so it stays exactly as found — Ch.9/Dependency Graph authoring territory, not this CR's job (18.6).
2. **[Data model — resolved by CR-064, split into two different mechanisms]** `services` already carried real `status`/`version` columns matching the chapter's exact 6-state lifecycle and SVC-005's versioning requirement, with zero governance wired to either. CR-064 built real *versioning* (Quality Gate's own bump-on-change precedent) but deliberately left the 6-state `status` lifecycle alone — the two turned out to be separable, and only one was actually asked for (18.9).
3. **[Code — closed by CR-064]** Service Level (SVC-004/FR-11.3) had a genuinely real, working *consumer* (`dispatchEngine.ts`'s SLA-driven Work Item deadline) permanently starved by a missing field on the *authoring* schema — the same shape CR-058/061 each found and fixed for Quality Gate/Policy. Now real: a nested `serviceLevel[]` sub-list, `{label, target}` pairs (18.5).
4. **[Code — still open]** Zero Telemetry integration (§11) and zero of the 9 named events (§14) — both entirely unbuilt, and mutually reinforcing (no events to derive Telemetry from either way). Not CR-064's scope — execution-side, same split CR-063 made for Obligation's own events (18.8, 18.11).
5. **[Code — still open]** Zero Composition Engine involvement (§12) — worse than Policy/Quality Gate's own same-code collision handling (an Override warning); CR-064 fixed the *identity* half of this (Pack-scoped, no more silent cross-Pack overwrite), but real composition/conflict-detection logic itself stays unbuilt, same "revisit alongside the Composition Engine" deferral CR-061 gave Policy (18.10, 18.4).
6. **[Data model — resolved by CR-064, dropped rather than built]** "Consuming Capabilities" (§7) isn't tracked in any form — no column, no join table. Confirmed a deliberate non-gap, not a remaining one: owner, "we can get this information by querying" `dependency_definitions` directly (18.4).
