# CR-149 — Participant "Done": the completed Work Item returns control to the Execution Engine

**Raised:** 2026-11-18 · **Origin:** reviewing SEU 26ae941d-860d-4e94-9138-b9b3bedbbfef after CR-148. All three Deliverables sit In Progress and their Quality Gate items read "Not evaluated". The owner expects that a Participant who finishes the work marks the Work Item Done and reports a result, and that the platform then takes control back through the Execution Engine.
**Status:** 🟡 Raised — design in progress
**Related CRs:** [CR-148](CR-148-command-work-item-generation-cleanup.md) (the Execution Engine issues the Command from the governed hop, Dispatch assigns the Work Item), [CR-107](CR-107-execution-engine-owns-deliverable-kickoff.md) (the Execution Engine owns when a Deliverable starts), [CR-109](CR-109-execution-governance-dispatch-wiring.md), [CR-145](CR-145-quality-gate-alignment.md) (Quality Gate evaluation and waivers).

## 1. The problem in plain terms

The Platform dispatches the Work Item to the participant. The  Work Item has all the details required for the work to be carried out. 

What are the possibilities from here (what happens in real life situation)? 

1. No blockers and participant carries out the work. Provide Evidence of work. If Decisions were made, provide those details. If reusable knowledge items were created, log them. Mark the work as Done. And Click on Report Result Button. This Button Should generate a command and publish an event. The event should be subscribed by deliverableKickoff. - We just have to expand the design. 

2. Work is blocked. Raise an Obligation. Mark the work as blocked and Report Result; Design how the flow goes back.

### 1.1 Expansion: the real-life outcomes of a dispatched Work Item (proposed, not agreed)

What exists today for a Participant while working (verified in src/views/quickview/_participantHome.ejs and the routes it posts to): forms to collect Evidence, observe Knowledge and raise an Obligation, a read-only Decisions tab, and the Report Result form (Done, Failed, Blocked and an optional reference). Evidence, Knowledge and Obligations are logged in their own tabs and are related to the Deliverable, not to the Work Item. The result form has no field for them.

