# Implementation Traceability: Chapter 14 – Deliverable Model

**Date of report: 23-10-2026**

Specification: src/docs/SEU Studio Specifications/02_SEU Composition/14_Deliverables.md

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Deliverable is a persistent engineering artefact owned by one SEU and created for each entry of the SEU&#x27;s Template Deliverable catalogue.<br>Ref: §1, §4, DM-003</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/deliverables_schema_recovery.sql:3-15<br>src/routes/seu/core/commissioning.ts:263-266<br>src/routes/seu/core/commissioning.ts:269-270<br>src/routes/seu/core/commissioning.ts:272-285<br>src/routes/seu/core/deliverables.ts:12-46<br>src/dblayer/deliverablesDB.ts:97-108</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The deliverables table holds one row per Deliverable with seu_id NOT NULL, name, lifecycle_state, producing_capability_id, created_at and updated_at.<br>Commissioning creates one row for each entry of the Template deliverable_catalogue, in the to-state of the Deliverable birth row.<br>createDeliverable adds a Deliverable whose name the Template catalogue declares and refuses a second Deliverable with the same name in the SEU.<br>A hop changes the row in place through updateLifecycleState. A search of src for DELETE FROM deliverables found no statement, so rows are not removed.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables are the primary execution objects. Commands and Work Items exist for Deliverables.<br>Ref: §1, §3, DM-001</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/deliverableKickoff.ts:101-129<br>src/domain/engine/deliverableKickoff.ts:161-191<br>src/domain/engine/workItemGenerator.ts:158-160<br>src/routes/seu/core/workItems.ts:29-33</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>executionEngine.execute has two call sites, both in deliverableKickoff, and both create a Command for a Deliverable (deliverableKickoff.ts:115, deliverableKickoff.ts:177).<br>The Work Item execution context is built only for a Command whose entity_type is Deliverable (workItemGenerator.ts:160).<br>Completing a Work Item refuses any other entity type with unsupported_entity_type (workItems.ts:31-33).<br>Every Command and Work Item that the runtime creates therefore hangs on a Deliverable.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Execution flows from the Objective through Deliverables, Dependencies, Capabilities and Participants to a Deliverable State Change.<br>Ref: §3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/seus_schema_recovery.sql:5-5<br>src/routes/seu/core/commissioning.ts:272-285<br>src/domain/engine/dependencyDefinitionEngine.ts:115-148<br>src/domain/engine/capabilityOnReady.ts:14-49<br>src/domain/engine/deliverableKickoff.ts:101-129<br>src/dblayer/seed/data/eventSubscriptions.json:48-68<br>src/routes/seu/core/workItems.ts:82-105</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The SEU row references one Objective (seus.objective_id).<br>Deliverables come from the Template catalogue. When the dependency rows for the In Progress hop are satisfied, DeliverableReady is published and capabilityOnReady requests fulfilment of the producing Capability.<br>The hop to In Progress creates a produce Command (deliverableKickoff.ts:101-129). The subscriptions turn a Command into a Work Item and dispatch it to a fulfilled Participant (eventSubscriptions.json:48-68). Completing the Work Item stores a deliverable_references row and completes the Command.<br>Gap:<br>Execution does not produce the final step of the chain. After the Work Item completes, the Deliverable stays In Progress until a person runs the manual Approve hop.<br>The Objective does not generate Deliverables. They come from the Template catalogue.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every engineering activity exists solely to advance one or more Deliverables.<br>Ref: §3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/web/seus.ts:431-441<br>src/routes/seu/web/seus.ts:514-531<br>src/routes/seu/web/seus.ts:588-601<br>src/routes/seu/web/seus.ts:383-395<br>src/routes/seu/web/seus.ts:642-653<br>src/routes/seu/core/workItems.ts:82-105<br>src/domain/engine/executionEngine.ts:162-167</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The SEU web routes for Evidence, Knowledge and Decisions reject a request with no Deliverable.<br>Work Item completion records a reference on the Deliverable, and the Approve hop refuses a Deliverable that has no attached reference (executionEngine.ts:162-167).<br>Gap:<br>Attention Items (seus.ts:383-395) and External Interactions (seus.ts:642-653) accept an empty Deliverable and are stored with null.<br>Completing a Work Item does not itself advance a Deliverable.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables evolve through states. A hop exists only where a Transition Definition names it.<br>Ref: §10, DM-002</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:98-103<br>src/domain/engine/executionEngine.ts:232-288<br>src/dblayer/seed/data/transitionDefinitions.json:247-289<br>src/dblayer/recovery/transition_definitions_schema_recovery.sql:3-10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>evaluateDeliverableTransition looks up the Transition Definition for (Deliverable, from, to) and returns no_transition_definition when none exists (executionEngine.ts:98-101).<br>The hop then records a governance outcome and a Command and updates lifecycle_state (executionEngine.ts:256-280).<br>Four Deliverable rows are seeded: None to Defined, Defined to In Progress, In Progress to Approved and Approved to Baselined (transitionDefinitions.json:247-289).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables own engineering history.<br>Ref: DM-004, §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:256-280<br>src/domain/engine/executionEngine.ts:290-303<br>src/routes/seu/core/workItems.ts:86-96<br>src/dblayer/eventsDB.ts:114-125<br>src/routes/seu/web/events.ts:15-19<br>src/routes/seu/core/traceability.ts:90-126<br>src/routes/seu/core/traceability.ts:161-172</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>History rows carry the Deliverable id: Commands and governance_evaluation_outcomes (executionEngine.ts:256-276), deliverable_references (workItems.ts:86-96), attestations (executionEngine.ts:290-303) and events (originating_object_id, eventsDB.ts:114-125).<br>explainDeliverable returns a provenance list built from deliverable_references and attestations, with the related Evidence, Decisions, Knowledge, Obligations, Reviews and Findings.<br>Gap:<br>The Deliverable does not hold its history as one record. The provenance list omits events, Commands and governance outcomes.<br>The Event Bus page filters by SEU, event type, entity type and name (events.ts:15-19), not by Deliverable id.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables are governed by the Engineering Behavior Model.<br>Ref: DM-005, §11, §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:16-21<br>src/domain/engine/qualityGateEngine.ts:52-62<br>src/domain/engine/policyEngine.ts:26-30<br>src/domain/engine/executionEngine.ts:109-153</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The Quality Gates evaluated for a Deliverable hop are those in the active EBM's applicable_quality_gate_ids (qualityGateEngine.ts:52-62).<br>Policies come from the EBM's applicable_policy_ids (policyEngine.ts:26-30).<br>Dependency rows are looked up in the scope of the SEU's Template, Profile and the Packs composed into the EBM (dependencyDefinitionEngine.ts:16-21).<br>The hop list itself is the platform-wide Transition Definition table. That point is rated in the Lifecycle rows.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables exist independently of Participants and are unaffected by Participant replacement.<br>Ref: DM-006, §4, §18, §19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/deliverables_schema_recovery.sql:3-15<br>src/dblayer/recovery/deliverables_schema_recovery.sql:18-20<br>src/routes/seu/core/commissioning.ts:267-267<br>src/routes/seu/core/participants.ts:91-146<br>src/routes/seu/core/capabilities.ts:185-217</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The deliverables table has no owner column and no Participant foreign key apart from author_id (deliverables_schema_recovery.sql:18-20), which records the SEU participant that created the row.<br>replaceParticipant (participants.ts:91-146) and releaseParticipants (capabilities.ts:185-217) change participants and capability_fulfilments only and write nothing to deliverables, and neither file references deliverablesDB.<br>A Deliverable survives replacement unchanged. Its author_id keeps pointing at the creating participant row, which is the SEU system participant for commissioned Deliverables.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Deliverable declares an Acquisition Scope that governs how broadly its Knowledge propagates.<br>Ref: DM-007, §4, §8, §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/deliverables_schema_recovery.sql:10-11<br>src/dblayer/deliverablesDB.ts:6-29<br>src/routes/seu/core/commissioning.ts:272-285<br>src/routes/seu/core/deliverables.ts:12-46<br>src/routes/seu/api/deliverables.ts:13-25<br>src/dblayer/seed/data/schemaDefinitions.json:73-116</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>acquisition_scope is NOT NULL with a CHECK on the four values and a default of SEU (deliverables_schema_recovery.sql:10-11). deliverablesDB.create defaults to SEU (deliverablesDB.ts:22).<br>Gap:<br>Nothing sets a value. Commissioning passes no scope (commissioning.ts:275-283). createDeliverable and its API route accept no scope (deliverables.ts:12, deliverables.ts:15-19). The Deliverable Definition grammar holds code, description and definitionVersion only (schemaDefinitions.json:73-116).<br>Every Deliverable therefore holds SEU, and a Deliverable cannot be declared Capability, Enterprise or Platform.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acquisition Scope takes one of SEU, Capability, Enterprise or Platform and defaults to SEU.<br>Ref: FR-14.8, §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/deliverables_schema_recovery.sql:10-11<br>src/dblayer/deliverablesDB.ts:19-22<br>src/dblayer/seuTypes.ts:456-468</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The CHECK constraint admits exactly the four values (deliverables_schema_recovery.sql:10-11).<br>The insert uses SEU when no value is passed (deliverablesDB.ts:22), and DeliverableRow types the column as AcquisitionScope (seuTypes.ts:464).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acquisition Scope is independent of Deliverable Category and of Deliverable ownership.<br>Ref: DM-007</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/deliverables_schema_recovery.sql:5-11<br>src/dblayer/deliverablesDB.ts:19-22</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>acquisition_scope is its own column with its own CHECK and default, apart from category and from seu_id (deliverables_schema_recovery.sql:5-11). The insert takes the three from separate inputs and derives none from another (deliverablesDB.ts:19-22).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Deliverable has a globally unique identifier.<br>Ref: FR-14.1, §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/deliverables_schema_recovery.sql:4-4<br>src/dblayer/deliverablesDB.ts:18-23</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>id is a UUID primary key with default gen_random_uuid() (deliverables_schema_recovery.sql:4). The insert does not supply an id, so the database generates it (deliverablesDB.ts:19-22).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Deliverable belongs to exactly one SEU.<br>Ref: FR-14.2, §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/deliverables_schema_recovery.sql:5-5<br>src/routes/seu/core/deliverables.ts:15-16<br>src/dblayer/deliverablesDB.ts:6-29<br>src/dblayer/deliverablesDB.ts:97-108</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>seu_id is NOT NULL and references seus(id) (deliverables_schema_recovery.sql:5). createDeliverable refuses an unknown SEU (deliverables.ts:15-16).<br>deliverablesDB has no function that changes seu_id (the only update is updateLifecycleState, deliverablesDB.ts:97-108), so the SEU never changes.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Deliverable maintains its lifecycle state.<br>Ref: FR-14.3, §8, §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/deliverables_schema_recovery.sql:8-8<br>src/routes/seu/core/deliverables.ts:30-31<br>src/routes/seu/core/commissioning.ts:269-270<br>src/routes/seu/core/commissioning.ts:280-280<br>src/dblayer/deliverablesDB.ts:97-108<br>src/domain/engine/executionEngine.ts:278-280</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>lifecycle_state is NOT NULL. A new row takes the to-state of the birth Transition Definition (deliverables.ts:30-31, commissioning.ts:269-280). The only writer afterwards is updateLifecycleState, called from the engine's governed hop (executionEngine.ts:278).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Deliverable defines measurable acceptance criteria.<br>Ref: FR-14.4, §4, §8, §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/deliverables_schema_recovery.sql:9-9<br>src/dblayer/seuTypes.ts:456-468<br>src/domain/engine/executionEngine.ts:162-167<br>src/domain/engine/qualityGateEngine.ts:100-153<br>src/dblayer/seed/data/schemaDefinitions.json:73-116</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>acceptance_criteria is a JSONB column that defaults to an empty array. A search of src for acceptance_criteria and acceptanceCriteria finds only the column and the DeliverableRow type, so no code writes or reads it.<br>No creation path (commissioning, createDeliverable, API) accepts criteria, and the Deliverable grammar has none.<br>The nearest mechanism is the set of Quality Gates and checks on a hop (open Obligations, accepted Evidence or approved Decision, accepted Review, active Policy, a reference for Approve). Those belong to the transition and to the EBM, and no Deliverable declares its own measurable criteria.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Deliverable participates in the Deliverable Dependency Graph and in dependency evaluation.<br>Ref: FR-14.5, §4, §8, §19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/materialiseDependencyGraph.ts:28-46<br>src/dblayer/recovery/dependency_definitions_schema_recovery.sql:3-26<br>src/domain/engine/dependencyDefinitionEngine.ts:84-111<br>src/routes/seu/core/seus.ts:328-346<br>src/routes/seu/core/traceability.ts:134-147<br>src/domain/engine/dependencyDefinitionEngine.ts:37-41<br>src/domain/engine/materialiseDependencyGraph.ts:47-50<br>src/dblayer/dependencyDefinitionsDB.ts:19-41<br>src/routes/seu/core/templates.ts:305-320<br>src/routes/seu/core/templates.ts:597-606</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Template dependencyGraph entries between two Deliverables are written as dependency_definitions rows. The gated state is In Progress and the required state defaults to Approved (materialiseDependencyGraph.ts:28-46).<br>isTargetReady evaluates the rows before a hop (dependencyDefinitionEngine.ts:99-111). The SEU detail and explainDeliverable list each row with its readiness.<br>Gap:<br>Rows are matched by Deliverable name, not by id (dependencyDefinitionEngine.ts:38-41).<br>A graph entry whose fromType is Capability is validated (templates.ts:313-316) but materialiseDependencyGraph writes no row for it (materialiseDependencyGraph.ts:28-48). The only INSERT INTO dependency_definitions is dependencyDefinitionsDB.create, and its only caller is materialiseDependencyGraph.ts:30. No Capability prerequisite therefore gates a Deliverable.<br>The owner CHECK allows Template, Pack and Profile (dependency_definitions_schema_recovery.sql:15-17), but only a Template owner is materialised (templates.ts:599).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Deliverable preserves complete engineering history.<br>Ref: FR-14.6, §8, §15, §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/deliverables.ts:30-44<br>src/routes/seu/core/commissioning.ts:272-285<br>src/dblayer/deliverablesDB.ts:97-108<br>src/domain/engine/executionEngine.ts:278-327</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Each hop leaves a governance outcome, a Command, a hop event and DeliverableTransitioned (executionEngine.ts:256-327). Work Item completion leaves a deliverable_references row (workItems.ts:86-96).<br>Gap:<br>A Deliverable created at commissioning has no birth event: the commissioning loop writes the row and publishes nothing (commissioning.ts:272-285). Only createDeliverable publishes the birth event (deliverables.ts:34-44).<br>The state is overwritten in place (deliverablesDB.ts:97-108), and deliverablesDB has no UPDATE other than updateLifecycleState, so no attribute of a Deliverable changes and no change record exists for one.<br>The hop writes the Command and outcome first, then updates the state, then evaluates dependencies, then writes the attestation and then publishes the events, without a transaction (executionEngine.ts:256-327). A failure after the state update leaves the state changed without its events.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable state transitions remain fully traceable. A transition never occurs without traceability.<br>Ref: FR-14.7, §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:256-280<br>src/domain/engine/executionEngine.ts:290-327<br>src/dblayer/deliverablesDB.ts:97-108<br>src/domain/engine/executionEngine.ts:103-105<br>src/domain/engine/badgeAuthorityEngine.ts:30-36</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>updateLifecycleState has one caller, executionEngine.ts:278 (search of src).<br>Before it the engine writes a governance_evaluation_outcomes row and a Command with requested_by, acting badge, from-state, to-state and correlation id (executionEngine.ts:256-276).<br>After it the engine writes an attestation for hops that require one (executionEngine.ts:290-303) and publishes the hop event and DeliverableTransitioned with the system actor and the resolved authority badge (executionEngine.ts:305-327).<br>A person without the required deliverable_ badge is refused before any write (badgeAuthorityEngine.ts:30-36).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Deliverable has a Category.<br>Ref: §7, §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/deliverables_schema_recovery.sql:16-16<br>src/routes/seu/core/commissioning.ts:272-285<br>src/routes/seu/core/deliverables.ts:12-13<br>src/routes/seu/core/ontology.ts:25-30<br>src/dblayer/seed/data/ontologyConcepts.json:705-712<br>src/routes/seu/api/deliverables.ts:13-25</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>category is a nullable TEXT column (deliverables_schema_recovery.sql:16). createDeliverable requires a category and checks it as an Ontology 'deliverable-name' concept (deliverables.ts:13, ontology.ts:25-26).<br>Gap:<br>Commissioning passes no category (commissioning.ts:275-283), so every Deliverable created from a Template has category NULL.<br>The illustrative categories Analysis, Design, Construction, Validation, Deployment and Knowledge are not an Ontology concept type. ontologyConcepts.json has a deliverable-name type with 189 names such as Requirements Specification and no deliverable category type. The API therefore checks a category against the list of Deliverable names.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">New Deliverable categories may be introduced through Packs.<br>Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:84-105<br>src/routes/seu/core/packs.ts:37-46<br>src/routes/seu/core/ontology.ts:322-324</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>PackContributions lists capabilities, services, authorityRules, policies, qualityGates, checklists, reviewGates, obligationDefinitions, engineeringCapital and competencies (seuTypes.ts:84-105). It has no Deliverable or category kind.<br>New Deliverable names are authored as Deliverable Definitions in the SDK, and the Ontology refuses a direct add of a deliverable-name concept (ontology.ts:322-324). A Pack reaches a Deliverable name only through a Service Definition's outputs (packs.ts:37-46).<br>No path introduces a Deliverable category through a Pack.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Deliverable has a Name.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/deliverables_schema_recovery.sql:6-6<br>src/routes/seu/core/commissioning.ts:272-278<br>src/routes/seu/core/deliverables.ts:20-27</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>name is NOT NULL. Commissioning stores the Ontology label of the catalogue code (commissioning.ts:274), and createDeliverable stores a name that equals a catalogue label and is unique in the SEU by a code check (deliverables.ts:20-27).<br>The table has no unique constraint on (seu_id, name), and the engines resolve a Deliverable by name (dependencyDefinitionEngine.ts:38-41).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Deliverable has a Description.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/deliverables_schema_recovery.sql:3-15<br>src/dblayer/seuTypes.ts:456-468<br>src/dblayer/seed/data/schemaDefinitions.json:73-116<br>src/routes/seu/core/commissioning.ts:272-285</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>The deliverables table and DeliverableRow have no description column.<br>The description authored on a Deliverable Definition (schemaDefinitions.json:73-116) is not copied when commissioning creates the Deliverable (commissioning.ts:275-283 passes name, code and producing Capability only).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Deliverable records its Producing Capabilities.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/deliverables_schema_recovery.sql:12-12<br>src/routes/seu/core/commissioning.ts:253-262<br>src/domain/engine/capabilityOnReady.ts:32-32<br>src/domain/engine/executionEngine.ts:132-135<br>src/domain/engine/deliverableKickoff.ts:112-128</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>One producing_capability_id is derived at commissioning from the Active Service Definition outputs of each required Capability (commissioning.ts:253-262). It selects the Capability that is requested, dispatched and read by Policy conditions (commissioning.ts:253-262, executionEngine.ts:132-135, deliverableKickoff.ts:112-128).<br>Gap:<br>The spec names Capabilities in the plural and the schema holds one. When several Capabilities list the same output, the first one wins (commissioning.ts:258-260) and the others are not recorded.<br>A Deliverable added by createDeliverable gets no producing Capability (deliverables.ts:31).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Deliverable records its Consuming Capabilities.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/deliverables_schema_recovery.sql:3-15<br>src/dblayer/seuTypes.ts:183-205<br>src/views/seu/service-definitions/index.ejs:92-93<br>src/routes/seu/core/commissioning.ts:253-262</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>The deliverables table has no consuming Capability attribute.<br>ServiceDefinitionRow declares inputs and consumers (seuTypes.ts:189-195). A search of src shows consumers authored in the SDK, stored by serviceDefinitionsDB and printed on the Service Definition registry page (index.ejs:92-93). No runtime code relates it to a Deliverable.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Deliverable holds references to its Knowledge.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/knowledge_items_schema_recovery.sql:6-6<br>src/routes/seu/core/knowledge.ts:39-41<br>src/routes/seu/core/traceability.ts:98-98<br>src/routes/seu/core/traceability.ts:168-168<br>src/domain/engine/workItemGenerator.ts:99-99<br>src/domain/engine/workItemGenerator.ts:136-136</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>knowledge_items.deliverable_id is NOT NULL and references deliverables(id) (knowledge_items_schema_recovery.sql:6). createKnowledgeItem rejects a Deliverable that belongs to another SEU (knowledge.ts:39-41).<br>explainDeliverable lists the Knowledge of a Deliverable (traceability.ts:98, traceability.ts:168) and the Work Item execution context carries it (workItemGenerator.ts:99, workItemGenerator.ts:136).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Deliverable holds references to its Evidence.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/evidence_relationships_schema_recovery.sql:3-9<br>src/routes/seu/core/traceability.ts:95-95<br>src/routes/seu/core/traceability.ts:166-166<br>src/routes/seu/web/seus.ts:431-441<br>src/routes/seu/web/seus.ts:491-500</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Evidence links to a Deliverable through an evidence_relationships row of type Deliverable (evidence_relationships_schema_recovery.sql:3-9). The web routes create Evidence for a Deliverable and link existing Evidence to one (seus.ts:431-441, seus.ts:491-500).<br>explainDeliverable lists the linked Evidence (traceability.ts:95, traceability.ts:166).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Evidence and Decisions a Deliverable produces propagate according to its Acquisition Scope.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/deliverables_schema_recovery.sql:10-11<br>src/dblayer/recovery/knowledge_items_schema_recovery.sql:11-12<br>src/dblayer/recovery/evidence_schema_recovery.sql:3-40<br>src/dblayer/recovery/decisions_schema_recovery.sql:3-38</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>A search of the recovery SQL for acquisition_scope finds only the deliverables and knowledge_items tables.<br>The evidence and decisions tables carry no scope, so no code can propagate them. Only Knowledge has a scope.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SEU scope keeps the Knowledge within the originating SEU.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/knowledgeItemsDB.ts:152-152<br>src/routes/seu/core/knowledge.ts:83-86</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The Engineering Capital query excludes scope SEU (knowledgeItemsDB.ts:152).<br>A Knowledge Item of scope SEU is read only for its own SEU (knowledge.ts:83-86). Nothing reads it for another SEU.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capability scope propagates Knowledge to any SEU in the same Tenant that fulfils the same Capability.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/knowledgeItemsDB.ts:143-163<br>src/domain/engine/metricRegistryEngine.ts:96-101<br>src/domain/engine/workItemGenerator.ts:96-101<br>src/domain/engine/dependencyDefinitionEngine.ts:74-80<br>src/routes/seu/core/knowledge.ts:197-200</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>Knowledge of scope Capability appears only in the Engineering Capital listing (knowledgeItemsDB.ts:143-163, knowledge.ts:197-200) and in the scope counts of the metric registry (metricRegistryEngine.ts:96-101). The listing query has no Capability condition and no Tenant condition.<br>No code selects the Knowledge of another SEU by a shared Capability. The Work Item context reads only the Knowledge of the Deliverable itself (workItemGenerator.ts:99), and the dependency engine reads the same set (dependencyDefinitionEngine.ts:76).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Enterprise scope propagates Knowledge to every SEU in the same Tenant.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/knowledgeItemsDB.ts:143-163<br>src/domain/engine/workItemGenerator.ts:96-101<br>src/domain/engine/dependencyDefinitionEngine.ts:74-80<br>src/routes/seu/core/knowledge.ts:197-200</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>Knowledge of scope Enterprise is returned by the Engineering Capital listing and counted by scope, and nothing more (knowledgeItemsDB.ts:143-163, knowledge.ts:197-200).<br>No SEU receives it. The Work Item context and the dependency engine read the Knowledge of the Deliverable's own set only (workItemGenerator.ts:99, dependencyDefinitionEngine.ts:76).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Platform scope marks Knowledge as a candidate for a Platform Pack, does not cross Tenants by itself, and goes through governed Pack publication.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:801-808<br>src/routes/seu/core/knowledge.ts:164-168<br>src/routes/seu/core/knowledge.ts:178-192<br>src/dblayer/knowledgeItemsDB.ts:143-163<br>src/routes/seu/web/knowledge.ts:15-21<br>src/routes/seu/api/knowledge.ts:89-96<br>src/dblayer/seed/data/routeAuthority.json:186-191<br>src/dblayer/seed/data/routeAuthority.json:1104-1109</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Promotion to Platform is a KnowledgeScope hop (Enterprise to Platform). It does not copy the item to another Tenant, and it raises an Organisational Learning Obligation on the originating Deliverable that asks for the understanding to be codified (knowledge.ts:178-192).<br>Gap:<br>The Obligation is not connected to the Pack publication path. No field or flag marks the item as a Pack candidate.<br>The Engineering Capital page and API list every Tenant's Capability, Enterprise and Platform items. The query joins seus and objectives and has no Tenant condition (knowledgeItemsDB.ts:143-163). The routes pass no Tenant filter (knowledge.ts:15-21, knowledge.ts:89-96) and the route_authority rows for the page and the API hold no badge or role (routeAuthority.json:186-191, routeAuthority.json:1104-1109). One Tenant's Knowledge is therefore visible to a user of another Tenant.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capability, Enterprise and Platform scope together are Engineering Capital. SEU scope is not.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/knowledgeItemsDB.ts:143-163<br>src/routes/seu/core/knowledge.ts:197-200<br>src/routes/seu/web/knowledge.ts:15-21</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>findEngineeringCapital selects Knowledge Items with acquisition_scope other than SEU and orders Platform, Enterprise, Capability (knowledgeItemsDB.ts:152-156). The core function and the web and API routes return that set (knowledge.ts:197-200, knowledge.ts:15-21).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acquisition Scope may be promoted after the fact on the Knowledge a Deliverable produced.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/knowledge.ts:137-195<br>src/dblayer/seed/data/transitionDefinitions.json:785-808<br>src/dblayer/knowledgeItemsDB.ts:87-100</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>promoteKnowledgeItemScope requires the Knowledge Item to be Published, evaluates the KnowledgeScope Transition Definition (one tier at a time: SEU, Capability, Enterprise, Platform) with badge, Policy and Quality Gate checks, updates acquisition_scope, publishes KnowledgeScopePromoted and raises the codification Obligation.<br>The Deliverable's own scope is left unchanged, as the spec describes.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The default Deliverable lifecycle is Defined, Planned, In Progress, Under Review, Approved, Baselined, Superseded, Archived.<br>Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:247-289<br>src/dblayer/seed/data/transitionDefinitions.json:1133-1135<br>src/dblayer/seed/seedTransitionDefinitions.ts:156-156</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Four states are seeded for a Deliverable: Defined, In Progress, Approved and Baselined (transitionDefinitions.json:247-289).<br>Defined to In Progress is a governed hop. Approved and Baselined default to the manual trigger (seedTransitionDefinitions.ts:156).<br>Gap:<br>Planned, Under Review, Superseded and Archived have no Deliverable Transition Definition. Planned at transitionDefinitions.json:1133-1135 belongs to the Review entity. The lifecycle stops at Baselined.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Engineering Behavior Model may define additional lifecycle states.<br>Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/deliverables_schema_recovery.sql:8-8<br>src/dblayer/recovery/transition_definitions_schema_recovery.sql:3-10<br>src/dblayer/recovery/ebms_schema_recovery.sql:3-22<br>src/domain/engine/dependencyDefinitionEngine.ts:23-35</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>lifecycle_state is free TEXT with no CHECK (deliverables_schema_recovery.sql:8). Transition Definitions are rows keyed by (entity_type, from_state, to_state) (transition_definitions_schema_recovery.sql:3-10), and the dependency engine follows whatever rows exist (dependencyDefinitionEngine.ts:23-35). A new state can therefore be added as data.<br>Gap:<br>The table is platform-wide. The ebms table holds composed Packs, gate ids, Policy ids and a behaviors pool and no Transition Definition data (ebms_schema_recovery.sql:3-22), so an EBM cannot define a state for its own SEUs.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Deliverable moves from Defined to Planned.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:247-289</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>No Transition Definition named Defined to Planned exists for a Deliverable. The seeded rows leave Defined only for In Progress (transitionDefinitions.json:257-267).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Deliverable moves from Planned to In Progress.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:257-267<br>src/domain/engine/deliverableKickoff.ts:18-49<br>src/dblayer/seed/data/eventSubscriptions.json:48-68<br>src/domain/engine/executionEngine.ts:52-70</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The hop Defined to In Progress exists with trigger governed and event DeliverableUpdated. The kickoff handler attempts every governed hop when dependencies are met, on SEUOperational, DeliverableTransitioned, CapabilityFulfilled, resolved Obligations and Attention Items (deliverableKickoff.ts:18-49, executionEngine.ts:52-70).<br>Gap:<br>The start of work is Defined to In Progress. There is no Planned state before it.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Deliverable moves from In Progress to Under Review.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:268-278<br>src/domain/engine/qualityGateEngine.ts:126-137<br>src/routes/seu/core/traceability.ts:99-99</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>No Under Review state or hop exists. In Progress leaves only for Approved (transitionDefinitions.json:268-278).<br>A Review can be raised for a Deliverable and a Quality Gate can require an Accepted Review before Approve (qualityGateEngine.ts:126-137), but the Deliverable shows no review state.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Deliverable moves from Under Review to Approved.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:268-278<br>src/domain/engine/executionEngine.ts:103-105<br>src/domain/engine/executionEngine.ts:109-153<br>src/domain/engine/executionEngine.ts:162-167<br>src/domain/engine/executionEngine.ts:290-303</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>In Progress to Approved exists with verb approve, event DeliverableApproved and an attestation requirement. The engine requires the deliverable_approve badge, a Quality Gate and Policy pass, and an attached reference (executionEngine.ts:103-105, executionEngine.ts:162-167, executionEngine.ts:290-303).<br>Gap:<br>The hop starts from In Progress because the Under Review state does not exist.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Deliverable moves from Approved to Baselined.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:279-289<br>src/domain/engine/executionEngine.ts:98-105<br>src/domain/engine/executionEngine.ts:290-303</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Approved to Baselined exists with verb baseline, event DeliverableBaselined, the baseline Policy and an attestation requirement (transitionDefinitions.json:279-289). The engine resolves the deliverable_baseline badge and records an attestation (executionEngine.ts:98-105, executionEngine.ts:290-303).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables may relate to one another through dependency.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/materialiseDependencyGraph.ts:28-46<br>src/domain/engine/dependencyDefinitionEngine.ts:84-111<br>src/domain/engine/executionEngine.ts:55-70<br>src/routes/seu/core/seus.ts:334-346<br>src/routes/seu/core/traceability.ts:175-224</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A dependency edge between two Deliverables is stored, evaluated before the target hop, reported as Satisfied or Pending in the SEU detail, and traversed downstream by impactOfDeliverable (traceability.ts:175-224). An unmet edge publishes DeliverableBlocked (executionEngine.ts:55-70).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables may relate through derivation.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/dependency_definitions_schema_recovery.sql:18-23<br>src/dblayer/seed/data/schemaDefinitions.json:2171-2181<br>src/domain/engine/materialiseDependencyGraph.ts:39-39<br>src/domain/engine/dependencyDefinitionEngine.ts:84-111</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>relationship_kind accepts derivation and is stored from the Template graph entry (dependency_definitions_schema_recovery.sql:18-23, materialiseDependencyGraph.ts:39). The grammar help calls it freely editable on inheritance (schemaDefinitions.json:2171-2181).<br>Gap:<br>isRowSatisfied and isTargetReady never read relationship_kind (dependencyDefinitionEngine.ts:84-111). A derivation edge blocks its target exactly like a dependency edge, so it carries no semantics of its own.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables may relate through refinement.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:131-131<br>src/dblayer/recovery/dependency_definitions_schema_recovery.sql:21-23</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>The relationship kinds are dependency, derivation, implementation and decomposition (seuTypes.ts:131, dependency_definitions_schema_recovery.sql:21-23, schemaDefinitions.json:2171-2181). Refinement is not among them and no other table relates two Deliverables.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables may relate through validation.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:131-131<br>src/dblayer/recovery/dependency_definitions_schema_recovery.sql:21-23</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>Validation is not a relationship kind (seuTypes.ts:131, dependency_definitions_schema_recovery.sql:21-23). A Review or Evidence item can be attached to a Deliverable, but no edge states that one Deliverable validates another.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables may relate through implementation.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/dependency_definitions_schema_recovery.sql:18-23<br>src/routes/seu/core/templates.ts:358-382<br>src/domain/engine/dependencyDefinitionEngine.ts:84-111</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>implementation is stored as a relationship kind (dependency_definitions_schema_recovery.sql:18-23). Template inheritance keeps a parent's implementation edge unchanged (templates.ts:358-382).<br>Gap:<br>The engine does not read the kind (dependencyDefinitionEngine.ts:84-111), so an implementation edge gates its target like a dependency and has no implementation semantics.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables may relate through supersession.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:131-131<br>src/dblayer/recovery/dependency_definitions_schema_recovery.sql:21-23<br>src/dblayer/seed/data/transitionDefinitions.json:336-349<br>src/dblayer/seed/data/transitionDefinitions.json:766-775<br>src/dblayer/recovery/decisions_schema_recovery.sql:29-29</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>Supersession is not a relationship kind between Deliverables (seuTypes.ts:131, dependency_definitions_schema_recovery.sql:21-23). Objectives and Decisions have a Superseded hop (transitionDefinitions.json:336-349, transitionDefinitions.json:766-775) and a Decision records superseded_by (decisions_schema_recovery.sql:29). A Deliverable has neither.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables may relate through decomposition.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/dependency_definitions_schema_recovery.sql:18-23<br>src/routes/seu/core/templates.ts:358-382<br>src/domain/engine/dependencyDefinitionEngine.ts:84-111</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>decomposition is stored as a relationship kind and is kept unchanged on Template inheritance (dependency_definitions_schema_recovery.sql:18-23, templates.ts:358-382).<br>Gap:<br>No code reads the kind in evaluation (dependencyDefinitionEngine.ts:84-111). A decomposed parent does not derive its state from its parts, and the edge gates like a dependency.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Relationship semantics are explicitly defined.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/schemaDefinitions.json:2171-2181<br>src/routes/seu/core/templates.ts:358-382<br>src/domain/engine/dependencyDefinitionEngine.ts:84-111</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The grammar help defines how each kind behaves on Template inheritance: implementation and decomposition are locked, derivation is editable and dependency is unrestricted (schemaDefinitions.json:2171-2181, templates.ts:358-382).<br>Gap:<br>No definition states what any kind means for evaluation. The engine treats all four alike (dependencyDefinitionEngine.ts:84-111).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables are owned by the SEU.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/deliverables_schema_recovery.sql:5-5<br>src/routes/seu/core/deliverables.ts:12-46<br>src/routes/seu/core/commissioning.ts:272-285</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The only owner reference is seu_id. Both creation paths set it to the SEU that holds the Deliverable (deliverables.ts:31, commissioning.ts:276).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants contribute to Deliverables and never own them.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/deliverable_references_schema_recovery.sql:3-13<br>src/routes/seu/core/workItems.ts:86-96<br>src/dblayer/recovery/deliverables_schema_recovery.sql:3-15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A Participant's contribution is a deliverable_references row with the Participant id and the produced reference (deliverable_references_schema_recovery.sql:8, workItems.ts:86-96).<br>No column on deliverables names a Participant as owner. author_id is the creating participant, kept for authorship.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capability fulfilment may change and Deliverable ownership does not.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:91-146<br>src/routes/seu/core/capabilities.ts:185-217<br>src/dblayer/deliverablesDB.ts:97-108</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>replaceParticipant and releaseParticipants revoke and create capability_fulfilments and change Participant states only (participants.ts:91-146, capabilities.ts:185-217). No path updates deliverables.seu_id (deliverablesDB.ts:97-108).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance may require engineering review.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/qualityGateEngine.ts:126-137<br>src/domain/engine/executionEngine.ts:109-130<br>src/routes/seu/core/traceability.ts:99-99</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A Quality Gate with criteria requires_accepted_review blocks the hop unless an Accepted Review with a passing outcome exists for the Deliverable against the named Review Gate (qualityGateEngine.ts:126-137). The engine evaluates the gates of the EBM on every Deliverable hop (executionEngine.ts:109-130).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance may require evidence.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/qualityGateEngine.ts:20-21<br>src/domain/engine/qualityGateEngine.ts:111-124<br>src/domain/engine/executionEngine.ts:109-130</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>requires_accepted_evidence_or_approved_decision blocks unless Accepted or Referenced Evidence of the gate's category, or an Approved or Applied Decision, is linked to the Deliverable (qualityGateEngine.ts:111-124).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance may require obligations resolved.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/qualityGateEngine.ts:16-16<br>src/domain/engine/qualityGateEngine.ts:100-109<br>src/domain/engine/executionEngine.ts:72-82<br>src/domain/engine/deliverableKickoff.ts:21-24<br>src/domain/engine/deliverableKickoff.ts:39-49</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The no_unresolved_obligations gate blocks while an Obligation on the Deliverable is not Verified, Closed or Archived (qualityGateEngine.ts:100-109). The engine also refuses a hop while an Obligation that blocks that hop is open, on the Deliverable or on its SEU (executionEngine.ts:72-82). A resolved Obligation re-triggers the governed hops (deliverableKickoff.ts:21-24).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance may require approval.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:84-89<br>src/domain/engine/executionEngine.ts:103-105<br>src/domain/engine/executionEngine.ts:290-303<br>src/domain/engine/badgeAuthorityEngine.ts:30-36</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A Decision linked to the Deliverable that is not yet Approved blocks the hop (executionEngine.ts:84-89). The Approve and Baseline hops need the deliverable_approve and deliverable_baseline badge (executionEngine.ts:103-105, badgeAuthorityEngine.ts:30-36) and record an attestation (executionEngine.ts:290-303).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance may require automated validation.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/qualityGateEngine.ts:139-155<br>src/dblayer/seuTypes.ts:66-75<br>src/domain/engine/qualityGateEngine.ts:111-124<br>src/routes/seu/api/evidence.ts:12-24</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A Quality Gate can require an active Policy whose condition holds for the entity (qualityGateEngine.ts:139-155), and automated results can enter as Evidence that a gate then requires (qualityGateEngine.ts:111-124).<br>Gap:<br>The platform runs no validator. The machine-verifiable classification on checklist items is metadata (seuTypes.ts:66-75) and a search of src for machine-verifiable finds only that type and a form help text. Automated validation reaches a Deliverable only when an outside tool posts Evidence.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance criteria are governed by the Engineering Behavior Model.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/qualityGateEngine.ts:52-62<br>src/domain/engine/policyEngine.ts:26-30<br>src/domain/engine/executionEngine.ts:109-153</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The gates and Policies that decide acceptance of a hop are those composed into the EBM (qualityGateEngine.ts:52-62, policyEngine.ts:26-30, executionEngine.ts:109-153).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evolution preserves traceability.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:82-173<br>src/routes/seu/core/traceability.ts:175-224<br>src/domain/engine/executionEngine.ts:256-276<br>src/domain/engine/executionEngine.ts:278-303</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Every hop is recorded (executionEngine.ts:256-276). explainDeliverable and impactOfDeliverable answer provenance and downstream-impact queries and publish TraceabilityQueryExecuted (traceability.ts:82-224). The hops leave the Decision, Evidence, Knowledge and Obligation rows untouched.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evolution preserves decision history.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/decisions_schema_recovery.sql:19-29<br>src/dblayer/decisionsDB.ts:89-96<br>src/routes/seu/core/traceability.ts:96-96<br>src/routes/seu/core/traceability.ts:167-167</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A Decision is linked to the Deliverable by a related-object row and keeps its row through every Deliverable hop. A superseded Decision keeps its row with superseded_by set (decisionsDB.ts:89-96). A search of src found no DELETE FROM decisions. explainDeliverable lists the Decisions (traceability.ts:96, traceability.ts:167).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evolution preserves evidence.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/evidenceDB.ts:111-123<br>src/routes/seu/core/traceability.ts:95-95<br>src/routes/seu/core/traceability.ts:166-166</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Evidence linked to the Deliverable keeps its row and links through every hop. Superseded Evidence is found through findSupersededBy (evidenceDB.ts:111-123). A search of src found no DELETE FROM evidence. explainDeliverable lists it (traceability.ts:95, traceability.ts:166).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evolution preserves superseded versions of a Deliverable.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/deliverables_schema_recovery.sql:3-15<br>src/dblayer/deliverablesDB.ts:97-108<br>src/dblayer/seed/data/transitionDefinitions.json:247-289</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>A Deliverable has no version attribute and no Superseded state. A hop overwrites lifecycle_state in place (deliverablesDB.ts:97-108) and the table keeps no earlier copy. The seeded hops end at Baselined (transitionDefinitions.json:247-289).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Historical versions of a Deliverable remain accessible.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/deliverables_schema_recovery.sql:3-15<br>src/routes/seu/core/versionEvents.ts:18-21<br>src/domain/engine/executionEngine.ts:305-327</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>No store or query returns an earlier version of a Deliverable. getVersionReplay reads version_events (versionEvents.ts:18-21), but Deliverable hops publish no versionEvent (executionEngine.ts:305-327), so the replay holds no Deliverable rows. The deliverable_references and attestations rows record the hops and not earlier content.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A completed execution triggers a Deliverable state transition.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/workItems.ts:82-105<br>src/domain/engine/deliverableKickoff.ts:101-129<br>src/dblayer/seed/data/transitionDefinitions.json:268-278<br>src/domain/engine/executionEngine.ts:162-167</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Completing a Work Item stores the produced reference on the Deliverable and completes the Command (workItems.ts:86-105). The reference is the precondition of the Approve hop (executionEngine.ts:162-167).<br>Gap:<br>Completion triggers no hop. WorkItemCompleted has no subscriber (eventSubscriptions.json:48-68) and Approve is a manual hop (transitionDefinitions.json:268-278), so a person must run it.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An accepted Decision triggers a Deliverable state transition.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:84-89<br>src/domain/engine/qualityGateEngine.ts:111-124<br>src/dblayer/seed/data/eventSubscriptions.json:48-68</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>An Approved Decision is a condition of a hop. An open Decision blocks it (executionEngine.ts:84-89), and a Quality Gate can require an Approved Decision (qualityGateEngine.ts:111-124).<br>Gap:<br>Approving a Decision starts no hop. No subscriber consumes the Decision events (eventSubscriptions.json:48-68), so the Deliverable moves only when a person or the governed Defined to In Progress hop runs.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Approved Evidence triggers a Deliverable state transition.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/qualityGateEngine.ts:111-124<br>src/dblayer/seed/data/eventSubscriptions.json:48-68</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Accepted Evidence satisfies a Quality Gate on the hop (qualityGateEngine.ts:111-124).<br>Gap:<br>Accepting Evidence starts no hop. The subscriptions hold no Evidence handler for Deliverables (eventSubscriptions.json:48-68).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Resolved Obligations trigger a Deliverable state transition.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/deliverableKickoff.ts:21-24<br>src/domain/engine/deliverableKickoff.ts:39-49<br>src/domain/engine/deliverableKickoff.ts:51-56<br>src/dblayer/seed/data/transitionDefinitions.json:257-267</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A resolved Obligation or Attention Item makes deliverableKickoff run every governed next hop of every Deliverable of the SEU and re-issue a held produce Command (deliverableKickoff.ts:21-56).<br>Gap:<br>Only the hop Defined to In Progress is governed in the seed (transitionDefinitions.json:257-267). Approve and Baseline stay manual, so a resolved Obligation never advances a Deliverable past In Progress.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Dependency satisfaction triggers a Deliverable state transition.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:115-148<br>src/domain/engine/executionEngine.ts:282-288<br>src/domain/engine/deliverableKickoff.ts:39-49<br>src/dblayer/seed/data/eventSubscriptions.json:48-68<br>src/domain/engine/executionEngine.ts:55-70</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Each hop of an upstream Deliverable runs evaluateAndPublishFromTransition, which publishes DeliverableReady for a target whose rows are now satisfied (dependencyDefinitionEngine.ts:115-148, executionEngine.ts:282-288). DeliverableTransitioned wakes deliverableKickoff, which attempts the governed hop of each Deliverable, and isTargetReady lets it through once the rows hold (deliverableKickoff.ts:39-49, executionEngine.ts:55-70, eventSubscriptions.json:56).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Governance approvals trigger Deliverable state transitions.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/web/seus.ts:274-297<br>src/routes/seu/api/deliverables.ts:27-45<br>src/domain/engine/executionEngine.ts:103-105<br>src/routes/seu/core/seus.ts:328-357<br>src/dblayer/transitionDefinitionsDB.ts:201-213<br>src/views/seu/seus/detail.ejs:119-137</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The web and API routes call transitionDeliverable. The engine resolves the deliverable_ badge of the actor, applies Quality Gates and Policies, and records an attestation where the hop requires one (seus.ts:274-297, deliverables.ts:27-45, executionEngine.ts:103-105).<br>Gap:<br>The SEU detail offers every next state of the current state (seus.ts:332, transitionDefinitionsDB.ts:201-213, detail.ejs:119-137), including the governed hop and hops whose badge the viewer does not hold. A click without the badge is refused by the engine and not by the page.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Deliverable subsystem publishes DeliverableCreated.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:247-256<br>src/routes/seu/core/deliverables.ts:30-44<br>src/routes/seu/core/commissioning.ts:272-285</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The birth row names DeliverableCreated (transitionDefinitions.json:247-256) and createDeliverable publishes it just before it returns (deliverables.ts:34-44).<br>Gap:<br>Commissioning creates the Deliverables of every SEU without publishing it (commissioning.ts:272-285). createDeliverable is reachable only from the API route (deliverables.ts:13-25), so the usual path produces no DeliverableCreated.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Deliverable subsystem publishes DeliverableUpdated.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:257-267<br>src/domain/engine/executionEngine.ts:305-317</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>DeliverableUpdated is published, as the event of the hop Defined to In Progress (transitionDefinitions.json:257-267, executionEngine.ts:305-317).<br>Gap:<br>The name carries a different meaning. No attribute of a Deliverable can be updated, so no event reports a change to one.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Deliverable subsystem publishes DeliverableStateChanged.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:318-327<br>src/dblayer/seed/data/eventSubscriptions.json:23-23<br>src/dblayer/seed/data/eventSubscriptions.json:37-37<br>src/dblayer/seed/data/eventSubscriptions.json:56-56<br>src/domain/engine/deliverableKickoff.ts:101-106</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>DeliverableTransitioned is published for every hop with fromState, toState and commandId, and deliverableKickoff consumes it (executionEngine.ts:318-327, eventSubscriptions.json:56, deliverableKickoff.ts:101-106).<br>Gap:<br>No event named DeliverableStateChanged is published. The event registry lists DeliverableReady and DeliverableTransitioned and not the other Deliverable events (eventSubscriptions.json:23, eventSubscriptions.json:37).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Deliverable subsystem publishes DeliverableApproved.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:268-278<br>src/domain/engine/executionEngine.ts:305-317</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The hop In Progress to Approved names DeliverableApproved, and the engine publishes it with the system actor and the resolved badge (transitionDefinitions.json:277, executionEngine.ts:305-317).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Deliverable subsystem publishes DeliverableBaselined.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:279-289<br>src/domain/engine/executionEngine.ts:305-317</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The hop Approved to Baselined names DeliverableBaselined, and the engine publishes it (transitionDefinitions.json:288, executionEngine.ts:305-317).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Deliverable subsystem publishes DeliverableSuperseded.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:247-289</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>No Deliverable hop leads to Superseded, and a search of src for DeliverableSuperseded finds no match. The event is never published.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Deliverable subsystem publishes DeliverableArchived.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:247-289</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>No Deliverable hop leads to Archived, and a search of src for DeliverableArchived finds no match. The event is never published.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Deliverable Model supports versioning.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/deliverables_schema_recovery.sql:3-15<br>src/dblayer/seed/data/transitionDefinitions.json:247-289<br>src/domain/engine/executionEngine.ts:305-327<br>src/domain/engine/eventBus.ts:78-97<br>src/routes/seu/core/versionEvents.ts:18-21<br>src/dblayer/seed/data/schemaDefinitions.json:73-116<br>src/routes/seu/core/deliverableDefinitions.ts:58-68<br>src/dblayer/seed/data/transitionDefinitions.json:1298-1336</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>deliverables has no version column. None of the four Deliverable Transition Definitions sets a versionEvent, and the engine publishes its hop events without one (executionEngine.ts:305-327), so eventBus.publish writes no version_events row for a Deliverable (eventBus.ts:78-97).<br>The Deliverable Definition has a version and Draft to Active states (schemaDefinitions.json:73-116, deliverableDefinitions.ts:58-68). That versions the catalogue entry and not the runtime Deliverable.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Deliverable Model preserves complete engineering history.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:256-327<br>src/routes/seu/core/commissioning.ts:272-285<br>src/routes/seu/core/workItems.ts:86-105</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Hops, Commands, governance outcomes, attestations and Work Item references are recorded (executionEngine.ts:256-327, workItems.ts:86-105).<br>Gap:<br>A Deliverable created at commissioning has no birth event (commissioning.ts:272-285), and a failure inside the unwrapped hop sequence can lose the events of a state change (executionEngine.ts:278-327).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Deliverable Model supports concurrent evolution.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:38-49<br>src/domain/engine/executionEngine.ts:93-96<br>src/domain/engine/executionEngine.ts:214-230<br>src/dblayer/deliverablesDB.ts:97-108</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Hops for one Deliverable are queued in a per-Deliverable promise chain. Inside the turn the Deliverable is read again, and a request whose from-state has changed is refused as already_in_flight (executionEngine.ts:38-49, executionEngine.ts:214-230). A Command in flight for the same hop also refuses a second request (executionEngine.ts:93-96).<br>Gap:<br>The queue is an in-memory Map, so it serialises hops in one process only. updateLifecycleState has no condition on the previous state and the table has no version column (deliverablesDB.ts:97-108, deliverables_schema_recovery.sql:3-15), so two processes can both pass the check and both write.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Deliverable Model maintains deterministic state transitions.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/transition_definitions_schema_recovery.sql:3-10<br>src/domain/engine/executionEngine.ts:55-103<br>src/domain/engine/executionEngine.ts:109-167</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A hop has exactly one Transition Definition (UNIQUE on entity type, from-state and to-state, transition_definitions_schema_recovery.sql:10). The engine runs a fixed sequence of checks: dependencies, Obligations, Decisions, in-flight Command, Transition Definition, Quality Gate, Policy, submission and reference (executionEngine.ts:55-167).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Deliverable declares an Acquisition Scope, and the Knowledge it produces propagates accordingly.<br>Ref: §19, DM-007</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/knowledge.ts:51-59<br>src/dblayer/recovery/deliverables_schema_recovery.sql:10-11<br>src/dblayer/knowledgeItemsDB.ts:143-163</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Knowledge created for a Deliverable takes the Deliverable's scope unless the caller names one (knowledge.ts:58, from acquisitionScope ?? deliverable.acquisition_scope).<br>Gap:<br>Every Deliverable holds SEU (see DM-007), and Knowledge of wider scope is listed and not delivered to other SEUs (see the Capability and Enterprise scope rows).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The implementation produces a Deliverable domain model.<br>Ref: §20</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:456-468<br>src/dblayer/recovery/deliverables_schema_recovery.sql:3-20<br>src/dblayer/deliverablesDB.ts:6-29<br>src/dblayer/deliverablesDB.ts:31-49<br>src/dblayer/deliverablesDB.ts:97-108</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The deliverables table, the DeliverableRow type and deliverablesDB (create, find by id, SEU and category, cycle times, state distribution, state update) form the domain model. Supporting tables are deliverable_references and attestations (deliverable_references_schema_recovery.sql:3-13, attestations_schema_recovery.sql:3-15).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The implementation produces a Deliverable lifecycle service.<br>Ref: §20</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/deliverables.ts:12-46<br>src/routes/seu/core/deliverables.ts:56-83</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>createDeliverable births a Deliverable through the birth Transition Definition and publishes its event. transitionDeliverable governs a request and applies the hop through the Execution Engine (deliverables.ts:12-83).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The implementation produces a Deliverable state engine.<br>Ref: §20</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:52-207<br>src/domain/engine/executionEngine.ts:214-329</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>executionEngine evaluates governance (dependencies, Obligations, Decisions, Quality Gates, Policies, submission, reference), serialises hops per Deliverable, writes the outcome, Command and state, and publishes the events (executionEngine.ts:52-329).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The implementation produces a Deliverable registry.<br>Ref: §20</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/web/deliverableDefinitionRegistry.ts:19-48<br>src/routes/seu/core/deliverableDefinitions.ts:117-125<br>src/routes/seu/core/seus.ts:328-357<br>src/views/seu/seus/detail.ejs:85-100<br>src/domain/engine/metricRegistryEngine.ts:32-37<br>src/domain/engine/metricRegistryEngine.ts:138-144<br>src/dblayer/deliverablesDB.ts:61-95</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The Deliverable Definition registry lists the catalogue of Deliverable kinds with their versions and states (deliverableDefinitionRegistry.ts:19-48, deliverableDefinitions.ts:117-125).<br>Runtime Deliverables are listed inside each SEU's detail page (seus.ts:328-357, detail.ejs:85-100).<br>Telemetry metrics list Deliverables with their state and cycle time and count them by lifecycle state, for one SEU or for all (metricRegistryEngine.ts:32-37, metricRegistryEngine.ts:138-144, deliverablesDB.ts:61-95).<br>Gap:<br>No registry page lists the Deliverables across SEUs with search and detail, and no API returns a list or one Deliverable. The telemetry rows are aggregates and include only Deliverables that have a DeliverableTransitioned event (deliverablesDB.ts:69).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The implementation produces Deliverable APIs.<br>Ref: §20</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/api/deliverables.ts:13-25<br>src/routes/seu/api/deliverables.ts:27-45<br>src/routes/seu/api/deliverables.ts:47-59<br>src/dblayer/seed/data/routeAuthority.json:62-73<br>src/dblayer/seed/data/routeAuthority.json:456-462</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The API offers POST /seus/:id/deliverables, POST /deliverables/:id/transition and GET /deliverables/:id/traceability (deliverables.ts:13-59).<br>Gap:<br>A search of src/routes/seu/api finds no read, list or update route for a Deliverable and none to set category, scope or acceptance criteria. The route_authority rows hold no badge or role (routeAuthority.json:62-73, routeAuthority.json:456-462), so authority rests on the engine's badge check alone.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The implementation produces Deliverable events.<br>Ref: §20</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:247-289<br>src/domain/engine/executionEngine.ts:305-327<br>src/routes/seu/core/deliverables.ts:34-44</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>DeliverableCreated, DeliverableUpdated, DeliverableApproved, DeliverableBaselined and DeliverableTransitioned are published (transitionDefinitions.json:247-289, executionEngine.ts:305-327).<br>Gap:<br>DeliverableStateChanged, DeliverableSuperseded and DeliverableArchived are not published, and DeliverableCreated is published only from createDeliverable.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The implementation produces a Deliverable versioning service.<br>Ref: §20</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/versionEvents.ts:18-21<br>src/dblayer/versionEventsDB.ts:14-40<br>src/domain/engine/executionEngine.ts:305-327</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>The version event store and replay exist for other entities (versionEvents.ts:18-21, versionEventsDB.ts:14-40), but nothing versions a Deliverable. Its hops carry no versionEvent (executionEngine.ts:305-327) and the table has no version. No service creates, compares or retrieves Deliverable versions.</td>
    </tr>
  </tbody>
