# CR-139 — EBM composition: Deliverable-driven Capabilities and conflict rules for every Pack contribution

**Raised:** 2026-11-06 · **Origin:** EBM composition review. The EBM defines SEU behaviour, so composition must derive Capabilities from the Deliverable Catalogue and compare every Pack contribution with every other source. The plain-language rules are in [EBM Composition Contributions Table.md](../EBM%20Composition%20Contributions%20Table.md) and the running record is in [EBM Composition Checkpoint.md](../EBM%20Composition%20Checkpoint.md).
**Status:** ✅ Built 2026-11-06

## Fix the following

- Derive the EBM Capabilities from the Deliverable Catalogue (Profile's own, else Template's), through one Service per Deliverable, to the Service's Capability.
- Show the user every overlap between a Pack contribution and any other source, with the options already in place (pick one, pick all, merge, union, intersection, supplement).
- Remove the Profile's `additionalCapabilityCodes` field and its uses from code and schema.
- Derive competencies from the composed Capabilities as well as from the Profile and the Packs.

## Settled design

The plain-language table in [EBM Composition Contributions Table.md](../EBM%20Composition%20Contributions%20Table.md) is the current record. Where a row below differs from the table, the table is right.

| # | Decision |
|---|---|
| 1 | Step 1 of composition: each Deliverable ends with exactly one Service. Several candidate Services show a message that several work streams may be in one bucket, and the user picks one. |
| 2 | The EBM does not take a Pack's other Services. It takes what else the Pack brings, and the user sees and approves what is taken and what is left out. |
| 3 | Services: the Deliverable's Service A is compared with the Packs' definition of A. The service levels are compared as set out under Service level conflicts below. If A is not in the Packs' list, there is no conflict. Packs are not compared with each other. |
| 4 | Capabilities: the Capabilities the Deliverables need are compared with the Capabilities the Packs name. A missing one is accepted. An addition sends the naming Pack through the Services rule. |
| 5 | Policies (a Policy with only a statement is verified by a person, is never compared, and is shown to the user as a notice): every Policy enters through a Pack. Policies with the same code are compared by content. Conditions are matched by the field they test, so approvals > 2 against approvals > 1 is a conflict. Different Policies that apply different rules to the same Deliverable and step are a conflict. |
| 6 | Authority rules, quality gates, review gates and Obligation definitions: two that apply different rules or roles to the same Deliverable and step are a conflict, whatever their source. |
| 7 | Checklists are a union, with no conflict. |
| 8 | Engineering capital: the same link is accepted, different links of the same type and an entry with no link are conflicts. |
| 9 | Competencies are the union of the composed Capabilities' role types and work types, the Profile's programming language and domain, and the Packs' competencies. |
| 10 | Dependencies: each dependency Pack is checked like any other Pack. A missing needed Pack or a present incompatible Pack is still reported, and the user sees a message that it has to be resolved at the definition of the Template or Profile. The user cannot resolve it in composition. |
| 11 | The Profile adds no list of Capabilities. |

### Service level conflicts

A is the levels of the Deliverable's Service (the Service Definition's defaults, the Template's values and the Profile's overrides). B is the levels the composed Packs give the same Service.

| Level in A | Level in B | Result |
|---|---|---|
| yes | no | No conflict. |
| yes | yes, same value | No conflict. |
| yes | yes, different value | Conflict (`level-different`). The user picks one value. |
| no | yes | Conflict (`level-added`). The user can include the level or leave it out. |

The conflict card is titled "Service level conflicts". The kind `level-omitted` no longer exists.

## Built (2026-11-06), part 1 of the build

| Item | Files |
|---|---|
| Profile `additionalCapabilityCodes` removed from the Profile grammar | src/dblayer/seed/data/schemaDefinitions.json |
| Removed from authoring, Profile seed validation, Profile version copy and the Pooled simple fields | src/routes/seu/core/sdkAuthoring.ts, src/routes/seu/core/profiles.ts, src/domain/engine/profileCompositionUnravel.ts |
| Removed from the commissioning liveness check, with the unused ontology import and locals | src/routes/seu/core/commissioning.ts |
| Text that pointed to Additional Capabilities | src/views/seu/seus/new.ejs, src/docs/user-manual/01_SDK_Authoring.md, src/docs/implementation/05_Profile_Model_Traceability.md |

## Test fixtures updated in the same pass

- tests/objective-lifecycle.test.ts: a comment only. No fixture sets the field.
- tests/profile-composition-unravel.test.ts: the clean-selection test expects the Capability through the catalogue and Service, and `createTemplateAndProfile` takes catalogue codes.
- tests/cr104-mandatory-seu-eligibility-policies.test.ts: the Eligibility test expects no Policies without an EBM and resolves the Policy from the id the active EBM records.
- tests/cr139-ebm-capabilities-from-catalogue.test.ts (new): Capability through catalogue and Service, no Capability without a catalogue Deliverable or a contributed Service, Pack capability list not pooled, Profile field not pooled, grammar without the field, `findActiveByCodesVisibleTo`.

## Verification

`tsc`, tests and `db:clean-slate` were not run. The grammar change reaches the database only after `db:clean-slate`.

## Built (2026-11-06), part 2: data first, screens later

