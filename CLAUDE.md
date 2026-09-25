# CLAUDE.md

## Project principles

- ASK INSTEAD OF ASSUMING IF YOU SEE ANY DEVIATIONS FROM WHAT IS STATED HERE. 

- Answers are terse by default — state the finding/decision, not the investigation path already visible in tool calls. No restating prior turns' context.

- Use tools that use minimum tokens. Even if it takes a little longer, it is fine. Time is not a constraint. Tokens are. 

- design/tbi.md and notes.md are the user's personal scratchpad. Do not read or load them into the context. 

- don't dispatch Agent/subagents for research or implementation while actively working on a task without user approval.

- user handles all git operations (commit/add/checkout/reset/revert) themselves; never run any git command in this repo, even to "help."

- this repo is pnpm-only (never npm); UI review is done by reading rendered HTML/CSS, never screenshots/browser automation.

- treat the working tree as-is as the baseline; don't diff against git HEAD to separate "pre-existing" from "mine" or flag that distinction unprompted.

- There should be no hard-coded constants used in the code. Everything should be Ontology driven. And Ontology changes are data changes and should not warrant a code change unless approved by user explicitly.

- Data seed scripts should load Ontology once and not do a live-query. Data seed scripts should do a batch dbwrite. If you are using assertCanoncicalCategory, you are deviating. If you are not using utils/db/bulkInsert, you are deviating.

- never run db:clean-slate/tsc/tests or sql migrations even when the user's own words describe wanting to see results — only on an explicit direct instruction you can run these.
  
- don't add new pnpm seed:X package.json entries; all seed data population goes through db:clean-slate only.

- don't announce routine/expected tool-call steps; it burns tokens. Speak only for real findings/decisions.
- new pages get full CR-083 (not just card class); existing pages get checked/fixed for CR-083 on every edit, unprompted.

- Version Feature Plan.md implementation has to be used everytime a lifecycle state or version is necessary for retrofit or new changes. new entities/transitions from now on must get transition_definitions.event_type/version_event/entityId wired in at build time, not deferred to a later Version Feature Plan retrofit pass.

- any list / table on the UI gets parseListParams/paginateList/listControls/sortLink by default. don't wait to be asked.

- transition buttons/links: core computes possibleNextStates filtered by trigger==="manual", web layer filters by held badge (hasXBadge); never an unconditional link.

- chapter/spec review findings go in compact lists/tables, not explanatory paragraphs; discursive style is fine in live design talk, not in review deliverables.

- when design/foundations chapters exist for the area, read them thoroughly first; the code lags/diverges from spec. But don't relitigate settled/out-of-scope decisions just because a chapter audit mentions them.

- for open-ended architecture questions, ask in plain text; Do not use a multi-choice AskUserQuestion bundle. And ask one question at a time. 

- Flag and wait for approval before any change beyond the literal ask, even a correct adjacent fix — user can't follow fast tool-call scrolling.

- schema-changing CRs must list which test fixtures need updating and fix them in the same build pass, not after the suite breaks.

- A running register of change requests raised against the platform is in design/Change Requests.md and serves as the index (newest first).  Each CR is its own file in [change-requests/](change-requests/); this page is the request as raised, the agreed scope, the design decisions, and (once built) a Built banner. Do not edit these files directly unless asked for by the user. 

## Application specifics 

- coding_principles.md has to be followed.

- Generation of action buttons and the authority to do transitions are defined and have to be used through src/middleware/requireBadge.ts strictly. NO HARDCODING of checking authority as part of the code logic. The field role in the user table is not equal to authority. 

- All objects/entities are tenancy scoped unless explicitly stated. src/middleware/requireTenant.ts , src/middleware/requireTenantScope.ts etc. have to be used strictly. NO HARDCODING of checking tenant scope as part of the code logic. 

- Specifications for the platform are in design/foundations/03_Book 3 (Refined). Code implementation may have a refined construct  but conceptually should follow the specification. 

- You cannot alter the specification directly. You are only allowed to add/ update implementation section at the end of the chapter. 

- Some chapters , though not stated explicitly can have a definition aspect and an execution aspect. This has to be distinctly understood and used when interpreting a chapter or designing something. For example, a pack is a definition declarative only. But SEU will have definition part and an execution part all integrated in the same chapter. 

- Dependency engine already has an implementation and has to be reused.

