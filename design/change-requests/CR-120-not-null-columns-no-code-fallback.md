# CR-120 — NOT NULL columns carry no optional type and no fallback in code

**Raised:** 2026-10-15 · **Origin:** the owner's rule that the table definition decides whether a value may be null, and the code does not. Every column declared NOT NULL without a DEFAULT is written with a real value, with no `?` in its type and no `??`, `||` or `COALESCE` fallback.

**Status:** 🟡 Built pending verification — 2026-10-15

## Fix the following

- Actor and author columns, and their badge columns, were nullable in 9 recovery tables and missing a badge in 4 comment tables.
- Seven tables used `requested_by`, `granted_by` or `participant_id` as the actor and left them nullable. `seus` had no badge column. `events.actor_id` was TEXT.
- The code wrote these columns with fallbacks such as `?? "root"`, `?? "system"`, `?? null` and `COALESCE`, and typed actor and tenant inputs as optional.
- Row types declared NOT NULL columns as `string | null` or `number`.

## Settled design

- Recovery SQL (`src/dblayer/recovery`):
  - These columns are NOT NULL: `decisions.authority_badge`, `knowledge_items.author_id`, `knowledge_items.authority_badge`, `version_events.authority_badge`, `attestations.acting_badge_type`, `attestations.requested_by`, `attestations.participant_id`, `decisions.participant_id`, `compliance_waivers.granted_by`, `quality_gate_waivers.granted_by`, `commands.requested_by`, `commands.acting_badge_type`, `seus.requested_by`, `events.actor_id`, `events.authority_badge`, and `actor_id` on the four comment and note tables.
  - `authority_badge` is added to `knowledge_validation_notes`, `objective_comments`, `ontology_concept_comments` and `pack_comments`. `author_badge` is added to `seus`.
  - `events.actor_id` is UUID.
  - `users` and `participants_master` carry no actor columns.
- Every id is a UUID, typed as `string` in code.
- Row types and DB-layer write inputs have no optional or nullable type for these columns. Query filters keep optional parameters.
- A transition whose definition has no verb resolves no authority badge. The caller throws `no authority badge resolved for <entity> <from> -> <to>`. No caller substitutes `"root"` or `"system"`.
- `badgeAuthorityEngine.resolveAuthorBadge(actorId, requiredBadge)` returns `"root"` for a root holder, otherwise the required badge, and throws when the actor holds neither.
- Creation badges: `knowledge_observe` (`KnowledgeObserved`), `decision_identify` (`DecisionIdentified`) and the existing `knowledge_validate` for validation notes. `observe` and `identify` are added to `authorityVocabulary.json` with `authoringMappings` for Knowledge and Decision.
- Comments carry the author id and badge of the surrounding action. A comment added during a transition uses the transition's badge. The standalone Objective comment uses the badge the viewer holds.
- `createDraft` and `upsert` require `tenantId`. Automatic hops receive the actor and requester from the triggering event (`event.actor_id`).
- The `requireBadge` middleware and `route_authority` are unchanged.

## Built (2026-10-15)

- DB layer: `commandsDB`, `decisionsDB`, `knowledgeItemsDB`, `objectivesDB`, `packsDB`, `ontologyDB`, `schemaDefinitionsDB`, `seusDB`, `templatesDB`, `profilesDB`, `capabilityDefinitionsDB`, `serviceDefinitionsDB`, `policyDefinitionsDB`, `deliverableDefinitionsDB`.
- Core: `decisions.ts`, `knowledge.ts`, `deliverables.ts`, `executionEngine`, `transitionEngine`, `validateRequest`, `commissioning.ts`, `objectives.ts`, `packs.ts`, `ontology.ts`, `schemaRegistry.ts`, `sdkAuthoring.ts` and the transition functions that took `actorId?`.
- Routes: API and web handlers return 401, or flash an error, when the session has no user.
- `identity.ts`: user ids are strings, and the `::int[]` cast is now `::uuid[]`.
- `auth.js`: the env superuser login no longer looks up the Demo tenant, so the first login on an empty database works.
- `metric_definitions_schema_recovery.sql`: the obsolete seed INSERTs are removed. `seedMetricDefinitions` seeds the same rows.
- `transitionDefinitionsDB.upsert` accepts `verb`.
- The recovery run and `db:clean-slate` completed on a clean database.

## Test fixtures updated in the same pass

- `tests/testFixtures.ts`: the Profile fixture waits for the winning process after a publish race. `transitionDeliverableSync` takes no `requestedBy`.
- About 35 test files: the missing `tenantId`, `actorId`, `requestedBy` and `authorBadge` arguments are added from the test fixtures.
- `ensureActorParticipant` runs before `createKnowledgeItem`, `createDecision` and `executionEngine.execute` in `trust-pipeline`, `knowledge-telemetry`, `engineering-capital`, `knowledge-event-lifecycle-table` and `command-pipeline`.
- `cr109-work-item-generator.test.ts`: direct `decisionsDB` and `knowledgeItemsDB` writes pass the root participant id and badge.
- `governance-depth.test.ts`, `sustained-pattern-generalization.test.ts`: ad-hoc transition definitions that declare policies now declare a verb.
- `trust-pipeline.test.ts`, `knowledge-event-lifecycle-table.test.ts`: a created Knowledge Item records the author's badge (`root`).
- Seeded template collisions: `sdk-authoring.test.ts`, `dependency-graph-relationship-kind.test.ts` and `template-event-lifecycle-table.test.ts` published and activated new versions under the seeded codes `mobile-application` and `api-platform`, which superseded the seeded Platform templates. Each file now uses its own test-only `template-categories` concept: `test-sdk-authoring-template`, `test-dependency-graph-template` and `test-template-lifecycle-template`, added to `ontologyConcepts.json`.

## Verification (2026-10-15)

- `pnpm typecheck`: 0 errors.
- `src/dblayer/recovery/run.ts` and `db:clean-slate`: completed.
- `pnpm test`: 352 of 355 pass after a fresh clean-slate. The three failures are the commence-work race (KI-001 in Known Issues.md): `attestation`, Phase 5 and Phase 7.
- After the full run, every seeded Platform template is still Active (`mobile-application`, `api-platform` and the other seven checked).
- `seedDemo`: runs clean after clean-slate and after the full test run (exit 0, no errors).

## Still open

- `?? ""` and `?? null` defaults in route and UI code that do not write a NOT NULL column are not changed.
- Transition definitions with no verb now throw when a caller needs a badge. Any such row used by a real flow needs a verb in `transitionDefinitions.json`.
