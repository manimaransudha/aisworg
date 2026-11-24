# Part 3. Execution Engine

The Execution Engine runs an Operational SEU. It governs every request to move a Deliverable, turns an approved request into a Command, creates a Work Item for the Command, dispatches the Work Item to a Participant and records the result. The Trust Pipeline and Governance decide whether each step may happen and keep the record that proves it.

## 1. How the pieces fit

```
Request to move a Deliverable
   |
   v
Governance evaluation  --blocked-->  Obligation, Attention Item, no state change
   |
   v (passed)
Governance Evaluation Outcome recorded
   |
   v
Command created, Deliverable state applied together with its Command
   |                                  |
   |                                  +--> attestation recorded when required
   v
CommandGenerated -> Work Item generated -> Dispatch -> Participant
                                                          |
                                                          v
                                           Result reported (done, failed, blocked)
                                                          |
                                                          v
                              reference recorded, Participant idle, next governed hop
```

Two kinds of request exist:

| Kind | Raised by | Example |
|---|---|---|
| Manual | A user clicking a transition button | In Progress to Approved |
| Governed | The engine, under the SEU system actor | Defined to In Progress |

## 2. Where work happens

| Page | Use |
|---|---|
| SEU detail, Deliverables | Deliverable state, dependency edges and the Transition button |
| SEU detail, Capability Fulfilment | Participants per Capability |
| SEU detail, Command / Work Item / Dispatch | Every Command, its Work Items, assigned Participant, dispatch strategy and the Execution Context |
| Work Queue (`seus/:id/work-queue`) | Outstanding Work Items with Deliverable, work item type, transition, reach-by time and fulfilment mode. Report the result here |
| SEU detail tabs | Obligations, Attention Items, Quality Gates, Evidence, Decisions, Knowledge, External Interactions, Events |
| Reviews (`seus/:id/reviews`) | Plan and run Reviews and Findings |
| Compliance (`seus/:id/compliance`) | Requirement results and waivers |
| Attention | Attention Items across SEUs |
| Telemetry | Flow, governance, runtime, knowledge and quality measures |
| Engineering Capital (`knowledge/capital`) | Engineering Capital contributed by Packs |

A transition button appears only for the next states the Transition Definition marks `manual`. The button label is the target state. When several manual targets exist the control is a selector.

## 3. Deliverable lifecycle

| From | To | Verb | Trigger | Attestation |
|---|---|---|---|---|
| (birth) | Defined | define | manual. Commissioning creates each Deliverable in this state. | no |
| Defined | In Progress | create | governed | no |
| In Progress | Approved | approve | manual | required |
| Approved | Baselined | baseline | manual | required |

Badges are `deliverable_define`, `deliverable_create`, `deliverable_approve` and `deliverable_baseline`.

### 3.1 Governed start

The governed hops run when one of these events arrives for an Operational SEU. Each event selects the Deliverables it concerns.

| Event | Deliverables attempted |
|---|---|
| SEUOperational | The start nodes, which are the Deliverables with no dependency. |
| DeliverableTransitioned | The Deliverables that depend on the Deliverable at its new state, when each is ready for In Progress. |
| CapabilityFulfilled | The Deliverables the Capability produces, when ready. |
| DispatchRejected | The Deliverable of the rejected Command. |
| Obligation or Attention Item resolved | The Deliverable the item is raised against. An item raised against another object concerns no Deliverable. |
| QualityGateWaiverCreated | The Deliverables the waiver names by code, in the SEU or in every SEU of the shared Profile. |

For each Deliverable attempted the engine requests every next hop marked governed. A Deliverable whose dependencies are not yet satisfied waits and is evaluated again on a later event. When a Deliverable becomes ready, the engine also requests fulfilment of its producing Capability, with no Participant named, unless the Capability is Fulfilled or a request is in flight (Part 2, section 10).

### 3.2 Producing command

When a Deliverable reaches In Progress the engine issues one producing Command (In Progress to In Progress, verb produce). The Command is the order to produce the Deliverable. The engine issues it again in two cases:

- A Capability is fulfilled after the Deliverable was already In Progress.
- A previous producing Command failed because no Participant was eligible.

Only one live producing Command exists per Deliverable.

When a Capability that produces an In Progress Deliverable has no eligible Participant (CapabilityUnavailable), the engine raises a blocking Obligation (category Operational) and a High Action Required Attention Item on the Deliverable. The producing Command is issued when the Capability is fulfilled and the Obligation is resolved.

### 3.3 Approve needs a reference

In Progress to Approved is refused with "cannot approve a Deliverable with no attached reference" until a Work Item has completed with a reference for the Deliverable.

## 4. Governance evaluation of a Deliverable transition

Every request runs all of the checks below. A failing check does not stop the later checks. Each check records a condition, Passed or Blocked, and the Quality Gate decision is made once with every condition. A waiver can cover a Blocked condition (section 8.1). When the request is refused, the reason returned is the first Blocked check in the order below, or the first blocked Quality Gate when no check blocked.

| # | Check | Failure result | Side effect | Waivable |
|---|---|---|---|---|
| 1 | Dependency readiness. Every governing dependency row for the Deliverable and target state is satisfied. | `dependency_not_satisfied` | DeliverableBlocked event | no |
| 2 | The owning SEU has no open blocking Obligation. | `seu_blocked` | none | by an Obligation waiver |
| 3 | The Deliverable has no open blocking Obligation. | `obligation_blocked` | none | by an Obligation waiver |
| 4 | Every Decision related to the Deliverable is Approved or beyond. | `decision_blocked` | none | no |
| 5 | No Command for the same hop is in flight. | `already_in_flight` | none | no |
| 6 | A Transition Definition exists for the hop and declares a verb. When none exists the request ends here with `no_transition_definition`, or with `already_in_flight` when check 5 blocked. | `no_transition_definition` | none | no |
| 7 | Authority. The requester holds `deliverable_<verb>`, or `root`. | An error is raised: the actor does not hold the badge. | none | no |
| 8 | Policies (section 9). | `policy_blocked` | Obligations declared by the Policy | by a Policy waiver or an Obligation waiver |
| 9 | Submit step, when the hop defines one. | `not_submitted` | none | no |
| 10 | For In Progress to Approved, a reference exists. | `empty_centre` | none | no |
| 11 | Quality Gates (section 8). | `quality_gate_blocked` | Attention Item (Action Required). Sustained-block detection | by a Gate waiver |

The Quality Gate decision is stored for every hop, including a refused hop.

When all checks pass, or every Blocked condition is waived, the engine records a Governance Evaluation Outcome and applies the transition.

### 4.1 Governance Evaluation Outcome

The outcome is a permanent record of why the transition was allowed.

| Field | Content |
|---|---|
| outcome | Approved, Approved-with-Conditions (a Standard Policy was deviated), or Waived (a Quality Gate was waived) |
| quality gate result | Passed, NotApplicable or Waived, with the gate |
| authority | The authority rule consulted |
| policies | Satisfied and deviated Policy identifiers |
| consulted obligations and open Attention Items | Those open at evaluation time |
| rationale | A sentence that summarises the above |

The Command stores a pointer to the outcome. The Work Item's Execution Context reads from it.

### 4.2 Applying the transition

1. The engine requests one transition at a time per Deliverable. A request whose starting state has changed since evaluation is refused as `already_in_flight`.
2. The engine checks that the SEU system actor holds the badge for the hop.
3. It records the outcome and the Command.
4. It changes the Deliverable state and marks the Command Completed.
5. It re-evaluates dependency edges that point at the Deliverable and publishes the resulting readiness events.
6. It records an attestation when the hop requires one (section 12).
7. It publishes the hop's own event, then DeliverableTransitioned. Nothing follows the publication.

## 5. Command, Work Item and Dispatch

### 5.1 Statuses

