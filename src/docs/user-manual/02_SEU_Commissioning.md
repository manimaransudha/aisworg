# Part 2. SEU Commissioning

Commissioning turns one Objective into one running SEU (Software Engineering Unit). It selects a Template and a Profile, validates every reference, composes the Engineering Behavior Model (EBM), activates the EBM, creates the SEU's runtime assets and brings the SEU to Operational.

## 1. Summary of the flow

| # | Step | Page | Who acts | Badge | Result |
|---|---|---|---|---|---|
| 1 | Create and activate the Objective | Objectives | Sponsor | `objective_propose`, then `objective_activate` | Objective is Active. |
| 2 | Choose a Template and a Profile | Objective, Commission | Commissioner | `seu_commission` | SEU row in Pending. Commission request raised. |
| 3 | Validate Request | Commission Validation | Automatic | none | CommissionValidated, or SEU Failed. |
| 4 | Compose EBM | Compose EBM | Commissioner | `seu_commission` | EBM in Composed state. |
| 5 | Validate EBM | SEU detail, EBM | Reviewer | `ebm_validate` | EBM Validated, or EBM Retired. |
| 6 | Activate EBM | SEU detail, EBM | Approver | `ebm_activate` | EBM Active. Finalization starts. |
| 7 | Finalize commissioning | none | Automatic | Held by the activating user | SEU Activated. Capabilities and Deliverables exist. |
| 8 | Commence work | none | Automatic | Held by the activating user | SEU Operational, if the commence-work checks pass. |
| 9 | Fulfil Capabilities | SEU detail, Capability Fulfilment | Staffing lead | none on the route | Participants assigned. Work can be dispatched. |

## 2. Before you start

| Requirement | Where to check |
|---|---|
| The Objective is Active, is not Strategic, has no children and has no SEU yet. | Objectives |
| At least one Template is Active and a Profile whose base Template is that Template is Active. | Templates, Profiles |
| Every Pack the Template and Profile name has an Active version. | Packs |
| Every Capability the Profile adds is an Active `capability-name` concept. | Ontology |
| Every Service the Profile overrides has an Active version. | Service Definitions |
| The commissioning user holds `seu_commission`. | Identity |
| The user who activates the EBM holds the SEU badges listed in section 8. | Identity |
| Participants exist for the Capabilities the SEU needs. | Participants |

## 3. Objectives

### 3.1 Tiers

| Tier | May be a root | Allowed children | May own an SEU |
|---|---|---|---|
| Strategic | Yes | Operational, Engineering | No. It is a programme umbrella. |
| Operational | No | Engineering | Yes, when it has no children. |
| Engineering | No | none | Yes. |

A child cannot be more strategic than its parent. A parent accepts children while it is Proposed or Active and while it is not locked by a submission.

### 3.2 Create an Objective

1. Open Objectives. Choose New for a root, or Add child on an Objective and choose the child tier.
2. Enter the statement.
3. Select the required Capabilities from the Ontology. A child starts with its parent's selection.
4. Save. This needs `objective_propose`. The Objective starts as Proposed.

A new Objective can replace an existing one with the supersede option on the New page.

### 3.3 Move an Objective

| Action | Badge | Notes |
|---|---|---|
| Edit, move to another parent, delete | `objective_propose` | Blocked once the Objective, or an ancestor, has been submitted. |
| Submit | `objective_propose` | Locks editing until the activate holder acts. |
| Activate (Proposed to Active) | `objective_activate` | Requires the submit step first. |
| Achieve (Active to Achieved) | `objective_achieve` | The transition is governed. |
| Reject, Supersede, Retire (from Active) | `objective_reject`, `objective_supersede`, `objective_retire` | Retire on the detail page retires the Active descendants as well. Others are skipped. |
| Archive | `objective_archive` | From Achieved, Superseded or Retired. |

Comments can be added to an Objective without a badge.

## 4. Start commissioning

