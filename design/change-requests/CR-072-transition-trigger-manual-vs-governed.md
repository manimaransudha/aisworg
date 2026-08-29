# CR-072 — Transition Trigger: manual vs. governed (a new axis on Transition Definitions)

**Raised:** 2026-08-28 · **Origin:** owner, following directly from CR-071's own badge-gating work — "What triggers the transition? In some cases, it is governance. In some cases, it has to be manual... Add trigger to the schema. It can be manual or governed. We will expand governed as we go along." · **Status:** 🟡 **Open by design — not meant to close.** One CR tracking every (entity_type, from_state, to_state) transition's trigger definition, addressed as its own sub-item, closed independently as each is settled. New sub-items get appended here rather than spawning new CRs. Sub-item 1 (Objective Proposed→Active) is ✅ Built 2026-08-28; all other sub-items remain open.

### The gap, established through direct analysis (no code changed yet)

`transition_definitions` has no column for this at all — confirmed by reading its full schema (`entity_type, from_state, to_state, required_authority_rule_id, required_policy_ids, required_quality_gate_ids, creates_obligation, verb, category, is_active, retired_at`). `category` looked like a candidate but isn't: added in migration 014 for an unrelated, explicitly-rejected Deliverable-categorization idea, documented as "reference only, never read by transitionEngine," and empty on every row in the live table.

**Authority badge and trigger are two independent axes, previously conflated in this session's own analysis:**
- **Authority badge** (`required_authority_rule_id`, already real) — given that someone has decided to attempt a transition, are they *allowed* to? A permission check on an already-initiated attempt.
- **Trigger** (does not exist anywhere today, schema or runtime) — what causes the attempt to happen at all:
  - **Manual** — an actor (human or AI) has to actively decide "move it now" and explicitly invoke the transition. The badge governs whether that decision is honored; someone still has to make it.
  - **Governed** — no one decides anything. Once the required policies/quality gates are satisfied, the system performs the transition itself. Satisfying the conditions *is* the trigger.

Confirmed every one of Objective's 7 transitions has a required policy attached (none have a quality gate) — including `activate`, which the owner has directly confirmed is manual. This proves a required policy/quality-gate is a **gate condition**, not a **trigger mechanism**: even a transition everyone agrees is manual already carries governance conditions on whether it's *allowed* to succeed once attempted. Also confirmed by reading every caller of `transitionEngine.evaluate` platform-wide (18 files, all `core/*.ts`, every one reached only from a web/API route): **no transition of any entity type, anywhere in this codebase, is ever invoked automatically today.** "Governed" trigger is a genuinely new capability, not an existing pattern hiding under a different name.

### The model, as settled

