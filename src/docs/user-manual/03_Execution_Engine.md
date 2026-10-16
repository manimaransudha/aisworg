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
| Work Queue (`seus/:id/work-queue`) | Outstanding Work Items with Deliverable, transition, reach-by time and execution mode. Report the result here |
| SEU detail tabs | Obligations, Attention Items, Evidence, Decisions, Knowledge, External Interactions, Events |
| Reviews (`seus/:id/reviews`) | Plan and run Reviews and Findings |
| Compliance (`seus/:id/compliance`) | Requirement results and waivers |
| Attention | Attention Items across SEUs |
| Telemetry | Flow, governance, runtime, knowledge and quality measures |
| Knowledge Capital | Engineering Capital contributed by Packs |

A transition button appears only for the next states the Transition Definition marks `manual`. The button label is the target state. When several manual targets exist the control is a selector.

## 3. Deliverable lifecycle

| From | To | Verb | Trigger | Attestation |
|---|---|---|---|---|
| Defined | In Progress | create | governed | no |
| In Progress | Approved | approve | manual | required |
| Approved | Baselined | baseline | manual | required |

Badges are `deliverable_create`, `deliverable_approve` and `deliverable_baseline`.

### 3.1 Governed start

The governed hops run when one of these events arrives for an Operational SEU: SEUOperational, DeliverableTransitioned, CapabilityFulfilled, DispatchRejected, or the resolution of an Obligation or Attention Item. For each Deliverable the engine requests every next hop marked governed. A Deliverable whose dependencies are not yet satisfied waits and is evaluated again on the next event.

### 3.2 Producing command

When a Deliverable reaches In Progress the engine issues one producing Command (In Progress to In Progress, verb produce). The Command is the order to produce the Deliverable. The engine issues it again in two cases:

- A Capability is fulfilled after the Deliverable was already In Progress.
- A previous producing Command failed because no Participant was eligible.

Only one live producing Command exists per Deliverable.

### 3.3 Approve needs a reference

In Progress to Approved is refused with "cannot approve a Deliverable with no attached reference" until a Work Item has completed with a reference for the Deliverable.

## 4. Governance evaluation of a Deliverable transition

Every request runs the same checks in this order. The first failing check stops the request.

| # | Check | Failure result | Side effect |
|---|---|---|---|
| 1 | Dependency readiness. Every governing dependency row for the Deliverable and target state is satisfied. | `dependency_not_satisfied` | DeliverableBlocked event |
| 2 | The owning SEU has no open blocking Obligation. | `seu_blocked` | none |
| 3 | The Deliverable has no open blocking Obligation. | `obligation_blocked` | none |
| 4 | Every Decision related to the Deliverable is Approved or beyond. | `decision_blocked` | none |
| 5 | No Command for the same hop is in flight. | `already_in_flight` | none |
| 6 | A Transition Definition exists for the hop and declares a verb. | `no_transition_definition` | none |
| 7 | Authority. The requester holds `deliverable_<verb>`, or `root`. | `authority_denied` | none |
| 8 | Quality Gates (section 8). | `quality_gate_blocked` | Attention Item (Action Required). Sustained-block detection |
| 9 | Policies (section 9). | `policy_blocked` | Obligations declared by the Policy, Attention Items |
| 10 | Submit step, when the hop defines one. | `not_submitted` | none |
| 11 | For In Progress to Approved, a reference exists. | `empty_centre` | none |

When all checks pass the engine records a Governance Evaluation Outcome and applies the transition.

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
7. It publishes DeliverableTransitioned. Nothing follows the publication.

## 5. Command, Work Item and Dispatch

### 5.1 Statuses

| Object | Statuses seen in operation |
|---|---|
| Command | Dispatched, Deferred, Failed, Completed |
| Work Item | Dispatched, Completed, Failed, Disposed |
| Participant engagement | Available, Assigned, Executing, Idle, Released |

### 5.2 Execution Context

Each Work Item for a Deliverable carries an Execution Context. It holds:

| Item | Source |
|---|---|
| Engineering objective and relevant Deliverable | The Deliverable |
| Service | The producing Capability's Service |
| Input and output location | The Profile's knowledge locations in the EBM |
| Decisions, supporting Evidence, relevant Knowledge | Items related to the Deliverable |
| Governing Policies, applicable authority, Quality Gate result, open Attention Items | The Governance Evaluation Outcome |
| Active Obligations | Items related to the Deliverable |
| Checklists and Engineering Capital | Packs that contribute to the producing Capability |
| Profile configuration | The EBM pool (methodology, language, source control, cloud, deployment, documentation and organisations) |

Open the Execution Context disclosure on the Command tab to read it.

### 5.3 Dispatch

Dispatch selects a Participant for a Work Item.

