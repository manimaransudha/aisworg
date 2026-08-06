# Participant Lifecycle Governance — Plan

*Book 3 Ch.13 (Participant Model). Written 2026-08-06 after reading the actual live code — `participants` already carries Ch.13's exact lifecycle as a schema constraint, but nothing governs it. Same shape of gap Phase 1 (Objective) and Phase 9 (Pack) already fixed elsewhere: the schema anticipated real governance before any of it was wired up.*

## What's already real

- **`participants`** (`002_seu_platform.sql`) — real identity: `id`, `seu_id`, `type` (`AI`/`Human`/`External`), `display_name`, and a `state` column whose `CHECK` constraint is *exactly* Ch.13 §9's lifecycle (`Created`, `Available`, `Assigned`, `Executing`, `Idle`, `Released`, `Archived`). `user_id` (added `014_sdk_authoring.sql`) links a Human Participant to a real platform login.
- **`capability_fulfilments`** (Ch.12) — the eligible-Participant pool: `seu_capability_id`, `participant_id`, `fulfilment_strategy`, `established_at`, `revoked_at`. `revoked_at` is already a real revoke primitive, just never called by anything today.
- **`fulfilCapability`** (`core/capabilities.ts`) is the only place a Participant is created — always bundled 1:1 with establishing a Capability Fulfilment in the same call. There's no standalone "create a Participant" path, by design.
- **`dispatchEngine`** reads `capabilityFulfilmentsDB.findActiveBySeuCapabilityId` to get a `participant_id` for a Work Item, and publishes `ParticipantSelected` when it does — but never reads or writes `participants.state` anywhere. That event is about a Work Item's dispatch selecting *a* participant, not about the Participant's own lifecycle — a distinction that matters for step 2 below.

## What's missing — the real gap

1. **`Participant` isn't a governed `TransitionEntityType`.** The union has 11 values; `Participant` isn't one of them. `participantsDB` has only `create`/`findById` — no update, no transition function. `state` defaults to `'Available'` at creation and then never changes, not even manually. Nothing validates that a state change follows Ch.13 §9's legal lifecycle graph the way `transitionEngine` already validates it for every other entity type.

2. **None of Ch.13 §16's real events are published.** `ParticipantSelected` exists, but it's a Work Item dispatch event, not one of the eight Ch.13 actually names: `ParticipantCreated`, `ParticipantAssigned`, `ParticipantReleased`, `ParticipantActivated`, `ParticipantIdle`, `ParticipantReplaced`, `ParticipantArchived`, `ParticipantUnavailable`. None of these fire anywhere today.

3. **No replacement mechanism** (Ch.13 §13, PM-001, FR-13.5/FR-13.6). `capability_fulfilments.revoked_at` is the closest existing primitive, but nothing calls it — there's no governed "replace this Participant" action.

4. **Assignment/Executing/Idle happen to the Work Item, not the Participant.** `dispatchEngine`'s Generated→Assigned→Executing→Completed→Disposed sequence (Phase 3) is the *Work Item's* lifecycle (Ch.32) — a different state machine, on a different row, from `participants.state` (Ch.13 §9). Easy to conflate reading the Phase 3 log casually; they're two separate chapters' worth of states. Nothing today moves the Participant's own `state` when its Work Items do.

5. **Multiple-fulfilment / a real Dispatch Strategy is separate, later scope** — `dispatchEngine`'s own comment already says so (Ch.33 §9, once more than one Participant can fulfil the same Capability). Participant lifecycle governance doesn't need that solved first; a governed lifecycle is meaningful even at today's 1:1.

6. **Autonomous AI execution is out of scope here too, and out of Ch.13's own scope.** §7: "the implementation technology is outside the scope of this specification" for AI Participants. This plan governs the lifecycle *record* — Created/Available/Assigned/Executing/Idle/Released/Archived as real, checked states — not what an AI Participant actually does while Executing.

## Principles (Ch.13 §5) — most already hold structurally; noted, not all need building

