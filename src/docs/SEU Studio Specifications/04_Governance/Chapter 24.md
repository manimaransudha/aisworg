# Chapter 24 – Policy Model

## 1. Purpose

The Policy Model defines how engineering constraints, organisational rules and governance directives are represented, composed and evaluated within a Software Engineering Unit (SEU).

Policies express **what conditions must be satisfied** before governed engineering actions may proceed.

A Policy's Constraint Type determines whether it behaves as a mandatory constraint or a preferred convention (§8, §11). Both are represented as Policies; only their enforcement differs.

Policies do not execute engineering work.

Policies do not grant authority.

Policies do not perform reviews.

Policies declare engineering constraints that are interpreted by the Governance Model.

---

## 2. Scope

This chapter defines:

- Policy abstraction
- Policy lifecycle
- Policy composition
- Policy evaluation
- Policy relationships
- Policy applicability

This chapter does not define:

- authority assignments
- review execution
- compliance frameworks
- engineering behaviour

---

## 3. Architectural Position

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

## 4. Definition

A Policy is a declarative statement describing engineering constraints that govern engineering activities within an SEU.

Policies specify:

- conditions
- applicability
- expected outcomes
- permitted exceptions
- Constraint Type

Every Policy declares a Constraint Type of either **Policy** (mandatory: violation blocks the governed transition) or **Standard** (preferred: deviation does not block, but remains traceable and may still be surfaced through Engineering Telemetry).

Policies never directly modify engineering state.

---

## 5. Architectural Principles

### PM-001

Policies are declarative.

### PM-002

Policies are composable.
 
### PM-003

Policies are independently versioned.
 
### PM-004

Policies are traceable.
 
### PM-005

Policies are context-sensitive.
 
### PM-006

Policies remain independent of Participant implementations.
 
### PM-007

Every Policy shall declare a Constraint Type. Constraint Type is independent of Severity: one determines whether a violation blocks a transition, the other determines how much it matters.

---

## 6. Functional Requirements

### FR-24.1

Every Policy shall possess a globally unique identifier.
 
### FR-24.2

Policies shall be contributed through Packs.
 
### FR-24.3

Policies shall support composition from multiple organisations.
 
### FR-24.4

Policies shall be evaluated during governance evaluation.
 
### FR-24.5

Policy evaluations shall remain fully traceable.
 
### FR-24.6

Policies shall support explicit exceptions.
 
### FR-24.7

Policy conflicts shall be detected.
 
### FR-24.8

Every Policy shall declare a Constraint Type of either Policy or Standard.
 
### FR-24.9

Governance evaluation shall block a governed transition on violation of a Constraint Type "Policy" and shall not block on deviation from a Constraint Type "Standard."

---

## 7. Policy Categories

Illustrative categories include:

### Engineering Policies

Examples:

- Architecture documentation required
- Unit test coverage threshold
- Coding standards
 
### Security Policies

Examples:

- Encryption required
- Secrets management
- Dependency vulnerability thresholds
 
### Quality Policies

Examples:

- Code review mandatory
- Static analysis required
- Performance validation
 
### Operational Policies

Examples:

- Deployment approval required
- Backup validation
- Rollback capability
 
### Documentation Policies

Examples:

- ADR required
- API documentation mandatory
- Operational runbook required
 
### Customer Policies

Examples:

- Customer sign-off required
- Business approval required
- Release notification
 
### Organisation Policies

Examples:

- Internal review process
- Change management
- Engineering standards

Additional policy categories may be introduced through Packs.
 
## 8. Policy Structure

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

## 9. Policy Applicability

Policies may apply according to:

- Deliverable
- Deliverable lifecycle state
- 
~~- Capability; this is just a proxy for deliverable name~~
~~- Engineering stage;~~
~~- Organisation;~~
~~- Domain;~~
~~- Technology;~~
- Environment
~~- Compliance requirement.~~

*[Remarks: Organisation, Domain, Technology, Compliance requirement — these map directly onto the existing category:pack vocabulary  - ignore this.]*

Applicability shall be evaluated dynamically.

---

## 10. Policy Composition

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