1. The eligible pool is the set of active Capability fulfilments taken when the Command was created.
2. Candidates are pool members whose state is Available or Idle.
3. Strategies from the Profile's dispatch preference are tried in order. Without a preference, capability-match is used.
4. The Work Item is assigned, the Participant becomes Assigned, and ParticipantAssigned, ParticipantSelected and WorkItemDispatched are published.
5. The target completion time comes from the Service. A service level item whose label contains "turnaround" gives the number of seconds.

| Situation | Event | Effect |
|---|---|---|
| No producing Capability | DispatchRejected | Work Item Disposed, Command Failed, Obligation and Attention Item (High) raised |
| Empty eligible pool | DispatchRejected | Same |
| Candidates exist, none Available | DispatchDeferred | Command Deferred. A redispatch is requested |
| Strategies exclude every candidate | ParticipantUnavailable | Same as DispatchRejected |

### 5.4 Redispatch

Each redispatch increments the attempt counter on the Work Item. The Profile sets two numbers.

| Setting | Effect |
|---|---|
| redispatchAttentionThreshold | At exactly this attempt, an Escalation Attention Item is raised. |
| redispatchMaxAttempts | At this attempt, the Work Item is Disposed, the Command Failed, an Obligation and an Attention Item are raised, and DispatchRejected is published. |

A fulfilment that arrives later re-issues the producing Command, so a rejected Deliverable recovers when a Participant is assigned.

### 5.5 Delivery of the assignment

Each Capability has an execution target per tenant.

| Mode | Behaviour |
|---|---|
| human-on-ui | The default. The Work Item appears in the Work Queue. |
| external-orchestrator | The platform posts the assignment as JSON to the adapter endpoint with an optional bearer reference. |

Register a target with `POST /aisworg/api/seu/execution-targets` and the fields `capabilityId`, `mode`, `adapterEndpoint`, `adapterAuthRef` and optionally `tenantId`. `GET /aisworg/api/seu/execution-targets/:capabilityId` reads it. The endpoint is required for external-orchestrator.

The assignment document contains: workItemId, seuId, tenant, vcsBinding, deliverable, transition (from and to), targetCompletionAt and inputReferences. The input references are the latest references of the upstream Deliverables on which this Deliverable depends. The tenant's version control binding is stored with `POST /aisworg/api/seu/tenants/:id/contract` (fields vcsBinding, callbackAuth, attestationConfig).

### 5.6 Reporting a result

| Route | Use |
|---|---|
| Work Queue, Complete | A user reports done, failed or blocked and enters an optional reference |
| `POST /aisworg/api/seu/work-items/:id/result` | An external system reports `outcome` and `reference` |

Only a Work Item in Dispatched status accepts a result.

| Outcome | Effect |
|---|---|
| done | A Deliverable reference is stored with the Participant as author. The Work Item is Completed and Disposed. The Command is Completed. The Participant becomes Idle. The next governed hops are evaluated. |
| failed or blocked | The Work Item and the Command are Failed. The Participant becomes Idle. A High Exception Attention Item is raised on the Deliverable. WorkItemFailed is published. |

A Work Item reported done does not itself approve the Deliverable. A person with `deliverable_approve` requests the move to Approved.

### 5.7 Stalled work

`POST /aisworg/api/seu/work-items/sweep-stalled` (optional query `seuId`) scans Work Items that are past their target completion time. For each, one Escalation Attention Item (High) is raised per Deliverable and WorkItemStalled is published. The platform has no scheduler for this call. Run it from an external scheduler.

## 6. Dependencies

The dependency definitions of the SEU's Template, Profile and composed Packs govern the Deliverables. Each edge states that a target Deliverable cannot move to a state until the source Deliverable (or Capability) has reached a state. The Deliverables tab shows each edge with a readiness badge. A Capability edge becomes ready when the Capability is fulfilled.

## 7. Trust pipeline overview

The Trust Pipeline is the set of records that make a Deliverable believable.

| Stage | Record | Lifecycle |
|---|---|---|
| Produce | Deliverable reference | One per completed Work Item |
| Support | Evidence | Collected, Validated, Accepted, Referenced, Archived (or Rejected) |
| Decide | Decision | Identified, Analysed, Proposed, Reviewed, Approved, Applied, Superseded, Archived |
| Review | Review and Finding | Planned, Prepared, In Progress, Completed, Accepted, Archived. Finding: Open, Resolved or Waived |
| Commit | Obligation | Identified through Closed |
| Certify | Attestation | Created with the transition |
| Learn | Knowledge | Observed, Proposed, Validated, Accepted, Published, Deprecated, Archived |
| Prove | Compliance evaluation | Status per SEU |
| Explain | Traceability | Read-only view per Deliverable |

