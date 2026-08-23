
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

- Deliverable category;
- Deliverable lifecycle state;
- Capability;
- Engineering stage;
- Organisation;
- Domain;
- Technology;
- Environment;
- Compliance requirement.

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

# 19. Implementation Specifics (CR-061, 2026-08-23)

No prior audit existed for this chapter before this CR. What follows is the built state — the gap this section originally documented (a pre-CR-061 snapshot: bare globally-unique `code`, free-text `category`, an inert `governedTransition`, no exception mechanism) is preserved in [CR-061](../../change-requests/CR-061-policy-model-chapter-24.md)'s own "The gap, precisely" section rather than repeated here.

**The governing principle, settled before any field-level design**: owner — *"Policy does not evaluate anything. It only states what the quality gate should govern."* Policy is a passive, declarative, domain-agnostic rule; Governance (via whichever Gate references it) is what actually acts on it. Several of the decisions below follow directly from this.

**Definition vs execution — the real scope boundary.** Owner: *"anything in the pack like a policy, review gate etc has a definition part and an execution part. So the definition is tied to a pack... When the execution happens, it is tied to an seu id and we are not addressing this here."* This CR closes the Pack-authoring/definition-layer gap only. What still doesn't exist, deliberately: the evaluation engine consulting a Policy's own `governedTransition` dynamically (§9's "evaluated dynamically" stays aspirational — `transition_definitions.required_policy_ids` remains the real, separate enforcement path, unchanged); any percentage/threshold evaluation of Quality Gate's new `requiredPolicyCodes`.

**Database** (`policies` table, updated): identity is now `(originating_pack_id, code)` — `policies_pack_code_key`, not a bare globally-unique `code` — matching the same reasoning CR-060 settled for Checklist (owner: *"it is not global so no versioning required similar to checklist"*). No `version`/`is_active` column, none added; `id` stays stable across every republish of its own Pack (`policiesDB.upsert`, `ON CONFLICT (originating_pack_id, code) DO UPDATE`).

**Category — real, Ontology-backed, `category:policy` (new concept type)**: owner — *"category should be ontology driven. The policy categories are in section 7. Seed these categories as category:policy."* Seeded with this chapter's own §7 vocabulary (Engineering, Security, Quality, Operational, Documentation, Customer, Organisation). **Independent of any Gate's own category, confirmed explicitly**: owner — *"quality gates have an evidence category. So policies are corresponding to a gate category. It does not change the policy category. So I can have a customer sign off policy category across any gate category."* A "Customer" Policy can be required by a Gate of any `category:evidence` value; the two vocabularies never need to align.

**`governedTransition` — real and validated, still not consulted at runtime.** Owner: *"the governed transition should be similar to what is in the quality gate (transition definitions in the ontology)."* Now a real `"EntityType|fromState|toState"` value, picked from real `transition_definitions` rows (same picker Quality Gate/Review Gate use) — but per the definition/execution boundary above, this CR stops at validating the field; §9's "evaluated dynamically" is not yet true of anything a Pack author can reach.

**Required Policies — Quality Gate's own mechanism generalizes, Policy itself doesn't gain a reciprocal reference.** A Gate referencing a Policy already existed (`requires_active_policy`, Chapter 26's own CR-058); this CR generalizes it from one `requiredPolicyCode` to `requiredPolicyCodes` (a list) plus an implicit "all must be satisfied" rule — owner, confirming the direction after an initial wrong guess the other way: *"Gates have policies, not the other way around."* Cross-Pack reach for this reference is scoped to Policies whose owning Pack shares the *referencing* Gate's own Pack `code` — owner: *"Similar to checklist, if the pack code matches, that policy has to be visible to all other packs"* — the same reach Checklist itself was corrected to after an initial over-broad "any Pack, unconditionally" build (owner, catching that: *"If checklists are global, then we would have created a registry? isn't it?"*, since Policy has no registry of its own either, §18).

**Conditions — a real authored field, deliberately starting minimal.** Owner: *"we will start with this, but... we will refine this as we go along with corresponding code changes."* `contributionPolicies[]` now exposes `conditionType` (`always_true`/`field_in`, the two types `evaluateCondition` already evaluates), reassembled into `condition`'s real nested shape at publish time. New types (e.g. a generic threshold — "80% of X must pass," "90% of evidence present") get added incrementally, each needing its own execution-side evaluation code, only as a real need surfaces — not designed exhaustively up front. **Required Evidence and Related Obligations (§8) resolve into this same mechanism, not separate fields**: owner — *"if a quality gate refers to evidence, then there can be a policy [related] to evidence saying at least 90 percent of evidence is present or all evidence is present"* — Policy never gains Evidence- or Obligation-specific awareness; the domain meaning comes entirely from whichever Gate references it.

**Exception Rules (§12) — fully covered by the existing Constraint Type axis, no new mechanism.** Owner: *"policy waiver is designed as standard through constraint type."* A Policy authored as Constraint Type "Standard" simply never blocks (§11, already built) — a permanent, definition-time choice, not a per-instance runtime waiver. Explicitly distinct from, and untouched by this: Quality Gate's own **Gate waiver** (`quality_gate_waivers`, badge-gated, waives a specific *blocked evaluation instance* at execution time) — owner, disambiguating the two: *"Gate waiver is different from evidence waiver."*

**Composition/conflict detection (§10, FR-24.7) — untouched, deliberately.** Owner: *"let us resolve this when we get to composition engine. it is not a definition question."* `compositionEngine.ts`'s current behaviour (same-`code` collision = Override; different Policies always co-apply, no content-level conflict detection) is unchanged by this CR.

**Real seed data**: none of the 22 real Packs `db:clean-slate` actually publishes declare any Policy at all (checked directly). The 3 that do (`core-engineering.pack.json`, `technology-nodejs.pack.json`, `domain-ebook-library.pack.json`) sit outside clean-slate's own reseed path entirely — same "confirmed dead, not exercised by any real publish path" status CR-058 already established for `core-engineering.pack.json` specifically. All three were updated for consistency with the new `condition` shape; the latter two also got real `category`/`governedTransition` values, though neither could be end-to-end validated via the CLI — both fail earlier, on their own top-level Pack `code` not being a canonical `capability-name` concept, a pre-existing, unrelated blocker confirmed to predate this CR.