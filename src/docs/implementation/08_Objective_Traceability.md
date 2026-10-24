# Implementation Traceability: Chapter 8 – Objective

**Date of report: 23-10-2026**

Specification: src/docs/SEU Studio Specifications/02_SEU Composition/08_Objective.md

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An Objective is a persistent, versioned statement of engineering intent that justifies an SEU.<br>Ref: §1, §4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/objectives_schema_recovery.sql:3-13<br>src/dblayer/recovery/objectives_schema_recovery.sql:22-23<br>src/dblayer/objectivesDB.ts:8-67</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The objectives table stores statement, tier, parent, status and a text version that starts at 1.0.0. Creation runs in one transaction with a display id.<br>The version patch number is bumped on statement or parent changes (objectivesDB.ts:224-257).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An Objective states why the SEU exists and holds no implementation detail.<br>Ref: §1, §4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/objectives_schema_recovery.sql:3-13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The table has no Template, Pack or Participant column. Implementation choice is held by the SEU row, not the Objective.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An Objective exists independently of any Template, Pack or Participant.<br>Ref: OBJ-005, §4, §15, §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/objectives_schema_recovery.sql:3-13<br>src/routes/seu/core/objectives.ts:50-113</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Objective creation takes a statement, tier, parent and capability codes. It takes no Template, Pack or Participant reference.<br>The Template choice is made later, on the SEU.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every SEU is commissioned in service of an Objective, and every commissioning request references one.<br>Ref: OBJ-001, FR-8.5, §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/seus_schema_recovery.sql:5<br>src/routes/seu/core/commissioning.ts:111-113<br>src/routes/seu/core/commissioning.ts:130-135</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>seus.objective_id is NOT NULL with a foreign key. initiateSeu refuses a request with no Objective.<br>A partial unique index allows one live SEU per Objective (seus_schema_recovery.sql:21-22).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An SEU is commissioned against a leaf Objective.<br>Ref: §7 remark</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:120-129<br>src/routes/seu/core/objectives.ts:179</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The Objective must be Active and have no children. The SEU can be commissioned only at a leaf.<br>Gap:<br>A Strategic Objective is refused even when it is a leaf. The remark says an SEU is commissioned against any leaf.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Objectives are persistent and independently addressable.<br>Ref: OBJ-002</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/objectives_schema_recovery.sql:4<br>src/dblayer/recovery/objectives_schema_recovery.sql:20<br>src/routes/seu/api/objectives.ts:72-81<br>src/dblayer/objectivesDB.ts:69-77</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Each Objective has a UUID and a display id. It is retrievable alone by API and by the web detail page. Rows are deleted only while Defined (objectives.ts:408-425).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Objective has a globally unique identifier.<br>Ref: FR-8.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/objectives_schema_recovery.sql:4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>id is a UUID primary key with gen_random_uuid().</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Objective declares its tier: Strategic, Operational or Engineering.<br>Ref: FR-8.2, §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/objectives_schema_recovery.sql:6-7<br>src/routes/seu/core/objectives.ts:58</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>tier is NOT NULL with a CHECK on the three values. The core defaults to Engineering when none is given.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Objectives decompose from Strategic through Operational to Engineering.<br>Ref: OBJ-004, FR-8.4, §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/objectives.ts:60-80<br>src/dblayer/recovery/objectives_schema_recovery.sql:14-18<br>src/routes/seu/web/objectives.ts:45-49</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A non-Strategic Objective requires a parent, enforced in the core and by a CHECK. A child cannot be more strategic than its parent.<br>The web form offers only lower tiers (CHILD_TIERS).<br>Gap:<br>The core and API check only that the child is not more strategic. A Strategic child of a Strategic parent and an Engineering child of an Engineering parent are accepted.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Decomposition may skip the Operational tier.<br>Ref: §9 broader scope</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/objectives.ts:71-73<br>src/routes/seu/web/objectives.ts:45-49</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Strategic may hold Engineering children directly. Only a child more strategic than the parent is refused.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Decomposition preserves traceability to the parent.<br>Ref: §9, §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/objectivesDB.ts:25-36<br>src/dblayer/objectivesDB.ts:206-222</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>parent_objective_id is stored. The child display id is the parent display id plus a sequence. findAncestorPath returns the chain to the root.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Decomposition has no depth limit.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/objectivesDB.ts:188-204<br>src/dblayer/objectivesDB.ts:206-222</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Descendant and ancestor lookups use recursive CTEs with no depth cap.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Objective declares one or more required Capabilities.<br>Ref: OBJ-003, FR-8.3, §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/objectives.ts:28-40<br>src/routes/seu/core/objectives.ts:95-98<br>src/routes/seu/api/objectives.ts:27-29<br>src/routes/seu/web/objectives.ts:211-215<br>src/dblayer/recovery/objectives_schema_recovery.sql:3-13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Capability codes are checked against the capability-name Ontology and stored in objective_capabilities. The API and web forms refuse an empty list.<br>Gap:<br>createObjective and the database accept zero capabilities. ensureOneShotContainer creates an Objective with an empty list (objectives.ts:119-124).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Required Capabilities may be derived by Capability Packs contributed by the platform, an Organisation, a Domain or a Customer.<br>Ref: §10, §15, FR-8.3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/objectives.ts:556-566</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>No code derives Objective capabilities from Packs. The only automated aid is suggestCapabilityCodes, which matches words of the statement against Ontology capability labels.<br>Pack-based derivation (deriveCapabilityCodesFromPackCodes in templates.ts:211) runs for Templates, not Objectives.<br>The multi-Pack composition of required Capabilities has no implementation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Given the same Objective and Pack set, the same required Capabilities are always derived.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/objectives.ts:556-566</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The suggestion is deterministic for a given statement and Ontology.<br>Gap:<br>It does not depend on a Pack set, and its output is not stored as derived.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Objective preserves its declared or derived required Capabilities.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/objectivesDB.ts:282-297<br>src/dblayer/objectivesDB.ts:328-339<br>src/dblayer/recovery/objective_capabilities_schema_recovery.sql:3-7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Codes are stored per Objective with author id and badge. They are read back for the detail view.<br>Gap:<br>The row has no field that says whether a capability was declared or derived. setRequiredCapabilities replaces the set with no history (objectivesDB.ts:299-315).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Required Capabilities are determined before commissioning and before Packs are composed.<br>Ref: §10, §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:111-135<br>src/routes/seu/core/commissioning.ts:44-49</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Creation forms require capabilities, and commissioning needs an Active Objective.<br>Gap:<br>initiateSeu and the liveness check test status, tier and children only. Neither reads objective_capabilities. An Active Objective with zero capabilities can be commissioned and composed.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Template Model evaluates Templates against the Objective&#x27;s required Capability list. The Objective does not evaluate suitability.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/templates.ts:34-52<br>src/routes/seu/core/objectives.ts:284-309</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>findCandidateTemplates compares the supplied codes with each Template's required capabilities and returns missing ones. The Objective supplies only the list.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Template is suitable only if it supports every required Capability, and commissioning does not proceed otherwise.<br>Ref: §11, §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/objectives.ts:287-308<br>src/routes/seu/core/commissioning.ts:408-415<br>src/routes/seu/core/commissioning.ts:111-135</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>commissionFromForm refuses when no Template satisfies every capability.<br>Gap:<br>The Objective detail page lists Templates that cover at least one capability (objectives.ts:290). initiateSeu does not compare Template capabilities with the Objective's, so a partial Template can be commissioned.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An Objective moves through Defined, Active, Achieved and Archived.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:291-321<br>src/dblayer/seed/data/transitionDefinitions.json:363-371</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Transition rows exist for None to Defined, Defined to Active, Active to Achieved and Achieved to Archived. Each carries an event type and a version event.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An Active Objective becomes Achieved.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:313-321<br>src/routes/seu/api/objectives.ts:133<br>src/domain/engine/entityTransition.ts:23-70</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The Active to Achieved row has trigger governed and the objective_achieve badge.<br>Gap:<br>transitionEntity does not check the trigger, so a holder of objective_achieve can apply the hop through the API route (transitionEntity at entityTransition.ts:23-70). Nothing fires it automatically, no rule evaluates achievement, and the web layer has no button because it lists only manual hops.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An Active Objective may be Superseded or Retired, preserving history.<br>Ref: §12, §13, §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:337-359<br>src/actions/supersedeObjective.ts:8-31<br>src/routes/seu/core/objectives.ts:427-458</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Supersede requires a comment, a successor in the same tenant and writes superseding_objective_id. Retire is a manual hop and may be applied to the Active subtree.<br>Rows are kept.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An Objective can be returned to the earlier state before Active for rework.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:325-335</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>The spec names a return to Proposed before Active. The code has Active to Reject, which has no outgoing transition.<br>No hop leaves Reject or enters it from Defined. Rejected Objectives cannot be reworked or archived.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Objective state changes are governed and fully traceable.<br>Ref: FR-8.6, §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:291-395<br>src/domain/engine/entityAdapters.ts:242-262<br>src/routes/seu/web/objectives.ts:392-418</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Every state change goes through transitionEntity with a policy, an actor and a badge. routeAuthority.json rows gate each verb route.<br>The adapter writes the status and the comment.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An Objective referenced by an active Deliverable stays immutable except through governed supersession.<br>Ref: FR-8.7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/objectives.ts:335-345<br>src/routes/seu/core/objectives.ts:362-369<br>src/routes/seu/core/objectives.ts:408-414</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Edit, move and delete are refused once the Objective leaves its initial state. Only Comments and the governed transitions remain.<br>Gap:<br>The freeze is applied in the core and not by the database. objectivesDB.update and updateParent have no status guard. The rule is not tied to Deliverables.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An Objective may be reviewed, reaffirmed or superseded without invalidating historical Deliverables, Decisions or Capabilities.<br>Ref: OBJ-006, §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:337-347<br>src/routes/seu/core/commissioning.ts:44-49</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Supersession keeps the old row and its link to the successor. Deliverable and Decision rows do not reference the Objective directly.<br>Gap:<br>No review or reaffirm transition exists. An in-flight SEU fails the liveness check once its Objective is no longer Active.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An Objective defines its Sponsoring Authority, and the originating sponsor is preserved.<br>Ref: §8, §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/objectives_schema_recovery.sql:21<br>src/dblayer/recovery/objectives_schema_recovery.sql:24-25<br>src/dblayer/objectivesDB.ts:25-50</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>sponsoring_authority holds the tenant, inherited from the parent. requested_by and author_badge record the creating actor.<br>Gap:<br>The sponsoring authority holds only a tenant id. No named sponsor or authority, and no way to set one, exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An Objective has a Status and a Version.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/objectives_schema_recovery.sql:9-10<br>src/dblayer/recovery/objectives_schema_recovery.sql:22-23<br>src/dblayer/objectivesDB.ts:240-270</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>status is a governed column. version is a semantic string that is patch-bumped by update and move.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Decomposition history of parent and child Objectives is preserved.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/objectivesDB.ts:118-129<br>src/dblayer/objectivesDB.ts:224-238</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Children and ancestors are queryable.<br>Gap:<br>Re-parenting overwrites parent_objective_id and bumps the version. The earlier parent is not recorded.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The referencing SEUs are preserved.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seusDB.ts:46-64<br>src/routes/seu/core/objectives.ts:281-283</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>seus.objective_id links each SEU to its Objective.<br>Gap:<br>findByObjectiveId returns only an SEU in a live lifecycle state, and the detail view shows one. Earlier SEUs of the Objective are not listed.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Objective records its referencing Deliverables and Decisions.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/views/seu/objectives/detail.ejs:57-64<br>src/dblayer/knowledgeItemsDB.ts:146-150</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>No Objective query or detail view lists Deliverables or Decisions. The only join from objectives into another object is the Knowledge Item list, which reads the Objective statement (knowledgeItemsDB.ts:146-150). No traceability service exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Deliverable, Decision and Capability requirement traces to an Objective.<br>Ref: §13, §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/deliverables_schema_recovery.sql:5<br>src/dblayer/recovery/decisions_schema_recovery.sql:5<br>src/dblayer/recovery/seus_schema_recovery.sql:5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Deliverable and Decision rows hold a NOT NULL seu_id, and every SEU holds a NOT NULL objective_id. The chain resolves by joins.<br>Gap:<br>No query or service walks it. Other object types were not checked.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Supersession history is preserved.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/objectivesDB.ts:259-280<br>src/routes/seu/web/objectives.ts:192-251</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The superseded row stores the successor id and the comment.<br>Gap:<br>The successor row stores no link to its predecessor. A reverse lookup has no query.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Objective subsystem publishes ObjectiveProposed, Activated, Rejected, Achieved, Superseded, Retired and Archived events.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:291-395<br>src/routes/seu/core/objectives.ts:100-111<br>src/domain/engine/entityTransition.ts:83-93</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Each hop declares an event type, and publishTransition emits it with actor and badge. Creation publishes the birth event.<br>Gap:<br>The creation event is named ObjectiveCreated, not ObjectiveProposed. The Objective event names are absent from the eventSubscriptions.json catalogue.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Objective domain model and registry.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/objectivesDB.ts:8-353<br>src/routes/seu/core/objectives.ts:205-223<br>src/routes/seu/core/objectives.ts:482-554</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The table, repository, list, tree, search and rejected-list queries exist with pagination.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Objective decomposition service.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/objectives.ts:50-113<br>src/routes/seu/core/objectives.ts:362-406<br>src/routes/seu/core/objectives.ts:460-480</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Create-under-parent, re-parent with cycle and tenant checks, and subtree retire exist.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Objective-to-Capability derivation service and Objective traceability service.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/objectives.ts:556-566</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>No Pack-driven derivation service and no traceability service exist. Only the keyword suggester and per-record reads are available.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Objective APIs.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/api/objectives.ts:21-137</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The API creates, lists, reads, updates and applies all six transitions.<br>Gap:<br>It has no route for children, move, delete, subtree retire or comments. Those exist only on the web router.</td>
    </tr>
  </tbody>
</table>

## Summary

- Total intents analysed: 38
- Fully met ✅: 17
- Partially met ⚠️: 17
- Not met ❌: 4
- Not verifiable ❓: 0

### Major implementation gaps

- Required Capabilities are never derived by Packs. Only declaration and a keyword suggester exist.
- Nothing requires an Objective to carry capabilities before commissioning, and no check compares the chosen Template with them.
- Rework is not possible. Active to Reject is terminal and no hop returns to the pre-Active state.
- Achieved has no trigger. Achievement is not evaluated.
- No traceability service. Objectives do not list Deliverables, Decisions or earlier SEUs, and re-parenting and supersession keep no reverse or prior link.
- The Strategic leaf cannot be commissioned, which differs from the "any leaf" remark.
- Immutability is applied in the core only, and the sponsoring authority is a tenant id.
- The creation event is ObjectiveCreated, not ObjectiveProposed. The API lacks several operations.
