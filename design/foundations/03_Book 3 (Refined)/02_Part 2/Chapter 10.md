# Chapter 10 – Capability Model


[Sudha: this chapter captures one of the most significant departures from traditional software engineering platforms.

While writing it, I realised we've arrived at what I believe is one of the platform's defining architectural separations:

|Concept|Responsibility|
|---|---|
|**Engineering Behavior Model (EBM)**|Defines **how** engineering should be performed.|
|**Capability**|Defines **what engineering competency** is required.|
|**Participant**|Provides the competency.|
|**Work Item**|Applies the competency to advance a Deliverable.|

These four concepts are orthogonal. They should never be collapsed into one another.

For example, a **Developer Participant** doesn't "own" the Development Capability. It merely fulfils it for a period of time. Tomorrow, another AI model, a human engineer, or an external autonomous service could fulfil exactly the same Capability without changing the SEU.

I think that's a stronger and more durable abstraction than today's agent frameworks, which often equate an "agent" with a fixed role and a fixed set of skills. Here, **Capabilities are permanent, Participants are transient**, and the platform composes them dynamically to satisfy engineering objectives. That separation will make the platform significantly more adaptable over time.
]

---

# 1. Purpose

Capabilities represent the engineering competencies required to deliver software within a Software Engineering Unit (SEU).

A Capability defines **what engineering function must be performed**, independent of who or what performs it.

Capabilities are fulfilled by Participants, which may be AI systems, humans or external services.

The Capability Model separates engineering competence from engineering execution, enabling the platform to evolve independently of participant implementations.

---

# 2. Scope

This chapter defines:

- Capability abstraction;
- Capability lifecycle;
- Capability fulfilment;
- Capability relationships;
- Capability discovery;
- Capability composition.

This chapter does not define:

- Participant implementations;
- engineering behaviour;
- work item execution;
- AI reasoning.

---

# 3. Architectural Position

```
Deliverable

↓

Dependency Engine

↓

Required Capabilities

↓

Capability Fulfilment

↓

Participants

↓

Work Item Execution
```

The Capability Model determines **what competencies are required**.

Participants determine **who provides those competencies**.

---

# 4. Definition

A Capability is a reusable engineering competency that may be requested by the platform to achieve one or more Deliverables.

Capabilities are platform concepts.

They are independent of:

- Participants;
- Organisations;
- Technologies;
- AI providers.

---

# 5. Architectural Principles

## CM-001

Capabilities are stable.

---

## CM-002

Participants are replaceable.

---

## CM-003

Multiple Participants may fulfil the same Capability.

---

## CM-004

One Participant may fulfil multiple Capabilities.

---

## CM-005

Capabilities shall not contain runtime state.

---

## CM-006

Capabilities shall remain independent of engineering behaviour.

Behaviour is supplied by the Engineering Behavior Model.

---

# 6. Functional Requirements

### FR-10.1

The platform shall maintain a Capability Catalogue.

---

### FR-10.2

Every Work Item shall require one or more Capabilities.

---

### FR-10.3

Every Capability shall possess a globally unique identifier.

---

### FR-10.4

Capabilities shall support versioning.

---

### FR-10.5

Capabilities shall be independently extensible.

---

### FR-10.6

Capabilities shall support fulfilment by multiple Participant types.

---

### FR-10.7

Capability fulfilment shall remain traceable.

---

# 7. Capability Categories

Illustrative categories include:

## Requirements Engineering

- Requirements Elicitation
- Requirements Analysis
- Requirements Validation

---

## Architecture

- Solution Architecture
- Integration Architecture
- Data Architecture
- Security Architecture

---

## Development

- Code Generation
- Refactoring
- Debugging
- Code Review

---

## Testing

- Test Design
- Test Automation
- Performance Testing
- Security Testing

---

## Documentation

- Technical Documentation
- User Documentation
- API Documentation

---

## Deployment

