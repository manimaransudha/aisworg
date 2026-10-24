# CR-133 — Review and Finding (Chapter 25): birth rows, generic transition, and the gaps against the chapter

**Raised:** 2026-10-22 · **Origin:** CR-128, Entities 17 and 18 (Review, Finding). As for Decision (CR-131) and Knowledge (CR-132), the owner asked for a CR of its own covering the CR-128 birth-row work and every gap found against the chapter.

**Status:** ✅ Built 2026-10-23. ALTERs for the live tables: `ALTER TABLE reviews ALTER COLUMN status DROP DEFAULT; ALTER TABLE findings ALTER COLUMN status DROP DEFAULT;`

## Sources read

| Source | Path |
|---|---|
| Chapter 25 (Review Model) | `src/docs/SEU Studio Specifications/04_Governance/25_Review.md` |
| Traceability report | `src/docs/implementation/25_Review_Model_Traceability.md` |
| Code | `src/routes/seu/core/reviews.ts`, `src/routes/seu/core/findings.ts`, `src/routes/seu/api/reviews.ts`, `src/routes/seu/web/reviews.ts`, `src/dblayer/reviewsDB.ts`, `findingsDB.ts`, `reviews_schema_recovery.sql`, `findings_schema_recovery.sql` |
| Consumers | `qualityGateEngine.ts`, `core/compliance.ts` (`requires_accepted_review`), `core/traceability.ts`, `core/demoSimulator.ts` |

## Carried over from CR-128

| # | CR-128 item | What applies |
|---|---|---|
| 1 | Design 3, 5, 6, 7 (birth row, creation badge `{noun}_{verb}`, `findBirth`) | Review birth row `None → Planned` (`review_create`). Finding birth row `None → Open` (`finding_create`). |
| 2 | Design 12 and open question 1 | A Finding row `Open → Converted`, verb `convert`, so that `convertFindingToObligation` moves the Finding through a row. The badge is `finding_convert`. Whether `Converted` is a new Finding state is still open (D3). |
| 3 | Entity 12 to 15 pattern | `findBirth` for state and event, `transitionEntity` plus `publishTransition`, the generic `<Entity>Transitioned` event last, `evaluateGoverned` through an adapter `seuId`, one `route_authority` row per verb, one button per manual action, API transition routes commented out when they have no caller, status DEFAULT dropped. |
| 4 | Version Feature Plan | The five Review rows and the two Finding rows carry no `eventType` and no `version_event`. They gain them at build time. |

## What the code does today

| # | Finding |
|---|---|
| F1 | No birth row for Review or Finding. `createReview` publishes the literal `ReviewPlanned` and `createFinding` the literal `FindingCreated`; both rely on the column default for the state. |
| F2 | The Review rows (`Planned → Prepared → In Progress → Completed → Accepted → Archived`) and the Finding rows (`Open → Resolved`, `Open → Waived`) name no `eventType` and no `version_event`. The events come from literals in code. |
| F3 | `transitionReview` is its own copy of the transition flow. It calls `evaluateGoverned` and has no adapter and no `transitionEntity` call. Its `Completed` branch writes the outcome with `completeWithOutcome` and publishes `ReviewCompleted` and then `ReviewPassed`, `ReviewDeferred` or `ReviewFailed`, each with its own `correlationId`. The other branch publishes `ReviewStarted` for `In Progress` and the literal `ReviewTransitioned` for every other hop. |
| F4 | `transitionFinding` calls `transitionEngine.evaluate`, so a Finding hop passes no Quality Gate and no SEU participant check. It publishes `FindingResolved` for `Resolved` and the literal `FindingTransitioned` for `Waived`. |
| F5 | `convertFindingToObligation` creates an Obligation and sets `findings.obligation_id`. It moves no state and publishes no event. The Finding stays `Open`. |
| F6 | `createFinding` raises an Attention Item after publishing `FindingCreated` for severity High or Critical. `BLOCKING_SEVERITIES` is a literal set in code. The Attention Item is raised as the SEU's system actor. |
| F7 | `PASSING_OUTCOMES` (`Passed`, `Passed with Recommendations`) is a literal set in `reviews.ts`, and `QUALIFYING_REVIEW_OUTCOMES` is another in `compliance.ts`. |
| F8 | `listReviewsWithNextStates` uses `findPossibleNextStates` (no manual-trigger filter, no held-badge filter). The Review and Finding web routes take `targetState` from the form. |
| F9 | `reviews_schema_recovery.sql` has `status ... DEFAULT 'Planned'`; `findings_schema_recovery.sql` has `status ... DEFAULT 'Open'`. `reviews.version` is `INTEGER DEFAULT 1` and is never changed. |
| F10 | Neither table has a tenant column. A version event needs the SEU's tenant, as for the other SEU-scoped entities. |
| F11 | `route_authority` has API and web rows for reviews, review findings, and finding transition and convert. The transition rows carry no verb rows. |
| F12 | `createReview` and `createFinding` resolve their own author through a local `resolveAuthorId`, a copy of `resolveAuthor`. |

