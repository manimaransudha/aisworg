# CR-131 — Decision (Chapter 19): birth row, generic transition, and the gaps against the chapter

**Raised:** 2026-10-22 · **Origin:** CR-128, Entity 15 (Decision). The owner asked for the Decision work to be a CR of its own, covering the CR-128 birth-row work and every gap found against Chapter 19.

**Status:** ✅ Built. Tests pass (owner). Open and not built: G3 and F7 (CR-127), G5 form fields, G6, G8, G10.

## Sources read

| Source | Path |
|---|---|
| Chapter 19 (Decision Model) | `src/docs/SEU Studio Specifications/03_Trust Pipeline/19_Decision.md` |
| Traceability report | `src/docs/implementation/19_Decision_Model_Traceability.md` |
| Code | `src/routes/seu/core/decisions.ts`, `src/routes/seu/api/decisions.ts`, `src/dblayer/decisionsDB.ts`, `src/dblayer/recovery/decisions_schema_recovery.sql`, `seuTypes.ts` (`DecisionRow`) |
| Consumers | `qualityGateEngine.ts`, `dependencyDefinitionEngine.ts`, `executionEngine.ts`, `workItemGenerator.ts`, `core/compliance.ts`, `core/traceability.ts`, `core/seus.ts`, `web/seus.ts`, `views/seu/seus/detail.ejs` |

## Carried over from CR-128

| # | CR-128 item | What applies to Decision |
|---|---|---|
| 1 | Design 3, 5, 6, 7 (birth row, creation badge `{noun}_{verb}`, `findBirth`, the create path reads state, verb and event from the row) | A birth row `None → Identified`, verb `identify`, event `DecisionIdentified`. The badge stays `decision_identify`. |
| 2 | Design 13 (`authoringMappings` removed) | The mapping `Decision identify` (`authorityVocabulary.json`, "Record a Decision as Identified") is covered by the birth row. |
| 3 | Entity 12 to 14 pattern | `findBirth` for state and event, `transitionEntity` plus `publishTransition`, the generic `DecisionTransitioned` event last, `evaluateGoverned` through an adapter `seuId`, one `route_authority` row per verb, one button per manual action, the API transition route commented out when it has no callers, status column DEFAULT dropped. |
| 4 | Version Feature Plan | The seven hops already carry `version_event`. The birth row carries `VersionCreated` only if the plan gives Decision a version (see G7). |

## What the code does today

| # | Finding |
|---|---|
| F1 | No birth row. `createDecision` resolves the badge with `resolveAuthorBadge(actorId, "decision_identify")`, writes the row with the column default `Identified` and publishes the literal `DecisionIdentified`. |
| F2 | `transitionDecision` uses its own copy of the transition flow (`evaluateGoverned`, `updateStatus`, publish). There is no `decisionAdapter`, no `transitionEntity` call and no generic `DecisionTransitioned` event. |
| F3 | Buttons: `listDecisionsWithNextStates` uses `findPossibleNextStates` (every next state, no `trigger==="manual"` filter, no held-badge filter). The web route takes `targetState` from the form. |
| F4 | `decisions_schema_recovery.sql` has `status TEXT NOT NULL DEFAULT 'Identified'`. `decisionsDB.create` does not write `status`. |
| F5 | The API has `POST /api/seu/decisions/:id/transition`. The route has no caller outside tests (to confirm). |
| F6 | `route_authority` has one web transition row, `/seus/:id/decisions/:decisionId/transition`, with no verb rows. |
| F7 | `QUALIFYING_DECISION_STATUSES = new Set(["Approved", "Applied"])` is declared in both `qualityGateEngine.ts` and `compliance.ts`. `createDecision` compares `related_object_type` with the literal `"Deliverable"`. These are literals outside `constants.ts` (CR-127 territory). |

## Gaps against Chapter 19