- Release Engineering
- Environment Configuration
- Deployment Automation

---

## Knowledge

- Knowledge Acquisition
- Ontology Management
- Traceability Analysis

---

## Governance

- Architecture Review
- Compliance Assessment
- Decision Validation

Additional capabilities may be introduced through Packs.

---

# 8. Capability Structure

Every Capability shall define:

- Identifier
- Name
- Description
- Category
- Inputs
- Outputs
- Required Knowledge
- Expected Deliverables
- Success Criteria
- Supported Participant Types

The implementation of a Capability is deliberately outside the scope of this chapter.

---

# 9. Capability Relationships

Capabilities may:

- depend upon other Capabilities;
- specialise existing Capabilities;
- compose multiple Capabilities;
- extend Capabilities introduced through Packs.

Capability relationships shall not create circular dependencies.

---

# 10. Capability Fulfilment

Capability fulfilment is the process of assigning one or more Participants to provide a required Capability.

Fulfilment may occur through:

- AI Participants;
- Human Participants;
- External Services;
- Hybrid teams.

The platform shall permit fulfilment strategies to evolve without changing the Capability Model.

---

# 11. Capability Discovery

The platform shall support discovery of Capabilities by:

- identifier;
- category;
- engineering objective;
- Deliverable;
- Pack contribution;
- supported Participant type.

Discovery mechanisms are implementation-defined.

---

# 12. Capability Selection

When a Deliverable becomes Ready, the platform shall:

1. identify the required Capabilities;
2. determine fulfilment requirements;
3. invoke the Capability Fulfilment service;
4. assign appropriate Participants;
5. authorise execution.

Capability selection shall remain independent of the Engineering Behavior Model.

The Engineering Behavior Model governs **how** a Capability behaves once it has been selected.

---

# 13. Capability Evolution

Capabilities may evolve through:

- new versions;
- Pack contributions;
- specialisations;
- deprecation;
- resolution of an Organisational Learning Obligation (Chapter 23 §7), raised by Engineering Telemetry (Chapter 35 §11) upon detecting a sustained pattern indicating this Capability should be improved.

The last of these is what makes Continuous Organisational Learning an active process rather than passive measurement: accumulated telemetry does not merely describe a Capability's performance, it can obligate a revision to it.

Evolution shall preserve backward compatibility wherever practical.

---

# 14. Events

The Capability subsystem shall publish:

- CapabilityRegistered
- CapabilityUpdated
- CapabilityDeprecated
- CapabilityRequested
- CapabilityFulfilled
- CapabilityUnavailable
- CapabilityReleased

---

# 15. Non-Functional Requirements

The Capability Model shall:

- remain independent of Participant implementation;
- support concurrent fulfilment;
- support multiple fulfilment strategies;
- remain fully traceable;
- support extension through Packs.

---

# 16. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ A Capability Catalogue exists.

✓ Multiple Participants can fulfil the same Capability.

✓ A Participant can fulfil multiple Capabilities.

✓ Capability fulfilment is traceable.

✓ New Capabilities can be introduced through Packs.

✓ Capability evolution does not require Runtime Kernel modification.

---

# 17. Deliverables

Implementation of this chapter shall produce:

- Capability domain model.
- Capability catalogue.
- Capability registry.
- Capability discovery service.
- Capability fulfilment interfaces.
- Capability APIs.
- Capability events.

---

# 18. Implementation Status & Gaps

Code-verified audit (2026-08-24), not from memory — every claim below carries a file:line citation, cross-checked against a live query against the running Postgres instance (`aisworg` DB). Core files: `src/dblayer/capabilitiesDB.ts`, `CapabilityRow` (`src/dblayer/seuTypes.ts`), `src/routes/seu/core/capabilities.ts`, `src/routes/seu/core/packs.ts`, `src/domain/engine/dependencyDefinitionEngine.ts`, `src/dblayer/objectivesDB.ts`. Live `capabilities` schema at audit time — 8 columns: `id, code, name, description, category, originating_pack_id, version, created_at`. **CR-065, raised and built the same day, closed the Pack-contribution side of this audit** — `code`'s Pack-scoped identity and `version` now real (copied from the owning Pack) are built (18.2/18.3/18.4/18.9 updated below); Category and all 6 other previously-considered Structure fields were dropped rather than built; Capability Relationships' partial semantics split out as CR-066.