### 7.1 Evidence

Use the Evidence tab.

1. Collect Evidence: choose the related Deliverable (or another object), the category, a title and a source. A new item may supersede an earlier one.
2. Categories: Validation, Analytical, Operational, Review, Decision and External Evidence.
3. Assess: record a status for each validation dimension (authenticity, completeness, consistency, source-credibility, engineering-relevance). A status is Not Assessed, Pass, Partial or Fail. A confidence level (Low, Medium, High) is kept.
4. Transition: Validate, Accept, Reference, Archive, or Reject (from Collected or Validated).
5. Link: attach existing Evidence to another object.

Evidence counts toward a Quality Gate or a compliance requirement only when it is Accepted or Referenced.

### 7.2 Decisions

Use the Decisions tab. Identify a Decision with a category, a title, the engineering question, the related Deliverables and the alternatives. Alternative status values are Candidate, Evaluating, Investigating, Deferred, Rejected and Approved. A Decision related to a Deliverable blocks that Deliverable until it is Approved or beyond (check 4). Approved and Applied Decisions count toward Quality Gates and compliance.

### 7.3 Reviews and Findings

Use Reviews.

1. Plan a Review: related object, category, name, reviewer and an optional Review Gate.
2. Advance it: Prepare, Start, Complete, Accept.
3. Complete requires an outcome: Passed, Passed with Recommendations, Rework Required, Failed, Not Applicable or Deferred. The outcome cannot be changed later.
4. Add Findings with a severity. Resolve or Waive a Finding, or convert it to an Obligation.

An Accepted Review with outcome Passed or Passed with Recommendations satisfies a Quality Gate that requires a review.

### 7.4 Obligations

An Obligation is a commitment that must be resolved. Sources are Policies that block a transition, Packs at commence-work, Findings, dispatch failures, sustained-pattern detection and users.

| Field | Meaning |
|---|---|
| category | Security, Engineering, Compliance, Organisational Learning, Review Finding, Risk, Audit, Operational or Customer |
| severity and priority | Critical to Low and Very High to Low |
| origin | Where it came from (EBM, Policies, Reviews, Quality Gates, and others in the Ontology) |
| blocked from and to state | The transition the Obligation holds back, if any |
| completion criteria | What counts as resolved |

Lifecycle: Identified, Analysed, Assigned, In Progress, Resolved, Verified, Closed, Archived. A Closed Obligation can be Reopened. Any state before Closed can be Escalated. Each verb needs `obligation_<verb>`.

An Obligation with a blocked transition is resolved when it reaches Verified, Closed or Archived. The engine then re-attempts the held transition.

An Obligation can be revised from its row.

### 7.5 Attention Items

Attention Items tell people that something needs action. Categories in use are Action Required, Escalation, Exception and EBM Retired.

Lifecycle: Created, Delivered, Acknowledged, In Progress, Resolved, Closed. Resolved or Closed items that relate to the SEU or a Deliverable trigger a new governed attempt.

Participants raise an item on the SEU Attention tab and work all items on the Attention page.

### 7.6 Knowledge

Observe a Knowledge item on a Deliverable with a category, title, description, acquisition scope and confidence. Advance it: Propose, Validate, Accept, Publish, Deprecate, Archive. Validation notes can be added. Promote the scope from SEU to Capability, Enterprise or Platform with Promote. Engineering Capital contributed by Packs is listed under Knowledge Capital.

### 7.7 External Interactions

Record an interaction with an outside party on the External Interactions tab. Lifecycle: Created, Validated, Dispatched, then Acknowledged or Failed, then Completed and Archived.

## 8. Quality Gates

A Quality Gate is declared by a Pack for one transition. The EBM keeps the gates of the composed Packs. A gate may name Deliverables. A named gate applies only to those Deliverables.

| Criteria type | Passes when |
|---|---|
| no_unresolved_obligations | Every Obligation on the entity is Verified, Closed or Archived. |
| requires_accepted_evidence_or_approved_decision | The entity has Accepted or Referenced Evidence of the gate's category, or an Approved or Applied Decision. |
| requires_accepted_review | An Accepted Review with a passing outcome exists for the required Review Gate. |
| requires_active_policy | Every named Policy condition holds. |

Gate categories are Entry, Exit, Release, Compliance and Operational.

Each evaluation is stored as Passed, Blocked or Waived. QualityGatePassed, QualityGateBlocked and QualityGateWaived are published.

### 8.1 Waivers

A holder of `qualitygate_waive` can waive a gate for one entity with a rationale and an optional expiry. Use `POST /aisworg/api/seu/seus/:id/quality-gate-waivers` with `qualityGateId`, `entityType`, `entityId`, `rationale` and `expiresAt`. `GET` on the same path lists waivers. An active waiver turns a Blocked result into Waived and the Governance Evaluation Outcome becomes Waived.