| # | Chapter item | Gap | Proposed |
|---|---|---|---|
| G1 | DM-002, FR-19.2 | `evidenceIds` may be empty. | Owner: checked on save. At least one of Evidence or Knowledge, or both. G1 and G2 are one rule. Built. |
| G2 | DM-003, FR-19.3 | `knowledgeIds` may be empty. | Same rule as G1. Built. |
| G3 | §9 | "Only Approved Decisions may influence Deliverable state transitions." Gates and dependencies accept Approved and Applied. `executionEngine` blocks on Decisions not yet Approved. | Confirm Applied counts as Approved-or-later. Move the status set to one place. |
| G4 | FR-19.6, §15 | No supersession pointer. `Applied → Superseded` carries no link to the Decision that replaces it. | Owner: add a new column, `superseded_by` (nullable UUID, the replacing Decision). The `Applied → Superseded` row names an action, registered in `src/actions` like `supersedeObjective` (CR-129). The action calls `supersessionEngine.check` (CR-116) with a Decision candidate finder, then sets `superseded_by`. The replacing Decision and the comment arrive in the hop context. Owner: it calls the supersession function. |
| G5 | §12 | Re-checked. `DecisionAlternative` already holds `statement` (why considered), `status` (selected or rejected), `rationale` (why preferred or why rejected) and `consequences[]`. The model covers the four parts. The web form fills only `statement` and `rationale`. | Owner expected this to be done. No model change. Form fields for consequences and assumptions are a UI item (open). |
| G6 | §14 | `participant_id` and `authority_badge` are overwritten on each hop. Approval history lives only in the events. | Owner: stays open. |
| G7 | §8, §15 | Decision hops set `version_event`, but `transitionDecision` publishes its own event, so the hop writes no `version_events` row. Moving to `transitionEntity` and `publishTransition` writes one `version_events` row per hop (entity, from and to state, version event, actor, badge, time), as for Obligation, Evidence and AttentionItem. That row is the history; the Decision row keeps its current state. | Owner: the version event is the new record. Built by the CR-128 pattern. No new column (settled). |
| G8 | §13, NFR reuse | `related_seu` is stored and never read. No search or recommendation over historical Decisions. | Out of scope here unless the owner decides otherwise. |
| G9 | §10 | `related_objects` (JSON, groups of `related_object_type` and `related_object_ids`) already saves the references it is given. Owner: the SEU is also an object in the references. `seu_id` stays: it is the SEU that owns the Decision. The SEU references are other SEUs the Decision refers to. A `related_seu` JSON column in the same group shape already holds such references (stored, never read). | Built: the SEU references are saved as an `SEU` group in `related_objects` (owner). `related_seu` is left as it is. |
| G10 | §7 | Pack-contributed categories are not wired (CR-056). | Owner: open for now. |

## Decisions

| # | Decision | Status |
|---|---|---|
| D1 | CR-128 Entity 15 is closed by this CR. The CR-128 table rows for Decision stay as the record of the lifecycle. | Settled (owner) |
| D2 | Which of G1 to G9 are built in this CR, and which are recorded and left. | Open |
| D4 | G7: history is the `version_events` row written on each hop through `transitionEntity`. | Settled (owner) |
| D5 | G9: references to other SEUs are saved as an `SEU` group in `related_objects`. `seu_id` stays as the owning SEU. | Settled (owner) |
| D3 | Steps 1 to 6 follow the Obligation, Evidence and AttentionItem pattern (rows, DB function, create path, hops, routes and buttons, tests). | Settled (owner) |


## Build steps

### Step 1: the data

