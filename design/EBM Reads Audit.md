# Does each SEU component read off the EBM?

Read from the code on 2026-11-16. Nothing was run. "Settled" means `ebm.behaviors.settled`. "Id list" means `ebm.applicable_quality_gate_ids`, `applicable_policy_ids` or `seu_scoped_policy_ids`.

## Reads off the EBM

| Component | Source it reads | Evidence |
|---|---|---|
| Quality Gates (engine) | The list holds Quality Gate Definition ids, written from the settled `qualityGates` result (`qualityGateDefinitionIds`), so the user's conflict picks apply. The engine reads the settled gate rows of the hop and the Definitions. It no longer reads `quality_gates` rows. Evaluations, waivers and outcomes record the Definition id. | qualityGateEngine.ts `evaluate`, compositionCompleted.ts |
| Policies (engine) | The lists hold Policy Definition ids, written from the settled `policies` result (`policyDefinitionId`), so the user's conflict picks apply. The engine reads the Definitions and builds the checks of the hop. It no longer reads `policies` rows. | policyEngine.ts, policyChecks.ts, compositionCompleted.ts |
| Eligibility Policies, competency requirements | Settled | participantEligibility.ts:34, 39 |
| Dispatch strategy, participating organisations, redispatch | Settled | dispatchStrategies.ts:93, redispatch.ts:25, 35 |
| Pack Obligation definitions | Settled `obligationDefinitions` | obligations.ts:209 |
| Work Item: checklists, engineering capital, output location, profile configuration | Settled | workItemGenerator.ts:120-129 |
| Capability list at commissioning | Settled `capabilities` | commissioning.ts:235 |
| Quality gates tab of the EBM page | Settled `qualityGates` | seus.ts:563 |

## Does not read off the EBM, or reads it only in part

| # | Component | What it reads | Evidence |
|---|---|---|---|
| 1 | (Closed.) The gate and Policy id lists were filled by a query on the rows of the composed Packs. Both now hold Definition ids written from the settled result (CR-145 decisions 22 and 23). | compositionCompleted.ts |
| 2 | Authority rule of a Deliverable hop | `authorityRulesDB.findByCode(requiredBadge)`, a lookup by code across all rules. Settled has an `authorityRules` table. | executionEngine.ts:110 |
| 3 | (Closed for an SEU with an EBM.) Obligations raised when a Policy blocks a hop | The Definition the settled rule names (`policyDefinitionId`). A Policy a hop requires, or an SEU with no EBM, uses the Active Definition of its code. | obligations.ts |
| 4 | Deliverable catalogue and dependency rows | The source the EBM recorded, then the Template and Profile rows read live by id. An SEU with no EBM reads `seu.template_id` and `seu.profile_id`. | deliverableSource.ts:36-50 |
| 5 | Effective governance model (view) | The composed Packs' own contributions, their Policies by Pack code and their gate rows by Pack id. | governanceModel.ts:25, 38, 47 |
| 6 | Compliance | `ebm.composed_packs`, then frameworks by Pack id from the compliance tables. | compliance.ts:47, 115 |
| 7 | Work Item context: input location, Service | The live Deliverable Definition (`guide_location`, live by design) and the Capability Definition by id. | workItemGenerator.ts:120-123 |
| 8 | Dispatch SLA | `servicesDB.findByCapabilityId`, a live read of the Service. | dispatchEngine.ts:120 |

## Reads the EBM's own references (not a gap)

- `checkEbmLiveness` and `ebmActivated.ts` read the Template, Profile and Packs the EBM names, to check they are alive.

## The items that were open, now checked

| Component | What it reads | Off the EBM? | Evidence |
|---|---|---|---|
| Capability request and fulfilment | Competency requirements and eligibility Policies from settled; the Participants from `participants_master` | Yes | capabilities.ts:35-37, participantEligibility.ts:32-39 |
| Review criterion of a Quality Gate | `reviewGateId` from the gate row's `criteria`, then the SEU's Reviews | Through the gate row (finding 1) | requiresAcceptedReview.ts |
| Checklists of a Quality Gate | The gate row carries `checklist_ids`; no runtime code outside authoring and composition reads them | No runtime reader found (grep of `checklist_ids`, `reviewGatesDB.`, `checklistsDB.` in src/domain, src/routes/seu/core, src/qualitygates) | |
| Trigger engine | Events of the entity only | Reads no Pack, Template or Profile data | triggerEngine.ts:6 |
| Metric registry | SEU runtime tables (deliverables, evaluations, telemetry, evidence) | Reads no Pack, Template or Profile data | metricRegistryEngine.ts |
| SEU EBM page header | Template and Profile rows by `seu.template_id` and `seu.profile_id`, for the name and version shown | No: it should use `ebm.template_id` and `ebm.profile_id` | seus.ts:549-550 |

## Needs a query (a code read cannot settle it)

- Whether the id lists of an EBM composed before decisions 22 and 23 differ from its settled result. Older EBMs keep the lists they were written with.

## Ids that still name a materialised row or a table with no Definition

| Where | Holds | Note |
|---|---|---|
| `transition_definitions.required_quality_gate_ids`, `required_policy_ids` | `quality_gates` and `policies` rows, or Policy Definition ids | A required gate is evaluated under its row's `quality_gate_definition_id`. |
| `governance_evaluation_outcomes.applicable_authority_rule_id`, `transition_definitions.required_authority_rule_id` | `authority_rules` rows | No Definition table. |
| `reviews.review_gate_id` | `review_gates` rows | No Definition table. |
| `quality_gates.checklist_ids`, `review_gates.checklist_ids` | `checklists` rows | No Definition table. |
| `template_capabilities.capability_id` | `capabilities` rows | A materialised table, not `capability_definitions`. |

## EBM composition and the materialised tables

CR-145 decisions 22 and 23. Composition and the engines do not read `policies` or `quality_gates` rows for the EBM lists. The composition reads of those two tables, and the read of `authority_rules`, are commented out.

| Where composition read a materialised table | Table | State |
|---|---|---|
| `conflicts/unravelPolicies.ts` | `policies` | Commented out. |
| `conflicts/unravelQualityGates.ts` | `quality_gates` | Commented out. |
| `conflicts/unravelAuthorityRules.ts:39` | `authority_rules` (the row a Transition Definition names) | Commented out (CR-145 item 29). The platform's role for a step is no longer compared with a Pack's role. |

Composition reads none of the seven materialised tables now.

## SEU hop Policies (2026-11-17)

| Where | State |
|---|---|
| `conflicts/unravelPolicies.ts` | A Transition rule with a step `SEU\|from\|to` is kept once with no Deliverable. `compositionCompleted.ts` writes its `policyDefinitionId` to `seu_scoped_policy_ids`, and `policyEngine` reads the Definitions for entity type SEU. A Pack reaches the path by listing the Policy Definition. |

Tests read the Definitions the EBM lists (tests/policy-engine.test.ts, tests/execution-engine.test.ts) and build Policies as Definitions that a Pack lists (`ensurePolicyDefinition`). Verified on 2026-11-17: `db:clean-slate` and the full test suite were run and all tests pass.

Searched on 2026-11-16: calls to `capabilitiesDB`, `servicesDB`, `authorityRulesDB`, `policiesDB`, `checklistsDB`, `reviewGatesDB` and `qualityGatesDB` in `conflicts/`, `compositionCompleted.ts`, `compositionEngine.ts`, `profileCompositionUnravel.ts`, `ebmActivated.ts`, `deliverableSource.ts` and `commissioning.ts`.
