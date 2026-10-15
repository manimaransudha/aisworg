# CR-121 — One governed transition evaluation (authority, policy, Quality Gate) shared by every transition function

**Raised:** 2026-10-15 · **Origin:** the same rejection mapping, authority-badge guard, author resolution and Quality Gate call are repeated across the transition functions (Ch.21 §6 FR-21.3, Ch.22 §6 FR-22.2, Ch.26 §10, Ch.29 §5 SM-004).

**Status:** 🟡 Built (first pass) pending verification — 2026-10-15

## Specification read before this CR

| Chapter | Statements this CR relies on |
|---|---|
| Ch.21 Governance | FR-21.3: governance is evaluated before every significant Deliverable state transition. FR-21.4: evaluations are deterministic. §10: a transition is Rejected or Deferred only on a mandatory Policy violation, an unresolved blocking Obligation or missing Authority. A Standard deviation never blocks. Every outcome records a rationale. §16 lists a Governance evaluation service as a deliverable. |
| Ch.22 Authority | FR-22.1: every governed action requires explicit authority. FR-22.2: authority is evaluated before execution. A governed transition with no verb has no authority to evaluate. |
| Ch.26 Quality Gate | QG-002: gates evaluate readiness and do not modify state. §10: gates are evaluated whenever a governed transition is requested. §11: the outcome is an input to Governance, and Governance decides whether the transition proceeds. §14: every evaluation preserves its traceability. |
| Ch.29 State Management | SM-003, SM-004: transitions are deterministic and atomic. FR-29.3: the kernel validates a transition before committing it. |
| Ch.30 Event | Events are published only after the state transition has completed successfully. |
| Ch.31 Execution Engine | EE-006: execution never bypasses governance. |

## Fix the following

- `transitionEngine.evaluate` evaluates authority, submission, policies and the Quality Gates pinned on the Transition Definition. Eight entity functions then call `qualityGateEngine.evaluate` again for the category-matched gates: `decisions.ts`, `knowledge.ts`, `evidence.ts`, `attentionItems.ts`, `obligations.ts`, `externalInteractions.ts`, `reviews.ts` and `executionEngine.ts`.
- After `evaluate`, each of those functions repeats: guard `if (!gate.authorityBadge) throw`, `resolveAuthor(seuId, actorId)`, the Quality Gate call, and the mapping of `Blocked` to `quality_gate_blocked`.
- The `gate.reason` to result mapping (`authority_denied`, `no_transition_definition`, `policy_blocked`, `quality_gate_blocked`, `not_submitted`) is repeated in 22 places.
- The authority-badge guard appears 25 times. In the Quality Gate functions it exists because the gate call needs a `string` badge. In the others it exists so the event publish gets a badge.

## Design

- A single governed evaluation, `transitionEngine.evaluateGoverned(input)`, runs in a fixed order: `evaluate`, the authority-badge requirement, author resolution, the category-matched Quality Gates.
- It returns the existing rejection reasons, or an allowed outcome that carries `authorityBadge: string`, `authorId: string`, the event type, the version event and the Quality Gate result. A transition definition with no verb throws once, inside this evaluation.
- The rejection mapping is one shared function used by every transition function.
- Event publishing stays in each entity's transition function, after its own state change. The evaluation neither publishes nor changes state.
- The entity-specific work stays in the entity functions: the status update, comments, version handling and ontology sync.
- Quality Gate evaluation does not change engineering state (QG-002). The new evaluation does not either.

## Scope

- In scope: the eight Quality Gate functions first, then the transition functions that only use the guard for the event publish (Pack, Profile, Template, Capability, Policy, Service, EBM, SEU, Participant, Finding, Deliverable Definition).
- Out of scope: event publishing, the `requireBadge` middleware, `route_authority`, and the status updates.

## Test fixtures to update in the same pass

- Tests that assert a rejection reason or a quality-gate outcome: the lifecycle-table tests, `governance-depth.test.ts`, `governance-ebm-sharpening.test.ts`, `sustained-pattern-generalization.test.ts` and the web-flow Phases that assert blocked transitions.
- Tests that create ad-hoc transition definitions need a verb (see the `test-fixtures` skill).

