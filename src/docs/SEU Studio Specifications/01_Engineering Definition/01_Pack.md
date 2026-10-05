# Chapter 5 – Pack Model

## 1. Purpose

A **Pack** is the fundamental unit of extension within the AI-native Software Organisation Platform.

A Pack contributes behaviour, knowledge, governance, services or integrations to the platform without requiring modification of the Runtime Kernel.

Packs enable organisations to tailor Software Engineering Units (SEUs) to specific engineering practices, business domains, technologies, compliance requirements and integration environments while preserving architectural stability.

Every Engineering Behavior Model (EBM) is produced by composing contributions from one or more Packs.

## 2. Scope

This chapter defines:

- Pack abstraction
- Pack taxonomy
- Pack responsibilities
- Pack lifecycle
- Dependency declaration
- Pack metadata
- Behavioural contributions
- Versioning

This chapter does not define:

- Pack composition algorithms
- Runtime execution
- Engineering Behavior Model internals

## 3. Architectural Position

```
Pack

↓

Composition Engine

↓

Engineering Behavior Model

↓

Software Engineering Unit
```

A Pack never executes.

It contributes behaviour.

Execution is performed only by commissioned SEUs.



## 4. Definition

A Pack is a self-contained, versioned, composable unit that contributes one or more engineering assets to the platform.

A Pack shall never contain project-specific runtime state.

Packs are reusable across multiple SEUs.



## 5. Architectural Principles

Every Pack shall satisfy the following principles.

### PM-001

A Pack shall represent one coherent engineering concern.

### PM-002

A Pack shall declare how its contributions compose with other Packs.

### PM-003

Packs shall be versioned independently.

### PM-004

A Pack may be replaced without requiring Runtime Kernel modification.

### PM-005

Every contribution shall remain traceable to its originating Pack.

---

## 6. Pack Taxonomy

The platform recognises the following Pack categories.

### 6.1 Platform Packs (Engineering Packs)

Platform Packs provide default platform behaviour.

Examples:

- Core Engineering Behaviour
- Default Governance
- Knowledge Management
- Traceability
- Decision Governance

Platform Packs are maintained by the platform itself.



### 6.2 Organisation Packs

Organisation Packs contribute organisation-specific engineering behaviour.

Examples:

- TCS Engineering Practices
- IBM Engineering Practices
- Cigna Engineering Practices

Organisation Packs should extend Platform Packs wherever practical.



### 6.3 Domain Packs

Domain Packs contribute to business-domain knowledge.

Examples:

- Banking
- Healthcare
- Insurance
- Manufacturing
- Telecommunications

Typical contributions include:

- terminology;
- ontology;
- business rules;
- domain workflows;
- reference models.



### 6.4 Compliance Packs

Compliance Packs contribute regulatory behaviour.

Examples:

- HIPAA
- PCI-DSS
- SOX
- ISO 27001
- GDPR

  Typical contributions include:

  - compliance obligations;
  - evidence requirements;
  - audit requirements;
  - approval rules;
  - quality constraints.



### 6.5 Technology Packs

Technology Packs contribute technology-specific engineering behaviour.

Examples:

- Java
- Node.js
- .NET
- Kubernetes
- PostgreSQL
- React

Typical contributions include:

- coding conventions;
- build standards;
- deployment practices;
- testing practices.



### 6.6 Integration Packs

Integration Packs contribute connectivity to external systems.

Examples:

- GitHub
- GitLab
- Jira
- Azure DevOps
- Jenkins
- ServiceNow

Integration Packs expose services rather than engineering behaviour.

---

## 7. Mandatory and Optional Packs

Every Pack shall declare one of the following installation classifications.

### Mandatory

Required for every commissioned SEU.

Examples:

- Core Engineering Behaviour
- Knowledge Management
- Traceability



### Recommended

Strongly advised.

The Composition Engine shall generate warnings if omitted.



### Optional

Installed only when explicitly requested or indirectly required.



### Conditional

Required only when declared conditions are satisfied.

Examples:

- HIPAA
- PCI-DSS
- Automotive Safety

The Composition Engine determines whether conditional Packs are required.



## 8. Pack Metadata

Every Pack shall define at least:

- Identifier
- Name
- Version
- Description
- Category
- Owner
- Publisher
- Dependencies
- Installation Classification
- Composition Strategy
- Supported Platform Version
- Status

Additional metadata may be introduced without modifying the Runtime Kernel.



## 9. Pack Contributions

A Pack may contribute one or more of the following.

### Engineering Behaviour

Engineering behaviour.



### Policies

Governance rules.



### Standards

Engineering standards.



### Decision Rules

Approval and authority rules.



### Ontology

Domain terminology and semantic relationships.



### Engineering Capital

Reference knowledge and assets.



### Services

Platform services.



### Reusable Components

Dashboards, reports and configuration interfaces.



### Engineering Templates

Reusable engineering templates.



### Checklists

Engineering checklists.



### Quality Gates

Validation rules.



### Review Gates

Engineering review requirements.



### Obligation Definitions

Standard obligation types.



### Engineering Metrics

Engineering metrics and reporting definitions.



## 10. Pack Dependencies

A Pack may declare dependencies upon other Packs.

Dependency types include:

- Required
- Optional
- Conditional
- Incompatible

The Composition Engine shall resolve all required dependencies before commissioning.



## 11. Pack Lifecycle

Every Pack shall transition through the following lifecycle.

~~Draft → Validated → Published → Active → Deprecated → Retired → Archived~~

*[Remarks: Lifecycle: **Draft → Validated → Published → Active → Retired → Archived**, plus a **Validated → Draft (Reject)** hop requiring a mandatory, always-new comment]* 

Historical Pack versions shall remain available for reproducing historical Engineering Behavior Models.


## 12. Versioning

Packs shall be independently versioned.

Updating one Pack shall not require version changes to unrelated Packs.

Engineering Behavior Models shall record the exact Pack versions used during composition.



## 13. Compatibility

Every Pack shall declare:

- minimum supported platform version
- maximum supported platform version (optional)
- incompatible Pack versions
- migration guidance (where applicable)

The Composition Engine shall validate compatibility before composition.



## 14. Runtime Visibility

Packs are visible to:

- Composition Engine
- Pack Registry
- Administration Services