| # | Situation | What the Participant does | What the platform has to do after Report Result | Exists today | Open |
|---|---|---|---|---|---|
| 1 | Work done, no blockers (owner item 1) | Collects Evidence, records Decisions made, logs reusable Knowledge, marks Done, reports the result with a reference. | The Report Result button generates a Command and publishes an event. `deliverableKickoff` subscribes to that event and takes control back: it evaluates the Deliverable's next hop and its Quality Gates. | `completeWorkItem` records the reference and Completes the Work Item and Command. No Command or event is created for the report. The kickoff handler does not subscribe to a result event. | The Command type and the event name. What the kickoff handler evaluates for a manual hop (In Progress to Approved). Which actor the evaluation runs as, because `evaluateDeliverableTransition` checks the actor's badge. Whether the result form should show the Evidence, Knowledge and Decisions logged for the Deliverable, or require at least one. |
| 2 | Work is blocked, including work the Participant tried and could not produce (owner item 2) | Raises an Obligation naming what blocks the work, marks the Work Item Blocked, reports the result. | The Work Item and Command close as Blocked. The Obligation holds the Deliverable. When the Obligation is Verified or Closed, `ObligationTransitioned` reaches the kickoff handler, which has to start the work again: a new Command, Work Item and dispatch for the same Deliverable. | `completeWorkItem` sets the Work Item and Command Failed (it makes no difference between Blocked and Failed), raises an Attention Item and publishes `WorkItemFailed`. The Obligation a Participant raises (`raiseMyObligation`, participantHome.ts lines 102-141) relates to the Deliverable with origin Participants and sets no `blocked_from_state` or `blocked_to_state`. `evaluateDeliverableTransition` treats only an Obligation with both fields as blocking a hop (executionEngine.ts lines 90-99), so a Participant's Obligation does not hold the Deliverable and is not linked to the Work Item. The kickoff handler already listens to `ObligationTransitioned` and has a re-issue path (`reissueProducingCommand`), whose fate is open in CR-148. | How the Obligation is tied to the blocked Work Item. Whether the Obligation the Participant raises is made to block the hop. Whether Blocked needs its own Work Item and Command status (the allowed statuses in work_items_schema_recovery.sql are Generated, Assigned, Dispatched, Executing, Completed, Failed, Cancelled, Disposed, and in commands_schema_recovery.sql Generated, Dispatched, Completed, Deferred, Cancelled, Failed; neither has Blocked). What exactly starts the resumed work, and whether it reuses the same Participant. Retry after the block is lifted is the Execution Engine's decision: a new Command and Work Item, with Dispatch selecting the Participant. How many attempts, and whether the Participant who was blocked is excluded when Dispatch selects. |
| 3 | The Participant stalls and never reports | Nothing. | The Service Level of the producing Capability's Service carries a turnaround time. If the work is not reported within it, the platform escalates. | Dispatch reads the turnaround time from the Service Level (`resolveTurnaroundSeconds`, dispatchEngine.ts lines 14-22) and sets it as the Work Item's `target_completion_at` (dispatchEngine.ts lines 119-121). `sweepStalledWorkItems` ([workItemHeartbeat.ts](../../src/routes/seu/core/workItemHeartbeat.ts)) raises an Escalation Attention Item when a Work Item passes `target_completion_at` with no result. The API route `POST /work-items/sweep-stalled` is `notImplemented`. | What follows the escalation is not designed or decided. |
| 4 | The Participant is replaced while the work is under way | A person replaces the Participant on the Capability. | Dispatch moves the outstanding Work Item to the replacement Participant, or ends it so the work can be dispatched again. Participant replacement is a Dispatch responsibility (Ch.33 §11: a Participant becoming unavailable is a redispatch trigger). | `replaceParticipant` ([participants.ts](../../src/routes/seu/core/participants.ts) lines 92-153) releases and archives the old Participant, creates the new one, revokes the old Capability Fulfilment, creates the new one and publishes `ParticipantReplaced`. It reads and changes no Work Item. No subscription or handler for `ParticipantReplaced` was found (searched `ParticipantReplaced` across src/ and eventSubscriptions.json). An outstanding Work Item therefore stays assigned to the archived Participant. | The mechanism is to be designed and decided: which Dispatch handler reacts to `ParticipantReplaced`, whether the Work Item is reassigned or disposed and dispatched again, and what the replacement Participant receives. |
| 5 | The work is no longer needed (requirement changed, SEU suspended, Deliverable removed) | Nothing. | The Work Item is cancelled and disposed. | Ch.32 FR-32.6 requires cancellation. The Command status Cancelled exists. `Cancelled` is an allowed status in the work_items and commands CHECK constraints and in the Ontology, and no code sets it. Searched `Cancelled` and `WorkItemCancelled` across src/ (ts, json, sql, excluding src/docs): matches only in workItemsDB.ts line 168 (an in-flight filter), ontologyConcepts.json and the two schema recovery files. | Whether this belongs in this CR. |
| 6 | A reviewer finds the delivered work unacceptable | The reviewer does not approve. | The Participant gets the work back: a new Work Item for the same Deliverable with the reviewer's reason in its context. | The Deliverable lifecycle has no rework hop (In Progress to In Progress has no Transition Definition, as CR-148 found). | A rework mechanism does not exist. It may need its own CR. |
| 7 | A Deliverable needs more than one Participant, so its Command has several Work Items | Each Participant does their part and reports separately. | The Execution Engine takes control once, after every Work Item of the Command is closed. A Blocked or stalled Work Item holds the others' result until it is resolved. | The Capability Definition carries roles, and each role carries work types (`CapabilityRole { name, worktypes }`, seuTypes.ts lines 215-218; capability-roles.csv and code-worktypes.csv list them per Capability). A Participant holds proficiency in those roles and work types. Ch.2 CM-003 (several Participants may fulfil one Capability), Ch.32 FR-32.2 (several Work Items per Command) and Ch.33 FR-33.3 (one-to-one, one-to-many and many-to-one assignment) allow it. The code makes one Work Item per Command (`workItemGenerator.generate`), and Dispatch selects one Participant for it. `completeWorkItem` sets the Command Completed when its first Work Item completes (workItems.ts), so with several Work Items the Command would close too early. `deliverables.producing_capability_id` holds one Capability, while Ch.2 FR-2.2 says a Deliverable requires one or more. | The mechanism is to be designed. How many Work Items a Command generates (one per role, one per work type, or by another rule from the Capability Definition). What each Work Item carries (its role and work types in the Execution Context). How Dispatch selects a Participant for each. When the Command is Completed or Failed. Which Participant's reference counts, since the Approve check needs one reference for the Deliverable. What a Blocked or stalled Work Item does to the others. Whether one Capability per Deliverable stays. |
| 8 | The same result is reported twice (double click, retried API call) | Submits again. | The second report is refused and changes nothing. | `completeWorkItem` returns `not_outstanding` when the Work Item is no longer Dispatched. | Covered. The new Command and event have to keep that guarantee. |
| 9 | An external system (AI agent, orchestrator) is the Participant | The system reports through an API. | The same path as a person reporting on the participant home. | The API route `POST /work-items/:id/result` is `notImplemented`. Delivery to the external system already works (assignmentDelivery adapters). | The reporting channel for external Participants. The same Command and event must serve both. |
| 10 | The Participant declines the assignment (wrong skills, a conflict, no capacity) | Tells the platform they cannot take the Work Item, before any work is done. | Dispatch selects another eligible Participant for the same Work Item. Selecting a Participant is a Dispatch job. | Dispatch publishes `ParticipantUnavailable` and `DispatchRejected` when it finds no Participant. Searched `decline`, `refuse assignment`, `rejectAssignment` and `reject` with `work item` across src/ (ts, excluding src/docs and the Dispatch rejection code): no way for an assigned Participant to decline was found. | The mechanism is to be designed and decided: how a Participant declines, what Dispatch does next, whether the Participant who declined is excluded from the next selection, and what happens when no other Participant is eligible. |
| 11 | The Participant finds an issue while the work is in progress that does not stop the work | Raises an Obligation or an Attention Item and continues. Later reports Done, with the issue on record. | The issue is recorded against the Deliverable and is visible to the reviewer and to the next hop's evaluation. It does not block the Work Item. | A Participant can raise an Obligation from the participant home (`raiseMyObligation`, participantHome.ts lines 102-141). It relates to the Deliverable and holds no hop. The participant home shows Attention Items read-only. No way for a Participant to raise an Attention Item was found (searched `attention` in participantHome.ts, public.ts and _participantHome.ejs). | Whether a Participant can raise an Attention Item. Whether an Obligation raised during the work can block the next hop, and who decides that. How the reviewer is shown the issues raised during the work. |