| Object | Statuses seen in operation |
|---|---|
| Command | Dispatched, Deferred, Failed, Completed |
| Work Item | Dispatched, Completed, Disposed |
| Participant engagement | Available, Assigned, Idle, Released. The lifecycle also defines Executing. No code on the dispatch or result path moves a Participant to it. |

### 5.2 Execution Context

Each Work Item for a Deliverable carries an Execution Context. It holds:

| Item | Source |
|---|---|
| Engineering objective and relevant Deliverable | The Deliverable |
| Service | The producing Capability's Service |
| Input location | The `guideLocation` of the Deliverable Definition |
| Output location | The Profile's knowledge locations in the EBM |
| Decisions, supporting Evidence, relevant Knowledge | Items related to the Deliverable |
| Governing Policies, applicable authority, Quality Gate result, open Attention Items | The Governance Evaluation Outcome |
| Active Obligations | Items related to the Deliverable |
| Checklists and Engineering Capital | The EBM's settled result |
| Profile configuration | The EBM's settled result (methodology, environment, language, source control, cloud, deployment strategy, AI provider preference, repository structure, documentation level, readme, domain, organisations, environment configuration and deployment targets) |

Open the Execution Context disclosure on the Command tab to read it.

### 5.3 Dispatch

Dispatch selects a Participant for a Work Item.

1. The eligible pool is the set of active Capability fulfilments of the producing Capability at the time of dispatch.
2. A Work Item generated for a work item type carries a role and a worktype. Only pool members whose competency holds both are candidates. A Work Item with neither keeps every pool member.
3. Of those, candidates are the ones whose state is Available or Idle.
4. Strategies from the Profile's dispatch preference are tried in order. Without a preference, capability-match is used.
5. The Work Item is assigned, the Participant becomes Assigned, and ParticipantAssigned, ParticipantSelected and WorkItemDispatched are published.
6. The target completion time comes from the Service. A service level item whose label contains "turnaround" gives the number of seconds.

| Situation | Event | Effect |
|---|---|---|
| No producing Capability | DispatchRejected | Work Item Disposed, Command Failed, Obligation and Attention Item (High) raised |
| Empty eligible pool | DispatchRejected | Same |
| No pool member holds the role and worktype of the Work Item | DispatchRejected | Same |
| Candidates exist, none Available | DispatchDeferred | Command Deferred. A redispatch is requested |
| Strategies exclude every candidate | ParticipantUnavailable | Same as DispatchRejected |

### 5.4 Redispatch

Each redispatch increments the attempt counter on the Work Item. The Profile sets two numbers.

| Setting | Effect |
|---|---|
| redispatchAttentionThreshold | At exactly this attempt, an Escalation Attention Item (Medium) is raised. |
| redispatchMaxAttempts | At this attempt, the Work Item is Disposed, the Command Failed, an Obligation and an Attention Item are raised, and DispatchRejected is published. |

A fulfilment that arrives later re-issues the producing Command, so a rejected Deliverable recovers when a Participant is assigned.

### 5.5 Delivery of the assignment

The adapter that receives the assignment is chosen in this order:

1. The adapter named by the assigned Participant. The name must be a registered adapter.
2. When the Participant names none, the execution target of the producing Capability for the SEU's tenant.
3. When no execution target exists, human-on-ui.

| Mode | Behaviour |
|---|---|
| human-on-ui | The default. The Work Item appears in the Work Queue. |
| external-orchestrator | The platform posts the assignment as JSON to the adapter endpoint with an optional bearer reference. |
| ai-anthropic | An AI Participant runs the assignment on Anthropic with the platform tools. A failed run raises an Attention Item for the Participant. The provider endpoint and key come from the Profile's AI provider credentials through the EBM. |

An execution target holds a capability, a mode, an adapter endpoint and an adapter authentication reference. No page or route writes execution targets. `POST /aisworg/api/seu/execution-targets` and `GET /aisworg/api/seu/execution-targets/:capabilityId` answer 501 Not implemented.

