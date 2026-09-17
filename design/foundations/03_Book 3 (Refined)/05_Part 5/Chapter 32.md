
# Chapter 32 – Work Item Model

[Sudha: Originally, we thought **Work Items** were fundamental.

Then we realised Deliverables are fundamental.

Then we realised Commands are fundamental.

Now I think Work Items occupy a very different place in the architecture.

## I no longer think Work Items are engineering objects.

I think they are **execution artefacts**.

That's a profound difference.

A Deliverable exists because the business needs it.

A Command exists because the Runtime Kernel wants something done.

A Work Item exists only because a particular Participant needs instructions for carrying out that Command.

After execution completes, the Work Item has served its purpose.

It is ephemeral.

This also means that **different Participants may receive different Work Items for the same Command.**

That is something no existing ALM tool really models.

----------------

I think we've just completed one of the platform's most important conceptual shifts.

Traditional ALM systems treat **Work Items** as the primary object:

- Jira Issues
- Azure DevOps Work Items
- GitHub Issues
- Rally Stories

Everything revolves around them.

In this architecture, Work Items become almost disposable.

The real engineering assets are:

- Deliverables
- Knowledge
- Evidence
- Decisions
- Obligations

Work Items merely help Participants contribute to those assets.

## I think we can now distinguish four different runtime concepts

|Concept|Purpose|Lifetime|
|---|---|---|
|**Command**|Expresses engineering intent.|Transient|
|**Work Item**|Expresses participant-specific execution instructions.|Transient|
|**Event**|Records that something happened.|Permanent|
|**State Transition**|Changes authoritative engineering state.|Permanent|

That separation is much cleaner than what most workflow systems provide.

---

## One refinement I'd propose before proceeding

The next chapter was originally **Scheduling**.

I now think it should be **Dispatching** instead.

Scheduling answers:

> _"When should something run?"_

Dispatching answers:

> _"Which available Participant should receive this Work Item now?"_

In a human organisation, scheduling dominates because people are scarce and time is the primary constraint.

In an AI-first SEU, scheduling is often trivial—many AI Participants can execute immediately and in parallel. The more interesting runtime decision is **dispatching**: selecting the most appropriate Participant (or Participants), considering capabilities, cost, latency, specialisation, confidence, workload, locality, or organisational policy.

That is a fundamentally different optimisation problem, and I think it deserves its own first-class architectural chapter before we discuss time-based scheduling. It also aligns perfectly with your earlier observation that **dependencies, not elapsed time, drive engineering execution**.
]
---

# 1. Purpose

The Work Item Model defines how execution instructions are generated, presented and managed for Participants within a Software Engineering Unit (SEU).

Work Items are transient execution artefacts derived from engineering Commands.

They provide Participant-specific execution guidance while preserving the separation between engineering intent and execution strategy.

Work Items are not persistent engineering objects.

They are runtime artefacts.

---

# 2. Scope

This chapter defines:

- Work Item abstraction;
- Work Item lifecycle;
- Work Item generation;
- Work Item execution;
- Work Item completion;
- Work Item traceability.

This chapter does not define:

- engineering behaviour;
- governance;
- participant implementation;
- command generation.

---

# 3. Architectural Position

```
Engineering State

↓

Execution Engine

↓

Command

↓

Work Item Generator

↓

Participant

↓

Execution

↓

Engineering State Transition
```

Work Items translate engineering intent into executable instructions.

---

# 4. Definition

A Work Item is a transient execution artefact that instructs a Participant how to fulfil an engineering Command within the current engineering context.

A Work Item exists only for the duration of execution.

Engineering truth remains in:

- Deliverables;
- Decisions;
- Knowledge;
- Evidence;
- Obligations.

---

# 5. Architectural Principles

## WI-001

Work Items are transient.

---

## WI-002

Work Items are derived from Commands.

---

## WI-003

Work Items shall never become the system of record.

---

## WI-004

Work Items are participant-specific.

---

## WI-005