Rows 1 and 2 are the owner's design. Failed and Blocked are one situation: a Participant who tried and could not produce the result is blocked, and the platform handles both the same way today. A Deliverable that is not ready for approval after Done is not a separate situation: once the Execution Engine takes over, it evaluates the next hop with the same logic as every other hop, so a Blocked check or gate is handled as any blocked transition is. Rows 3 and 6 decide whether the loop closes for stalls and rework. Rows 4 (Participant replacement, a Dispatch mechanism) and 7 (several Work Items per Command, from the Capability Definition) are to be designed. Rows 10 (a Participant declines the assignment, a Dispatch mechanism) and 11 (an issue raised while the work continues) are situations to design. Rows 5 and 9 are possible later CRs unless the owner says they belong here. Situations covered by existing rows: a Participant who does not start or runs late, and an AI Participant that runs out of budget (row 3, the Service Level turnaround time); a Participant who becomes unavailable or hands the work over (row 4); a Participant who needs a Decision or an input, finds the scope wrong, finds the work unnecessary or loses an external system (row 2, blocked). Suspension and resumption of the SEU are not in scope for this CR.

## 2. What happens today, step by step

The Deliverable lifecycle is Defined, In Progress, Approved, Baselined. The hops are rows in `transition_definitions` (entity_type Deliverable):

| Hop | Verb | Trigger | Attestation | Event |
|---|---|---|---|---|
| Defined to In Progress | create | governed (the engine makes it) | no | DeliverableTransitioned |
| In Progress to Approved | approve | manual (a person requests it) | required | DeliverableApproved |
| Approved to Baselined | baseline | manual | required | DeliverableBaselined |

The flow from the start of work to Done:

1. The Execution Engine makes the governed hop Defined to In Progress. `applyGovernedDeliverableTransition` ([executionEngine.ts](../../src/domain/engine/executionEngine.ts)) records a Command, leaves it Generated and publishes `CommandGenerated` (CR-148).
2. `commandGeneratedHandler` calls `workItemGenerator.generate` ([workItemGenerator.ts](../../src/domain/engine/workItemGenerator.ts)). It builds the Work Item with its Execution Context and publishes `WorkItemGenerated`.
3. `workItemGeneratedHandler` calls `dispatchEngine.dispatch` ([dispatchEngine.ts](../../src/domain/engine/dispatchEngine.ts)). Dispatch reads the active fulfilments of the producing Capability, picks a Participant, sets the Work Item and Command Dispatched and publishes `WorkItemDispatched`.
4. The Participant sees the Work Item on the participant home (Command / Work Item tab) or on the SEU Work Queue. They choose Done, Failed or Blocked, optionally add a reference, and submit.
5. The form calls `completeWorkItem` ([workItems.ts](../../src/routes/seu/core/workItems.ts) lines 18-138). Three UI routes reach it: `POST /aisworg/quickview/work-items/:workItemId/complete` (participant home, via `completeMyWorkItem`, which checks the Work Item is assigned to the caller), `POST /aisworg/seu/demo/participants/:participantId/work-items/:workItemId/complete` (Demo viewer, same check) and `POST /aisworg/seu/seus/:id/work-items/:workItemId/complete` (SEU Work Queue, no assignment check).
6. For Done, `completeWorkItem` writes a `deliverable_references` row for the hop (from_state Defined, to_state In Progress, the reference, the Participant). It sets the Work Item Completed, publishes `WorkItemCompleted`, sets it Disposed, publishes `WorkItemDisposed`, sets the Command Completed and sets the Participant Idle.
7. Nothing subscribes to this result to act on the Deliverable. `completeWorkItem` creates no Command, does not call the Execution Engine and does not change the Deliverable.

For Failed and Blocked, `completeWorkItem` sets the Work Item and the Command Failed, sets the Participant Idle, publishes `WorkItemFailed` and raises an Attention Item (workItems.ts lines 44-79). Nothing else follows.

Who requests In Progress to Approved today: a person with the `deliverable_approve` badge, from the Deliverables tab of the SEU page. That request goes to `transitionDeliverable` ([deliverables.ts](../../src/routes/seu/core/deliverables.ts) lines 57-84), which calls `executionEngine.evaluateDeliverableTransition` and then `applyDeliverableTransition`. The kickoff handler ([deliverableKickoff.ts](../../src/domain/engine/deliverableKickoff.ts)) retries only governed hops, so it never attempts a manual hop.

## 3. Observed on SEU 26ae941d (2026-11-18)

| Item | State |
|---|---|
| Deliverables Deployment Manifest, Requirements Analysis Model, Source Code | all In Progress |
| Commands | three, all Defined to In Progress, all Dispatched |
| Work Items | three, all Dispatched (no Participant has reported a result yet) |
| Recorded Quality Gate evaluations | 12, all Defined to In Progress, all Blocked. None for In Progress to Approved. |
| Quality Gate column on the Deliverables tab | "Not evaluated" for In Progress to Approved, because the column shows the latest recorded evaluation for the current state and one next state and nothing is evaluated when the page renders ([seus.ts](../../src/routes/seu/core/seus.ts) lines 553-558). |

The Defined to In Progress gates were Blocked and the Deliverables still moved. Why is not traced (a waiver may cover them).

## 4. The intent

After a Participant reports Done, control returns to the Execution Engine. The Execution Engine decides the next governed step of the Deliverable and evaluates the Quality Gates of that step. Reporting Done does not itself change the Deliverable.

