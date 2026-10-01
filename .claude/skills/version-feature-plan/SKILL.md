---
name: version-feature-plan
description: Retrofit Version Management (transition_definitions.event_type/version_event/submit_version_event) into a Book 3 chapter's entity, following the process already proven on Objective/Pack/Template/Profile/Service Definition/SEU/EBM/Ontology/Policy Definition. Use whenever the user names a chapter and asks to "do the Version Feature Plan," "wire up versioning," "retrofit version management," or "add event_type/version_event" for a specific entity/chapter. Also use to check whether a chapter has already been done, or to review the plan's own worked precedents.
---

# Version Feature Plan

Source of truth: `design/mvp-build-plan/Version Feature Plan.md`. Read it in full before starting a chapter pass — it holds the resolved framing, the governing rule, the schema, and the full precedent log (Implementation status section) for every chapter done so far. This skill is a condensed run-sheet over that document, not a replacement for it.

## Governing rule (from the source doc)

The entity's own chapter-defined lifecycle always supersedes Chapter 41 §9's generic 7-stage chain. If a generic stage (e.g. "Validated") has no corresponding real state in the entity's own chapter, that is not a gap — do not build toward it. Chapter 41 §15's 7 version-event names (`VersionCreated`, `VersionValidated`, `VersionPublished`, `VersionActivated`, `VersionDeprecated`, `VersionSuperseded`, `VersionArchived`) are the fixed vocabulary; which one (if any) attaches to a given hop is decided by that hop's *position* in the entity's own real lifecycle, not by name-matching Chapter 41's stage names.

Platform-wide plumbing (`transition_definitions.event_type`/`.version_event`/`.submit_version_event` columns, `transitionEngine.evaluate()` surfacing `eventType`/`versionEvent`) is already built. A new chapter needs none of that added — only its own rows populated and its own `core/<entity>.ts` wired to read them.

## Before starting: check precedent

Grep the "Implementation status" section at the bottom of the source doc for the chapter number/entity name. If it's already listed as Complete, say so and stop — don't redo it. If a sibling entity shares the same authoring pipeline (e.g. Template/Profile shared the Draft-default bug; SEU/EBM were one combined pass), read that entry closely — the same judgment call likely transfers, but confirm rather than assume.

## The 8 steps

Work through these in order. Steps 1–2 are read/reasoning steps — do not touch the database or code until step 2's gaps are confirmed with the user.

1. **Correct the States and Transitions section in `design/foundations/03_Book 3 (Refined)/Events and Lifecycles.md`** for this entity, against the actual Book 3 chapter — never against another entity's already-drafted table. Read the chapter's own lifecycle section (~§11), events section (~§15), and its own "Implementation Specifics" section (~§19) if it has one — that section is often more reliable than re-deriving badges/events from code by hand. Watch for copy-paste leftovers from whichever entity's table was drafted first (this has happened before: wrong entity name, wrong content carried over).

2. **Identify implementation gaps — concur with the user before closing any.** Check the entity's real TS status/type union, its live `transition_definitions` rows (query the DB directly), and any hardcoded per-status event map in `core/<entity>.ts`. A gap the table implies isn't necessarily real — confirm against the entity's own chapter/decision before treating it as one. Whether the entity even gets a submit/queue step is its own per-entity decision, never automatic from another entity's precedent. Present the gaps and proposed event_type/version_event assignments to the user and wait for agreement before writing any migration.

3. **Update `transition_definitions` rows** via a migration: a new numbered file, `UPDATE ... SET event_type = ..., version_event = ...` for each real row of this entity — applied directly, never via `pnpm migrate:seu`'s full replay (fragile against a live DB, per project convention). Also update the JSON seed at `src/dblayer/seed/data/transitionDefinitions.json` so a future `db:clean-slate` picks it up too.
   - Gotcha: `pnpm seed:transition-definitions` (full reseed from JSON) does not set `verb` — that's `pnpm seed:authority-vocab`'s job and must run immediately after, or badge checks go dark. Prefer a narrow hand-written UPDATE over a full reseed.

4. **Code changes, mirroring `objectives.ts`**: remove the entity's own hardcoded `*_TRANSITION_EVENT`/`EVENT_BY_TARGET_STATE`-style map; publish `gate.eventType` (from `transitionEngine.evaluate()`'s outcome) instead. If the entity's `transition*()` function doesn't pass `entityId` to `evaluate()`, add it — this exact latent bug has recurred in nearly every chapter so far.