The assignment document contains: workItemId, participantId, seuId, tenant, vcsBinding, deliverable, transition (from and to), targetCompletionAt, inputReferences and executionContext. The input references are the latest references of the upstream Deliverables on which this Deliverable depends. The version control binding is read from the tenant contract. No page or route writes the tenant contract; `POST /aisworg/api/seu/tenants/:id/contract` answers 501 Not implemented.

### 5.6 Reporting a result

| Route | Use |
|---|---|
| Work Queue, Complete | A user reports done, failed or blocked and enters an optional reference |
| Quick View or My Work, Complete | A Participant reports a result from the participant pages |

`POST /aisworg/api/seu/work-items/:id/result` answers 501 Not implemented, so an external system cannot report a result through the API.

Only a Work Item in Dispatched status accepts a result.

| Outcome | Effect |
|---|---|
| done | A Deliverable reference is stored with the Participant as author. The Work Item is Completed and then Disposed. WorkItemCompleted and WorkItemDisposed are published. The Command is Completed when no sibling Work Item is outstanding. The Participant becomes Idle. |
| failed or blocked | The Work Item is Disposed and the Command is Failed. The Participant becomes Idle. WorkItemCancelled is published. A High Exception Attention Item is raised on the Deliverable. |

One Work Item is generated for each work item type the EBM settled for the Deliverable. Without settled types one Work Item is generated for the Command. The Command is Completed when every one of its Work Items is Completed or Disposed.

A Work Item reported done does not itself approve the Deliverable. A person with `deliverable_approve` requests the move to Approved.

### 5.7 Stalled work

The platform has a function that scans Work Items past their target completion time and raises one Escalation Attention Item (High) per Deliverable. No page, route or scheduler calls it. `POST /aisworg/api/seu/work-items/sweep-stalled` answers 501 Not implemented. A Work Item that passes its target time raises no alert.

### 5.8 Unavailable Capabilities

The platform has a function that re-requests every unfulfilled Capability of an SEU whose latest request ended in CapabilityUnavailable at least 300 seconds earlier. No page, route or scheduler calls it. `POST /aisworg/api/seu/capabilities/sweep-unavailable` answers 501 Not implemented.

## 6. Dependencies

The dependency definitions the SEU's EBM recorded govern the Deliverables. Each edge states that a target Deliverable cannot move to a state until the source Deliverable (or Capability) has reached a state. A Deliverable source satisfies an edge when it is in the required state or has passed it along its lifecycle. A Capability source satisfies an edge when its state equals the required state. A Deliverable with no edge pointing at it is a start node. The Deliverables tab shows the edges as a diagram under Deliverable dependencies, and a Deliverable Quality Gate table with the state, gate outcome, Attention Items, Participants and blocked transition of each Deliverable. When a Deliverable moves, the engine publishes DeliverableReady for each target whose edges are now all satisfied.

## 7. Trust pipeline overview

The Trust Pipeline is the set of records that make a Deliverable believable.

| Stage | Record | Lifecycle |
|---|---|---|
| Produce | Deliverable reference | One per completed Work Item |
| Support | Evidence | Collected, Validated, Accepted, Referenced, Archived (or Rejected) |
| Decide | Decision | Identified, Analysed, Proposed, Reviewed, Approved, Applied, Superseded, Archived |
| Review | Review and Finding | Planned, Prepared, In Progress, Completed, Accepted, Archived. Finding: Open, then Resolved, Waived or Converted |
| Commit | Obligation | Identified through Closed |
| Certify | Attestation | Created with the transition |
| Learn | Knowledge | Observed, Proposed, Validated, Accepted, Published, Deprecated, Archived |
| Prove | Compliance evaluation | Status per SEU |
| Explain | Traceability | Read-only view per Deliverable |

### 7.1 Evidence

Use the Evidence tab.

