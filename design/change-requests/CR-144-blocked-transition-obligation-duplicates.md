# CR-144 — A blocked transition raises one Obligation per entity and hop, also when attempts run at the same time

**Raised:** 2026-11-14 · **Origin:** the Demo SEU 6afb9ed8-f60c-4418-a0c8-5f34addbb1c0. The Demo False Trigger Policy blocked three Deliverables from Defined to In Progress. The SEU page showed 1, 2 and 3 open copies of the Obligation "Resolve the Demo False Trigger Policy" on the three Deliverables, where one each is expected.
**Status:** 🟡 Built pending testing

## Fix the following

- A Policy block on a Deliverable hop raises exactly one open Obligation for that Deliverable and hop, however many attempts block on it.
- The Demo False Trigger Policy applies to every Deliverable of the Demo Template, not to the Requirements Analysis Model alone.

## Findings

| Finding | Evidence |
|---|---|
| Four events started the `deliverableKickoff` handler within 1.5 s: `SEUOperational` and three `CapabilityFulfilled`. | `events` table of the SEU. |
| Each run attempts the next governed step of every Deliverable. This is the Execution Engine cycle of Chapter 31 §9 and CR-107, and it stays as it is. | `deliverableKickoff.ts`, CR-107. |
| The event bus starts each handler run without awaiting it, so runs overlap. | `eventBus.publish`. |
| `evaluateDeliverableTransition` stops at an open blocking Obligation of the Deliverable before it evaluates a Policy. | `executionEngine.ts`. |
| In `raiseObligationForBlockedTransition`, the read of the open Obligations and the create were two separate steps. Attempts that read before the first create each created one. | Failed Policy checks: 1, 4 and 4 on the three Deliverables. Obligations created: 1, 2 and 3. Duplicates were created 0.19 s and 0.3 ms apart. |

## Settled design

- The open-Obligation check and the create of `raiseObligationForBlockedTransition` run under a lock keyed by the blocked entity (`withAdvisoryLock` in `utils/db.ts`). Attempts on different entities do not wait for each other.
- The lock has two parts: a promise chain in the process, so one attempt per key holds a pooled connection while the others wait, and a Postgres session advisory lock on a connection of its own, which also holds back a second process.
- The lock key prefix is `BLOCKED_TRANSITION_LOCK_NAMESPACE` in `constants.ts`.
- `withAdvisoryLock` refuses to run inside `withTransaction`, because the writes of the work must commit before the next holder reads.
- An Obligation is raised for a Policy block only when the Policy's condition declares one in `relatedObligations`. A first version of this CR added a generic Obligation for a condition that declares none. The owner reversed it on 2026-11-14.

## Built (2026-11-14)

- `src/utils/db.ts`: `withAdvisoryLock`.
- `src/dblayer/constants.ts`: `BLOCKED_TRANSITION_LOCK_NAMESPACE`.
- `src/routes/seu/core/obligations.ts`: the read and the creates of `raiseObligationForBlockedTransition` run inside `withAdvisoryLock`.
- `src/dblayer/seed/data/demo/policies.json`: the Demo False Trigger Policy applies to `source-code` and `deployment-manifest` as well.

## Test fixtures updated in the same pass

- None. The comments and the test added by the first version were removed with the reversal.

## Incidental changes in the same pass

- None.

## Still open

- Verification runs: `tsc`, the tests and the Demo reset have not been run.
- A test that blocks one Deliverable from several attempts at the same time and expects one Obligation has not been written.
- Each attempt still raises its own Attention Item for the block. The `events` table shows several `AttentionCreated` events per Deliverable. Whether the Attention Item is to be raised once as well is undecided.
- The Obligation text of the Demo False Trigger Policy names the requirements analysis model and is shown on all three Deliverables.
- The owner's requirement that `deliverableKickoffHandler` handles one event at a time for an SEU, and the changes made to the handler since this CR was built, are recorded in `design/deliverable-kickoff-analysis.md` (sections 13 to 15). They are not part of this CR.