Commissioned SEUs shall not modify Packs.

Runtime services may query Pack metadata where necessary.



## 15. Events

The Pack subsystem shall publish events including:

- PackRegistered
- PackValidated
- PackPublished
- PackActivated
- ~~PackDeprecated~~ *[Remarks: Deprecated dropped]*
- PackRetired
- PackDependencyResolved
- PackDependencyFailed
- PackRejected

## 16. Non-Functional Requirements

The Pack framework shall:

- support concurrent Pack versions
- support deterministic composition
- maintain complete traceability
- support independent evolution
- support backward compatibility where possible
- avoid Runtime Kernel modification for Pack additions



## 17. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Packs can be independently created and versioned.

✓ Multiple Pack categories can coexist.

✓ Mandatory and conditional Packs are correctly enforced.

✓ Dependency resolution succeeds for compatible Packs.

✓ Incompatible Packs prevent composition.

✓ Every Pack contribution remains traceable.

✓ New Pack categories can be introduced without changing the Runtime Kernel.



## 18. Deliverables

Implementation of this chapter shall produce:

- Pack domain model
- Pack Registry
- Pack metadata schema
- Dependency declaration model
- Version management services
- Compatibility validation services
- Pack lifecycle services
- Pack APIs
- Pack events
 
## 19. Implementation Specifics

*Recorded 2026-08-13. This section documents how the Pack Model is realised in the current build. It does not change the requirements above (PM-001–005, §§6–17); it records what is built, what is partial, and what is still open — the same convention as Chapter 1 §18 (keep the normative spec stable; capture realisation decisions separately). Status markers: ✅ built · ⚠️ partial · 🚩  not built.*

### 19.1 ✅ A Pack is a persisted row; contributions are declarative JSONB (the "Packs are Declarative" ADR, realised)

A Pack is a single `packs` row (migration `002`). Its behaviour lives entirely in a declarative `contributions` JSONB payload and a `dependencies` JSONB array — **no executable code**. At publish time `seedContributions` (`core/packs.ts`) interprets that payload into real vocabulary rows (Capabilities, Services, Authority Rules, Policies, Quality Gates, Compliance Frameworks/Requirements); the Composition Engine and the generic engines then interpret those. This is the ADR from the chapter preamble made literal: a Pack is reasoned about, validated, composed and authored (via the SDK UI) without ever executing arbitrary code.

### 19.2 ✅ Identity and immutable versioning (PM-003, §12)

Pack identity is `(code, pack_version)` (`UNIQUE`, migration `010`), not `code` alone. Each published version is its own immutable row; republishing under a new version creates a new row and transitions the previously-Active version of the same code to `Deprecated` (`publishPack`). Every EBM records the exact `packCode` + `packVersion` it composed (`compositionEngine` → `composedPacks`), so a historical EBM is reproducible (§12, §11 "historical versions remain available"). **Caveat (Ch.41 scope note):** immutability is enforced at the **Pack-row** level only — the individual contributed sub-objects (capabilities, policies, authority rules, quality gates) still upsert by their own `code`, so a re-published Pack version can mutate a shared contributed object in place. Generalising immutability to every contributed object is a known residual gap, not solved here.

**Update 2026-08-29 (CR-080):** the previously-Active version is now superseded to `Retired`, not `Deprecated` — Deprecated dropped from Pack's lifecycle entirely (§11). Same mechanism, renamed target state.

### 19.3 ✅ Lifecycle is governed by the same engine as every entity (§11)

`packs.status` carries all seven states (`Draft → Validated → Published → Active → Deprecated → Retired → Archived`, CHECK in `002`), and Pack is a first-class `TransitionEntityType` — its lifecycle runs through the same generic `transitionEngine` as Deliverables/Objectives/etc., with authority + policy declared as ordinary `transition_definitions` rows (no Pack-specific evaluation code). `createPackDraft`/`advancePackLifecycle`/`publishPack`/`transitionPack` drive the hops. Reactivation from a terminal state does **not** resurrect the old row — it mints a new version (`reactivateAsNewVersion`), preserving §12 immutability.

**Update 2026-08-29 (CR-080, owner: "Let us just use retired... Remove: Retired -> Active (reactivation) / Remove: Archived -> Active (reactivation)"):** the paragraph above no longer holds. `packs.status` now carries **six** states (`Draft → Validated → Published → Active → Retired → Archived`, migration `137`) — Deprecated dropped, confirmed by reading every call site (`findActiveByCode`, `TERMINAL_REACTIVATABLE_STATES`) that it was never actually distinguished from Retired at runtime. Reactivation from a terminal state (`reactivateAsNewVersion`) is **removed entirely**, not preserved — once Retired or Archived, a Pack Version is permanently done; `copyPackAsNewDraft` (Registry "Copy") is the only way to carry its content forward, and it lands in Draft, not Active. New: `Validated → Draft` (Reject), requiring a mandatory, always-new comment (`pack_comments`, migration `137`) — mirrors Objective's CR-073 discipline, not its target state (owner: "Validation validates against packs' schema. Objective has no schema" — Pack's own schema validation is what makes "send it back to Draft to fix" a meaningful destination, unlike Objective's own distinct `Reject` status). See §11, §15, §19.11's authority table below (also updated).

### 19.4 ✅ Contributions — structured & schema-defined; every kind's design now closed against its governing chapter (§9; CR-016; CR-058; CR-059; CR-060; CR-061; CR-062; CR-064; CR-065)

Contributions are no longer an opaque JSON blob. The Pack grammar declares each kind as a **flattened, structured list** (`contributionCapabilities[]`, `contributionServices[]`, `contributionAuthorityRules[]`, `contributionPolicies[]`, `contributionQualityGates[]`, `contributionChecklists[]`, `contributionReviewGates[]`, `contributionObligationDefinitions[]`), so the form and validation follow from the validator (CR-016). At publish they are reassembled into `PackContributions` (`seuTypes.ts`) and persist in `packs.contributions` (JSONB).