- **PM-001 Replaceable** — the real build item (step 4).
- **PM-002 Identity stable throughout lifecycle** — already true (`id`/`type`/`seu_id` are never written after `create`); state transitions in step 1 must not touch them.
- **PM-003 Shall not own engineering knowledge** — already true and confirmed, not assumed: `deliverables`, `obligations`, `evidence`, `knowledge_items`, `decisions` carry no `participant_id` anywhere in the schema. Only `capability_fulfilments.participant_id` and `work_items.participant_id` reference a Participant at all — nothing to build here, just worth having actually checked before relying on it in step 4.
- **PM-004/PM-005** (execute behaviour and fulfil Capabilities, don't define or own them) — already true architecturally; `participants` has no behaviour-defining or Capability-owning fields. No change needed.
- **PM-006 Independent of AI technologies** — same "small core" discipline used everywhere else in this codebase: the state machine built here is generic across all three Participant Types; whatever an AI Participant's actual execution logic eventually is stays outside this table.

## Build order

1. **Participant as a governed `TransitionEntityType`.** Add `'Participant'` as the 12th value, same "zero new evaluation code" pattern every phase since Phase 1 has used — new `transition_definitions` rows encode Ch.13 §9's real graph (`Created→Available→Assigned→Executing→Idle→Released→Archived`, with the explicit repeat-cycle among `Assigned`/`Executing`/`Idle` §9 names). `participantsDB` gains a `transition` method shaped like every other entity's (`obligationsDB`/`decisionsDB`, etc.). Migration widens the now-familiar `entity_type` CHECK union on `transition_definitions`/`quality_gates` — the same rerun-safety fix the last several migrations have each had to repeat for the same reason.

2. **Wire Ch.13 §16's real events**, off the new transition function from step 1 — the same way every other entity's transition function already publishes its own `<Entity>Transitioned` event, just under Participant's chapter-specific names (`ParticipantActivated`/`ParticipantIdle`/`ParticipantAssigned`/`ParticipantReleased`/`ParticipantArchived`/`ParticipantUnavailable`). Publish `ParticipantCreated` at `fulfilCapability`'s existing create call too, alongside the `CapabilityFulfilled` event already there — not replacing it, since they're about different things (one is about the Capability being fulfilled, one is about the Participant now existing).

3. **Connect Participant state to Work Item execution** — the one genuinely new piece of logic in this plan; everywhere else here is "the same pattern every other entity already has." When `dispatchEngine` moves a Work Item through its own Generated→Assigned→Executing→Completed→Disposed sequence, it should also move the assigned Participant's `state`: `Assigned` on dispatch, `Executing` when the Work Item starts, back to `Idle` (not `Available`) once Completed/Disposed — `Idle` vs. `Available` is exactly the distinction §9 draws between a Participant still held by an open Capability Fulfilment and one that's actually been Released.

4. **Replacement** (Ch.13 §13, PM-001, FR-13.5/FR-13.6). A governed old-Participant `Released → Archived` plus new-Participant creation, re-pointing the existing `capability_fulfilments` row's `participant_id` — reusing the `revoked_at` primitive already on that table rather than inventing a second one. Confirmed above, not assumed: `deliverables`/`obligations`/`evidence`/`knowledge_items`/`decisions` reference no `participant_id` anywhere, so nothing needs re-pointing there. `work_items.participant_id` on already-`Disposed` rows is a historical record of who executed a completed Work Item (Ch.32 WI-001/WI-003's transience) — correctly left untouched, not re-pointed. Replacement is structurally free at the data level; this step is the governed action plus its `ParticipantReplaced` event, not a data-migration problem.

5. **Held, explicitly out of this plan's scope:**
   - **Real Dispatch Strategy / multi-Participant-per-Capability (Ch.33 §9)** — already named as future scope by `dispatchEngine`'s own comment; not a prerequisite for lifecycle governance.
   - **Autonomous AI execution** — Ch.13 §7 itself puts "implementation technology" for AI Participants outside this chapter's own scope; this plan governs the lifecycle record, not what happens during `Executing`.
   - **Participant Type / Participant Instance split** — `002_seu_platform.sql`'s own comment already notes Ch.12 proposes this split but Ch.13's normative body never delivers it as two entities; not revisited here, same call the original schema already made.
