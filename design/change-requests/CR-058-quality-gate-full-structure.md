# CR-058 — Quality Gate: the missing structural fields (Category, Criteria, Required Policies, Waivers, Versioning)

**Raised:** 2026-08-22 · **Origin:** owner, reviewing Chapter 5 §19.4's Pack-contribution audit alongside Chapter 26's own "Implementation Status & Gaps" section — `contributionQualityGates[]` already uses the real repeatable-card widget (the same generic `referential-list` mechanism as the Template Deliverable Catalogue, not raw JSON), but its schema doesn't even expose `category`/`criteria` today, let alone the rest of Chapter 26 §8's Quality Gate Structure. Design settled across a multi-message discussion (2026-08-22), summarized below. · **Status:** ✅ Built 2026-08-22

> **Built 2026-08-22.** `tsc` clean; full suite **151/165** (the 14 failing tests are all in `web-flow.e2e.test.ts`, a pre-existing, unrelated login/session issue predating this CR — see Ch.26 §19 audit note). Smoke-verified end to end through the real `publishPack` path (not just the DB layer): an invalid category is rejected via Ontology validation, a `governedTransition` pointing at a transition that doesn't exist is rejected, a valid Entry-category gate with `requires_accepted_review` + a `criteriaCategory` publishes and lands with `version: "1.0"`, and republishing with a changed name correctly bumps to `version: "1.1"` and deactivates the prior row. Not committed.
>
> **What's built, against the design above:**
> - **Category**: `category:quality-gate` Ontology concept type, seeded with the 5 baseline values (migration `091`), enforced in `validatePackSeed` via `assertCanonicalCategory`.
> - **Scope**: `governedTransition` (`"EntityType|fromState|toState"`), authored as a referential picker sourced from real `transition_definitions` rows only (`loadReferentialOptions`'s new `"transition-definition"` entry) — a Pack cannot reference a transition that doesn't exist (`validatePackSeed` checks it resolves via `transitionDefinitionsDB.find`).
> - **Criteria**: 4 named types in `qualityGateEngine.ts` — `no_unresolved_obligations`, `requires_accepted_evidence_or_approved_decision` (now with the `category` param it was missing), `requires_accepted_review` (unchanged), and new `requires_active_policy` (always blocks on non-satisfaction regardless of the referenced Policy's own `constraint_type` — Ch.26 §9 ¶2's explicit-gate-override, reusing `evaluateCondition` extracted into a shared `policyCondition.ts` to avoid a `transitionEngine`↔`qualityGateEngine` import cycle). No generic AND/OR — confirmed the deliberate design, not a gap (Ch.26 §19.2 QG-003 note updated accordingly).
> - **Waivers**: new `quality_gate_waivers` table + `qualityGateWaiversDB`/`core/qualityGateWaivers.ts`/API route, badge-gated on `qualitygate_waive` (new noun `QualityGate` + verb `waive` in `authorityVocabulary.json`) — deliberately not mirroring Compliance's own ungated `grantedBy`-only waiver. `qualityGateEngine.evaluateGate` checks for an active waiver before finalizing a block (`blockOrWaive`), producing a real `Waived` outcome + `QualityGateWaived` event distinct from `Blocked`.
> - **Versioning**: `quality_gates` gains `version`/`is_active`; identity moved from bare `code` to `(code, version)`; `qualityGatesDB.upsert` is transactional (one commit), no-ops when nothing changed, otherwise deactivates the current row and inserts the next version. The active-slot uniqueness (`entity_type, from_state, to_state, category`) is now a partial index (`WHERE is_active`), which is also what makes "one gate per category" real — two Packs can now contribute different-category gates to the same transition without clobbering each other (previously the root cause of Ch.26's "last Pack to publish wins" finding); `compositionEngine.ts`'s conflict detection was updated to key on `(transition, category)` instead of just `transition` to match.
>
> **Known limitation, documented not solved**: an explicit gate reference (`transition_definitions.required_quality_gate_ids`, captured as a specific row id) does not automatically follow a gate to its next version — the old row's `is_active` flips false but the id still points at it. Real only for the ~4 synthetic rows exercising that path today (Ch.26 §19.7); the same class of question CR-057 already tracks as open (a materialized-at-commissioning "shell"), deliberately not re-opened here.
>
> **Files**: migration [091](../../src/dblayer/migrations/091_quality_gate_full_structure.sql); [qualityGatesDB.ts](../../src/dblayer/qualityGatesDB.ts) (rewritten), [qualityGateWaiversDB.ts](../../src/dblayer/qualityGateWaiversDB.ts) (new); [qualityGateEngine.ts](../../src/domain/engine/qualityGateEngine.ts) (multi-gate `evaluate`, `requires_active_policy`, `blockOrWaive`/`recordAndWaive`), [policyCondition.ts](../../src/domain/engine/policyCondition.ts) (new, extracted from `transitionEngine.ts`); [core/packs.ts](../../src/routes/seu/core/packs.ts) (`parseGovernedTransition`, validation + `seedContributions` reassembly), [core/qualityGateWaivers.ts](../../src/routes/seu/core/qualityGateWaivers.ts) (new), [api/qualityGateWaivers.ts](../../src/routes/seu/api/qualityGateWaivers.ts) (new); [compositionEngine.ts](../../src/domain/engine/compositionEngine.ts) + [core/governanceModel.ts](../../src/routes/seu/core/governanceModel.ts) (updated for the new flat contribution shape); `seuTypes.ts` (`QualityGateRow`/`PackContributions.qualityGates`/new `QualityGateWaiverRow`); `authorityVocabulary.json` (`QualityGate`/`waive`); `core/ontology.ts` (`CATEGORY_CONCEPT_TYPE.QualityGate`); `sdkAuthoring.ts` web route (`loadReferentialOptions`'s 3 new entries); `core-engineering.pack.json` (its 2 real gates migrated to the new authored shape); 2 test files fixed for the new `evaluate()` return shape and the new active-slot uniqueness dimension.

## The gap, precisely

Live `contributionQualityGates[]` schema (`schema_definitions`, `entity_kind='Pack'`) authors: `code, name, toState, fromState, entityType, statement, prompt, assurance, participant, classification, outputContract, externalEvidence`. Two real `quality_gates` columns aren't even in that list — `category` and `criteria` — so a Pack author cannot today set what a gate actually checks through the form at all, only its declaration metadata (the §20 verifiable-item fields).

Chapter 26 §8's full Quality Gate Structure, cross-checked against the live schema in Ch.26's own §19.5 audit finding, has 5 of its 14 fields either absent or folded together: Required Reviews/Evidence/Decisions/Obligations/Policies (folded into one opaque `criteria.type` discriminator, and Policies not referenceable at all), Waiver Rules (no mechanism), Version (no column).

## Design, as settled

### Category
Ontology-backed — a new `category:quality-gate` concept type, seeded with Chapter 26 §7's 5 values (Entry/Exit/Release/Compliance/Operational), same pattern as `category:decision`/`category:evidence`/`category:obligation`. **Pack-contribution of new categories is explicitly deferred** — same "not now" status as CR-056 gave Decision categories; this CR seeds the baseline vocabulary only.

### Scope / Applicable Lifecycle Transition
Not freely authored. A referential picker sourced from `transition_definitions` — the Pack must select an existing `(entityType, fromState, toState)` triple, never declare one that doesn't already exist as a real Transition Definition. Owner: "The pack should not define something beyond what a transition definition already holds."

### Evaluation Criteria
Four real, named types — no generic AND/OR combinator, ever:

1. **`no_unresolved_obligations`** — the default when unspecified. Unchanged.
2. **`requires_accepted_evidence_or_approved_decision`** — gains a `category` parameter, mirroring `requires_accepted_review`'s existing shape. **Confirmed missing today** (verified directly in `qualityGateEngine.ts:106-127`: no `category` narrowing exists on this branch, unlike the Review branch immediately below it, `:134-144`, which already takes one).
3. **`requires_accepted_review`** — unchanged, category param already real.
4. **New: a Required-Policies criteria type.** Genuinely new — today no criteria type in `qualityGateEngine.ts` references a Policy or `constraint_type` at all (confirmed, Ch.26 §19.6).

**The architectural principle behind this list, settled in full during design discussion — not a simplification, a deliberate rejection of composite logic in the engine:**

> One gate, one category, one criteria type, a plain existence check. The and/or a checklist's own items imply (some mandatory, some advisory) is resolved once, by the participant executing the checklist and reporting a single consolidated Passed/Failed (the §19/§20 output contract already built: "Passed/Failed plus notes"). By the time anything becomes Evidence, the composite logic already happened — the gate never reasons about it. The one case where two *different entity types* are accepted as alternatives (Evidence OR Decision) already has its own specifically-named criteria type; any future cross-category combination gets its own name the same way, not a generic combinator built speculatively.

This directly confirms — not contradicts — Ch.26's own §19.2 QG-003 finding ("not composable at the single-gate level"): that finding is correct as a description of the current engine, and this CR's design keeps it that way on purpose. **QG-003 is not a gap this CR closes.**

### Waiver Rules
New, shaped after Compliance's existing waiver mechanism rather than invented fresh — `compliance_waivers`' shape (justification, approving authority, scope, duration, risks, compensating controls), `ComplianceWaiverGranted`-style event, same discipline. Owner: "Waiver rules has to be similar to compliance waivers."

### Versioning
New, and independent of the contributing Pack's own version. Owner: "a pack can still be 1.0, but the quality gate associated with it moves to 1.4." A Quality Gate's version tracks the gate's *own* evolution, not the Pack's.

## Open — mechanics not yet decided

- **How a Quality Gate actually versions.** New row per version (mirroring Template/Profile/Pack's terminal-reactivation-mints-a-new-row pattern), or in-place increment? Not decided — flagged in the original audit, not resolved during this design discussion.
- **Waiver-approving-authority.** Does a waiver's "approving authority" tie into the existing badge system (a `{noun}_waive`-shaped badge, matching how every other governed action does), or something Compliance-specific? Not decided.
- **Is "one gate per category" an enforced constraint, or just the intended authoring convention?** The design principle assumes one gate maps to one category cleanly — whether the schema/DB should actually enforce uniqueness on `(entity_type, from_state, to_state, category)` or leave it as an authoring discipline isn't settled.
- **`requires_accepted_evidence_or_approved_decision`'s new `category` param**: does it apply to Evidence only, Decision only, or both symmetrically? Needs the same precision `requires_accepted_review` already has before this is built.

## Scope (once picked up)

1. New Ontology concept type `category:quality-gate`, seeded with the 5 baseline values.
2. `quality_gates` table: `category` becomes Ontology-validated (not just default `'Exit'`); new columns for Waiver Rules and Version; `criteria` gets a real, checkable shape per the 4 named types (still stored as JSONB, but the schema authoring form needs to know its sub-shape per type — likely a `criteriaType` referential-select driving which sub-fields render, similar to how `_referentialListGroup.ejs` already dispatches per-field kind).
3. `PackContributions.qualityGates` (`seuTypes.ts:88-96`) gains the same fields.
4. `schema_definitions` (`entity_kind='Pack'`) — `contributionQualityGates[].items.properties` gains `category` (Ontology-backed referential-select), a transition-definition-backed `scope` picker replacing free-typed `entityType`/`fromState`/`toState`, a structured `criteria` sub-shape, waiver fields, and `version`.
5. `qualityGateEngine.ts` gains the Required-Policies criteria type and the Evidence/Decision category param.
6. Waiver mechanism: new table/service, modeled on `complianceDB.ts`'s `grantWaiver`/`findActiveWaivers`.

## Not in scope

- **CR-057** (Transition Definition's own missing Reviews/Evidence/Obligations columns) — explicitly set aside by the owner during this discussion ("Dont bring in CR057... Ignore it for the moment"), not referenced further here. Whatever relationship the two CRs end up having is left to fall out later, not assumed now.
- Pack-contributed Quality Gate *categories* (as opposed to the baseline 5 seeded here) — same deferred status as CR-056.
- Anything to do with Quality Gate's global-table/no-SEU-scoping problem (Ch.26 §19.9's most consequential finding) — a separate, not-yet-CR'd concern.