## 11. Policy Evaluation

Policies shall be evaluated whenever a governed engineering action is requested.

Policy evaluation shall determine:

- applicable policies
- satisfied conditions
- violated conditions
- required evidence
- required obligations
- applicable exceptions

Where a violated condition belongs to a Constraint Type "Policy," the governed transition shall be blocked pending resolution or an approved exception.

Where a violated condition belongs to a Constraint Type "Standard," the governed transition shall proceed. The deviation shall remain fully traceable and shall be surfaced through Engineering Telemetry (Chapter 35) rather than blocking execution.

Evaluation shall not itself change engineering state.

---

## 12. Policy Exceptions

Policies may define explicit exception mechanisms.

An exception shall specify:

- justification
- approving authority
- duration
- scope
- review requirements

Exceptions apply to Constraint Type "Policy" violations, since only these block a governed transition. A Constraint Type "Standard" deviation does not require a formal exception to proceed, as it was never blocking; it remains traceable through Policy Traceability (§14) regardless.

Exceptions shall remain fully traceable.

---

## 13. Policy Lifecycle

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

## 14. Policy Traceability

Every Policy evaluation shall preserve:

- Policy identifier
- originating Pack
- Engineering Behavior Model version
- applicable Deliverables
- applicable Decisions
- evaluation outcome
- timestamp
- rationale

Policy history shall be immutable.

---

## 15. Events

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

## 16. Non-Functional Requirements

The Policy Model shall:

- support deterministic evaluation
- support composition
- preserve traceability
- support versioning
- remain independent of implementation technologies

---

## 17. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Policies are declarative.

✓ Policies are composable.

✓ Policy evaluations are traceable.

✓ Policy conflicts are detected.

✓ Exceptions are explicitly governed.

✓ Historical Policy versions remain reproducible.

✓ Constraint Type "Policy" violations block the governed transition; Constraint Type "Standard" deviations do not.

---

## 18. Deliverables

Implementation of this chapter shall produce:

- Policy domain model
- Policy registry
- Policy evaluation service
- Policy composition service
- Exception management service
- Policy APIs
- Policy events

---

## 19. Implementation Specifics

*Recorded as of 2026-09-14. This section documents how the Policy Model is realised in the current build. It does not change the requirements above (§§4–18); it records what is built, what is partial, and what is still open — the same convention as Chapter 1 §18 and Chapter 5 §19 (keep the normative spec stable; capture realisation decisions separately). Status markers: ✅ built · ⚠️ partial · 🚩 not built. This is a current-state snapshot, not a change history — see migrations 107/109/147/166–168/207/211–221 and CR-061/CR-089/CR-104/CR-106 for how it got here.*

### 19.1 ✅ Governing principle: Policy is passive and declarative

Policy is a passive, declarative, domain-agnostic rule; something else (a Gate, `transitionEngine.ts`, `policyEngine.ts`) evaluates it and acts. Every Pack-contributed kind on this platform shares the same definition/execution split: the definition is tied to a Pack; the execution is tied to an SEU.

### 19.2 ✅ Two tables, two identities

The Pack-owned `policies` table (§8's field-for-field shape, materialized at Pack-publish time) and the canonical `policy_definitions` catalog (authored once, cross-Pack, no relationship to any other entity — unlike Service Definition's 1:1 tie to Capability) are entirely independent. Pack-owned identity is `(originating_pack_id, code)`, not globally unique — `id` stays stable across every republish of its own Pack. Canonical identity is `(code, version, tenant_id)`. Full registry + authoring surface: `policyDefinitionsDB.ts`, `core/policyDefinitions.ts`, `web/policyDefinitionRegistry.ts` (`/aisworg/seu/policy-definitions`), a `policy-authoring` slug on the generic SDK authoring engine. Not built: an "Inherit from an existing Policy" authoring convenience (Service/Deliverable/Template have one).

### 19.3 ✅ Category — Ontology-backed, independent of any Gate's own category (§7)

