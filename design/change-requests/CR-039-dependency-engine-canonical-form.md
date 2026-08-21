# CR-039 — Dependency Engine: canonical `(entity_type, name?, state)` node form, Template-scoped, push-evaluated

**Raised:** 2026-08-20 · **Origin:** owner, reviewing Chapter 9's "Implementation Specifics" (§19, written same day) — starting from "how does adding a Decision/Obligation/External dependency type work today" and arriving at a full redesign of the dependency graph's own data model. Designed collaboratively in conversation before any code was written. · **Status:** ✅ Built 2026-08-20

> **Built 2026-08-20.**

## The problem this replaces

Chapter 9 §19's review found `dependency_edges` is a **per-SEU instance table**: `from_deliverable_id`/`to_deliverable_id`/`to_service_id` are real foreign keys into `deliverables`/`services` rows that only exist once a specific SEU has been commissioned. Each SEU gets its own copy of the graph, created once at commissioning from the Template's `deliverableCatalogue` JSON (`dependsOnDeliverableCodes`/`dependsOnCapabilityServiceCodes`), with a `readiness_state` column stored per edge.

This has two structural costs:
1. **Adding a new dependency type needs a new FK column + a new CHECK branch + a new hardcoded evaluation branch**, because each type's target lives in a different table (`decisions`, `obligations`, …). Not config — a real migration + code change per type.
2. **Evidence/Decision/Obligation dependencies live in an entirely separate engine** (`qualityGateEngine`, Ch.26 §3's own deliberate split) — so "does this Deliverable's set of prerequisites hold" is answered by two different mechanisms depending on which prerequisite you ask about.

## The design (confirmed in conversation, not yet built)

**Node = `(entity_type, name?, state)`.**
- `entity_type` — Deliverable, Capability (Service), Decision, Obligation, Evidence, Knowledge, External.
- `name` — **required** for types with a stable, pre-declarable identity (Deliverable: an Ontology `deliverable-name` concept; Capability: a Service code — both already enumerated in a Template's own catalogue ahead of time). **Null/absent** for types that are inherently ad hoc, not pre-planned (Decision, Obligation, Evidence, Knowledge) — a null-name node means "any instance of this type, attached to the same Deliverable, currently in this state." This is exactly what `qualityGateEngine`'s existing criteria (`requires_accepted_evidence_or_approved_decision`, `no_unresolved_obligations`) already check — this CR **subsumes them into the same table and engine**, not a second parallel mechanism.
- `state` — drawn from that entity type's own real `transition_definitions` (every one of these types already has a real, working state machine — nothing new needed there).

**Edges connect canonical nodes, not instance rows.** `"Req_spec+Approved" → "Arch+Defined"` is a fact about a *Template*, true for every SEU commissioned from it — not something re-derived or re-stored per SEU.

**Scope: per-Template.** Not a single platform-wide graph. Each Template's own dependency graph is its own set of canonical rules — a "CR" Template can wire `"req spec+reviewed" → "source code+create"` while a different Template wires the same names through a completely different path. This replaces `dependsOnDeliverableCodes`/`dependsOnCapabilityServiceCodes`'s embedded JSON with first-class rows, and folds in the Quality Gate criteria that used to live in a Pack's own `contributions.qualityGates` for the same Template's transitions.

**No reference to the transactional layer.** The canonical table has no `deliverables.id`, no `seu_id` — it is a recipe, not a log. (`Capability`-type nodes referencing a `services.code` are the one caveat: Service codes are Pack-contribution vocabulary, not per-SEU, so this still holds — a Service code is as "canonical" as a Deliverable name.)

**Evaluation is push, not pull.** Today, satisfaction is only ever checked when someone attempts *the downstream* entity's own next transition (`dependencyEngine.isDeliverableReady`, called from `core/deliverables.ts:126` and one display-only call in `seus.ts:277`) — a Deliverable that *becomes* ready sits idle until something else asks. This CR makes it push: when any governed entity transitions, the engine looks up the canonical graph for what that `(entity_type, name, new state)` unlocks, evaluates it against the commissioning SEU's own instance data, and **publishes an event** carrying the result — that publish is what makes "push" real, not a side observation.

**Minimum viable eventing, not the full taxonomy.** This CR publishes whatever event(s) are required to make push-evaluation work end to end. The complete, polished nine-name event taxonomy from Ch.9 §15 (`DependencyCreated`, `DependencyBlocked`, `DependencyWaived`, `ConstraintDetected`, `ConstraintResolved`, `CircularDependencyDetected`, etc.) is **CR-040**, a separate, later piece — not blocking this one.

## Explicitly not in this CR

- **Circular dependency detection** — becomes a CR-038 concern (a widget on the Deliverable Catalogue authoring form, validating the Template's own finite graph at save/publish time — an authoring-time check, not a runtime one, so it doesn't belong in the runtime engine this CR rebuilds).
- **The full 9-event taxonomy** — CR-040.
- **Constraint Detection (§11)** and **Flow Optimisation (§14)** — untouched by this redesign either way; remain separate, unbuilt chapter aspirations.
- **CR-038's own Deliverable Catalogue form redesign** (category-tabbed Packs, derived Required Capabilities) — stays parked; this CR and CR-038 were confirmed to be worked separately, in that order (dependency engine first).

## Why self-containment holds by construction

An SEU is always commissioned *from* a Template (never the reverse) — so a Template's own canonical graph can only ever reference names that are already in that same Template's own catalogue. There's no cross-Template rule-sharing to create a dangling reference, and no case where a canonical node's target lacks a corresponding SEU instance once commissioned.

## What changed

- **`dependency_definitions`** (migration 072) — the canonical table: `template_id, from_entity_type, from_name?, from_state, to_entity_type, to_name, to_state`. `to_*` is the gated node, `from_*` is the prerequisite — the **opposite** of `dependency_edges`' old column meaning, called out explicitly in code comments since it's an easy landmine when reading old vs. new code side by side.
- **`dependencyDefinitionsDB.ts`** — CRUD plus the four real query shapes: `findByTarget`/`findByTargetName` (gating/display, by target), `findBySource`/`findBySourceName` (push-evaluation/traceability, by prerequisite).
- **`dependencyDefinitionEngine.ts`** — `isTargetReady` (pull/gating, generalises `dependencyEngine.isDeliverableReady`), `isRowSatisfied` (per-row satisfaction, exposed for display), `evaluateAndPublishFromTransition` (push, publishes `DependencySatisfied` — the minimum-viable event this CR scoped, not the full CR-040 taxonomy).
- **`deriveDependencyDefinitionsFromCatalogue.ts`** — translates a Template's existing `deliverable_catalogue` JSON (`dependsOnDeliverableCodes`/`dependsOnCapabilityServiceCodes`, unchanged) into real canonical rows. A transitional bridge, not the permanent authoring path (CR-038 is). Gates specifically the `Defined -> In Progress` transition (`to_state`) — Deliverable lifecycles are strictly forward-only, so gating the first real transition is a faithful equivalent to the old model's "check on every attempt."
- **Derivation runs at Template-authoring/seed time, not at commissioning.** `dependency_definitions` is Template-scoped — it must fully exist independent of whether anything's ever been commissioned from the Template. `commissionSeu` was corrected mid-build to stop deriving it lazily (a layering mistake — a per-SEU operation reaching up to mutate Template-scoped state); the three real call sites (`seedSdlcStandardTemplates.ts`, `seedEbookLibraryPilot.ts`, `tests/testFixtures.ts`'s `ensureWebAppTemplateFixture`) call the deriver right after their own `templatesDB.upsert`. `commissionSeu` itself now only creates this SEU's own Deliverable instances — nothing dependency-related.
- **Five live call sites rewired** onto the new engine: `commissioning.ts` (edge creation removed outright — see above), `core/deliverables.ts`'s `transitionDeliverable` gate, `core/seus.ts`'s SEU detail page display, `core/traceability.ts`'s `explainDeliverable`/`impactOfDeliverable` (backward/forward navigation), `assignmentDelivery.ts`'s upstream input-reference resolution.
- **`dependency_edges`, `dependencyEdgesDB.ts`, `dependencyEngine.ts` deleted outright** — migration 073 drops the table; no code reads or writes it anymore. `cleanSlate.ts`'s hardcoded `TRUNCATE` list was fixed to match (it would otherwise fail on every future run) — `dependency_definitions` needs no equivalent entry, since `template_id` is `ON DELETE CASCADE`.
- **Ad hoc Deliverable creation** (`POST /seus/:id/deliverables`, beyond the Template's catalogue) now requires `name` to already be one of the names the SEU's own Template declares — never arbitrary free text — so it automatically inherits whatever canonical rules exist for that name rather than needing bespoke per-instance wiring. `dependsOnDeliverableIds`/`dependsOnServiceIds` removed from `createDeliverable`'s input entirely; a duplicate name within the same SEU is rejected. (Owner: "a new deliverable has to inherit from the template so the dependencies are inherited.")

**Superseded, not rewritten here:** `template_id` (this CR's own schema) and `deriveDependencyDefinitionsFromCatalogue.ts` (this section's own description above) were both real at the time this CR shipped — left as-is as an accurate record of what was actually built then. CR-043 later generalised `template_id` to a polymorphic `owning_entity_type`/`owning_entity_id`; CR-041 later deleted `deriveDependencyDefinitionsFromCatalogue.ts` outright, replacing it with `materialiseDependencyGraph.ts` reading an explicitly-authored `dependencyGraph` field instead of translating embedded catalogue codes. See those CRs for the current shape.

## Honest gaps, not yet built

- **The unnamed-type (Decision/Obligation/Evidence/Knowledge) evaluation branches exist in `dependencyDefinitionEngine.ts`** (fixed cardinality matching `qualityGateEngine`'s own precedent — ALL for Obligation, ANY for the rest) **but nothing populates `dependency_definitions` rows of those types yet.** `qualityGateEngine` still runs as a live, separate mechanism. CR-043 removed the *structural* blocker (Pack-owned rows are now representable); no authoring surface writes them yet.
- **Ontology-vocabulary alignment is deferred**, unchanged since this CR shipped — `deliverables.name` is still matched as free text, not a real Ontology `deliverable-name` concept reference. Only `web-application.template.json`'s 3 entries match the 23-concept vocabulary by value. Owner's explicit call: this is CR-038's own job, not covered by CR-041 either (CR-041 built the *authoring mechanism* for dependency rules — the Ontology-backing of the names themselves is still a separate, unbuilt piece).
- **CR-040's full 9-event taxonomy** remains unbuilt, as originally scoped.

## Verification

- `npx tsc --noEmit`: clean throughout.
- New coverage: `tests/dependency-definition-engine.test.ts` (3 tests) — named-node resolution, multi-row AND-gating across a Deliverable-type and Capability-type row on the same target, reach-or-passed regression parity with the old engine, and push-evaluation only publishing once every row is satisfied.
- Old `dependencyEngine`-specific unit tests removed from `engine.test.ts` (superseded by the above); `governance-depth.test.ts`'s two "Dependency Engine has nothing to say here" checks ported to the new engine.
- Full suite: **149/149** passing, against the real dev database, after `dependency_edges` was dropped live.
- `pnpm db:clean-slate` run live end-to-end post-cutover: clean run, all 9 CR-034 standard Templates reseeded, each verified to carry real `dependency_definitions` rows (44 each) derived automatically.
