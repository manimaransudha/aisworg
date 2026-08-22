
# Chapter 22 – Authority Model

[Sudha: we've talked about **Authority Packs**    but we've never formally defined **what authority actually is**.

The more we've refined the architecture, the more I think authority has almost nothing to do with "roles".

It has everything to do with **permission to change engineering state**.

That's a much more precise definition.

For example:

- A Participant does **not** have authority because it is an Architect.
- It has authority because the current Governance Model authorises that Participant to approve an Architecture Deliverable **at its current state**.

Tomorrow, another Participant may possess that authority.

This is a very important distinction.

-------------------

While writing this chapter, I realised we've arrived at another architectural refinement.

We've repeatedly used the phrase **"authority to approve."** I think that's too narrow.

Authority should instead be modelled as **permission to perform a governed state transition**.

That includes approvals, but also many other actions:

- transition a Deliverable from **Under Review → Approved**;
- create or close an Obligation;
- waive a Quality Gate;
- supersede a Decision;
- activate a new Engineering Behavior Model;
- commission or decommission an SEU.

In other words, authority should attach to **transitions**, not to objects.

This fits beautifully with the state-centric architecture we've developed:

- Deliverables evolve through states.
- Decisions evolve through states.
- Knowledge evolves through states.
- Obligations evolve through states.
- Governance evaluates state transitions.
- **Authority authorises state transitions.**

I think this is a stronger and more general model than traditional RACI matrices.

In fact, I now see RACI as **one possible implementation** of an Authority Pack rather than as the architectural foundation itself. An Organisation Pack could implement a RACI-based authority model, while another organisation might use a policy-based or risk-based model, and both would fit naturally into the same platform architecture. That flexibility is exactly what we wanted when we introduced composable Authority Packs.
]

---

# 1. Purpose

The Authority Model defines how engineering authority is represented, delegated, evaluated and enforced within a Software Engineering Unit (SEU).

Authority determines **who is permitted to perform a governed engineering action**.

Authority is independent of organisational job titles, participant implementations and engineering capabilities.

Authority is evaluated dynamically according to the Engineering Behavior Model (EBM), active Governance Model and applicable Authority Packs.

---

# 2. Scope

This chapter defines:

- authority abstraction;
- authority assignments;
- authority evaluation;
- delegation;
- authority inheritance;
- authority composition.

This chapter does not define:

- engineering behaviour;
- organisational structures;
- capability fulfilment;
- participant implementations.

---

# 3. Architectural Position

```
Governance Model
        │
Authority Packs
        │
        ▼
Authority Model
        │
        ▼
Governance Evaluation
        │
        ▼
Engineering State Transition
```

Authority determines whether a requested engineering action may be authorised.

---

# 4. Definition

Authority is the permission to perform a governed engineering action within a specific engineering context.

Authority is contextual.

It depends upon:

- the Engineering Behavior Model;
- Deliverable state;
- Governance Model;
- active Policies;
- active Obligations;
- applicable Authority Packs.

Authority is **not** an attribute of a Participant.

It is a runtime relationship between:

- an engineering action;
- a governing context;
- an authorised Participant.

---

# 5. Architectural Principles

## AM-001

Authority governs engineering state transitions.

---

## AM-002

Authority is contextual.

---

## AM-003

Authority is composable.

---

## AM-004

Authority shall remain independently traceable.

---

## AM-005

Authority may be delegated.

---

## AM-006

Authority shall remain independent of organisational titles.

---

# 6. Functional Requirements

### FR-22.1

Every governed engineering action shall require explicit authority.

---

### FR-22.2

Authority shall be evaluated before execution.

---

### FR-22.3

Authority rules shall be contributed through Packs.

---

### FR-22.4

Authority assignments shall remain fully traceable.

---

### FR-22.5

Authority shall support delegation.

---

### FR-22.6

Authority shall support multiple participating organisations.

---

### FR-22.7

Authority conflicts shall be detected during governance evaluation.

---

# 7. Authority Components

The Authority Model consists of:

- Authority Rules;
- Delegation Rules;
- Escalation Rules;
- Approval Rules;
- Exception Rules;
- Separation of Duties Rules.

