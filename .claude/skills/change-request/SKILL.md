---
name: change-request
description: Raise, update or close a Change Request (CR) in this repo — the numbering, the one-file-per-CR layout under design/change-requests/, the index row in design/Change Requests.md, the file sections, the status vocabulary, and the standing rules that apply to a CR (test fixtures, prose style, whiteboard files). Use whenever the user asks to create/raise/write up a CR, add a CR to the index, update a CR's status or Built section, or asks how the CR process works.
---

# Change Request process

Sources of truth: `design/Change Requests.md` (the index) and `design/change-requests/` (one file per CR). Read the index head and one recent CR file (for example the highest-numbered file) before writing, so the new file matches the current shape.

## Rules for touching CR files

- CR files and the index are written only when the user asks for it. Do not edit an existing CR file otherwise.
- A CR file may be the user's own whiteboard. When the file says "this is the whiteboard for this CR", add nothing to the conversation and write only to the file.
- Do not dispatch subagents for any CR work.
- Do not run git commands. The user handles git.
- Any response longer than 500 words goes to a file with a short pointer in chat.

## Numbering and layout

1. Find the next number from the **files** in `design/change-requests/`, not from the index. The index can lag the directory (CR-118 had a file before it had a row).
2. Create `design/change-requests/CR-NNN-short-slug.md`. The slug is lowercase, hyphenated and describes the change.
3. Add one row at the **top** of the table in `design/Change Requests.md` (newest first), then check that older CR files have rows. Report a missing row and add it only when the user asks.

Index row format:

```
| [CR-NNN](design/change-requests/CR-NNN-slug.md) | Title (include the chapter or section it addresses) | <status> |
```

## File sections

Use these sections in this order. Omit a section that has no content yet.

1. `# CR-NNN — Title`
2. `**Raised:** YYYY-MM-DD · **Origin:** <what prompted it, with the chapter/section reference>`
3. `**Status:** <status>`
4. `## Fix the following` — the request as raised, as a short list.
5. `## Settled design` — decisions already agreed with the user. Record only agreed decisions.
6. `## Built (YYYY-MM-DD)` — what was built, with file names.
7. `## Test fixtures updated in the same pass` — one line per fixture or test file (see rules below).
8. `## Incidental changes in the same pass` — changes outside the CR's own subject.
9. `## Still open` — undecided points and known failures.

## Status vocabulary

| Status | Meaning |
|---|---|
| 🟡 Proposed (not scheduled) / (not designed) | Idea recorded, no design yet |
| 🟡 Raised — design in progress | Design discussion under way |
| 🟡 Built pending testing | Code written, not yet verified |
| ✅ Built YYYY-MM-DD | Built and verified |
| ✅ Closed YYYY-MM-DD | Built, verified and closed out |

Use the same status text in the file and in the index row. Update both together.

## Standing rules that apply to every CR

- **Schema-changing CRs list the affected test fixtures and fix them in the same build pass**, not after the suite breaks. Record them under "Test fixtures updated in the same pass".
- **Specifications are read-only.** A CR may add or update the implementation section at the end of a chapter, never the specification text.
- **Ontology changes are data changes.** Do not turn one into a code change without the user's explicit approval.
- **Versioning.** A CR that adds an entity or transition wires `event_type`, `version_event` and `entityId` into `transition_definitions` at build time (see the `transition-definition` and `version-feature-plan` skills). Version numbers come from `src/utils/version.ts`.
- **Verification runs** (`tsc`, `db:clean-slate`, tests, SQL migrations) run only on the user's explicit instruction in that turn. Record in the CR which of them were run and which were not.
- Flag anything beyond the literal ask and wait for approval before building it.

## Prose style

- Short, formal, complete sentences. No fragments.
- State what something is. Avoid negative framing.
- No marketing tone, rhetorical questions or em-dash asides.
- Match the register of the surrounding CR files.
- Review findings go in compact lists or tables.

## When a long design discussion is under way

Write the current state to the CR file (or `DECISIONS.md` for a session scratch) at natural pause points: what is settled, what is open, and the immediate next step. The user can then clear the conversation without losing the thread.
