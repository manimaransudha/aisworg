
# Chapter 1 – Objective

[Remarks:
- SEU chapter says an SEU is "commissioned to achieve one or more software engineering objectives." 
- Templates imply a set of required Capabilities. 
- Profiles configure a commissioning. But nothing says where that initial list of required Capabilities actually comes from. 
- Somewhere, something has to decide *why* this SEU is being commissioned and *what it must be able to do* before Template Model can validate anything or the Composition Engine can compose anything. Objective is that something.

- which Template fits, which Capabilities get composed, which Packs get pulled in is answerable *from* an Objective.

— an Objective is *why*, not *how much by when* (that's a Goal), not *what property the system must have* (a Requirement), and not *the approach chosen to pursue it* (a Strategy). That distinction is worth preserving exactly, because it's what stops Objective from becoming a dumping ground for everything upstream of engineering work. An Objective says why an SEU exists. It does not say how the SEU will get there — that's Template, Profile and Pack composition's job, downstream.

- Objective should declare or allow derivation of required Capabilities, but it should not itself pick a Template or compose Packs. 
- Objective's job ends at "here is what must be achieved, and here is what ability that requires" — it hands off from there.
]
 

## 1. Purpose

An **Objective** is a persistent, versioned statement of engineering intent that justifies the commissioning of a Software Engineering Unit (SEU) and declares or allows derivation of the Capabilities required to achieve it.

Objective is the root of the engineering layer. Every Capability requirement, Template selection and Pack composition decision shall be traceable to at least one Objective.

An Objective does not specify how it will be achieved. It specifies why the SEU exists and what ability its achievement requires.

## 2. Scope

This chapter defines:

- Objective abstraction;
- Objective tiers;
- Objective structure;
- Objective decomposition;
- Objective-to-Capability derivation;
- Objective lifecycle;
- Objective traceability.

This chapter does not define:

- Template selection or validation logic (Chapter 6);
- Capability definitions (Chapter 10);
- Pack composition mechanics (Chapter 4);
- commissioning workflow (Chapter 8).
 

## 3. Architectural Position

```
Objective

↓

Required Capabilities

↓

Template Model

↓

Composition Engine

↓

Effective Engineering Configuration

↓

Software Engineering Unit
```

Objective determines what capability an SEU requires. It does not determine how that capability is composed or fulfilled.
 

## 4. Definition

An Objective is a persistent engineering-intent object that:

- justifies the existence of an SEU
- declares, or allows derivation of, the Capabilities required to achieve it;
- exists independently of any Template, Pack or Participant.

An Objective is not a Goal. A Goal is the measurable target that makes an Objective concrete at a point in time.

An Objective is not a Requirement. A Requirement is a system property the Objective motivates.

An Objective is not a Strategy. A Strategy is the approach chosen to pursue the Objective.

An Objective does not specify implementation. Implementation is determined by Template selection, Pack composition and Participant fulfilment, all downstream of it.
 
## 5. Architectural Principles

### OBJ-001

Every SEU shall be commissioned in service of at least one Objective.


### OBJ-002

Objectives are persistent and independently traceable.


### OBJ-003

Every Objective shall declare, or allow derivation of, the Capabilities required to achieve it.


### OBJ-004

Objectives are hierarchical: Strategic Objectives decompose into Operational Objectives, which decompose into Engineering Objectives.

### OBJ-005

Objectives remain independent of Template, Pack and Participant selection.

### OBJ-006

Objectives may be reviewed, reaffirmed or superseded without invalidating the historical Deliverables, Decisions or Capabilities that trace back to them.

## 6. Functional Requirements

### FR-1.1

Every Objective shall possess a globally unique identifier.

### FR-1.2

Every Objective shall declare its tier: Strategic, Operational or Engineering.

### FR-1.3

Every Objective shall declare, or support automated derivation of, one or more required Capabilities.

### FR-1.4

Objectives shall support hierarchical decomposition from Strategic through Operational to Engineering tiers.

### FR-1.5

Every SEU commissioning request shall reference at least one Objective. 

### FR-1.6

Objective state changes shall be governed and fully traceable.


### FR-1.7

An Objective referenced by an active Deliverable shall remain immutable except through governed supersession.


## 7. Objective Tiers

Every Objective shall belong to one of the following tiers.

### Strategic Objective

Organisational-level intent, typically spanning multiple SEUs or an extended time horizon.

Example: "Establish a claims-processing capability compliant with regional insurance regulation."
 
### Operational Objective

Intent scoped to a specific programme or initiative, typically realised by one SEU.

Example: "Deliver an automated claims-adjudication service for the retail claims line of business."
 
### Engineering Objective

Intent scoped to a specific, boundable engineering outcome within an SEU.

Example: "Provide a fraud-detection capability integrated into the claims-adjudication workflow."

A Strategic Objective may decompose into several Operational Objectives; an Operational Objective may decompose into several Engineering Objectives. An SEU is typically commissioned against one Operational Objective and executes against its decomposed Engineering Objectives.
*[Remarks: We have refined this to commission SEU against any leaf]*
 
## 8. Objective Structure

Every Objective shall define:

- Identifier
- Statement
- Tier
- Parent Objective (if decomposed)
- Required Capabilities (declared or derived)
- Sponsoring Authority  
- Status
- Version
- Traceability References

The internal representation of the Objective statement is implementation-defined.

## 9. Objective Decomposition

A Strategic Objective may decompose into one or more Operational Objectives.

An Operational Objective may decompose into one or more Engineering Objectives.

Decomposition shall preserve traceability to the parent Objective.

Decomposition does not create new intent. It refines existing intent into a more specific, boundable form.

## 10. Deriving Required Capabilities

Before an SEU may be commissioned against it, every Objective shall carry a set of required Capabilities.

Required Capabilities may be:

- declared explicitly, as part of the Objective's own authored content; or
- derived by Capability Packs (Chapter 5), contributed by the platform, an Organisation, a Domain or a Customer, acting on the Objective's content.

This determination acts on the Objective's content. It is not something the Objective itself performs. The Objective holds the resulting list. It does not derive, select or compose anything.

The Composition Engine (Chapter 4) shall not compose Packs until required Capabilities have been determined.

Required Capabilities are the sole input Objective contributes to commissioning.


## 11. Objective and Template Selection

Template Model (Chapter 6) shall validate or select a Template against an Objective's required Capabilities.

A Template is suitable for an Objective only if it supports every Capability the Objective requires.

Where no existing Template supports an Objective's required Capabilities, commissioning shall not proceed until a suitable Template is defined or composed.

Objective does not evaluate Template suitability itself. It supplies the required-Capability list that Template Model evaluates against.

## 12. Objective Lifecycle

Every Objective shall progress through the following lifecycle.

```
Proposed

↓

Active

↓

Achieved

↓

Archived
```

An Active Objective may instead transition to **Superseded** (replaced by a revised Objective) or **Retired** (abandoned without replacement), both of which preserve full historical traceability.

An Objective can be returned to the Proposed state before entering the Active state for rework. 

## 13. Objective Traceability

Every Objective shall preserve:

- originating sponsor or Authority;
- decomposition history (parent and child Objectives);
- derived or declared required Capabilities;
- referencing SEUs;
- referencing Deliverables and Decisions;
- supersession history.

Every Deliverable, Decision and Capability requirement shall be traceable to at least one Objective. This is the root of the Engineering Knowledge Graph (Architecture Catalogue ADR – Engineering Knowledge Graph): every other persistent object's traceability chain terminates at an Objective.

## 14. Events

The Objective subsystem shall publish:

- ObjectiveProposed
- ObjectiveActivated
- ObjectiveRejected
~~- ObjectiveDecomposed~~
~~- ObjectiveCapabilitiesResolved~~
- ObjectiveAchieved
- ObjectiveSuperseded
- ObjectiveRetired
- ObjectiveArchived

*[Remarks: An event should align with the life cycle. The ones removed are all part of Proposed stage in the life cycle]*

## 15. Non-Functional Requirements

The Objective Model shall:

- preserve complete historical traceability;
- support hierarchical decomposition without depth limits;
- remain independent of Template, Pack and Participant implementations;
- support composition of required Capabilities from multiple Packs;
- remain reproducible: given the same Objective and Pack set, the same required Capabilities shall always be derived.
 

## 16. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Every SEU is commissioned against at least one Objective.

✓ Objectives declare or derive their required Capabilities before commissioning proceeds.

✓ Objective decomposition preserves traceability to its parent.

✓ Objectives remain independent of Template and Pack selection.

✓ Every Deliverable and Decision traces back to an Objective.

✓ Objective supersession preserves historical traceability without invalidating past Deliverables.
 

## 17. Deliverables

Implementation of this chapter shall produce:

- Objective domain model.
- Objective registry. 
- Objective decomposition service.
- Objective-to-Capability derivation service. 
- Objective traceability service.
- Objective APIs.
- Objective events.

---

## 18. Implementation Specifics

*Recorded 2026-08-12. This section documents implementation decisions for the Objective model. It does not change the requirements above (OBJ-001–006, FR-1.1–1.7); it records how they are realised. It follows the platform convention of keeping the normative specification stable and capturing realisation decisions separately.*

### 18.1 ✅ SEU ↔ Objective cardinality: one-to-one — enforced (CR-002), refined by CR-009

An SEU serves **exactly one** Objective, and an Objective is served by **at most one** SEU (none before it is commissioned, exactly one after). This is the tidiest reading of OBJ-001 / FR-1.5 ("at least one Objective") and §7 ("an SEU executes against its decomposed Engineering Objectives"), taken at the finest grain: one SEU per *commissionable leaf* Objective. Every SEU has a single, unambiguous purpose, and every Objective a single accountable SEU.

> **Refined by CR-009 (2026-08-13):** "finest grain" is now the **non-Strategic leaf**, not the Engineering tier specifically. An SEU serves the finest-grained Objective in the tree — an Operational Objective with no Engineering children *is* the leaf and gets an SEU directly; if it is decomposed further, its Engineering leaves get the SEUs. Strategic Objectives are never commissioned. See §18.12.

The deciding reason is scope change. Under a one-to-many mapping, removing one Objective from a multi-Objective SEU is surgery: orphaned Deliverables, an EBM composed from a union of Capabilities that must be recomposed, and attestations still referencing the removed Objective. Under one-to-one, changing scope is a whole-unit operation — decommission the SEU — rather than in-place surgery. (What decommissioning should *mean* across the SEU lifecycle is itself **open**; see §18.9.) A programme's several Engineering Objectives therefore become several SEUs, grouped under their shared Operational Objective (§18.6).

### 18.2 ✅ Where the relationship lives, and what the schema enforces — enforced (CR-002)

The relationship is a single foreign key `seus.objective_id` (`NOT NULL`), which enforces "exactly one Objective per SEU" directly. Two further invariants are now **enforced** (CR-002, built 2026-08-12):

- **At most one SEU per Objective.** A `UNIQUE` index on `seus.objective_id` (migration `034`) — an Objective cannot be commissioned twice, enforced by the database, not an application check (which would race). This is the same invariant the commissioning flow surfaces as "this Objective is already assigned" (§18.8).
- **~~Engineering-tier only.~~ Superseded by CR-009 → non-Strategic *leaf*.** CR-002 originally restricted commissioning to Engineering-tier Objectives. **CR-009 (2026-08-13) replaces that rule:** `commissionSeu` now rejects a Strategic Objective, and rejects any Objective that has children (not a leaf), accepting **any non-Strategic leaf** (Operational or Engineering with no children, Active, un-commissioned). The `UNIQUE(seus.objective_id)` invariant above is unchanged. See §18.12.

### 18.3 ✅ Objectives are created independently — enforced (CR-002)

Consistent with OBJ-002, an Objective exists before, and possibly without, any SEU. It is un-commissioned until an SEU references it, and with the `UNIQUE` constraint above, at most one SEU ever does. An un-commissioned Objective having no SEU is its honest state, not a defect. It is also why an Objective's own governed transitions cannot be SEU-scoped: before commissioning there is no SEU to scope them to.

### 18.4 🚩 Deliverables and Objective attribution

***Status: open — under review, not finalised. In particular: whether §13 traceability must surface the Objective node in the Deliverable's traceability payload, or whether "the SEU shows its Objective" suffices.***

A Deliverable belongs to its SEU (`deliverables.seu_id`). It is **not** given a direct Objective foreign key, and does not need one: under one-to-one, a Deliverable's Objective is simply its SEU's single Objective, reached in one hop (Deliverable → SEU → Objective). This keeps traceability derived from existing structural edges (§13; Architecture Catalogue ADR – Engineering Knowledge Graph) rather than denormalised into a redundant column.

### 18.5 🚩 Objective achievement

***Status: open — under review, not finalised. Note the current build sets the Objective's `Achieved` state via a manual governed transition; nothing yet derives achievement from SEU completion. Whether derived achievement is in scope for this chapter (vs. a later one) is to be decided.***

Because an SEU serves exactly one Objective, achievement tracks SEU completion: the Objective is achievable when the SEU's Deliverables have reached their accepted state. No per-Objective partitioning of the SEU's work is needed.

### 18.6 🚩 Multi-phase efforts: an integration Objective with its own SEU

***Status: open — under review, not finalised (the cross-SEU sequencing question below, and whether programme-level grouping of SEUs under a shared Operational Objective is a required view, are both undecided).***

A single effort broken into phases is modelled as one Engineering Objective per phase, each its own SEU, plus a distinct **integration Objective with its own integration SEU** whose Deliverables depend on the phase SEUs' outputs. Integration is therefore a first-class, accountable unit rather than a responsibility folded into a phase, and cross-phase consistency is the integration SEU's explicit remit. The phase SEUs and the integration SEU are grouped under their shared **Operational Objective (the programme)** through the decomposition hierarchy (`parent_objective_id`), which is the natural umbrella for all the SEUs of one programme.

Implication to confirm when this is built: the integration SEU depends on the phase SEUs' outputs, which cross SEU boundaries. Under the Participant Integration model this is naturally satisfied at the artifact level, since the integration SEU's participants pull the phase SEUs' Baselined outputs from version control as inputs. If the platform must also *gate* the integration SEU on the phase SEUs reaching Baselined, rather than only making the artifacts available, that is cross-SEU sequencing, which the current within-SEU dependency engine does not yet do. Decide per case whether artifact availability suffices or platform-level cross-SEU gating is wanted.

### 18.7  🚩 Relationship to the current build

One-to-one was already the built state (`seus.objective_id NOT NULL`), needing no cardinality migration. The §18.2 enforcement (`UNIQUE` on `seus.objective_id` + the Engineering-tier check, **CR-002**) and the §18.8 commissioning entry point (**CR-003**) are now **built** (2026-08-12). §18.4–18.6 (and §18.9) describe how the built model is to be read and remain **open** pending deeper review (marked in each).

### 18.8 ✅ Commissioning entry point —  built (CR-003), reshaped by CR-009

Commissioning is initiated **from the Objectives screen**, not from a global navbar action (built 2026-08-12); the standalone "Commission new SEU" navbar entry is removed. Under one-to-one, exactly one Objective is selected per commissioning, and attempting to commission an Objective that already has an SEU is refused with a **correctable** error — the same at-most-one-SEU-per-Objective invariant §18.2's `UNIQUE` constraint enforces at the database.

> **Reshaped by CR-009 (2026-08-13):** the Objectives screen is now a **tree** (§18.12), not a flat list. The per-row **Commission SEU** action appears on any **non-Strategic leaf** that is **Active** and **un-commissioned** (already-commissioned ones show a *Commissioned* badge); the action is offered both in the tree browse rows and on the Objective detail page. This replaces CR-003's "Engineering, Active, un-commissioned" predicate with "non-Strategic leaf, Active, un-commissioned."

### 18.9 🚩 Open: SEU decommissioning semantics

***Status: open — to be detailed separately before it is relied upon.***

§18.1's scope-change argument leans on "changing scope = decommission the SEU." What decommissioning should *mean* across the SEU lifecycle is undecided: how far into an SEU's life a decommission remains meaningful, at what point it becomes moot, and — since work simply has to stop — how that stop is reflected, both in the SEU's own state and in the fate of in-flight vs. already-Baselined Deliverables, minted Attestations, and any Engineering Capital already promoted out of the SEU. Deferred for a dedicated review.

### 18.10 ✅ Objective authority — badge-based (noun × verb); tenant is reach, not authority — built (CR-006, CR-071)

*Recorded 2026-08-13; updated to the built model when CR-006 landed as noun × verb (2026-08-13); reach gate closed by CR-071 (2026-08-28).*

**Decided, and for transitions now built (CR-006):**

- **Objective authority is badge-based, never role-based.** Who may drive an Objective's lifecycle is decided by **badges**, not the `role` axis (`general`/`power`/`super`, `requireRole`). Role gates at most basic authenticated/home access; the badge gates authority. CR-006 realises this for every governed entity uniformly.
- **Authority is `noun × verb`.** A governed transition requires the actor to hold the `noun_verb` badge the transition names — for Objectives: `objective_activate` (Proposed→Active), `objective_achieve`, `objective_supersede`, `objective_retire`, `objective_archive`. `transitionEngine` derives the required badge from the transition's noun (entity type) + verb and asks `badgeAuthorityEngine.authorise`: does the actor hold that badge (Active), or `root` (bypass)? Nothing else — **no acting-badge declaration, no role, no scope**. So an Objective transition is authorised **exactly like a Deliverable**, with no Objective-specific code. The original gap ("Objectives sit under `requireRole('general')` with no badge") is therefore closed at the transition level.
- **Tenant is a *separate reach gate*, not part of the authority check.** This section originally proposed matching a grant's `scope_id` against the Objective's `tenant_id`. CR-006 deliberately **split the two axes**: authorisation is pure `noun × verb`, and **scope/reach — which tenant's Objectives an actor may touch — is an independent, earlier gate** (§18.11), never folded into the badge. **That reach gate is now built (CR-071)**, covering every practical path: the list/search routes filter by tenant; a `router.param("id", ...)` gate on both the web and JSON API Objective routers rejects (as a plain "not found," never a 403) any non-root request naming another tenant's Objective id directly; and `createObjective` refuses to decompose a new child under a parent in a different tenant. All three fail closed on a legacy row with no tenant attribution yet, same rule throughout.

**Still open (residual Objective-authority gaps — for later):**

- **Objective *creation* authority — the uniform `define` birth transition, deferred (not a gap).** Creating an Objective routes through `createObjective`, not `transitionEngine`, so it carries no badge check today (gatekeeper-authenticated only; the `requireRole('general')` that once fronted `/seu` was removed — role is landing-only, not authority). This is **not** an Objective-specific deficiency: the CR-006 vocabulary already models creation as a **birth transition** — a `define`-verb edge fanning into the entity's initial state ("create-as-transition") — but **no birth rows are wired for any entity yet** (the vocabulary's own note: *"`define` … added when creation-as-transition is wired (a later stage) — no birth rows here yet"*). When that lands, `transitionEngine` derives `objective_define` and gates creation through the same `badgeAuthorityEngine` as every other hop, with no Objective-specific code — **uniformly for every entity**. So creation is un-gated today by **deferral, not omission**. (The birth verb is `define`, distinct from `create` = "begin work — move out of the initial state," e.g. Deliverable `Defined → In Progress`.) CR-009 adds *structural* create rules — mandatory parent, valid tier relationship — but those are integrity, not authority.
- **`objectives.tenant_id` — built, but as `sponsoring_authority` JSONB (migration 122, CR-071), not a literal `tenant_id` column.** Deliberately open-ended (`{ tenant: tenant_id, ... }`) so a later multi-tenancy phase can add more without a schema change — see §18.11.
- **Granting the `objective_*` badges** — a separate **grant CR** (who is granted which). Settle there whether Objectives want a per-verb split (distinct `objective_activate` vs `objective_achieve` …) or a single manager badge; the old provisional `product-manager` name is moot.