- **Built (Pack-contributable):** Capabilities; Services; Authority/Decision Rules; Policies **and** Standards (`constraintType`); Quality Gates; **Checklists; Review Gates; Obligation Definitions** (new — CR-016); **Engineering Behaviour, Engineering Metrics, Reusable Components, Engineering Templates** (new — CR-082, unified under one `contributionEngineeringCapital[]` kind, minimal stub — see below).
- **Compliance Frameworks + Requirements — removed, not built.** The raw-JSON `contributionsCompliance` field this line used to describe was *meant* to be replaced 2026-09-01 by a code-only `contributionComplianceCodes[]` (referencing an existing Compliance Pack's own `compliance-name` code, migration 145) — but 145 was never actually applied to the live database (confirmed 2026-09-05: `contributionsCompliance` was still live with its original raw-JSON shape; `contributionComplianceCodes` had never existed at all — a migration *file* existing in the repo isn't the same as it having been run). Both are now genuinely removed (migrations 169 and 170): Compliance is already a real, first-class Pack category (§6.4, 33 real `compliance-*.pack.json` Packs), and the real mechanism for "which Compliance Packs apply" is Template's own category-scoped `compliancePackCodes[]` (mandatory) / Profile's own (optional) — picking the whole Pack, not a second, redundant reference to its category tag from inside an unrelated Pack. Owner: "We have made compliance a type of pack and this will be added in the templates packs." Zero real Pack ever populated either shape.
- **Verifiable items** (checklist item, quality-gate criterion, review requirement, obligation) carry their own §20 fields — `statement`, `classification` (machine-verifiable / judgment / human-attested), `externalEvidence`, `prompt`, `participant`, `outputContract`, `assurance` — **per item** (a checklist can hold a machine-verifiable *and* a judgment item). Engineering Capital items carry neither — not classified, inputs/assets rather than checks (`tbi.md`'s own §9 note).
- **Still not Pack-contributable:** Ontology, Knowledge Assets (§9's own separate "Engineering Capital" subsection — unrelated to CR-082's `EngineeringCapital` contribution kind despite the shared name, see below), and Templates (a separate top-level entity that *references* Packs).
- **Materialisation caveat:** `seedContributions` materialises Capabilities/Services/Authority Rules/Policies/Quality Gates/Review Gates/**Checklists** (Review Gates added by CR-059, Checklists by CR-060, see below) into their tables. Obligation Definitions and the §20 fields still live in `packs.contributions` (JSONB) **only** — for the §20 fields, because nothing consumes them yet (§19.14 execution); for Obligation Definitions specifically, CR-062 settled this as a deliberate, permanent choice, not a temporary gap — unlike Checklist/Policy, nothing else on the platform needs to cross-reference a specific Obligation Definition by id, so there's no real Definition table to materialise into at all.
- **Quality Gate contributions now carry Chapter 26 §8's own structure — ✅ built (CR-058, 2 follow-ups, form redesign — all 2026-08-22).** `contributionQualityGates[]` renders as a real repeatable-card form (the same generic `referential-list` widget as the Template Deliverable Catalogue, not raw JSON). Its schema exposes an Ontology-backed `category` (`category:evidence` — reused directly; a first attempt at a standalone `category:quality-gate` vocabulary was superseded the same day, see Ch.26 §19.4), a `transition_definitions`-sourced `governedTransition` picker (a Pack may only attach a gate to a transition that already exists — `validatePackSeed` checks it resolves), 4 named criteria types including a Required-Policies type, and — outside the authored form, since neither is Pack-author-facing — badge-gated Waiver Rules (`quality_gate_waivers`, `qualitygate_waive`) and a Quality Gate version independent of the contributing Pack's own (`(entity_type, from_state, to_state, category, version)` identity, new row per version). Deliberately kept to one criteria type per gate, no generic AND/OR — composite logic resolves once, inside participant execution, before the gate ever runs.
  - **`code` was removed from the form entirely** (owner: "the code isn't a UUID or a freeform Pack-specific string — it's the category identifier itself") — `category` now doubles as the gate's own identity; `qualityGatesDB.upsert` sets `code = category` server-side, no author input at all.
  - **Form redesign** (owner: "the form is very very poorly designed"): field order is now deliberate (Category → Name → Governed Transition → Criteria Type → Criteria Category → Required Policy Code → Participant → Assurance → Classification → Output Contract → External Evidence → Description → Prompt, no longer whatever order happened to fall out of the schema), Category/Name/Governed Transition/Criteria Type are real required fields (asterisk + HTML `required`, edit mode only), `statement` labels as "Description," and every field carries its own inline help (replacing the once-per-section write-up, now suppressed for this section specifically since it's redundant). Building this surfaced a platform-wide latent bug, not scoped to Quality Gates: **Postgres JSONB does not preserve object key insertion order** — it reorders keys by length then lexicographically — so field order was never actually controllable via how a migration writes `items.properties`, for *any* `referential-list` field in this codebase. Fixed generically via a new `x-property-order` schema marker (`formGenerator.ts`'s `generateFields` sorts `itemFields` by it) rather than patched locally.
  - **Seed/reset gap, confirmed separately**: `platform-core-engineering`'s own 2 real Quality Gates have no working bootstrap path — the seed script that used to publish this Pack (`seedSeu.ts`) was deliberately retired, and a validation rule added afterward (`validatePackSeed`'s `capability-name` check) now permanently rejects this Pack's own `code` from ever being republished, by any path. Tests needing these gates now create them directly (`tests/testFixtures.ts`'s `ensureCoreEngineeringQualityGates`, same idempotent-fixture discipline as the adjacent Template/Profile one) rather than assuming ambient seed state — owner: "the test scripts have to be aligned to the changes we make every time."
  - **Review Gates — ✅ built (CR-059, 2026-08-22).** `requires_accepted_review`'s narrowing field is no longer free-text `criteriaCategory` — it's `deliverableName`, a self-referential picker (`x-referential: "self:contributionReviewGates"`) scoped to this *same Pack's own* declared `contributionReviewGates[]` entries, any transition. At publish time (`core/packs.ts`) it resolves through a `reviewGateIdByCode` map to a real `review_gates.id` and is stored in the gate's `criteria` as `{type, reviewGateId}`; at evaluation time (`qualityGateEngine.ts`) it's a strict FK check (`r.review_gate_id === reviewGateId`) against an Accepted, qualifying-outcome `reviews` row — not a string/category comparison.
  - **`contributionReviewGates[]` gained real structure of its own** (migration `098_review_gate_form_structure.sql`): `code` (mandatory, Ontology-backed via the `deliverable-name` concept type — the same referential picker Template's own Deliverable Catalogue already uses; stays *visible* on the form, unlike Quality Gate's own code=category collapse — owner: "it should show up on the form"), `name` (mandatory, distinct from `statement`/Description, closing Ch.25 §8's Name gap), `governedTransition` (mandatory, `transition_definitions`-backed, same discipline as Quality Gate's own).
  - **New `review_gates` table** (migration `097_review_gate_table.sql`; `reviewGatesDB.ts`, upsert mirrors `qualityGatesDB.ts`'s versioning): `(entity_type, from_state, to_state, code)` active-slot partial-unique index, new row per real content change. No `category`/`criteria` columns — a Review Gate carries no union-composition problem across Packs the way Quality Gate's category does (owner: "a review is a single reviewer's verdict on one specific deliverable version").
  - **`reviews.review_gate_id`** (nullable FK, same migration) links a real Review back to the Review Gate it was produced against — closing the corruption risk a category/string match alone couldn't ("the same deliverable type reviewed at more than one transition" was unresolvable by string match).
  - **`reviews.category` itself is untouched** — still free text, no Ontology backing, no `assertCanonicalCategory` call anywhere in `core/reviews.ts` (confirmed live). That gap wasn't closed by giving `category` an Ontology type; it was closed by removing category from the job entirely — `deliverableName`/`review_gates.code` (Ontology-backed via `deliverable-name`) is now the real disambiguating key `requires_accepted_review` matches on, so `category` never needed fixing for this purpose. See Ch.25 §19.4/§19.10.
  - **Checklists — ✅ built (CR-060, 2026-08-23; Ch.47 Checklist Model).** `contributionChecklists[]` was the last raw-JSON contribution kind in this list, and the only one with no governing model chapter at all until the owner pointed to Chapter 47 directly — its schema had drifted so far from the real seed data that the schema's own declared identity field (`checklist`) was populated by *zero* of the 22 real Pack files that used this contribution kind (all 22 used an undeclared `code` field instead, kept working only by a display-heuristic coincidence in `formGenerator.ts`'s `rowHasContent`). Rebuilt as a real, two-level structure: a Checklist (Name/Description) contains its own repeatable `items` sub-list (Statement/Mandatory-or-Recommended/Participant/Output Contract/Assurance/External Evidence/Prompt — Classification dropped, owner: "Participant can be used. Classification can be dropped."). Materialises into a new `checklists` table (`checklistsDB.ts`) — real and persisted, but deliberately without Category/Capability/Applicable-Deliverable-Type/Applicable-Transition or any version/lifecycle of its own (Ch.47 §8/§16, as the owner edited that chapter directly during this CR's design discussion): a Checklist's own scope is now fully carried by whichever Review Gate(s) or Quality Gate(s) reference it via their own new `checklistIds` array field (real ids, AND within one gate's list, a Checklist shared across gates runs once — Ch.47 §14/§15), not declared on the Checklist itself. Checklists are cross-Pack referenceable by real id, scoped to Packs sharing the referencing gate's own Pack `code` — corrected the same day from an initial over-broad "any Pack, unconditionally" build (owner, catching it against the live form: "any Pack's gate can point at any Pack's checklist - i thought we said this is if the pack codes match. If checklists are global, then we would have created a registry?") — a genuine departure from Review Gate's own same-Pack-only precedent (CR-059's "if something is global, it has to be a policy" scoping) but not the fully unconstrained reach Policy itself was first described as having either; CR-061 later confirmed Policy's own reach is scoped identically, for the identical reason (neither entity has a real registry, §16/§20 and Ch.24 §18 respectively). `checklists.id` stays stable across every republish of the same Pack (`checklistsDB.upsert`, keyed on `(originating_pack_id, name)` — owner: "It stays... Someone wants to update the checklist with a new item, they can without a version change"), confirmed live by republishing the same real Pack twice with no id change.
    - **Two new SDK-authoring-form capabilities, neither reused from Quality/Review Gate's own widgets**: a nested repeatable list (`formGenerator.ts`'s new `"nested-list"` item-field kind — the first two-level `referential-list` in this codebase, Checklist's own `items` inside one Checklist card), and a same-code-scoped multi-select referential picker (`"referential-multi"`, `checklistIds`'s own `<select multiple>`, sourced via a dedicated `checklistOptions` local, not the generic flat `referentialOptions` map every single-value referential field before this used — CR-061 reused this same capability for Policy's own `requiredPolicyCodes`, unchanged).
    - **Execution (Ch.47 §11-12) stays fully out of scope** — owner: "Pack are declarative. They only define the checklist... The execution aspects come into picture only during seu commissioning." No Participant runs a Checklist's items yet; nothing consumes `mandatory` to compute a baseline outcome; a Checklist's own produced-Evidence Category (needed once execution exists) is an open question Ch.47 §12/§13 now flag explicitly, not silently assumed.
    - **All 22 real Pack seed files updated in the same change** (same-Pack-only, per the owner's own settled constraint: "It cannot. So there has to be some meaningful minimum checklist for the seedpacks" — a raw seed JSON file can't express a cross-Pack `checklistIds` reference before real database ids exist) — `db:clean-slate` re-verified running clean end to end afterward, all 22 Checklists materialising with real content.
  - **Policies — ✅ built (CR-061, 2026-08-23; Ch.24 Policy Model).** The last raw-JSON-style contribution kind on this list, and the one furthest from its governing chapter: unlike Quality Gate/Review Gate/Checklist, Policy's *foundation* didn't work, not just its structure — `governedTransition` was confirmed write-only (`policiesDB.upsert` stores it; nothing but a display list ever read it back), real attachment to a transition happening entirely through a separate, non-Pack-authorable file (`transitionDefinitions.json`'s own `requiredPolicyCodes`, resolved into `transition_definitions.required_policy_ids`). A Pack-contributed Policy's own declared scope did nothing. Fixed to the same field shape Quality Gate/Review Gate already use (a real, `transition-definition`-backed picker) — **definition-side only**, per the owner's own scoping principle for this whole CR: "anything in the pack like a policy, review gate etc has a definition part and an execution part... the execution aspects come into picture only during seu commissioning... we are not addressing this here." The engine still doesn't consult it dynamically; that stays exactly as inert as before, deliberately.
    - **Identity, same treatment as Checklist**: `policies_code_key` (bare, cross-Pack-unique) dropped for `(originating_pack_id, code)` — owner: "it is not global so no versioning required similar to checklist." No version/is_active added; `id` stays stable across a republish of the same Pack.
    - **Category — new Ontology concept type `category:policy`**, seeded from Ch.24 §7's own 7 values, real dropdown — owner: "category should be ontology driven... Seed these categories as category:policy." Confirmed fully independent of any referencing Gate's own category: "It does not change the policy category. So I can have a customer sign off policy category across any gate category." **Build-time discovery**: this concept type already existed, seeded by migration 030 (long before Policy had any real design) with 10 stray junk values matching nothing real — cleaned up both live and at the source.
    - **Quality Gate's `requires_active_policy` generalizes, Policy itself gains no reciprocal reference**: `requiredPolicyCode` (one) → `requiredPolicyCodes` (a list, all must be satisfied) — owner, after an initial wrong-direction guess: "Gates have policies, not the other way around." Cross-Pack reach scoped to matching Pack `code`, identical rule and identical reasoning to Checklist's own corrected reach (owner: "Similar to checklist, if the pack code matches, that policy has to be visible to all other packs").
    - **`condition` becomes a real authored field**, starting with the 2 types already evaluated (`always_true`/`field_in`) — owner: "we will start with this, but... we will refine this as we go along with corresponding code changes." Required Evidence and Related Obligations (Ch.24 §8) resolve into this same generic mechanism rather than becoming their own fields — owner: "if a quality gate refers to evidence, then there can be a policy [related] to evidence saying at least 90 percent of evidence is present" — Policy stays fully domain-agnostic.
    - **Exception Rules (§12) need no new mechanism at all** — fully covered by the existing Constraint Type "Standard" (owner: "policy waiver is designed as standard through constraint type"), explicitly distinct from Quality Gate's own, untouched Gate waiver mechanism (owner: "Gate waiver is different from evidence waiver").
    - **Conflict detection (§10) stays untouched, deliberately** — owner: "let us resolve this when we get to composition engine. it is not a definition question."
    - **None of the 22 real clean-slate-exercised Pack files declare any Policy** (confirmed directly) — nothing to migrate there. The 3 files that do (`core-engineering.pack.json`, `technology-nodejs.pack.json`, `domain-ebook-library.pack.json`) sit outside `db:clean-slate`'s own reseed path entirely, same "confirmed dead" status CR-058 already established for `core-engineering.pack.json` specifically — updated for consistency, not end-to-end validated (a separate, pre-existing blocker on their own Pack `code`).
  - **Obligation Definitions — ✅ built (CR-062, 2026-08-23; Ch.23 Obligation Model).** Unlike Checklist/Policy, this closes without a real materialized table at all — Chapter 23's own pre-existing §19 audit found no other entity ever needs to cross-reference a specific Obligation Definition by id, so a real table would earn nothing. `contributionObligationDefinitions[]` stays a JSONB declaration, corrected to match Ch.23 §7/§10: `obligationType` (free text, unclear purpose against the chapter) dropped entirely, replaced by two real Ontology-backed fields — `category` (`category:obligation`, already a real, working precedent per the chapter's own audit, just never wired into the authoring form; 4 missing values from §7 — Risk, Audit, Operational, Customer — seeded alongside the 5 already live) and `origin` (`category:obligation-origin`, a brand-new concept type seeded from §10's own 11 named Obligation Sources — the first real mechanism FR-23.5's "origin shall remain permanently recorded" ever had, though still a categorical declaration of *which kind* of source, not a relational FK back to a specific raising entity).
    - **Priority, Completion Criteria, and the five "Related *" fields (§8) — settled out of scope, execution-side**, same definition/execution boundary as Policy/Checklist: a Definition can't know in the abstract which real Deliverable/Decision/Evidence/Policy/Authority-Rule a future instance will relate to, and Completion Criteria specifically can't be meaningfully predefined either — owner: "there is no way you can predefine [this] unless you get to the point where it can be identified... whoever is opening an obligation during seu execution will have to specify this." Related Risks is moot regardless — no Risk entity exists anywhere in the codebase.
    - **Zero real Pack seed files declare `obligationDefinitions` at all** (confirmed directly, none of the 22 clean-slate-exercised files or any other Pack JSON in the repo) — nothing to migrate; `db:clean-slate` re-verified running clean end to end afterward.
    - **Obligation's own named lifecycle events (§19.12, Ch.23 §15 — 2 of 8 real) split out as CR-063**, not folded into this CR — a raised Obligation instance's own event emission is runtime/lifecycle behaviour, not Pack-authoring.
  - **Services — ✅ built (CR-064, 2026-08-24; Ch.11 Service Model).** The last contribution kind in this list to leave the pre-CR-058 raw shape. Chapter 11's own first-ever audit (§18, filed alongside CR-064) found the chapter's own central claim already functionally real but not author-facing: the Dependency Engine's `"Capability"`-typed dependency is internally resolved by matching a real `services.code` (not a Capability's own identity) — deliberately left exactly as found (owner: "I do not understand CR042's relevance" — Dependency Graph authoring territory, Ch.9, not this CR's job). What did get built: **identity and versioning**, same treatment as Checklist/Policy's own corrected identity plus Quality Gate's own real versioning — `code` is now Pack-scoped (`(originating_pack_id, code, version)`, was a bare global unique) **and** Ontology-backed (new, freely-extensible concept type `service-name`, the `capability-name`/`feature-flag` pattern) — owner: "service code will be unique within a pack and not unique across packs... They have to come from the ontology layer... This service code turn-around-time-high can be declared in development pack and deployment pack with different service levels." `version` is real now too (`"1.0"`-style, bump-on-real-change, a new immutable row per version, mirroring `qualityGatesDB.upsert` exactly) — owner: "Versioning is definition side." **Service Level** (§8, SVC-004) — previously a real column with a real, working consumer (`dispatchEngine.ts`'s SLA-driven Work Item deadline) but no way to ever populate it — is now a real nested `serviceLevel[]` sub-list (Checklist's own `"nested-list"` mechanism, CR-060), `{label, target}` generic pairs rather than four hardcoded fields, since the owner's own worked example used varying per-item keys a fixed schema can't hold directly. **Consuming Capabilities** (§7) confirmed dropped, not built — owner: "we can get this information by querying" `dependency_definitions` directly. Composition Engine involvement (§12), the chapter's own 6-state `status` lifecycle (§13, distinct from the real versioning that *is* now built), Telemetry integration (§11), and the 9 named Events (§14) all stay exactly as unbuilt as the audit found them — none were this CR's job.
    - **Scale, unlike every prior CR in this series**: unlike Policy/Obligation Definitions (zero real usage), Services are declared by all 22 clean-slate-exercised Pack files plus the 3 non-exercised ones — 124 real, distinct codes. Every one was seeded directly into the new `service-name` concept type so the new Ontology-backed validation doesn't reject anything already real; `db:clean-slate` re-verified running clean end to end, all 122 live Services (122 of the 124 codes are exercised by clean-slate's own 22 files) passing through the new versioned upsert at `version='1.0'`.
  - **Capabilities — ✅ built (CR-065, 2026-08-24; Ch.10 Capability Model).** The last contribution kind in this list to leave the pre-CR-058 raw shape. Chapter 10's own first-ever audit (§18, filed and revised the same day alongside CR-065 — the owner corrected several early findings) confirmed the owner's own framing precisely: **Capability's lack of independent lifecycle/versioning is deliberate, real design, not an absence** — no `status` column, but Pack already publishes a complete, real, named lifecycle-event set (`PackRegistered/Validated/Published/Activated/Deprecated/Retired/Archived`) Capability rides on. Stability is real too, not incidental — `sdkAuthoring.ts`'s `canEdit = canDefine && isDraft` gates the only real write path to Draft-status Packs only. **What did get built: identity and versioning.** `code` is now Pack-scoped (`(originating_pack_id, code)`, was a bare global unique — the same fix Checklist/Policy/Service already got, confirmed to touch nothing else since all 8 downstream FK tables reference the stable `id`, never `code`) — owner: "This is already implemented in pack model." `version` is now real too — not independent, a denormalized copy of the owning Pack's own `pack_version`, kept in sync on every upsert — owner: "capabilities.version just copies over the pack's version." **Structure (§8) settles small**: Category dropped entirely (owner: "code already carries the required intelligence" — no replacement, no new concept type); Supported Participant Types dropped (already modeled at a finer grain, on each verifiable item's own `classification`); Success Criteria dropped (already fully expressed by the existing Policy + Quality Gate pairing); Inputs/Outputs/Required Knowledge/Expected Deliverables all dropped (owner: "determined at template authoring and not at capability authoring"). Net: Capability's real Structure is just **Identifier, Name, Description** — 3 of the chapter's 10 named fields, with every other one mapping onto a mechanism that already exists elsewhere in the platform, at a more appropriate grain. **Deferred, not this CR's job**: Capability Relationships' partial semantics (only `required` has real behaviour, zero circular-dependency detection) split out as **CR-066** (shared platform-wide Pack-dependency/Composition Engine infrastructure); `CapabilityRequested`/`Unavailable`/`Released` deferred to whenever execution-side Capability work is picked up; the Obligation→revised-Capability-version automation acknowledged as real and explicitly deferred, not scheduled anywhere yet.
    - **Scale**: `category` stripped from all 28 Capability declarations across the 25 Pack JSON files that had it (22 clean-slate-exercised + 3 non-exercised); `db:clean-slate` re-verified running clean end to end, all 30 live Capabilities landing through the new Pack-scoped upsert with `version` correctly copied from each owning Pack's real `pack_version`.
  - **Series closed, 2026-08-24.** Every kind in `contributionCapabilities[]` through `contributionObligationDefinitions[]` has now been audited against its own governing chapter, had its design settled, and been built — the same discipline CR-058 started against Chapter 26 now covers the whole §19.4 list: Quality Gates (CR-058), Review Gates (CR-059), Checklists (CR-060), Policies (CR-061), Obligation Definitions (CR-062), Services (CR-064), Capabilities (CR-065) — all ✅ built. Authority/Decision Rules was never part of this series — confirmed legacy, pre-noun×verb, deliberately not the platform's own recommended mechanism for new Packs (`formGenerator.ts`'s own help text), not a live gap needing this treatment. Two follow-ups spun out along the way, tracked separately: CR-063 (Obligation's own named lifecycle events) and CR-066 (Pack dependency-type semantics + circular-dependency detection, split from CR-065).
  - **Engineering Behaviour / Engineering Metrics / Reusable Components ("User-Interface Components" above) / Engineering Templates — ✅ built (CR-082, 2026-08-30).** Reopens this "closed" series for the four §9 kinds it never covered — confirmed still-not-Pack-contributable when CR-082 was raised. Built as one unified contribution kind, `contributionEngineeringCapital[]`, not four separate schema fields — owner: "Just say EngineeringCapital... Type will be Engineering Behaviour / Engineering Metrics / Reusable Components / Engineering templates etc." Minimal stub, deliberately: `type` (Ontology-backed, new freely-extensible concept type `engineering-capital`, migration 141) + `url` (plain text) only — no §20 verifiable-item fields, since these are inputs/assets, not checks (`tbi.md`'s own §9 classification note). Richer per-type structure stays explicitly deferred, owner: "these should be in details later." **Naming note**: this reuses the name of §9's own separate, pre-existing "Engineering Capital" subsection ("Reference knowledge and assets" — §19.4's "Knowledge Assets," still not built) — owner's own choice of container name, not a claim that CR-082 also built that one; the two remain distinct. Also confirmed distinct from the platform's own first-class Template entity — owner: "Template Entity this app defines is not the same as Engineering Templates. Completely unrelated."

### 19.5 ✅ Metadata coverage (§8; CR-018)

`packs` carries the §8 set: Identifier (`id`/`code`), Name, Category, Version (`pack_version`), Status, Installation Classification, Dependencies, Contributions, and — added by CR-018 — **Description, Owner, Publisher, Composition Strategy, Supported Platform Version** (plus the §13 compatibility fields, §19.9). These live in a `packs.metadata` (JSONB) column, authored on the form and validated for shape. **Declaration only:** Composition Strategy is recorded but composition still applies the fixed "later-overrides-earlier" (Override) strategy (§19.7/§19.8); `owner`/`publisher` are free text (no Identity linkage yet).

### 19.6 ✅ Taxonomy is data-driven (§6/§17; CR-015)

Pack categories are **data**: a `pack_category` table (code / label / `is_active`, same discipline as `authority_nouns`) holds them, the hardcoded `packs.category` CHECK is dropped, and category is validated in code against active rows. The Pack grammar's `category` is a **referential select** sourced from the table, so a **new category is a data insert** that flows to the form with no code change — closing §16/§17's "new Pack categories without changing the Runtime Kernel." (The same treatment CR-006 gave the authority noun vocabulary.)

### 19.7 ⚠️ Installation classification is recorded; composition-time enforcement is partial (§7)

`installation_classification` stores all four values (Mandatory / Recommended / Optional / Conditional), but **composition membership is driven by the Template and Profile, not by the classification column**: `compositionEngine` composes the **Template's mandatory Pack set** + the **Profile's optional Pack set** (`templatesDB.getMandatoryPackCodes` / `profilesDB.getOptionalPackCodes`). Consequences vs §7: "Mandatory = required for *every* SEU" is realised as "in the Template's mandatory set," not as an automatic platform-wide inclusion of every Mandatory-classified Pack; **Recommended** does not yet emit an "omitted" warning; **Conditional** conditions are not evaluated. The classification is today closer to descriptive metadata than an enforced composition rule.

### 19.8 ✅ Composition conflict detection stands in for "Incompatible Packs prevent composition" (§17)

Composition is deterministic (`002`/Ch.4): a resolved Pack with no Active version is **excluded with a warning** (never silently dropped), and a Pack contributed more than once is resolved by the **Override** strategy (later wins, with a warning). Genuine **cross-Pack governance conflicts** — two different Packs assigning different authorised roles to the same transition, or two Packs contributing a Quality Gate to the same `(entityType, fromState, toState)` — are detected by `detectGovernanceConflicts` and **block commissioning** (FR-3.6 / FR-21.7) until resolved. This is how "incompatible Packs prevent composition" (§17) is realised in practice. The declared **Incompatible dependency type** (§10) now exists on the validator (CR-018) but is **not yet enforced** at composition (§19.9).

### 19.9 ⚠️ Dependencies, compatibility, and dependency events — declared; enforcement ***open*** (§10, §13, §15)

- **Dependencies (§10).** The `dependencies` JSONB now declares the full type set — **`required` / `optional` / `conditional` / `incompatible`** (CR-018) — and `validatePackSeed` resolves *required* deps at author time. But there is still **no transitive dependency resolution at composition** — composition uses the Template/Profile Pack sets (§19.7), not each Pack's declared dependencies; optional/conditional/incompatible are recorded, not acted on. ***Enforcement open.***
- **Compatibility (§13).** The **fields are now declared** and stored (CR-018): `supportedPlatformVersion`, `minSupportedPlatformVersion`, `maxSupportedPlatformVersion`, `incompatiblePackVersions`, `migrationGuidance`. But nothing **validates** compatibility at composition, and there is no platform-version concept to compare against yet. ***Enforcement open.***
- **Events (§15).** Lifecycle events are published, one per hop (`PackRegistered` on draft creation; `PackValidated / PackPublished / PackActivated / PackDeprecated / PackRetired / PackArchived` on transition). **`PackDependencyResolved` / `PackDependencyFailed` are not published**, consistent with dependency resolution not being built. ***Open.***

### 19.10 ✅ Traceability of every contribution (PM-005)

Every contributed vocabulary row carries an `originating_pack_id` FK back to `packs(id)` (capabilities, services, authority_rules, policies — `002`; governance depth — `006`; metric_definitions — `017`; compliance — `029`). A contribution is therefore always traceable to the Pack (and, with §19.2's versioned row, the Pack *version*) that introduced it. This FK is also what `db:clean-slate` keys on to keep base-Pack vocabulary while removing test-fixture Packs.

### 19.11 ✅ Packs are authored entity-direct; the validator is the single source of truth (§14; CR-015/016/017; entity-direct authoring corrected 2026-08-17, folded into CR-014)

Pack, Template and Profile are the three entity-direct-authored kinds (`schema_definitions` entity kinds `Pack`/`Template`/`Profile`; the `/aisworg/seu/sdk/{pack,template,profile}-authoring` surfaces — Transition Definition is authored through its own noun × verb form instead, CR-019, not this pipeline). Authoring is **entity-direct**: a Draft row of the entity itself (`createAuthoringDraft`), edited in place (`saveAuthoringDraft`), and driven through §19.3's governed lifecycle **one governed hop at a time** (`publishAuthoringDraft`), each hop under the **real session actor**, gated on that hop's own `{kind}_<verb>` badge. There is no bootstrap SEU, no Deliverable indirection, and no system actor standing in for the author — a bug fix correcting CR-014 (2026-08-17; see [[every-transition-real-actor-and-badge]]), which had wrapped authoring in exactly that indirection to dodge a perceived double-gate. The **versioned schema validator** (`schema_definitions`) is the single source of truth: the form is generated *from* it (`formGenerator`) and every submission **and JSON import** is validated *against* it (`validateAgainstSchema` — hard-reject on import, warn-not-block on incremental save; CR-015). A Pack's `code` is a **system UUID**, not a hand-typed field (CR-015). And the **validator itself is now authored in a form**, not raw JSON — the schema registry generates its form from a constrained *meta-schema* and compiles the authored field list to the stored JSON Schema (CR-017; raw-JSON kept as an "Advanced" path for nested shapes). Net: adding/changing a Pack/Template/Profile field is a governed, form-driven change to the validator — the form and validation follow.

### 19.12 ⚠️ Relationship to Chapter 1 §10 (Objective → Capability derivation)

Chapter 1 §10 envisages required Capabilities being **derived** from Objective content "using Capability Packs (Chapter 5)." A Pack **does** contribute Capability *definitions* today (§19.4), but the Objective-content-to-Capability **derivation mechanism** itself is not built (only explicit declaration + a word-overlap suggestion heuristic) — tracked as **CR-011**. The Pack side (a place for contributed Capabilities to live, traceably) is ready; the derivation step that would consume it is the open half.

### 19.13 ✅ Pack authority — badge-based (noun × verb), no Pack-specific code

Pack authorisation rides the CR-006 `noun × verb` badge model with **zero Pack-specific code**, exactly as Objectives do (Ch.1 §18.10). `Pack` is a noun; every Pack transition carries a verb (`authorityVocabulary.json`); `transitionPack` calls `transitionEngine.evaluate({ entityType: "Pack", …, actorId })` with the same shape as `transitionObjective`/`transitionDeliverable`. The engine derives `requiredBadge = pack_<verb>` and asks `badgeAuthorityEngine.authorise` — root bypass, or the actor holds that Active badge. Every hop runs under the real actor, never a system bypass — two callers, two shapes, over the same `transitionPack` + badge check:

- **Batch (seed / CLI / direct publish).** `publishPack → advancePackLifecycle` chains every hop from `Draft` through to `Active` in one call — the caller must hold every verb the chain needs (root, or a seed/CLI actor granted the full set).
- **Interactive authoring** (`/aisworg/seu/sdk/pack-authoring`). `publishAuthoringDraft → advancePackOneStep` runs **exactly the next hop** off the Draft's current status per call, gated on only that hop's badge. This is what makes real separation of duties possible: a `pack_validate`-only holder can move a Draft to `Validated` and stop there; a *different* actor holding `pack_publish` takes it from there, and so on — no single actor needs the union of every verb just to touch a Draft. **Bug fix correcting CR-014 (2026-08-17):** the authoring UI used to chain the *whole* remaining pipeline in one action, so only an all-verbs holder (e.g. a `pack_all` fixture) could ever move anything past `Draft` — the per-verb badge table below was true of `publishPack` but silently false of what a real single-verb author could do through the UI. The authoring surface's per-verb tabs (`buildAuthoringTabs`) are the direct UI expression of this table — one tab per verb the actor holds ("Active Packs", "User defined Packs", "User reviewed Packs", …, however many verbs the noun has), each showing what's currently sitting at that verb's stage, scoped to what *this actor themself* did (via the events accountability record, [[every-transition-real-actor-and-badge]]) — except the live Active catalog, which shows the whole registry.

Per-hop badges (updated 2026-08-29, CR-080 — `pack_deprecate` retired along with `Deprecated` itself; terminal → Active reactivation removed, not just renamed; `pack_reject` added for the new `Validated → Draft` hop, migration `137`):

| Transition | Badge |
|||
| Draft → Validated | `pack_validate` |
| Validated → Published | `pack_publish` |
| Validated → Draft (Reject) | `pack_reject` |
| Published → Active | `pack_activate` |
| Active → Retired | `pack_retire` |
| Retired → Archived | `pack_archive` |

**Pack *creation* follows the same uniform model as every entity (Ch.1 §18.10), and is not a Pack-specific gap.** `createPackDraft` (the birth into `Draft`) is not badge-gated today only because the platform-wide **`define` birth transition ("create-as-transition") is not yet wired for any entity** — a deferred, already-modelled step, not an omission. When it lands, `transitionEngine` derives `pack_define` and gates creation through the same engine, with no Pack-specific code. (`define` = birth into the initial state, distinct from `create` = "begin work — move out of the initial state.")

**Granting** the `pack_*` badges (who holds `pack_publish`, etc.) is the same separate grant concern as `objective_*` — today root bypasses and the `tester-all` fixture holds every `noun_verb`. (Legacy detail: the denial message interpolates `gate.authorityRuleCode`, a pre-CR-006 field name that now carries the `pack_<verb>` badge code.)

### 19.14 ⚠️ Executable contributions & verification classification (§20) — declaration built (CR-016); execution ***open***

§20 defines a model in which every *verifiable* Pack contribution (a checklist item, a quality-gate criterion, a review requirement, an obligation) carries its own execution: a **Statement**, a **Classification** (machine-verifiable / judgment / human-attested), a **Prompt**, a **Participant assignment**, an **Output contract**, and an optional **Assurance policy**. The **declaration half is now built**; the **execution half is open**.

**Substrate (reused, not rebuilt):** the Quality Gate engine — including `requires_accepted_review` and `requires_accepted_evidence_or_approved_decision` (`qualityGateEngine`); the Review Model (`027`/`028`; `reviewsDB`/`findingsDB`); Evidence; Obligations; Attention Items; participant dispatch/execution. These remain the landing zones for execution.

**A — Declaration schema — ✅ built (CR-016 / §19.4).**
- **A1** ✅ Verifiable-contribution metadata (`statement`, `classification`, `prompt`, `participant`, `outputContract`, `assurance`) is on the grammar + `PackContributions`, **per item**.
- **A2** ✅ The three classes + the optional `externalEvidence` marker are modelled.
- **A3** ✅ **Checklists, Review Gates, Obligation Definitions** are now Pack-contributable.
- **D1** ✅ The classification-pass authoring UX exists — each verifiable row has classification/participant/output-contract dropdowns, an external-evidence checkbox, and prompt/assurance inputs (via the CR-017-extended `formGenerator`). *(Storage is declaration-only: values persist in `packs.contributions` JSONB; not materialised into tables.)*

**B — Execution bindings — ***open***** (turn a declared item into an executed check; reuse the built engines):
- **B1. Machine-verifiable.** Dispatch the item's `prompt` to its assigned AI participant, capture `Passed/Failed` + notes as **Evidence**, and let the Quality Gate consume it (§20.1/§20.6). *contribution → dispatch → evidence* wiring unbuilt.
- **B2. Judgment.** A judgment item produces a **Review** (AI assessment) a human accepts, gated by `requires_accepted_review` (§20.3). *contribution → Review* generation unbuilt.
- **B3. Human-attested.** Wire the item to an authority-gated **Obligation**/Review whose acceptance is the attested act (§20.3). *contribution → obligation* binding unbuilt.

**C — Extensions — ***open*****:
- **C1. External evidence via Integration connectors** — machine-verifiable items verified by an Integration-pack connector (CI green, deploy succeeded) rather than artifact analysis (§20.4). Field (`externalEvidence`) exists; the connector-as-verifier path is unbuilt.
- **C2. Assurance policy / confidence escalation** — the `assurance` field exists; the threshold-driven escalation of an AI result to a human via Attention/Review (§20.2) is unbuilt.

*(§19 remains the single backlog for §20; the remaining CRs are opened from B/C.)*