## 5. What the specification says

| Point | Specification |
|---|---|
| Participants issue Commands, not Events. The Runtime Kernel evaluates a Command against the Transition Definition and Governance, makes the state transition and then publishes the Event. Participants cannot fabricate engineering history. | Events and Lifecycles.md lines 1490-1534 |
| Completion of a Work Item does not imply Deliverable approval or engineering completion. Further governance evaluation remains required. | Ch.32 §12, WI-005 |
| A Work Item never modifies engineering state directly. | Ch.32 FR-32.7, §17 |
| The Work Item architecture ends with Participant, Execution, Engineering State Transition. | Ch.32 §3 |
| The Execution Engine observes Events, identifies eligible transitions, evaluates governance and generates Commands. It never bypasses governance. | Ch.31 §4, §9, EE-002, EE-006 |
| Quality Gates are evaluated whenever a governed lifecycle transition is requested. | Ch.26 §10 |
| Work Item lifecycle: Generated, Assigned, Executing, Completed, Disposed. Events: WorkItemGenerated, WorkItemAssigned, WorkItemStarted, WorkItemCompleted, WorkItemCancelled, WorkItemDisposed. | Ch.32 §8, §15 |

The specification states the intent. It does not state the mechanism. Searches across src/docs/SEU Studio Specifications for "In Progress" and "attest" found no definition of the Deliverable lifecycle or of what follows a completed Work Item. The Canonical Information Model lists the Work Item lifecycle as Generated, Dispatched, In Progress, Completed or Failed (07_Appendices/02_Canonical Information Model.md line 172), which differs from Chapter 32 §8. Chapter 32 has no Failed or Blocked outcome. The code publishes `WorkItemFailed`, which Chapter 32 §15 does not list. The mechanism is therefore a design decision of this CR.

## 6. Constraints any design has to respect (verified in the code)

- **Reference.** `evaluateDeliverableTransition` refuses In Progress to Approved when no `deliverable_references` row with a reference exists for to_state In Progress ("cannot approve a Deliverable with no attached reference"; executionEngine.ts lines 192-200). The reference a Participant reports on Done is what satisfies this.
- **Attestation.** In Progress to Approved and Approved to Baselined require an attestation. `applyGovernedDeliverableTransition` creates it with the requester's Participant and the acting badge (executionEngine.ts lines 393-406). The hop needs an actor who holds the `deliverable_approve` badge.
- **Authority.** Badges come from `badgeAuthorityEngine` through the Transition Definition verb. No code checks a badge by name.
- **In-flight check.** A Command for the same hop that is Generated, Dispatched or Deferred blocks a new request for it (`commandsDB.findInFlight`).
- **Command and Work Item statuses.** Command: Generated, Dispatched, Deferred, Completed, Failed, Cancelled. `completeWorkItem` sets Completed or Failed.
- **Events.** Every `eventBus.publish` call carries a real actor and badge. No code runs after a publish.
- **Subscribers.** A subscriber is added only when the effect lands on a different entity type from the one whose event fired. A Work Item result that acts on a Deliverable crosses that boundary.

## 7. Design questions

Each question has the options found in the code. The recommendation is a proposal and is not yet agreed.

**Q1. How does Done return control?**
- (a) A Command. `completeWorkItem` or its caller issues a Command to the Execution Engine for the Participant's report. This follows the specification's "Participants issue Commands".
- (b) An Event. A subscriber on `WorkItemCompleted` calls the Execution Engine. This follows "the Execution Engine observes Events" and the code's existing subscriber mechanism (`event_subscriptions`, `HANDLER_REGISTRY`).
- Proposal: (b), because `WorkItemCompleted` is already published and the Execution Engine already works from Events. The Participant's own act remains the form submission. To be confirmed by the owner.

**Q2. What does the Execution Engine do next for a Done result?**
- (a) Evaluate In Progress to Approved (the gates and checks) and record the evaluation, without changing the Deliverable. The Approve request stays manual and attested.
- (b) Request In Progress to Approved itself, if it can. The hop is manual and requires an attestation from a badge holder, so the engine cannot do this as the Participant.
- (c) Raise an Attention Item or notification to a reviewer that the Deliverable is ready for approval.
- Proposal: (a) plus (c). The result of (a) fills the Quality Gate column of the Deliverables tab, and the reviewer approves manually.

**Q3. Who is the actor and badge for what the Execution Engine records?** The system actor of the SEU (`getSystemActor`) is used for engine-authored rows today. The Participant who did the work may not hold `deliverable_approve`.

**Q4. The next hop's gates when the Execution Engine takes over.** The Execution Engine uses its normal evaluation, so a Blocked check or gate is handled as for any other hop. What is open is only what the evaluation after Done records and whether the Work Item and Command, already Completed, change.

**Q5. The Blocked outcome (Failed is the same situation and is not designed separately).** Whether it also returns to the Execution Engine, what the Attention Item they raise is for, and which Work Item lifecycle and event names they use, since Chapter 32 does not cover them.

**Q6. The Work Queue route.** It calls `completeWorkItem` with no check that the Work Item is assigned to the caller. `completeMyWorkItem` has that check.

## 8. Settled design