1. Collect Evidence: choose the related Deliverable, the category, a title and a source. A new item may name an earlier item it supersedes (predecessor).
2. Categories: Validation Evidence, Analytical Evidence, Operational Evidence, Review Evidence, Decision Evidence and External Evidence.
3. Assess: record a status for each validation dimension (authenticity, completeness, consistency, source-credibility, engineering-relevance). A status is Not Assessed, Pass, Partial or Fail. The confidence level (Low, Medium or High) is calculated from the assessments and follows the weakest one.
4. Transition: Validate, Accept, Reference, Archive, or Reject (from Collected or Validated).
5. Link: attach existing Evidence to another object.

Evidence counts toward a Quality Gate or a compliance requirement only when it is Accepted or Referenced.

### 7.2 Decisions

Use the Decisions tab. Identify a Decision with a Deliverable, a category, a title, the engineering question and the alternatives. At least one supporting Knowledge item or Evidence item is required. Alternative status values are Candidate, Evaluating, Investigating, Deferred, Rejected and Approved. A Decision related to a Deliverable blocks that Deliverable until it is Approved or beyond (check 4). Approved and Applied Decisions count toward Quality Gates and compliance.

### 7.3 Reviews and Findings

Use Reviews.

1. Plan a Review: Deliverable, category and name.
2. Advance it: Prepare, Start, Complete, Accept.
3. Complete requires an outcome: Passed, Passed with Recommendations, Rework Required, Failed, Not Applicable or Deferred. The outcome cannot be changed later.
4. Add Findings with a severity. Resolve or Waive a Finding, or convert it to an Obligation.

An Accepted Review with outcome Passed or Passed with Recommendations satisfies a Quality Gate that requires a review.

### 7.4 Obligations

An Obligation is a commitment that must be resolved. Sources are Policies that block a transition, Packs at commence-work, Findings converted to Obligations, dispatch failures, an unavailable Capability, sustained-pattern detection, waiver Obligation controls, Knowledge promotion and blocking Attention Items. No page creates an Obligation by hand.

| Field | Meaning |
|---|---|
| category | Security, Engineering, Compliance, Organisational Learning, Review Finding, Risk, Audit, Operational or Customer |
| severity and priority | Critical to Low and Very High to Low |
| origin | Where it came from (EBM, Policies, Reviews, Quality Gates, and others in the Ontology) |
| blocked from and to state | The transition the Obligation holds back, if any |
| completion criteria | What counts as resolved |

Lifecycle: Identified, Analysed, Assigned, In Progress, Resolved, Verified, Closed, Archived. A Closed Obligation can be Reopened. Any state before Closed can be Escalated. Each verb needs `obligation_<verb>`.

An Obligation with a blocked transition is resolved when it reaches Verified, Closed or Archived. The engine then re-attempts the held transition.

An Obligation can be revised from its row: title, description, category, severity, priority, completion criteria and the assigned entity.

Promoting a Knowledge item beyond the SEU raises an Organisational Learning Obligation on its Deliverable, with severity Low (Capability scope: Medium; Enterprise and Platform: High). A blocking Attention Item raised by a Participant holds the hop of the Participant's Work Item through an Obligation. The Obligation is covered by no waiver and resolves with the Attention Item (section 7.8).

### 7.5 Attention Items

Attention Items tell people that something needs action. Categories in use are Action Required, Escalation, Exception and EBM Retired.

Lifecycle: Created, Delivered, Acknowledged, In Progress, Resolved, Closed. Resolved or Closed items that relate to the SEU or a Deliverable trigger a new governed attempt.

Participants raise an item on the SEU Attention tab, or on My Work (section 7.8), and work all items on the Attention page.

### 7.6 Knowledge

Observe a Knowledge item on a Deliverable with a supporting Evidence item (required), a category, a title, a description and an acquisition scope. Advance it: Propose, Validate, Accept, Publish, Deprecate, Archive. The platform stores Knowledge validation notes (a note text with the actor and the `knowledge_validate` badge), but no page or route adds or lists them. `POST` and `GET /aisworg/api/seu/knowledge/:id/validation-notes` answer 501 Not implemented. Promote the scope from SEU to Capability, Enterprise or Platform with Promote. Engineering Capital contributed by Packs is listed under Engineering Capital.

