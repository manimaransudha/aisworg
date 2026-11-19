# CR-148 — Command and Work Item generation: the Execution Engine issues the Command from the governed transition

**Raised:** 2026-11-18 · **Origin:** the owner asked why the Deployment Manifest Deliverable of SEU 6badcc4f-7bf9-479d-b71a-a5a1bb8a1b73 had no Work Item and an empty Participants column after its Defined to In Progress hop. The specifications are src/docs/SEU Studio Specifications/05_Runtime Services/33_Dispatch Engine.md and Chapter 31 (Execution Engine), as CR-107 records it.
**Status:** ✅ Closed 2026-11-18
**Related CRs:** [CR-107](CR-107-execution-engine-owns-deliverable-kickoff.md) (the Execution Engine owns the decision that a Deliverable starts), [CR-109](CR-109-execution-governance-dispatch-wiring.md), [CR-145](CR-145-quality-gate-alignment.md) (waivers and the governance outcome).

## Fix the following

- The Work Item of a Deliverable follows the governance outcome of its hop. It does not read the underlying Obligations again.
- The Execution Engine issues the Command inside the governed transition. The kickoff handler only re-triggers governed hops.
- The unavailable-Capability case belongs to the Dispatch Engine.

## Observed in the code (2026-11-18)

| Point | Where |
|---|---|
| The governed hop records its own Command with no eligible-Participant pool, marks it Completed at once and publishes no `CommandGenerated`. That Command can never produce a Work Item. | executionEngine.ts `applyGovernedDeliverableTransition` |
| The Work Item is created only by the `commandGenerated` subscriber, after `executionEngine.execute` publishes `CommandGenerated`. | commandGenerated.ts, workItemGenerator.ts, executionEngine.ts `execute` |
| The kickoff handler issues a second, "produce" Command through `executionEngine.execute` after `DeliverableTransitioned`, and again when a Capability is fulfilled or a dispatch is rejected. | deliverableKickoff.ts lines 211 and 273 |
| Before it issues the produce Command, the handler calls `hasOpenBlockingObligation`, which reads the Obligation rows again. An Obligation counts as blocking while its status is not Verified, Closed or Archived. A waiver does not change the status. | deliverableKickoff.ts line 210 and the function at the end of the file, constants.ts `RESOLVED_OBLIGATION_STATUSES` |
| Deployment Manifest has one open Obligation, "Resolve the Demo False Trigger Policy" (status Identified, blocked Defined to In Progress). The hop passed on a waiver. The handler returned early, so the Deliverable has only its `Deliverable.create` Command and no Work Item. | database, read 2026-11-18 |
| `blockDeliverableForUnavailableCapability` raises a blocking Obligation and an Attention Item in the kickoff handler when no eligible Participant exists. | deliverableKickoff.ts line 294 |
| The Dispatch Engine already rejects an empty pool with `DispatchRejected` (`empty_eligible_pool`) and defers with `DispatchDeferred`. | dispatchEngine.ts lines 77 to 94 |
| The Participants column of the Deliverable Quality Gate table lists the Participants of the Work Items of the Deliverable's Commands. It is empty when no Work Item exists. | seus.ts, `view.participants` |


## Today (18 Nov 6:09 PM IST )

- applyGovernedDeliverableTransition records the hop's Command with no pool and marks it Completed at once. It publishes no CommandGenerated.
- The kickoff handler then issues a second Command, the "produce" Command, through executionEngine.execute at deliverableKickoff.ts:211 and deliverableKickoff.ts:273. It has its own guards: hasLiveProducingCommand, hasOpenBlockingObligation, and the fulfilment-count check in reissueProducingCommandLocked.

## Proposed

1. The governed transition issues the Command inside executionEngine. When a Deliverable moves into In Progress and has a producing Capability, applyGovernedDeliverableTransition records the Command with the Capability's eligible pool and publishes CommandGenerated. The Work Item and dispatch follow from that event as they do now. The governance outcome already decided the hop, so there is no Obligation re-read.
2. The kickoff handler stops calling executionEngine.execute. It only re-attempts governed hops through transitionDeliverable, which it already does in attemptGovernedTransitions.
3. An empty pool is left to the Dispatch Engine, which already rejects it with DispatchRejected and defers with DispatchDeferred.

## Settled design

1. The Work Item looks at the Quality Gate outcome recorded for the hop, through the governance outcome of the Command. It does not read the underlying information again.
2. The Command is issued inside `executionEngine`, called from a governed transition. The kickoff handler only re-triggers governed hops.
3. The unavailable-Capability case belongs to the Dispatch Engine (Chapter 33 §3, §11 and §14). Work Item generation and the kickoff handler do not decide it.

4. The eligible-Participant pool is not stored on the Command for dispatch. The Dispatch Engine reads the producing Capability's active fulfilments itself from Capability Fulfilment (Chapter 33 §3). Work Item generation does not use the pool.

## Built (2026-11-18, tsc clean; full test suite passed on the VPS)

- executionEngine.ts `applyGovernedDeliverableTransition`: a hop into In Progress leaves its Command Generated (it was marked Completed at once) and publishes `CommandGenerated` as its last statement. Any other hop still marks its Command Completed.
- dispatchEngine.ts: `dispatch` no longer takes `eligibleParticipantPoolId`. It reads the active fulfilments of the producing Capability.
- workItemGenerated.ts and redispatch.ts: the pool argument is removed from their `dispatch` calls.
- deliverableKickoff.ts: `processDeliverableTransitioned` no longer issues the producing Command, so `hasLiveProducingCommand` and the Obligation re-read on that path are gone. The re-issue path counts the Command of the hop into In Progress as a producing Command, so it issues a new one only when every producing Command Failed.