1. The intent in section 4. The owner stated it and the specification agrees with it.
2. The mechanism is designed in this CR to meet the intent, because the specification does not prescribe one.
3. The Execution Engine decides whether failed or abandoned work is requested again. A retry is a new Command and Work Item. Dispatch only selects the Participant for it (Ch.33 §1: Dispatch does not determine what is executed). Ch.33 §11 and DE-004 name "execution fails" and Participant failure as redispatch triggers. In this CR "redispatch" means choosing who performs the work again, and the decision that the work is requested again stays with the Execution Engine. Redispatch in the code today handles only `DispatchDeferred` (no Participant Available for the Capability).

## 9. Acceptance criteria (proposed)

- After a Participant reports Done, the Execution Engine evaluates the Quality Gates of the next hop of the Deliverable and records the evaluation.
- The Quality Gate column of the Deliverables tab shows that outcome instead of "Not evaluated".
- Reporting Done does not change the Deliverable's state.
- A Blocked result behaves as the design of Q5 states.
- Every publish in the new path carries a real actor and badge, and no code runs after a publish.

## 10. Test fixtures that exercise `completeWorkItem` (to update when the design is agreed)

`produceDeliverable` in tests/testFixtures.ts calls `completeWorkItem` with outcome done. These test files use it, `completeWorkItem`, `completeMyWorkItem` or `completeOutstanding`: governance-depth, participant-lifecycle, telemetry, command-pipeline, telemetry-per-seu, work-item-stall, acceptance.e2e, traceability, cr121-governed-deliverable-flow, trust-pipeline, quality-telemetry, cr109-work-item-generator, attestation, web-flow.e2e, deliverable-event-lifecycle-table, attention-and-interaction.

## 11. Still open

- The answers to Q1 to Q6.
- Why the Defined to In Progress gates are Blocked while the Deliverables reached In Progress.
- The `DeliverableTransitioned` subscription description in `eventSubscriptions.json` says `completeWorkItem` publishes that event. It does not.

## 12. Part 1 built: composition picks work item types (2026-11-19, built, not yet run)

Decisions are in `design/DECISIONS-ebm-work-item-types.md`. Work Item generation from the picks is not built.

| Area | Change |
|---|---|
| Compose | `POST /objectives/:id/compose-ebm` stores the draft on the SEU and always redirects to Resolve Conflicts. It no longer publishes `CompositionCompleted`. |
| Validate | A Validate button on Resolve Conflicts posts `validateComposition` to the same route. It is refused while any conflict is open, and publishes `CompositionCompleted`, which creates the EBM in Composed. |
| Work item types | New conflict kind `worktype-choice` (pick-any) in the Services table, one per Deliverable once its Service is decided. It stays open until at least one worktype is picked. The Service candidates carry the roles and worktypes of their Capability. |
| Settled result | `SettledService.workItemTypes` holds the picked `{ role, worktype }` pairs and is saved in `behaviors.settled`. |
| Activate | From Composed, the EBM page button is labelled Activate and runs `activateComposedEbm`: liveness check, then Composed to Validated to Active, or Composed to Retired on a dead reference. States, events and badges are unchanged. |

Files: `dblayer/constants.ts`, `conflicts/types.ts`, `unravelServices.ts`, `services.ts`, `settleServices.ts`, `routes/seu/web/objectives.ts`, `routes/seu/web/seus.ts`, `routes/seu/core/commissioning.ts`, `views/seu/seus/resolve-conflicts.ejs`, `views/seu/seus/ebm.ejs`.

Test files updated in the same pass: `tests/testFixtures.ts` (answers every open conflict of a round, so the new worktype conflicts do not exhaust the 50 rounds) and `tests/web-objectives.test.ts` (Compose leads to Resolve Conflicts, Validate announces the composition).

Not run: `tsc`, tests, `db:clean-slate`. The demo simulator stores no work item type picks.

## 13. Part 2 built: one Work Item per picked worktype (2026-11-19, built, not yet run)

Rules from the owner: nothing changes on the Deliverable. A Command for a Deliverable with N picked worktypes has N Work Items. The Command is complete when all of them are complete. The Dispatch Engine selects each Work Item separately and checks the role and the worktype of the Work Item as a criterion.

| Area | Change |
|---|---|
| `work_items` | Columns `role` and `worktype` (nullable, null for a Work Item with no worktype). `work_items_schema_recovery.sql`, `WorkItemRow`, `workItemsDB.create`, new `workItemsDB.findByCommandId`. |
| Generation | `workItemGenerator.generate` reads the Deliverable's `workItemTypes` from the EBM's settled `services` and creates one Work Item per type, then publishes `WorkItemGenerated` for each. A Deliverable with no types gets one Work Item as before. It now returns `WorkItemRow[]`. |
| Dispatch | `candidatesHoldingWorkItemType` (dispatchStrategies.ts) keeps the fulfilling Participants whose competency holds the Work Item's role (dimension Role) and worktype (dimension Work type). None qualified gives `DispatchRejected` with reason `no_participant_holds_work_item_type`. |
| Completion | `completeWorkItem` sets the Command to Completed only when every Work Item of the Command is Completed or Disposed and the Command is not Failed. |

Test files updated: tests/execution-engine.test.ts (three `generate` calls now destructure the array).

UI: the Work Queue gains a sortable, searchable Work item type column (worktype and role). The role and worktype are not shown on the SEU detail Command tab or the Participant home, because they are used by dispatch only (see section 14).

Siblings: Work Items of one Command have no relationship to each other. A cancelled Work Item does not change its siblings. The Command is the only thing they share.

