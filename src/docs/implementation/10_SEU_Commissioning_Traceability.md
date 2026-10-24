# Implementation Traceability: Chapter 10 – SEU Commissioning

**Date of report: 23-10-2026**

Specification: src/docs/SEU Studio Specifications/02_SEU Composition/10_SEU Commissioning.md

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">An SEU is created from a Profile. Commissioning from a Template is disallowed.<br>Ref: §1, FR-10.2, FR-10.3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:111-165<br>src/routes/seu/web/seus.ts:98-110</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>initiateSeu takes an Objective id and a Profile id only. The Template is read from profile.base_template_id. The form posts the Profile part of the Template/Profile choice. One Template and one Profile are stored on the SEU row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Commissioning is the only mechanism that creates an SEU.<br>Ref: §1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seusDB.ts:19-30<br>src/routes/seu/core/commissioning.ts:111-165</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>seusDB.create is called from initiateSeu only. The API commission route is commented out.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Commissioning validates the request, composes the EBM, allocates runtime resources, establishes governance and creates the initial engineering state.<br>Ref: §1, §3, §4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:111-309<br>src/domain/engine/compositionCompleted.ts:31-118</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Validate, Compose, Activate EBM, asset creation and SEU activation all run.<br>Gap:<br>Runtime allocation is not a step. Governance is established through EBM policies and Obligations only when the SEU commences work.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every SEU begins from a valid foundation. The Objective, Template, Profile and Packs are checked live before composition.<br>Ref: §4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:44-87<br>src/actions/validateSeuRequest.ts:14-33</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The validate-seu-request action runs inside the Initiated to Validated hop. A dead reference throws and the SEU takes the governed Failed row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Engineering behaviour is completely defined before execution.<br>Ref: §4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionCompleted.ts:49-117<br>src/routes/seu/core/commissioning.ts:311-357</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The EBM is composed, validated and activated before the SEU commences.<br>Gap:<br>Nothing stops several EBMs existing for one SEU. ebms has no uniqueness on seu_id and each CompositionCompleted creates a new EBM.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Governance is established before work begins.<br>Ref: §4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionCompleted.ts:66-89<br>src/routes/seu/core/commissioning.ts:311-357</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Policies and Quality Gates are stored on the EBM. attemptSeuCommenceWork evaluates the SEU-scoped Policy and raises Obligations before Activated to Operational.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Runtime state is consistent. Each hop commits atomically.<br>Ref: §4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/entityTransition.ts:55-62<br>src/routes/seu/core/commissioning.ts:225-309</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Each transition commits its action and state change in one transaction.<br>Gap:<br>finalizeCommissioning creates Capabilities and Deliverables outside any transaction. A later failure leaves them in place.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Knowledge repositories are initialised at commissioning.<br>Ref: §4, FR-10.8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/knowledge.ts:20-82<br>src/routes/seu/core/commissioning.ts:225-309</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>Knowledge items are created through the Knowledge API and web routes only. No commissioning step creates one, and the KnowledgeInitialised row has no performer.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Traceability begins at SEU creation.<br>Ref: §4, FR-10.11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:111-172<br>src/routes/seu/core/commissioning.ts:287-307</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The birth event starts a correlation. Each later hop carries correlationId and causationId.<br>Gap:<br>The chain is not stored as a traceability record. Traceability is derived from events at read time.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A request contains an authorised requestor, Engineering Objectives and a Profile with metadata, parameters and underlying definitions.<br>Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:111-165<br>src/routes/seu/web/objectives.ts:485-546</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>requested_by is the actor. The Objective and Profile are required. Parameter overrides are collected on the Compose step.<br>Gap:<br>Optional inputs such as an existing Knowledge Repository, Deliverables or legacy code base have no input field. Packs and parameters are the only route.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Commissioning produces the SEU, EBM, Deliverable and Capability catalogues, Participant Requirements, Knowledge Repository, Dependency Graph, Obligation Register and Traceability Repository.<br>Ref: §6, §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:225-309<br>src/domain/engine/compositionCompleted.ts:76-105</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The SEU, EBM, seu_capabilities and Deliverables are produced.<br>Gap:<br>No Role Catalogue, Knowledge Repository or Traceability Repository is created. The Dependency Graph and Obligation Register are not materialised per SEU.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Only authorised users may commission an SEU.<br>Ref: FR-10.1, §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/routeAuthority.json:1156-1175<br>src/dblayer/seed/data/routeAuthority.json:1890-1910<br>src/domain/engine/entityTransition.ts:24-53</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>POST /seus, compose-ebm and validate-commission require seu_commission or seu_validate in route_authority. transitionEntity resolves the badge from the Transition Definition.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every request references one Template.<br>Ref: FR-10.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/seus_schema_recovery.sql:6<br>src/routes/seu/core/commissioning.ts:118-119</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>template_id is NOT NULL on seus and set from the Profile.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every request references one Profile.<br>Ref: FR-10.3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/seus_schema_recovery.sql:7<br>src/routes/seu/core/commissioning.ts:111-117</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>profile_id is NOT NULL on seus. initiateSeu rejects a missing Profile.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All mandatory Packs are validated before composition.<br>Ref: FR-10.4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:55-66</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>checkRequestLiveness collects the Template's mandatory Pack codes and the Profile's Pack codes. Each must have an Active version, or validation fails.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Composition Engine produces exactly one EBM.<br>Ref: FR-10.5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionCompleted.ts:74-105<br>src/routes/seu/web/objectives.ts:485-546</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>One EBM is created per CompositionCompleted and seus.active_ebm_id points to it.<br>Gap:<br>Re-posting compose-ebm with no conflicts publishes CompositionCompleted again and creates another EBM. No constraint prevents it.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Commissioning fails if behavioural conflicts remain unresolved.<br>Ref: FR-10.6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/web/objectives.ts:523-535</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>CompositionCompleted is published only when compositionConflicts is empty.<br>Gap:<br>Unresolved conflicts leave the SEU in Validated. The SEU does not move to Failed and no CommissionFailed event is published.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Runtime resources are allocated only after successful composition.<br>Ref: FR-10.7, §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:153-208</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>The SEU row, its identifier and its tenant exist from the Save step, before composition. No step allocates services, event channels, persistence, a security context or an observability context. The RuntimeAllocated row is governed and has no performer.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The platform initialises the Knowledge Repository.<br>Ref: FR-10.8, §12, §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:153-208</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>No code creates the baseline knowledge items listed in §15. The KnowledgeInitialised row has no performer.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The platform initialises the Dependency Graph.<br>Ref: FR-10.9, §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:96-149<br>src/routes/seu/core/templates.ts:590-607<br>src/domain/engine/materialiseDependencyGraph.ts:8-51</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Dependency definitions are materialised when a Template is authored. The Dependency Engine evaluates them against the SEU's Deliverables.<br>Gap:<br>Commissioning writes no graph for the SEU. Obligations do not join the graph.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The platform initialises the Obligation Register.<br>Ref: FR-10.10, §12, §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:311-357<br>src/routes/seu/core/obligations.ts:187-260</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Pack Obligation definitions in the EBM become Obligations when the SEU tries Activated to Operational and the definition applies to that hop.<br>Gap:<br>Nothing is created at commissioning for the other Obligation sources in §16. Obligations are raised only for matching definitions.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Commissioning establishes complete traceability before execution begins.<br>Ref: FR-10.11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:287-308<br>src/domain/engine/ebmActivated.ts:34-45</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Events from Initiated to Activated share one correlationId and a causation chain. The report records the EBM id.<br>Gap:<br>The chain breaks at CompositionCompleted, which starts a new correlation when posted from the web route.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No engineering work begins until commissioning completes.<br>Ref: FR-10.12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:311-357<br>src/domain/engine/executionEngineKickoff.ts:59-63</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Deliverable execution starts from SEUOperational. attemptSeuCommenceWork acts only when the SEU is Activated.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The workflow runs Request, Validate, Resolve Template, Profile and Packs, Compose, Validate model, Allocate Runtime, Create Assets, Recruit Participants, Activate, Ready.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1-105<br>src/routes/seu/core/commissioning.ts:202-309</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Initiated, Validated, EBM Composed, Validated, Active, then Configured, Commissioned and Activated run in that order.<br>Gap:<br>Allocate Runtime and Recruit Participants are not steps. Compose is a manual button, not an automatic hop after Validate.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Failure at any stage terminates commissioning.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:175-193<br>src/domain/engine/compositionCompleted.ts:27-47<br>src/domain/engine/ebmActivated.ts:10-13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Validate, compose and finalize failures call failSeu, which moves the SEU to Failed through a governed row and publishes CommissionFailed.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Template, Profile, Pack availability and authorisation are validated.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:44-87<br>src/routes/seu/core/commissioning.ts:111-135</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Template, Profile, Pack, Capability, Service and Objective liveness is checked. Authorisation is the route badge.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Version compatibility, commissioning parameters and mandatory configuration are validated.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:44-87<br>src/routes/seu/web/objectives.ts:523-524</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Parameter conflicts surface during composition.<br>Gap:<br>Validate checks that a Pack has an Active version only. It does not check version compatibility or that mandatory parameters have values.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Validation failures produce diagnostic reports.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:202-219<br>src/routes/seu/web/objectives.ts:548-575</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The check list and the dead references are stored in the CommissionValidated and CommissionFailed payloads and shown on the validation page.<br>Gap:<br>The report is read from the latest event and is not a stored record.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Composition Engine discovers Packs, resolves dependencies, composes and validates behaviour and produces the EBM.<br>Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:441-462<br>src/domain/engine/profileCompositionUnravel.ts:104-130<br>src/domain/engine/compositionCompleted.ts:49-105</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>previewCommissioningValidation unravels the composition and detects conflicts. The handler creates the EBM from the stored result.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Runtime Kernel allocates the SEU identifier, services, event channels, configuration, persistence, security and observability contexts and stays independent of engineering behaviour.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/seus_schema_recovery.sql:3-15<br>src/dblayer/seed/data/transitionDefinitions.json:153-208</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The SEU identifier and tenant are allocated by the insert.<br>Gap:<br>No code allocates the other resources. Runtime allocation has no service.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Commissioning initialises the Deliverable and Capability Catalogues.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:241-285</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Capabilities are copied to seu_capabilities and Deliverables are created from the Template catalogue with the producing Capability linked.<br>Gap:<br>Deliverables are created outside a transaction.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Commissioning initialises the Role Catalogue.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:225-309</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>No Role Catalogue exists for an SEU. Roles are not created by commissioning.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No runtime execution occurs during initialisation.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:272-292<br>src/domain/engine/executionEngineKickoff.ts:59-63</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>finalizeCommissioning creates rows and moves state only. Execution starts after SEUActivated through the kickoff handler.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participant recruitment establishes the SEU&#x27;s initial execution capability, by automatic, manual or hybrid assignment.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:99-212<br>src/routes/seu/web/seus.ts:200-221</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Participants are recruited per Capability through the fulfil route and by the dispatch engine on Ready Deliverables.<br>Gap:<br>Recruitment is not a commissioning step. The ParticipantsRecruited row has no performer and the event is not published.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Recruitment does not modify the EBM.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:99-212</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The capability code writes seu_capabilities and fulfilment rows only.<br>Gap:<br>No rule prevents a later recomposition from changing the EBM after recruitment.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Deliverable begins in a defined lifecycle state and the Dependency Engine drives later transitions.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:268-285<br>src/domain/engine/dependencyDefinitionEngine.ts:96-149</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The initial state is the to-state of the Deliverable birth row, which is Defined. Dependency definitions publish DeliverableReady.<br>Gap:<br>The typical states in §14 (Planned, Awaiting Dependency Resolution and the others) are not used.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Knowledge Repository holds the commissioning metadata, Template, Profile, EBM and Pack references, composition report and commissioning decisions.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/knowledge.ts:20-82</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>No knowledge item is written at commissioning. The same facts exist on the seus, ebms and events rows, not in the Knowledge Repository.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Commissioning creates Obligations from compliance, governance, reviews, approvals and recommendations, and adds them to the Dependency Graph.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:336-342<br>src/routes/seu/core/obligations.ts:187-260</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Pack-defined Obligations are created by category, origin and severity at the commence hop.<br>Gap:<br>Obligations are not created at commissioning for unresolved recommendations. They do not enter the Dependency Graph.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every commissioning produces a permanent Commissioning Report.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:294-303<br>src/dblayer/seusDB.ts:111-120</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A report is stored in seus.commissioning_report when finalizeCommissioning succeeds.<br>Gap:<br>No report is stored on failure. No page or API returns it.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The report contains Identity: SEU, Template, Profile and EBM version.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:378-379</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>seuId, Template and Profile codes and ebmId are stored.<br>Gap:<br>No EBM version field exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The report contains Composition: Packs, Pack versions, composition and behaviour summaries.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:380</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Pack codes, warnings and conflicts are stored.<br>Gap:<br>Pack versions and the behaviour summary are not stored.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The report contains Validation: warnings, errors, manual resolutions and outstanding recommendations.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:297</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>validation.errors is always an empty array. Warnings are held under composition. Manual resolutions and recommendations are not recorded.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The report contains Runtime: participants, services, initial Deliverables and Obligations.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:298-301</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Initial Capability codes and Deliverable names are stored.<br>Gap:<br>Participants, runtime services and Obligations are not stored.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The report contains Traceability: decisions, composition traceability and behaviour provenance.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:378-383</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>The report type has no traceability section.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The platform publishes CommissionRequested, CommissionValidated, CompositionStarted and CompositionCompleted.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/eventSubscriptions.json:4-8<br>src/routes/seu/core/commissioning.ts:202-219<br>src/domain/engine/compositionCompleted.ts:31-47</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>CommissionValidated and CompositionCompleted are published.<br>Gap:<br>CommissionRequested and CompositionStarted are registered and not published. The birth event is CommissionInitiated.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The platform publishes RuntimeAllocated, KnowledgeInitialised and ParticipantsRecruited.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:153-208<br>src/dblayer/seed/data/authorityVocabulary.json:149-166</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>No event type of these names is registered or published. Only vocabulary and unwired governed rows exist.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The platform publishes SEUActivated, CommissionCompleted and CommissionFailed.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:305-307<br>src/routes/seu/core/commissioning.ts:175-193<br>src/dblayer/seed/data/transitionDefinitions.json:84-93</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>SEUActivated and CommissionFailed are published.<br>Gap:<br>CommissionCompleted exists nowhere in the code.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Commissioning is deterministic and repeatable.<br>Ref: §19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/web/objectives.ts:485-546<br>src/domain/engine/compositionCompleted.ts:49-105</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The composition input is stored and the handler composes from it.<br>Gap:<br>Repeated composition creates new EBMs, so a repeated commission is not idempotent.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Commissioning is fully auditable.<br>Ref: §19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:153-163<br>src/domain/engine/entityTransition.ts:64-93</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Every hop persists an event with actor, badge, from-state and to-state.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Commissioning supports concurrent commissioning.<br>Ref: §19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/seus_schema_recovery.sql:21-22</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Rows are keyed per SEU and a partial unique index allows one live SEU per Objective.<br>Gap:<br>Two parallel Saves race on the existing-SEU check before the index rejects one.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Commissioning supports rollback upon failure.<br>Ref: §19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:175-193<br>src/routes/seu/core/commissioning.ts:247-285</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>Failure moves the SEU to Failed. Seu_capabilities and Deliverables already created are not removed.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An authorised user can commission an SEU.<br>Ref: §20</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/web/seus.ts:98-143<br>src/dblayer/seed/data/routeAuthority.json:1890-1910</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Save, Validate, Compose and Activate run through the web form for holders of the badges.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The EBM is composed.<br>Ref: §20</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionCompleted.ts:74-105</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The EBM row is created with composed Packs, behaviours, Policies and Quality Gates.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Runtime resources are allocated only after successful composition.<br>Ref: §20</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:153-208</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>No runtime allocation exists. See FR-10.7.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Initial engineering assets are created.<br>Ref: §20</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:241-285</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Capabilities and Deliverables are created.<br>Gap:<br>Knowledge, Obligations, graph and Role assets are not.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants are recruited.<br>Ref: §20</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/web/seus.ts:200-221</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Recruitment is available per Capability after commissioning.<br>Gap:<br>Commissioning does not recruit.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Commissioning Report is generated.<br>Ref: §20</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:294-303</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A partial report is stored.<br>Gap:<br>See §17 rows.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SEU enters the Ready for Execution state.<br>Ref: §20</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:84-103<br>src/routes/seu/core/commissioning.ts:311-357</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The SEU reaches Activated and then Operational.<br>Gap:<br>No state is named Ready for Execution. Operational follows only when no blocking Obligation exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables: Commissioning Service, Workflow, Validation Service, Runtime Allocation Service, Participant Recruitment Service, Report Generator, APIs and Events.<br>Ref: §21</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:111-357<br>src/routes/seu/api/seus.ts:13-32</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Commissioning functions, workflow rows, validation, report writer and some events exist.<br>Gap:<br>No Runtime Allocation Service or Participant Recruitment Service. The commissioning API route is commented out.</td>
    </tr>
  </tbody>
</table>

## Summary

- Total intents analysed: 59
- Fully met ✅: 16
- Partially met ⚠️: 34
- Not met ❌: 9
- Not verifiable ❓: 0

### Major implementation gaps

- Runtime allocation, Knowledge Repository initialisation and Role Catalogue creation are not commissioning steps. Their governed SEU rows have no performer.
- Participant recruitment is a post-commissioning action. The ParticipantsRecruited event is not published.
- Events CommissionRequested, CompositionStarted, RuntimeAllocated, KnowledgeInitialised, ParticipantsRecruited and CommissionCompleted are not published.
- The Commissioning Report is partial: no Pack versions, EBM version, manual resolutions, participants, services, Obligations or traceability section. It is stored on success only and no page or API returns it.
- Unresolved composition conflicts leave the SEU in Validated and do not fail commissioning.
- Nothing prevents several EBMs per SEU, and repeated Compose creates a new EBM.
- Failure does not roll back created Capabilities and Deliverables.
- The commissioning API route is commented out.
