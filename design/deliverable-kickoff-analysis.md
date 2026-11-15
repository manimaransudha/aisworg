# deliverableKickoff: what it does, in simple language

Sections 1 to 12 describe the handler as it was before the changes in sections 14 and 15. Sections 14 and 15 describe the current state.

Source: src/domain/engine/deliverableKickoff.ts, src/domain/engine/executionEngine.ts (evaluateDeliverableTransition), src/domain/engine/capabilityOnReady.ts, src/routes/seu/core/capabilities.ts, src/dblayer/seed/data/eventSubscriptions.json, src/dblayer/seed/data/transitionDefinitions.json.

## 1. Purpose

The Execution Engine watches for changes that could unblock a Deliverable. `deliverableKickoff` is the function that runs each time one of those changes happens. On each run it asks one question for every Deliverable of the SEU: "Can this Deliverable take its next governed step now?" It never decides by itself. It hands the question to the Execution Engine's gate checks and acts on the answer.

It does not choose or notify Participants. That belongs to the Dispatch Engine.

## 2. What the handler is told about (7 events)

| Event | Meaning |
|---|---|
| SEUOperational | The SEU just became Operational. First chance for every Deliverable to start. |
| DeliverableTransitioned | Some Deliverable changed state. Others may now be unblocked. |
| CapabilityFulfilled | Participants were found for a Capability. |
| CapabilityUnavailable | No eligible Participants exist for a Capability. |
| DispatchRejected | The Dispatch Engine could not place a Command. |
| ObligationTransitioned | An Obligation changed state. Acted on only when it reached a resolved state. |
| AttentionItemTransitioned | An Attention Item changed state. Acted on only when it reached a resolved state. |

Before anything else the handler stops (does nothing) in these cases:
- the event has no SEU;
- the event is an Obligation or Attention Item change that did not end in a resolved state;
- the SEU is not Operational.

## 3. Part A: the same for every event (the "scan")

For each Deliverable of the SEU:
1. Find the next transitions from its current state.
2. Keep only those marked `governed` (the system takes them, not a person).
3. Call `transitionDeliverable` for each. This runs the gate checks.

In the seed, only one Deliverable hop is governed: **Defined to In Progress**. Approved and Baselined are manual, so the scan never touches them.

### The gate checks, in order (executionEngine.evaluateDeliverableTransition)

| # | Check | If it fails |
|---|---|---|
| 1 | Dependency rows satisfied | Publishes DeliverableBlocked. Nothing else. |
| 2 | Open blocking Obligation on the SEU | Refused, `seu_blocked`. |
| 3 | Open blocking Obligation on the Deliverable | Refused, `obligation_blocked`. |
| 4 | Open Decision not yet Approved | Refused, `decision_blocked`. |
| 5 | Same hop already in flight as a Command | Refused, `already_in_flight`. |
| 6 | Quality Gate | Raises an Attention Item, refused. |
| 7 | EBM Policies, then the Policies the Transition Definition requires | Raises an Obligation (declared, else generic) and an Attention Item. Refused, `policy_blocked`. |
| 8 | Submit verb, empty-centre check | Refused. |

If all pass, the Deliverable moves and a Command is recorded with it.

Note for Defined to In Progress: the only check that needs Capability fulfilment is the Policy `policy-capability-fulfilled-before-start` (field `producingCapabilityStatus` must be "Fulfilled" or null). That is your "CapabilityFulfilment is a must" rule. Other blocks come from Policy ids, eligibility, Obligations and Decisions.

## 4. Part B: extra work that depends on the event

After the scan, the handler does extra work for some events only.

| Event | Extra work |
|---|---|
| ObligationTransitioned (resolved) | For each Deliverable with a producing Capability, try to issue the producing Command again (section 5). |
| CapabilityUnavailable | For each In Progress Deliverable using that Capability: raise a blocking Obligation (once, if none is open with that title) and an Attention Item. Then stop. |
| CapabilityFulfilled | For each Deliverable using that Capability: try to issue the producing Command (section 5). Then stop. |
| DispatchRejected | Find the Deliverable of the rejected Command and try to issue the producing Command (section 5). Then stop. |
| DeliverableTransitioned | Only when the Deliverable moved **to In Progress**: issue its first producing Command (section 5, with the same checks). |
| SEUOperational, AttentionItemTransitioned | Scan only. No extra work. |