</table>

## Summary

- Total intents analysed: 87
- Fully met ✅: 37
- Partially met ⚠️: 32
- Not met ❌: 18
- Not verifiable ❓: 0

### Major implementation gaps

- Acceptance criteria are never defined. The acceptance_criteria column is neither written nor read, and acceptance rests on transition-level Quality Gates only.
- Acquisition Scope is never declared. Every Deliverable holds SEU, and Knowledge of Capability, Enterprise and Platform scope is listed but not delivered to any other SEU. Evidence and Decisions carry no scope.
- The Engineering Capital listing has no Tenant condition. Capability, Enterprise and Platform Knowledge of every Tenant is visible to a user of any Tenant.
- The default lifecycle stops at Baselined. Planned, Under Review, Superseded and Archived do not exist, so DeliverableSuperseded and DeliverableArchived are never published.
- No Deliverable versioning exists. There is no version column, no versionEvent on the hops, and no access to an earlier Deliverable version.
- Capability prerequisites in a Template dependency graph are validated and then dropped. materialiseDependencyGraph writes rows for Deliverable prerequisites only.
- Relationship kinds are stored and ignored in evaluation. Refinement, validation and supersession do not exist.
- Description, Consuming Capabilities and a plural Producing Capabilities list are not part of the Deliverable, and Category is NULL for every commissioned Deliverable.
- Commissioning creates Deliverables without a birth event, and a hop is a sequence of writes without a transaction. Concurrency control is an in-process queue with no database guard.
- Completing a Work Item, accepting Evidence and approving a Decision advance no Deliverable. Approve and Baseline are manual, and the SEU page offers all next states without a badge or trigger filter.
