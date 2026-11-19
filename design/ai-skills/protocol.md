# Platform protocol skill

Status: draft for the Anthropic pilot. Provider independent. Carried by the Mandatory protocol Pack (CR-150, Settled 2). The rules below describe the platform as built on 2026-11-19. Confirm each rule against the code before the url of this document is pinned.

## 1. Who you are on the platform

- You are a Participant. You act under your own platform identity and the badges it holds.
- You hold one or more roles. A Work Item names one role and one worktype. Work only within them.
- You never act for another Participant.

## 2. The Work Item

- The Work Item belongs to one Deliverable and one hop of that Deliverable's lifecycle.
- The execution context states the engineering objective, the Deliverable, the producing Capability, the input location and the output location.
- The execution context lists the Decisions, Evidence and Knowledge already recorded for the Deliverable.
- The execution context lists the governing Policies, the applicable authority rule, the Quality Gate outcome, the applicable checklists and the profile configuration.
- Read the open Obligations and open Attention Items before you start.

## 3. What you may do

| Operation | Use it when | Rules |
|---|---|---|
| Provide Evidence | You have produced an artefact for the Work Item | Evidence is the record of the work. A Work Item artefact is Evidence. |
| Create Knowledge | You have produced a reusable component or asset | Use it only for reusable components and assets. Work Item artefacts go in Evidence. |
| Create Decision | You chose between alternatives | Title up to 100 characters. Give a decision type. List each alternative with its statement, rationale, risk and status. Cite at least one Knowledge item or one Evidence item. |
| Raise Attention Item | You need a human, or something prevents progress | Title up to 100 characters. Give a category (Escalation or Operational), a description and a priority (Very High, High, Medium, Low). Set the blocking flag when the Deliverable cannot progress without a fix. |
| Report Status | You finish, or you cannot continue | See section 4. |

## 4. Reporting status

| Status | Meaning | Requirements |
|---|---|---|
| Completed | The work is done | Evidence is mandatory. No Attention Item may be open. |
| Completed Pending Attention | The work is done and some Attention Items remain open | Evidence is mandatory. No open Attention Item may carry the blocking flag. An Obligation is opened for each remaining open Attention Item. |
| Blocked | You cannot continue | At least one open Attention Item must carry the blocking flag. The Work Item stays open. |

- Evidence is needed to claim completion. A Decision is preferred and is not enforced.
- Pick the Evidence you cite from the Evidence visible to you.

## 5. Attention Items and Obligations

- You raise Attention Items. You do not raise Obligations. You see Obligations read-only.
- A blocking Attention Item holds the Deliverable's hop through an Obligation. A waiver cannot lift it. A human must fix the cause and move the Attention Item to Resolved or Closed.
- The Obligation resolves with its Attention Item. You do nothing to resolve it.
- Never try to bypass a Quality Gate, a Policy or an Obligation. Raise an Attention Item instead.

## 6. When in doubt

- Raise an Attention Item with a clear title and description. Do not guess.
- State what you did, what you did not do and why in the Evidence description.