Each component contributes to determining whether a requested action is authorised.

---

# 8. Authority Sources

Authority may originate from:

- Platform Packs;
- Organisation Packs;
- Domain Packs;
- Compliance Packs;
- Customer Packs.

The Composition Engine shall compose these into a single effective Authority Model.

---

# 9. Authority Evaluation

Authority shall be evaluated whenever a governed action is requested.

Evaluation shall consider:

- requested action;
- current Deliverable state;
- Participant identity;
- fulfilled Capabilities;
- active Governance Model;
- applicable Policies;
- active Obligations;
- current engineering stage.

Evaluation shall produce one deterministic outcome.

---

# 10. Authority Outcomes

Authority evaluation may produce:

- Authorised;
- Authorised with Conditions;
- Not Authorised;
- Escalation Required;
- Delegation Required;
- Waiver Required.

Each outcome shall include supporting rationale.

---

# 11. Delegation

Authority may be delegated according to explicit delegation rules.

Delegation shall define:

- delegating authority;
- receiving authority;
- scope;
- duration;
- conditions.

Delegation shall never occur implicitly.

Delegation shall be traceable.

---

# 12. Authority Composition

Multiple organisations may contribute authority rules.

For example:

```
Platform Authority Pack

        +

TCS Authority Pack

        +

Cigna Authority Pack

        +

HIPAA Authority Rules

        ↓

Effective Authority Model
```

The effective Authority Model shall resolve conflicts deterministically according to composition rules defined by the Governance Model.

---

# 13. Separation of Duties

The Authority Model shall support separation-of-duties constraints.

Examples include:

- the Participant who implements a Deliverable shall not approve it;
- security waivers require independent approval;
- production deployment approval requires a different authority from development approval.

These constraints are declarative and contributed through Packs.

---

# 14. Authority Traceability

Every authority decision shall preserve:

- governing rule;
- originating Pack;
- requesting Participant;
- authorised Participant;
- affected Deliverable;
- applicable Governance Model;
- timestamp;
- rationale.

Authority traceability shall be immutable.

---

# 15. Events

The Authority subsystem shall publish:

- AuthorityRequested
- AuthorityGranted
- AuthorityDenied
- AuthorityDelegated
- AuthorityEscalated
- AuthorityExpired
- AuthorityRevoked

---

# 16. Non-Functional Requirements

The Authority Model shall:

- support deterministic evaluation;
- support composition from multiple organisations;
- preserve complete traceability;
- support dynamic delegation;
- remain independent of Participant implementations.

---

# 17. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Every governed engineering action requires explicit authority.

✓ Authority is evaluated contextually.

✓ Authority rules from multiple organisations are composed.

✓ Delegation is explicit and traceable.

✓ Separation-of-duties constraints are enforced.

✓ Authority decisions are explainable and reproducible.

---

# 18. Deliverables

Implementation of this chapter shall produce:

- Authority domain model.
- Authority evaluation service.
- Delegation service.
- Authority registry.
- Authority APIs.
- Authority events.
- Authority traceability service.

---

# 19. Implementation Status & Gaps

Code-verified audit (2026-08-22), not from memory — every claim below carries a file:line citation, cross-checked against a live query against the running Postgres instance (`aisworg` DB: 23,204 rows in `events`, 16 distinct `entity_type` values in `transition_definitions`). Governing history: **CR-006** (authority collapses to `noun_verb` badges), **CR-014** (SDK authoring gated the same way; adds `events.actor_id`/`authority_badge`), **CR-032** (dev Act-As fixed to assume real `noun_verb` badges), migration `043_retire_legacy_authority_badges.sql` (deletes the legacy Creator/Reviewer/Approver family).

The chapter's own central philosophical claim — authority is permission to perform a governed transition, not a Participant attribute tied to a role or title — is real and holds throughout the live implementation (AM-001, AM-006, FR-22.1/FR-22.2 below), and is arguably purer than the chapter's own prose: the one title-shaped badge family (`creator`/`reviewer`/`approver`) was deliberately retired. Almost everything the chapter mandates *around* that core check — Pack-contributed composition, delegation, escalation, multi-outcome evaluation, full traceability, events — is either a disconnected legacy path, a documentation-only concept, or absent.