## 5. "Issue the producing Command" in plain words

The producing Command is the request that says "this Deliverable is being worked on, produce it". The Execution Engine only records it and announces CommandGenerated. After that:

Command, then Work Item (handler off CommandGenerated), then WorkItemGenerated, then the Dispatch Engine chooses the Participant.

A new Command is created only when all of these are true:
1. The Deliverable is In Progress and has a producing Capability.
2. It has no open blocking Obligation.
3. It has no live producing Command (one that is not Failed).
4. The Capability has at least one active fulfilment (Participants exist). This is a pre-check, so no Command is created that could never be dispatched.

A Failed Command does not count as live. That is why a retry after a rejection can create a new one.

## 6. Who fulfils the Capability (answers "no Participants assigned, so how did CapabilityFulfilled trigger?")

- `capabilityOnReady` (on DeliverableReady and SEUCommissioned) requests fulfilment for each ready Deliverable's producing Capability, unless it is already Fulfilled or a request is in flight. The request names no Participant.
- `fulfilRequestedCapability` (capabilities.ts:123) consumes the request. With no named Participants it uses the whole eligible pool. With an empty pool it publishes CapabilityUnavailable. Otherwise it records fulfilments and publishes CapabilityFulfilled as its last statement.
- So CapabilityFulfilled can fire from the eligible pool even when no Participant has been picked by hand. The pool is built by `loadEligiblePool` (capabilities.ts:33) from the SEU's competency requirements, its eligibility Policies and the tenant's Participants. Whether those two reads go through the EBM has not been read yet.

## 7. Scenarios

**S1. SEU becomes Operational, Demo with the false-trigger Policy.**
SEUOperational arrives. The scan reaches check 7 for each of the 3 Deliverables. The Policy is always false, so each is blocked, an Obligation is raised and the Deliverable stays Defined. No Part B work. Nothing is dispatched.

**S2. Same SEU, no blocking Policy, Capability not yet fulfilled.**
Scan: the Policy `capability-fulfilled-before-start` fails (status Unfulfilled), so a block and an Obligation are raised. Later CapabilityFulfilled arrives. The scan runs again, now passes, and the Deliverable moves to In Progress. That move publishes DeliverableTransitioned (toState In Progress). The handler runs again for that event and issues the first producing Command. Dispatch Engine picks the Participant.

**S3. A Participant resolves the blocking Obligation of an In Progress Deliverable.**
ObligationTransitioned (resolved) arrives. Scan finds nothing governed from In Progress. Part B tries to issue the producing Command. If no live one exists and Participants exist, a new Command is created.

**S4. No eligible Participant for a Capability.**
CapabilityUnavailable arrives. For each In Progress Deliverable using it, a blocking Obligation titled `Capability "x" is unavailable for Deliverable "y"` is raised (not repeated if open) and an Attention Item. When the Obligation is resolved, S3 applies.

**S5. Dispatch rejects a Command.**
The Command becomes Failed. DispatchRejected arrives. The handler issues a new producing Command from the fulfilments that exist now. This closes a window where a fulfilment landed after the Dispatch Engine took its snapshot.

**S6. Deliverable A completes; Deliverable B depends on it.**
DeliverableTransitioned arrives for A. The scan reaches B; check 1 (dependency rows) now passes, and if the other checks pass, B moves to In Progress.

**S7. Many events arrive together.**
Each event starts its own run and the bus does not wait for the previous run. Runs can overlap. Two pieces already guard this: `withDeliverableLock` (one producing Command per Deliverable) and, since CR-144, an advisory lock around blocked-transition Obligation creation.

## 8. Facts the code settles, and the open points

Settled by the code:
- The scan is the same for every event. Only Part B differs.
- The handler never talks to Participants.
- The Capability "must" is enforced by a Policy, not by the handler.

Open points, awaiting your decision:
1. Attention Items from a blocked scan are raised once per attempt, so repeated scans add repeated Attention Items. Obligations are de-duplicated; Attention Items are not.
2. `withDeliverableLock` (in-process) and the CR-144 advisory lock (database-wide) solve the same class of problem. Whether to unify them is undecided.
3. `reissueProducingCommand` is also used for the first Command, so its name is misleading. Renaming is a change beyond the ask.

