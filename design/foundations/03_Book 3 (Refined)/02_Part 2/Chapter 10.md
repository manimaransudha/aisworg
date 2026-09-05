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

## My notes

Business Analysis Planning and
Monitoring, Elicitation and Collaboration, Requirements Life Cycle Management,
Strategy Analysis, Requirements Analysis and Design Definition (RADD),
Solution Evaluation

Business Analysis Planning and Monitoring: describes the tasks that
business analysts perform to organize and coordinate the efforts of
business analysts and stakeholders. 

Elicitation and Collaboration: describes the tasks that business analysts
perform to prepare for and conduct elicitation activities and confirm the
results obtained. It also describes the communication with stakeholders
once the business analysis information is assembled and the ongoing
collaboration with them throughout the business analysis activities.

Requirements Life Cycle Management: describes the tasks that business
analysts perform in order to manage and maintain requirements and design
information from inception to retirement. These tasks describe establishing
meaningful relationships between related requirements and designs, and
assessing, analyzing and gaining consensus on proposed changes to
requirements and designs.

Strategy Analysis: describes the business analysis work that must be
performed to collaborate with stakeholders in order to identify a need of
strategic or tactical importance (the business need), enable the enterprise to


('capability-name', 'Discovering business requirements', 'Discovering business requirements', '','11111111-1111-1111-1111-111111111111'),

('capability-name', 'Understanding business domains', 'Understanding business domains', '','11111111-1111-1111-1111-111111111111'),

('capability-name', 'Validating engineering requirements', 'Validating engineering requirements', '','11111111-1111-1111-1111-111111111111'),

('capability-name', 'Modelling complex systems', 'Modelling complex systems', '','11111111-1111-1111-1111-111111111111'),

('capability-name', 'Designing software architecture', 'Designing software architecture', '','11111111-1111-1111-1111-111111111111'),

('capability-name', 'Constructing software systems', 'Constructing software systems', '','11111111-1111-1111-1111-111111111111'),

('capability-name', 'Managing engineering configuration', 'Managing engineering configuration', '','11111111-1111-1111-1111-111111111111'),

('capability-name', 'Verifying software quality', 'Verifying software quality', '','11111111-1111-1111-1111-111111111111'),

('capability-name', 'Documenting engineering work', 'Documenting engineering work', '','11111111-1111-1111-1111-111111111111'),

('capability-name', 'Protecting organisational assets', 'Protecting organisational assets', '','11111111-1111-1111-1111-111111111111'),

('capability-name', 'Governing engineering decisions', 'Governing engineering decisions', '','11111111-1111-1111-1111-111111111111'),

('capability-name', 'Managing software release', 'Managing software release', '','11111111-1111-1111-1111-111111111111'),

('capability-name', 'Operating production systems', 'Operating production systems', '','11111111-1111-1111-1111-111111111111'),

('capability-name', 'Recovering organisational knowledge', 'Recovering organisational knowledge', '','11111111-1111-1111-1111-111111111111'),

('capability-name', 'Learning from operational experience', 'Learning from operational experience', '','11111111-1111-1111-1111-111111111111'),

('capability-name', 'Improving engineering practice', 'Improving engineering practice', '','11111111-1111-1111-1111-111111111111'),

('capability-name', 'Adapting to changing business need', 'Adapting to changing business need', '','11111111-1111-1111-1111-111111111111'),

('capability-name', 'Continuous architectural analysis', 'Continuous architectural analysis', 
'replaces periodic milestone review with persistent, continuous evaluation','11111111-1111-1111-1111-111111111111'),

('capability-name', 'Real-time organisational documentation', 'Real-time organisational documentation', 'replaces documentation that lags implementation with continuous generation, validation and refinement','11111111-1111-1111-1111-111111111111'),

('capability-name', 'Automatic traceability generation', 'Automatic traceability generation', 'replaces selective, expensive traceability with continuous establishment and validation as artefacts evolve' ,'11111111-1111-1111-1111-111111111111'),

('capability-name', 'Knowledge recovery from legacy systems', 'Knowledge recovery from legacy systems', 'reconstructing engineering knowledge that had effectively disappeared, rather than only analysing current behaviour.','11111111-1111-1111-1111-111111111111'),

('capability-name', 'Continuous compliance verification', 'Continuous compliance verification', 'replaces periodic audit (a snapshot) with continuous evaluation against policy and regulatory obligation.','11111111-1111-1111-1111-111111111111'),

('capability-name', 'Engineering decision explainability', 'Engineering decision explainability', 'decisions remain explicitly connected to their supporting evidence, knowledge, policy, objective and outcome.','11111111-1111-1111-1111-111111111111'),

('capability-name', 'Evidence-based organisational reasoning', 'Evidence-based organisational reasoning', 'reasoning through shared organisational knowledge rather than solely through synchronous conversation/meeting.','11111111-1111-1111-1111-111111111111'),

('capability-name', 'Continuous requirements validation', 'Continuous requirements validation', '','11111111-1111-1111-1111-111111111111'),

('capability-name', 'Predictive engineering risk assessment', 'Predictive engineering risk assessment', '','11111111-1111-1111-1111-111111111111'),

('capability-name', 'Continuous quality assurance', 'Continuous quality assurance', '','11111111-1111-1111-1111-111111111111'),
 
('capability-name', 'Organisational memory synthesis', 'Organisational memory synthesis', 'Organisational memory synthesis across multiple projects','11111111-1111-1111-1111-111111111111'),

('capability-name', 'Continuous organisational learning', 'Continuous organisational learning', '','11111111-1111-1111-1111-111111111111'),

('capability-name', 'Autonomous capability optimisation', 'Autonomous capability optimisation', '','11111111-1111-1111-1111-111111111111'),

