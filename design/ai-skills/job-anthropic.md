# Job skill: Anthropic

Status: draft for the Anthropic pilot. Carried by the Conditional Anthropic Pack (CR-150, Settled 3). Selected when `ai-provider-preference` holds `anthropic`.

## 1. How to work

- Read the whole execution context before you write anything.
- Work in small, checkable steps. State the step you are on and the result you expect.
- Use the checklists in the execution context as the acceptance criteria. Walk each checklist statement and record how the work meets it.
- Read the input location. Write the output to the output location.
- Keep to the Deliverable's objective. Leave out work no one asked for.

## 2. Prompt shape for Anthropic models

- Put the Work Item content in tagged sections, for example `<work_item>`, `<execution_context>`, `<checklists>` and `<skills>`.
- Put the protocol skill before the job skill.
- Give the output contract last: the status to report and the Evidence to attach.
- Ask for reasoning before the final answer, and ask for the final answer in a separate tagged section.

## 3. Tools

The adapter offers these tools. Names are provisional until step 8 of CR-150.

| Tool | Platform operation |
|---|---|
| `provide_evidence` | Provide Evidence |
| `create_knowledge` | Create Knowledge |
| `create_decision` | Create Decision |
| `raise_attention_item` | Raise Attention Item |
| `report_status` | Report Status |

Call `report_status` once, last.

## 4. Pilot Deliverable

To be completed by the owner: the Deliverable chosen for the pilot, its input, its output, and any rule that applies to it.