## Gaps against Chapter 25

| # | Chapter item | Gap | Proposed |
|---|---|---|---|
| G1 | §4, RM-006, FR-25.3, §11 | A Review is not an evaluation. The outcome is supplied by the caller and `criteria` is stored and never interpreted. | Owner to decide (largest item; likely its own design). |
| G2 | §8 | Structure is short of Review Scope, Required Evidence, Required Participants and Recommendations. `version` is never incremented. | Owner to decide. |
| G3 | §7, FR-25.7 | Review Category has no Ontology backing (settled earlier by CR-059, per the report). | Recorded; no change unless the owner reopens it. |
| G4 | RM-004, §14 | Composition is override on collision, not a union of requirements. | Owner to decide. |
| G5 | §13 | Findings lead to Obligations (built). Evidence requests, Decisions and follow-up Reviews have no code path. | Owner to decide. |
| G6 | FR-25.5, §12 | Outcome immutability is enforced in `transitionReview` by a check, and by no database constraint. | Owner to decide. |
| G7 | §16 | All eight events exist. `ReviewTransitioned` and `FindingTransitioned` are literals that no row names. | The shared path publishes the row's event and the generic event. |
| G8 | §15 | Provenance: reviewed object, supporting Evidence, generated Findings, reviewing Participants, EBM version. Evidence and Decisions are not linked on the row; the EBM version is not recorded. | Owner to decide. |
| G9 | §10 | Review lifecycle is built as written. Finding has `Resolved` and `Waived`, which the chapter does not list. `Converted` is added (D3). | Settled with D3. |
| G10 | §9 | Review Gates and Checklists are Pack contributions with their own table. `reviews.review_gate_id` links a Review to its gate. | Out of scope. |

## Decisions

| # | Decision | Status |
|---|---|---|
| D1 | CR-128 Entities 17 and 18 are closed by this CR. | Settled (precedent) |
| D2 | Review and Finding are built in one CR, in this order: Review, then Finding. | Settled (owner asked to build CR-133) |
| D3 | The Finding state for a converted Finding: `Converted` is added (CR-128 open question 1). The row `Open → Converted` has verb `convert`. `obligation_id` stays as the link. | Settled (owner) |
| D4 | Built: the birth rows, the shared transition, the row events (G7), `Converted`, buttons, the schema. Recorded and not built: G1, G2, G4, G5, G6, G8. G3 and G10 stay as recorded. | Settled for the build |
| D5 | The steps follow the Obligation, Evidence, AttentionItem, Decision and Knowledge pattern. | Settled (precedent) |

## Build

| # | Piece | State |
|---|---|---|
| 1 | Rows: birth rows `None → Planned` and `None → Open` (verb `create`, trigger `governed`); events on every hop (`ReviewPrepared`, `ReviewStarted`, `ReviewCompleted`, `ReviewAccepted`, `ReviewArchived`, `FindingResolved`, `FindingWaived`, `FindingConverted`; the last four of those and `ReviewPrepared`, `ReviewAccepted`, `ReviewArchived` are new names, as `ParticipantExecuting`); the row `Open → Converted` (verb `convert`); actions `complete-review` and `convert-finding`. Verb routes replace the old web and API transition rows (Review: `prepare`, `start`, `complete`, `accept`, `archive`; Finding: `resolve`, `waive`; `convert` keeps its own route). `ReviewTransitioned` and `FindingTransitioned` are registered. | Built ✅ |
| 2 | Schema: both `status` columns lose their DEFAULT. | Built ✅ |
| 3 | `reviewsDB.create` and `findingsDB.create` take the status; `reviewsDB.setOutcome` replaces `completeWithOutcome`; `reviewAdapter` and `findingAdapter` are registered. | Built ✅ |
| 4 | `createReview` and `createFinding` read the birth row. | Built ✅ |
| 5 | `transitionReview` and `transitionFinding` use `transitionEntity` and `publishTransition`, then the generic event last. Completion sets the outcome in the `complete-review` action and then publishes the outcome event (`ReviewPassed`, `ReviewDeferred` or `ReviewFailed`) before `ReviewTransitioned`. `convertFindingToObligation` raises the Obligation, then takes the `Open → Converted` hop with the `convert-finding` action. `listReviewsWithNextStates` is removed; buttons come from `nextActionsFor`. The Review and Finding API transition routes are commented out. | Built ✅ |
| 6 | Tests | Built. Not run. New `review-finding-event-lifecycle-table.test.ts`; Quality Gate refusals for Review and Finding in `quality-gate-generalization.test.ts`; `review-model.test.ts` updated (a Converted Finding is not resolved). |
| 7 | `25_Review_Model_Traceability.md` | Built ✅ |

Behaviour changes to confirm: a Converted Finding has no resolve hop (the earlier test resolved a converted Finding); the Obligation is raised before the Finding hop, so a refusal at the hop leaves the Obligation (the hop is pre-checked first); the Review completion event payload is now `{ fromState, toState }` and the outcome is on the `ReviewPassed`, `ReviewDeferred` and `ReviewFailed` events.
