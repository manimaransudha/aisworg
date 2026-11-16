# Quality Gate decoupling: working notes

## Intent (owner)

Two kinds of Quality Gate check exist on a transition. They are separated, and both are still evaluated.

| Kind | Source of the gates | Where it runs now |
|---|---|---|
| Transition Definition gates | `required_quality_gate_ids` on the Transition Definition | `transitionEngine.evaluateGoverned`, through `qualityGateEngine.evaluateByIds`, author, badge and tenant from `getSystemActor(gateSeuId)` |
| Matched gates | The gates the SEU's active EBM names (`applicable_quality_gate_ids`) that match the entity type and hop. An SEU with no active EBM has none. | `qualityGateEngine.evaluate` (reads the EBM only), called as its own step in `transitionEntity` after `evaluateGoverned` allows the hop, for entities in an SEU, author, badge and tenant from `getSystemActor`. The Execution Engine calls it for Deliverable. |

## Done

| Item | State |
|---|---|
| Pinned-gate block removed from `evaluate` | Done |
| `evaluateGoverned` evaluates the Transition Definition's gate ids | Done |
| `evaluateGoverned` matched-gate call | Commented out there. It now runs as its own step in `transitionEntity`. |
| `tenantId` required in `qualityGateEngine` | Done |
| Seed ignores gate ids for SDK-authored entity types, with an info log | Done |
| Tests given a `tenantId` | Done: quality-gate-generalization (first test), cr104-composition-scoped-governance, review-model, governance-ebm-sharpening |
| Two tests of the removed `evaluate` gate check deleted | Done: transition-engine, transition-definition-authoring |
| `design/Transition Mechanics.md` | Updated for the above, except the matched-gate row |
| `qualityGateEngine.evaluate` reads the SEU's EBM only; the fallbacks (null SEU, no active EBM) are removed; `seuId` is required | Done |
| `tests/quality-gate-engine.test.ts` no-EBM test now expects NotApplicable; `tests/governance-ebm-sharpening.test.ts` Pack null-SEU gate test uses `evaluateByIds` | Done |

## Open

| # | Item |
|---|---|
| 2 | `qualityGatesDB.findAllActive` has no caller now. It is left in place. |

## Tests to revisit (not edited)

`tests/quality-gate-generalization.test.ts` attaches a matched gate (`qualityGatesDB.upsert` with entity type, from-state and to-state) and expects `transitionEntity` to block. These tests are expected to pass again with the step in `transitionEntity`. They have not been run.

| Line | Test |
|---|---|
| 133 | transitionAttentionItem is genuinely wired to qualityGateEngine |
| 205 | transitionObligation ... through transitionEntity |
| 246 | transitionDecision ... through transitionEntity |
| 293 | transitionParticipant ... through transitionEntity |
| 331 | transitionKnowledgeItem ... through transitionEntity |
| 373 | transitionReview ... through transitionEntity |
| 411 | transitionFinding ... through transitionEntity |

Not read yet. Each mentions `quality_gate_blocked` and may depend on the matched-gate call: `tests/execution-engine.test.ts`, `tests/governance-depth.test.ts`, `tests/transition-engine.test.ts`, `tests/trust-pipeline.test.ts`.

The first test in `quality-gate-generalization.test.ts` (line 76) calls `qualityGateEngine.evaluate` directly and is unaffected.