### 8.2 Sustained blocks

Three Blocked evaluations of the same gate in one SEU raise an Organisational Learning Obligation and an Escalation Attention Item once.

## 9. Policies

A Policy is adopted by Packs and applies to one governed transition written `Entity|From|To`.

| Constraint type | When the condition fails |
|---|---|
| Policy | The transition is blocked. PolicyViolated is published. The Obligations declared by the Policy condition are raised. |
| Standard | The transition continues as a deviation. PolicyViolated and StandardPolicyDeviation are published. The outcome becomes Approved-with-Conditions. |

When the condition holds, PolicyApplied is published.

Conditions use these checks: always true, field in a list, comparison (gt, gte, lt, lte, eq, neq) and threshold (gte, gt).

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

A waiver for a requirement is granted on the page with a rationale. Evaluations are stored. The API offers `GET /aisworg/api/seu/seus/:id/compliance`, `/compliance/report` and `/compliance/history`. Events published are ComplianceEvaluated, ComplianceStatusChanged, ComplianceSatisfied and ComplianceViolationDetected.

## 12. Attestation and traceability

A hop that requires attestation records an attestation row when it completes. The row stores the Deliverable, the Command, the requesting Participant, the transition, the acting badge and the reference. Approved and Baselined need attestation.

Open the explanation of a Deliverable with `GET /aisworg/api/seu/deliverables/:id/traceability`. It returns:

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
| Runtime | Dispatch and execution measures |
| Knowledge | Growth of Knowledge |
| Quality | Rework and acceptance |

## 14. Events

Open Events (`superuser`). Every state change publishes an event with a correlation identifier, the actor and the badge. The SEU Events tab shows the events of one SEU.

| Event | Meaning |
|---|---|
| CommissionRequested, CommissionValidated, CommissionFailed | Commissioning progress |
| CompositionCompleted, EBMCreated, EBMValidated, EBMActivated, EBMRetired | EBM progress |
| SEUConfigured, SEUCommissioned, SEUActivated, SEUOperational | SEU hops |
| CapabilityFulfilled | A Participant was assigned |
| CommandGenerated, WorkItemGenerated, WorkItemDispatched, WorkItemCompleted, WorkItemFailed, WorkItemStalled, WorkItemDisposed | Execution |
| DispatchDeferred, DispatchRejected, ParticipantUnavailable, RedispatchRequested, RedispatchCompleted | Dispatch |
| DeliverableTransitioned, DeliverableBlocked | Deliverable movement |
| ObligationTransitioned, AttentionItemTransitioned | Items that can release a held hop |
| QualityGatePassed, QualityGateBlocked, QualityGateWaived, QualityGateWaiverGranted | Quality Gates |
| PolicyApplied, PolicyViolated, StandardPolicyDeviation | Policies |
| ReviewPlanned, ReviewStarted, ReviewCompleted, ReviewPassed, ReviewFailed, ReviewDeferred | Reviews |
| EvidenceCollected, EvidenceSuperseded | Evidence |
| SustainedPatternDetected | Telemetry rule |

Handlers react to events in the background. A page may need a reload to show the effect, for example after Activate EBM or after reporting a result.

## 15. Troubleshooting

| Symptom | Likely cause | Action |
|---|---|---|
| Deliverable stays Defined | Dependencies not satisfied, an open Obligation, an unapproved Decision, or SEU not Operational | Read the edges on the Deliverables tab and the Obligations and Decisions tabs. |
| Transition button missing | The hop is not manual, or the user lacks `deliverable_<verb>` | Check the Transition Definition trigger and the user's badges. |
| `authority_denied` | Missing badge | Grant `deliverable_<verb>`. |
| `quality_gate_blocked` | A gate criterion fails | Collect and accept Evidence, close Obligations, complete the Review, or obtain a waiver. |
| `policy_blocked` | A Policy condition fails | Resolve the Obligations raised by the Policy. |
| `already_in_flight` | A Command exists for the same hop | Wait for the Command or check that its Work Item has a result. |
| `empty_centre` | No reference | Report a done result with a reference first. |
| Command Failed, "empty_eligible_pool" | No Participant fulfils the producing Capability | Assign a Participant. The Command is re-issued. |
| Command Deferred | Every candidate is busy | Wait, or assign another Participant. Redispatch continues up to the limit. |
| Work Item not in Work Queue | The execution target is external-orchestrator | Report the result through the API. |
| Work Item overdue with no alert | The sweep is not scheduled | Run the sweep call on a schedule. |
| Attention Item for a failed Work Item | A Participant reported failed or blocked | Resolve the cause, then request the hop again. |