## Built (2026-10-15, first pass)

- `src/domain/engine/transitionEngine.ts`: `evaluateGoverned(input)` and `gateRejection(gate, entityLabel, fromState, toState)`. The evaluation runs `evaluate`, requires the authority badge, resolves the author's `participants` row for the SEU and evaluates the category-matched Quality Gates. It returns the existing rejection reasons or an allowed outcome that carries `authorityBadge: string` and `authorId`. It publishes nothing and changes no state.
- Converted: `transitionEvidence`, `transitionAttentionItem`, `transitionObligation`, `transitionExternalInteraction`, `transitionReview`, `transitionDecision`, `transitionKnowledgeItem`. Each keeps its own status update and event publishing after the evaluation.
- Not converted: `executionEngine.evaluateDeliverableTransition`. It resolves the Transition Definition, the authority badge and the Quality Gates itself and does not call `transitionEngine.evaluate`.
- Not yet converted: the transition functions that use the badge guard only for the event publish (Pack, Profile, Template, Capability, Policy, Service, EBM, SEU, Participant, Finding, Deliverable Definition).
- Verification: `pnpm typecheck` 0 errors. The 14 test files that call the converted functions pass (58 of 58).

## Second pass design (whiteboard, 2026-10-15)

Facts from the code:
- None of the remaining transition functions evaluates category-matched Quality Gates. Definition-level entities (Pack, Profile, Template, Capability, Policy, Service, Deliverable Definition, Ontology, SchemaDefinition, Objective) pass no `seuId`, so even the pinned gates do not run for them.
- Participant, Finding, EBM and the SEU hops are SEU-scoped. Participant and the SEU commissioning hops pass a `seuId`. Finding and EBM pass none.
- `alternateBadges` is used by the Pack (via `alternateBadgesForPackTransition`) and Ontology transitions.
- `executionEngine.evaluateDeliverableTransition` does not call `transitionEngine.evaluate`. It resolves the Transition Definition, authority, dependency, obligation and decision blocks, and policy outcomes itself, and records a governance outcome draft.

Principle (design papers: Technical Manifesto, Short Communications; owner, 2026-10-15): the platform has a declaration part (`01_Engineering Definition`: Pack, Capability, Service, Template, Profile and the other definitions) and an execution part (an SEU composes behaviour from the definitions to execute an Objective). Execution is governed by authority, policy and Quality Gates, so that no Deliverable is ever self-certified. One generic evaluation applies to every governed execution entity.

Proposed shapes:

| Pass | Group | Functions | Evaluation |
|---|---|---|---|
| Second | A. Declaration | Pack, Profile, Template, Capability, Policy, Service, Deliverable Definition, Ontology, SchemaDefinition (2 hops), Objective, EBM, the SEU commissioning hops, `validateRequest` | `transitionEngine.evaluateAuthorised(input)`: `evaluate`, then the authority-badge requirement. Returns `authorityBadge: string`. The EBM and the SEU commissioning hops are still the definition of that particular SEU, so there is no author resolution and no category-matched gates. |
| Second | B. Execution | Finding, `promoteKnowledgeItemScope`, Participant | `evaluateGoverned`, which adds the category-matched gates (a behaviour change for these three). |
| Third | C. Deliverable | `executionEngine.evaluateDeliverableTransition` and the commence-work path | The Execution Engine is the component responsible for governing execution. It has its own design, together with KI-001 (the automatic commence-work rescan race). |

- `gateRejection` replaces the 22 hand-written mappings. Functions with extra rejection reasons (Pack, Profile) map those reasons after calling it.
- `evaluateGoverned` calls `evaluateAuthorised` internally, so the badge requirement exists once.
- Event publishing and status updates stay in each function.

## Third pass design (whiteboard, 2026-10-15)

Specification read: Ch.14 Deliverable (§10, §11, §14, §16: transitions are governed, traceable and may be triggered by completed execution, accepted decisions, approved evidence, resolved obligations, dependency satisfaction and governance approvals), Ch.31 Execution Engine (EE-006: never bypass governance; §9 cycle: evaluate governance, request capabilities, generate Commands), Ch.32 Work Item (WI-005, §12: completing a Work Item does not itself change engineering state, and further governance evaluation remains required), Ch.33 Dispatch Engine (dispatch respects Authority and Governance, FR-33.6), Ch.37 SEU Lifecycle.