('capability-name', 'Enterprise-wide engineering impact analysis', 'Enterprise-wide engineering impact analysis', 'Enterprise-wide engineering impact analysis','11111111-1111-1111-1111-111111111111'),

('capability-name', 'Continuous stakeholder-intent reconciliation', 'Continuous stakeholder-intent reconciliation', 'persistently synthesising scattered stakeholder signal (meetings, tickets, support conversations, emails) into a single current requirement baseline, instead of periodic elicitation sessions','11111111-1111-1111-1111-111111111111'),

('capability-name', 'Continuous domain-model drift detection', 'Continuous domain-model drift detection', 'catching the moment a documented domain model diverges from how the business actually behaves, rather than discovering it at the next modelling exercise','11111111-1111-1111-1111-111111111111'),

('capability-name', 'Predictive architectural obsolescence detection', 'Predictive architectural obsolescence detection', 'forecasting when a pattern will fail to scale from continuous trend analysis of usage and load, before it actually breaks','11111111-1111-1111-1111-111111111111'),

('capability-name', 'Cross-system structural pattern recognition', 'Cross-system structural pattern recognition', 'spotting a structural weakness in one system because an AI participant has simultaneously reasoned over the architecture of every other system the organisation runs','11111111-1111-1111-1111-111111111111'),
  
('capability-name', 'Cross-codebase pattern propagation', 'Cross-codebase pattern propagation', 'the instant a fix or improvement is made anywhere, identifying and proposing the equivalent fix everywhere else it applies, across the entire portfolio at once','11111111-1111-1111-1111-111111111111'),
 
('capability-name', 'Continuous configuration drift detection', 'Continuous configuration drift detection', 'persistently verifying that deployed configuration across every environment still matches declared intent, rather than catching drift during an incident','11111111-1111-1111-1111-111111111111'),
 
('capability-name', 'Predictive test-coverage gap detection', 'Predictive test-coverage gap detection', 'identifying, before any defect occurs, which class of defect current test coverage would fail to catch, reasoned from historical defect/architecture correlation','11111111-1111-1111-1111-111111111111'),
 
('capability-name', 'Continuous vulnerability posture assessment', 'Continuous vulnerability posture assessment', 'whole-portfolio exposure analysis maintained continuously, rather than periodic penetration testing','11111111-1111-1111-1111-111111111111'),
 
('capability-name', 'Predictive threat-pattern anticipation', 'Predictive threat-pattern anticipation', 'recognising an emerging attack pattern elsewhere in the industry and pre-emptively checking the organisation systems for the same exposure before it is exploited','11111111-1111-1111-1111-111111111111'),

('capability-name', 'Continuous policy-conflict detection', 'Continuous policy-conflict detection', 'persistently checking every active policy, standard and decision across the whole organisation for latent contradiction, at a scale no governance board could track exhaustively','11111111-1111-1111-1111-111111111111'),
 
('capability-name', 'Continuous release-risk forecasting', 'Continuous release-risk forecasting', 'an ongoing, continuously updated risk prediction for an in-progress release, reasoned from the complete history of every prior release  outcome, rather than a single go/no-go review','11111111-1111-1111-1111-111111111111'),
 
('capability-name', 'Predictive incident anticipation', 'Predictive incident anticipation', 'recognising the precursor conditions of a future production incident from continuous telemetry correlation, before it manifests','11111111-1111-1111-1111-111111111111'),

('capability-name', 'Autonomous root-cause synthesis', 'Autonomous root-cause synthesis', 'reconstructing a full root-cause chain across code, infrastructure, configuration and decision history the instant an incident occurs, rather than requiring multi-team manual investigation','11111111-1111-1111-1111-111111111111'),
 
('capability-name', 'Autonomous standard synthesis', 'Autonomous standard synthesis', 'drafting or refining engineering standards directly from continuously accumulating evidence of what works, rather than through periodic committee review','11111111-1111-1111-1111-111111111111'),
 
