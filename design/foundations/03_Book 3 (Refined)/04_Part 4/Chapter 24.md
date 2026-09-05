
# Chapter 24 – Policy Model

[Sudha: While writing this chapter, I realised there is a clean separation between the governance concepts we've defined:

|Concept|Responsibility|
|---|---|
|**Engineering Behavior Model**|Defines how engineering is performed.|
|**Policy**|Defines what constraints apply.|
|**Authority**|Defines who may authorise governed actions.|
|**Obligation**|Defines outstanding engineering commitments.|
|**Governance**|Evaluates whether a requested state transition is permissible.|

Each concept answers a different question:

- **EBM:** _How should this be done?_
- **Policy:** _What constraints must be respected?_
- **Authority:** _Who may approve or perform this action?_
- **Obligation:** _What commitments remain outstanding?_
- **Governance:** _May this state transition occur now?_

I think this is one of the strongest aspects of the architecture because each concept has a single responsibility and they compose cleanly. It also reinforces another pattern that has emerged repeatedly: the platform is overwhelmingly **declarative**. Packs declare behaviour, policies declare constraints, authority declares permissions, obligations declare commitments, and the Runtime Kernel interprets those declarations. This declarative-first architecture should make the platform significantly easier to extend and customise without modifying its core.

-------------------

One addition, prompted by checking this chapter against Book 1's Governance entity directly. Book 1 splits Governance into two components: **Policy** (a mandatory constraint) and **Standard** (a preferred convention, not mandatory). I considered giving Standard its own chapter, but on inspection it would duplicate this one almost field for field — same Category, Applicability, Conditions, Required Evidence, Exception Rules, Version, Originating Pack, evaluated the same way, composed from Packs the same way. The only real difference is enforcement strength, which is exactly the kind of thing this platform already handles with an attribute rather than a second entity elsewhere (Quality Gate unifies four traditionally-separate gate concepts the same way; Obligation unifies four traditionally-separate commitment concepts the same way).

So Policy absorbs Standard as a **Constraint Type**: a Policy declares itself as Constraint Type "Policy" (mandatory — violation blocks the governed transition) or Constraint Type "Standard" (preferred — deviation does not block, but remains visible and traceable). This is deliberately a different axis from **Severity**, which this chapter already defines: Severity says how much a violation matters: Constraint Type says whether a violation blocks anything at all. A Standard can be high-severity (worth surfacing prominently) without ever blocking a transition; a low-severity Policy still blocks. Collapsing the two would lose a real distinction, so both fields stay.
]

---

# 1. Purpose

The Policy Model defines how engineering constraints, organisational rules and governance directives are represented, composed and evaluated within a Software Engineering Unit (SEU).

Policies express **what conditions must be satisfied** before governed engineering actions may proceed.

A Policy's Constraint Type determines whether it behaves as a mandatory constraint or a preferred convention (§8, §11). Both are represented as Policies; only their enforcement differs.

Policies do not execute engineering work.

Policies do not grant authority.

Policies do not perform reviews.

Policies declare engineering constraints that are interpreted by the Governance Model.

---

# 2. Scope

This chapter defines:

- Policy abstraction;
- Policy lifecycle;
- Policy composition;
- Policy evaluation;
- Policy relationships;
- Policy applicability.

This chapter does not define:

- authority assignments;
- review execution;
- compliance frameworks;
- engineering behaviour.

---

# 3. Architectural Position

```
Engineering Behavior Model
            │
            ▼
       Policy Model
            │
            ▼
 Governance Evaluation
            │
            ▼
Engineering State Transition
```

Policies influence governance decisions.

They do not perform governance.

---

# 4. Definition

A Policy is a declarative statement describing engineering constraints that govern engineering activities within an SEU.

Policies specify:

- conditions;
- applicability;
- expected outcomes;
- permitted exceptions;
- Constraint Type.

Every Policy declares a Constraint Type of either **Policy** (mandatory: violation blocks the governed transition) or **Standard** (preferred: deviation does not block, but remains traceable and may still be surfaced through Engineering Telemetry).

Policies never directly modify engineering state.

---

# 5. Architectural Principles

## PM-001

Policies are declarative.

---

## PM-002

Policies are composable.

---

## PM-003