`category:policy`, 10 seeded values: the 7 named in §7 (Engineering, Security, Quality, Operational, Documentation, Customer, Organisation) plus Compliance/Privacy/Ethics (real, permanent values from real Compliance Pack coverage; §7's own narrative text still lists only the original 7). Independent of any referencing Gate's own `category:evidence` — a "Customer" Policy can be required by a Gate of any evidence category.

### 19.4 ✅ §13 lifecycle used verbatim, with real versioning

Draft → Validated → Published → Active → Deprecated → Retired → Archived — this chapter's own 7-state lifecycle used directly for `policy_definitions` (Service Definition's leaner 6-state lifecycle, without a Validated step, was considered and rejected). All 6 hops are real, governed `transition_definitions` rows, each carrying a real `event_type`/`version_event` (Version Feature Plan.md convention): `PolicyDefinitionValidated`/`VersionValidated`, `PolicyDefinitionPublished`/`VersionPublished`, `PolicyDefinitionActivated`/`VersionActivated`, `PolicyDefinitionDeprecated`/`VersionDeprecated`, `PolicyDefinitionRetired`/`VersionSuperseded` (Ch.41 §15's generic chain supplies the version-event name by position — Retired is the real lifecycle state), `PolicyDefinitionArchived`/`VersionArchived`. Badges are `policy_<verb>` (`policy_validate`/`policy_publish`/.../`policy_archive`), checked directly by `transitionEngine.ts`. Known gap: noun `policy` has no rows in `authority_noun_verbs`, so these badges are invisible to the Authority admin UI's own grant picker (enforcement itself is unaffected) — same shape as a gap already found and fixed for `ontology_define` (Ch.18).

### 19.5 ✅ Applicability (§9) — Environment, Scope, and per-condition Deliverables/Transitions

Three real fields, all on the Definition's Metadata tab: `category` (§19.3), `applicabilityEnvironments` (`category:environment`, Ontology-backed and composable — a typed-but-unregistered value proposes via OntologyComposed rather than being rejected), and `scope` (`Transition` | `Eligibility` — CR-104; an implementation detail this chapter doesn't name explicitly, but needed to say whether a Definition governs a state transition or a Participant's eligibility to fulfil a Capability). Capability/Engineering stage/Organisation/Domain/Technology/Compliance requirement (§9's own struck-through dimensions) are already covered by *which Packs* adopt a canonical Policy, not by the Policy re-declaring the same scope.

Which deliverable(s)/noun(s) and transition(s) a Policy governs is authored per-**condition**, not per-Definition (§19.6) — each condition's own `applicabilityDeliverables[]` is an array of `{name, transitions, governingCondition}` rows. `name`'s source switches on the Definition's own `scope`: an Ontology `deliverable-name` (composable) under `Transition`, a real Authority Vocabulary noun under `Eligibility`. `transitions` are real `transition_definitions` edges for that row's own entity type (`Deliverable` under `Transition`; the row's own `name` under `Eligibility`), live-filtered client-side to the correct set. There is no separate `governedTransition` field — a row's own `transitions` are the only source of what it governs.

### 19.6 ✅ Conditions (§8) — structured, one row per independently-checkable predicate

`conditions[]` is a real, structured `referential-list`, not raw JSON. Each condition: `statement` (markdown), `severity` (`category:policy-condition-severity`, Ontology-backed), `applicabilityDeliverables[]` (§19.5), `requiredEvidence` (`{evidenceType: document | email | governed, evidenceFormat}`), `relatedObligations[]`, `exceptionRules[]` (§19.7). A Definition's several conditions can independently govern different deliverables/transitions with different severities and different governing rules — e.g. "2 reviewers required" scoped to Code, "sign-off required" scoped to Deployment Plan, in the same Policy.

`relatedObligations[]` reuses Ch.23's own Definition-side Obligation shape (Category/Title/Description/Origin/Priority/Severity/CompletionCriteria — Category/Origin/Priority/Severity Ontology-backed). ⚠️ Not yet synced with Pack's own `contributionObligationDefinitions[]`, which still only carries Category/Origin (Priority/Severity/CompletionCriteria are on the CR-106 backlog for that field).

### 19.7 ✅ Exceptions (§12) — all five named fields, gated to Constraint Type "Policy"

Each condition's `exceptionRules[]` carries every field §12 names: `exceptionStatement` (justification), `exceptionApprovers` (approving authority — real Authority Vocabulary badges, `noun_verb`, tying directly into `requireBadge` at execution time), `duration`, `exceptionScope` (distinct from the Definition's own `scope` — what the exception itself applies to), `reviewRequirements`; plus a system-assigned `identifier` and `exceptionComposition` (`all` | `any`, whether every listed approver must approve or one is sufficient). Authorable only when `constraintType = "Policy"` (§12: a Standard's deviations already don't block, so there is nothing to except) — enforced both in the authoring UI (hidden otherwise) and in validation. Constraint Type itself still separately governs whether a violation blocks at all (§11) — the two mechanisms coexist.