Each contribution table gets its own detector, and `detectEbmConflicts` calls them all. A detector returns plain data (`EbmConflict`: table, key, kind, message, options, resolvable) and takes the user's picks, so one table can be re-run alone after a pick. No screen is changed in this part.

| Item | Files |
|---|---|
| Conflict types, the Services detector (Step 1 Service choice, service level different, added), the `detectEbmConflicts` entry point | src/domain/engine/conflicts/types.ts, services.ts, index.ts |
| `UnraveledComposition.serviceCandidates`: the Services that output each catalogue Deliverable, with default levels | src/domain/engine/profileCompositionUnravel.ts |
| `findActiveByOutputsVisibleTo` | src/dblayer/serviceDefinitionsDB.ts |
| Capabilities detector, and `UnraveledComposition.packContributions` (what each Pack names: Capabilities and Services) | src/domain/engine/conflicts/capabilities.ts, profileCompositionUnravel.ts |
| Policies detector: same code compared by the field a condition tests, different codes on the same Deliverable and step compared by rule | src/domain/engine/conflicts/policies.ts |
| Detectors for authority rules, quality gates, review gates, Obligation definitions, engineering capital and dependencies, one file each, plus shared helpers | src/domain/engine/conflicts/authorityRules.ts, qualityGates.ts, reviewGates.ts, obligationDefinitions.ts, engineeringCapital.ts, dependencies.ts, shared.ts |
| `PackContribution.contributions`: the Pack's contributions as authored | src/domain/engine/profileCompositionUnravel.ts |
| Tests | tests/cr139-service-conflicts.test.ts, tests/cr139-capability-conflicts.test.ts, tests/cr139-policy-conflicts.test.ts, tests/cr139-table-conflicts.test.ts |

## Still to build

The screens and the commissioning flow that uses the detectors and the picks. Earlier list: cross-source checks for Policies, authority rules, quality gates, review gates, Obligation definitions and engineering capital, the message on dependency conflicts, competencies from the composed Capabilities, and the approval view of what the EBM takes from each Pack.

## Built (2026-11-06), part 3: competencies

The EBM's competencies now include the role types and work types of the Capabilities composed in the EBM, under the dimensions `Role` and `Work type` (constants in src/dblayer/constants.ts). Files: src/domain/engine/profileCompositionUnravel.ts, src/dblayer/capabilityDefinitionsDB.ts (`findActiveByCodesVisibleTo`), src/dblayer/constants.ts. Tests: tests/cr139-ebm-capabilities-from-catalogue.test.ts.

Participants hold competencies under the dimensions of the `category:pack` Ontology (Technology, Domain and the rest). `Role` and `Work type` are not in that Ontology, so no Participant holds them yet and none is eligible for an SEU that requires them. A new Ontology concept type `participant-eligibility-dimension` in src/dblayer/seed/data/ontologyConcepts.json lists the competency dimensions a Participant can hold: the six that `category:pack` lists plus `Role` and `Work type`, with no values for the last two. `category:pack` is unchanged. Participant onboarding and the Participant seeds validate dimensions against the new type (seedParticipantsMaster.ts, demoParticipants.ts, core/participantsMaster.ts). The values and the Participants that hold them are not added. The fixture Participant helper `ensureEligibleParticipant` already holds every dimension the SEU's EBM requires, so it needs no change.

## Built (2026-11-06), part 4: the Commissioning Report shows the conflicts

`detectEbmConflicts` returns every conflict of the composition with the user's pick beside it (null while the conflict is open). Resolved conflicts stay in the result. There is no separate record function. The Compose button's run (`previewCommissioningValidation`) produces the list and stores it on the SEU as `recordedConflicts`. `compositionCompleted` copies the stored list into the EBM's `behaviors.conflicts` and runs no detection. and `finalizeCommissioning` copies it into the Commissioning Report's `composition.conflicts`, which changes from a list of strings to a list of `RecordedConflict`. The report is still produced after the EBM is Active. Files: src/domain/engine/conflicts/index.ts, src/domain/engine/compositionCompleted.ts, src/routes/seu/core/commissioning.ts, src/dblayer/seuTypes.ts. Test: tests/cr139-service-conflicts.test.ts.

The report lists the conflicts of the new detectors with their pick. Nothing stores a pick for the new detectors yet because the screens are not built, so every pick shows as none, and the composition flow does not yet wait for the new conflicts to be resolved.

## Built (2026-11-06), part 5: actions for each kind of conflict

Each kind of conflict has one action, held in the map `CONFLICT_ACTION_BY_KIND` in src/dblayer/constants.ts. The actions are pick one (Service choice, service levels, same-code Policy and Obligation), pick any (one or all: Policies across codes, authority rules, quality gates, review gates, Obligations across codes, engineering capital links), include or exclude (an added Capability, an entry with no link) and none (notices and dependencies). `resolveConflict` in src/domain/engine/conflicts/resolve.ts checks a pick against the action and returns the value to store under the conflict's key. `detectTableConflicts` re-runs one table's detector. Test: tests/cr139-conflict-resolve.test.ts.

## Built (2026-11-06), part 6: the composition flow saves and uses the picks

