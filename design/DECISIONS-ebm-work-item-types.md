# Session checkpoint: EBM composition and work item types

Whiteboard state, 2026-11-19. Nothing here is built. No CR is raised yet.

## Scope in one list

Nothing changes in the EBM lifecycle states, the events or EBM creation in Compose.

1. Compose always lands on the Resolve Conflicts page, even with no conflicts.
2. The user picks work item types there, and the picks are saved.
3. Validate shows the composition again for edits and creates the EBM in Composed. Compose no longer creates the EBM.
4. Activate runs the liveness check, then Composed to Validated to Active, or Composed to Retired on failure.

## Settled

| # | Decision |
|---|---|
| 1 | The chain Deliverable, Service, Capability is unchanged. A Service has one Capability. A Deliverable can be made by several Services. |
| 2 | Work item types are sub-items under a Deliverable. Commissioning, Quality Gating and the Deliverable lifecycle do not change. |
| 3 | Roles and worktypes stay on the Capability Definition. The Service the user picks for a Deliverable fixes the Capability, and so the candidate roles and worktypes. |
| 4 | Different Capabilities that make the same Deliverable have different roles and worktypes. Checked for `source-code`: four Capabilities, no shared role or worktype. |
| 5 | The Resolve Conflicts page is always shown after Compose, even with no conflicts, because work item types always need to be picked. |
| 6 | The Service picker shows each candidate Service's work item types and roles, so the user sees why they choose one Service over another. |
| 7 | A Deliverable with one candidate Service has that Service shown automatically. Its work item types and roles are still shown, and the user still picks the work item types. |
| 8 | The user picks work item types per worktype, only from the chosen Capability's catalogue roles and worktypes. The role follows automatically from the worktype. |
| 9 | Each Deliverable must have at least one work item type picked. |
| 10 | The picks are saved as extra fields on `SettledService` (settleServices.ts), so they travel in `behaviors.settled` on the EBM. No new settled table. |
| 11 | Compose is a draft held on the SEU row. It does not create the EBM. The Composed state is about the SEU's composition, not about an EBM row. |
| 12 | The EBM lifecycle states, hops, events and verbs do not change. The button stays named Validate. |
| 13 | Validate shows the composition again on the Composition page, allows edits, and creates the EBM from the SEU's composition. It runs no liveness check. |
| 14a | Validate ends with the EBM in Composed (None to Composed, `EBMCreated`). It does not move the EBM to Validated. This replaces the earlier idea that Validate also runs Composed to Validated. |
| 14b | Activate runs the liveness check. If it passes, the EBM goes Composed to Validated (`EBMValidated`) and then Validated to Active (`EBMActivated`). If it fails, the EBM goes Composed to Retired (`EBMRetired`, with the existing Attention Item). |
| 14c | Badges are not a design item. No badge, verb or authority row changes. Whoever holds the badge a button already uses is authorised. |
| 14 | The EBM lifecycle states, hops and events are the same as today. Only the button that runs each hop moves. |
| 15 | After the EBM is active, Work Item generation produces one Work Item per picked worktype. The detail is deferred until the composition changes are finished. |

## Facts checked in the code

- Compose route: objectives.ts:517. It stores the draft on the SEU row (`setCompositionReport`) and publishes `CompositionCompleted` when no blocking conflict is open. That event creates the EBM in Composed (compositionCompleted.ts:85). The redirect at objectives.ts:589 skips Resolve Conflicts in that case.
- Only `ebmsDB.create` (compositionCompleted.ts:85) and `ebmsDB.updateStatus` (entityAdapters.ts:323) write the `ebms` table today.
- The EBM transitions are None to Composed (governed), Composed to Validated (manual, `ebm_validate`), Validated to Active (manual, `ebm_activate`) and Composed to Retired (governed).
- `validateEbm` (commissioning.ts:359) runs `checkEbmLiveness`. A dead reference takes Composed to Retired and raises an Attention Item.
- A Deliverable with several candidate Services and no pick is an open `service-choice` conflict and counts in `blockingEbmConflicts` (conflicts/index.ts:128).
- The Resolve Conflicts page redirects to the SEU when `seu.active_ebm_id` is set (objectives.ts:686).

## Open

- Where the Validate button sits, since the EBM does not exist until Validate runs.
- What a failed liveness check does at Validate and at Activate (today Composed to Retired with an Attention Item; Retired has no hop from Validated).
- Work Item generation from the picked worktypes (deferred): how `producing_capability_id`, Commands, Dispatch and completion use them.
- Test fixtures, `route_authority` rows and views affected by the changes.

## Next step

Settle the open items one at a time, then raise the CR.