## 19.1 ⚠️ Definition — contextual only via badge selection, not the check itself (§4)

The live check, `badgeAuthorityEngine.authorise({ actorId, requiredBadge })` (`src/domain/engine/badgeAuthorityEngine.ts:16-24`), takes exactly two inputs — actor identity and a `noun_verb` string. It is not a Participant attribute (✅, matches the chapter's central point) — but the chapter's "depends upon EBM/Deliverable state/Governance Model/Policies/Obligations/Authority Packs" list doesn't hold at the authority-check layer. Context (from/to state) is resolved one layer up, in `transitionEngine.evaluate()` (`src/domain/engine/transitionEngine.ts:83-99`), which derives the required badge from the matched `transition_definitions` row, then hands `authorise()` just that string. "Contextual" is real only in the sense that *which* badge is required varies by transition — the authorization decision itself is a flat two-value lookup, not an evaluation against EBM/Governance Model/Policies/Obligations.

## 19.2 ⚠️ Architectural Principles (AM-001–006) (§5)

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| AM-001 | Authority governs state transitions | ✅ | `transitionEngine.evaluate()` resolves the badge from the matched `(entityType, fromState, toState)` row before any state write proceeds (`transitionEngine.ts:83-98`). |
| AM-002 | Authority is contextual | ⚠️ | See 19.1 — contextual only via which badge is *selected*, not via the check itself considering state/policy/obligation. |
| AM-003 | Authority is composable (multiple Packs) | ❌ | The live `noun_verb` vocab (`authority_nouns`/`authority_verbs`/`authority_noun_verbs`) has no Pack linkage at all — no `originating_pack_id` column on any of the three tables. The one table that did carry Pack provenance, `authority_rules` (`originating_pack_id uuid REFERENCES packs(id)`, 37/39 rows populated), is retired from enforcement — `transitionEngine.ts:8-12`'s own header comment documents its removal. |
| AM-004 | Authority remains independently traceable | ⚠️ | Real but partial — see 19.11. |
| AM-005 | Authority may be delegated | ❌ | `grep -rniE "delegat" src --include="*.ts"` → zero matches anywhere in `src/`. |
| AM-006 | Authority independent of organisational titles | ✅ | Badge codes are verb-shaped (`deliverable_approve`, `pack_publish`), never role/title-shaped (`src/dblayer/seed/data/authorityVocabulary.json`). The legacy title-like family (`creator`/`reviewer`/`approver`) was deleted in `src/dblayer/migrations/043_retire_legacy_authority_badges.sql:28-32`. |

## 19.3 ⚠️ Functional Requirements (FR-22.1–7) (§6)

| FR | Verdict | Note |
|---|---|---|
| FR-22.1 every action requires authority | ✅ (one caveat) | `transitionEngine.evaluate()` is called from all 16 core entity modules owning governed transitions (25 real call sites). Caveat: `transitionEngine.ts:92` skips authority entirely when `definition.verb IS NULL` — 20 such rows exist live, but every one is test-fixture pollution (random-UUID `from_state`/`to_state`), never reachable via a real seeded transition (78 seeded rows all carry a verb). |
| FR-22.2 evaluated before execution | ✅ | Authority check runs before the policy check and before the quality-gate check, all before the caller's own `updateStatus`, at the same 25 call sites. |
| FR-22.3 rules contributed through Packs | ❌ | The live vocab is flat, global config — seeded once from `authorityVocabulary.json` or authored directly through an admin UI (`src/routes/seu/web/sdkAuthoring.ts:260-350`), never through Pack installation/composition. `compositionEngine.compose()` does read `pack.contributions?.authorityRules` and detect cross-Pack conflicts (`compositionEngine.ts:33-141`, called once from `commissioning.ts:139`) — but it operates on the retired `authority_rules` shape, structurally disconnected from the live enforcement path. |
| FR-22.4 assignments fully traceable | ⚠️ | See 19.11. |
| FR-22.5 supports delegation | ❌ | Same as AM-005 — zero code. |
| FR-22.6 multiple participating organisations | ⚠️ | See 19.5/19.13 — `badge_grants` has no `tenant_id` column at all; the noun/verb vocab tables have none either. |
| FR-22.7 conflicts detected during governance evaluation | ⚠️ | `detectGovernanceConflicts` (`compositionEngine.ts:100-141`) is real but runs once, at commissioning composition — not inside `transitionEngine.evaluate()` on each transition attempt — and never touches the live enforcement tables. |

## 19.4 ❌ Authority Components — only "Authority Rules" is real (§7)

Delegation Rules, Escalation Rules, and Exception Rules: zero matches for each (`delegat`, `escalat` — the only hits are Attention Item stalled-work escalation, unrelated to authority — and `exception.rule`, all confirmed via grep). Approval Rules aren't a distinct construct — `_approve` is just one verb among many in the flat vocab. Separation of Duties Rules are real only as an *emergent* property of which badges happen to be granted (e.g. `TESTER_APPROVER_ID` holds only `*_approve` badges, `seedIdentityBaseline.ts:39`) — there is no `separation_of_duties` table or declared-rule construct anywhere; nothing prevents a single Participant from holding both `deliverable_create` and `deliverable_approve`.

## 19.5 ❌ Authority Sources — one flat global vocabulary, no Pack/tenant dimension (§8)

`authority_nouns`, `authority_verbs`, `authority_noun_verbs` carry no `tenant_id` and no Pack-linkage column of any kind (`code, label, description, is_active, created_at` only). "Platform Packs / Organisation Packs / Domain Packs / Compliance Packs / Customer Packs" each independently contributing authority rules is not implemented — one global vocabulary, seeded once (`seedAuthorityVocabulary.ts` ← `authorityVocabulary.json`), shared by every tenant/SEU. Badges are granted to a user either through an admin UI/API (`POST /aisworg/seu/identity/grants`, `src/routes/seu/web/identity.ts:172-190`, root-gated, with a free-text badge-code input — `src/views/seu/identity/badges.ejs:152` — not a picker constrained to the real vocabulary, though `badgeGrantsDB.create()`'s `validateBadgeGrant` does validate server-side, `badgeGrantsDB.ts:96-129`) or seed-only (`seedIdentityBaseline.ts`, raw INSERTs bypassing the writer). The noun/verb vocabulary itself is not Ontology-backed — no reference to `ontology_concepts`/`category:*` anywhere in `authorityVocabularyDB.ts`, `badgeAuthorityEngine.ts`, or `seedAuthorityVocabulary.ts` — despite the `category:event-types`/`category:evidence`/`category:deliverable` pattern now established elsewhere in this platform.

## 19.6 ❌ Authority Evaluation — 2 of 8 claimed inputs actually consulted (§9)

| Input | Considered? | Note |
|---|---|---|
| requested action | ⚠️ indirect | Folded into `requiredBadge` by the caller before `authorise()` runs |
| current Deliverable state | ⚠️ indirect | Used only to select the `transition_definitions` row, not passed into the authority check itself |
| Participant identity | ✅ | `actorId` |
| fulfilled Capabilities | ❌ | Not read by `authorise()` |
| active Governance Model | ❌ | No such input exists |
| applicable Policies | ❌ | Checked separately, *after* authority (`transitionEngine.ts:101-128`) — not part of the authority decision |
| active Obligations | ❌ | Not read |
| current engineering stage | ❌ | Not read |

`badgeAuthorityEngine.authorise()` (`badgeAuthorityEngine.ts:16-24`) takes exactly `actorId` and `requiredBadge`. Evaluation is deterministic (✅ one code path, one outcome) — but a much narrower deterministic answer than the chapter describes.

## 19.7 ❌ Authority Outcomes — binary only, no rationale field (§10)

`badgeAuthorityEngine.authorise()` returns exactly `{ allowed: true; via: "root" | "badge" } | { allowed: false; reason: "missing_badge" }` (`badgeAuthorityEngine.ts:16-17`). None of "Authorised with Conditions," "Escalation Required," "Delegation Required," or "Waiver Required" exist anywhere in the authority path. `transitionEngine.ts`'s `TransitionOutcome` type stacks other failure *categories* (`no_transition_definition`, `policy_blocked`, `quality_gate_blocked`) alongside `authority_denied` — different concerns in the same function, not authority-specific outcomes. No free-text rationale field exists either; the closest thing is a badge code plus the fixed string `"missing_badge"`.

## 19.8 ❌ Delegation — wholly unimplemented (§11)

Confirmed twice already (AM-005, FR-22.5) — zero matches for `delegat` (case-insensitive) anywhere in `src/`. No delegating/receiving-authority relationship, no scope/duration/conditions concept, nothing to trace.

## 19.9 ⚠️ Authority Composition — a real Composition Engine exists but is disconnected from live enforcement (§12)

`compositionEngine.compose()` (`compositionEngine.ts:33-87`) is real: it merges Template-mandatory + Profile-optional Packs with a deterministic "later composition wins" override rule (lines 55-65), and detects cross-Pack conflicts on `authorityRules` contributions (`detectGovernanceConflicts`, lines 100-122). But it runs once, at SEU commissioning (`commissioning.ts:139`), not per-transition, and operates on the retired `pack.contributions.authorityRules` shape tied to the disabled `authority_rules` table — the live `noun_verb` vocabulary has no Pack dimension to compose (19.5). No "Effective Authority Model" artifact is ever produced from `noun_verb` badges across Packs; the flat global vocab has nothing to compose in the first place.

## 19.10 ⚠️ Separation of Duties — emergent from grant assignment, not a declared rule (§13)

Real in practice — CR-014's per-verb-actor design (`tests/sdk-authoring.test.ts`) and CR-032's dry-run suite both assert a `deliverable_approve` holder is denied `deliverable_create` — but there is no declarative, Pack-contributed SoD rule construct as the chapter describes. It's purely a consequence of which badges happen to be granted to which holder; nothing in the system enforces "the Participant who implements a Deliverable shall not approve it" as a rule — it only holds today because no seeded identity happens to hold both badges.

## 19.11 ⚠️ Authority Traceability — 4 of 8 required fields, and coverage is inconsistent (§14)

CR-014 added real accountability columns directly to `events` (migration `041_events_actor_accountability.sql`): `actor_id`, `authority_badge`. Live counts: 23,204 total events, 8,133 with `actor_id`, 8,860 with `authority_badge` — real but partial, and inconsistent even within one governed event type (`DeliverableTransitioned`: 892/892 have `authority_badge`, but only 154/892 have `actor_id`).

| Required field | Present? | Where |
|---|---|---|
| governing rule | ⚠️ | `events.authority_badge` — the badge code itself, not a rule identifier |
| originating Pack | ❌ | Not captured anywhere |
| requesting Participant | ⚠️ | Collapsed with authorised Participant — no requester-vs-authoriser distinction exists (no delegation, 19.8) |
| authorised Participant | ⚠️ | `events.actor_id` / `attestations.acting_badge_grant_id` |
| affected Deliverable | ✅ | `events.originating_object_id` / `attestations.deliverable_id` |
| applicable Governance Model | ❌ | No such concept/column anywhere |
| timestamp | ✅ | `events.occurred_at` |
| rationale | ❌ | No rationale field anywhere in the authority path (19.7) |

## 19.12 ❌ Events — 0 of 7 named events exist (§15)

`AuthorityRequested`/`AuthorityGranted`/`AuthorityDenied`/`AuthorityDelegated`/`AuthorityEscalated`/`AuthorityExpired`/`AuthorityRevoked` — confirmed zero via a static grep of all 47 distinct `eventType` literals in `src/` and a live query (`SELECT DISTINCT event_type FROM events WHERE event_type ILIKE '%authorit%'` → 0 rows). An authority denial today is a synchronous return value from `transitionEngine.evaluate()`, consumed by the calling route to flash an error — never published to the Event Bus.

## 19.13 ⚠️ Non-Functional Requirements (§16)

| NFR | Verdict | Note |
|---|---|---|
| deterministic evaluation | ✅ | Single lookup, no ambiguity |
| composition from multiple organisations | ❌ | 19.5/19.9 — flat global vocab, no tenant dimension on the live `authority_nouns/verbs/noun_verbs` tables. The legacy `badge_types` table does carry `tenant_id` (partial unique index `idx_badge_types_tenant_code`) — tenant-scoping exists structurally elsewhere in the badge system, just not on the tables that actually gate transitions. `badge_grants` (which actor holds which badge) has no `tenant_id` column at all. |
| complete traceability | ⚠️ | 19.11 — partial and inconsistent |
| dynamic delegation | ❌ | 19.8 |
| independent of Participant implementations | ✅ | `authorise()` takes a bare `actorId: string`, no Participant-type coupling |

## 19.14 ⚠️ Acceptance Criteria (§17)

| Criterion | Verdict |
|---|---|
| Every governed action requires explicit authority | ✅ (FR-22.1's null-verb caveat, currently unreachable in the real seed graph) |
| Authority evaluated contextually | ⚠️ — only via which badge gets selected, not the check itself |
| Authority rules from multiple organisations composed | ❌ |
| Delegation explicit and traceable | ❌ — doesn't exist |
| Separation-of-duties enforced | ⚠️ — emergent from grants, not a declared/enforced rule |
| Authority decisions explainable and reproducible | ⚠️ — reproducible (deterministic), explainable only to "which badge, held or not" |

## 19.15 ⚠️ Deliverables (§18)

| Chapter deliverable | Real artifact | Verdict |
|---|---|---|
| Authority domain model | `BadgeGrantRow`/`BadgeTypeRow` (`seuTypes.ts`); `authority_nouns`/`authority_verbs`/`authority_noun_verbs`/`badge_grants`/`badge_types` tables | ✅ exists, but flat — no delegation/escalation/SoD sub-models |
| Authority evaluation service | `badgeAuthorityEngine.ts` + `transitionEngine.ts` | ✅ exists, narrow (19.6/19.7) |
| Delegation service | — | ❌ none |
| Authority registry | `authorityVocabularyDB.ts` + `badgeGrantsDB.ts`/`badgeTypesDB.ts` | ✅ exists |
| Authority APIs | `src/routes/seu/web/identity.ts` + `src/routes/seu/web/sdkAuthoring.ts:260-350` | ✅ exists, admin-only |
| Authority events | — | ❌ none, confirmed 19.12 |
| Authority traceability service | — | ❌ no dedicated service; partial passive capture via `events.actor_id`/`authority_badge` (19.11) |

## Summary — ranked

1. **[Code, most consequential]** The live authority check is a flat, two-input badge lookup (`actorId` + `requiredBadge`), not the 8-input contextual evaluation the chapter describes (19.6) — the core mechanism is real and philosophically aligned (authority ≠ role, AM-001/AM-006), but far narrower in practice than §9/§10 claim.
2. **[Code]** Delegation does not exist in any form — zero matches for `delegat` anywhere in `src/` (19.4, 19.8, AM-005, FR-22.5).
3. **[Code]** The live `noun_verb` vocabulary has no Pack or tenant dimension at all — "Authority rules contributed through Packs" (FR-22.3) does not hold; a real Composition Engine and conflict-detector exist (19.9) but operate on the retired `authority_rules` shape, structurally disconnected from live enforcement.
4. **[Code]** Zero `Authority*` events are ever published — confirmed by both static grep and a live query returning 0 rows (19.12).
5. **[Code]** Traceability is real but partial and inconsistent — `actor_id` is populated on only 154/892 `DeliverableTransitioned` events despite `authority_badge` being on all 892; no originating Pack, governing Governance Model, or rationale is ever captured (19.11).
6. **[Code]** Escalation Rules, Exception Rules, and declared Separation-of-Duties rules don't exist as constructs — SoD holds today only as an accident of which badges happen to be granted to which identity, not as an enforced rule (19.4, 19.10).
7. **[Code]** Authority outcomes are binary (`allowed: true/false`) — "Authorised with Conditions," "Escalation Required," "Delegation Required," and "Waiver Required" are chapter-only concepts with no code counterpart (19.7).
8. **[Data structure]** The badge vocabulary is not tenant-scoped (`badge_grants` has no `tenant_id`) and not Ontology-backed, despite the `category:*` pattern now established for comparable vocabularies elsewhere in the platform (19.5, 19.13).