| Item | Files |
|---|---|
| `previewCommissioningValidation` passes the picks to `unravelComposition` and returns `ebmConflicts` | src/routes/seu/core/commissioning.ts |
| The Service picked for a Deliverable decides which Pack Service brings its Capability, so the Capabilities, the producing Capability and the competencies follow the pick | src/domain/engine/profileCompositionUnravel.ts |
| `chosenServices` takes the candidates and the picks, `blockingEbmConflicts`, `applyConflictPick` | src/domain/engine/conflicts/services.ts, index.ts |
| The compose-ebm POST accepts one pick (`ebmConflictPick`, JSON with the conflict key and the options picked or the decision), checks it with `applyConflictPick`, stores it with the earlier picks, and publishes CompositionCompleted only when the old check and every blocking conflict of the new detectors are clear | src/routes/seu/web/objectives.ts |
| The view model carries `ebmConflicts` for the screen | src/viewModels/seu_seus_compose.ts |

No new route, so `route_authority` is unchanged.

### Test fixtures updated in the same pass

- tests/testFixtures.ts: `driveCommissioningToActive` answers each open conflict the way a user would, taking the first option (or include) of every resolvable conflict, and fails the commission on one that cannot be resolved.
- tests/cr139-ebm-capabilities-from-catalogue.test.ts and tests/cr139-conflict-resolve.test.ts: the pick changes which Capability the pool holds, blocking conflicts, `applyConflictPick`.

### Correction: Capabilities follow the Deliverable's Service, not the Packs