## 9. Trace: every path that can start decision work for an SEU

Verified by reading the files named. Each row is a way the gate checks, an Obligation, a Command or a state change can start.

| # | Entry | Starts from | What it does | Source |
|---|---|---|---|---|
| 1 | `deliverableKickoff` | SEUOperational, DeliverableTransitioned, CapabilityFulfilled, CapabilityUnavailable, DispatchRejected, ObligationTransitioned (resolved), AttentionItemTransitioned (resolved) | Scan of all Deliverables, then event-specific work (sections 3 and 4) | deliverableKickoff.ts |
| 2 | `executionEngineKickoff` | SEUActivated, ObligationTransitioned (resolved, SEU Obligation with a blocked hop), AttentionItemTransitioned (resolved, SEU item) | `attemptSeuCommenceWork`: checks the SEU's own Policies, raises an Obligation if blocked, moves the SEU Activated to Operational. Does nothing unless the SEU is Activated. | executionEngineKickoff.ts, commissioning.ts `attemptSeuCommenceWork` |
| 3 | Button | POST /seus/:id/deliverables/:deliverableId/transition | `transitionDeliverable`: same gate checks and apply as entry 1, for one Deliverable | web/seus.ts:303, core/deliverables.ts:57 |
| 4 | `capabilityOnReady` | DeliverableReady, SEUCommissioned | Requests fulfilment of the producing Capability: publishes CapabilityRequested | capabilityOnReady.ts |
| 5 | `capabilityRequested` | CapabilityRequested | Fulfils from the named or eligible Participants, then publishes CapabilityFulfilled or CapabilityUnavailable | capabilities.ts:123 |
| 6 | `commandGenerated`, `workItemGenerated` | CommandGenerated, WorkItemGenerated | Work Item, then Dispatch Engine | commandGenerated.ts, workItemGenerated.ts |
| 6a | Dispatch Engine | WorkItemGenerated, RedispatchRequested | Picks a Participant, defers, or rejects. A rejection fails the Command, creates an Obligation (no blocked hop) and an Attention Item, and publishes DispatchRejected or ParticipantUnavailable. | dispatchEngine.ts:62-172 |
| 7 | `redispatch` | RedispatchRequested | Retries dispatch. At the configured limit it creates an Obligation, an Attention Item, marks the Command Failed and publishes DispatchRejected. | redispatch.ts:51-90 |
| 8 | Manual Capability request / release | web/seus.ts:237 and the release route | Publishes CapabilityRequested, or releases Participants | web/seus.ts |
| 9 | `sweepUnavailableCapabilities` | none in `src` | Re-requests a Capability 300 seconds after its last CapabilityUnavailable. The only caller found is tests/capability-requested-fulfilment.test.ts. | capabilityRetrySweep.ts |

Events that feed entry 1 and where they are published:

| Event | Published by |
|---|---|
| DeliverableTransitioned | executionEngine.ts:343 (every Deliverable transition, handler or button) |
| CapabilityFulfilled, CapabilityUnavailable | capabilities.ts:173, 136 |
| DispatchRejected | dispatchEngine.ts:77, 85 (through `rejectDispatch`) and redispatch.ts:79 |
| ObligationTransitioned | obligations.ts:370 |
| AttentionItemTransitioned | attentionItems.ts:96 |
| SEUOperational | the SEU transition in `attemptSeuCommenceWork` (the event name comes from the Transition Definition) |

## 10. Locks that exist today

| Lock | Kind | What it covers | Source |
|---|---|---|---|
| `withDeliverableTurn` | In-process queue per Deliverable | The apply step only. It re-reads the Deliverable and refuses if the state has moved. | executionEngine.ts:42, 246 |
| `withDeliverableLock` | In-process queue per Deliverable | Checking for a live producing Command and creating one | deliverableKickoff.ts:145 |
| `withAdvisoryLock` | In-process queue plus database advisory lock, per related object | Blocked-transition Obligation creation (CR-144). Throws if called inside a transaction. | db.ts:178, obligations.ts:145 |
| `withTransaction` | Database transaction | Entity transitions, used only in entityTransition.ts:55 | db.ts:151 |

No lock exists per SEU.

## 11. What the trace shows