5. **Audit every `eventBus.publish()` call site for this entity** — creation and every transition function — for code that runs *after* the publish call. Per the platform's own event rule, there should be no code after a publish. If there is, fix by reordering (move it before publish) whenever it doesn't depend on the event having fired first; don't convert it to an async subscribed handler unless callers genuinely don't need it done synchronously.

6. **Create/update the lifecycle-table test file**, mirroring `tests/objective-event-lifecycle-table.test.ts` / `tests/pack-event-lifecycle-table.test.ts`: a DEFINITION test (loop the entity's real `transition_definitions` rows, assert `event_type`/`version_event`/`submit_verb` against the corrected table) plus DRIVEN tests (call the real create/edit/transition functions, assert actually-published events via `eventsDB.findByOriginatingObject`). Use `actorId: "1001"` (the standing test-fixture actor with broad/root badges) to drive governed transitions.

7. **Run only the new/targeted test file(s) plus `pnpm typecheck`** directly, as normal build-it-correctly diligence. Never run the full test suite or `db:clean-slate` — those are the user's own manual step, per standing project rule.

8. **Leave chapter file updates to the user.** Once tested, the corrected States/Transitions section moving into the real Book 3 chapter file as source of truth is a manual step the user does themselves — do not edit the chapter file.

## Recurring judgment calls worth knowing before you start

- **First governed hop out of Draft/Defined = the "exit from editable" moment.** It gets `VersionCreated`/`VersionPublished` depending on what state it lands in — named after the literal position, not forced to match a Chapter 41 stage name.
- **`Deprecated→Retired` has repeated as `VersionSuperseded`** (position-only match against Ch.41 §15's chain) even when the entity's own state is named "Retired," not "Superseded" — the entity's own state name wins for the lifecycle, but Ch.41's fixed vocabulary still supplies the version-event name at that position. `Active→Deprecated` gets `VersionDeprecated` (name and position both match).
- **A missing generic stage (e.g. no `Validated` state) is not a gap** — several entities (Objective, Service Definition) confirmed this directly rather than having one invented.
- **Runtime/execution lifecycles (SEU's `lifecycle_state`, EBM's validate/activate hops) get `event_type` only, never `version_event`** — versioning is about a definition/authoring lifecycle (Draft→Validated→Published→Active, a reusable catalog entry), not a single instance's runtime progression. Confirm with the user which kind of lifecycle this chapter's entity has before assigning `version_event` at all.
- **A `status` column defaulting to `'Active'` instead of `'Draft'`** has been a recurring real bug (Template, Profile) — check the entity's default and its one-shot `publish*()` function's assumptions about it while you're in this code anyway.
- **Definition-only, single-entity, linear-lifecycle entities never need an event subscriber** for this work — this plan only ever touches the entity's own `transition_definitions` rows and its own `core/<entity>.ts`, never `HANDLER_REGISTRY`/`event_subscriptions` (that's a different, unrelated mechanism — see CLAUDE.md's event-subscriber rule).

## When done

Append a new numbered entry to the "Implementation status" section of `design/mvp-build-plan/Version Feature Plan.md` itself, in the same voice/detail level as the existing entries — migration number(s), what was found, what judgment calls were made and why, new test file name, and what was left for the user to run.

# Execution Constraints

## No Sub-Agents

Do not use, create, delegate to, or invoke sub-agents for this analysis.

The complete specification analysis and repository investigation must be performed by the current Claude Code agent.

Do not delegate:

- specification decomposition
- repository searching
- source-code investigation
- implementation tracing
- gap analysis
- finding generation
- completeness verification

Perform the analysis directly using the available repository tools.

---

# Conversation Output

Keep the conversational response FULLY SILENT.

Do not expose the detailed reasoning process, search strategy, intermediate analysis, or investigation narrative in the conversation.

Do not provide a running explanation of:

- which files are being searched
- which keywords are being searched
- why a particular file was selected
- intermediate hypotheses
- intermediate conclusions
- internal reasoning
- step-by-step repository investigation

The detailed analysis belongs in the final traceability output, not in the conversation narrative.

I do not want a verbose conversation. The analysis has to still be thorough. 