- New fields on `transition_definitions`: **trigger** (`"manual" | "governed"`, default `manual` — accurate today, since nothing anywhere auto-fires any transition) and **submit_verb** (nullable — only set once a row's own Submit step has actually been defined; badge = `entity_type + '_' + submit_verb`, same convention `verb` itself already uses). **Placement, settled directly (owner):** trigger classification lives on `transition_definitions` itself — the same granularity as the existing governance columns. **"Governed" is realized via the event pub/sub layer** (`event_registry`/`event_subscriptions`) — a subscriber that watches for its own condition and fires the transition itself — not a separate mechanism; deferred until a real case exists ("as we build along, if we see other cases we will address it").
- **Trigger classification (owner): manual for everything except Active → Achieved, which is governed.** All 7 Objective transitions:

  | From | To | Trigger |
  |---|---|---|
  | Proposed | Active | Manual (submit_verb: `propose`) |
  | Active | Achieved | **Governed** |
  | Active | Retired | Manual (no submit_verb defined yet) |
  | Active | Superseded | Manual (no submit_verb defined yet) |
  | Achieved | Archived | Manual (no submit_verb defined yet) |
  | Retired | Archived | Manual (no submit_verb defined yet) |
  | Superseded | Archived | Manual (no submit_verb defined yet) |

  A row with `trigger = 'manual'` but `submit_verb` still null (every Objective transition except Proposed→Active) keeps behaving exactly as it did before this CR — a plain badge-gated action button, no queue step. This is what keeps CR-071's already-built Retire button unchanged; the real submit-step behavior below only applies where `submit_verb` is actually set.
- **Manual trigger behavior, worked through sub-item 1 (Objective Proposed → Active):**
  1. While Proposed and not yet submitted, a **Submit** button is shown to whoever holds `objective_propose` — the same badge that governs proposing/creating the Objective in the first place, directly confirmed by the owner ("same badge as the from state"), not derived through any lookup chain.
  2. Clicking Submit does **not** perform the transition — it emits `ObjectiveProposed` via the existing Event Bus, no status change.
  3. Objective has no consumer for this event (explicitly different from most other entities, whose own equivalent step is expected to have a real one once addressed). For Objective, "consumption" is purely a UI-visibility rule: once `ObjectiveProposed` has fired, whoever holds `objective_activate` sees the **Activate** action — in the tree as its own dedicated button, and in the detail page's Transition dropdown — and not before, even if they already hold that badge. No visible "submitted" indicator otherwise (owner: "no indicator, recommended").

### Sub-items (each closed independently; new ones appended as we go)

| # | Entity | From → To | Trigger | Status |
|---|--------|-----------|---------|--------|
| 1 | Objective | Proposed → Active | Manual (submit_verb: propose) | ✅ Built 2026-08-28 |
| 2 | Objective | Active → Achieved | Governed | 🔵 Classified only — mechanism deferred (event pub/sub, no real case yet) |
| 3 | Objective | Active → Retired | Manual | 🔵 Classified only — no submit_verb defined; behaves as CR-071 already built it |
| 4 | Objective | Active → Superseded | Manual | 🔵 Classified only — no submit_verb defined yet |
| 5 | Objective | Achieved/Retired/Superseded → Archived | Manual | 🔵 Classified only — no submit_verb defined yet |

### Built 2026-08-28 (sub-item 1 only)

> `pnpm typecheck` clean (src, and a full tests-included pass at the same 660-line pre-existing baseline — zero new errors, re-verified after each round below). EJS syntax verified directly (`ejs.compile`) for `detail.ejs`/`_nodes.ejs`/`index.ejs`. Migrations [123](../../src/dblayer/migrations/123_transition_trigger.sql) applied directly against the dev DB.
>
> **What's built:** `trigger`/`submit_verb` columns; a new generic module `domain/engine/triggerEngine.ts` (`hasBeenSubmitted`, `submit` — entity-agnostic, reusable for any future sub-item); `transitionDefinitionsDB.findPossibleNextTransitions` extended to surface `trigger`/`submitVerb`; `core/objectives.ts` gained `submitObjective` (live-badge-checked via `badgeAuthorityEngine`) and a batched `computeSubmitInfo` helper (one query for the small set of statuses on a page, one more for which rows already fired their submit event — not one query per row); `web/objectives.ts` gained `POST /objectives/:id/submit`; both `_nodes.ejs` (tree) and `detail.ejs` gained the Submit/Activate UI.
>
> **Real server-side enforcement, corrected same day (owner: "it should check for the event").** The first pass only filtered the UI dropdown — a real gap, since it meant an API caller bypassing the UI could still activate a never-submitted Objective. Fixed at the actual chokepoint: **`transitionEngine.evaluate` itself** (shared by every entity type) now denies a transition outright — new outcome `not_submitted` — whenever its own row declares `submit_verb` and `triggerEngine.hasBeenSubmitted` says otherwise, checked *before* policy/quality-gate evaluation. This is real, not UI-only, and — because `transitionEngine` is the one shared chokepoint — it's automatically live for any *future* sub-item that sets a `submit_verb`, with zero extra wiring. Every one of the 12 existing callers of `transitionEngine.evaluate` had the same exhaustive-fallback pattern and needed the same one-line addition (`if (gate.reason === "not_submitted") return {...}`) purely for type-correctness — `submit_verb` is null everywhere except Objective's own Proposed→Active today, so this new branch is structurally unreachable for every other entity type right now, same as `quality_gate_blocked`'s own long-standing unreachable branches elsewhere.
>
> **Real test-fixture gap found and fixed in the process:** `objective-lifecycle.test.ts`'s own Proposed→Active test called `transitionObjective` directly with no prior submit — now correctly denied by the fix above, so it needed a `submitObjective(...)` call added before each of its 2 activate attempts. Checking who could even do that surfaced a second, real gap: `TESTER_ALL_ID` (1001, "holds every active noun_verb") did **not** actually hold `objective_propose` — because it's derived entirely from `authorityVocabulary.json`'s `transitions` list, and `objective_propose` was never in there (correctly so — Objective's Proposed state has no incoming `transition_definitions` row to derive a verb from at all, unlike Knowledge/Decision's own "propose" transitions, which do). Fixed in `seedIdentityBaseline.ts` by adding `objective_propose` to `TESTER_ALL_ID`'s grant list explicitly, alongside the vocabulary-derived set; also patched directly into the live dev DB's own `badge_grants` row for 1001 so the fix is testable now without a full `db:clean-slate`.
>
> Delete's own `objective_propose` gate (CR-071) is a genuinely different case from the above, not the same pattern despite sharing a badge — **Delete is not a transition at all** (`deleteObjective` never calls `transitionEngine`/`badgeAuthorityEngine`), so there is no shared chokepoint to add real enforcement to without inventing one specifically for Delete; that UI-only gate stands as designed, distinct from the real enforcement transitions now get through `transitionEngine`.
>
> **Authoring surface, same day (owner):** `/aisworg/seu/authority/mapping` (the noun × verb pairing page — a different, more abstract table, `authority_noun_verbs`, than `transition_definitions`) now shows a **Trigger** column and an **Edit** button (in addition to Retire) editing trigger only. Deliberately a *read-through*, not a duplicated column: `authorityVocabularyDB.listMapping` correlates against every `transition_definitions` row sharing that exact (noun, verb) and shows the shared value (`—` if none exist yet, e.g. a mapping with no wired transition; would show as null/"mixed" if they ever disagreed, which they don't today). Editing writes to `transition_definitions` for every row sharing that (entity_type, verb) at once — e.g. Objective's own `archive` (used by 3 different from_states, all → Archived) updates consistently in one action, by construction rather than by discipline. This means `transition_definitions` stays the single source of truth `transitionEngine.evaluate` already reads live — no second copy to drift out of sync.

### Not yet addressed (future sub-items, not blocking this one)

- The actual "governed" mechanism (event pub/sub-driven) — no real case yet to build against.
- A real Submit step for Active→Retired/Superseded and the →Archived transitions (sub-items 3–5) — classified manual, but not yet given their own submit_verb/behavior.
- Every other entity type's own transitions (Pack, Deliverable, SEU, Template, Profile, Evidence, Knowledge, Review, Obligation, Decision, ...) — not yet discussed, and per the owner's own note, may behave differently from Objective's "no consumer" case once addressed.
