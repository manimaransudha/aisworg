# Chapter 1 — Objective: Implementation Traceability

**Date of report: 4-10-2026**

---

**References**: 

`design/foundations/03_Book 3 (Refined)/01_Part 1/Chapter 1.md`
 

---

## Traceability Table

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">Objective is a persistent engineering-intent object justifying SEU commissioning<br> Ref: §1, §4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/migrations/002_seu_platform.sql:16-25; src/dblayer/objectivesDB.ts:33-89</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>objectives</code> table persists statement/tier/status/version<br><code>objectivesDB.create</code> writes it transactionally.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Objective exists independently of Template, Pack, Participant<br> Ref: §4, OBJ-005</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/migrations/002_seu_platform.sql:16-25</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No FK from <code>objectives</code> to templates/packs/participants<br>objective creation (objectivesDB.create) never references any of them.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❓</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Objective is not itself a Goal/Requirement/Strategy (conceptual distinction)<br> Ref: §4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No corresponding domain objects (Goal, Requirement, Strategy) exist in the schema<br>nothing contradicts the distinction.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Objective does not specify implementation. <br> Template/Pack/Participant determine it.<br> Ref: §3, §4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/objectives.ts:560-596</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>getObjectiveDetail</code> exposes Template/Profile candidates but never assigns one. <br>Selection happens in commissioning.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every SEU commissioned in service of at least one Objective<br> Ref: §5 OBJ-001, FR-1.5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/migrations/002_seu_platform.sql:164 (<code>objective_id UUID NOT NULL REFERENCES objectives(id)</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>seus.objective_id</code> is NOT NULL with FK<br>commissioning cannot create an SEU without a real Objective row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Objectives are persistent and independently traceable<br> Ref: §5 OBJ-002, §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/objectivesDB.ts:91-274<br>src/routes/seu/core/objectives.ts:238-345 (list/search/ancestor path)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Objectives persist independent of SEU lifecycle (no cascade delete from SEU)<br>Ancestor/descendant/search functions provide traceability.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Objective declares or allows derivation of required Capabilities<br> Ref: §5 OBJ-003, §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/objectives.ts:44-56, 144-156</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Only explicit declaration is implemented (<code>resolveRequiredCapabilities</code> validates codes against Ontology <code>capability-name</code> concepts).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Objectives are hierarchical (Strategic → Operational → Engineering)<br> Ref: §5 OBJ-004, §7, §9, FR-1.4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/objectives.ts:17, 78-141, 723-791<br>src/dblayer/migrations/037_objective_parent_required.sql</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>TIER_RANK</code> enforces a child's tier is never more strategic than its parent, both at create and re-parent<br>DB CHECK <code>objectives_parent_required_chk</code> backstops "only Strategic may be a root."</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Objectives may be reviewed/reaffirmed/superseded without invalidating historical Deliverables/Decisions/Capabilities<br> Ref: §5 OBJ-006, §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/objectives.ts:1009-1072<br>src/dblayer/migrations/007_trust_pipeline.sql:79-93</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>transitionObjective</code> only updates <code>objectives.status</code><br>it never touches <code>seus</code>, <code>deliverables</code>, or <code>decisions</code>, which reference the Objective (via <code>seu_id</code>) independently of its current status.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Objective has a globally unique identifier<br> Ref: §6 FR-1.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/migrations/002_seu_platform.sql:16-18 <br>(<code>id UUID PRIMARY KEY</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">UUID primary key. A separate human-facing <code>display_id</code> (hierarchical, e.g. "1.2.3") also exists (migration 121) but the UUID is the actual global identifier.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Objective declares its tier<br> Ref: §6 FR-1.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/migrations/002_seu_platform.sql:19-20<br>src/routes/seu/core/objectives.ts:75</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>tier</code> column NOT NULL-equivalent (defaulted to "Engineering" at create), constrained to the three values by the ObjectiveTier type and DB CHECK.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Esvery Objective declares, or supports derivation of, required Capabilities<br> Ref: §6 FR-1.3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/objectivesDB.ts:338-374<br>src/routes/seu/core/objectives.ts:44-56</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Declaration path only (see OBJ-003 gap above)<br>"supports automated derivation" is not implemented.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every SEU commissioning request references at least one Objective<br> Ref: §6 FR-1.5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/migrations/002_seu_platform.sql:164<br>src/routes/seu/core/objectives.ts:563<br>(commissioning gated on <code>objective.status === "Active"</code> etc.)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Enforced at the DB level (NOT NULL FK) and <br>at the application level (commissioning options only computed for a qualifying Objective).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Objective state changes are governed and fully traceable<br> Ref: §6 FR-1.6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/objectives.ts:1009-1072<br>src/domain/engine/transitionEngine.ts (evaluate)<br>src/domain/engine/eventBus.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every <code>transitionObjective</code> call runs through <code>transitionEngine.evaluate</code> and <br>publishes an event.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An Objective referenced by an active Deliverable remains immutable except through governed supersession<br> Ref: §6 FR-1.7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/objectives.ts:688-717 <br>(<code>updateObjective</code> throws unless <code>status === "Proposed"</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Free-text/Capability edits are blocked once an Objective leaves Proposed,<br> i.e. before it could ever be referenced by a Deliverable<br> (Deliverables require a commissioned, Active-Objective-derived SEU). <br>The rule is enforced by status-gating rather than by checking for referencing Deliverables directly, but the observable guarantee holds under the platform's own lifecycle ordering.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Objective tiers — Strategic org-level, spanning multiple SEUs<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/migrations/002_seu_platform.sql:164 <br>(<code>seus.objective_id</code> not unique across tiers<br>A partial-unique constraint on Active only)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Strategic (or Operational) Objective can be a parent to many descendants, each independently commissionable<br>nothing restricts a Strategic Objective to one SEU.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SEU may be commissioned against any leaf Objective<br> Ref: §7 Remarks</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/objectives.ts:265 (<code>commissionable: ... o.tier !== "Strategic" && isLeaf && o.status === "Active"</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Commissionability is computed from leaf-ness and Active status, not from tier being "Engineering" — matches the stated refinement.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§8 Objective structure<br> Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:21-48</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All listed fields are present on <code>ObjectiveRow</code>. <br>Required Capabilities are stored in a separate join table (<code>objective_capabilities</code>).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§9 Decomposition<br> Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/objectives.ts:78-141</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>createObjective</code> allows a child of any tier ≥ parent's rank. <br>This is broader than the strict single-level decomposition path, but does not violate the tier-rank ordering rule itself.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Decomposition preserves traceability to parent<br> Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/objectivesDB.ts:47-58 <br>(child's <code>sponsoring_authority</code>/display_id derived from parent)<br>src/routes/seu/core/objectives.ts:681-686 (<code>findAncestorPath</code> walk)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>parent_objective_id</code> is persisted and never cleared except via governed re-parent (<code>reParentObjective</code>), which itself preserves the link (just changes target).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❓</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Decomposition does not create new intent, only refines existing intent<br> Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No code enforces or contradicts this<br>it is a modeling/authoring discipline, not a mechanical constraint the system can check.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Composition Engine shall not compose Packs until required Capabilities are determined<br> Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/objectives.ts:563-596<br>templates.ts findCandidateTemplates</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Candidate Templates are only computed from <code>capabilityCodes</code> already resolved off the Objective.<br>Nothing composes Packs before this point in the commissioning flow</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Required Capabilities are the sole input Objective contributes to commissioning<br> Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/objectives.ts:560-596</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>getObjectiveDetail</code>'s commissioning-related output (<code>commissioningOptions</code>) is derived solely from <code>capabilityCodes</code><br>No other Objective field (statement, tier, etc.) feeds Template/Profile candidate selection.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Template Model validates/selects a Template against required Capabilities<br>Objective does not evaluate suitability itself<br> Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/objectives.ts:564 (<code>findCandidateTemplates(capabilityCodes, tenantId)</code>, delegated to templates.ts)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Objective code only supplies the capability list and displays the result.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Where no Template supports required Capabilities, commissioning shall not proceed<br> Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/objectives.ts:590-595</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">When <code>relevant</code> (candidate list) is empty, <code>commissioningOptions</code> is an empty array.<br>The actual SEU-creation refusal is in the commissioning path.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Lifecycle: Proposed → Active → Achieved → Archived<br> Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json (Objective rows)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All four states and edges exist as transition_definitions rows</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Active may transition to Superseded or Retired, preserving full historical traceability<br> Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json (Active→Superseded, Active→Retired rows)<br>src/routes/seu/core/objectives.ts:1009-1072</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Both edges exist and are governed the same way as other transitions. <br> Refer CR-116</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§12 An Objective can be returned to Proposed before Active, for rework<br> Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/objectives.ts:688-717 (<code>updateObjective</code> throws unless <code>status === "Proposed"</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">"Before Active" means the Objective has not yet left Proposed, not a transition back into it.<br> <code>updateObjective</code> permits edits any number of times while status remains Proposed, which is the rework path. <br>No Active→Proposed/Reject→Proposed transition exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Objective preserves: sponsor/Authority<br> Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:41-45 (<code>sponsoring_authority</code>)<br>src/dblayer/objectivesDB.ts:29-32, 44-72</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>sponsoring_authority</code> recorded at creation, inherited by children, immutable thereafter.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Objective preserves decomposition history (parent/child)<br> Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/objectivesDB.ts:150-274 <br>(<code>findChildren</code>, <code>findAncestorPath</code>, <code>findDescendantIds</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Full parent/child graph is queryable<br>re-parent (<code>reParentObjective</code>) changes only <code>parent_objective_id</code>, never erasing history since Objectives are never hard-deleted once decomposed/committed<br> <br>(delete is restricted to Proposed leaves only).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Objective preserves derived or declared required Capabilities<br> Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/objectivesDB.ts:336-374, 393-404</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>objective_capabilities</code> join table, append/replace via <code>addCapabilities</code>/<code>setRequiredCapabilities</code>, queryable via <code>getRequiredCapabilities</code>. Edits are further restricted to Proposed status only (updateObjective), so the set is effectively frozen once Active.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Objective preserves referencing SEUs<br> Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seusDB.ts:54-78, 153-168</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>seus.objective_id</code> FK plus helper queries (<code>findByObjectiveId</code>, <code>commissionedObjectiveSeuIds</code>) provide the reverse link.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Objective preserves referencing Deliverables and Decisions<br> Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/migrations/002_seu_platform.sql:216-228 (<code>deliverables.seu_id</code>)<br>src/dblayer/migrations/007_trust_pipeline.sql:79-93 (<code>decisions.seu_id</code>, <code>decisions.deliverable_id</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables and Decisions reference <code>seu_id</code>, not <code>objective_id</code> directly</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Objective preserves supersession history<br> Ref: §13, CR-116</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/objectives.ts:1009-1072<br>objective_comments table</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Queryable chain of Objective versions.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Deliverable/Decision/Capability requirement traceable to at least one Objective (root of Engineering Knowledge Graph)<br> Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Chain is enforced structurally: <code>seus.objective_id</code> NOT NULL, <code>deliverables.seu_id</code> NOT NULL, <code>decisions.seu_id</code>/<code>deliverable_id</code> NOT NULL — no Deliverable or Decision can exist without eventually resolving to an Objective.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Events: ObjectiveProposed<br> Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/triggerEngine.ts:27-42<br>src/routes/seu/core/objectives.ts:636-651 <br>(<code>submitObjective</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Published via <code>triggerEngine.submit</code></td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Events: ObjectiveActivated<br> Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json (Proposed→Active <code>eventType: "ObjectiveActivated"</code>)<br>src/routes/seu/core/objectives.ts:1060-1069</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Published by <code>transitionObjective</code> on the Proposed→Active transition.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Events: ObjectiveRejected<br> Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json (Active→Reject <code>eventType: "ObjectiveRejected"</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Published on Active→Reject, with the added CR-073 mandatory-new-comment rule (objectives.ts:1031-1045) not specified in Chapter 1 but not contradicting it either.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Events: ObjectiveAchieved, ObjectiveSuperseded, ObjectiveRetired, ObjectiveArchived<br> Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All four are wired as <code>eventType</code> on their respective transition_definitions rows and published via the same <code>transitionObjective</code> path.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Preserve complete historical traceability<br> Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/eventsDB.ts<br>src/routes/seu/core/objectives.ts (comments, events)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Events table + comments provide an append-only history<br>no code path deletes historical events or comments for a non-Proposed Objective.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Support hierarchical decomposition without depth limits<br> Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/objectivesDB.ts:33-89 (recursive <code>next_child_seq</code>), 238-274 (recursive CTEs)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>display_id</code> construction and ancestor/descendant queries use recursive CTEs / iterative parent-chasing with no hardcoded depth cap.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❓</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Reproducible: same Objective + Pack set always derives the same required Capabilities<br> Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Not applicable/not verifiable, since no derivation mechanism exists to test for reproducibility (required Capabilities are explicit user input, not derived).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables: Objective domain model<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:21-48</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>ObjectiveRow</code> type.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables: Objective registry<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/objectivesDB.ts (whole file)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">CRUD + query surface over <code>objectives</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables: Objective decomposition service<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/objectives.ts:78-141, 723-791</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>createObjective</code> (with parent) and <code>reParentObjective</code>.</td>
    </tr>
  </tbody>
</table>

-----

## Summary

- Total intents analysed: 45
- Fully met: 40
- Partially met: 2
- Not met: 0
- Not verifiable: 3

-----

## Major implementation gaps

1. **Capability derivation from Packs (§10, OBJ-003, FR-1.3, §15, §17)**: the specification's "derived by Capability Packs" path is not implemented; only explicit declaration exists. The code itself documents this as inherited from a real specification gap — Chapter 5's own Pack taxonomy never defines the derivation mechanism Chapter 1 references.
2. ~~**No successor linkage on supersession (§12, OBJ-006, §13)**: Superseded is a bare status change; there is no stored reference from a Superseded Objective to the "revised Objective" that replaces it, so that specific traceability the spec calls out is not queryable.~~ <mark>02-10-2026: CR-116 closed this one.</mark>
3. **Sponsor/authority** needs expansion based on how multi-tenancy is designed. 
4. Build the Engineering Knowledge Graph dashboard.

------

## Consider implementing

1. ObjectiveTier type should be Ontology driven instead of a check constraint. Allow tenant to define additional tiers and generalise. 
2. The decomposition check is TIER_RANK[tier] < TIER_RANK[parent.tier] → rejected. So, I can already have Strategic child under Strategic parent. The decomposition integrity is with the authority. <mark>[Remarks: Should this be stricter ?]</mark>
3. Should the reviewer be able to edit/add capabilities in addition to rejecting? This may violate separation of duties, but traceability still exists. 