| # | Change |
|---|---|
| 1 | `transitionDefinitions.json`: birth row `None → Identified`, verb `identify` (badge `decision_identify`, already in the vocabulary), trigger `governed`, event `DecisionIdentified`, no version event, policies as the other Decision rows. The `Applied → Superseded` row gains `actionCode` `supersede-decision`. The other six rows are unchanged. |
| 2 | `routeAuthority.json`: remove `POST /aisworg/seu/seus/:id/decisions/:decisionId/transition` and the API row `POST /aisworg/api/seu/decisions/:id/transition`. Add one web row `.../decisions/:decisionId/transition/<verb>` for each of `analyse`, `propose`, `review`, `approve`, `apply`, `supersede` and `archive`, badge `decision_<verb>`. |
| 3 | `eventSubscriptions.json`: add `DecisionTransitioned` (published by `transitionDecision` for every hop, after the row's event, no subscriber). |
| 4 | `authorityVocabulary.json`: no change. The authoring mappings are already gone and all eight verbs are verbs (`identify` is shared with Obligation). |
| 5 | `constants.ts`: `SUPERSEDE_DECISION_ACTION_CODE = "supersede-decision"`. |

### Step 2: the schema

| # | Change |
|---|---|
| 1 | `decisions_schema_recovery.sql`: `status TEXT NOT NULL` with no default, and `superseded_by UUID REFERENCES decisions(id)` (nullable). |
| 2 | The ALTER for the live table: `ALTER TABLE decisions ALTER COLUMN status DROP DEFAULT; ALTER TABLE decisions ADD COLUMN IF NOT EXISTS superseded_by UUID REFERENCES decisions(id);`. No data changes. |
| 3 | `DecisionRow` gains `superseded_by: string | null`. |

### Step 3: the database function, the adapter and the action

| # | Change |
|---|---|
| 1 | `decisionsDB.create` takes a required `status` and writes it. `decisionsDB.setSupersededBy(id, supersededBy)` is added. |
| 2 | `entityAdapters.ts`: `decisionAdapter` (`findById`, `getState` is `status`, `setState` calls `updateStatus` with the actor's `participants.id` in the SEU and the badge, `seuId` returns `seu_id`, `tenantId` is the SEU's tenant, as Obligation). Registered under `Decision`. |
| 3 | `src/actions/supersedeDecision.ts`, registered in `src/actions/index.ts`. It calls `supersessionEngine.check` with a finder over `decisionsDB.findById`, refuses by throwing, then calls `setSupersededBy`. The replacing Decision and the comment come from the hop context. |

### Step 4: creation (G1, G2, G9)

| # | Change |
|---|---|
| 1 | `createDecision` reads the birth row with `findBirth` for the state and the event and keeps `resolveAuthorBadge(actorId, "decision_identify")`. It passes the state to `decisionsDB.create`. The literal `DecisionIdentified` is removed. |
| 2 | G1 and G2: on save, `createDecision` throws when `evidenceIds` and `knowledgeIds` are both empty. One of the two, or both, is enough. The web form requires one of the Knowledge and Evidence fields. The API handler returns 400. |
| 3 | G9: `related_objects` accepts a group whose type is `SEU` (other SEUs the Decision refers to) beside the Deliverable group. No other check is added. `seu_id` and `related_seu` are unchanged. |

### Step 5: the hop and the buttons

| # | Change |
|---|---|
| 1 | `transitionDecision` keeps its signature (with the optional `context` for the supersede hop) and result type. It calls `transitionEntity`, then `publishTransition(result)`, then publishes `DecisionTransitioned` with the same `correlationId` as its last statement. `decisionsDB.updateStatus` is called only by the adapter. |
| 2 | Each hop with a `version_event` now writes its `version_events` row (G7). No version column. |
| 3 | `listDecisionsWithNextStates` returns `actions` from `nextActionsFor("Decision", status, actorId)`. `SeuDetailDecision` and `core/seus.ts` carry `actions`. |
| 4 | The web route becomes `POST /seus/:id/decisions/:decisionId/transition/:verb`. It looks up the action for the verb in `nextActionsFor` and calls `transitionDecision` with its `toState`. The supersede verb reads the replacing Decision id and the comment from the body. |
| 5 | `detail.ejs`: one button per action. The supersede button has a picker of the SEU's other Decisions and a comment field, as Objective supersede. |
| 6 | `api/decisions.ts`: the route `POST /decisions/:id/transition` is commented out (no caller, owner precedent). |

### Step 6: left alone

| # | Item |
|---|---|
| 1 | Consumers of `decisions.status` (`qualityGateEngine`, `dependencyDefinitionEngine`, `executionEngine`, `workItemGenerator`, `compliance`, `traceability`) are unchanged. G3 and F7 (the repeated status set and the `"Deliverable"` literal) go to CR-127. |
| 2 | G5 form fields, G6, G8 and G10 are recorded and not built. |

## Tests

| # | Test | Asserts |
|---|---|---|
| 1 | `decision-event-lifecycle-table.test.ts` definition | Eight rows, birth row `None → Identified` (`identify`, `governed`, `DecisionIdentified`, no version event), the Superseded row names `supersede-decision`, every other row keeps its event and version event. |
| 2 | Creation | State `Identified` from the birth row, `DecisionIdentified` published last. Both `evidenceIds` and `knowledgeIds` empty throws. Evidence only, Knowledge only and both succeed. A group of type `SEU` is saved in `related_objects`. |
| 3 | Hop | `transitionDecision` publishes the row's event, writes the `version_events` row where the row names a version event, then publishes `DecisionTransitioned` with one `correlationId`. A refused hop writes nothing and publishes nothing. |
| 4 | Governed checks | An actor with no `participants` row in the SEU is refused (`/No participants row/`). A Quality Gate on a fabricated hop refuses with `quality_gate_blocked`. |
| 5 | Supersede | Without a replacing Decision or without a comment the hop is refused and the status stays `Applied`. With both, the status is `Superseded` and `superseded_by` holds the replacing id. |
| 6 | Buttons | `nextActionsFor("Decision", "Reviewed", actor)` offers `approve` only. No action for the birth row. A post to a verb with no action for the state is refused. |
| 7 | Guard | No `updateStatus` call outside the adapter and no literal `"DecisionIdentified"` in `src`. |

Fixtures: every test that calls `createDecision` must pass a real Evidence or Knowledge id (`trust-pipeline.test.ts`, which also expects `DecisionTransitioned` on each hop, and any other caller found in the build pass). Direct `decisionsDB.create` calls (`cr109-work-item-generator.test.ts`) add the required `status`. `web-flow.e2e.test.ts` posts to the verb routes and sends a Knowledge or Evidence id on create.

## Build progress

| # | Piece | State |
|---|---|---|
| 1 | Rows, routes, events, constant (Step 1) | Built ✅ |
| 2 | Schema (Step 2) | Built ✅. ALTER for the live table: `ALTER TABLE decisions ALTER COLUMN status DROP DEFAULT; ALTER TABLE decisions ADD COLUMN IF NOT EXISTS superseded_by UUID REFERENCES decisions(id);` |
| 3 | `decisionsDB.create` and `setSupersededBy`, `decisionAdapter`, `supersedeDecision` (Step 3) | Built ✅ |
| 4 | `createDecision`: birth row, Evidence-or-Knowledge rule, `SEU` group accepted (Step 4) | Built ✅ |
| 5 | `transitionDecision`, verb route, buttons, API route commented out (Step 5) | Built ✅ |
| 6 | Tests | Built ✅. Owner ran them: pass. `decision-event-lifecycle-table.test.ts` (new); the Quality Gate refusal is in `quality-gate-generalization.test.ts`; fixtures updated in `trust-pipeline.test.ts` (Evidence or Knowledge on each `createDecision`) and `cr109-work-item-generator.test.ts` (`status` on each `decisionsDB.create`) |
| 7 | `19_Decision_Model_Traceability.md` | Built ✅ |