Completion of a Work Item does not imply completion of engineering work.

Only a successful state transition establishes engineering completion.

---

## WI-006

Work Items shall remain reproducible.

---

# 6. Functional Requirements

### FR-32.1

Every Work Item shall reference exactly one Command.

---

### FR-32.2

Multiple Work Items may be generated from the same Command.

---

### FR-32.3

Work Items shall reference the current engineering context.

---

### FR-32.4

Work Items shall support Participant-specific execution guidance.

---

### FR-32.5

Completed Work Items shall remain traceable.

---

### FR-32.6

Work Items shall support cancellation.

---

### FR-32.7

Work Items shall never directly modify engineering state.

---

# 7. Work Item Components

Every Work Item shall define:

- Work Item Identifier
- Command Reference
- Assigned Participant
- Execution Context
- Engineering Objective
- Input References
- Expected Outputs
- Constraints
- Priority
- Status

The internal representation is implementation-defined.

---

# 8. Work Item Lifecycle

Every Work Item shall progress through the following lifecycle.

```
Generated

↓

Assigned

↓

Executing

↓

Completed

↓

Disposed
```

Cancelled Work Items transition directly to **Disposed**.

Disposed Work Items remain available for traceability but are no longer active.

---

# 9. Work Item Generation

The Work Item Generator shall derive Work Items from:

- Command;
- Engineering Behavior Model;
- Participant capabilities;
- current engineering context;
- applicable Packs;
- active Deliverables.

Different Participants may receive different Work Items for the same engineering Command.

---

# 10. Participant Adaptation

The platform shall adapt Work Items according to Participant type.

Examples include:

## AI Participant

- structured prompt;
- contextual knowledge;
- execution constraints;
- expected outputs.

---

## Human Participant

- engineering objective;
- background information;
- supporting documents;
- acceptance expectations.

---

## External System

- API invocation;
- payload definition;
- execution parameters;
- expected response.

The engineering intent remains identical.

Only the execution guidance changes.

---

# 11. Execution Context

Every Work Item shall include:

- relevant Deliverables;
- applicable Knowledge;
- supporting Evidence;
- governing Policies;
- applicable Authority;
- active Obligations;
- current Engineering Behavior Model;
- relevant Ontology concepts.

Participants receive everything necessary to perform the requested engineering activity.

---

# 12. Completion

Completion of a Work Item indicates that the assigned Participant has completed the requested execution activity.

Completion does not imply:

- Deliverable approval;
- Decision approval;
- Knowledge publication;
- engineering completion.

Further governance evaluation remains required.

---

# 13. Disposal

After completion or cancellation, a Work Item shall be disposed.

Disposed Work Items shall retain:

- execution history;
- execution duration;
- assigned Participant;
- generated outputs;
- originating Command.

Disposed Work Items shall not participate in future engineering execution.

---

# 14. Traceability

Every Work Item shall preserve:

- originating Command;
- assigned Participant;
- related Deliverables;
- execution timestamps;
- generated outputs;
- resulting Events;
- subsequent state transitions.

This enables complete reconstruction of engineering execution.

---

# 15. Events

The Work Item subsystem shall publish:

- WorkItemGenerated
- WorkItemAssigned
- WorkItemStarted
- WorkItemCompleted
- WorkItemCancelled
- WorkItemDisposed

---

# 16. Non-Functional Requirements

The Work Item Model shall:

- support heterogeneous Participants;
- remain lightweight;
- support rapid generation;
- preserve execution traceability;
- remain independent of Participant implementations.

---

# 17. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Work Items are transient.

✓ Work Items are derived from Commands.

✓ Different Participants can receive different Work Items for the same Command.

✓ Work Items never become engineering records.

✓ Completion of a Work Item does not itself change engineering state.

✓ Work Item history remains traceable.

---

# 18. Deliverables

Implementation of this chapter shall produce:

- Work Item Generator.
- Work Item domain model.
- Participant adaptation service.
- Work Item lifecycle service.
- Work Item APIs.
- Work Item events.
- Execution traceability service.