1. Two different handlers consume the same events. ObligationTransitioned and AttentionItemTransitioned go to both `executionEngineKickoff` and `deliverableKickoff`. For one event, the bus runs handlers one after the other (eventBus.ts:34). The order is the row order of an unordered `SELECT` on `event_subscriptions` (eventsDB.ts:71), so no order is guaranteed.
2. Events overlap. A different event starts its own dispatch without waiting (eventBus.ts:98).
3. Only two callers transition a Deliverable: `deliverableKickoffHandler` (entry 1) and the button (entry 3). Both call `transitionDeliverable`.
4. Entry 2 moves the SEU itself, from Activated to Operational. It returns unless the SEU is Activated. Entry 1 returns unless the SEU is Operational. The two never decide on the same SEU in the same state. Redispatch (entry 7) retries a Work Item and feeds entry 1 through DispatchRejected. It does not transition a Deliverable.
5. The paths that raise Obligations are: gate checks (entries 1 and 3), `attemptSeuCommenceWork` (entry 2), `blockDeliverableForUnavailableCapability` (entry 1, CapabilityUnavailable), redispatch exhaustion (entry 7), and dispatch rejection (`rejectDispatch` in dispatchEngine.ts:23, reached from entry 6; no blocked hop).

## 12. The remaining paths, read

| Item | What the code does | Source |
|---|---|---|
| `publishTransition` | Publishes the hop's own event from the Transition Definition. A row naming no event publishes UNDEFINED_EVENT and then SDK_ATTENTION_EVENT. It returns after publishing. SEU state change and its action commit in one transaction first, the event is published after the commit. | entityTransition.ts:55-93 |
| Gate before the transaction | For an entity inside an SEU, the Quality Gate and the participant check run before the transaction opens, not inside it. | entityTransition.ts:45-50 |
| Dispatch rejection | `rejectDispatch` marks the Work Item Disposed and the Command Failed, creates an Obligation with no blocked hop, raises an Attention Item and publishes DispatchRejected or ParticipantUnavailable. Only DispatchRejected feeds `deliverableKickoff`. | dispatchEngine.ts:23-60 |
| Dispatch deferral | No available Participant: the Command is marked Deferred and DispatchDeferred is published. That leads to RedispatchRequested, then `redispatch`. | dispatchEngine.ts:91-104, redispatch.ts |
| Dispatch success | Command Dispatched, Work Item assigned, Participant moved to Assigned, then ParticipantSelected and WorkItemDispatched are published. | dispatchEngine.ts:114-158 |
| Resolving an Obligation | `transitionObligation` runs the transition, publishes the hop's own event, then publishes ObligationTransitioned. That second event feeds entries 1 and 2. | obligations.ts:364-381 |
| Process model | `pnpm start` runs `tsx src/app.ts`. `app.ts` loads event subscriptions once and calls `app.listen`. The code under `src` contains no cluster, worker or fork use. | package.json, app.ts:41, 244 |

Consequences for the design:
1. The dispatch rejection Obligation has no blocked hop, so `hasOpenBlockingObligation` ignores it. A rejected Command is retried through DispatchRejected, not held by that Obligation.
2. The in-process queues in the code (`withDeliverableTurn`, `withDeliverableLock`) cover a single Node process, which is what `pnpm start` starts. How many instances run in a deployment is not recorded in the repository.

## 13. Requirement and status

Requirement stated by the owner, for `deliverableKickoffHandler`: if an event is being handled for an SEU, the next event for that SEU waits. One event at a time for the SEU. This avoids all the overlaps between runs of the handler.

The requirement concerns events handled by the handler. It does not mention the transition button, and no wait for the button is part of it. A line in an earlier draft restated it as "only one Deliverable transition runs at a time", which was wrong and has been removed.

Status:
- No design is proposed in this file yet. No code has been changed for this requirement.
- The only code changes in this thread are CR-144 (the blocked-transition Obligation lock) and the earlier items.

## 14. Changes made

None of these has been checked with `tsc` or the tests. The Demo and the `event_subscriptions` table need a reset or re-seed to show them.

