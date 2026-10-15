# CR-122 — A platform system actor, provisioned with the Platform tenant

**Raised:** 2026-10-15 · **Origin:** Quality Gate evaluation and the other rule-based, automatic steps of the Execution Engine are governed with no manual intervention (owner, 2026-10-15). The author of such a record is the system, not the requesting user.

**Status:** 🟡 Built pending verification — 2026-10-15

## Settled design

- When the env superuser signs in for the first time and the Platform tenant and superuser are created, a system actor is provisioned with them. It is a `participants_master` row of type `Automated` in the Platform tenant, with no `user_id`.
- Rule-based evaluations (Quality Gate, governance outcome) are authored by the system actor. User-initiated actions keep the requesting user as the actor on their events.
- `db:clean-slate` keeps the system actor, like the superuser and the Demo User.

## Facts from the code

- `resolveSystemActor(seuId)` returns the SEU requester's id and the `system` badge. It is called from 19 sites in 13 files (`redispatch`, `dispatchEngine`, `executionEngine`, `governanceModel`, `workItemHeartbeat`, `dependencyDefinitionEngine`, `traceability`, `attentionItems`, `telemetry`, `commissioning`, `obligations`, `findings`, `compliance`).
- 31 tables take their author from `participants_master(id)`. 17 tables take it from the SEU-scoped `participants(id)`: attestations, attention_items, capability_fulfilment_pools, compliance_evaluations, capability_fulfilments, decisions, deliverables, deliverable_references, ebms, findings, evidence, external_interactions, governance_evaluation_outcomes, knowledge_items, obligations, quality_gate_evaluations, reviews, seu_capabilities and work_items.
- A platform-level system actor is a `participants_master` row, so it cannot author a row whose author column references `participants(id)` unless it also holds a `participants` row in that SEU.
- `participant-types` holds AI, Human, Automated and External. `Automated` fits the system actor.
- `db:clean-slate` deletes every `participants_master` row except the superuser and the Demo User participant.

## Settled design (owner, 2026-10-15)

- `participants_master` is the universe of identities. `participants` is the SEU scope: a participant fulfilled for one SEU. Anything scoped to an SEU is authored by a `participants` row. The system actor is the only exception to "authored by a participant", and it is represented in `participants` too, so no author column changes its reference.
- Provisioning: when the env superuser signs in for the first time and the Platform tenant and superuser are created, one platform system actor is provisioned as a `participants_master` row of type `Automated` in the Platform tenant, with no `user_id`.
- Per SEU: when the SEU transitions to Active, a system participant is created for that SEU. It is a `participants` row of type `Automated` whose `participant_id` is the platform system actor and whose `display_name` is the SEU id. Each SEU has exactly one. A later change may give each process its own system actor.
- Anything the Execution Engine creates is authored by the SEU's system participant: work items, Quality Gate evaluations, governance outcomes, eligible-participant pools, Commands, and the Attention Items, Obligations and External Interactions it raises.
- Entities that participants create (Decisions, Knowledge Items, Evidence, Reviews, Findings and the rest) keep a participant as author. A participant raising an Attention Item, an Obligation or an External Interaction is its author. A participant holding the matching `<noun>_<verb>` badge transitions it.
- Both author kinds are `participants` rows, so every author column keeps `REFERENCES participants(id)`. The earlier option of re-pointing author columns at `participants_master` is dropped.
- `resolveAuthor(seuId, actorId)` already finds the SEU's `participants` row for a master id, so it works for the system actor without change.
- A helper in `src/dblayer/constants.ts` returns the system actor of an SEU: the platform system actor's master id (`actorId`), the SEU system participant's id (`authorId`) and the `system` badge. It replaces `resolveSystemActor(seuId)`.
- `db:clean-slate` keeps the platform system actor, like the superuser and the Demo User.
- Event actors: an event the engine publishes carries the platform system actor's master id (`events.actor_id`). An event for a user's action carries the user.

## Classification of the 19 `resolveSystemActor` call sites

| Entity authored | Chapter | Sites | Author after this CR |
|---|---|---|---|
| Attention Item | 34 (Runtime) | `executionEngine.ts:107`, `workItemHeartbeat.ts:31` | System actor |
| Event published by the engine (no triggering actor) | 30 (Runtime) | `executionEngine.ts:39`, `dependencyDefinitionEngine.ts:130`, `traceability.ts:140,199`, `governanceModel.ts:53`, `compliance.ts:150,179` | System actor |
| Command / dispatch bookkeeping | 31, 33 (Runtime) | `dispatchEngine.ts:25,72`, `redispatch.ts:98` | System actor |
| Obligation raised by the engine | 23 (Governance) | `redispatch.ts:56`, `telemetry.ts:135`, `obligations.ts:123,188` | SEU system participant |
| Finding raised by the engine | 25 (Governance) | `findings.ts:68` | SEU system participant |
| Sustained-pattern check | 35 (Runtime) | `telemetry.ts:169` | System actor |
| Commissioning step | 37 (Runtime) | `commissioning.ts:258` | System actor |

## Built (2026-10-15)

- `src/dblayer/constants.ts`: `SYSTEM_ACTOR_NAME`, `SYSTEM_ACTOR_BADGE`, `ensurePlatformSystemActor()`, `ensureSeuSystemParticipant(seuId)` and `getSystemActor(seuId)`. `getSystemActor` returns the platform system actor's master id (`actorId`), the SEU system participant's id (`authorId`) and the `system` badge. It throws when the platform system actor or the SEU's system participant does not exist.
- `resolveSystemActor` is removed. Its 19 call sites in 13 files call `getSystemActor`.
- `passportConfig.js`: the superuser sign-in ensures the platform system actor. `db:clean-slate` ensures it as well and no longer deletes it.
- `commissioning.ts`: the SEU system participant is created when the SEU is Commissioned, before its assets. `seu_capabilities` and Deliverables are authored by it.
- Author columns are unchanged: they still reference `participants(id)`.

## Test fixtures updated in the same pass

- `dependency-definition-engine.test.ts`, `cr104-mandatory-seu-eligibility-policies.test.ts`: SEUs created with `seusDB.create` get `ensureSeuSystemParticipant`.

## Verification (2026-10-15)

- `pnpm typecheck`: 0 errors. `db:clean-slate` and `seedDemo`: exit 0, no errors.
- `pnpm test`: 351 of 355 on the first run. The three failures are the commence-work race (KI-001). The fourth, `dependencyDefinitionEngine`, needed the fixture change above and passes with it (6 of 6 in the two edited files).

## Settled values

- `SYSTEM_ACTOR_NAME = "System"` and `SYSTEM_ACTOR_BADGE = "system"` in `src/dblayer/constants.ts` (owner, 2026-10-15).

## Still open

- How the system actor and the per-SEU system participant behave under the deployment strategies still to be designed.