---

# 19. Implementation Specifics

*Recorded 2026-09-17. This section documents how the Work Item Model is realised in the current build. It does not change the requirements above (WI-001–006, §§1–18); it records what is built, what is partial, and what is still open — the same convention as Chapter 5 §19. Status markers: ✅ built · ⚠️ partial · 🚩 not built.*

## 19.1 ✅ One Work Item per Command — the minimal instance, deliberately (§4, WI-002, FR-32.1)

`workItemGenerator.generate` (`domain/engine/workItemGenerator.ts`) creates exactly one `work_items` row per `CommandRow` and publishes `WorkItemGenerated` — WI-002 and FR-32.1 hold exactly. It is explicitly the "Ch.32 minimal instance," by its own header comment: FR-32.2/§9's "different Participants may receive different Work Items for the same Command" needs more than one Participant eligible for the same Capability at once, which Capability Fulfilment (Ch.12) doesn't support yet — so FR-32.2 is **🚩 not built**, not a bug, a stated prerequisite gap.

## 19.2 ⚠️ Lifecycle — a different, wider state set than §8, some states unreachable (§8)

`WorkItemStatus` (`seuTypes.ts`) is `"Generated" | "Assigned" | "Dispatched" | "Executing" | "Completed" | "Failed" | "Cancelled" | "Disposed"` — a superset of §8's `Generated → Assigned → Executing → Completed → Disposed`, with `Dispatched` and `Failed` added, and the transitions actually driven are `Generated → Dispatched → Completed → Disposed` (happy path) or `Generated → Dispatched → Failed` (failure path). `Assigned` is set transiently inside `workItemsDB.assign` but overwritten to `Dispatched` in the same call chain before anything observes it as a distinct state — no `WorkItemAssigned` event is ever published for it (§19.6). `Executing` is declared in the type but never set anywhere in the codebase — by design, per `dispatchEngine.ts`'s own comment: "the platform is deliberately blind to what the Participant does in its own environment," so there is no out-of-process signal that would ever move a Work Item into `Executing`. `Cancelled` exists as a status value but nothing transitions a Work Item into it (§19.5).

## 19.3 ✅ Work Item completion never changes engineering state directly; a separate explicit step does (§12, WI-005, FR-32.7)

`completeWorkItem` (`core/workItems.ts`) keeps the two steps distinct exactly as WI-005/FR-32.7 require: on `outcome: "done"` it applies `deliverablesDB.updateLifecycleState` and publishes `DeliverableTransitioned` as its own explicit act, separate from — and only after — recording the Work Item's own completion. On `outcome: "failed"|"blocked"` the Deliverable transition is never applied at all; only the Command and Work Item are marked `Failed`, and an AttentionItem is raised (`category: "Exception"`). Completion of the Work Item genuinely does not imply engineering completion.

## 19.4 ✅ Disposal — real, and retains what §13 requires (§13)

On `done`, `completeWorkItem` moves the Work Item `Completed → Disposed` in the same call, publishing `WorkItemCompleted` then `WorkItemDisposed`. Disposed rows are never deleted, so execution history, participant, and (via `deliverableReferencesDB`) generated outputs and originating Command all remain queryable — §13's retained-fields list is satisfied by the row plus its linked `deliverable_references`/`attestations` rows, not fields on `work_items` itself.

## 19.5 🚩 Cancellation — not built (FR-32.6)

No code path transitions a Work Item to `Cancelled`, and no `WorkItemCancelled` event is ever published. §8's "Cancelled Work Items transition directly to Disposed" branch and FR-32.6 are both unrealised.

## 19.6 ⚠️ Events — a different vocabulary than §15, not a 1:1 match (§15)