**Broader principle (now largely realised for transitions):** *authority belongs on badges, not on `requireRole`.* CR-006 moved every governed transition onto `noun × verb`; what remains outside it is admin routes (still `requireRole`, a separate larger track) and entity *creation* — the latter not on `requireRole` at all but simply un-gated pending the uniform `define` birth transition described above.

### 18.11 ✅ Tenant scope is rooted at the Objective and inherited — not re-checked per entity — built (CR-071)

*Recorded 2026-08-13; closed 2026-08-28 (CR-071) — including a real bug found and fixed along the way: commissioning was not actually deriving the SEU's Tenant from its Objective.*

An Objective carries a `tenant_id` via `sponsoring_authority` (§18.10), making the Tenant a **single source of truth at the root of the engineering graph**, inherited transitively — not stamped or checked independently on every downstream entity:

- Because an SEU is commissioned against **exactly one** Objective (1:1, §18.1), the SEU belongs to **that Objective's Tenant**. Everything the SEU owns — Deliverables, Events, Attestations, Work Items, Dependency Edges, Evidence/Decisions/Knowledge, etc. — belongs to the SEU, hence transitively to the **same** Tenant.
- So a Deliverable's (or Event's, or Attestation's) Tenant is *derived* by walking to its owning Objective (`Deliverable → SEU → Objective`); none of them needs an independent authoritative `tenant_id` or a separate tenant check.

