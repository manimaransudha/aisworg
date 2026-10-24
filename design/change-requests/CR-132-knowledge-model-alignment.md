# CR-132 — Knowledge and KnowledgeScope (Chapter 16): birth rows, generic transition, and the gaps against the chapter

**Raised:** 2026-10-22 · **Origin:** CR-128, Entity 16 (Knowledge and KnowledgeScope). As for Decision (CR-131), the owner asked for a CR of its own covering the CR-128 birth-row work and every gap found against the chapter.

**Status:** 🟡 Knowledge built. Not run. KnowledgeScope open (D2, F4, F5, G5). ALTER for the live table: `ALTER TABLE knowledge_items ALTER COLUMN status DROP DEFAULT;`

## Sources read

| Source | Path |
|---|---|
| Chapter 16 (Knowledge Model) | `src/docs/SEU Studio Specifications/03_Trust Pipeline/16_Knowledge.md` |
| Traceability report | `src/docs/implementation/16_Knowledge_Model_Traceability.md` |
| Code | `src/routes/seu/core/knowledge.ts`, `src/routes/seu/api/knowledge.ts`, `src/dblayer/knowledgeItemsDB.ts`, `src/dblayer/recovery/knowledge_items_schema_recovery.sql`, `knowledge_validation_notes_schema_recovery.sql` |
| Consumers | `dependencyDefinitionEngine.ts`, `workItemGenerator.ts`, `core/traceability.ts`, `metricRegistryEngine.ts`, `core/seus.ts`, `web/seus.ts`, `detail.ejs` |

## Carried over from CR-128

| # | CR-128 item | What applies |
|---|---|---|
| 1 | Design 3, 5, 6, 7 (birth row, creation badge `{noun}_{verb}`, `findBirth`) | Knowledge birth row `None → Observed`, verb `observe`, event `KnowledgeObserved`. KnowledgeScope birth row `None → SEU`. CR-128 lists it with the verb to be chosen in the build pass. |
| 2 | Design 13 (`authoringMappings` removed) | `Knowledge observe` is covered by the Knowledge birth row. The mapping is already gone from `authorityVocabulary.json`; `observe` is a verb. |
| 3 | Entity 12 to 15 pattern (as settled for Obligation, Evidence, AttentionItem and Decision) | `findBirth` for state and event, `transitionEntity` plus `publishTransition`, the generic `<Entity>Transitioned` event last, `evaluateGoverned` through an adapter `seuId`, one `route_authority` row per verb, one button per manual action, the API transition route commented out when it has no caller, status DEFAULT dropped. |
| 4 | Version Feature Plan | The Knowledge hops already carry `version_event`; the three KnowledgeScope rows carry none. |

## What the code does today

| # | Finding |
|---|---|
| F1 | No birth row for Knowledge or KnowledgeScope. `createKnowledgeItem` resolves `knowledge_observe`, writes the row with the column default `Observed` and publishes the literal `KnowledgeObserved`. |
| F2 | One table, two lifecycles. `knowledge_items.status` is the Knowledge state. `knowledge_items.acquisition_scope` is the KnowledgeScope state. Both rows are the same entity row. |
| F3 | `transitionKnowledgeItem` is its own copy of the transition flow. It calls `evaluateGoverned`, `updateStatus` and publishes the row's event. There is no `knowledgeAdapter`, no `transitionEntity` call and no generic `KnowledgeTransitioned` event. |
| F4 | `promoteKnowledgeItemScope` calls `transitionEngine.evaluate`, so a scope promotion passes no Quality Gate and no SEU participant check. It checks `status !== "Published"` with a literal, writes through `updateAcquisitionScope`, publishes `KnowledgeScopePromoted`, and then calls `createObligation` after the publish. |
| F5 | The Obligation raised on promotion uses the literals category `Organisational Learning`, origin `Telemetry and Knowledge Model`, and a severity map (`PROMOTION_SEVERITY`) in code. |
| F6 | Buttons: `listKnowledgeItemsWithNextStates` uses `findPossibleNextStates` for the state and for the scope, with no `trigger==="manual"` filter and no held-badge filter. The web routes take `targetState` and `targetScope` from the form. |
| F7 | `knowledge_items_schema_recovery.sql` has `status TEXT NOT NULL DEFAULT 'Observed'` and `acquisition_scope ... DEFAULT 'SEU'`. `version` is `TEXT NOT NULL DEFAULT '1.0.0'` and is never changed. |
| F8 | `route_authority` rows exist for the web transition and promote-scope routes and for seven API routes. The transition and promote rows carry no badges. |
| F9 | The API has `POST /knowledge/:id/transition` and `POST /knowledge/:id/promote-scope`. Whether either has a caller outside tests is to be confirmed. |
| F10 | `createKnowledgeItem` accepts `acquisitionScope` as input and otherwise inherits the Deliverable's scope. A Knowledge Item can therefore be born at Capability, Enterprise or Platform scope without a promotion hop. |
| F11 | `KnowledgeUpdated` is the fallback event name in `transitionKnowledgeItem`. No code publishes it for a real update. |
| F12 | `knowledge_items` has no tenant column. A version event needs a tenant; for Obligation, Evidence, AttentionItem and Decision the tenant is the SEU's. |
| F13 | `core/knowledge.ts` has no `KnowledgeTransitioned` or `KnowledgeScopeTransitioned` entry in `eventSubscriptions.json`. |