### 7.7 External Interactions

Record an interaction with an outside party on the External Interactions tab with an optional Deliverable, an interaction type, a direction, a target system and a purpose. Lifecycle: Created, Validated, Dispatched, then Acknowledged or Failed, then Completed and Archived.

### 7.8 My Work

A user who holds the `general` role and is not a `superuser` sees My Work at `/aisworg/quickview`. It lists, for each SEU the Participant works on, only the Deliverables, Commands, Obligations, Evidence, Knowledge, Decisions, External Interactions, Events and Attention Items that concern the Participant's own Work Items. A Participant can:

| Action | Rule |
|---|---|
| Complete a Work Item | Only a Work Item assigned to the Participant. The result is done, failed or blocked, as in section 5.6. |
| Raise an Attention Item | Only on a Deliverable assigned to the Participant. A blocking item needs an outstanding Work Item of the Participant on that Deliverable. |
| Report status | Completed needs at least one Evidence item of the Participant and no open Attention Item. Completed Pending Attention needs an open Attention Item and none that blocks. It holds the hop with one Obligation per open item. Blocked needs an open blocking Attention Item and leaves the Work Item open. |

## 8. Quality Gates

A Quality Gate is declared by a Pack for one transition. The EBM keeps the gates of the composed Packs. A gate may name Deliverables. A named gate applies only to those Deliverables.

| Criteria type | Passes when |
|---|---|
| no_unresolved_obligations | Every Obligation on the entity is Verified, Closed or Archived. |
| requires_accepted_evidence_or_approved_decision | The entity has Accepted or Referenced Evidence of the gate's category, or an Approved or Applied Decision. |
| requires_accepted_review | An Accepted Review with a passing outcome exists for the required Review Gate. |
| requires_active_policy | Every named Policy condition holds. |

Gate categories are Entry, Exit, Release, Compliance and Operational.

Each gate evaluation is stored as Passed or Blocked. The decision of a hop is stored as Approved, Blocked, Waived or NotApplicable. QualityGatePassed, QualityGateBlocked and QualityGateWaived are published.

### 8.1 Waivers

A holder of `qualitygate_waive` can grant a waiver on the SEU page. A waiver is granted from one Deliverable (or the SEU) and has one scope:

| Scope | Covers |
|---|---|
| Gate | One Quality Gate of the SEU's EBM. |
| Policy | One Policy, by code. |
| Policy Obligation | An open Obligation that a named Policy raised, by the Policy code and the Obligation title. |
| Obligation | An open Obligation that no Policy raised, by category and title. |

A waiver has these inputs:

| Input | Meaning |
|---|---|
| rationale | Required. |
| expiresAt | A future time. When empty the waiver expires after 3 days. |
| deliverableIds, shareWithProfile | Further Deliverables of the SEU the waiver covers, named by code. Sharing extends the waiver to every SEU that uses the same Profile. A waiver granted for the SEU covers the SEU only. |
| risks | Each risk is a text with controls: Expiry, Accept risk, or an Obligation raised on the SEU or a Deliverable. A risk with no control gets the Expiry control. |
| supporting records | Evidence, Knowledge items and Decisions of the SEU. |

An Obligation that holds a Deliverable for an Attention Item is covered by no waiver. Resolve the Attention Item. An active waiver turns a Blocked condition into Waived and the Governance Evaluation Outcome becomes Waived. A waiver of a gate with the criterion no_unresolved_obligations carries a confidence rating from 0 to 100. The base rating is 25 for a waiver with an expiry only and 75 when a risk has an Obligation control. Supporting records lift the base to 50 and 100 respectively, and the rating is that base multiplied by the lowest confidence percentage among the records. A waiver moves from Active to Expired when its expiry time passes and has a manual Active to Revoked hop (verb revoke). The Quality Gate decision is made again in the background after a waiver is granted. `POST` and `GET /aisworg/api/seu/seus/:id/quality-gate-waivers` answer 501 Not implemented.