Implications:

- **Commissioning inherits the Tenant.** An SEU's Tenant is set from its Objective's Tenant, not chosen separately or defaulted — `commissionSeu` (`seus.tenant_id`, migration `026`) now derives it from the Objective's own `sponsoring_authority.tenant` whenever a caller doesn't explicitly supply one. This closed a real, confirmed bug: `commissionFromExistingObjective` (the "Commission SEU" action on an existing Objective) never forwarded a tenant at all, so every SEU commissioned that way silently landed in the seeded default tenant regardless of which tenant actually owned the Objective. One deliberate exception: `commissionFromForm`'s one-shot path (Objective created inline, hung under the shared cross-tenant container `ensureOneShotContainer`) always resolves and passes its own tenant explicitly, because that container's `sponsoring_authority` reflects whichever tenant happened to create it first, not the current request's tenant — deriving from it would misattribute every one-shot SEU to that first tenant.
- **Isolation is applied once at the root.** For the tenant *reach* axis (data isolation), a filter at the Objective/SEU root covers the whole subtree; per-entity tenant re-checks are redundant. This is exactly the **reach gate** §18.10 refers to, now built — a layer *separate* from authorisation (which CR-006 made pure `noun × verb`, scope-free): downstream entities resolve their Tenant by inheritance, not by carrying their own copy or being re-checked.