Facts from the code:

- `executionEngine.evaluateDeliverableTransition` runs its own governance chain: dependency readiness, open SEU and Deliverable Obligations, open Decisions, in-flight Command, Transition Definition, authority badge, category Quality Gates, `policyEngine` Policies, submission, and the "empty centre" check. It does not call `transitionEngine.evaluate`, so the authority, submission and gate checks exist twice in different forms.
- `deliverableKickoffHandler` runs on `SEUOperational`, `DeliverableTransitioned`, `ObligationTransitioned` and `AttentionItemTransitioned`. For every Deliverable it calls `transitionDeliverable` for every possible next hop, with no filter on the Transition Definition's `trigger`. All three Deliverable rows (`Defined -> In Progress`, `In Progress -> Approved`, `Approved -> Baselined`) carry the default `manual` trigger.
- A manual request (web or API) and the automatic kickoff therefore race for the same hop. The first creates the Command. The second gets `already_in_flight`. The kickoff also consumes the SEU's only fulfilled Participant. This is KI-001: it explains why Phase 5, Phase 7, `attestation` and `backward navigation` see a Command already in flight, deferred, or evaluated before the test's own Obligation exists.
- The records the engine creates are authored with the requesting actor's `participants` row: the Quality Gate evaluation (first pass `evaluateGoverned` and `executionEngine`), the governance outcome and the eligible-participant pool.

Proposed design:

1. Authorship (CR-122): the Quality Gate evaluation, the governance outcome and the pool are created by the engine, so the SEU's system participant authors them. `evaluateGoverned` no longer resolves the actor's `participants` row. This also removes the Participant release problem.
2. One authority and gate chain: `evaluateDeliverableTransition` calls `transitionEngine.evaluateGoverned` for the Transition Definition, authority, badge, submission, pinned policies and gates, and the category Quality Gates. The Deliverable-specific checks stay in the engine, run before it (dependency readiness, open Obligations and Decisions, in-flight Command), and after it (`policyEngine`, empty centre). The governance outcome draft is built from the result.
3. KI-001: the kickoff fires only hops whose Transition Definition `trigger` is `governed`. A `manual` hop is requested by a participant holding the badge, through the web or the API, and is governed the same way. This needs one data change in `transitionDefinitions.json`: `Defined -> In Progress` gets `trigger: "governed"` (the engine commences the work). `In Progress -> Approved` and `Approved -> Baselined` stay `manual`.
4. Event publishing and the Command, Work Item and dispatch flow are unchanged.

### Third pass: settled decisions (owner, 2026-10-15)

- A Deliverable has a definition part (Service, Template, Profile, SEU commissioning, EBM) and an execution part inside the SEU. The Deliverable Definition names the evidence a hop requires. The evidence definition is not fully built and is addressed later.
- The button is shown as for every entity: the current state has a hop with `trigger` `manual` and the viewer holds the hop's verb badge.
- A click on a Deliverable button issues a Command (for example "<Deliverable> reviewed") with the required evidence. It does not request the transition.
- The Execution Engine governs the Command. It runs the Quality Gate and governance, and calls the transition only when they pass.
- The transition runs as the SEU system participant. The system actor acts as root, but only for `deliverable_*` badges. The badge recorded on the transition is the hop's verb badge (for example `deliverable_approve`).
- The Quality Gate evaluation, the governance outcome and the eligible-participant pool are authored by the SEU system participant.
- The kickoff fires only hops whose `trigger` is `governed` (`Defined -> In Progress`). `In Progress -> Approved` and `Approved -> Baselined` stay `manual`. This closes KI-001.

## Still open

- Third pass: `executionEngine`, designed together with KI-001 in `design/Known Issues.md`. The decisions above are settled. The build is pending.
- Whether the Quality Gate result should be returned for traceability (Ch.26 §14) in the allowed outcome.