### 8.2 Sustained blocks

Three Blocked evaluations of the same gate in one SEU raise an Organisational Learning Obligation and an Escalation Attention Item once. Telemetry applies the same threshold of three to a Standard Policy whose condition fails repeatedly in one SEU, and to a Capability that has no Participant in three or more SEUs.

## 9. Policies

A Policy is adopted by Packs and applies to one governed transition written `Entity|From|To`.

| Constraint type | When the condition fails |
|---|---|
| Policy | The transition is blocked. PolicyViolated is published. The Obligations declared by the Policy condition are raised. |
| Standard | The transition continues as a deviation. PolicyViolated and StandardPolicyDeviation are published. The outcome becomes Approved-with-Conditions. |

When the condition holds, PolicyApplied is published.

Conditions use these checks: always true, always false, field in a list, comparison (gt, gte, lt, lte, eq, neq) and threshold (gte, gt).

SEU-scoped Policies apply to SEU hops. All others apply to the entity they name. Policies with the scope Eligibility apply to Participants (Part 2, section 10).

## 10. Authority

- Every manual action checks the badge `noun_verb` of the Transition Definition.
- Engine hops run under the SEU system actor, which carries its own badges.
- Records store the actor and the badge used, so an action can be traced to a person and an authority.
- A manual route may have no badge in the route table. The engine then makes the decision.

## 11. Compliance

Open `seus/:id/compliance`. Frameworks come from the SEU's composed Compliance Packs. Each framework has requirements. A requirement has a criteria type and an optional category.

| Criteria type | Satisfied when |
|---|---|
| no_unresolved_obligations | No unresolved Obligation (of the category) |
| requires_accepted_evidence | Accepted or Referenced Evidence (of the category) |
| requires_approved_decision | Approved or Applied Decision (of the category) |
| requires_accepted_review | Accepted passing Review (of the category) |

Results per requirement are satisfied, waived or unsatisfied. The SEU status is Compliant, Compliant with Exceptions, Partially Compliant, Non-Compliant or Compliance Unknown.

A requirement may declare a conflict with another requirement. The page lists conflicts between requirements that both apply to the SEU. A waiver for a requirement is granted on the page with a rationale. Evaluations are stored. The compliance routes under `/aisworg/api/seu` answer 501 Not implemented. Events published are ComplianceEvaluated, ComplianceStatusChanged, ComplianceSatisfied and ComplianceViolationDetected.

## 12. Attestation and traceability

A hop that requires attestation records an attestation row when it completes. The row stores the Deliverable, the Command, the requesting Participant, the transition, the acting badge and the reference. Approved and Baselined need attestation.

The traceability of a Deliverable (`GET /aisworg/api/seu/deliverables/:id/traceability`) answers 501 Not implemented. The traceability content is:

- the provenance entries (references and certified attestations, in time order),
- the dependencies,
- supporting Evidence and Decisions,
- Knowledge and Obligations,
- Reviews and Findings,
- the producing Capability.

## 13. Telemetry

Open Telemetry. The measures are computed for one SEU or across SEUs.

| Section | Content |
|---|---|
| Flow | Deliverable cycle time |
| Governance | Quality Gate latency |
| Runtime | Commands generated, dispatch latency and Work Item duration |
| Knowledge | Knowledge items, Evidence generated and items promoted beyond the SEU, by acquisition scope |
| Quality | Rework rate, average blocked attempts and Deliverable acceptance rate |

## 14. Events

Open Events (`superuser`). Every state change publishes an event with a correlation identifier, the actor and the badge. The SEU Events tab shows the events of one SEU.