- Composition strategy already has an implementation and has to be reused.

- Event publishing / subscribing is already implemented and has to be reused. There should  strictly be NO code statements after an event is puclished. 

- Event subscriber rule: `transition_definitions` is scoped `UNIQUE(entity_type, from_state, to_state)` — one row is one hop inside exactly one entity's own state machine, and it has no way to declare an effect on a different entity. Add a real subscriber (HANDLER_REGISTRY entry + event_subscriptions row) ONLY when the effect that must follow an event lands on a different entity_type (or outside transition_definitions entirely, e.g. delivery to a Participant) than the one whose transition produced it. Definition-only, single-entity, linear-lifecycle entities (Objective, Pack, Template, Profile, Service Definition, Ontology) never need a subscriber — their own transition row is the whole effect, start to finish. Do not add a subscriber for a transition that only ever advances its own entity's own state, and do not treat "multi-hop" or "async" alone as a reason for one — the deciding question is strictly whether the consequence crosses an entity_type/chapter boundary.

- If user specifies something as a repeating mistake or a fundamental application aspect or something as reusable, it has to be updated in CLAUDE.md

- NEVER build a parallel/bypass mechanism to route around a gap in the platform's own governed construct (e.g. writing straight to a DB-layer table instead of going through the real authoring/publish path that construct requires). If the real path can't yet do what's needed, that is a gap to flag and fix in the real path (or scope as a proper design change), not something to work around with a shortcut that produces data the platform's own registries/UI can't see or reason about.

- Every route's required badge(s)/role(s) live in the `route_authority` table (CR-110), not in a per-route `requireBadge`/`requireRole` call — the global `routeAuthorityGate` (src/middleware/routeAuthorityGate.ts) looks up each request's (method, path) there and fails closed on no match. Every new route must get a `route_authority` row in the same build pass it's added, or it is denied by default, not silently ungated.

## Architecture & Design

### Design Proposals
Propose the smallest change that satisfies the stated requirement. Do not introduce new lifecycles, composite types, or extra state transitions unless explicitly asked. If a simplification is possible, offer it first and list what is being dropped. For any non-trivial design, give three options — (A) minimal, (B) moderate, (C) full redesign — with files touched and new concepts introduced for each, and wait for a decision before writing code.
 
## Request Scope

### Reject Overly Broad Requests
Do not start executing on a request that is too broad to scope — e.g. "migrate the codebase," "refactor this area," "fix the tests," or anything with no named file, directory, or explicit list. Stop and ask which files/directories/scope to apply to before doing any exploration or editing. Proceed without asking only when the request already names an exact file, a specific directory, or an explicit file list.

## Output & Communication

### Long-Form Output Goes to a File
For long-form output — reports, findings, drafts, design write-ups, review results — write it to a file and give a short pointer (file path + one-line summary) in the response, instead of pasting the full content into the conversation. Short, direct answers still go straight in chat. This doesn't retroactively shrink an already-long session, but it stops the same content from being restated multiple times as the conversation continues.

### Checkpoint Whiteboarding Sessions
Design reviews here are mostly live back-and-forth ("whiteboarding"), not a single deliverable — the discussion itself is what piles up in the session, not just the final output. During any extended design/architecture discussion, periodically write the current state to a running file (e.g. `DECISIONS.md` or a session-specific scratch file): what's been settled, what's still open, and the immediate next step. Do this unprompted at natural pause points, not only when asked. This lets the user `/clear` the raw discussion without losing the thread — the file becomes the source of truth for "where we left off," not the live conversation.
  

## Token-Efficient Test Runs
The user runs the test suite manually (`pnpm test > output.txt`) rather than having Claude run it via a hook or hand it the raw output. When checking results:
- Grep `output.txt` for failures first (`grep -n "FAIL\|Error" output.txt`) instead of reading the whole file.
- Only read the sections relevant to the failure being investigated.
- Once a failure is resolved, don't keep re-reading old passing output — treat each run's file as disposable.

## Prose & Documentation Style

When writing or editing book chapters, specs, or design docs:
- Use short, formal, complete sentences. No sentence fragments.
- Avoid negative framing ("this is not X", "unlike Y"); state what something *is*.
- No marketing tone, rhetorical questions, or em-dash asides.
- Match the surrounding chapter's register before drafting new sections.