**Revised same day, owner correction.** The single strongest finding, confirmed exactly as the owner framed it going in — but the first pass below (still visible in the per-section detail) understated how much of it is real, deliberate design rather than a gap: **Capability genuinely has no lifecycle or identity mechanism of its own — both are deliberately borrowed from whichever Pack owns it, and the borrowing is real, not merely absent.** No `status` column exists on `capabilities` (unlike Service, which at least had an unused `CHECK` constraint before CR-064) — but Pack already has a complete, real, named lifecycle-event taxonomy (`PackRegistered/Validated/Published/Activated/Deprecated/Retired/Archived`, `packs.ts:761-768`, all genuinely published), and owner: "events will be tracked as pack events except for Capability Fulfiled" — confirming this is the intended architecture, not a gap (18.10). Likewise `capabilities.version` — was a real but vestigial column, never incremented — is now built as a denormalized copy of `packs.pack_version`, kept in sync on every upsert (owner: "capabilities.version just copies over the pack's version," 18.3/18.9): not independent versioning, `packs.pack_version` remains the real, working, immutable-once-published identity. **`capabilities.code`'s bare global uniqueness is also now built** (18.4) — Pack-scoped, same mechanical fix Checklist/Policy/Service already got. What's left, unchanged from the first pass: Capability Relationships' still-partial semantics (18.5 — real mechanism exists via Pack dependencies + Composition, but circular-dependency detection and 3 of 4 dependency types' own semantics remain unbuilt, split out as **CR-066**).

## 18.1 Definition (§4)

Matches the live schema for what exists: a Capability is independent of Participants (no Participant FK on `capabilities` at all) and is a platform/Pack concept, not organisation- or technology-specific (no such coupling exists). `originating_pack_id` (nullable — 4 real rows have none, seeded directly by early migrations rather than through a Pack) ties most Capabilities to their declaring Pack.

## 18.2 Architectural Principles (CM-001–006) (§5)

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| CM-001 | Capabilities are stable | ✅ | Owner correction: "overwrite is allowed only during a draft state, not otherwise." Confirmed — `sdkAuthoring.ts:728`'s `canEdit = canDefine && isDraft` gates the *only* real path back into `capabilitiesDB.upsertFromPack` to a Pack still in Draft status; once Published/Active, the authoring form renders view-only (confirmed live against a real Published Pack, Ch.5 §19.4/CR-064's own smoke-test). Worth noting as a secondary point, not a gap: `createPackDraft`'s own re-seed branch (`packs.ts:484-487`) has no independent Draft-only check of its own — stability holds because of the UI-layer gate, not defense-in-depth at the core-function level. |
| CM-002 | Participants are replaceable | ✅ | `capability_fulfilments`/`participants` carry no permanence — a new `fulfilCapability` call creates a fresh Participant each time, no 1:1 binding. |
| CM-003 | Multiple Participants may fulfil the same Capability | ✅ (structurally) | No uniqueness constraint prevents it; `seu_capabilities` is `(seu_id, capability_id)`-scoped, not Participant-scoped. |
| CM-004 | One Participant may fulfil multiple Capabilities | ✅ (structurally) | `capability_fulfilments.participant_id` carries no uniqueness constraint either. |
| CM-005 | Capabilities shall not contain runtime state | ✅ | `capabilities` carries no status/state column of any kind (see the chapter-level finding above) — trivially true, though for the wrong reason (no lifecycle at all, not a deliberate stateless-by-design split). |
| CM-006 | Capabilities remain independent of engineering behaviour (EBM supplies it) | ✅ | No EBM coupling on `capabilities`; confirmed separate per Ch.8/Ch.9's own EBM/Dependency Engine boundary. |

