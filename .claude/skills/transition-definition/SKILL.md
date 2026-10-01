---
name: transition-definition
description: Create/wire a new transition_definitions row for an entity (a state-machine hop, including a birth/creation transition) — noun+verb authority binding (CR-006), event_type/version_event wiring (Version Feature Plan), the UNIQUE(entity_type,from_state,to_state) scope + event-subscriber rule, and route/badge wiring for the resulting button. Use whenever the user names an entity/chapter and asks to add a transition, add a state, wire a new hop, or asks how a transition gets its badge/authority.
---

# Transition Definition

Sources of truth — read before writing any row: `design/change-requests/CR-006-authority-noun-verb.md` (noun×verb authority model) and `design/mvp-build-plan/Version Feature Plan.md` (event_type/version_event vocabulary and per-chapter precedent). This skill is a condensed run-sheet over both, not a replacement for them. If the entity is also getting its lifecycle retrofitted/reviewed more broadly, use the `version-feature-plan` skill instead — this skill is for adding/wiring one (or a few) transitions at build time, not a full chapter pass.

## What a transition_definitions row is

One row = one hop inside exactly one entity's own state machine, scoped `UNIQUE(entity_type, from_state, to_state)`. It carries:
- `entity_type` (the **noun**) + `from_state` → `to_state`
- `verb` (the **verb**) — bound explicitly on this row, never derived from the state name (two entities can both land on a state called "In Progress" via different verbs)
- `trigger` — `"manual"` for a user-initiated hop the UI should surface as a button; anything else does not get a button
- `event_type` / `version_event` / `submit_version_event` — see Event/version wiring below

**Creation, in this codebase, is not modeled as a transition.** Check `creation-authority-not-a-transition` memory / precedent (Ontology, Pack, Template, Profile, Service, Policy, Capability all skip the birth row) before wiring one: the initial state is set directly at INSERT time by the entity-direct authoring code, and the creation badge (e.g. `pack_define`) is granted, not bound to a `∅ → <initial state>` row. Only wire a real birth transition if the entity you're working on already has one as its own established pattern — don't default to it.

## Step 1 — Noun × verb authority (never hardcode a badge check)

The required badge is **derived automatically** as `entity_type_verb` by `badgeAuthorityEngine` from this row's `entity_type` + `verb` — do not write a per-entity `if`/role check or a bespoke `requireXBadge` anywhere in the transition path. `requireBadge.ts` is the only enforcement surface; it reads the row, not code.

Before writing the row:
1. Confirm the noun (`entity_type`) already exists in `authority_nouns`, or add it as data — new nouns are config, not a migration/CHECK change.
2. Confirm the verb exists in `authority_verbs` and is legal for this noun in `authority_noun_verbs` (the Mapping). If not, add the mapping row first — this is what makes the verb legal, not the transition row itself.
3. Bind the verb on the transition row explicitly. Don't reuse another entity's verb by name-matching the target state.
4. Fan-in (several edges converging on one verb, e.g. three `archive` edges) is fine by design — one badge governs all of them. Don't invent distinct verbs per edge unless the underlying authority is genuinely distinct (see KnowledgeScope's three `promote_to_*` verbs in CR-006 for when that's warranted).

This is Ontology-driven data end to end — nouns, verbs, and the mapping live in `authority_nouns`/`authority_verbs`/`authority_noun_verbs`, not hand-maintained badge strings in code. Concretely, that data lives in **two** JSON seed files with two different jobs — both must be edited, and a migration-time raw SQL `INSERT` alone is not enough to survive a `db:clean-slate` reset:

- **`src/dblayer/seed/data/transitionDefinitions.json`** (loaded by `seedTransitionDefinitions.ts`) — the source of truth for the `transition_definitions` table itself. `db:clean-slate` `DELETE`s the whole table and reseeds only from this file. **Its own `TransitionDefinitionSeed` interface has no `verb` field at all** — the seeder's `INSERT` never writes `verb`. Add one entry per hop here: `entityType`/`fromState`/`toState`/`trigger` (omit for default `"manual"`)/`eventType`/`versionEvent`.
- **`src/dblayer/seed/data/authorityVocabulary.json`** — has its own, separate `transitions` array (distinct from the file above), which **is** where `verb` is declared per `(entityType, fromState, toState)`. This is what the vocab seed derives the `authority_noun_verbs` mapping from. A governed hop (any row with a real verb) needs an entry here too, or the badge mapping never gets created and the row is effectively unauthorizable after a clean-slate reset. Add the noun itself to this file's `nouns` list if it's new.