| # | Change | Where |
|---|---|---|
| 1 | An event with no SEU id throws instead of returning silently. | deliverableKickoff.ts |
| 2 | The handler's common steps come first: SEU id check, SEU load, Operational check, resolved-state filters for Obligation and Attention Item events, system actor. | deliverableKickoff.ts |
| 3 | After the common steps the handler dispatches strictly by `event.event_type` to one function per event: `processSeuOperational`, `processDeliverableTransitioned`, `processCapabilityFulfilled`, `processCapabilityUnavailable`, `processDispatchRejected`, `processObligationTransitioned`, `processAttentionItemTransitioned`. An event type with no function throws. | deliverableKickoff.ts |
| 4 | `processSeuOperational` attempts only the start nodes. A start node is a Deliverable that no dependency row of the SEU points at. It first requests fulfilment of their producing Capabilities. | deliverableKickoff.ts, `dependencyDefinitionEngine.isStartNode` |
| 5 | The DeliverableTransitioned payload carries `deliverableName`: `{ deliverableName, fromState, toState, commandId }`. | executionEngine.ts |
| 6 | `processDeliverableTransitioned` reads `deliverableName` and `toState` from the payload. It finds the successors with one query that joins the SEU's dependency rows to its Deliverables (`deliverablesDB.findSuccessors`, row ids from `resolveSeuOwningScope`). It keeps the ready ones (`isTargetReady`), requests their Capabilities, attempts them, and, when the Deliverable moved to In Progress, issues its producing Command. An event without `deliverableName` or `toState` throws. | deliverableKickoff.ts, deliverablesDB.ts |
| 7 | `processCapabilityFulfilled` validates the `capabilityId` first, attempts only the ready Deliverables the Capability produces, then reissues the producing Command for them. | deliverableKickoff.ts |
| 8 | The request logic of `capabilityOnReady` is exported as `requestProducingCapabilities(seuId, deliverables)`: one request per Capability, skipped when the Capability is Fulfilled or a request is in flight. The handler calls it. | capabilityOnReady.ts |
| 9 | `capabilityOnReady` has no subscriptions. The DeliverableReady and SEUCommissioned rows are removed. The handler and its registry entry remain. | eventSubscriptions.json |
| 10 | The DeliverableTransitioned description lists the new payload and the new handler behaviour. | eventSubscriptions.json |
| 11 | The generic Obligation for a Policy block is reverted. An Obligation and an Attention Item are raised only when the Policy's condition declares `relatedObligations`. The CR-144 lock stays. | obligations.ts, constants.ts, CR-144 |

Tests and fixtures changed in the same pass:
- deliverable-kickoff-handler.test.ts: the no-SEU case now rejects; `deliverableName` added to the DeliverableTransitioned payloads; a case for a missing `deliverableName`.
- engine-branches.test.ts: `deliverableName` added to the payload.
- policy-engine.test.ts: the generic-Obligation test and its imports removed.
- cr107, cr108 and testFixtures.ts: comments about the Obligation raised for a block.

## 15. Still to do or undecided

| # | Item |
|---|---|
| 1 | One event at a time per SEU in the handler. The requirement is agreed. No design is written. Where the wait goes, and whether it uses `withAdvisoryLock`, is undecided. How many application instances run is unanswered. |
| 2 | Four events still use the old scan over all Deliverables: ObligationTransitioned, CapabilityUnavailable, DispatchRejected, AttentionItemTransitioned. |
| 3 | With `capabilityOnReady` unsubscribed, nothing outside `deliverableKickoff` requests fulfilment automatically. A Deliverable is attempted only after its Capability request, which `processSeuOperational`, `processDeliverableTransitioned` and the manual Capabilities page now make. |
| 4 | The DeliverableReady entry in eventSubscriptions.json still says `capabilityOnReady` requests fulfilment. The DeliverableTransitioned entry still says it is published by `completeWorkItem`; the only publisher in `src` is `applyGovernedDeliverableTransition`. |
| 5 | Attention Items are raised once per blocked attempt. Whether to raise them once is undecided. |
| 6 | `withDeliverableLock` and the CR-144 `withAdvisoryLock` solve the same kind of problem. Whether to unify them is undecided. |
| 7 | `reissueProducingCommand` also issues the first Command. Renaming it is undecided. |
| 8 | A concurrency test for the CR-144 lock is not written. |
| 9 | `tsc`, the tests, and the Demo reset have not been run. |
