# A typical AI Participant conversation under the skills

**Status:** Illustrative. It is the conversation the three skills lead to, written for the real Work Item of the Coding Agent. No model produced it.
**Date:** 2026-11-19
**Belongs to:** [CR-150](change-requests/CR-150-ai-participant-skills-and-provider-adapters.md)

## 1. Purpose

The Deliverables tab of an AI Participant should show what the Participant did and why, in the order it happened. This document is the script for that view. It shows the conversation an AI would have when it follows the bootstrap instruction, the protocol skill and the Anthropic job skill.

## 2. What the AI receives

| Part | Content |
|---|---|
| System | The bootstrap instruction, the protocol skill and the Anthropic job skill, each in its own tag |
| First message | The Work Item in a `<work_item>` tag, then the output contract |
| Tools | `provide_evidence`, `create_knowledge`, `create_decision`, `raise_attention_item`, `report_status` |

The Work Item of this example is taken from the database. It was assigned to ArchVault Coding Agent.

| Item | Value |
|---|---|
| Engineering objective | Source Code |
| Deliverable | Source Code (In Progress) |
| Service | Engineering mobile applications (mobile-application-engineering) |
| Input location | https://guides.example.com/deliverables/source-code |
| Output location | not set |
| Open Attention Item | "Deliverable is blocked by Policy "Demo False Trigger" — Resolve the Demo False Trigger Policy" (Created) |
| Open Obligations | "Resolve the Demo False Trigger Policy" (Identified). "Recurring friction: Quality Gate "No Unresolved Obligations" has blocked 3 transition attempt(s) in this SEU" (Identified) |
| Quality Gate | Waived, confidence 25% |
| Governing Policies, Decisions, Knowledge, Evidence | none recorded |
| Profile | development, TypeScript, GitHub, Scrum, AI provider anthropic |

## 3. The conversation

**Assistant (reasoning)**

> Step 1. I read the whole execution context before I write anything.
>
> - The objective is Source Code. The Deliverable "Source Code" is In Progress. The Service is Engineering mobile applications.
> - The input location is https://guides.example.com/deliverables/source-code. The output location is not set. I should raise this as an Attention Item as this will block the deliverable. I will however create it in my cache. 
> - One Attention Item is open: the Deliverable is blocked by the Policy "Demo False Trigger". Two Obligations are open. The Quality Gate was waived with 25% confidence. This will not impact the source code I have to generate
> - No Decision, Knowledge or Evidence is recorded yet that I can use to generate the code
> - The profile asks for TypeScript on GitHub with Scrum. I will use the information provided in the Work Item Sheet and ask if I do not find one. 
>
> Step 2. The checklists in the context are my acceptance criteria. The first statement is "The solution has been decomposed into design elements consistent with the requirements and constraints." I walk each statement against what I can do now.
>
> Step 3. I read the input location. My tools can record Evidence, Knowledge, Decisions and Attention Items and report status. None of them opens a URL or writes a file. I cannot read the guide and I cannot write source code to an output location that is not set.
>
> Step 4. The open Attention Item blocks the Deliverable through an Obligation. The protocol skill says I never bypass a Policy or an Obligation and that a human must fix the cause. I leave it as it is.
>
> My plan. I record in Evidence what I did and did not do. I keep the input location as Knowledge. I raise one blocking Attention Item for the missing output location. I report Blocked.

**Assistant (tool call)** `provide_evidence`

```json
{
  "category": "Analytical Evidence",
  "title": "Review of the Work Item for Source Code",
  "description": "Read the execution context. Did: reviewed the objective, the locations, the open Attention Item, the two open Obligations and the checklists. Did not do: write source code, because the output location is not set and no tool of mine writes files; read the input guide, because no tool of mine opens a URL. The Deliverable stays blocked by the Policy Demo False Trigger, which a human must resolve.",
  "source": "https://guides.example.com/deliverables/source-code"
}
```

**Platform:** `Evidence recorded. id: <evidence id>`

**Assistant (tool call)** `create_knowledge`

```json
{
  "category": "Operational Knowledge",
  "title": "Input location for Source Code",
  "description": "https://guides.example.com/deliverables/source-code",
  "evidence_id": "<evidence id>"
}
```

**Platform:** `Knowledge recorded. id: <knowledge id>`

**Assistant (tool call)** `raise_attention_item`

```json
{
  "category": "Escalation",
  "priority": "High",
  "blocks_progress": true,
  "title": "Output location is not set for Source Code",
  "description": "The Work Item has no output location, so the source code has nowhere to be written. Please set the output location, and resolve the open Policy block, then dispatch the Work Item again."
}
```

**Platform:** `Attention Item raised. id: <attention item id>`

**Assistant (tool call)** `report_status`

```json
{ "status": "blocked", "evidence_ids": ["<evidence id>"] }
```

**Platform:** `The Deliverable is blocked by 1 Attention Item(s). The Work Item stays open.`

**Assistant (final answer)**

> `<final_answer>`
> "Source Code" is blocked. I reviewed the Work Item and recorded the review as Evidence. I kept the input location as Knowledge. I raised a blocking Attention Item because the output location is not set. I wrote no source code. The Policy block already open on the Deliverable needs a human.
> `</final_answer>`

## 4. Where each step comes from

| Step of the conversation | Skill sentence behind it |
|---|---|
| Read the whole context first | Job skill 1: "Read the whole execution context before you write anything." Protocol 2: "Read the open Obligations and open Attention Items before you start." |
| Walk the checklists | Job skill 1: "Use the checklists in the execution context as the acceptance criteria." |
| Name the step and the expected result | Job skill 1: "State the step you are on and the result you expect." |
| Leave the open Policy block alone | Protocol 5: "Never try to bypass a Quality Gate, a Policy or an Obligation. Raise an Attention Item instead." |
| Say what was and was not done | Protocol 6: "State what you did, what you did not do and why in the Evidence description." |
| Knowledge only for the reusable input location | Protocol 3: Knowledge is for reusable components and assets. Work Item artefacts go in Evidence. |
| Blocking Attention Item before Blocked | Protocol 4: "Blocked" needs an open Attention Item with the blocking flag. |
| Report Status last, once | Job skill 3: "Call `report_status` once, last." |

## 5. The outcome when nothing blocks

With an output location set and no open Attention Item, the same conversation changes after Step 3. The AI produces the artefact, records it as Evidence, optionally records Knowledge and a Decision, and calls `report_status` with `completed` and the Evidence. The final answer states the Deliverable as complete.

## 6. What the conversation shows about the platform

| # | Finding | Evidence |
|---|---|---|
| 1 | The AI has no tool that reads the input location or writes the output location. A Work Item that needs source code written to a location cannot be completed with the five tools offered. | `src/adapters/aiTools.ts`, `PLATFORM_TOOLS` |
| 2 | The existing open Attention Item and its Obligations come from the Demo data. They block a completed report for every run on this Deliverable. | The Work Item `execution_context` and `reportMyStatus` in `participantHome.ts` |
| 3 | The Coding Agent has two Work Items on the same Deliverable. A run per Work Item doubles every row. | Work Items dispatched at 15:10:37 |

## 7. Use on the UI

The Deliverables tab can present this conversation for each Deliverable of an AI Participant, built from the Work Item context and the rows the Participant created, with nothing stored. The reasoning text of Step 1 to Step 4 comes from the context. Each tool call and its platform answer comes from the Evidence, Knowledge, Decision and Attention Item rows and their events. The final answer comes from the status the Participant reported.