('capability-name', 'Cross-organisational capability benchmarking', 'Cross-organisational capability benchmarking', 'continuously comparing this organisation's capability maturity against every other capability instance the platform hosts, surfacing improvement opportunities no organisation could see in isolation','11111111-1111-1111-1111-111111111111'),
 
('capability-name', 'Continuous objective-alignment monitoring', 'Continuous objective-alignment monitoring', 'persistently checking whether ongoing engineering work still serves its stated Objective as business conditions shift, flagging drift automatically instead of waiting for a scheduled review','11111111-1111-1111-1111-111111111111'),
 

Assign a Capability Steward. 

The value exchanged between capabilities is not limited to tangible engineering artefact — it includes information, knowledge, evidence, decision, architectural guidance, engineering assurance, risk assessment, compliance assessment, operational intelligence, recommendation, governance and organisational memory, encompassing every organisational outcome that contributes to organisational objective.

----------

Services

Group A — 17 base capabilities (grounded in §7.4-7.5 where named)
1. Discovering business requirements — Service: Business Requirement Discovery Service
Purpose: surface stakeholder need before design begins · Inputs: stakeholder access, business objective, prior domain knowledge · Outputs: discovered business requirement set · Quality: completeness, stakeholder coverage, ambiguity-free · Governance: requirements-management policy · Success: sponsor confirms requirement set represents intent · Consumers: Requirements Analysis, Architecture · Provider: Requirements Engineering Capability

2. Understanding business domains — Service: Domain Model Service
Purpose: give the organisation a shared model of the business it serves · Inputs: business documentation, stakeholder interviews, existing domain artefacts · Outputs: validated domain model, terminology, business rules · Quality: consistency, terminological precision · Governance: Ontology Model policy · Success: domain experts ratify the model · Consumers: Requirements Engineering, Architecture, Knowledge Management · Provider: Requirements Engineering Capability

3. Validating engineering requirements — Service: Requirement Validation Service
Purpose: confirm discovered requirements are correct, complete and agreed · Inputs: discovered requirement set, acceptance criteria · Outputs: validated, approved requirement baseline · Quality: traceability, stakeholder sign-off, no unresolved conflict · Governance: change-control policy · Success: requirement baseline approved and frozen · Consumers: Architecture, Software Construction, Verification · Provider: Requirements Engineering Capability

4. Modelling complex systems — Service: System Model Service
Purpose: represent structural and behavioural complexity before committing to design · Inputs: validated requirements, domain model, constraints · Outputs: system model (structural/behavioural views) · Quality: internal consistency, completeness against requirements · Governance: modelling standard · Success: model reviewed and accepted as basis for architecture · Consumers: Architecture · Provider: Architecture Capability

5. Designing software architecture — Service: Architectural Review Service (fully worked in §7.6, line 87 — reused verbatim)
Purpose: evaluate proposed solutions for architectural integrity and organisational alignment · Inputs: approved solution proposal, business requirements, architectural constraint, applicable standard · Outputs: approved architectural decision, documented rationale, identified risk, recommendation · Quality: compliance with architecture principle, complete reasoning, full traceability · Governance: enterprise architecture policy, security standard, technology standard, regulatory obligation · Success: decision approved, risk addressed, traceability established · Consumers: Software Construction, Project Governance · Provider: Architecture Capability

6. Constructing software systems — Service: Software Implementation Service
Purpose: deliver a working component satisfying agreed expectation · Inputs: architectural guidance, implementation standard · Outputs: implemented software component, implementation artefact · Quality: functional correctness, adherence to standard, maintainability · Governance: coding standard, security policy · Success: component satisfies architectural and functional specification · Consumers: Verification · Provider: Software Construction Capability

7. Managing engineering configuration — Service: Baseline Management Service
Purpose: preserve version integrity of every engineering artefact · Inputs: artefact versions, change requests · Outputs: managed baseline, version-integrity record · Quality: consistency, no untracked drift · Governance: configuration-management policy · Success: baseline reproducible on demand · Consumers: every capability · Provider: Configuration Management Capability

8. Verifying software quality — Service: Quality Assurance Service
Purpose: provide justified confidence the implementation satisfies specification · Inputs: implemented software, requirement baseline, test standard · Outputs: verification evidence, defect findings, confidence assessment · Quality: coverage, defect-detection effectiveness · Governance: quality policy, compliance standard · Success: confidence sufficient to justify release · Consumers: Release Management · Provider: Verification Capability

9. Documenting engineering work — Service: Technical Documentation Service
Purpose: keep an accurate, current representation of engineering knowledge · Inputs: architectural decisions, implementation artefacts, requirement baseline · Outputs: technical and user documentation · Quality: currency, completeness, clarity · Governance: documentation standard · Success: documentation matches current system state · Consumers: Operations, Knowledge Management, external customers · Provider: Documentation Capability

10. Protecting organisational assets — Service: Vulnerability Assessment Service (named in §7.4, line 55)
Purpose: identify and reduce exposure to security threat · Inputs: system artefacts, threat intelligence · Outputs: threat assessment, vulnerability findings, policy enforcement record · Quality: coverage, false-negative minimisation · Governance: security policy, regulatory obligation · Success: no unmitigated critical vulnerability at release · Consumers: Architecture, Software Construction, Release Management · Provider: Security Capability

11. Governing engineering decisions — Service: Decision Validation Service
Purpose: ensure engineering decisions comply with policy before taking effect · Inputs: proposed decision, applicable policy · Outputs: approved or rejected decision, rationale · Quality: consistency, explainability · Governance: decision-governance policy · Success: decision recorded with traceable rationale · Consumers: every capability · Provider: Governance Capability

12. Managing software release — Service: Deployment Governance Service (named in §7.4, line 55)
Purpose: determine and coordinate readiness for deployment · Inputs: quality assurance evidence, release candidate · Outputs: release recommendation, deployment coordination record · Quality: risk-adjusted go/no-go accuracy · Governance: release policy, change-control standard · Success: release deployed without rollback · Consumers: Operations · Provider: Release Management Capability

13. Operating production systems — Service: Availability Assurance Service (named in §7.4, line 55)
Purpose: keep deployed systems reliable and observable · Inputs: deployed software, monitoring configuration · Outputs: operational intelligence, incident records, performance data · Quality: uptime, mean-time-to-detect · Governance: SLA/operational policy · Success: agreed availability target met · Consumers: Requirements Engineering (feedback), Architecture (feedback) · Provider: Operations Capability

14. Recovering organisational knowledge — Service: Knowledge Discovery Service (named in §7.4, line 55)
Purpose: reconstruct engineering understanding not currently captured · Inputs: legacy artefacts, historical decisions, source code · Outputs: recovered knowledge item · Quality: accuracy, provenance completeness · Governance: knowledge validation policy · Success: recovered knowledge validated and published · Consumers: Architecture, Knowledge Management · Provider: Knowledge Management Capability

15. Learning from operational experience — Service: Operational Intelligence Service
Purpose: convert production experience into reusable understanding · Inputs: incident records, telemetry, operational evidence · Outputs: operational knowledge, lessons learned · Quality: actionability, timeliness · Governance: organisational-learning policy · Success: knowledge item published and referenced by future decisions · Consumers: Requirements Engineering, Architecture, Operations · Provider: Operations Capability

16. Improving engineering practice — Service: Standard Refinement Service
Purpose: keep engineering standards current with accumulated evidence · Inputs: evidence from service delivery, review findings · Outputs: revised standard, checklist, practice guidance · Quality: adoption rate, defect-reduction impact · Governance: standards-governance policy · Success: revised standard formally published · Consumers: every capability · Provider: Governance Capability

17. Adapting to changing business need — Service: Capability Realignment Service
Purpose: keep the capability portfolio aligned to shifting objectives · Inputs: revised or superseded Objectives, market/business signal · Outputs: capability gap assessment, realignment recommendation · Quality: responsiveness, accuracy of gap identification · Governance: strategic-governance policy · Success: capability portfolio reflects current Objectives · Consumers: organisational leadership, Template Model (Book 3 analogue) · Provider: Governance Capability

Group B — 14 existing AI-native capabilities (§6.10/§7.8, contracts constructed)
18. Continuous architectural analysis — Service: Architectural Awareness Service (named directly, §7.8 line 115: "organisational awareness service")
Purpose: maintain continuous, always-current architectural integrity assessment · Inputs: every artefact/model change · Outputs: real-time conformance status, drift alerts · Quality: latency (near-zero), false-positive rate · Governance: architecture policy · Success: no undetected divergence exceeding tolerance · Consumers: Architecture, Software Construction · Provider: Architecture Capability

19. Real-time organisational documentation — Service: Continuous Documentation Service
Purpose: keep documentation synchronised with current system state at all times · Inputs: every artefact change · Outputs: continuously updated documentation · Quality: currency (zero lag), accuracy · Governance: documentation standard · Success: no documentation ever found stale at audit · Consumers: Operations, Knowledge Management, customers · Provider: Documentation Capability

20. Automatic traceability generation — Service: Continuous Trace Awareness Service (named §7.8 line 115)
Purpose: keep every artefact relationship current without manual maintenance · Inputs: every artefact/decision change · Outputs: live traceability graph · Quality: completeness, no orphaned link · Governance: traceability policy · Success: full trace path reconstructible on demand · Consumers: Governance, Knowledge Management, Verification · Provider: Knowledge Management Capability

21. Knowledge recovery from legacy systems — Service: Legacy Knowledge Reconstruction Service
Purpose: reconstruct disappeared engineering knowledge from legacy artefacts · Inputs: legacy code, historical records, operational history · Outputs: reconstructed knowledge item with provenance · Quality: accuracy against ground truth where verifiable · Governance: knowledge validation policy · Success: reconstructed knowledge validated by domain review · Consumers: Architecture, Knowledge Management · Provider: Knowledge Management Capability

22. Continuous compliance verification — Service: Persistent Compliance Service (named §7.8 line 115: "persistent service")
Purpose: evaluate every change against applicable policy the instant it occurs · Inputs: every architectural/implementation/deployment/operational event · Outputs: continuous compliance status, violation alerts · Quality: zero-lag detection, coverage of all applicable frameworks · Governance: every active Compliance Pack's policy · Success: no compliance violation reaches release undetected · Consumers: Governance, Release Management · Provider: Compliance Capability

23. Engineering decision explainability — Service: Decision Rationale Service
Purpose: keep every significant decision connected to its supporting evidence and outcome · Inputs: decision record, supporting evidence, governing policy · Outputs: explainable decision trace · Quality: completeness of rationale chain · Governance: decision-governance policy · Success: any decision explainable on demand without reconstruction effort · Consumers: Governance, audit/regulatory stakeholders · Provider: Governance Capability

24. Evidence-based organisational reasoning — Service: Organisational Reasoning Service
Purpose: let engineering decisions emerge from accumulated organisational understanding rather than isolated discussion · Inputs: organisational knowledge base, accumulated evidence · Outputs: reasoned recommendation · Quality: consistency with prior precedent, evidentiary support · Governance: decision-governance policy · Success: recommendation accepted or explicitly overridden with rationale · Consumers: every capability · Provider: Knowledge Management Capability

25. Continuous requirements validation — Service: Continuous Requirement Conformance Service
Purpose: keep the requirement baseline validated as it evolves, not only at baseline-freeze · Inputs: every requirement change · Outputs: continuous validation status · Quality: zero-lag detection of newly introduced conflict · Governance: requirements-management policy · Success: no invalid requirement reaches architecture undetected · Consumers: Architecture · Provider: Requirements Engineering Capability

26. Predictive engineering risk assessment — Service: Engineering Risk Forecast Service
Purpose: forecast engineering risk before it materialises · Inputs: historical risk/outcome data, current engineering state · Outputs: risk forecast with confidence level · Quality: predictive accuracy (calibrated against outcomes) · Governance: risk-management policy · Success: forecast risk actually materialising within predicted window, tracked · Consumers: Governance, Release Management · Provider: Governance Capability

27. Continuous quality assurance — Service: Continuous Confidence Service
Purpose: maintain an always-current confidence assessment rather than a point-in-time one · Inputs: every code/test change · Outputs: live confidence score, defect findings · Quality: coverage, latency · Governance: quality policy · Success: confidence score never stale at any release decision · Consumers: Release Management · Provider: Verification Capability

28. Organisational memory synthesis across multiple projects — Service: Cross-Project Knowledge Synthesis Service
Purpose: synthesise reusable understanding across every concurrent and historical project · Inputs: knowledge items from every project · Outputs: synthesised, generalised knowledge · Quality: generalisability, non-contradiction · Governance: knowledge acquisition-scope policy (cf. Book 3 Ch.16 §12) · Success: synthesised knowledge reused by at least one other project · Consumers: every capability, every project · Provider: Knowledge Management Capability

29. Continuous organisational learning — Service: Continuous Learning Service
Purpose: keep the capability-improvement loop running without waiting for retrospectives · Inputs: evidence generated by every service interaction · Outputs: capability-improvement recommendation · Quality: cycle time between evidence and improvement · Governance: organisational-learning policy · Success: measurable capability-maturity increase over time · Consumers: every capability · Provider: Governance Capability

30. Autonomous capability optimisation — Service: Capability Self-Optimisation Service
Purpose: improve a capability's own effectiveness without waiting for external direction · Inputs: capability performance evidence · Outputs: applied optimisation, improvement record · Quality: measurable performance delta, non-regression · Governance: capability-ownership policy · Success: optimisation improves measured capability metric without introducing regression · Consumers: capability owner · Provider: the optimising capability itself

31. Enterprise-wide engineering impact analysis — Service: Cross-Enterprise Impact Analysis Service
Purpose: assess the consequence of a proposed change across the entire enterprise before it's made · Inputs: proposed change, full trace graph · Outputs: impact report spanning affected capabilities/projects · Quality: completeness of affected-entity discovery · Governance: change-control policy · Success: no unanticipated downstream impact discovered post-change · Consumers: Governance, Architecture · Provider: Knowledge Management Capability

Group C — 16 additional AI-native capabilities (newly proposed; contracts constructed)
32. Continuous stakeholder-intent reconciliation — Service: Stakeholder Intent Reconciliation Service
Purpose: keep requirement understanding synchronised with scattered, ongoing stakeholder signal · Inputs: meetings, tickets, support conversations, email · Outputs: continuously reconciled intent baseline · Quality: currency, conflict detection · Governance: requirements policy · Success: no stale intent baseline older than defined threshold · Consumers: Requirements Engineering · Provider: Requirements Engineering Capability

33. Continuous domain-model drift detection — Service: Domain Model Conformance Service
Purpose: detect the moment the domain model diverges from actual business behaviour · Inputs: domain model, live business signal · Outputs: drift alert · Quality: detection latency · Governance: Ontology policy · Success: drift corrected before it propagates into requirements · Consumers: Requirements Engineering, Architecture · Provider: Requirements Engineering Capability

34. Predictive architectural obsolescence detection — Service: Architectural Obsolescence Forecast Service
Purpose: forecast when a pattern will fail to scale, before it breaks · Inputs: usage/load telemetry, architectural model · Outputs: obsolescence forecast · Quality: lead time before actual failure, accuracy · Governance: architecture policy · Success: forecast pattern replaced before failure occurs · Consumers: Architecture · Provider: Architecture Capability

35. Cross-system structural pattern recognition — Service: Cross-System Pattern Recognition Service
Purpose: identify structural weakness in one system by reasoning across every system's architecture simultaneously · Inputs: architectural models of every system · Outputs: identified structural pattern/risk · Quality: cross-system coverage · Governance: architecture policy · Success: pattern confirmed applicable and addressed · Consumers: Architecture · Provider: Architecture Capability

36. Cross-codebase pattern propagation — Service: Fix Propagation Service
Purpose: propagate a fix or improvement to every place it applies, instantly · Inputs: applied fix, codebase inventory · Outputs: propagation candidates, applied propagations · Quality: precision (no incorrect propagation), coverage · Governance: change-control policy · Success: all valid instances remediated · Consumers: Software Construction · Provider: Software Construction Capability

37. Continuous configuration drift detection — Service: Configuration Conformance Service
Purpose: verify deployed configuration matches declared intent at all times · Inputs: declared configuration, live environment state · Outputs: drift alert, remediation recommendation · Quality: detection latency, coverage across environments · Governance: configuration-management policy · Success: drift remediated before incident occurs · Consumers: Operations, Configuration Management · Provider: Configuration Management Capability

38. Predictive test-coverage gap detection — Service: Coverage Gap Forecast Service
Purpose: identify defect classes current coverage would fail to catch, before they occur · Inputs: historical defect data, current test suite, architecture · Outputs: predicted coverage gap · Quality: predictive precision · Governance: quality policy · Success: predicted gap closed before associated defect class occurs · Consumers: Verification · Provider: Verification Capability

39. Continuous vulnerability posture assessment — Service: Continuous Security Posture Service
Purpose: maintain whole-portfolio security exposure awareness continuously · Inputs: every code/infrastructure change · Outputs: live posture status · Quality: coverage, zero-lag · Governance: security policy · Success: no critica critical exposure undetected between assessments (there are none — it's continuous) · Consumers: Security, Governance · Provider: Security Capability

40. Predictive threat-pattern anticipation — Service: Threat Anticipation Service
Purpose: check the organisation's own exposure the moment a new attack pattern emerges elsewhere · Inputs: external threat intelligence, internal system inventory · Outputs: anticipatory exposure assessment · Quality: time-to-check after new pattern publication · Governance: security policy · Success: exposure checked and mitigated before exploitation · Consumers: Security · Provider: Security Capability

41. Continuous policy-conflict detection — Service: Policy Consistency Service
Purpose: detect latent contradiction across every active policy/standard/decision · Inputs: full policy corpus · Outputs: conflict report · Quality: coverage, false-positive rate · Governance: governance policy itself · Success: no unresolved conflict reaches enforcement · Consumers: Governance · Provider: Governance Capability

42. Continuous release-risk forecasting — Service: Release Risk Forecast Service
Purpose: maintain an ongoing, updating risk prediction for an in-progress release · Inputs: full history of prior release outcomes, current release content · Outputs: continuously updated risk score · Quality: calibration accuracy · Governance: release policy · Success: risk score correlates with actual post-release incident rate · Consumers: Release Management · Provider: Release Management Capability

43. Predictive incident anticipation — Service: Incident Anticipation Service
Purpose: recognise precursor conditions of a future incident before it manifests · Inputs: continuous telemetry · Outputs: anticipatory alert · Quality: lead time, false-positive rate · Governance: operational policy · Success: anticipated incident prevented or mitigated pre-emptively · Consumers: Operations · Provider: Operations Capability

44. Autonomous root-cause synthesis — Service: Root-Cause Synthesis Service
Purpose: reconstruct a full root-cause chain the instant an incident occurs · Inputs: code, infrastructure, configuration, decision history · Outputs: synthesised root-cause chain · Quality: accuracy, completeness, time-to-synthesis · Governance: incident-management policy · Success: root cause confirmed correct on human review · Consumers: Operations, Governance · Provider: Operations Capability

45. Autonomous standard synthesis — Service: Standard Synthesis Service
Purpose: draft or refine engineering standards directly from accumulating evidence · Inputs: evidence from service delivery across the organisation · Outputs: proposed standard revision · Quality: evidentiary grounding, adoption rate post-publication · Governance: standards-governance policy · Success: proposed revision formally adopted · Consumers: Governance, every capability · Provider: Governance Capability

46. Cross-organisational capability benchmarking — Service: Capability Benchmarking Service
Purpose: compare this organisation's capability maturity against every other capability instance the platform hosts · Inputs: capability maturity data (where sharing permitted) · Outputs: benchmark report, improvement opportunity · Quality: comparability, tenant-isolation compliance · Governance: multi-tenancy/data-sharing policy (Book 3 Ch.42) · Success: benchmark-identified opportunity acted upon · Consumers: Governance, capability owners · Provider: Knowledge Management Capability

47. Continuous objective-alignment monitoring — Service: Objective Alignment Service
Purpose: continuously check ongoing engineering work still serves its stated Objective · Inputs: active Objective, current engineering state · Outputs: alignment status, drift alert · Quality: detection latency · Governance: strategic-governance policy · Success: drift corrected or Objective formally revised before divergence compounds · Consumers: Governance, organisational leadership · Provider: Governance Capability


## Capability

code,default_label,"description
"
requirements-elicitation,Requirements Elicitation,"Systematically discover and capture stakeholder needs, business objectives, constraints, and expectations from relevant sources and express them as candidate requirements for subsequent analysis and validation."
understanding-business-domain,Understanding business domain,"Establish, model, validate, and maintain a shared understanding of the business domain, including its concepts, terminology, entities, relationships, processes, rules, roles, and constraints, so that engineering decisions are grounded in accurate domain knowledge."
requirements-analysis,Analysing engineering requirements,"examine, structure, refine, model, and reason about elicited requirements to establish their meaning, relationships, dependencies, conflicts, constraints, priorities, and implications, producing a coherent requirements specification suitable for validation and subsequent engineering."
requirements-validation,Validating engineering requirements,"establish that analysed requirements accurately represent intended business and stakeholder needs and are correct, complete, consistent, feasible, unambiguous, verifiable, traceable, and appropriately agreed before being established as the authoritative engineering baseline."
modelling-complex-systems,Modelling complex systems,"create, analyse, and maintain coherent structural and behavioural representations of a system, its context, interactions, dependencies, and constraints, so that system complexity can be understood and used as a reliable basis for architectural and engineering decisions."
architecture-design,Designing software architecture,"determine, evaluate, document, and maintain the fundamental structure of a software system, including its major components, responsibilities, interfaces, interactions, architectural patterns, constraints, and significant design decisions, so that validated requirements and business objectives can be realised within acceptable engineering risk"
software-construction,Constructing software systems,"transform architectural and detailed design specifications into working software components and implementation artefacts through coding, configuration, generation, and use of appropriate software assets, while maintaining conformance with applicable requirements, architecture, and engineering standards"
software-design,Designing software components,"decompose architectural elements into implementable software components and determine their responsibilities, interfaces, behaviour, internal structure, dependencies, and design constraints so that they can be constructed consistently with the architecture and allocated requirements"
engineering-configuration,Managing engineering configuration,"establish and maintain controlled configuration items, baselines, versions, dependencies, and configuration status throughout the engineering lifecycle, ensuring that authorised changes are incorporated consistently and that the composition of any engineering product or environment can be determined and reproduced."
software-validation,Verifying software quality,"systematically examine and test software and associated engineering artefacts against defined requirements, specifications, standards, and quality criteria, producing objective evidence of conformance and identifying deviations that require resolution."
engineering-documentation,Documenting engineering work,"create, maintain, organise, and retrieve authoritative records of engineering activities, decisions, artefacts, rationale, and evidence throughout the engineering lifecycle, ensuring that relevant engineering knowledge is understandable, traceable, and available to those who need it."
protect-organisational-assets,Protecting organisational assets,"identify organisational assets and their protection requirements, assess threats and vulnerabilities, establish and apply appropriate protective controls, and monitor their effectiveness so that assets remain protected against unauthorised access, misuse, damage, loss, compromise, or disruption"
governing-engineering-decisions,Governing engineering decisions,"establish decision-making authority, criteria, processes, and controls for significant engineering decisions, and to ensure that such decisions are appropriately evaluated, authorised, recorded, and subject to review throughout the engineering lifecycle."
software-release,Managing software release,"plan, assemble, assess, authorise, and control the release of identified software configurations into their intended environments, ensuring that release prerequisites are satisfied, the released configuration is known and reproducible, and the transition is performed in a controlled manner"
operating-production-systems,Operating production systems,"operate, monitor, maintain, support, and control software systems in their production environments, ensuring that services remain available, perform as required, remain secure, and respond appropriately to operational events and changing conditions"
recovering-organisational-knowledge,Recovering organisational knowledge,"locate, retrieve, reconstruct, and contextualise existing organisational knowledge from available records, artefacts, systems, and other sources so that previously established knowledge can be made accessible and usable for current engineering and organisational needs."
learning,Learning from operational experience,"systematically capture, analyse, and synthesise operational experience, incidents, problems, performance data, and other operational evidence into actionable lessons and improvements for engineering, operations, and organisational practice."
engineering-practice-improvement,Improving engineering practice,"systematically evaluate engineering practices using experience, evidence, performance information, and identified deficiencies, and to develop, validate, adopt, and maintain improvements to the methods, processes, standards, and practices used to perform engineering work."
adapting-business-needs,Adapting to changing business need,"detect and assess changes in business objectives, priorities, operating conditions, and organisational needs, determine their implications for engineering capabilities and systems, and realign engineering direction, resources, and priorities so that engineering remains relevant to the business."
continuous-architectural-analysis,Continuous architectural analysis,"continuously analyse the evolving architecture of software systems against their requirements, architectural principles, constraints, dependencies, and operational evidence, identifying architectural risks, deviations, degradation, and emerging implications early enough to support corrective or evolutionary decisions"
real-time-organisational-documentation,Real-time organisational documentation,"continuously capture, update, organise, and maintain organisational knowledge and engineering information as work occurs and changes are made, keeping authoritative documentation closely synchronised with the current state of the organisation, its systems, decisions, and practices."
automatic-traceability-generation,Automatic traceability generation,"automatically identify and maintain traceable relationships among engineering artefacts, including requirements, designs, architecture, implementation, tests, defects, and releases, so that dependencies, lineage, coverage, and impact relationships can be determined throughout the engineering lifecycle."
legacy-modernisation,Knowledge recovery from legacy systems (Specialisation from “Recovering organisational knowledge”),
continuous-compliance-verification,Continuous compliance verification,
engineering-decision-explainability,Engineering decision explainability,
evidence-based-organisational-reasoning,Evidence-based organisational reasoning,
continuous-requirements-validation,Continuous requirements validation,"continuously evaluate requirements against current business and stakeholder needs, system context, engineering constraints, and evolving implementation evidence, detecting invalid, obsolete, conflicting, incomplete, or otherwise non-conforming requirements early enough to support corrective action."
predictive-engineering-risk-assessment,Predictive engineering risk assessment,"analyse current and historical engineering information to identify emerging risk patterns, forecast the likelihood and potential impact of future engineering risks, and provide early risk assessments that support preventive action and engineering decision-making."
continuous-quality-assurance,Continuous quality assurance,"continuously monitor and assess the quality of engineering processes, artefacts, and outcomes against defined requirements, standards, policies, and quality criteria, providing ongoing evidence of quality status and initiating corrective action when deviations are detected."
organisational-memory-synthesis,Organisational memory synthesis across multiple projects,"aggregate, relate, and synthesise knowledge from multiple projects and their engineering artefacts, experiences, decisions, and outcomes to identify reusable organisational knowledge, cross-project patterns, dependencies, lessons, and insights."
continuous-organisational-learning,Continuous organisational learning,"continuously capture and synthesise organisational experience and knowledge, evaluate its implications, incorporate validated learning into organisational knowledge, practices, decisions, and capabilities, and assess whether the resulting changes improve organisational outcomes."
autonomous-capability-optimisation,Autonomous capability optimisation,"continuously assess organisational capability performance and autonomously identify, evaluate, prioritise, and implement changes to capability structure, capacity, processes, resources, and supporting mechanisms in order to improve organisational outcomes within defined objectives, constraints, and governance controls."
enterprise-wide-engineering-impact-analysis,Enterprise-wide engineering impact analysis,"analyse the relationships and dependencies across the organisation's engineering systems, capabilities, projects, assets, and processes to determine the direct and indirect effects of proposed changes or conditions, including affected stakeholders, requirements, architecture, resources, risks, and downstream activities."
continuous-stakeholder-intent-reconciliation,Continuous stakeholder-intent reconciliation,"continuously capture and analyse evolving stakeholder intentions, compare them with established requirements and with one another, identify conflicts, ambiguities, and divergences, and facilitate their resolution so that the engineering baseline remains aligned with the current and collectively agreed stakeholder intent."
continuous-domain-model-drift-detection,Continuous domain-model drift detection,"continuously monitor changes in the business domain and compare them with the established domain model, identifying changes, inconsistencies, omissions, or obsolete representations that cause the model to diverge from the domain it represents."
predictive-architectural-obsolescence-detection,"Predictive architectural obsolescence detection
(Specialisation from “Predictive engineering risk assessment”)","continuously analyse architectural technologies, dependencies, patterns, constraints, support lifecycles, and external technology trends to predict emerging architectural obsolescence and provide sufficient early warning for architectural remediation, replacement, or evolution."
cross-system-structural-pattern-recognition,Cross-system structural pattern recognition,"analyse and compare the structures of multiple software systems and identify recurring, significant, or anomalous structural patterns across their architectures, components, interfaces, dependencies, and other engineering relationships."
cross-codebase-pattern-propagation,Cross-codebase pattern propagation,"identify engineering patterns or improvements that are applicable across multiple codebases, determine their affected locations and contextual variations, and propagate the approved pattern or change across those codebases while preserving correctness, consistency, and local compatibility."
continuous-configuration-drift-detection,Continuous configuration drift detection,"continuously monitor and compare actual software, infrastructure, environment, and configuration states against authorised configuration baselines and policies, detecting, assessing, and reporting deviations so that configuration integrity can be maintained."
predictive-test-coverage-gap-detection,"Predictive test-coverage gap detection
(Specialisation from “Predictive engineering risk assessment”)","analyse software structure, requirements, changes, dependencies, existing test assets, and historical verification evidence to predict areas where test coverage is likely to be insufficient, identify the nature and significance of the anticipated gaps, and provide early direction for additional verification."
continuous-vulnerability-posture-assessment,Continuous vulnerability posture assessment,"continuously identify, assess, correlate, and monitor vulnerabilities across organisational technology assets and their environments, determine their significance and exposure, and maintain an up-to-date view of the organisation's vulnerability posture to support prioritised remediation and risk decisions."
predictive-threat-pattern-anticipation,Predictive threat-pattern anticipation,"continuously analyse threat intelligence, historical security events, emerging attack techniques, vulnerabilities, system characteristics, and environmental signals to identify and forecast threat patterns that are likely to affect organisational assets, providing early warning to support preventive security action."
continuous-policy-conflict-detection,Continuous policy-conflict detection,"continuously analyse applicable policies, rules, standards, and controls and their relationships to identify conflicting, contradictory, or mutually incompatible requirements, determine the affected engineering activities or decisions, and provide timely evidence for policy resolution."
continuous-release-risk-management,Continuous release-risk forecasting,"continuously analyse release contents, changes, dependencies, verification evidence, defects, configuration, operational conditions, and historical release outcomes to forecast the likelihood and potential impact of release-related problems and provide early risk information for release decisions."
predictive-incident-anticipation,Predictive incident anticipation,"continuously analyse operational conditions, system behaviour, telemetry, changes, dependencies, historical incidents, and other relevant signals to identify patterns indicating that an operational incident is likely to occur, assess its potential impact, and provide early warning to support preventive or mitigating action."
autonomous-root-cause-synthesis,Autonomous root-cause synthesis,"autonomously correlate and analyse evidence from incidents, system behaviour, telemetry, changes, configurations, dependencies, defects, and engineering records to identify, evaluate, and synthesise probable root causes and their causal relationships, providing an explainable basis for corrective action."
autonomous-standard-synthesis,"Autonomous standard synthesis
(Specialisation from “Improving engineering practice”)","autonomously analyse engineering practices, organisational knowledge, experience, policies, existing standards, and evidence to identify recurring principles and formulate, evaluate, and maintain candidate standards for adoption within the organisation."
cross-organisational-capability-benchmarking,Cross-organisational capability benchmarking,"systematically compare organisational capabilities and their performance against relevant external organisations or established benchmarks, using comparable measures and contextual information to determine relative capability position and identify opportunities for improvement."
continuous-objective-alignment-monitoring,Continuous objective-alignment monitoring,"continuously monitor and evaluate the alignment of engineering activities, decisions, systems, investments, and outcomes with established business and organisational objectives, detecting divergence, loss of relevance, or conflicting priorities early enough to support corrective action."
business-analysis-approach,Planning the business analysis approach,"determine and establish the methods, activities, techniques, roles, responsibilities, deliverables, timing, and governance by which business analysis will be conducted for an initiative, taking into account its context, objectives, complexity, constraints, and stakeholder environment."
requirements-prioritising,Prioritising engineering requirements,"evaluate and establish the relative priority of engineering requirements using defined business, stakeholder, technical, risk, regulatory, dependency, cost, and other relevant criteria, so that requirements can be appropriately sequenced and resources directed toward the most important outcomes."
solution-options,Recommending solution options by value,"identify and evaluate alternative solution options against business objectives, stakeholder needs, expected benefits, costs, risks, constraints, and other relevant criteria, and to recommend the option or combination of options that provides the most appropriate overall value."
integrating-constructed-components,Integrating constructed components,"combine independently constructed software components and assemblies into progressively larger, coherent subsystems and systems, ensuring that their interfaces, dependencies, interactions, and configurations conform to the defined integration specifications."
engineering-assets-reuse,Reusing existing engineering assets,"identify potentially reusable engineering assets, assess their suitability, quality, security, compatibility, provenance, licensing, and lifecycle status, and select and incorporate appropriate assets into engineering solutions where reuse provides an acceptable alternative to new construction."
engineering-work-review,Reviewing engineering work,"independently examine engineering artefacts, activities, and decisions against applicable requirements, standards, policies, and review criteria, identify and communicate deficiencies or deviations, and determine whether the reviewed work is acceptable for progression or requires correction and re-review."
corrective-actions,Eliminating recurring operational problems,"systematically identify recurring operational problems, analyse their underlying causes, implement and track permanent corrective actions, and verify that the causes have been eliminated or adequately controlled so that the problems do not recur."
defect-management,Managing defects to resolution,"systematically capture, classify, assess, prioritise, assign, track, resolve, and close software defects, ensuring that resolutions are verified and that defects that cannot yet be resolved are explicitly deferred, owned, and controlled."
vendor-supplier-management,Managing external vendors and suppliers,"establish and manage relationships with external vendors, suppliers, and service providers, including their selection, contractual arrangements, performance, risk, compliance, and ongoing relationship management, so that externally provided products and services meet organisational requirements."
capability-evolution,Stewarding capability evolution and maturity,"assess, govern, and guide the evolution and maturity of organisational capabilities by establishing capability objectives, evaluating current capability performance and maturity, identifying gaps and improvement opportunities, defining evolutionary priorities, and monitoring progress toward the desired capability state."
change-management,Managing engineering change,"control proposed changes to engineering artefacts and engineering baselines by assessing their justification, impact, dependencies, risks, and consequences, obtaining appropriate authorisation, coordinating their implementation, and maintaining traceable records of the resulting state."