# Implementation Traceability: Chapter 6 – Composition Engine

**Date of report: 23-10-2026**

Specification: src/docs/SEU Studio Specifications/01_Engineering Definition/06_Composition Engine.md

## Traceability Table

<!-- multiline -->
**Legend:** ✅ Fully met  ⚠️ Partially met  ❌ Not met  ❓ Not verifiable

<table style="width:100%; table-layout:fixed;">
  <colgroup>
    <col style="width:4%;">
    <col style="width:32%;">
    <col style="width:27%;">
    <col style="width:37%;">
  </colgroup>
  <thead>
    <tr>
      <th></th>
      <th>Intent</th>
      <th>Code Citation</th>
      <th>Finding</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Composition Engine alone creates, validates, versions and activates an EBM.<br>Ref: §1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionCompleted.ts:49-112<br>src/dblayer/ebmsDB.ts:19-44<br>src/routes/seu/core/commissioning.ts:366-381<br>src/routes/seu/web/seus.ts:300-320</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the EBM row is created by compositionCompletedHandler off a CompositionCompleted event, versioned by ebmsDB.create, validated by validateEbm and activated by transitionEntity from the SEU EBM route. ebmsDB.create has no other caller.<br>Gap: compositionEngine.ts holds no create, validate, version or activate function. These steps are spread over an event handler, a commissioning helper and a web route.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engine performs no engineering work. It does not execute Work Items, manage Participants or Deliverables, or preserve Knowledge.<br>Ref: §1, §4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:1-7<br>src/domain/engine/profileCompositionUnravel.ts:1-8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Both engine files import only the Template, Profile, Pack and Policy DB layers and Profile and Template helpers. Nothing in them dispatches Work Items or touches Participants, Deliverables or Knowledge.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition is a build-time service and is not part of normal SEU execution.<br>Ref: §3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participantEligibility.ts:32-37<br>src/routes/seu/web/objectives.ts:485-545</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: composition is started by the compose-ebm route during commissioning.<br>Gap: resolveEligibilityPolicies calls unravelComposition at execution time from the live Template and Profile. It does not read the composed_packs stored on the SEU's EBM, so a later Pack change alters eligibility for an SEU that is already running.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engine discovers Packs from the Template mandatory set, the Profile selection and the Platform Mandatory Packs.<br>Ref: §4, §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:109-128<br>src/dblayer/packsDB.ts:191-200,292-304</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">unravelComposition gathers Template mandatory codes, Active Platform Mandatory Packs visible to the Template tenant and the Profile's Pack codes. It resolves the newest Active row per code. The Composition Engine accepts a Template array and a Profile array, so one or more Templates can be input where the spec says one.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engine resolves Pack dependencies.<br>Ref: §4, §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:77-102</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: resolveComposedPacksTransitively walks pack.dependencies level by level and adds each Active Pack.<br>Gap: line 95 follows every declared dependency regardless of type. An optional, conditional or incompatible dependency target is composed into the model like a required one.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engine classifies dependencies as required, optional, conditional, incompatible or missing.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:258-264,362-369<br>src/routes/seu/core/packs.ts:92,137,399-404</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: required and incompatible violations are reported as conflicts. A required target absent from the directly selected set is reported. A root Pack code with no Active version raises a warning (line 91).<br>Gap: conditional is treated exactly like required (line 365) and no condition is evaluated. Optional is never evaluated. Incompatibility is tested only against the directly selected codes, not the transitively composed set. A missing transitive Pack is dropped without a warning. A required target that the walk has already composed is still flagged unsatisfied because satisfiedInComposedSet uses the direct set (line 261).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Dependencies are declared by Packs and are not inferred.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:92,137,399-404<br>src/domain/engine/profileCompositionUnravel.ts:95,258-264</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Dependencies come only from the Pack's declared dependencies array, validated at authoring. No dependency is derived from content.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engine validates Pack compatibility.<br>Ref: §4, §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:362-369<br>src/dblayer/packsDB.ts:191-200</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: only Active Packs are composed and incompatible declarations are reported.<br>Gap: compatibility is limited to declared incompatible dependencies against the directly selected set. supportedPlatformVersion and category rules are not checked during composition.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engine composes behavioural contributions from composed Packs into one pool, each entry carrying its source.<br>Ref: §4, §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:204-265</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capabilities, Services with Service Levels, Authority Rules (grouped per governed transition), Quality Gates, Checklist items, Review Gates, Obligation definitions, Engineering Capital, Policies and Pack dependencies are pushed as pool entries with a Pack source. Test: tests/profile-composition-unravel.test.ts:211-234.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Contributions are composed according to the composition strategy declared for them.<br>Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:464-507<br>src/domain/engine/profileCompositionUnravel.ts:294-372<br>src/routes/seu/core/packs.ts:168-181</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: a Pack's compositionStrategy is validated at authoring (packs.ts:168-181). At commissioning, identical values collapse and differing values become conflicts, which a person resolves by choosing a strategy per conflict in applyConflictStrategy.<br>Gap: the strategy declared by a Pack is not read when the model is composed. The strategy applied is whichever the person picks.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engine supports Merge, Override, Supplement, Union, Intersection, Alias and Conflict Detection.<br>Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:24-39,168-223<br>src/routes/seu/core/packs.ts:174-175<br>src/routes/seu/core/commissioning.ts:504-506<br>src/dblayer/seed/data/ontologyConcepts.json:1750-1760</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: merge, union, intersection, supplement and specialize are functions. Conflict Detection runs inside Merge and Union. The code path for override is the specialize call at commissioning.ts:504-506.<br>Gap: no Alias strategy exists in code although the Ontology lists it. Override has no function of its own. Conflict Detection is rejected as a standalone strategy by design (packs.ts:174).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">New strategies can be added without modifying the Runtime Kernel.<br>Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:24-39,163-166</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: strategy names live in the Ontology concept type composition-strategy.<br>Gap: the code accepts only the six names in the CompositionStrategyCode union and a fixed STRATEGY_REQUIREMENTS record. Each strategy is a hard-coded method, so a new strategy needs a code change. An unknown strategy silently takes the override requirements (line 165).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engine accepts Template, Organisation, Domain, Compliance, Technology, Integration and Platform Packs as input.<br>Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:104-128</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Packs enter by Template mandatory set, Profile Pack selection and Platform Mandatory classification. The composition code does not branch on Pack category, so any category, including ones added through the Extension Framework, composes.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition produces exactly one EBM for each commissioned SEU.<br>Ref: §6, FR-6.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionCompleted.ts:49-112<br>src/dblayer/ebmsDB.ts:19-44<br>src/dblayer/recovery/ebms_schema_recovery.sql:3-14<br>src/routes/seu/web/objectives.ts:485-545</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: each successful composition creates one ebms row and sets seus.active_ebm_id to it.<br>Gap: the compose route has no check for an existing EBM or for the SEU state. Calling it again creates another row. The ebms table has no uniqueness on seu_id.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The EBM contains behavioural rules, governance rules, authority rules, engineering standards, terminology mappings, quality gates, review gates and behavioural metadata.<br>Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionCompleted.ts:58-86<br>src/dblayer/seuTypes.ts:84-105</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: behaviors.pool carries authority rules, quality gates, review gates, checklists, obligations, policies, capabilities and services. The row also stores applicable_quality_gate_ids, applicable_policy_ids and composed_packs.<br>Gap: PackContributions has no terminology mapping or workflow kind, so terminology mappings are not part of the EBM. There is no separate metadata block beyond competencyRequirements.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engine does not expose a partially composed model.<br>Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/web/objectives.ts:523-537<br>src/domain/engine/compositionCompleted.ts:74-86</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The ebms row is written only after the compose route finds zero conflicts and publishes CompositionCompleted. While conflicts remain, only a per-SEU preview is stored on seus.composition_report, not an EBM.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The platform composes before every SEU is commissioned.<br>Ref: §7 FR-6.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/ebmActivated.ts:9-52<br>src/routes/seu/core/commissioning.ts:225-309,387-439</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">finalizeCommissioning, which activates the SEU, runs only from ebmActivatedHandler off an EBMActivated event. An SEU therefore cannot complete commissioning without an EBM. Composition is a person's action on the compose-ebm route, not an automatic step of commissionFromForm, which stops at Validated.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every behavioural contribution keeps its originating Pack reference.<br>Ref: §7 FR-6.3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:12-17,204-265</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each pool entry carries source {kind, id, code} naming the Pack that contributed it. The pool is stored whole in ebms.behaviors.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engine maintains complete composition traceability.<br>Ref: §7 FR-6.4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:19-23,269<br>src/domain/engine/compositionCompleted.ts:58-86</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: source Pack id and code per entry, and composed_packs with Pack version.<br>Gap: entries record no composition strategy and no link to the resolution that changed them. See the Traceability rows under §14.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Identical inputs produce identical EBMs.<br>Ref: §7 FR-6.5, §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/policiesDB.ts:76<br>src/dblayer/qualityGatesDB.ts:88<br>tests/engine.test.ts:36-69</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: Pack resolution is by code with a fixed ordering, and pool entries are pushed in input order.<br>Gap: findByPackIds in policiesDB and qualityGatesDB have no ORDER BY, so applicable_policy_ids, applicable_quality_gate_ids and the order of Pack policies are not fixed. The determinism test calls compositionEngine.compose, which no production code calls. unravelComposition has no determinism test.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engine supports incremental recomposition.<br>Ref: §7 FR-6.6, §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:104-273</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: unravelComposition rebuilds the whole pool from the Template, Profile and Packs every time. No code compares the new result to the previous EBM or recomposes only what changed.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Recomposition produces a new EBM version.<br>Ref: §7 FR-6.7, §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ebmsDB.ts:19-44<br>src/domain/engine/compositionCompleted.ts:74-105<br>src/dblayer/recovery/ebms_schema_recovery.sql:14<br>src/dblayer/seed/data/eventSubscriptions.json:11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: ebmsDB.create sets version to MAX(version)+1 for the SEU, so a repeated composition adds a row and older rows are untouched.<br>Gap: the subquery is not locked and the table has no unique key on (seu_id, version). The previous EBM is not superseded or retired. seus.active_ebm_id moves to the new Composed EBM at creation (compositionCompleted.ts:105). EBMVersioned is never published.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition runs the stages Collect, Resolve Dependencies, Validate Packs, Compose, Detect, Resolve, Validate Model, Version and Activate.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:441-462,366-381<br>src/routes/seu/web/objectives.ts:485-545<br>src/domain/engine/compositionCompleted.ts:49-112</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: previewCommissioningValidation collects, resolves, composes and detects. The route applies resolutions. The EBM is created, then validated and activated by person-triggered transitions.<br>Gap: there is no pipeline object or stage record. Validate Packs is only the Active-status filter. Versioning happens at row creation, before Validate Model. Validate Model checks references are live and nothing else.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Failure at any stage terminates composition.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionCompleted.ts:31-47,91-100<br>src/domain/engine/profileCompositionUnravel.ts:88-92</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: an exception during EBM creation calls failSeu, and an EBM insert error publishes CommissionFailed. Unresolved conflicts stop CompositionCompleted.<br>Gap: a Pack with no Active version is skipped with a warning and composition continues (profileCompositionUnravel.ts:90-92; compositionEngine.ts:19). The warning does not terminate it.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engine identifies authority rule conflicts.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:214-222,294-345<br>tests/profile-composition-unravel.test.ts:96-131</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Roles are grouped per Pack and governed transition. Two Packs assigning different role sets to one transition produce a conflict. Several roles from one Pack do not. Both cases are tested.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engine identifies conflicting quality gates.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:223-225,294-345</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Quality Gates are keyed by governed transition and category. Two Packs on the same key with different content conflict through the diff in diffEntries.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engine identifies incompatible workflows.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:84-105</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: Packs have no workflow contribution kind, and no composition code compares workflows.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engine identifies inconsistent terminology.<br>Ref: §11, §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:84-105</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: Packs have no terminology mapping contribution and no code checks terminology consistency.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engine identifies incompatible compliance requirements and incompatible technology constraints.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:52-74<br>src/domain/engine/compositionEngine.ts:281-320</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: competencies from Packs and the Profile are unioned per dimension and never compared. Review Gate and Service Level conflicts are found through the generic diff (tests/profile-composition-unravel.test.ts:81-142).<br>Gap: no rule compares compliance or technology constraints between Packs. detectGovernanceConflicts in compositionEngine.ts is only called by compose(), which production code does not call.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Conflicts are classified as deterministic or non-deterministic.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:37-41,347-372</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: CompositionConflict has propertyName, options and hasAction. It has no deterministic or non-deterministic classification. hasAction only separates conflicts a strategy can reconcile from dependency violations.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deterministic conflicts are resolved automatically.<br>Ref: §12, §19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:296,347-372</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: values that are identical across sources produce no conflict (line 296), but that is agreement. Every conflict with differing values waits for a person to pick a strategy. No rule resolves any conflict automatically.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Non-deterministic conflicts require explicit resolution before commissioning.<br>Ref: §12, §19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/web/objectives.ts:523-537<br>src/routes/seu/core/commissioning.ts:464-507<br>tests/profile-composition-unravel.test.ts:236-248</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The route publishes CompositionCompleted only when compositionConflicts is empty. A person resolves a conflict by choosing a strategy, and the resolved paths are excluded on the next pass. Dependency violations have no strategy and block until the selection changes. Without CompositionCompleted no EBM exists, so the SEU cannot be activated.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The resolved value becomes what the EBM contains.<br>Ref: §8 (Resolve Conflicts), §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionCompleted.ts:58-63</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: resolved values are saved as behaviors.resolvedCompositionConflicts beside the unchanged pool. The pool still holds every conflicting entry, and the readers of behaviors.pool (workItemGenerator.ts:37, dispatchStrategies.ts:29, redispatch.ts:19, obligations.ts:198, seus.ts:502) do not read the resolved map.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every resolution is recorded and remains traceable.<br>Ref: §12, §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionCompleted.ts:58-63<br>src/domain/engine/compositionEngine.ts:258<br>src/routes/seu/core/commissioning.ts:459</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the resolved value per property path is kept in seus.composition_report and copied to ebms.behaviors.<br>Gap: compositionReport.resolutions is always an empty array. A resolution records no strategy, no source Packs, no actor and no time.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Validation checks behavioural completeness and governance completeness, and fails an incomplete model.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:89-103,366-381</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: validateEbm checks that the Template, Profile and each composed Pack are still live and takes the EBM to Retired when one is not.<br>Gap: no code checks that the model has required behavioural or governance content. An EBM with an empty pool validates.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Validation checks dependency completeness.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:258-264,362-369<br>tests/profile-composition-unravel.test.ts:176-195</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A required dependency not in the selected set is reported as a conflict that blocks composition. The test covers the missing and satisfied cases.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Validation checks that mandatory Packs are available and resolved.<br>Ref: §13, §19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:109-116,88-92<br>src/dblayer/packsDB.ts:292-304</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: Template mandatory codes and Platform Mandatory Packs are resolved to Active Packs.<br>Gap: a mandatory Pack with no Active version only raises a warning. Composition succeeds without it.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Validation checks mandatory behavioural rules and terminology consistency.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:104-273</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: no code defines or checks mandatory behavioural rules, and no terminology check exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The originating Pack and its version are traceable for each behavioural rule.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:205,269<br>src/domain/engine/compositionCompleted.ts:58-86</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each pool entry names its Pack id. ebms.composed_packs lists packId, packCode and packVersion, so the version is found by joining on the Pack id.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The composition strategy used is traceable for each behavioural rule.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:19-23</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: PoolEntry has propertyName, value and source only. No strategy is recorded on an entry or in the report.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The conflict resolution is traceable for each behavioural rule and the traceability is permanent.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionCompleted.ts:58-63<br>src/dblayer/ebmsDB.ts:52-60</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the EBM row persists and only its status can be updated through ebmsDB.<br>Gap: the resolution is a property-to-value map that is not linked to the pool entries it affects.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Only validated EBMs can be activated.<br>Ref: §15, §19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:211-245<br>tests/ebm-event-lifecycle-table.test.ts:125-132</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The transition rows are None to Composed, Composed to Validated, Validated to Active and Composed to Retired. Composed to Active has no row. The test checks that the skip is refused.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Activation assigns an identifier and a version.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ebmsDB.ts:19-44<br>src/dblayer/recovery/ebms_schema_recovery.sql:3-14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The identifier is the ebms.id UUID and the version is set at insert. Both exist before activation, so activation finds them already assigned.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Activation publishes events and makes the EBM available for commissioning.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:229-236<br>src/dblayer/seed/data/eventSubscriptions.json:49-50<br>src/domain/engine/ebmActivated.ts:9-52<br>src/routes/seu/core/commissioning.ts:225-309</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Validated to Active row publishes EBMActivated. ebmActivatedHandler runs finalizeCommissioning, which creates Capabilities and Deliverables and moves the SEU to Activated.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Activation and recomposition do not modify existing EBMs. An activated EBM is immutable.<br>Ref: §15, §16, §19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ebmsDB.ts:52-60<br>src/dblayer/seed/data/transitionDefinitions.json:211-245</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">ebmsDB has create, findById and updateStatus only. No code updates the composed packs or behaviors of an existing row, and a new composition inserts a new row. Status moves only forward. The table has no database-level immutability.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Recomposition occurs when Packs are upgraded, conflicts are resolved, governance changes, new mandatory Packs appear or an authorised user requests it.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/web/objectives.ts:485-545<br>src/dblayer/seed/data/routeAuthority.json:1157-1172<br>src/routes/seu/core/commissioning.ts:89-103</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: an authorised user holding seu_commission can recompose through the compose-ebm route, which also covers recomposition after conflict resolution.<br>Gap: nothing starts recomposition on a Pack upgrade, a governance change or a new Mandatory Pack. checkEbmLiveness retires a dead EBM but does not recompose.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">CompositionStarted is published.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/eventSubscriptions.json:8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: the event type is declared and its own description says it is never published.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">DependencyResolved, DependencyFailed, PackValidated, BehaviourComposed, ConflictDetected, ConflictResolved and CompositionValidated are published.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:945</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: none of these names is published by composition code. PackValidated exists only as a Pack lifecycle event (transitionDefinitions.json:945).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">EBMCreated is published when the EBM is created.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:211-219<br>src/domain/engine/compositionCompleted.ts:105-116</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The birth row publishes EBMCreated with the real actor and badge, one per EBM. Test: tests/ebm-event-lifecycle-table.test.ts:80-88.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">EBMActivated is published when the EBM is activated.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:229-236<br>tests/ebm-event-lifecycle-table.test.ts:108-123</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The governed Validated to Active transition publishes EBMActivated through publishTransition.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">CompositionFailed is published when composition fails.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionCompleted.ts:27-29,91-100</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: a failure publishes CommissionFailed with stage compose_ebm, which marks the SEU Failed.<br>Gap: the event is named CommissionFailed. No CompositionFailed event exists. CompositionCompleted is published as an extra event not in the spec.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engine supports concurrent composition requests.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ebmsDB.ts:22-23<br>src/routes/seu/web/objectives.ts:524</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: previewCommissioningValidation holds no shared state.<br>Gap: two requests for one SEU overwrite the single seus.composition_report, and both EBM inserts can read the same MAX(version) because nothing locks it.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition is fully auditable.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/web/objectives.ts:526-537<br>src/domain/engine/compositionCompleted.ts:105-116<br>src/dblayer/recovery/ebms_schema_recovery.sql:3-14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: CompositionCompleted and EBMCreated carry the actor and badge, and the EBM stores author_id and author_badge.<br>Gap: seven spec events are not published and a resolution records no actor or time.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Historical EBM versions are preserved.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ebmsDB.ts:19-44,52-60</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Rows are never deleted or rewritten. Each composition adds a version.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engine is independent of execution technologies.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:1-7<br>src/domain/engine/profileCompositionUnravel.ts:1-8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engine files depend on the DB layer and Template, Profile and Pack helpers only.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The implementation delivers the service, pipeline, dependency resolver, conflict detection, conflict resolution framework and EBM builder.<br>Ref: §20</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:163-261<br>src/domain/engine/profileCompositionUnravel.ts:77-102,294-372<br>src/routes/seu/core/commissioning.ts:464-507<br>src/domain/engine/compositionCompleted.ts:49-112</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: separate functions exist for dependency resolution, conflict detection, strategy application and EBM creation.<br>Gap: they are not one service or pipeline. compositionEngine.compose is unused in production and omits Platform Mandatory Packs, transitive dependencies and the pool.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The implementation delivers a validation service and a composition traceability service.<br>Ref: §20</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:366-381</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: the only validation is validateEbm, a liveness check. No service reads or reports the composition trace of an EBM.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The implementation delivers Composition APIs.<br>Ref: §20</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/api/seus.ts:28</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: src/routes/seu/api has no composition or EBM route. The only composition endpoints are the web routes in routes/seu/web/objectives.ts and routes/seu/web/seus.ts. The API commissioning route is commented out.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Mandatory Packs are resolved, behaviours compose, and every EBM is versioned and traceable to its source (acceptance criteria).<br>Ref: §19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">See rows for §9, §10, §13, §14 and FR-6.7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Behaviours compose and every EBM has a version. Mandatory Pack resolution and strategy and resolution traceability are partial as stated in the rows above.</td>
    </tr>
  </tbody>