### 19.8 ✅ Governing rule (§11) — real, structured, per-applicability-row, shared with Quality Gate

Each `applicabilityDeliverables[]` row carries its own `governingCondition`: `{type: "always_true" | "field_in" | "comparison" | "threshold", ...}`. `comparison` supports `gt`/`gte`/`lt`/`lte`/`eq`/`neq`; `threshold` is a floor (`gte`/`gt` only). Evaluated by a dedicated, entity-agnostic module (`governingCondition.ts` / `governingConditionTypes.ts`, a `CONDITION_EVALUATORS` registry so a future type is one new entry) — not Policy-specific: Quality Gate's own `policy.condition`, `transitionEngine.ts`, and `participantEligibility.ts` all reuse the same evaluator. A row left without a `governingCondition` is manual/human-attested, never checked by the engine — the same machine-verifiable/judgment/human-attested split Obligation Definitions already draw.

### 19.9 ✅ Materialization — one Pack-owned row per (condition × applicability row × transition)

`contributionPolicies[]` (Pack authoring) stays a plain checkbox picker of canonical Policy codes — no per-item fields, no inline policy authoring. At Pack-publish time, each adopted Definition fans out into one Pack-owned `policies` row per (condition, applicability-row, transition) combination; each row carries THAT combination's own real `severity`, `governingCondition`, and `governedTransition` — there is no Definition-wide severity/condition reduction. `scope = "Eligibility"` rows never fan out by transition (resolved live off Template/Profile composition instead, never EBM-materialized) — one row per named noun, `governedTransition` null.

### 19.10 ⚠️ §15 events — lifecycle and evaluation covered; exception request/approval not built

`PolicyDefinitionValidated/Published/Activated/Deprecated/Retired/Archived` (§19.4) cover the lifecycle transitions (Definition-suffixed to distinguish from the Pack-owned row's own vocabulary, not §15's literal `PolicyCreated`/`PolicyValidated`/... names). `PolicyApplied`/`PolicyViolated` are published by both live evaluation paths (`policyEngine.ts`, the real one SEU-scoped/entity-scoped governance actually calls; `transitionEngine.ts`'s own `required_policy_ids` check, not yet populated for any real production transition but kept consistent) — alongside, not instead of, the existing `StandardPolicyDeviation` event `telemetry.ts` already reads for sustained-pattern detection. 🚩 `PolicyExceptionRequested`/`PolicyExceptionApproved` are not built — `exceptionRules` (§19.7) is declarative only; nothing today lets an actor request or approve one at runtime.

### 19.11 🚩 Seed data is stale relative to the current shape

All 34 canonical Policies (`db:clean-slate`, `seedPolicyDefinitions.ts`) still carry the pre-redesign flat `conditions[]` shape — no `applicabilityDeliverables`/`governingCondition`/`duration`/`exceptionScope`/`reviewRequirements`, `severity` as free text rather than the new Ontology concept type. `seedPolicyDefinitions.ts` mechanically folds the old shape forward so it still loads without error; the content itself is deliberately not being reseeded incrementally alongside each schema change — one deferred pass once the definition-side design is finished.

### 19.12 🚩 Composition and conflict detection — untouched

`compositionEngine.ts`'s behaviour is unchanged: same-`code` collision is an Override; different Policies always co-apply; no content-level conflict detection.