1. Open the Active Objective and choose Commission. The page lists every available Profile as a card, with its Template. Profiles are those that fit the Objective's required Capabilities.
2. Select exactly one Profile. A Profile whose Template is not selected is refused.
3. Choose Submit. This needs `seu_commission`.

The platform then:

1. Creates the SEU in the Pending state under the Objective's tenant.
2. Publishes CommissionRequested.
3. Redirects to the SEU list with the message "Commissioning queued".

An Objective accepts one SEU. A second request for the same Objective redirects to the SEU list. A Failed SEU keeps the Objective assigned.

## 5. Validate Request

Validation runs automatically after CommissionRequested. Open Commission Validation for the Objective and reload until the result appears.

The page lists each check with the result Live or Dead.

| Check | Live when |
|---|---|
| Authority (badge seu_commission) | The requester holds the badge and the SEU hop Pending to Commissioned passes its policies. |
| Objective | Status is Active. |
| Profile | Status is Active. |
| Template | Status is Active. |
| Each Pack | An Active version exists. The list comes from the Template's Mandatory Packs and the Profile's selections. |
| Each additional Capability | It is an Active `capability-name` concept. |
| Each overridden Service | An Active version exists. |

Outcomes:

| Outcome | Event | SEU state |
|---|---|---|
| All checks Live | CommissionValidated | Pending |
| Any check Dead | CommissionFailed (stage `validate_request`, with the dead references) | Failed |

## 6. Compose the EBM

The EBM is the effective set of behaviours for this SEU. It combines the Packs of the Template and Profile into one pool.

1. Open Compose EBM for the Objective.
2. Review the composed Packs, the Profile details and any warnings.
3. Resolve each conflict that the page lists. A conflict is a property that two or more Packs set to different values. For each, choose a strategy and the sources it applies to.

| Strategy | Sources to check | Outcome |
|---|---|---|
| merge | 2 or more | Combined value, with a note on residual conflicts. |
| union | 2 or more | All distinct values. |
| intersection | 2 or more | The value all checked sources share. Nothing survives when they differ. |
| supplement | A base and others | The base value, supplemented. |
| specialization | A base | The base source's value. |

4. Choose Apply and re-validate after each change. The page stores the current state of the composition.
5. When no conflicts remain the system publishes CompositionCompleted and creates the EBM.

Composition errors set the SEU to Failed with stage `compose_ebm`.

The EBM records:

- the composed Packs and the composition report,
- the behaviour pool (including Profile configuration, dispatch strategy and knowledge locations),
- the competency requirements,
- the Quality Gates of the composed Packs,
- the Transition-scope Policies of the composed Packs, split into SEU-scoped Policies and entity-scoped Policies.

The EBM starts in the Composed state.

## 7. Validate and activate the EBM

Open the SEU and use the EBM controls.

| Action | Badge | Effect |
|---|---|---|
| Validate | `ebm_validate` | The platform re-checks that the Template, Profile and every composed Pack are still live. When all are live the EBM is Validated. |
| Retire | `ebm_retire` | Composed to Retired. |
| Activate | `ebm_activate` | Validated to Active. Finalization starts in the background. |

If any reference is no longer live, Validate sets the EBM to Retired, publishes EBMRetired and raises an Attention Item of category EBM Retired that lists the references. Compose again after the references are repaired.

## 8. Finalization

Activating the EBM publishes EBMActivated. A background handler runs finalization with the identity of the user who activated the EBM. That user must hold `seu_configure`, `seu_commission` and `seu_activate`, or `root`. A missing badge sets the SEU to Failed with stage `finalize_commissioning`.

Finalization performs these steps in order:

1. SEU Pending to Configured (SEUConfigured) and Configured to Commissioned (SEUCommissioned).
2. Creates a system Participant for the SEU.
3. Creates one SEU Capability for every Capability the Template requires.
4. Creates one Deliverable for every entry in the Template's Deliverable catalogue. Each Deliverable receives a producing Capability when an Active Service lists the Deliverable code among its outputs. A Deliverable without a producing Capability cannot be dispatched.
5. Saves the commissioning report: identity, composition, validation and runtime sections.
6. SEU Commissioned to Activated (SEUActivated).