</table>

## Summary

- Total intents analysed: 59
- ✅ Fully met: 21
- ⚠️ Partially met: 26
- ❌ Not met: 12
- ❓ Not verifiable: 0

### Major implementation gaps

- Resolved conflicts are saved as a map beside the pool. The pool and its readers still hold every conflicting entry.
- Conflicts are not classified as deterministic or non-deterministic, and none is resolved automatically.
- Traceability lacks the composition strategy per entry, and resolutions carry no strategy, actor or time (compositionReport.resolutions is always empty).
- Seven of the eleven spec events are never published and CompositionFailed is replaced by CommissionFailed.
- Validation checks only that references are live. Behavioural completeness, governance completeness, mandatory rules and terminology are not checked, and a missing mandatory Pack only warns.
- Recomposition is a full manual rebuild. It is not incremental, is not triggered by Pack or governance changes, and the previous EBM is not superseded. The version number is not protected by a unique key.
- Dependency handling follows every declared type, treats conditional as required, and flags a required Pack that the walk has already composed.
- compositionEngine.compose is not used in production, and the determinism test covers only that function. Policy and Quality Gate lookups have no ordering.
- Alias has no implementation, Override has no function, and new strategies need code changes.
- Terminology mappings and workflows do not exist as Pack contributions.
- There are no Composition APIs.
- Eligibility recomposes from live Packs at execution time instead of reading the EBM.