The Packs take no part in bringing a Capability into the EBM. Each catalogue Deliverable ends with one Service (the only candidate or the user's pick), and that Service names the Capability. The pool entry for a Capability records the Deliverables and shows the Template or Profile that holds the catalogue as its source. The earlier limit to Services that a composed Pack lists is removed. A Deliverable with several Services brings no Capability until the user picks one.

`finalizeCommissioning` reads the `capabilities` row for each Capability code by code alone (the earliest row), since the table holds one row for each Pack and code. The EBM view links the source to the Template or Profile. Files: src/domain/engine/profileCompositionUnravel.ts, src/routes/seu/core/commissioning.ts, src/views/seu/seus/ebm.ejs. Tests: tests/cr139-ebm-capabilities-from-catalogue.test.ts, tests/profile-composition-unravel.test.ts.

## Built (2026-11-06), part 7: Step 0 inside `detectEbmConflicts`

`detectEbmConflicts` is the one entry point and is called only by `previewCommissioningValidation`. It takes the Template ids, the Profile ids, the tenant, the unraveled composition and the picks. It loads the rows with `templatesDB.findById` and `profilesDB.findById`, runs Step 0 (`flattenComposedPacks`, src/domain/engine/conflicts/composedPacks.ts) first, and gives the Pack list to every table's detector as a third argument. No detector uses the list yet, because each is still to get its own unravel. `previewCommissioningValidation` still reads the Profiles for `profileDetails`, now with `profilesDB.findDetailSourceById`, which selects only the seven columns the details read (id, code, name, environment, config_parameters, draft_content, base_template_id). `extractProfileDetails` and `resolveEffectiveParameters` take those columns as their parameter type. Tests: tests/cr139-step0-composed-packs.test.ts, tests/cr139-conflict-resolve.test.ts.

## Built (2026-11-06), part 8: the Services table has its own unravel

`unravelServices` (src/domain/engine/conflicts/unravelServices.ts) gathers what the Services table needs and decides nothing: the Deliverable Catalogue (Profile's own, else Template's), the Active Services that make each catalogue Deliverable with their Service Definition default levels, and the level values the Template sets and the Profile overrides. It calls `resolveDeliverableSource`, `catalogueFor`, `resolveEffectiveParameters` and `serviceDefinitionsDB.findActiveByOutputsVisibleTo`. The Packs' Services are not gathered there. The detector reads them from the Pack list of Step 0.

Every detector now receives a `DetectionContext` (Templates, Profiles, tenant, the Step 0 Pack list, and the old unraveled composition for the tables that have no unravel of their own yet). `detectServiceConflicts` uses `unravelServices`. The level comparison is written once (`compareLevels`) and is used by the Services check and by the check on an added Capability. Tests: tests/cr139-service-conflicts.test.ts, tests/cr139-unravel-services.test.ts, tests/cr139-conflict-resolve.test.ts.

## Built (2026-11-06), part 9: the Capabilities table has its own unravel

`unravelCapabilities` (src/domain/engine/conflicts/unravelCapabilities.ts) gathers two lists and decides nothing. List A holds the Capability of every candidate Service of every catalogue Deliverable. List B holds the Capabilities that the composed Packs name, taken from the Step 0 Pack list. It does its own lookup of the catalogue and the Services and does not use `unravelServices`. `detectCapabilityConflicts` reports a Capability in B and not in A, one conflict for each Pack that names it. A Capability in A and not in B is not a conflict. The Service pick and the Service level check of the Services table apply when the user resolves, and are not part of detection. `levelDifferencesForPackServices` in services.ts is kept for that resolution step and has no caller yet. Tests: tests/cr139-capability-conflicts.test.ts, tests/cr139-unravel-capabilities.test.ts.

## Built (2026-11-06), part 10: the Policies table has its own unravel

`unravelPolicies` (src/domain/engine/conflicts/unravelPolicies.ts) reads the Policy codes in each composed Pack's `policies` list from the Step 0 Pack list, loads their Active Policy Definitions with the new `policyDefinitionsDB.findActiveByCodesVisibleTo`, and returns one rule for each Deliverable and step of each condition. A condition with a governing field gives a field and a rule (operator and value). A condition with only a statement, or with `always_true`, gives neither. `detectPolicyConflicts` (src/domain/engine/conflicts/policies.ts) reports three things: the same code testing the same field for the same Deliverable and step with a different operator or value, different codes applying different rules to the same Deliverable and step, and a notice for statement-only conditions. A Policy code with no Active Definition is skipped. The Template's and Profile's setting changes are not compared. Tests: tests/cr139-policy-conflicts.test.ts, tests/cr139-unravel-policies.test.ts.

## Built (2026-11-06), part 11: the quality gates table has its own unravel

`unravelQualityGates` (src/domain/engine/conflicts/unravelQualityGates.ts) reads the quality gates of the composed Packs from the Step 0 Pack list, one row for each Deliverable a gate names, with every other field of the gate. `detectQualityGateConflicts` (src/domain/engine/conflicts/qualityGates.ts) reports two gates for the same Deliverable at the same step as a conflict when any field differs (name, category, criteria type, required Policy codes, statement, classification, participant, output contract). The checklists and recommended checklists are a union and are kept apart from the comparison. A gate that names no Deliverable is compared only with other such gates at the step. The conflict kind is now `quality-gate-different`. The platform's own required gates for a step are no longer compared, because the Agreed row does not name them. Tests: tests/cr139-quality-gate-conflicts.test.ts.

## Built (2026-11-06), part 12: the review gates table has its own unravel

`unravelReviewGates` (src/domain/engine/conflicts/unravelReviewGates.ts) reads the review gates of the composed Packs from the Step 0 Pack list. `detectReviewGateConflicts` (src/domain/engine/conflicts/reviewGates.ts) reports two review gates at the same step with the same code as a conflict when any other field differs (name, statement, classification, external evidence flag, prompt, participant, output contract, assurance). Review gates with different codes are different gates, so they are never a conflict, and the SEU takes all of them. The conflict key is `reviewGate::<step>::<code>`, and a conflict on one code leaves out only the gates of that code. A review gate carries no Deliverable, so a gate at a step applies to every Deliverable at that step. The checklists and recommended checklists are a union and are kept apart from the comparison. The platform review gates table is not compared. Giving a review gate a Deliverable is CR-140. Tests: tests/cr139-review-gate-conflicts.test.ts.

## Built (2026-11-06), part 13: the authority rules table has its own unravel

`unravelAuthorityRules` (src/domain/engine/conflicts/unravelAuthorityRules.ts) reads the authority rules of the composed Packs from the Step 0 Pack list, taking a Pack's roles for one step together as one set. For each step a Pack names it reads the platform's own rule with `transitionDefinitionsDB.find` and `authorityRulesDB.findById`. `detectAuthorityRuleConflicts` (src/domain/engine/conflicts/authorityRules.ts) reports a step as a conflict when the role sets differ, between Packs or between a Pack and the platform. An authority rule carries a step and no Deliverable, so it applies to every Deliverable at that step. Tests: tests/cr139-authority-rule-conflicts.test.ts.

## Built (2026-11-06), part 14: the Obligation definitions table has its own unravel

`unravelObligationDefinitions` (src/domain/engine/conflicts/unravelObligationDefinitions.ts) reads the Obligation definitions of the composed Packs from the Step 0 Pack list, one row for each Deliverable and step a definition applies to, with every field of the definition and its governing condition for that Deliverable. `detectObligationDefinitionConflicts` (src/domain/engine/conflicts/obligationDefinitions.ts) reports two definitions with the same code for the same Deliverable at the same step as a conflict when any other field differs. Definitions with different codes are different Obligations, so they are never a conflict, and the SEU takes all of them. The conflict key is `obligationStep::<Deliverable>::<step>::<code>`, and a conflict on one code leaves out only the definitions of that code. The conflict kind is now `obligation-different`, which replaces `obligation-same-code` and `obligation-across-codes`. The step an Obligation creates in the platform's definition is not compared. Tests: tests/cr139-obligation-definition-conflicts.test.ts.

## Built (2026-11-06), part 15: the engineering capital table has its own unravel

`unravelEngineeringCapital` (src/domain/engine/conflicts/unravelEngineeringCapital.ts) reads the engineering capital entries of the composed Packs from the Step 0 Pack list. `detectEngineeringCapitalConflicts` (src/domain/engine/conflicts/engineeringCapital.ts) reports entries of the same type with different links as a conflict, and an entry with no link or a blank link as a conflict. The same link from several Packs is no conflict. Tests: tests/cr139-engineering-capital-conflicts.test.ts.

## Built (2026-11-06), part 16: the dependency conflicts are found by Step 0

Step 0 (`flattenComposedPacks`) follows the dependencies, so it also finds the dependency conflicts: a required Pack that is not in the list (it has no Active version), and an incompatible Pack that is in the list. They are returned as `dependencyConflicts` and are not resolvable in composition. Their message says the conflict has to be resolved at the definition of the Template or Profile. The Dependencies tab shows them. A dependency of type optional or conditional is not checked, because the table names only a needed Pack and an incompatible Pack. Files: src/domain/engine/conflicts/composedPacks.ts, dependencies.ts. Tests: tests/cr139-step0-composed-packs.test.ts. The old unraveled composition is no longer an input of `detectEbmConflicts`: every table has its own unravel.

## Built (2026-11-06), part 17: the Resolve Conflicts screen

| Item | Files |
|---|---|
| The page `GET /aisworg/seu/objectives/:id/resolve-conflicts`: one vertical tab for each conflict table with its open count, the conflicts of the selected table as cards with search, sort and paging, and the action that fits each conflict's kind (pick one: radios; pick any: checkboxes; include or exclude: two buttons; notices and dependencies: read-only) | src/routes/seu/web/objectives.ts, src/views/seu/seus/resolve-conflicts.ejs |
| `route_authority` row (badge `seu_commission`, as the Compose page), ViewModel and its registration, `redirects.ts` entry | src/dblayer/seed/data/routeAuthority.json, src/viewModels/seu_seus_resolveConflicts.ts, src/viewModels/viewRegistry.ts, src/middleware/redirects.ts |
| The Compose page shows a Resolve Conflicts button with the open count | src/views/seu/seus/compose.ejs |
| A pick is posted to the existing Compose POST with `ebmPickKey` and the options or decision picked. Earlier picks are read from what the last Compose stored. `returnTo` brings the user back to the tab they were on. | src/routes/seu/web/objectives.ts |
| `conflictStatus`, `summariseConflictTables`, and the tab labels `CONFLICT_TABLE_LABELS` | src/domain/engine/conflicts/index.ts, src/dblayer/constants.ts |
| Test | tests/cr139-conflict-screen.test.ts |

The `route_authority` row reaches the database only through `db:clean-slate`.

### The old conflict handling is commented out (owner)

Nothing is deleted. In src/routes/seu/core/commissioning.ts the call to `detectCompositionConflicts` is commented out and `compositionConflicts` is returned empty. In src/routes/seu/web/objectives.ts the old conflict strategies (the strategy and source-selection parsing and the loop that applied them), the old gating, and the old view model assignment are commented out. Composition completes when no conflict of the nine tables is open. In src/views/seu/seus/compose.ejs the old conflicts section is switched off, the old Apply and re-validate button is gone, and a warning with a link to Resolve Conflicts shows while any conflict is open. `unravelComposition`, `detectCompositionConflicts` and `applyConflictStrategy` remain in place, because the old unravel still builds the EBM's content.

### Open: the demo simulator

src/routes/seu/core/demoSimulator.ts stops on an old conflict and otherwise publishes CompositionCompleted. With the old check off it no longer stops, and it does not look at the conflicts of the nine tables. It needs a decision on how the demo answers them.

## Built (2026-11-06), part 18: what the EBM saves, starting with Services

For each table the EBM saves three things: the conflicts as detected with their options, the user's pick for each, and the final result the SEU takes. The conflicts and picks stay for audit and for the Commissioning Report. The SEU reads only the final result. The result holds everything the SEU takes for the table, including the items that never conflicted.

`settleEbm` (src/domain/engine/conflicts/index.ts) runs Step 0 and calls one settle function for each table. Only Services is built: `settleServices` (src/domain/engine/conflicts/settleServices.ts) saves every Services conflict with its pick, and a result of one entry for each catalogue Deliverable with its Service and the final value of each level of that Service. A level picked as a value takes that value, and a level picked as "no value" is dropped. A Deliverable whose Service is not decided yet is left out. `previewCommissioningValidation` returns `settled`, the Compose route and the test fixture store it on the SEU, and `compositionCompleted` copies it into the EBM's `behaviors.settled`. Nothing in the SEU reads it yet. The tables that are not built yet are not in `settled`. Test: tests/cr139-settle-services.test.ts.

## Built (2026-11-06), part 19: what the EBM saves for the other tables

Every table has its own settle function in src/domain/engine/conflicts (settleCapabilities.ts, settlePolicies.ts, settleAuthorityRules.ts, settleQualityGates.ts, settleReviewGates.ts, settleObligationDefinitions.ts, settleEngineeringCapital.ts, settleDependencies.ts), written from the unravel facts and the detectors of this change, and `settleEbm` calls all nine. Each saves the conflicts with the user's picks and the final result the SEU takes:

| Table | Final result | How a pick changes it |
|---|---|---|
| Capabilities | The Capability of the Service each Deliverable ends with, with the Deliverables; and the Capabilities a Pack names that the user included | The Service pick decides the Capability. Include or exclude decides a Pack's Capability. |
| Policies | The rules of the Policies, one per Policy, Deliverable, step and field, with the Packs that give them; statement-only conditions are always taken | A pick between rules of one Policy keeps that rule. A pick between Policies keeps the picked Policies. |
| Authority rules | The roles for each step | The roles of the picked sets, together |
| Quality gates | The gates for each Deliverable and step; the checklists are a union | The picked gates |
| Review gates | The gates for each step; the checklists are a union | The picked gates |
| Obligation definitions | The definitions for each Deliverable and step | The picked definitions |
| Engineering capital | The entries, the same link from several Packs being one | The picked links. An entry with no link is taken only when included. |
| Dependencies | The composed Packs, flattened by Step 0 | None. The dependency conflicts cannot be resolved here. |

Until a conflict is resolved, no result is generated for it: it stays in the conflict list and the result leaves out only what the conflict covers (a level, a Deliverable's Service, the rules or gates or definitions at that step, the links of that type). Composition does not complete while a conflict is open. Test: tests/cr139-settle-tables.test.ts.

Checklists and competencies have no conflicts, but the EBM saves them the same way and the Resolve Conflicts screen has a tab for each, so the user sees the value:

| Table | Final result |
|---|---|
| Checklists | Every checklist of every Pack with every item (a union), from settleChecklists.ts and unravelChecklists.ts |
| Competencies | The role types and work types of the Capabilities the SEU takes, the Profile's programming language (Technology) and domain (Domain), and the Packs' own competencies, each with its sources, from settleCompetencies.ts. A competency from two places is one competency. |

Every tab of the Resolve Conflicts screen now shows a "What the SEU takes" table with the saved result, whether or not the table has a conflict. The tab labels and the Technology and Domain dimension names are in src/dblayer/constants.ts.

## Built (2026-11-06), part 20: a preview of the result as choices are made (removed 2026-11-11, see part 21)

On the Resolve Conflicts screen, selecting an option reloads the page with that selection as a preview (`previewKey`, `previewOption`, `previewDecision` in the address). The server checks the selection with `applyConflictPick`, works out `settleEbm` as if the pick were made, and shows that result in the "What the SEU takes" table of the selected tab, marked "Preview of your selection, not applied yet". The option stays selected. Nothing is saved until Apply. An include or exclude conflict now uses two radio buttons and an Apply button, so it can be previewed too. A selection that is not valid shows its reason in the table. The preview shows the result of the selected tab only. Files: src/routes/seu/web/objectives.ts, src/views/seu/seus/resolve-conflicts.ejs, src/viewModels/seu_seus_resolveConflicts.ts.

## Built (2026-11-11), part 21: the Resolve Conflicts screen and the View EBM page

**Service level conflicts.** A level in A and not in B is no conflict. The kind `level-omitted` is removed. The remaining kinds are `level-different` and `level-added`, and their cards are titled "Service level conflicts" (`CONFLICT_TITLE_BY_KIND`, set by `withAction`). The table is under "Service level conflicts" above and in EBM Composition Contributions Table.md.

**Different codes are different items.** Review gates and Obligation definitions with different codes are different items, so they never conflict and the SEU takes all of them. A conflict needs the same code at the same step (and, for Obligations, the same Deliverable) with some other field different. The keys are `reviewGate::<step>::<code>` and `obligationStep::<Deliverable>::<step>::<code>`. A conflict on one code leaves out only the items of that code. Quality gates, which have no code, and authority rules keep their rules.

**Screen layout.**

| Change | Files |
|---|---|
| The order is "What the SEU takes", then the conflicts, then "What the EBM leaves out, and why" | src/views/seu/seus/resolve-conflicts.ejs |
| The preview of part 20 is removed. Selecting an option changes nothing, and Apply is the only action that saves | src/views/seu/seus/resolve-conflicts.ejs, src/routes/seu/web/objectives.ts |
| The columns of "What the SEU takes" follow `CONFLICT_RESULT_COLUMNS`, because the saved result comes back from JSONB with its keys reordered | src/dblayer/constants.ts |
| Capabilities (`CONFLICT_TABLES_SHOWN_AS_TABLE`) show one row for each conflict (Pack, Capability with its code below, Include or Exclude) and one Apply in a bar that stays at the top. The picks are posted together (`ebmBulkKey`, `ebmBulkDecision_<row>`) and each is checked against its own conflict | src/views/seu/seus/resolve-conflicts.ejs, src/routes/seu/web/objectives.ts |
| A Capability shows its name as a link that opens its definition in a modal, with the code in muted text | src/views/seu/seus/resolve-conflicts.ejs |
| Quality gates, review gates, Obligation definitions and authority rules (`CONFLICT_KINDS_SHOWN_AS_COMPARISON`) show the options side by side, one column for each source and one row for each field or role, with the rows that differ highlighted | src/views/seu/seus/resolve-conflicts.ejs |
| A value that is an object or a list shows its first 24 characters and a "…" that opens the whole value in place | src/utils/resultCells.ts, src/views/partials/jsonMore.ejs |
| Each entity a cell names is a link in its cell, and the Open column lists every link of the row. The columns that name entities are in `CONFLICT_RESULT_LINK_COLUMNS` and the pages in `CONFLICT_ENTITY_PAGES` | src/routes/seu/web/conflictResultLinks.ts, src/dblayer/constants.ts |
| Review gates and authority rules record the Packs they take (`packs`), so their rows link to the Packs | src/domain/engine/conflicts/settleReviewGates.ts, settleAuthorityRules.ts |
| The View EBM page uses the same column order, "…" and links. The helpers are written once in `resultCells` | src/views/seu/seus/ebm.ejs, src/routes/seu/web/seus.ts, src/utils/resultCells.ts |

**Compose.** The Compose button on the All SEUs page posts to `compose-ebm`, and composes the SEU's own Template and Profile when the form names none. Every Compose and every pick starts from the picks the last Compose stored, so a Compose no longer erases them. Files: src/views/seu/seus/index.ejs, src/routes/seu/web/objectives.ts.

**Tests.** tests/cr139-service-conflicts.test.ts, cr139-conflict-resolve.test.ts, cr139-conflict-screen.test.ts, cr139-review-gate-conflicts.test.ts, cr139-obligation-definition-conflicts.test.ts, cr139-settle-tables.test.ts, and the new cr139-result-cells.test.ts. The parsing of the picks of a table shown as rows and the pages are not tested.

## Review of the build (2026-11-06)

| Area | State |
|---|---|
| Remove the Profile's `additionalCapabilityCodes` | Built (part 1) |
| Step 0: flatten the Packs and find the dependency conflicts | Built |
| One unravel, one detector and one settle function for each of Services, Capabilities, Policies, authority rules, quality gates, review gates and Obligation definitions, and engineering capital | Built |
| Dependencies | Built inside Step 0 |
| Checklists and competencies | Saved by a settle function. They have no detector. |
| The actions for each kind of conflict, and the resolver | Built (constants.ts, resolve.ts) |
| The Resolve Conflicts screen, with a tab for each table, the value the SEU takes on every tab, and a preview as an option is selected | Built |
| The Compose route saves a pick and completes composition when no conflict is open | Built |
| The old conflict handling | Commented out, not deleted |
| What the EBM saves: the conflicts with the picks, and the final result, in `behaviors.settled` and `behaviors.conflicts` | Built |
| The Commissioning Report lists the conflicts with the picks | Built (from `behaviors.conflicts`) |

### Built after the review

- **What the EBM leaves out, and why.** Every settle function returns `leftOut` beside the result, and the Resolve Conflicts screen shows it under "What the EBM leaves out, and why". An open conflict leaves out what it covers ("Not decided yet"). A resolved conflict leaves out the options the user did not take ("You picked X instead", "You did not pick it", "You chose to exclude it"). Services also lists the Services of the Packs that no catalogue Deliverable uses, and Capabilities lists the Capability of a Service that is not a Deliverable's Service. Checklists, competencies and dependencies leave nothing out.
- **The dead additions in the old unravel are commented out** (`packContributions`, `platformSteps`, `loadPlatformSteps`) and so is `levelDifferencesForPackServices`. `serviceCandidates` stays, because the old unravel uses it to build the Capability entries.

- **Commissioning reads the EBM's settled result.** `finalizeCommissioning` (src/routes/seu/core/commissioning.ts) takes the SEU's Capabilities from `behaviors.settled.capabilities.result`, creates a Deliverable for each entry of `behaviors.settled.services.result`, and takes each Deliverable's producing Capability from the Capability that lists it. It no longer reads `behaviors.pool` or the Template's or Profile's catalogue. An EBM with no settled result stops commissioning with "records no settled result; recompose it".

- **Profile configuration is saved and shown.** `behaviors.settled.profileConfiguration` holds every configuration parameter the Profile sets (the list `PROFILE_CONFIGURATION_PARAMETERS` in constants.ts; Pack codes and exposed parameter overrides are on other tabs). The Resolve Conflicts screen has a "Profile configuration" tab. Files: unravelProfileConfiguration.ts, settleProfileConfiguration.ts.
- **Readers moved off the pool, to `behaviors.settled`** (through src/domain/engine/ebmSettled.ts): the redispatch limits and dispatch strategy preference (redispatch.ts, workItemGenerated.ts), the participating organisations (dispatchStrategies.ts), and the competency requirements (participantEligibility.ts, seus.ts). The old reads are commented out.

- **More readers moved to `behaviors.settled`:** the work item generator (output locations from the Profile configuration; the checklists and engineering capital the EBM takes; the Profile configuration), the Obligation definitions in obligations.ts (matched by entity type and step, with the governing condition; the originating Pack is the first Pack that gives the definition), and `createDeliverable` (the Deliverables of `services.result`). The settled Obligation definitions now carry their Packs. The old reads are commented out.
- **Choice made for the work item context:** a work item for a Deliverable that has a producing Capability carries every checklist and every engineering capital entry the EBM takes, with the Pack that gives each. Before, it carried only the Packs that contributed the Capability, and the Capability no longer comes from a Pack.

- **Eligibility Policies and the EBM view read the settled result.** The settled Policies now carry each rule's scope and governing condition (a Policy with no transition has one rule with no step, so eligibility Policies are kept). `resolveEligibilityPolicies` returns the Policies of scope Eligibility from `behaviors.settled.policies`, each with its code and condition, and `findEligibleParticipants` takes them as `requiredPolicies`. The EBM page (ebm.ejs) shows one tab for each settled table with what the SEU takes, the conflicts with the picks, and what is left out, and no longer reads the pool. `behaviors.eligibilityPolicyIds` is no longer saved. The old reads and panes are commented out.

- **The old composition is no longer called.** `previewCommissioningValidation` no longer calls `unravelComposition` or `detectCompositionConflicts`. The Packs the EBM composes, the Step 0 warnings and the Deliverable source come from `describeComposition` (src/domain/engine/conflicts/describeComposition.ts), which uses the Step 0 Pack list. The Compose route, the Compose page and the test fixture no longer carry the old composition's output. The old functions remain in profileCompositionUnravel.ts, unused by the application, and the tests that still call them are to be retired with them.

- **Tests of the old composition.** tests/profile-composition-unravel.test.ts and tests/cr101-domain-configuration-competency-union.test.ts are commented out, because they tested the old functions. The tests of cr139-ebm-capabilities-from-catalogue.test.ts that called the old composition are commented out, and the rest remain. tests/cr104-mandatory-seu-eligibility-policies.test.ts now checks that a Mandatory Pack composes through Step 0 (`flattenComposedPacks`). The behaviours are tested by tests/cr139-*.test.ts.

- **An SEU always has a tenant.** `seus.tenant_id` is NOT NULL in src/dblayer/recovery/seus_schema_recovery.sql (created with the table; the separate ALTER is commented out), `SeuRow.tenant_id` is a `string`, `seusDB.create` requires `tenantId` with no `?? null`, and `initiateSeu` fails with a reason when no tenant can be found. This removes the nullable tenant errors in `getSystemActor` and the execution engine. Test fixture updated in the same pass: tests/dependency-definition-engine.test.ts (three SEUs now pass a tenant). The column constraint reaches the database only after `db:clean-slate`.

- **The Capabilities of the SEU point at the Capability Definition.** The foreign keys of six tables moved from `capabilities(id)` to `capability_definitions(id)`: `seu_capabilities.capability_id`, `deliverables.producing_capability_id`, `capability_fulfilment_pools.capability_id`, `execution_targets.capability_id`, `services.providing_capability_id` and `evidence.originating_capability_id` (recovery SQL for each, and `capability_definitions_schema_recovery.sql` now runs before `deliverables_schema_recovery.sql` in run.ts). Reason: the `capabilities` table has rows only for Capabilities that a Pack names, so a Service whose Capability no Pack names stopped commissioning ("settles Capabilities that have no capabilities row"). Code changed: `finalizeCommissioning` takes the Active Capability Definition of each settled Capability code visible to the SEU's tenant; `seuCapabilitiesDB` and `knowledgeItemsDB` read the code and label from the Definition (`default_label`); the work item generator, traceability and the Services list read the Definition; the Pack publish gives a Service the Definition of its capability code, and a Pack that lists a Service no longer has to name its Capability; the Template's Service parameters look up Services by the Definition of the Capability's code. Packs still write the `capabilities` table for their own capability lists. The tests that create SEU Capabilities take their ids from `seu_capabilities`, so none needed changing. The change reaches the database only after `db:clean-slate`.
- **A Capability reference is the Active Capability Definition.** There is one Active Definition for a code, and every row that points at a Capability points at it: commissioning takes the Active Definition of each settled code visible to the SEU's tenant, and the Pack publish gives a Service the Active Definition of its capability code. Ids are compared as before.

- **The EBM records the Capability Definition id; commissioning reads it off the EBM.** Each settled Capability carries `definitionId`, the id of the Active Capability Definition of its code when the EBM was composed (settleCapabilities.ts). `finalizeCommissioning` creates the SEU's Capabilities and the Deliverables' producing Capabilities from those ids and looks nothing up. A settled Capability with no Definition id stops commissioning. An SEU follows its EBM, so it keeps the version recorded there when a newer version of the Definition becomes Active.

- **A Deliverable Definition has a name, and the EBM records it.** `deliverable_definitions.name` is a NOT NULL column (recovery SQL, `DeliverableDefinitionRow`, the Deliverable grammar in schemaDefinitions.json, `createDraft`, `updateDraftContent`, the write validator, the authoring seed input, and the copy of a Definition). The Deliverable Definition seed takes the name from the Ontology label of the code, loaded once. The EBM's Services result carries each Deliverable's `name`, read from its Active Deliverable Definition when the EBM was composed. `finalizeCommissioning` and `createDeliverable` use that name and no longer read Ontology labels. Test fixture updated in the same pass: tests/deliverable-definition-event-lifecycle-table.test.ts (the Definition it creates now has a name). The column reaches the database only after `db:clean-slate`.

### Not built

1. **Nothing reads the pool now,** except the Deliverable dependency graph, which comes from the dependency rows recorded in `composition_report.deliverableSource` and is not in the settled result. Commissioning, the Deliverable's producing Capability, eligibility, the gates, Policies, authority rules and the other readers still read the old `behaviors.pool` and `behaviors.competencyRequirements`, which the old `unravelComposition` still builds. Until the SEU reads the settled result, the user's picks change what is saved and shown but not what the SEU does.
2. **The old composition's code is commented out** in profileCompositionUnravel.ts (everything except the types and `resolveComposedPacksTransitively`, which Step 0 uses) and in commissioning.ts (`applyConflictStrategy` and its import). Nothing calls it.
3. **The dead code is commented out and still to be cleaned up.** See the list above.
4. (Done: the screen shows what is left out and why.)
5. **Template and Profile settings for a Policy** are not compared, because the table does not say how.
6. **The demo simulator** does not answer the conflicts of the nine tables.
7. **The preview** was removed in part 21.
8. **The review gate Deliverable** is CR-140.

### Verification

`tsc`, the tests and `db:clean-slate` have not been run. The grammar change, the `route_authority` row and the Ontology concepts reach the database only after `db:clean-slate`. The test fixture `driveCommissioningToActive` now answers every open conflict by taking the first option, or include.

## Still open

- Whether a Profile may override a Template's Packs (the owner decides).