## 9. Commence work

SEUActivated starts the commence-work attempt. The SEU moves from Activated to Operational (verb operationalise, governed) when all of these hold:

| Check | If it fails |
|---|---|
| The acting user holds `seu_operationalise`, or `root`. | The SEU stays Activated. |
| The SEU-scoped Policies for Activated to Operational are satisfied. | An Obligation is raised and the SEU shows a Blocked badge. |
| The Packs raise no Obligation Definitions for this hop. | The Obligations are raised and the SEU stays Activated. |

The attempt repeats when an Obligation or Attention Item related to the SEU reaches a resolved state. Resolve the Obligation to continue. When the SEU becomes Operational, SEUOperational is published and the governed start of Deliverables begins (Part 3).

## 10. Fulfil Capabilities

An SEU needs Participants before work can be dispatched. Open the SEU, tab Capability Fulfilment.

1. Each required Capability is listed with its status.
2. Choose Assign for a Capability and select one or more Participants. Selecting more than one gives a Composite fulfilment.
3. Choose Replace to swap a Participant, or Release to remove one.

A Participant is eligible when all of these hold:

| Rule | Source |
|---|---|
| The Participant belongs to the SEU's tenant. | Participant record |
| The Participant lists the Capability. | Participant record |
| The Participant matches the SEU's competency requirements, for every dimension. | EBM behaviour pool |
| The Participant's behaviour context satisfies each Eligibility-scope Policy of the composed Packs. | Policy Definitions |
| The Participant has not been released from this Capability. | Fulfilment history |

Each assignment creates a Participant engagement for the SEU and publishes CapabilityFulfilled. A Deliverable already In Progress then receives its producing Command (Part 3, section 4).

A user created in Identity receives a Human Participant record. The Participants page lists all Participant records with type and tenant.

## 11. SEU lifecycle

| State | Entered by | Verb badge |
|---|---|---|
| Pending | Commission request | `seu_commission` (to start) |
| Failed | Validation, composition or finalization failure | `seu_reject` |
| Configured | Finalization | `seu_configure` |
| Commissioned | Finalization | `seu_commission` |
| Activated | Finalization | `seu_activate` |
| Operational | Commence work (governed) | `seu_operationalise` |
| Suspended, Operational | Defined hops | `seu_suspend`, `seu_resume` |
| Retired, Archived | Defined hops | `seu_retire`, `seu_archive` |

The Transition Definitions for Suspended, Resumed, Retired and Archived exist. The SEU pages have no control for them.

## 12. Troubleshooting

| Symptom | Cause | Action |
|---|---|---|
| Commissioning failed at "validate_request": objective is not Active | Objective status | Activate the Objective. |
| a Strategic Objective is a programme umbrella | Tier | Decompose and commission a leaf Objective. |
| objective has been decomposed further | The Objective has children | Commission a leaf. |
| this Objective is already assigned to an SEU | One SEU per Objective | Open the existing SEU. |
| only one Profile may be selected | More than one choice | Select one Profile. |
| profile does not target any of the given Templates | Profile and Template mismatch | Choose the Profile's own Template. |
| Validation shows Dead for a Pack | Pack has no Active version | Activate a version, then request again. |
| SEU Failed at `finalize_commissioning` | The activating user lacks an SEU badge | Grant the badge. No transition leaves Failed, and the Objective stays assigned to the Failed SEU. |
| SEU stays Activated | Commence-work Policy or Pack Obligation | Resolve the listed Obligation. |
| No participants offered in Assign | Eligibility | Check tenant, Capability, competency and Policy behaviour context. |
| EBM Retired | A reference stopped being live | Repair the reference and compose again. |