| Event | Meaning |
|---|---|
| CommissionInitiated, CommissionValidated, CommissionFailed | Commissioning progress |
| CompositionCompleted, EBMCreated, EBMValidated, EBMActivated, EBMRetired | EBM progress |
| SEUConfigured, SEUCommissioned, SEUActivated, SEUOperational, SEUSuspended, SEUResumed, SEURetired, SEUArchived | SEU hops |
| CapabilityRequested, CapabilityFulfilled, CapabilityUnavailable, ParticipantReplaced | Capability fulfilment |
| CommandGenerated, WorkItemGenerated, WorkItemDispatched, WorkItemCompleted, WorkItemCancelled, WorkItemStalled, WorkItemDisposed | Execution |
| DispatchDeferred, DispatchRejected, ParticipantUnavailable, RedispatchRequested, RedispatchCompleted | Dispatch |
| DeliverableTransitioned, DeliverableBlocked, DeliverableReady | Deliverable movement |
| ObligationTransitioned, AttentionItemTransitioned | Items that can release a held hop |
| EvidenceTransitioned, DecisionTransitioned, KnowledgeTransitioned, ReviewTransitioned, FindingTransitioned, ParticipantTransitioned | One event for each hop of that entity, published beside the hop's own event |
| ParticipantSelected | Dispatch chose a Participant for a Work Item |
| Hop events named in the Transition Definitions, for example ObjectiveActivated, PackPublished, TemplateActivated, ProfileDefined, ServiceValidated, DeliverableApproved, DeliverableBaselined, ObligationClosed, AttentionResolved, DecisionApproved, KnowledgeAccepted | The event of one hop of one entity. Its name is the `eventType` of that Transition Definition |
| QualityGatePassed, QualityGateBlocked, QualityGateWaived, QualityGateWaiverCreated, QualityGateWaiverExpired, QualityGateWaiverRevoked | Quality Gates and waivers |
| PolicyApplied, PolicyViolated, StandardPolicyDeviation | Policies |
| ReviewPlanned, ReviewStarted, ReviewCompleted, ReviewPassed, ReviewFailed, ReviewDeferred | Reviews |
| EvidenceCollected, EvidenceSuperseded, EvidenceLinked | Evidence |
| SustainedPatternDetected | Telemetry rule |
| ComplianceEvaluated, ComplianceStatusChanged, ComplianceSatisfied, ComplianceViolationDetected, ComplianceReportGenerated, ComplianceWaiverGranted | Compliance (section 11) |

Handlers react to events in the background. A page may need a reload to show the effect, for example after Activate EBM or after reporting a result.

## 15. Troubleshooting

| Symptom | Likely cause | Action |
|---|---|---|
| Deliverable stays Defined | Dependencies not satisfied, an open Obligation, an unapproved Decision, or SEU not Operational | Read the edges on the Deliverables tab and the Obligations and Decisions tabs. |
| Transition button missing | The hop is not manual, or the user lacks `deliverable_<verb>` | Check the Transition Definition trigger and the user's badges. |
| Error "does not hold deliverable_<verb>" | Missing badge | Grant `deliverable_<verb>`. |
| `quality_gate_blocked` | A gate criterion fails | Collect and accept Evidence, close Obligations, complete the Review, or obtain a waiver. |
| `policy_blocked` | A Policy condition fails | Resolve the Obligations raised by the Policy. |
| `already_in_flight` | A Command exists for the same hop | Wait for the Command or check that its Work Item has a result. |
| `empty_centre` | No reference | Report a done result with a reference first. |
| Command Failed, "empty_eligible_pool" | No Participant fulfils the producing Capability | Assign a Participant. The Command is re-issued. |
| Command Deferred | Every candidate is busy | Wait, or assign another Participant. Redispatch continues up to the limit. |
| Work Item not in Work Queue | The adapter of the Participant or the execution target is not human-on-ui | The adapter reports the result. No API route accepts it yet. |
| Work Item overdue with no alert | Nothing calls the stalled-work function | Watch the Work Queue for overdue items. |
| Capability stays unfulfilled after CapabilityUnavailable | Nothing calls the re-request function | Assign Participants again on the Capability Fulfilment tab (section 5.8). |
| Attention Item for a failed Work Item | A Participant reported failed or blocked | Resolve the cause, then request the hop again. |