## Gaps against Chapter 16

| # | Chapter item | Gap | Proposed |
|---|---|---|---|
| G1 | KM-003, FR-16.2, acceptance | Knowledge has `evidence_references` (JSON) and `decision_references`. Nothing requires an Evidence reference on save. | Owner to decide (as Decision G1/G2). |
| G2 | FR-16.4, §15 | `version` is static. A hop that sets `version_event` writes no `version_events` row because `transitionKnowledgeItem` publishes its own event. | The shared path writes the row (Decision G7 precedent). No new column. |
| G3 | §8, §10 | The reference JSON columns are never checked against their target tables. Nothing reads them at runtime. | Owner to decide. |
| G4 | §10 | The relationship types (derives from, supports, contradicts, supersedes, refines, references, depends upon) are keys of the reference JSON. Whether `knowledge_references` carries all seven keys is to be confirmed. | Confirm in the build pass. |
| G5 | §12 | Promotion is governed by the scope hops, but the promote path skips the Quality Gate and the participant check (F4). | Move scope promotion to `transitionEntity` through a `KnowledgeScope` adapter. |
| G6 | §12 | No behaviour for demotion. No transition row demotes, so demotion is unreachable and unhandled as the chapter describes it. | Owner to decide whether it is built or recorded. |
| G7 | §12, FR-16.8 | A Knowledge Item may be born at a broader scope (F10). The chapter says the scope is inherited from the Deliverable and promoted afterwards. | Owner to decide. |
| G8 | §13, KM-004, FR-16.6 | Reuse is a discoverability query (`findEngineeringCapital`). No operation attaches a Knowledge Item to a second SEU. No tenant column, so Capability and Enterprise scope are not limited to a Tenant. | Owner to decide (as Decision G8). |
| G9 | §14 | Provenance: originating Deliverable, Participant, SEU are columns. "Validation history" is the notes table. `author_id` and `authority_badge` are overwritten on each hop. | Owner to decide (as Decision G6). |
| G10 | §14 | `knowledge_items.decision_references` and `decisions.knowledge_ids` are kept independently. | Owner to decide. |
| G11 | §16 | `KnowledgeUpdated` has no publisher (F11). | Owner to decide whether an edit path exists. |
| G12 | §7 | Pack-contributed Knowledge categories are not populated. | Open, as Decision G10. |
| G13 | §9 | "Only Published Knowledge may be reused across SEUs by default." The gate and dependency checks use `isReachedOrPassed`; Capital lists every non-SEU item whatever its state. | Owner to decide. |

## Decisions

| # | Decision | Status |
|---|---|---|
| D1 | CR-128 Entity 16 is closed by this CR. | Settled (precedent: CR-131) |
| D2 | The birth rows. Knowledge `None → Observed` (verb `observe`, event `KnowledgeObserved`) is built. The KnowledgeScope birth row is kept open (owner), because a Knowledge Item inherits its scope from its Deliverable and may be born at a broader scope than `SEU`. | Knowledge settled. KnowledgeScope open (owner). |
| D3 | Which of G1 to G13 are built here. Owner: complete Knowledge; Knowledge requires Evidence on save. Built: G1 (at least one Evidence id in `evidence_references` on save, refused otherwise; the web form requires an Evidence selection) and G2 (version events through the shared path). Recorded and not built: G3, G4, G6, G7, G8, G9, G10, G11, G12, G13 and everything on KnowledgeScope (F4, F5, G5), which stays open with D2. | Settled for the Knowledge build |
| D4 | The steps follow the Obligation, Evidence, AttentionItem and Decision pattern. | Settled (precedent) |

## Build steps (Knowledge only; KnowledgeScope stays as it is)

### Step 1: the data