## 18.3 Functional Requirements (FR-10.1–7) (§6)

| FR | Verdict | Note |
|---|---|---|
| FR-10.1 platform maintains a Capability Catalogue | ✅ | `capabilitiesDB.findAll` (`capabilitiesDB.ts:63-71`); a real, if minimal, registry. |
| FR-10.2 every Work Item requires one or more Capabilities | ✅ | `work_items` ties to a `seu_capabilities` row throughout Dispatch (`dispatchEngine.ts`). |
| FR-10.3 globally unique identifier | ✅ built via CR-065 | `id` real; `code` now Pack-scoped (`(originating_pack_id, code)`, migration 115) rather than globally unique — see 18.4. |
| FR-10.4 support versioning | ✅ (via the owning Pack) | Owner: "Pack versioning is already in place... capabilities.version just copies over the pack's version." `packs.pack_version` is the real, working, immutable-once-published version identity; `capabilities.version` (built via CR-065) is now a denormalized `TEXT` copy of it, kept in sync on every upsert — not independent versioning, but no longer an inert `INTEGER` stuck at 1 either. Capability's own content changes only ever happen through a new Pack version (gated to Draft, CM-001). |
| FR-10.5 independently extensible | ✅ built via CR-065 | New Capabilities can be added via any Pack; `code`'s Pack-scoped identity (18.4) means two Packs can now each extend the catalogue with their own same-named Capability without colliding. |
| FR-10.6 support fulfilment by multiple Participant types | ✅ | `participants.type CHECK IN ('AI','Human','External')`, no restriction tying a type to a specific Capability. |
| FR-10.7 fulfilment remains traceable | ✅ | `capability_fulfilments` row + `CapabilityFulfilled` event (18.11) together trace who fulfilled what, when. |

## 18.4 Capability Structure — ✅ built via CR-065, settles at 3 of 10 chapter fields; the other 7 (including Category) dropped by design, not built (§8; CR-065)

| Chapter field | Verdict |
|---|---|
| Identifier | ✅ `id` |
| Name | ✅ `name` |
| Description | ✅ `description` |
| Category | 🚫 dropped by design (CR-065) — owner: "Field category can be dropped. code already carries the required intelligence." |
| Supported Participant Types | 🚫 dropped by design (CR-065) — owner: "particpants are AI and humans always. it's already modeled — at a finer grain than Capability... [§20's] three classifications (Machine-verifiable / Judgment / Human-attested)" — already real, on each verifiable item's own `classification` field, a finer grain than Capability. |
| Success Criteria | 🚫 dropped by design (CR-065) — owner: "Policy is the what, Quality Gate is the where/when it gets checked. That pairing is what 'Success Criteria' was trying to name as a single Capability-level field" — already fully expressed by the existing, working Policy + Quality Gate pairing. |
| Inputs | 🚫 dropped by design (CR-065) — owner: "These are determined at template authoring and not at capability authoring." |
| Outputs | 🚫 dropped by design (CR-065) — same reasoning as Inputs. |
| Required Knowledge | 🚫 dropped by design (CR-065) — same reasoning as Inputs. |
| Expected Deliverables | 🚫 dropped by design (CR-065) — same reasoning as Inputs. |

`contributionCapabilities[]`'s authoring schema (migration `116_capability_schema.sql`) is now `code`, `name`, `description` only — `category` dropped entirely, no replacement, confirmed live (rendered SDK authoring form shows just the three fields).