## Test fixtures updated in the same pass (tsc clean; the suite passed)

| File | Change |
|---|---|
| tests/dispatch-engine.test.ts | `makeWork` makes the SEU require the Capability, revokes the fulfilments an earlier Work Item left, and fulfils the Capability with the given Participants. The pool, its import and the `eligibleParticipantPoolId` arguments are gone. The "no pool" case uses a fresh SEU that does not require the Capability. |
| tests/web-attention-workqueue.test.ts | `dispatchedWork` fulfils the Capability with its one Participant instead of creating a pool. |
| tests/cr109-work-item-generator.test.ts | The pool-persistence test now checks that Dispatch selects a Participant among the active fulfilments of the Capability. The no-hop test looks for a Defined to In Progress Command. |
| tests/command-pipeline.test.ts, tests/cr121-governed-deliverable-flow.test.ts | The producing Command is the Defined to In Progress Command. It has the Work Item, is Completed when the Work Item is, and no In Progress to In Progress Command exists. |
| tests/web-flow.e2e.test.ts | `completeOutstanding` and the Capability fulfilment flow read the Defined to In Progress Command and its Work Item. |
| tests/deliverable-kickoff-handler.test.ts | The `DeliverableTransitioned` test no longer expects the handler to read the Command, and asserts that it issues no producing Command. |
| tests/engine-branches.test.ts | The re-issue test treats a live Defined to In Progress Command as a producing Command and re-issues only after it Failed. The `DeliverableTransitioned` test is renamed. |
| tests/participant-adapters.test.ts | The external-orchestrator assignment carries the Defined to In Progress hop, so `transition.fromState` is `Defined`. |
| tests/web-seu-entities.test.ts | A second request for In Progress is refused with "no Transition Definition for Deliverable In Progress -> In Progress", because the In Progress to In Progress produce Command no longer exists. |
| tests/testFixtures.ts | The comment of `waitForDispatchedWorkItem` names the hop into In Progress. |
| every caller of `waitForDispatchedWorkItem` (acceptance.e2e, cr108, participant-adapters, participant-lifecycle, runtime-telemetry, telemetry, telemetry-per-seu, tenant-contract and the files above) | The hop passed is `"Defined", "In Progress"` instead of `"In Progress", "In Progress"`. |

Not changed: tests/execution-engine.test.ts still asserts that `execute` stores a pool, because `execute` still does (see "Still open"). tests/engine-handlers.test.ts calls `commandGeneratedHandler` directly and does not depend on the hop.

## Observed: In Progress to Approved (2026-11-18, SEU 26ae941d-860d-4e94-9138-b9b3bedbbfef)

| Point | Where |
|---|---|
| All three Deliverables are In Progress. Their Quality Gate items read "Not evaluated". | seus.ts lines 553-558 |
| The Deliverable Quality Gate table shows the latest recorded evaluation of each gate for the current state and one next state. Nothing is evaluated when the page renders. | seus.ts lines 553-558 |
| The recorded gate evaluations of the SEU are all Defined to In Progress and all Blocked (12 rows, 4 per Deliverable). None exist for In Progress to Approved. | quality_gate_evaluations |
| In Progress to Approved is a manual hop (verb `approve`). Its gates are evaluated only when the hop is requested through the Execution Engine. | transition_definitions |
| The three Commands (Defined to In Progress) and their three Work Items are still Dispatched. | commands, work_items |
| A Participant finishes a Work Item through `completeWorkItem`. It records the Deliverable reference, sets the Work Item Completed then Disposed, sets the Command Completed and sets the Participant Idle. It does not move the Deliverable and does not evaluate any gate. | workItems.ts lines 88-138 |
| The Defined to In Progress gate evaluations are Blocked, yet the Deliverables reached In Progress. The reason is not yet traced. | Open |

## Incidental changes in the same pass

- SEU detail, Deliverable Quality Gate table: the last column is renamed Blocked Transition.
- SEU detail and the participant home, Command / Work Item tab: the Transition column is replaced by Current State (the Deliverable's lifecycle state). The Execution Context is a modal rendered from markdown (executionContextMarkdown.ts), with Checklists as a table.
- SEU detail, Capability Fulfilment tab: each Capability card header lists the Deliverables it produces.

## Still open

- `execute` still creates the pool and stores `eligible_participant_pool_id`, which nothing reads now. Removing it touches the `capability_fulfilment_pools` table and its tests.

- The re-issue of the produce Command when a Capability is fulfilled after the Deliverable is In Progress, and after `DispatchRejected`. No governed hop is left to re-trigger in those cases. The decision is whether the Dispatch Engine's redispatch (Chapter 33 §11) covers them or the Execution Engine issues a new Command.
- The fate of the Obligation and Attention Item that `blockDeliverableForUnavailableCapability` raises, and what else reads them. Not traced.
- The second `hasOpenBlockingObligation` call, in the re-issue path (deliverableKickoff.ts line 274). Not read in full.
- The test fixtures that exercise the kickoff handler's Command issuance (tests/cr107-execution-engine-deliverable-kickoff.test.ts and others) are not yet listed.
- Which page offers a Participant the action that calls `completeWorkItem`, and what requests In Progress to Approved after the Work Item is Completed. Under review by the owner on the Participants page.
- Moved to a new CR: the Participant's "Done" result returning control to the Execution Engine. `completeWorkItem` does not move the Deliverable or evaluate the In Progress to Approved gates today.