Policies are independently versioned.

---

## PM-004

Policies are traceable.

---

## PM-005

Policies are context-sensitive.

---

## PM-006

Policies remain independent of Participant implementations.

---

## PM-007

Every Policy shall declare a Constraint Type. Constraint Type is independent of Severity: one determines whether a violation blocks a transition, the other determines how much it matters.

---

# 6. Functional Requirements

### FR-24.1

Every Policy shall possess a globally unique identifier.

---

### FR-24.2

Policies shall be contributed through Packs.

---

### FR-24.3

Policies shall support composition from multiple organisations.

---

### FR-24.4

Policies shall be evaluated during governance evaluation.

---

### FR-24.5

Policy evaluations shall remain fully traceable.

---

### FR-24.6

Policies shall support explicit exceptions.

---

### FR-24.7

Policy conflicts shall be detected.

---

### FR-24.8

Every Policy shall declare a Constraint Type of either Policy or Standard.

---

### FR-24.9

Governance evaluation shall block a governed transition on violation of a Constraint Type "Policy" and shall not block on deviation from a Constraint Type "Standard."

---

# 7. Policy Categories

Illustrative categories include:

## Engineering Policies

Examples:

- Architecture documentation required.
- Unit test coverage threshold.
- Coding standards.

---

## Security Policies

Examples:

- Encryption required.
- Secrets management.
- Dependency vulnerability thresholds.

---

## Quality Policies

Examples:

- Code review mandatory.
- Static analysis required.
- Performance validation.

---

## Operational Policies

Examples:

- Deployment approval required.
- Backup validation.
- Rollback capability.

---

## Documentation Policies

Examples:

- ADR required.
- API documentation mandatory.
- Operational runbook required.

---

## Customer Policies

Examples:

- Customer sign-off required.
- Business approval required.
- Release notification.

---

## Organisation Policies

Examples:

- Internal review process.
- Change management.
- Engineering standards.

Additional policy categories may be introduced through Packs.

---

# 8. Policy Structure

Every Policy shall define:

- Identifier
- Name
- Description
- Category
- Constraint Type (Policy or Standard)
- Applicability
- Conditions
- Required Evidence
- Related Obligations
- Exception Rules
- Severity
- Version
- Originating Pack 

Constraint Type and Severity are independent fields. Constraint Type determines whether a violation blocks a governed transition. Severity determines how significant a violation or deviation is, regardless of whether it blocks anything.

The internal policy language is implementation-defined.

---

# 9. Policy Applicability

Policies may apply according to:

~~- Deliverable category; this is deliverable-name~~
- Deliverable lifecycle state;
- 
~~- Capability; this is just a proxy for deliverable name~~
~~- Engineering stage;~~ - We are not staging anything
~~- Organisation;~~
~~- Domain;~~
~~- Technology;~~
- Environment;
~~- Compliance requirement.~~

Organisation, Domain, Technology, Compliance requirement — these map directly onto the existing category:pack vocabulary  - ignore this. 

Applicability shall be evaluated dynamically.

---

# 10. Policy Composition

Policies may originate from multiple Packs.

Example:

```
Platform Policy Pack

        +

TCS Engineering Pack

        +

Customer Engineering Pack

        +

HIPAA Compliance Pack

        ↓

Effective Policy Set
```

Composition shall preserve deterministic behaviour.

Conflicts shall be detected and resolved according to Governance rules.

---

# 11. Policy Evaluation

Policies shall be evaluated whenever a governed engineering action is requested.

Policy evaluation shall determine:

- applicable policies;
- satisfied conditions;
- violated conditions;
- required evidence;
- required obligations;
- applicable exceptions.

Where a violated condition belongs to a Constraint Type "Policy," the governed transition shall be blocked pending resolution or an approved exception.

Where a violated condition belongs to a Constraint Type "Standard," the governed transition shall proceed. The deviation shall remain fully traceable and shall be surfaced through Engineering Telemetry (Chapter 35) rather than blocking execution.

Evaluation shall not itself change engineering state.

---

# 12. Policy Exceptions

Policies may define explicit exception mechanisms.

An exception shall specify:

- justification;
- approving authority;
- duration;
- scope;
- review requirements.