**`code`'s identity is now Pack-scoped** (`capabilities_pack_code_key UNIQUE (originating_pack_id, code)`, migration 115) — was globally unique (`capabilities_code_key`), the same class of latent collision Checklist/Policy/Service each had before their own CRs, with a materially larger blast radius here: `capability_id` is a foreign key from 8 downstream tables (`badge_grants`, `deliverables`, `evidence`, `execution_targets`, `objective_capabilities`, `services`, `seu_capabilities`, `template_capabilities`). Owner: "This is already implemented in pack model. so what is the question?" — correctly identified this as the same mechanical fix already proven three times over, not a novel decision: every one of those FKs references the stable `id`, never `code` directly, so scoping the uniqueness constraint touches nothing else. No live collision existed before the fix either (30 rows, 30 distinct codes).

## 18.5 Capability Relationships — real mechanism via Pack dependencies + Composition, partially implemented; fix split out as CR-066 (§9)

**Owner correction — wrong place to look.** `dependency_definitions`'s `"Capability"` entity type (checked in the first pass below) is a different mechanism entirely — Deliverable-depends-on-Service (Ch.11 §18.6), not Capability-depends-on-Capability. Owner: "Capability Relationships - this is already in terms of dependent packs within the pack. And existing packs are also extended by tenants through composition." The real mechanism is Pack-level: a Pack's own `dependencies[]` (`packCode`, `version`, `type: required/optional/conditional/incompatible`, migration `040_pack_structured_contributions.sql:30-36`) — since a Capability's identity is entirely borrowed from its owning Pack (18.2 CM-001), one Capability "depending on" another is expressed as its Pack depending on the other Capability's Pack. "Extend" maps onto the Composition Engine (`compositionEngine.ts`) — multiple Organisation/Domain/Customer Packs composing into the same SEU/EBM, Override semantics on same-code collisions (the same mechanism CR-058/061 already documented for Quality Gate/Policy).

**Confirmed genuinely partial, matching the owner's own assessment**: "We have still not implemented what each of the composition means, there is no check for circular dependencies yet." Checked directly — `validatePackSeed` (`packs.ts:440-443`) only branches on `dep.type === "required"` (must resolve to a real Active Pack); `optional`/`conditional`/`incompatible` are validated for shape only, with zero differentiated behaviour anywhere (`conditional` has no condition-evaluation logic; `incompatible` doesn't block co-installation of anything). `compositionEngine.ts` has zero references to circular-dependency detection — §9's own explicit "Capability relationships shall not create circular dependencies" isn't checked at all. "Specialise"/"compose" as relationship kinds distinct from plain "depend"/"extend" still have no clean mapping onto anything real.

## 18.6 Capability Fulfilment — real and working (§10)

Matches the chapter closely: `fulfilCapability` (`capabilities.ts:18-80`) creates a Participant, records a `capability_fulfilments` row, marks the `seu_capabilities` row Fulfilled, and pushes dependency-graph evaluation for every Service the Capability provides. Supports AI/Human/External Participant types (`participants.type`); no "Hybrid teams" concept exists as its own type, but nothing prevents composing that at the Participant-display layer. Fulfilment strategy evolution independent of the Capability Model itself holds — `fulfilCapability`'s own strategy field (`fulfilmentStrategy`) is freely extensible, no schema coupling back to `capabilities`.

## 18.7 Capability Discovery — 2 of 6 axes real (§11)