A Work Item cannot fail (Ch.32 §8 has no Failed state). When a Participant reports failed or blocked, `completeWorkItem` cancels the Work Item (status Disposed, event `WorkItemCancelled` in place of `WorkItemFailed`), sets the Deliverable's Command to Failed and raises the Attention Item, whose title is now `Participant reported <outcome> on Deliverable "<name>"`. A later Done on a sibling does not complete a failed Command. The status `Failed` is removed from the `work_items` status check and from `countActiveByParticipantId`.

Test files updated for the cancel rule: tests/command-pipeline.test.ts, tests/web-attention-workqueue.test.ts. Not run: tsc, tests, db:clean-slate. The `work_items` columns reach the database through db:clean-slate.

## 14. Part 3 built: UI changes (2026-11-19, built, not yet run)

The owner ran the tests after Part 1 and they passed. The changes below were made after that run.

| Area | Change |
|---|---|
| Resolve Conflicts, Services tab | One card for each Deliverable. When a Service has to be chosen, the work item types are in the same card, under "Work Item Types - <Deliverable name>". The radio of a Service shows that Service's roles and worktypes at once. One Apply saves the Service and the ticked work item types together. The options table (Source, Work Item types) is removed from Service choice cards. |
| Compose route | A Service pick that arrives with ticked work item types (`ebmWorktype`) saves the Service first, then saves the ticks that belong to that Service. A Deliverable with one Service keeps its own work item type card and Apply. |
| Conflict titles | `CONFLICT_TITLE_BY_KIND` says "Work Item Types". A conflict may carry a `subject` (the Deliverable name), which `withAction` appends to the title. |
| EBM page | A list of `{role, worktype}` in a result cell shows one "role / worktype" line for each entry (`cellHtml` in resultCells.ts). |
| Work Item lines | The SEU detail Command tab and the Participant home do not show the role and worktype. The Work Queue column stays. |
| Work Item sheet | The Quality Gate section is removed from the Execution Context markdown. The Quality Gate decision is still built and stored in the execution context. |
| Quality Gate waiver | The success message of Grant waiver says that the decision is made again in the background and that the page has to be reloaded. The Deliverable's "Waived" cell is read from the stored decision, which the `deliverableKickoff` subscriber writes after the event. No automatic refresh was added. |

Files: src/views/seu/seus/resolve-conflicts.ejs, src/views/seu/seus/_worktype-form.ejs (new), src/routes/seu/web/objectives.ts, src/domain/engine/conflicts/{types,resolve,services}.ts, src/dblayer/constants.ts, src/utils/resultCells.ts, src/views/seu/seus/detail.ejs, src/views/quickview/_participantHome.ejs, src/routes/seu/core/executionContextMarkdown.ts, src/routes/seu/web/seus.ts.

Still open: whether the Work Queue column is removed, and whether the Quality Gate decision is dropped from the stored execution context (tests/execution-engine.test.ts asserts it). Not run: `tsc`, tests, `db:clean-slate`.

## 15. Part 4 built: a Participant raises Attention Items, not Obligations (2026-11-19, built, not yet run)

A Participant can no longer raise an Obligation. A Participant raises an Attention Item on a Deliverable assigned to them. The Obligations tab stays and still lists the Obligations on the Participant's Deliverables.