Published, by name, somewhere in the codebase: `WorkItemGenerated` (`workItemGenerator.ts`), `WorkItemDispatched` (`dispatchEngine.ts`, both the unassigned and assigned branches), `WorkItemFailed` and `WorkItemCompleted`/`WorkItemDisposed` (`core/workItems.ts`), plus `WorkItemStalled` (`core/workItemHeartbeat.ts`, an SLA-timeout event §15 doesn't name at all). **Not published anywhere:** `WorkItemAssigned` (superseded by `WorkItemDispatched`, §19.2), `WorkItemStarted` (no signal exists to fire it from, §19.2's `Executing` gap), `WorkItemCancelled` (§19.5). So 3 of §15's 6 named events are real, one (`WorkItemFailed`) exists in code but not in the spec's list, and one real platform event (`WorkItemStalled`) has no §15 counterpart either.

## 19.7 ⚠️ Execution Context — assembled implicitly through linked rows, not as one populated structure (§7, §11, FR-32.3)

A Work Item row itself carries only `id`, `command_id`, `participant_id`, `status`, `dispatch_strategy`, `output_reference`, `target_completion_at`, timestamps — §7's Execution Context/Engineering Objective/Input References/Expected Outputs/Constraints/Priority are not fields on `work_items`. §11's list (relevant Deliverables, Knowledge, Evidence, Policies, Authority, Obligations, EBM, Ontology) is not assembled or attached to the Work Item anywhere; a Participant resolving a Work Item's context does so by following `command_id` → the Command's own `entity_id`/`entity_type`/`from_state`/`to_state` and querying the relevant tables directly, not by reading a pre-built context payload the Work Item Generator produced. FR-32.3's "reference the current engineering context" is satisfied indirectly (via `command_id`), not as an explicit, structured reference set.

## 19.8 🚩 Participant Adaptation — not built (§10)

No adaptation service exists. There is no logic anywhere that shapes a Work Item's content differently for an AI Participant (structured prompt), a Human Participant (background/acceptance expectations), or an External System (API invocation/payload) — `work_items` carries no participant-type-specific content field at all. §10 is unrealised.

## 19.9 ✅ Dispatch — a real, minimal strategy layer, distinct from the Work Item Generator (§9, Ch.33)

`dispatchEngine.dispatch` (`domain/engine/dispatchEngine.ts`) is the real "different Participants may receive different Work Items" seam §9/Ch.33 describes, but today implements a single trivial strategy: the sole Participant holding an active Capability Fulfilment for the producing Capability (`SOLE_ELIGIBLE_PARTICIPANT`), or left unassigned/outstanding if no Capability was declared (`NO_CAPABILITY_DECLARED`). No Participant-selection optimisation (cost/load/locality/specialisation, §9's own list) exists yet — by design, per the file's own header comment, deferred until more than one Participant can fulfil the same Capability.

## 19.10 ✅ Traceability is real, distributed across linked tables (§14, FR-32.5)

Every element §14 names is reconstructable: originating Command (`work_items.command_id`), assigned Participant (`participant_id`, plus `ParticipantAssigned`/`ParticipantIdle` events), related Deliverables and generated outputs (`deliverable_references`, keyed by `work_item_id`), execution timestamps (`created_at`/`updated_at`/`target_completion_at`), resulting Events and subsequent state transitions (`DeliverableTransitioned`, `WorkItemCompleted`/`Disposed`, all correlation/causation-linked via `eventBus`). As with Governance (Ch.21 §17.14), this is real but distributed — no single "Work Item execution record" join; reconstruction means following `command_id`/`work_item_id` across tables.

## 19.11 ✅ Stall detection — a real mechanism §15 doesn't name (§11 SLA note, not directly specified)

`core/workItemHeartbeat.ts` checks outstanding (`Dispatched`) Work Items against `target_completion_at` (set by `dispatchEngine` from the producing Capability's Service Level turnaround, Ch.11 §8) and publishes `WorkItemStalled` plus (per the Ch.32/Ch.34 comment in `core/workItems.ts`) routes into Attention when a Participant misses its SLA — a real, working escalation path the chapter itself doesn't name but that fits WI-005/§12's "further governance evaluation remains required" spirit.