| # | Change |
|---|---|
| 1 | `transitionDefinitions.json`: birth row `None → Observed`, verb `observe`, trigger `governed`, event `KnowledgeObserved`, no version event. The six hop rows are unchanged. The three KnowledgeScope rows are unchanged. |
| 2 | `routeAuthority.json`: remove `POST /aisworg/seu/seus/:id/knowledge/:knowledgeItemId/transition` and `POST /aisworg/api/seu/knowledge/:id/transition`. Add one web row `.../knowledge/:knowledgeItemId/transition/<verb>` for each of `propose`, `validate`, `accept`, `publish`, `deprecate` and `archive`, badge `knowledge_<verb>`. The promote-scope rows are unchanged. |
| 3 | `eventSubscriptions.json`: add `KnowledgeTransitioned` (published for every Knowledge hop, after the row's event, no subscriber). |
| 4 | `authorityVocabulary.json`: no change; all seven verbs exist. |

### Step 2: the schema

| # | Change |
|---|---|
| 1 | `knowledge_items_schema_recovery.sql`: `status TEXT NOT NULL` with no default. `acquisition_scope` keeps its default and CHECK (KnowledgeScope is open). |
| 2 | The ALTER for the live table: `ALTER TABLE knowledge_items ALTER COLUMN status DROP DEFAULT;`. |

### Step 3: the database function and the adapter

| # | Change |
|---|---|
| 1 | `knowledgeItemsDB.create` takes a required `status` and writes it. |
| 2 | `entityAdapters.ts`: `knowledgeAdapter` (`findById`, `getState` is `status`, `setState` resolves the actor's `participants.id` in the SEU and calls `updateStatus` with it and the badge, `tenantId` is the SEU's, `seuId` returns `seu_id`). It is registered under `Knowledge`. |

### Step 4: creation

| # | Change |
|---|---|
| 1 | `createKnowledgeItem` reads the birth row with `findBirth`, passes its `to_state` to `knowledgeItemsDB.create` and publishes the row's event as before, last. The literal `KnowledgeObserved` is removed. Its signature does not change. |

### Step 5: the hop and the buttons

| # | Change |
|---|---|
| 1 | `transitionKnowledgeItem` keeps its signature and result type. It calls `transitionEntity`, then `publishTransition(result)`, then publishes `KnowledgeTransitioned` with the same `correlationId` as its last statement. The fallback `KnowledgeUpdated` is removed from this function. Hops with a `version_event` write their `version_events` row (G2). |
| 2 | `listKnowledgeItemsWithNextStates` returns `possibleNextScopes` only; the state buttons come from `nextActionsFor("Knowledge", status, actor)` built in the web layer. `SeuDetailKnowledgeItem` loses `possibleNextStates`. |
| 3 | The web route becomes `POST /seus/:id/knowledge/:knowledgeItemId/transition/:verb`. It looks up the action for the verb and calls `transitionKnowledgeItem` with its `toState`. |
| 4 | `detail.ejs`: one button per action replaces the select and the single-state form. The scope promotion form is unchanged. |
| 5 | `api/knowledge.ts`: the route `POST /knowledge/:id/transition` is commented out (no caller to be confirmed; owner precedent). |
| 6 | `promoteKnowledgeItemScope`, `getEngineeringCapital` and the validation notes are not changed. |

## Knowledge tests

| # | Test | Asserts |
|---|---|---|
| 1 | `knowledge-event-lifecycle-table.test.ts` definition | The birth row `None → Observed` (`observe`, `governed`, `KnowledgeObserved`, no version event), the six hop rows with their events and version events, and the three scope rows unchanged. |
| 2 | Creation | State `Observed` from the birth row, `KnowledgeObserved` published last. |
| 3 | Hop | Every hop publishes the row's event and then `KnowledgeTransitioned` with one `correlationId`. The versioned hops write `version_events` rows with the SEU's tenant. A refused hop writes and publishes nothing. |
| 4 | Governed checks | An actor with no `participants` row in the SEU is refused (`/No participants row/`). A Quality Gate on a fabricated hop refuses with `quality_gate_blocked` (`quality-gate-generalization.test.ts`). |
| 5 | Buttons | `nextActionsFor("Knowledge", "Accepted", actor)` offers `publish` only. No action for the birth row. |
| 6 | Guard | `knowledgeItemsDB.updateStatus` is called only by the adapter and no code names `KnowledgeObserved` as a literal. |

Fixtures: the existing tests that call `transitionKnowledgeItem` (`knowledge-event-lifecycle-table.test.ts`, `trust-pipeline.test.ts`, `knowledge-telemetry.test.ts` if it does) are checked in the build pass; `web-flow.e2e.test.ts` posts to the verb route.

## Build progress

| # | Piece | State |
|---|---|---|
| 1 | Rows, routes, events (Step 1) | Built ✅ |
| 2 | Schema (Step 2) | Built ✅ |
| 3 | DB function and adapter (Step 3) | Built ✅ |
| 4 | Creation (Step 4) | Built ✅ |
| 5 | Hop and buttons (Step 5) | Built ✅ |
| 6 | Tests | Built. Not run. `knowledge-event-lifecycle-table.test.ts` extended; Quality Gate refusal in `quality-gate-generalization.test.ts`; fixtures: `supportingEvidenceReferences` in `testFixtures.ts` used by `engineering-capital`, `trust-pipeline`, `knowledge-telemetry`; `cr109-work-item-generator.test.ts` adds `status`; `web-flow.e2e.test.ts` creates Evidence first and posts the verb routes |
| 7 | `16_Knowledge_Model_Traceability.md` | Built ✅ |