### 18.12 ✅ Objective hierarchy: mandatory parent, tree, re-parenting, tier integrity — built (CR-009)

*Recorded 2026-08-13. Realises OBJ-004 / FR-1.2 / FR-1.4 / §7 / §9 more strictly than the original build, which allowed orphan non-Strategic Objectives.*

- **Mandatory parent.** `Strategic` is the only tier permitted to be a root (parentless). `Operational` and `Engineering` **require** a parent — enforced in `createObjective` (correctable error) and by a DB `CHECK (tier = 'Strategic' OR parent_objective_id IS NOT NULL)` (migration `037`). The migration first promotes any pre-CR-009 orphan Operational/Engineering rows to Strategic so the constraint applies cleanly. The existing rank rule is retained: a child's tier must be **not more strategic** than its parent's (`Strategic`=0 < `Operational`=1 < `Engineering`=2) — no *strict* single-step decomposition is required (Engineering directly under Strategic is allowed).
- **Commissioning eligibility = non-Strategic leaf** (supersedes §18.2's Engineering-tier rule, above).
- **Objectives screen is a tree.** Browse mode paginates the Strategic **roots** (server-side), each expandable to lazy-load its children one level at a time; search mode returns a flat, paginated hit list, each hit shown with its **breadcrumb path to root**. Replaces the former flat list.
- **Contextual creation.** The child's tier and parent are fixed by the affordance used: no objectives → *Create Strategic*; on a Strategic node → *Add Operational / Add Engineering*; on an Operational node → *Add Engineering*; an Engineering node is a leaf. "Parent required" and a valid tier relationship are therefore guaranteed by construction.
- **Re-parenting (move).** A parent-picker moves an Objective to a new parent; its **whole subtree comes with it** (only the moved node's `parent_objective_id` changes — descendants already point at it). Guards: no cycles (not under itself or a descendant), the rank rule, and parent-required for non-Strategic tiers.
- **Tier edit under integrity.** `updateObjective` may change tier only while every invariant still holds — the node keeps a valid parent (or is a Strategic root), its parent is not more strategic than the new tier, and no child becomes more strategic than the new tier.
- **One-shot commissioning keeps working via an auto-parent (owner decision).** The "commission from a bare statement" paths (`commissionFromForm` behind the `/seus/new` form; `startAuthoring` for SDK authoring) have no natural parent, so they hang their Engineering Objective under a single **reused Strategic container root** (`ensureOneShotContainer`, sentinel statement *"Uncategorised — directly-commissioned SEUs"*) rather than minting a root per SEU.

### 18.13 Known gaps against the normative spec (tracked, not yet built)

*Recorded 2026-08-13. Recorded here so the delta between §1–17 and the build is explicit; none are regressions.*

- **~~§14 events — partial (CR-010).~~ Built (CR-072).** §14's final list is 6 events (`ObjectiveDecomposed`/`ObjectiveCapabilitiesResolved` were struck from it — Proposed-stage events, removed, not gaps). All 6 are now emitted: `ObjectiveProposed` via the manual-trigger queue step (`triggerEngine.submit`, CR-072), and `ObjectiveActivated`/`ObjectiveAchieved`/`ObjectiveSuperseded`/`ObjectiveRetired`/`ObjectiveArchived` via `transitionObjective`'s own per-state event map. The generic `ObjectiveTransitioned` this bullet originally described survives only as an unreachable fallback (`OBJECTIVE_TRANSITION_EVENT[...] ?? "ObjectiveTransitioned"`) for a target state no real transition ever names.
- **§10 Pack-based Capability derivation — not built (CR-011).** Required Capabilities are either explicitly declared or **suggested** by a transparent word-overlap heuristic (`suggestCapabilityCodes`); automated derivation from Objective content via Capability Packs (Chapter 5) is not implemented. (This mirrors the "Capability Pack" derivation gap noted in the Build Plan — Chapter 5's own taxonomy never defines the mechanism.) Tracked as **CR-011** (proposed, not scheduled).
- **§8 structure — Sponsoring Authority / tenant — built (CR-071).** A distinct `sponsoring_authority` JSONB field now exists (migration 122; §18.10/§18.11), independent of `requested_by`. A child copies its parent's value at creation; a Strategic root derives it fresh from its creator's own tenant.
- **§18.5 derived achievement — open.** `Achieved` remains a manual governed transition; nothing derives it from SEU completion.
- **Creation authority — ungoverned.** See §18.10 (creation carries no role or badge check).
