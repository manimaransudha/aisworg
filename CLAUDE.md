# CLAUDE.md

## Project principles

- ASK INSTEAD OF ASSUMING IF YOU SEE ANY DEVIATIONS FROM WHAT IS STATED HERE.

- NEVER GUESS. Do not state a cause, a fact or a fix that has not been verified by reading the code or data. If the code cannot settle it, say so plainly and ask the user for the missing evidence (for example a query result). Do not offer unverified explanations, and do not leave an unverified change in place as a "harmless guess".

- A claim that something is absent or a gap ("no X exists", "X is not handled", "no merge rule") must name the search that supports it: the terms grepped across all of `src/` and the files read. Without that search, the claim is not written. Reading only the files already cited, or only the files where X is expected, does not support an absence claim. This applies to audit and traceability documents (src/docs/implementation) in every row, and to answers in chat.

- design/tbi.md and notes.md are the user's personal scratchpad. Do not read or load them into the context.

- don't dispatch Agent/subagents for any work.

- user handles all git operations (commit/add/checkout/reset/revert) themselves; never run any git command in this repo, even to "help."

- this repo is pnpm-only (never npm); UI review is done by reading rendered HTML/CSS, never screenshots/browser automation.

- treat the working tree as-is as the baseline; don't diff against git HEAD to separate "pre-existing" from "mine" or flag that distinction unprompted.

- There should be no hard-coded constants used in the code, except in src/dblayer/constants.ts. Everything else should be Ontology driven. And Ontology changes are data changes and should not warrant a code change unless approved by user explicitly.

- never run db:clean-slate/tests or sql migrations even when the user's own words describe wanting to see results — only on an explicit direct instruction you can run these. You can run tsc.

- don't announce routine/expected tool-call steps; it burns tokens. Speak only for real findings/decisions.

- Flag and wait for approval before any change beyond the literal ask, even a correct adjacent fix — user can't follow fast tool-call scrolling.

- If user specifies something as a repeating mistake or a fundamental application aspect or something as reusable, it has to be updated in CLAUDE.md

- NEVER build a parallel/bypass mechanism to route around a gap in the platform's own governed construct (e.g. writing straight to a DB-layer table instead of going through the real authoring/publish path that construct requires). If the real path can't yet do what's needed, that is a gap to flag and fix in the real path (or scope as a proper design change), not something to work around with a shortcut that produces data the platform's own registries/UI can't see or reason about.

## Application specifics

- coding_principles.md has to be followed.

- Authority checks go through src/middleware/requireBadge.ts strictly. NO HARDCODING of checking authority as part of the code logic. The field role in the user table is not equal to authority.

- All objects/entities are tenancy scoped unless explicitly stated. src/middleware/requireTenantScope.ts etc. have to be used strictly. NO HARDCODING of checking tenant scope as part of the code logic.

- No file except `src/utils/db.ts` calls `pool.connect()` or creates a `Client`. Everything else uses `query`, `bulkInsert`, `withTransaction` or `withAdvisoryLock` (see the Database section of coding_principles.md). A function that takes its own connection inside a transaction deadlocks the pool (CR-145).

- any list / table on the UI gets parseListParams/paginateList/listControls/sortLink by default. don't wait to be asked.

- new pages get full CR-083 (not just card class); existing pages get checked/fixed for CR-083 on every edit, unprompted.

- Change Request files in design/change-requests/ are not edited unless the user asks. The index is design/Change Requests.md.

## Request Scope

### Reject Overly Broad Requests
Do not start executing on a request that is too broad to scope — e.g. "migrate the codebase," "refactor this area," "fix the tests," or anything with no named file, directory, or explicit list. Stop and ask which files/directories/scope to apply to before doing any exploration or editing. Proceed without asking only when the request already names an exact file, a specific directory, or an explicit file list.

### Do Not Deliver Unchecked Work
Before writing or changing a file, verify every assumption it depends on by reading the code (signatures, return shapes, fixtures, routes, rows, config). If an assumption cannot be settled by reading, stop and ask before writing. Never hand over a file with a "not checked" or "assumes" list. `tsc` may be run without being asked. Tests, db:clean-slate and SQL migrations run only on an explicit instruction in that turn, so reading and `tsc` are the only verification allowed without one.

## Output & Communication

### Long-Form Output Goes to a File
Any response longer than 500 words  — reports, findings, drafts, design write-ups, review results — write it to a file and give a short pointer (file path + one-line summary) in the response, instead of pasting the full content into the conversation. Short, direct , less than 500 word responses still go straight in chat. This doesn't retroactively shrink an already-long session, but it stops the same content from being restated multiple times as the conversation continues.

- chapter/spec review findings go in compact lists/tables, not explanatory paragraphs.

- for open-ended architecture questions, ask in plain text; Do not use a multi-choice AskUserQuestion bundle.

- During an extended design discussion, write the current state (settled, open, next step) to a running file such as `DECISIONS.md` at natural pause points, unprompted.

### Prose and documentation style
When writing or editing book chapters, specs, or design docs: use short, formal, complete sentences with no fragments. State what something is and avoid negative framing. No marketing tone, rhetorical questions, or em-dash asides. Match the surrounding chapter's register.

## Skills that carry the detailed rules

Each skill loads when its description matches the task.

| Skill | Covers |
|---|---|
| `spec-and-design` | Book 3 spec, definition vs execution, EBM rule, dependency engine and composition reuse, design proposals |
| `seed-scripts` | Ontology loaded once, `bulkInsert`, no `seed:X` entries, seeds via `db:clean-slate` |
| `test-fixtures` | Test tenants, badges, superuser gap, unbranded ids, test-run output handling, schema-CR fixtures |
| `transition-definition` | Transition rows, event/version wiring, subscriber rule, buttons, event publish discipline |
| `version-feature-plan` | Per-chapter versioning retrofit |
| `new-route` | Controller, `route_authority` row, ViewModel, `redirects.ts` |
| `author-id-badge` | Real actor and badge, no silent fallback, `eventBus.publish` actor |
| `change-request` | CR numbering, layout, status, standing CR rules |
| `ui-styling` | CR-083 styling, section cards, badges, border tokens, form controls, tables, list controls (`parseListParams`, `paginateList`, `listControls`, `sortLink`) |