| Discovery axis | Real? |
|---|---|
| by identifier | ✅ `capabilitiesDB.findById` |
| by category | ❌ `category` is a real column but no dedicated query method exists — only reachable via `findAll` + client-side filter |
| by engineering objective | ✅ `objectivesDB.getRequiredCapabilities` (`objectivesDB.ts:259-269`) — a real, working join through `objective_capabilities`, genuinely not aspirational |
| by Deliverable | ❌ only indirectly, via `dependency_definitions` (Ch.11 §18.6's own Service-keyed mechanism) — no direct "Capabilities required by this Deliverable" query |
| by Pack contribution | ✅ `capabilitiesDB.findByOriginatingPackIds` (`capabilitiesDB.ts:53-61`) |
| by supported Participant type | ❌ no such field exists on `capabilities` at all (18.4) |

## 18.8 Capability Selection (§12)

Real, matches the chapter's own 5-step sequence closely enough: Dependency Engine identifies required Capabilities (Ch.9), `seu_capabilities` rows record the requirement, `fulfilCapability` is the Fulfilment invocation, Participant assignment and execution authorisation follow. Selection stays independent of the EBM — confirmed, no EBM coupling anywhere in this path (matches CM-006).

## 18.9 Capability Evolution — versioning ✅ built via CR-065; the Obligation-driven loop stays the same half-real shape Ch.23 already found, deferred (§13)

**New versions**: ✅ via the owning Pack — `packs.pack_version` is real and immutable-once-published; `capabilities.version` (built via CR-065) is a denormalized copy, kept in sync on every upsert (18.3 FR-10.4). **Pack contributions**: ✅ — any Pack can add a new Capability, real. **Specialisations**: ❌ — no mechanism, split out as CR-066 (18.5). **Deprecation**: ✅ via `PackDeprecated` (18.10) — no Capability-specific status column, by design, same as the rest of this section. **Resolution of an Organisational Learning Obligation raising a Capability revision**: ⚠️ half-real, identical shape to Ch.23 §19.9's own finding — Telemetry → Organisational Learning Obligation is genuinely real (Ch.23 FR-23.8), but nothing anywhere (`compositionEngine.ts` has zero Capability-evolution references) ever turns a *resolved* Obligation into an actual new Pack/Capability version. Owner: "Obligation to Capability is open and to be addressed later" — acknowledged, real, explicitly deferred, not CR-065's job. "Backward compatibility wherever practical" has no real enforcement either way (no compatibility-checking mechanism between Pack versions).

## 18.10 Events — not a gap; deliberately Pack events except the one genuinely Capability-specific fact (§14)

**Owner correction**: "I already said events will be tracked as pack events except for Capability Fulfiled." Confirmed for real: Pack already publishes a complete, named lifecycle-event set — `PackRegistered` (`packs.ts:493-500`), and `PackValidated/PackPublished/PackActivated/PackDeprecated/PackRetired/PackArchived` (`EVENT_BY_TARGET_STATE`, `packs.ts:761-768`, wired to every real governed Pack transition) — all genuinely published, not aspirational. Since a Capability's own definition-lifecycle *is* its owning Pack's lifecycle (18.2 CM-001, 18.3 FR-10.4), `CapabilityRegistered`/`Updated`/`Deprecated` don't need separate event types — `PackRegistered`/`PackPublished` or `PackActivated`/`PackDeprecated` already cover exactly that, by design. `CapabilityFulfilled` (`capabilities.ts:70-77`) is the one event that's genuinely Capability-specific — a real runtime fact (this Capability got fulfilled, for this SEU, by this Participant) that no Pack-level event could express — and it's the one that's real. `CapabilityRequested`/`CapabilityUnavailable`/`CapabilityReleased` are the remaining, genuinely-not-yet-built runtime-side events (matching Fulfilment's own real mechanism, 18.6) — not addressed by the Pack-events reframing, since they're about a specific SEU's runtime fulfilment state, not the Capability's own definition.

## 18.11 Non-Functional Requirements (§15)

| NFR | Verdict | Basis |
|---|---|---|
| remain independent of Participant implementation | ✅ | 18.2 CM-002/CM-006 |
| support concurrent fulfilment | ✅ | 18.2 CM-003/CM-004 |
| support multiple fulfilment strategies | ✅ | 18.6 |
| remain fully traceable | ✅ | 18.3 FR-10.7 |
| support extension through Packs | ✅ built via CR-065 | Real for *adding* new Capabilities; `code`'s Pack-scoped identity (18.4) means two Packs can now each extend the catalogue with their own same-named Capability without colliding. |

## 18.12 Acceptance Criteria (§16)

| Criterion | Verdict |
|---|---|
| A Capability Catalogue exists | ✅ (18.3) |
| Multiple Participants can fulfil the same Capability | ✅ (18.2) |
| A Participant can fulfil multiple Capabilities | ✅ (18.2) |
| Capability fulfilment is traceable | ✅ (18.3/18.6) |
| New Capabilities can be introduced through Packs | ✅ (18.9) |
| Capability evolution does not require Runtime Kernel modification | ✅ — new Pack versions require no Kernel change; the still-unbuilt Obligation→revision automation (18.9) is a separate question from this criterion |

## 18.13 Deliverables (§17)

| Named Deliverable | Real artifact | Verdict |
|---|---|---|
| Capability domain model | `CapabilityRow` (`seuTypes.ts`), `capabilities` table | ✅ |
| Capability catalogue | `capabilitiesDB.findAll` | ✅ (minimal) |
| Capability registry | `capabilitiesDB.upsertFromPack`, real lifecycle/versioning via the owning Pack | ✅ (18.9) |
| Capability discovery service | `capabilitiesDB`/`objectivesDB` query methods | ⚠️ 2 of 6 axes (18.7) |
| Capability fulfilment interfaces | `capabilities.ts`'s `fulfilCapability` | ✅ (18.6) |
| Capability APIs | `src/routes/seu/api/*` (findAll/fulfil reachable) | ⚠️ read + fulfil only; update/deprecate correctly live at the Pack API instead (18.10) |
| Capability events | `CapabilityFulfilled` + the full real Pack lifecycle-event set | ✅ (18.10) |

## Summary — ranked

1. **[Data model — the chapter's own central departure, confirmed as deliberate design, not a gap]** Capability genuinely has no lifecycle or identity mechanism of its own — but the borrowing from its owning Pack is real: Pack already has a complete, real, named lifecycle-event taxonomy Capability rides on (18.10), and `packs.pack_version` is Capability's real versioning mechanism, now literally copied onto `capabilities.version` (18.3/18.9, ✅ built via CR-065). Confirmed live: `canEdit`'s Draft-only gate (18.2 CM-001) is the real reason Capability content is stable, not mere absence of a write path.
2. **[Data model — ✅ built via CR-065]** `capabilities.code`'s bare global uniqueness was the same class of latent cross-Pack collision Checklist/Policy/Service each had before their own CRs — the largest blast radius of any of them (8 downstream FK tables). Now Pack-scoped (`(originating_pack_id, code)`), the same mechanical treatment already proven three times over — owner confirmed no FK references `code` directly, so nothing else needed deciding (18.4/18.3).
3. **[Data model — ✅ resolved by dropping the field, not fixing it]** Category was first thought to need validation against `category:pack` (§7's own list being explicitly illustrative, not canonical); owner's follow-up went further — dropped entirely, `code` alone judged sufficient. Built via CR-065 (18.4).
4. **[Code — real mechanism, still genuinely partial, split out as CR-066]** Capability Relationships (§9) map onto Pack-level `dependencies[]` + Composition Engine composition, not the Dependency Engine's Capability-typed entity (a different mechanism entirely, Ch.11's own territory). Confirmed partial exactly as the owner assessed: only `required` has real semantics (3 of 4 dependency types don't), and zero circular-dependency detection exists despite §9's own explicit requirement. Shared, platform-wide infrastructure, not Capability-specific — filed as its own CR (18.5).
5. **[Code, surprising positive]** Discovery-by-objective is genuinely real (`objectivesDB.getRequiredCapabilities`), not aspirational — the strongest-built §11 axis, alongside discovery-by-Pack (18.7).
6. **[Code, surprising positive]** Capability Fulfilment (§10) and Selection (§12) are both real and match the chapter closely — the strongest-built areas of this chapter overall (18.6, 18.8).