| Area | Change |
|---|---|
| Core | `raiseMyObligation` is replaced by `raiseMyAttentionItem` in participantHome.ts. It keeps the ownership check (the Deliverable must be on the Participant's own Work Items), checks the category and priority against the Ontology, resolves the `attentionitem_raise` badge and calls `createAttentionItem`. |
| Ontology | New concept types `category:attention-item` (Operational, Action Required, Escalation) and `category:attention-priority` (Very High, High, Medium, Low). The three categories are the ones the engine already writes. |
| Routes | `POST /aisworg/quickview/seus/:seuId/attention-items` and `POST /aisworg/seu/demo/participants/:participantId/seus/:seuId/attention-items` replace the two `.../obligations` routes. The route_authority rows are renamed. |
| View | The Participant home and the Demo participant viewer have an Attention Items tab with the raise form and the list of Attention Items on the Participant's Deliverables. The Obligations tab has no form. |
| Options | `getViewerAttentionItemOptions` replaces `getViewerObligationOptions`. The ViewModels carry `attentionCategoryOptions` and `attentionPriorityOptions`. |

Test fixtures updated in the same pass: tests/cr108-obligation-model-seu-execution.test.ts (the Participant test raises an Attention Item and the Participant is granted `attentionitem_raise`), and a comment in tests/web-flow.e2e.test.ts.

Run: `tsc` was run and is clean. Tests and `db:clean-slate` were not run. `db:clean-slate` is needed for the Ontology concepts and the route rows.

## 16. Part 5: Deliverable actions in the Participant SEU view (2026-11-19, built, not yet run)

### Raised

In the Participant SEU view, the Deliverables tab shows a collapsible group of action buttons against each Deliverable. The forms inside the other tabs are removed. Each action opens a modal form.

| Action | Replaces |
|---|---|
| Raise Attention Item | The form of the Attention Items tab (Part 4). |
| Create Knowledge | The form of the Knowledge tab. |
| Create Decision | The form of the Decisions tab, where one exists. |
| Provide Evidence | The form of the Evidence tab. |
| Report Status | The Work Item result form (done, failed, blocked). |

### Settled

- The five actions are the ones above, in that order.
- The tabs keep their lists. Only their forms move into modals.

### Raise Attention Item modal (as given by the owner)

| Field | Content |
|---|---|
| Deliverable | The Deliverable of the row, by default. |
| Action Required | A dropdown of `category:attention-item` with Escalation and Operational. |
| Title | Short text, at most 100 characters. |
| Description | The details of the Attention Item. |
| Priority | A dropdown of `category:attention-priority`. |
| Blocks Deliverable progress | A flag that says whether the Attention Item blocks the Deliverable. |

Submitting raises the Attention Item. It shows in the Attention Items tab of the Participant view and of the SEU view.

### Create Knowledge modal (as given by the owner)

| Item | Content |
|---|---|
| Fields | The fields of the existing Knowledge form for now: Deliverable (the row's Deliverable by default), supporting Evidence, category, title and acquisition scope. The Knowledge cleanup will expand them later. |
| Info icon | The form carries an info icon with the text "Use this to provide information on reusable components/assets only. Work Item related artefacts have to be reported in Evidence". |

### Create Decision modal (as given by the owner)

| Field | Content |
|---|---|
| Deliverable | The Deliverable of the row. |
| Decision Type | A dropdown of the Ontology `category:decision` (Architecture, Design, Engineering, Operational and Governance Decisions). |
| Title | At most 100 characters. |
| Alternatives | A list of entries, each with the alternative text, a rationale, a risk and chosen or rejected. |
| Supporting Knowledge | A dropdown of the Knowledge Items of the SEU. It shows titles and saves ids. The details of the picked item show in an aside. |
| Supporting Evidence | The same as Supporting Knowledge, for Evidence. |

At least one Knowledge Item or Evidence item has to be selected (already enforced by `createDecision`). Submitting creates the Decision. It shows in the Decisions tab of the Participant view and of the SEU view.

Settled: the alternative keeps its shape (`statement`, `assumptions`, `consequences`, `status`, `rationale`) and the Ontology `decision-alternative-status` is unchanged. The risk of an alternative is kept in `consequences`.

Existing support (verified): `createDecision` takes the category, the title, the alternatives, the Knowledge ids and the Evidence ids. An alternative has `statement`, `assumptions`, `consequences`, `status` and `rationale`. The status comes from the Ontology `decision-alternative-status` (Candidate, Evaluating, Investigating, Deferred, Rejected, Approved).

### Provide Evidence modal (as given by the owner)

The modal uses the fields of the existing Evidence form (Deliverable, category, title, source). The owner will expand it later.

### Report Status modal (as given by the owner)

The modal shows the list of Evidence, the list of Knowledge, the list of Decisions and the list of Attention Items of the Deliverable. It has three buttons.

| Button | Rule |
|---|---|
| Completed | Evidence is mandatory. The Deliverable has no open Attention Item. |
| Completed Pending Attention | Evidence is mandatory. The Deliverable has no open Attention Item that carries the block flag. |
| Blocked | The Deliverable has an Attention Item that carries the block flag. |

Completed Pending Attention blocks the Deliverable. Blocking is enforced through an Obligation: raising an Attention Item that has the block flag opens an Obligation on the Deliverable, and the existing Quality Gate on unresolved Obligations then holds the hop. When the Attention Item is resolved, its Obligation resolves with it automatically. The block flag is the flag of the Raise Attention Item modal. An Attention Item has no column for it today, so storing it is a schema change (with the test fixtures that follow from it).

### Report Status effect (settled)

| Button | Effect |
|---|---|
| Completed | The outcome is done. The Work Item completes and the Deliverable transition is applied. |
| Completed Pending Attention | The outcome is done. The Work Item completes, and an Obligation holds the Deliverable transition. |
| Blocked | The Work Item stays open and no transition is applied until the blocking Attention Item is resolved. |

### Blocking through the existing gate (settled)

- The EBM is not changed and no new Quality Gate is added. The existing gate `no-unresolved-obligations` holds the hop.
- An Attention Item cannot be waived. It needs a person to fix it and to change its status to completion.
- An open Obligation raised from a blocking Attention Item is a condition of the hop decision that no waiver covers (`waivable` is null). No existing waiver is cancelled. The Grant waiver form shows the line as not waivable.
- The Obligation resolves with its Attention Item. Resolving the Attention Item is the only release.
- To check when building: how the engine builds the extra conditions of a hop decision, and that this needs no change to the gate itself.

### Evidence on Report Status (settled)

Completed and Completed Pending Attention need at least one Evidence item, picked by the Participant from the list in the modal. Evidence is a must to claim completion. A Decision is preferable and is not enforced.

### Build notes found while reading the code (2026-11-19)

- The Obligation of a blocking Attention Item records its origin in `originating_entity_type` and `originating_entity_id` (existing columns). It carries `blocked_from_state` and `blocked_to_state`, because the Deliverable check in `executionEngine.ts` only holds a hop for an Obligation that has both.
- `obligationWaivable` in `executionEngine.ts` gives the waivable of an open Deliverable Obligation. An Obligation that originates from an Attention Item gets null there.
- The waiver lines of the SEU view (`seus.ts`) mark that Obligation, and the gate line of `no_unresolved_obligations`, as not waivable. `grantQualityGateWaiver` refuses a waiver that would cover it.
- The auto-resolve is an event subscriber on `AttentionItemTransitioned`, because the effect lands on a different entity (the Obligation).

### Note: authority of the system participant (owner, 2026-11-19)

The system participant resolves the Obligation of an Attention Item through `badgeAuthorityEngine.resolveAuthorBadge`, which today lets the platform system actor hold the badges of the prefixes `deliverable_`, `participant_` and `waiver_`. The build adds `obligation_` to that list as an interim rule. The owner will set up authority rules inside the Profile to grant this, and will pick the point up when the authority rules are expanded. The interim prefix is then removed.

### Still open

- The fields of each modal form.
- What each action does when it is submitted.
- Raise Attention Item: what the blocking flag does (stored as a column; the Report Status rules above use it), and whether the category list drops Action Required.
- Whether Report Status replaces the Complete control on the Work Item line.

Nothing is built for this part. The owner will give the form details in the following messages, and the build starts once they are agreed.

### Built (2026-11-19)

| Area | Change |
|---|---|
| Participant view | The Deliverables tab has an Actions column with a collapsible group of five buttons. Each opens a modal that names the Deliverable. The create forms of the Attention Items, Evidence and Knowledge tabs are removed. The row transition forms stay. |
| Raise Attention Item | Category (the Ontology `category:attention-item`, now Escalation and Operational), title (100 characters), description, priority and the block flag. `attention_items.blocks_progress` is a new column. |
| Create Knowledge | The existing fields and the info icon. |
| Create Decision | Decision type, title (100 characters), alternatives (statement, status, rationale, risk kept in `consequences`), Knowledge and Evidence pick lists with an aside. `createDecisionFromForm` serves the SEU route and the new Demo route. |
| Provide Evidence | The existing fields. |
| Report Status | Lists of Evidence (to pick), Knowledge, Decisions and Attention Items of the Deliverable, and the three buttons. `reportMyStatus` applies the rules above. Completing calls `completeWorkItem` with outcome done. |
| Blocking | `attentionObligations.ts` raises one Obligation per Attention Item (origin `AttentionItem`, with the hop of the Work Item). The subscriber `attentionObligationResolve` (AttentionItemTransitioned) walks it to Verified when the Attention Item is Resolved or Closed. `executionEngine.ts` gives it no waiver, `seus.ts` shows its waiver lines as not waivable, and `grantQualityGateWaiver` refuses a waiver that names it or its gate. |
| Routes | `POST /aisworg/quickview/seus/:seuId/report-status`, and the Demo `decisions` and `report-status` routes, each with a route_authority row. |
| Constants | `OBLIGATION_BADGE_PREFIX`, `ATTENTION_ITEM_ENTITY_TYPE`, `ATTENTION_OBLIGATION_CATEGORY`, `ATTENTION_OBLIGATION_ORIGIN`, `OBLIGATION_RESOLUTION_PATH`, `PARTICIPANT_TITLE_MAX_LENGTH`. |

Test fixtures updated in the same pass: tests/cr108-obligation-model-seu-execution.test.ts (a blocking Attention Item opens one Obligation that names the hop). `attention_items.blocks_progress` has a default, so no other fixture changes.

Run: `tsc` is clean. Tests and `db:clean-slate` were not run. `db:clean-slate` is needed for the column, the Ontology concepts, the subscription row and the route rows.

### Open after the build

- The Work Item "Complete" control in the Commands tab is still there. It completes without Evidence. Report Status is meant to replace it, which the owner has not confirmed.
- The Knowledge pick list of Create Decision shows the Knowledge Items the Participant can see, which are the ones on their own Deliverables. The owner asked for the Knowledge Items of the SEU.
- The Evidence picked on Report Status is checked to be visible to the Participant. It is not stored against the Work Item.
- The auto-resolve is not covered by a test yet.
- Blocked leaves the Work Item open and changes nothing else. It needs an open Attention Item that has the block flag.

### Partials (owner, 2026-11-19)

Each action modal is its own partial under src/views/quickview/actions: `_attention.ejs`, `_knowledge.ejs`, `_decision.ejs`, `_evidence.ejs` and `_status.ejs`. The shared script is `_script.ejs`. `_participantHome.ejs` includes them with one locals object, so a change to one action touches one file. The modal form posts to a core function of its own (`raiseMyAttentionItem`, `createDecisionFromForm`, `reportMyStatus`, and the existing Knowledge and Evidence routes). The templates compile. They were not rendered in a browser.

### Tests (2026-11-19)

- tests/cr108-obligation-model-seu-execution.test.ts: the Participant raises an Attention Item, and a blocking one opens one Obligation that names the hop.
- tests/web-seu-entities.test.ts: the Decisions route keeps its messages. A title over 100 characters is refused. Two alternatives are saved with their statuses, and the risk goes to the consequences.
- tests/cr108-obligation-model-seu-execution.test.ts, the same Participant test: a waiver that names the Obligation of a blocking Attention Item is refused. Report Status: Blocked is accepted while a blocking Attention Item is open, Completed with no Evidence is refused, Completed and Completed Pending Attention are refused while an open Attention Item (or a blocking one) stands. Resolving the blocking Attention Item takes its Obligation to Verified. Completed Pending Attention then completes the Work Item and opens an Obligation for the remaining Attention Item.
- The same test also checks that a Gate waiver on `no-unresolved-obligations` is refused while the Obligation is open, and renders `_participantHome.ejs` with the Participant's data. The page offers the five actions and no Obligation form, and its modals post to the Participant routes.
- Not covered: the QuickView and Demo POST routes called over HTTP, and the browser behaviour of the modals (the Deliverable fill, the alternatives rows and the aside). Tests and `db:clean-slate` were not run.