Exceptions apply to Constraint Type "Policy" violations, since only these block a governed transition. A Constraint Type "Standard" deviation does not require a formal exception to proceed, as it was never blocking; it remains traceable through Policy Traceability (§14) regardless.

Exceptions shall remain fully traceable.

---

# 13. Policy Lifecycle

Policies shall progress through the following lifecycle.

```
Draft

↓

Validated

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

Historical Policies shall remain available for engineering reconstruction.

---

# 14. Policy Traceability

Every Policy evaluation shall preserve:

- Policy identifier;
- originating Pack;
- Engineering Behavior Model version;
- applicable Deliverables;
- applicable Decisions;
- evaluation outcome;
- timestamp;
- rationale.

Policy history shall be immutable.

---

# 15. Events

The Policy subsystem shall publish:

- PolicyCreated
- PolicyValidated
- PolicyPublished
- PolicyApplied
- PolicyViolated
- PolicyExceptionRequested
- PolicyExceptionApproved
- PolicyRetired

---

# 16. Non-Functional Requirements

The Policy Model shall:

- support deterministic evaluation;
- support composition;
- preserve traceability;
- support versioning;
- remain independent of implementation technologies.

---

# 17. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Policies are declarative.

✓ Policies are composable.

✓ Policy evaluations are traceable.

✓ Policy conflicts are detected.

✓ Exceptions are explicitly governed.

✓ Historical Policy versions remain reproducible.

✓ Constraint Type "Policy" violations block the governed transition; Constraint Type "Standard" deviations do not.

---

# 18. Deliverables

Implementation of this chapter shall produce:

- Policy domain model.
- Policy registry.
- Policy evaluation service.
- Policy composition service.
- Exception management service.
- Policy APIs.
- Policy events.

---

# 19. Implementation Specifics

*Recorded 2026-08-23 (CR-061); extended 2026-09-01 and 2026-09-05 (CR-089). This section documents how the Policy Model is realised in the current build. It does not change the requirements above (§§4–18); it records what is built, what is partial, and what is still open — the same convention as Chapter 1 §18 and Chapter 5 §19 (keep the normative spec stable; capture realisation decisions separately). Status markers: ✅ built · ⚠️ partial · 🚩 not built. No prior audit existed for this chapter before CR-061 — the pre-CR-061 snapshot (bare globally-unique `code`, free-text `category`, an inert `governedTransition`, no exception mechanism) is preserved in [CR-061](../../change-requests/CR-061-policy-model-chapter-24.md)'s own "The gap, precisely" section rather than repeated here.*

## 19.1 ✅ Governing principle: Policy is passive and declarative

Owner, settled before any field-level design: *"Policy does not evaluate anything. It only states what the quality gate should govern."* Policy is a passive, declarative, domain-agnostic rule; Governance (via whichever Gate references it) is what actually acts on it. Most of the decisions below follow from this, and from the same definition/execution boundary every Pack-contributed kind on this platform shares — owner: *"anything in the pack like a policy, review gate etc has a definition part and an execution part. So the definition is tied to a pack... When the execution happens, it is tied to an seu id and we are not addressing this here."*

## 19.2 ✅ Pack-owned identity is `(originating_pack_id, code)`, not globally unique (§8)

`policies_pack_code_key` replaced a bare globally-unique `code` — matching the same reasoning CR-060 settled for Checklist (owner: *"it is not global so no versioning required similar to checklist"*). No `version`/`is_active` column; `id` stays stable across every republish of its own Pack (`policiesDB.upsert`, `ON CONFLICT (originating_pack_id, code) DO UPDATE`).

## 19.3 ✅ Category — real, Ontology-backed, independent of any Gate's own category (§7)

Owner: *"category should be ontology driven. The policy categories are in section 7. Seed these categories as category:policy."* New concept type `category:policy`, seeded with this chapter's own §7 vocabulary (Engineering, Security, Quality, Operational, Documentation, Customer, Organisation). Confirmed independent of any referencing Gate's own category: owner — *"quality gates have an evidence category. So policies are corresponding to a gate category. It does not change the policy category. So I can have a customer sign off policy category across any gate category."* A "Customer" Policy can be required by a Gate of any `category:evidence` value; the two vocabularies never need to align.

**Update 2026-09-01 — the canonical set grows from 7 to 10.** Found wiring 33 real Compliance Packs: 31 of their declared Policies used `Compliance` (26), `Privacy` (4), or `Ethics` (1) as `category` — none canonical at the time. Owner: *"Extend the canonical taxonomy — add Compliance/Privacy/Ethics as new, permanent category:policy values."* Migration 147 seeds all three; §7's own narrative section still lists only the original 7 (left as originally written) — `Compliance`/`Privacy`/`Ethics` are real, live values from this migration on, same standing as the other 7.

## 19.4 ⚠️ `governedTransition` on the Pack-owned Policy — real and validated, still not consulted at runtime (§9)

Owner: *"the governed transition should be similar to what is in the quality gate (transition definitions in the ontology)."* A real `"EntityType|fromState|toState"` value, picked from real `transition_definitions` rows (same picker Quality Gate/Review Gate use) — but per the definition/execution boundary (§19.1), validation is where this stops: §9's "evaluated dynamically" is not yet true of anything a Pack author can reach. `transition_definitions.required_policy_ids` remains the real, separate enforcement path, unchanged.

## 19.5 ✅ Required Policies — Quality Gate's own mechanism generalizes; Policy gains no reciprocal reference (§8; Ch.26)

A Gate referencing a Policy already existed (`requires_active_policy`, Ch.26's own CR-058); generalized from one `requiredPolicyCode` to `requiredPolicyCodes` (a list) plus an implicit "all must be satisfied" rule — owner, confirming the direction after an initial wrong guess the other way: *"Gates have policies, not the other way around."* Cross-Pack reach is scoped to Policies whose owning Pack shares the *referencing* Gate's own Pack `code` — owner: *"Similar to checklist, if the pack code matches, that policy has to be visible to all other packs"* — the same reach Checklist itself was corrected to (§18: neither entity has a registry of its own).

## 19.6 ⚠️ Conditions — a real authored field, deliberately minimal, and still not consulted for a canonical Policy's own richer shape (§8, §11)

Owner: *"we will start with this, but... we will refine this as we go along with corresponding code changes."* `contributionPolicies[]` exposed `conditionType` (`always_true`/`field_in`, the two types `evaluateCondition` evaluates), reassembled into `condition`'s real nested shape at publish time. Required Evidence and Related Obligations (§8) resolve into this same mechanism, not separate fields — owner: *"if a quality gate refers to evidence, then there can be a policy [related] to evidence saying at least 90 percent of evidence is present or all evidence is present"* — Policy never gains Evidence- or Obligation-specific awareness. New condition types (a generic threshold — "80% of X must pass") get added incrementally, only as a real need surfaces.

**Update 2026-09-05 (CR-089) — still true, one layer down.** The canonical `policy_definitions` catalog's own `conditions[]` (§19.10) is materially richer than this — real per-condition `requiredEvidence`/`severity`/`exceptionRules`/`relatedObligations` — but `contributionPolicies[]`'s adoption of a canonical Policy (§19.13) still only ever materializes `condition: {type: "always_true"}` onto the Pack-owned row. `evaluateCondition` itself is unchanged since CR-061: every one of a canonical Policy's declared conditions stays fully declarative, never checked at runtime.

## 19.7 ✅ Exception Rules — fully covered by Constraint Type, no new mechanism (§12)

Owner: *"policy waiver is designed as standard through constraint type."* A Policy authored as Constraint Type "Standard" simply never blocks (§11) — a permanent, definition-time choice, not a per-instance runtime waiver. Explicitly distinct from Quality Gate's own **Gate waiver** (`quality_gate_waivers`, badge-gated, waives a specific *blocked evaluation instance* at execution time) — owner: *"Gate waiver is different from evidence waiver."*

## 19.8 🚩 Composition and conflict detection — untouched, deliberately (§10, FR-24.7)

Owner: *"let us resolve this when we get to composition engine. it is not a definition question."* `compositionEngine.ts`'s current behaviour (same-`code` collision = Override; different Policies always co-apply, no content-level conflict detection) is unchanged by CR-061 or CR-089.

## 19.9 🚩 Real seed data — no clean-slate-exercised Pack declares a Policy

None of the 22 real Packs `db:clean-slate` publishes declare any Policy at all (confirmed directly). The 3 that do (`core-engineering.pack.json`, `technology-nodejs.pack.json`, `domain-ebook-library.pack.json`) sit outside clean-slate's own reseed path entirely — same "confirmed dead, not exercised by any real publish path" status CR-058 already established for `core-engineering.pack.json` specifically. Updated for consistency with the new `condition` shape at the time (CR-061), not end-to-end validated — both fail earlier, on their own top-level Pack `code` not being a canonical `capability-name` concept, a pre-existing, unrelated blocker.

**Update 2026-09-05 (CR-089) — moot for real seed data now.** Every real Pack's `contributionPolicies[]` (all 132 files, plus their test-fixture twins) was emptied to `[]` as part of the canonical-catalog rebuild (§19.13) — this gap's own premise (a real Pack declaring an inline Policy) no longer applies to those 132; only the 3 already-dead files above still carry the old shape, untouched.

## 19.10 ✅ A second, standalone canonical catalog — `policy_definitions` — built alongside the Pack-owned `policies` table (CR-089, 2026-09-05)

Everything in §19.1–19.9 above is the Pack-owned `policies` table (§8's own field-for-field shape, one row per Pack authoring its own Policy inline). CR-089 does not touch it, except to empty every real Pack's own `contributionPolicies[]` (§19.13). It adds a second, entirely independent table — the same architectural move CR-086 made for Service (`service_definitions` alongside the Pack-owned `services` table): a canonical, cross-Pack catalog of reusable Policy Definitions, authored once, adopted by reference. Owner, ruling out the obvious first reading: *"do not confuse what is existing with what we are doing. We are defining canonical policies similar to canonical services... there is no relationship with any other entity"* — unlike Service Definition's 1:1 tie to Capability, a canonical Policy Definition stands alone.

`policy_definitions` (migration `167_policy_definitions.sql`): `code`/`name`/`description`/`category` (`category:policy`, §19.3's own vocabulary — the *same* concept type, not a parallel one), `constraintType` (§4's Policy/Standard axis), `applicabilityDeliverableNames`/`applicabilityEnvironments`/`applicabilityDeliverableLifecycle` (§9, §19.12), `conditions[]` (§8's own rich shape, §19.6's update), `version`, and this chapter's own §13 lifecycle verbatim (§19.11). Full registry + authoring surface built to match: `policyDefinitionsDB.ts`, `core/policyDefinitions.ts`, `web/policyDefinitionRegistry.ts` (`/aisworg/seu/policy-definitions`), and a `policy-authoring` slug on the generic SDK authoring engine — the same registry-plus-authoring pair Service Definition already has. **Not built**: a Schema Registry meta-form entry — `Policy` joins `Deliverable`/`Service` as a real `schema_definitions` entity kind authored via raw migration only ([CR-090](../../change-requests/CR-090-schema-registry-manual-entity-kinds.md)); an "Inherit from an existing Policy" authoring convenience, unlike Service/Deliverable/Template.

## 19.11 ✅ §13's own lifecycle used verbatim for `policy_definitions`, not Service Definition's leaner one

Service Definition's own lifecycle (Ch.11) drops the Validated step (Defined → Published → Active → ...); checked against this chapter's own §13 diagram before choosing — owner: *"Stick to the policy lifecycle defined in chapter 24 for policy."* Draft → Validated → Published → Active → Deprecated → Retired → Archived, all 6 hops real, governed `transition_definitions` rows, matching the `Policy` noun/verb vocabulary already seeded in `authorityVocabulary.json` (`validate`/`publish`/`activate`/`deprecate`/`retire`/`archive`).

## 19.12 ⚠️ §9 Applicability — real and configurable for 3 of 7 named dimensions

§9 lists Capability, Deliverable category, Engineering stage, Organisation, Domain, Technology, and Compliance requirement; only three are built, deliberately: `deliverable-name` (the refined, Ontology-backed form of "Deliverable category" — a canonical code already indirectly names its producing capability, so a separate Capability dimension would be redundant), `environment` (new `category:environment` Ontology concept, migration `166_category_environment_ontology.sql`: development/staging/production), and `deliverable_lifecycle` (real `transition_definitions` states for entity_type `Deliverable` — Defined/In Progress/Approved/Baselined; a different canonical source, not Ontology). Engineering stage has no real platform vocabulary anywhere; Organisation/Domain/Technology/Compliance requirement are already fully handled by *which Packs* adopt a canonical Policy (a Pack's own `category:pack` value), not by the Policy re-declaring the same scope a second time.

Every one of the three, plus `constraintType`, carries `x-configurable: true` on the real schema — owner, insisting this be structural rather than a prose claim: *"I am repeatedly saying applicability is configurable. Where is this captured? How will downstream systems know this is configurable?"* An empty list on any of the three means "matches everything along that dimension today," never "doesn't apply" — always present, never omitted, so a future override always has something to attach to. **What's still open**: the cascade this flag exists to support (Definition → Pack → Template exposes → Profile overrides, the same three-layer treatment [CR-088](../../change-requests/CR-088-template-profile-configurable-parameters.md) designed for Service Level) reads nothing yet — `x-configurable` is a discoverability marker only, the same gap CR-088 itself tracks as "design settled, not built." The `deliverable_lifecycle` dimension does have one real downstream reader today (§19.13's `governedTransition` derivation) — but every one of the 34 seeded canonical Policies (§19.14) derives to the identical edge, since none scope to an earlier-only state; the mechanism is real but unexercised against a differentiating case.

## 19.13 ⚠️ `contributionPolicies[]` rebuilt to reference the canonical catalog; the 93 existing entries removed, not reconciled (CR-089)

Same move CR-086 made for `contributionServices[]`, flatter still: a plain `string[]` of canonical Policy codes (migration `168_pack_contribution_policies_from_definitions.sql`) — check/uncheck, no per-item fields at all. Scoped by the same indirect Capability walk Service uses one hop further: a Pack's declared Capabilities → their canonical Service Definitions → those Definitions' own `outputs` → intersected against each candidate Policy's own `applicabilityDeliverableNames` (empty matches everything). `governedTransition`, required by the real Pack-owned `policies` row this still materializes into (§19.5's `requiredPolicyCodes` depends on it) but deliberately absent from the canonical Definition, is **derived**, not authored — owner, connecting the dimension already built: *"is not deliverable_lifecycle equivalent of that?"* — the `transition_definitions` edge landing on the most-advanced state named in `applicabilityDeliverableLifecycle` (§19.12), or landing on Baselined, the final gate, when empty.

Before rebuilding the picker, all 93 real, non-empty Pack-authored Policy entries across 60 pack.json files (of 132) were checked against the new canonical catalog: 7 clear duplicates and 4 strong-overlap candidates identified (logged in [CR-089](../../change-requests/CR-089-canonical-policy-definitions.md), not merged into the catalog); the remaining ~82 — including all 33 real Compliance-Pack Policies, and 11 structural "transition baseline check" gates that aren't content policies at all — have no canonical equivalent. Owner: *"Remove the current policies in the packs... if you do not see a duplicate in the canonical, then note it down and we will figure out what to do"* — every real Pack's `contributionPolicies[]` (and its test-fixture twin) was emptied regardless of match/no-match; nothing was reconciled, only removed and logged. The Compliance/Privacy/Ethics category (§19.3's 2026-09-01 extension) has zero canonical coverage as a result.

## 19.14 ✅ 34 canonical Policies seeded, covering all 71 real `deliverable-name` codes (CR-089)

`design/fragments/policies.md`, one JSON file per Policy under `src/dblayer/seed/data/policy-*.json`, loaded by `seedPolicyDefinitions.ts`, wired into `db:clean-slate`. §7's 21 named illustrative examples plus 13 extensions, none invented without a named professional-body source (SWEBOK, BABOK, ITIL, ISTQB, OWASP, NIST SSDF/AI RMF, COBIT, OCEG).

## 19.15 🚩 Unverified end-to-end

Everything in §19.10–19.14 was built and statically reviewed; `db:clean-slate` and the test suite were run by the owner, not this session, and neither exercises the new `policy_definitions` catalog, its registry/authoring surface, or the rebuilt `contributionPolicies[]` picker specifically — only their absence of *new* crashes was confirmed after fixing what surfaced along the way (a stale test-fixture pack-twin directory the first sweep missed; two schema-widget bugs in the original migration).