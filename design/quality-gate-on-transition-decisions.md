# Quality Gate checks on a transition: state of the discussion (2026-11-16)

## Settled

| # | Decision |
|---|---|
| 1 | A Quality Gate check happens in one of two ways. Way 1: the gates in the SEU's EBM (`applicable_quality_gate_ids`), evaluated by `qualityGateEngine.evaluate`. Way 2: the gates pinned on the Transition Definition row (`required_quality_gate_ids`), evaluated by `qualityGateEngine.evaluateByIds`. |
| 2 | `evaluate` runs way 2 whenever the definition lists gate ids. `evaluateGoverned` calls `evaluate`, so it runs way 2 as well. It also runs way 1. |
| 3 | The author of a pinned-gate evaluation is the caller, taken from the session. |

## Current code (verified by reading)

| Item | Code |
|---|---|
| Way 2 in `evaluate` | Runs only when the definition lists gates and the input carries `entityId` and `seuId` ([transitionEngine.ts:177](../src/domain/engine/transitionEngine.ts#L177)). |
| Callers that pass `seuId` to `evaluate` | Only `knowledge.ts:146`. `transitionEntity` and `transitionExternalInteraction` do not, so way 2 is skipped for them. |
| Way 1 in `evaluateGoverned` | Runs for an entity whose adapter has an `seuId`. All other entities, the Pack included, take plain `evaluate`, so neither way runs for them. |
| `seuId` in the file | Used by the gate checks and the participant lookup. Policy events carry it only when present. |

## Open

| # | Point |
|---|---|
| 1 | `quality_gate_evaluations.author_id` references `participants(id)`, a per-SEU row. The caller from the session is a `participants_master` id. |
| 2 | The same table requires `seu_id` NULL for Pack and Objective and NOT NULL for every other entity type. |
| 3 | `beginBirth` has no entity id, so it cannot run a gate check. |
