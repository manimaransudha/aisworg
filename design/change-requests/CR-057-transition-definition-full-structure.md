# CR-057 — Transition Definition: the missing structural columns (required Reviews, Evidence, Obligations)

**Raised:** 2026-08-22 · **Origin:** owner, reviewing Chapter 26's own embedded authorial note (§0, lines 66-77) proposing that every governed transition reference a first-class Transition Definition specifying source state, target state, applicable Quality Gates, required Authority, applicable Policies, required Reviews, required Evidence, and required Obligations — cross-checked against the live `transition_definitions` schema and found to have only 5 of those 8 as real columns, with 2 of those 5 (`required_authority_rule_id`) dead. Owner: "Add the missing columns to the table and the schema registry. Also update the Transition definition UI, so these can be authored." · **Status:** 🟡 Proposed (design in progress — owner explicitly deferred one open question to be addressed "as we go along")

## What's missing, precisely

Live `transition_definitions` schema: `id, entity_type, from_state, to_state, required_authority_rule_id, required_policy_ids, category, required_quality_gate_ids, creates_obligation, verb, is_active, retired_at`.

Mapped against the chapter's 8 claimed fields:

| Chapter field | Real column? |
|---|---|
| source state | ✅ `from_state` |
| target state | ✅ `to_state` |
| applicable Quality Gates | ✅ `required_quality_gate_ids uuid[]` — real, but per Ch.26's own audit, live data shows only 4 synthetic test rows ever populate it; most entities enforce gates via a separate hardcoded call in each entity's own transition route instead |
| required Authority | ⚠️ `required_authority_rule_id uuid` — column and FK exist, but `transitionEngine.ts` never reads it; real authority enforcement is the `verb`-derived `${entityType}_${verb}` badge lookup (CR-006) |
| applicable Policies | ✅ `required_policy_ids uuid[]` — real and consulted |
| required Reviews | ❌ no column — only reachable indirectly, through a Quality Gate whose `criteria.type = "requires_accepted_review"` |
| required Evidence | ❌ no column — same, via `criteria.type = "requires_accepted_evidence_or_approved_decision"` |
| required Obligations | ❌ no column — `creates_obligation` exists but means the opposite (this transition *creates* an obligation); blocking on unresolved obligations happens via a Quality Gate's `no_unresolved_obligations` criteria |

## Scope, as raised

1. **Table**: add the 3 missing columns to `transition_definitions` (`required Reviews`, `required Evidence`, `required Obligations` — exact shape not yet decided, see below).
2. **Schema registry**: update the `schema_definitions` row for `entity_kind = 'TransitionDefinition'`. Checked live — this entry is currently a vestigial stub (`{"type":"object","required":["code"],"properties":{"code":{"type":"string"}}}`), completely disconnected from the real authoring form. The real form (`entityType`/`fromState`/`toState`/`verb`) is hardcoded directly in `core/transitionDefinitions.ts`'s `addTransitionDefinition` and its `sdkAuthoring.ts` route handler, not schema-driven at all — so bringing the schema registry up to date means either (a) writing a real schema that matches the actual hardcoded form plus the 3 new fields, or (b) going further and making the form itself schema-generated (per the CR-017/CR-020 "generic, schema-driven mechanism" pattern already built for Pack/Template/Profile authoring) rather than hardcoded. Which of these two the owner wants is one of the open questions below.
3. **UI**: extend the Transition Definition authoring form (embedded in the SDK Authoring surface, `sdkAuthoring.ts` + its view) so the 3 new fields can be authored, not just seeded via JSON.

## Open design questions

### 1. Enforcement path for the 3 new fields — not yet decided, to be addressed iteratively per owner's instruction

Quality Gate criteria already implements almost exactly what "required Reviews"/"required Evidence"/"required Obligations" describe (`requires_accepted_review`, `requires_accepted_evidence_or_approved_decision`, `no_unresolved_obligations`), reached via `required_quality_gate_ids`. Three options were raised, not yet chosen:

- **(a) Auto-provision a Quality Gate.** The 3 new columns are an authoring-time convenience only — filling one in on the Transition Definition form creates/attaches a matching Quality Gate row and wires its id into `required_quality_gate_ids`. Quality Gate stays the one real enforcement mechanism in `transitionEngine`; the new columns are the friendlier front door to it, not a second enforcement path. (Owner recommendation offered, not yet confirmed.)
- **(b) New direct enforcement columns.** `transitionEngine` gains new, separate checks reading these columns directly, alongside its existing Quality Gate check. Matches the chapter's literal 8-field structure most closely, but creates two ways to express the same requirement (a Quality Gate row and a direct column could both exist for the same rule and drift out of sync with each other).
- **(c) Documentation-only columns.** Columns exist and render in the UI/detail view for visibility (matching how `category` already behaves today) but aren't enforced by anything — closes the visibility gap, not the authoring/enforcement gap; real enforcement still requires separately wiring a Quality Gate by hand.

This choice determines the column shape itself (e.g. direct FK arrays vs. a lighter descriptor that only matters at authoring time), so it needs resolving before the table migration is written.

### 2. Column shape, once (1) is resolved

If (a) or (b): what do "required Reviews"/"required Evidence"/"required Obligations" actually reference? A Review/Evidence/Obligation instance doesn't exist yet at Transition-Definition-authoring time (Transition Definitions are templates; Reviews/Evidence/Obligations are per-SEU instances) — so these can't be literal FK arrays to rows, they'd have to be *criteria* (e.g. "an Accepted Review of category X must exist," mirroring Quality Gate's own `criteria` JSONB shape) or category-based requirement lists (`required_review_categories text[]`, etc.). Needs to be resolved together with (1).

### 3. Schema registry: catch up the stub, or go fully schema-driven?

Per point 2 in Scope above — writing a schema that documents the existing hardcoded form is the smaller step; making the form itself schema-generated (the CR-017/CR-020 pattern) is the more consistent step but bigger scope. Not yet decided.

### 4. `required_authority_rule_id` — in scope or not?

This column already exists and is already dead (never read by `transitionEngine`). The owner's request was specifically about the 3 missing fields; reviving or removing this dead column wasn't asked for and is treated as **out of scope** for this CR unless the owner says otherwise when we get to it.

### 5. `VALID_ENTITY_TYPES` staleness

Noted in passing during investigation, not part of this CR's ask: `core/transitionDefinitions.ts`'s own `VALID_ENTITY_TYPES` allowlist (used by `validateTransitionDefinitionSeed`) is missing `Participant`/`Review`/`Finding`/`Template`/`Profile` — 5 of the 16 real governed entity types (a stale list, first flagged in Ch.29's own audit this session). Worth fixing alongside this CR's UI work since the same form is being touched, but not requested — flagging here rather than silently bundling it in.

## Open design questions

### 6. `transition_definitions` (and the criteria it references) should arguably be a shell, materialized per-SEU at commissioning — not building this now

Owner: "criteria in the transition_definition is a shell. This is populated with the packs gates, reviews etc at the time of commission and this is what should be referred to while governing the SEU. We are not building this now."

This directly addresses the most consequential finding in Chapter 26's own §19 audit (§19.9/§19 Summary item 1): `quality_gates` today is a single **global** table keyed only by `(entity_type, from_state, to_state)`, with `ON CONFLICT DO UPDATE` — the last Pack to publish on a triple silently overwrites the live gate for every SEU platform-wide, regardless of which Packs any given SEU actually composed. A correct per-SEU "Effective Quality Gates" computation already exists (`governanceModel.getEffectiveGovernanceModel`) but is read-only/report-only, never consulted by `qualityGateEngine` at evaluation time.

The idea, as raised: a Transition Definition (and by extension whatever criteria it references — Quality Gates, Reviews, Evidence, Obligations, once this CR's own new fields exist) is really a **template/shell** at the Template/Pack/EBM level. The concrete, governing set an SEU actually evaluates against should be **materialized at commissioning time** from the specific Packs that SEU composed, then that SEU-scoped, commissioned copy — not the shared global table — is what `transitionEngine`/`qualityGateEngine` refer to when governing that SEU going forward. This would replace the global-singleton-lookup-with-silent-overwrite pattern with a real per-SEU snapshot, taken once, at the moment the EBM is composed.

Explicitly **not scheduled for build** — noted here so the idea isn't lost, and because it changes the shape of what this CR's own new columns should point at (a per-SEU materialized row vs. a shared global row) once it is picked up. Whoever builds this CR's core scope (the 3 missing columns) should keep this in mind rather than assume the current global-table pattern is the permanent shape.

## Not in scope

- Reviving `required_authority_rule_id` (point 4 above).
- Anything to do with Quality Gate's own `quality_gates` table structure or its global-scoping/Pack-composition gaps (CR-tracked separately, see Ch.26 §19).