A migration may additionally do a raw `INSERT ... ON CONFLICT DO NOTHING` against `transition_definitions`/`authority_noun_verbs` directly (existing precedent: Ontology's migration 190) so the row exists immediately without waiting for a reseed — but that is belt-and-suspenders, never a substitute for the two JSON files above.
## Step 2 — Event/version wiring (do it now, not as a retrofit)

Per CLAUDE.md's standing rule, `event_type`/`version_event`/`submit_version_event` must be wired in at build time for new entities/transitions — do not defer this to a later Version Feature Plan retrofit pass. Decide per hop:
- Is this a **definition/authoring** lifecycle hop (Draft→Validated→Published→Active, a reusable catalog entry)? It can carry a `version_event` from Chapter 41 §15's fixed vocabulary (`VersionCreated`, `VersionValidated`, `VersionPublished`, `VersionActivated`, `VersionDeprecated`, `VersionSuperseded`, `VersionArchived`), chosen by the hop's **position** in this entity's own real lifecycle — never by matching the target state's name to a vocabulary term.
- Is this a **runtime/execution** hop (an instance progressing, not a catalog entry versioning)? `event_type` only, never `version_event`.
- A missing generic Chapter 41 stage (e.g. no "Validated" state) is not a gap to fill — don't invent a state to complete the chain.

Wire `core/<entity>.ts`'s transition function to read `gate.eventType`/`versionEvent` off `transitionEngine.evaluate()`'s outcome (pass `entityId` into `evaluate()`) rather than a hardcoded per-status map.

## Step 3 — Scope check: does this need a subscriber?

A `transition_definitions` row only ever affects its own entity's own state machine — it cannot declare an effect on a different entity. Ask: does the consequence of this transition land on a **different `entity_type`**, or **outside transition_definitions entirely** (e.g. delivery to a Participant)?
- **No** (it only advances this entity's own state) → nothing more to do. Do not add a subscriber "just in case" or because the flow feels multi-step/async — that alone is not the criterion.
- **Yes** → add a real subscriber: a `HANDLER_REGISTRY` entry + an `event_subscriptions` row, keyed off the `event_type`/`version_event` this row publishes.

## Step 4 — Button and route wiring

- **Button visibility**: core computes `possibleNextStates` filtered by `trigger === "manual"` (`transitionDefinitionsDB.findPossibleNextStates(entityType, fromState)` — it returns every declared edge, so the caller filters by trigger itself); the web layer additionally filters by whether the actor holds the derived badge (`hasXBadge`). Never render an unconditional link — both filters are required, and neither substitutes for the other.
- **Route authority**: if this transition is exposed via a new route, add a `route_authority` row (CR-110) for that (method, path) in the **same build pass**. Table shape: `UNIQUE(method, path)`, so `ON CONFLICT (method, path) DO NOTHING` (or just `ON CONFLICT DO NOTHING`) is safe on a rerun; a parameterized route is written literally as `:id` in `path` (e.g. `'/aisworg/seu/sdk/schema-registry/:id/publish'` — see migration 261 for the established rows). `routeAuthorityGate` fails closed — no row means the route is denied by default, not silently ungated.
- **Chaining several hops automatically in one request** (no button, no separate user action per hop — e.g. an ungoverned pipeline stage that auto-advances): follow `commissioning.ts`'s `finalizeCommissioning` (`PRE_ASSETS_STEPS` loop) — one `transitionEngine.evaluate` + DB state update + `eventBus.publish` per hop, looped, verb left `null` for the ungoverned steps.
- **Event publish discipline**: once the transition publishes its event, no code runs after — reorder any post-publish logic to run before, per the platform's event rule. Inside a chained loop this means: no extra logic *after* a given hop's own publish before moving to evaluate the *next* hop's own transition — the next hop's evaluate/update/publish is a new transition, not "logic after" the previous one's publish.

## Before finishing

- Confirm no hardcoded badge/role string, no live Ontology query in a seed path, and no bypass of `requireBadge`/`requireTenantScope` was introduced.
- If this is one hop among several being added for a chapter's full lifecycle, consider whether the `version-feature-plan` skill's broader per-chapter process is actually the better fit — this skill assumes the surrounding lifecycle/table is already correct and you're adding to it.