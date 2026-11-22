# Part 2. SEU Commissioning

Commissioning turns one Objective into one running SEU (Software Engineering Unit). It selects a Template and a Profile, validates every reference, composes the Engineering Behavior Model (EBM), activates the EBM, creates the SEU's runtime assets and brings the SEU to Operational.

## 1. Summary of the flow

| # | Step | Page | Who acts | Badge | Result |
|---|---|---|---|---|---|
| 1 | Create and activate the Objective | Objectives | Sponsor | `objective_propose`, then `objective_activate` | Objective is Active. |
| 2 | Choose a Profile and Save | Objective, Commission SEU | Commissioner | `seu_commission` | SEU row in Initiated. CommissionInitiated published. |
| 3 | Validate | Commission SEU, Validate button | Commissioner | `seu_validate` | SEU Validated and CommissionValidated, or SEU Failed. |
| 4 | Compose EBM | Compose EBM | Commissioner | `seu_commission` | EBM in Composed state. The SEU stays Validated. |
| 4a | Resolve conflicts, then Validate | Resolve Conflicts | Commissioner | `seu_commission` | EBM created in Composed state. |
| 5 | Validate EBM | SEU detail, EBM | Reviewer | `ebm_validate`, and `ebm_activate` for the activation that follows | EBM Validated and then Active, or EBM Retired. Finalization starts. |
| 6 | Finalize commissioning | none | Automatic | Held by the activating user | SEU Configured, Commissioned, Activated. Capabilities and Deliverables exist. |
| 7 | Commence work | none | Automatic | Held by the activating user | SEU Operational, if the commence-work checks pass. |
| 8 | Fulfil Capabilities | SEU detail, Capability Fulfilment | Staffing lead | none on the route | Participants assigned. Work can be dispatched. |

## 2. Before you start

| Requirement | Where to check |
|---|---|
| The Objective is Active, is not Strategic, has no children and has no SEU yet. | Objectives |
| At least one Template is Active and a Profile whose base Template is that Template is Active. | Templates, Profiles |
| Every Pack the Template and Profile name has an Active version. | Packs |
| Every Service the Profile overrides has an Active version. | Service Definitions |
| The commissioning user holds `seu_commission` (Save and Compose EBM) and `seu_validate` (Validate). | Identity |
| The user who validates the EBM holds `ebm_validate` and `ebm_activate`, and the SEU badges listed in section 8. | Identity |
| Participants exist for the Capabilities the SEU needs. | Participants |

## 3. Objectives

### 3.1 Tiers

| Tier | May be a root | Allowed children | May own an SEU |
|---|---|---|---|
| Strategic | Yes | Operational, Engineering | No. It is a programme umbrella. |
| Operational | No | Engineering | Yes, when it has no children. |
| Engineering | No | none | Yes. |

A child cannot be more strategic than its parent. A parent accepts children while it is Defined or Active.

### 3.2 Create an Objective

1. Open Objectives. Choose New for a root, or Add child on an Objective and choose the child tier.
2. Enter the statement.
3. Select the required Capabilities from the Ontology. A child starts with its parent's selection.
4. Save. This needs `objective_propose`. The Objective starts as Defined.

A new Objective can replace an existing one with the supersede option on the New page.

### 3.3 Move an Objective

| Action | Badge | Notes |
|---|---|---|
| Edit, move to another parent, delete | `objective_propose` | Allowed while the Objective is Defined. |
| Activate (Defined to Active) | `objective_activate` | One step. There is no submit step. |
| Achieve (Active to Achieved) | `objective_achieve` | The transition is governed. The web pages have no control for it. |
| Reject, Supersede | `objective_reject`, `objective_supersede` | A comment is required. Supersede also names the successor Objective of the same tenant. |
| Retire (from Active) | `objective_retire` | Retire on the detail page retires the Active descendants as well. Others are skipped. |
| Archive | `objective_archive` | From Achieved, Superseded or Retired. |

The buttons on the detail page come from the Transition Definitions and appear for a holder of the badge. Comments can be added to an Objective without a badge.

## 4. Start commissioning

1. Open the Active Objective and choose Commission an SEU from this Objective. The page lists every available Profile as a card, with its Template.
2. Select exactly one Profile.
3. Choose Save. The button appears for a holder of `seu_commission`.

The platform then:

1. Creates the SEU in the Initiated state under the Objective's tenant.
2. Publishes CommissionInitiated.
3. Shows "SEU saved. Validate it to continue commissioning." and a Saved SEU panel with one button per allowed next step.

An Objective accepts one SEU. Saving again with the same Profile reuses the Initiated SEU. Any other second request is refused. A Failed SEU keeps the Objective assigned.

## 5. Validate

Choose Validate on the Saved SEU panel. The button needs `seu_validate`. The hop Initiated to Validated runs the checks below. The Commission Validation page then lists each check with the result Live or Dead.

| Check | Live when |
|---|---|
| Objective | Status is Active. |
| Profile | Status is Active. |
| Template | Status is Active. |
| Each Pack | An Active version, visible to the SEU's tenant, exists. The list comes from the Template's Mandatory Packs and the Profile's selections. |
| Each Service whose parameters the Profile overrides | An Active version exists. |

Outcomes:

| Outcome | Event | SEU state |
|---|---|---|
| All checks Live | CommissionValidated | Validated |
| Any check Dead | CommissionFailed (stage `validate_request`, with the dead references) | Failed |

## 6. Compose the EBM

The EBM is the effective set of behaviours for this SEU. It combines the Packs of the Template and Profile into one settled result.

1. Open Compose EBM for the Objective and choose Compose. Compose keeps the composition as a draft on the SEU and creates no EBM. The SEU remains Validated. The Resolve Conflicts screen follows.
2. Review the composed Packs, the Profile details and any warnings.
3. On Resolve Conflicts, each tab is one table of the composition. A tab shows the conflicts of that table and the result the SEU takes from it.

| Tab | Content |
|---|---|
| Services | The Service chosen for each Deliverable, and the work item types picked for it. |
| Capabilities | A Capability a Pack names that no Service of the Deliverables names. |
| Policies | A Policy code with different rules in different Packs, different Policies with different rules for the same Deliverable and step, and Policies verified by a person. |
| Authority rules | Authority rules that differ between Packs. |
| Quality gates | Quality Gates that differ between Packs. |
| Review gates | Review Gates that differ between Packs. |
| Obligation definitions | Obligation Definitions that differ between Packs. |
| Engineering capital | Entries with no link, and different links for one type. |
| Dependencies | A Pack dependency on another Pack that is not met. |
| Checklists, Competencies, Profile configuration | The settled result of each. |

4. Resolve each open conflict. The action depends on the kind of conflict.

| Action | Applies to | Effect |
|---|---|---|
| Pick one | Service choice, service level, Policies with the same code | The picked option is kept. |
| Pick any | Work item types, Policies with different codes, Authority rules, Quality Gates, Review Gates, Obligation Definitions, Engineering Capital links | The picked options are kept. |
| Include or exclude | Capabilities no Service names, Engineering Capital entries with no link | The row is kept or dropped. The page offers Include all remaining and Exclude all remaining. |
| None | Human-verified Policies, unmet or incompatible Pack dependencies | Shown for information. The Pack set must change to remove them. |

5. When no conflict is open, the Validate button of Resolve Conflicts is enabled. Validate publishes CompositionCompleted and the system creates the EBM. The page shows "The EBM is being created. Wait for the page to refresh."

Composition errors set the SEU to Failed with stage `compose_ebm`.

The EBM records:

- the composed Packs and the composition report,
- the settled result of each table, with the picks applied, the resolved conflicts and the recorded conflicts,
- the Quality Gate Definitions the SEU takes,
- the Transition-scope Policies the SEU takes, split into SEU-scoped Policies and entity-scoped Policies.

The EBM starts in the Composed state.

## 7. Validate and activate the EBM

Open the SEU and use the EBM controls.

| Action | Badge | Effect |
|---|---|---|
| Validate | `ebm_validate`, and `ebm_activate` for the second hop | The platform re-checks that the Template, Profile and every composed Pack are still live. When all are live the EBM moves Composed to Validated and then Validated to Active in one action. Finalization starts in the background. |
| Retire | `ebm_retire` | Composed to Retired. |
| Activate | `ebm_activate` | Offered when the EBM is Validated and not yet Active. |

If any reference is no longer live, Validate sets the EBM to Retired, publishes EBMRetired and raises an Attention Item of category EBM Retired that lists the references. Compose again after the references are repaired.

## 8. Finalization

Activating the EBM publishes EBMActivated. A background handler runs finalization with the identity of the user who activated the EBM. That user must hold `seu_configure`, `seu_commission` and `seu_activate`, or `root`. Any finalization error, including a missing badge or an EBM with no settled result, sets the SEU to Failed with stage `finalize_commissioning`.

Finalization performs these steps in order:

1. Creates a system Participant for the SEU.
2. Creates one SEU Capability for every Capability the EBM settled.
3. Creates one Deliverable in the Defined state for every Deliverable the EBM settled. Each Deliverable receives a producing Capability when a settled Capability lists the Deliverable code. A Deliverable without a producing Capability cannot be dispatched.
4. SEU Validated to Configured (SEUConfigured) and Configured to Commissioned (SEUCommissioned).
5. Saves the commissioning report: identity, composition, validation and runtime sections.
6. SEU Commissioned to Activated (SEUActivated).

## 9. Commence work

SEUActivated starts the commence-work attempt. The SEU moves from Activated to Operational (verb operationalise, governed) when all of these hold:

| Check | If it fails |
|---|---|
| The acting user holds `seu_operationalise`, or `root`. | The SEU stays Activated. |
| The SEU-scoped Policies for Activated to Operational are satisfied. | An Obligation is raised and the SEU shows a Blocked badge. |
| The Packs raise no Obligation Definitions for this hop. | The Obligations are raised and the SEU stays Activated. |

The attempt repeats when an Obligation of the SEU that holds this hop, or an Attention Item raised against the SEU, reaches a resolved state. Resolve the Obligation to continue. When the SEU becomes Operational, SEUOperational is published and the governed start of Deliverables begins (Part 3).

## 10. Fulfil Capabilities

An SEU needs Participants before work can be dispatched. When the SEU is Operational and a Deliverable becomes ready, the platform requests fulfilment of its producing Capability and assigns the whole eligible pool. Assign by hand to choose the Participants. Open the SEU, tab Capability Fulfilment.

1. Each required Capability is listed with its status.
2. Choose Assign for a Capability and select one or more Participants. Selecting more than one gives a Composite fulfilment. The page shows "Capability requested." and the assignment is made in the background after CapabilityRequested. Without a selection the whole eligible pool is assigned. An empty pool publishes CapabilityUnavailable (Part 3, section 5.8).
3. Choose Replace to swap a Participant, or Release to remove one.

A Participant is eligible when all of these hold:

| Rule | Source |
|---|---|
| The Participant belongs to the SEU's tenant. | Participant record |
| The Participant lists the Capability. | Participant record |
| The Participant matches the SEU's competency requirements, for every dimension. | EBM settled result |
| The Participant holds one of the roles of the Capability in its Role competency. No limit applies when the Capability has no roles. | Capability Definition |
| The Participant's behaviour context satisfies each Eligibility-scope Policy the EBM settled. | EBM settled result |
| The Participant has not been released from this Capability. | Fulfilment history |

Each assignment creates a Participant engagement for the SEU and publishes CapabilityFulfilled. A Deliverable already In Progress then receives its producing Command (Part 3, section 4).

A user created in Identity receives a Human Participant record. The Participants page lists all Participant records with type and tenant.

## 11. SEU lifecycle

| State | Entered by | Verb badge | Trigger |
|---|---|---|---|
| Initiated | Save on the commission form (birth) | `seu_commission` | manual |
| Validated | Validate button | `seu_validate` | manual |
| Failed | Validation, composition or finalization failure | `seu_fail` | governed |
| Configured | Finalization | `seu_configure` | governed |
| Commissioned | Finalization | `seu_commission` | governed |
| Activated | Finalization | `seu_activate` | governed |
| Operational | Commence work | `seu_operationalise` | governed |
| Suspended, Operational | Suspend, Resume | `seu_suspend`, `seu_resume` | manual |
| Retired, Archived | Retire, Archive | `seu_retire`, `seu_archive` | manual |

Manual buttons appear on the SEU pages for a holder of the badge. No transition leaves Failed.

The Transition Definitions also hold a second chain for the SEU (Composed, RuntimeAllocated, KnowledgeInitialised, ParticipantsRecruited). No code moves an SEU through those states. Commissioning uses the chain in the table above.

## 12. Troubleshooting

| Symptom | Cause | Action |
|---|---|---|
| objective is not Active (status: Defined) | Objective status | Activate the Objective, then Save again. |
| a Strategic Objective is a programme umbrella | Tier | Decompose and commission a leaf Objective. |
| objective has been decomposed further | The Objective has children | Commission a leaf. |
| this Objective is already assigned to an SEU | One SEU per Objective | Open the existing SEU. |
| Choose a Profile to commission against. | No Profile selected | Select one Profile and Save. |
| Validation failed: ... | A reference is Dead | Repair the reference. The SEU is Failed, so commission against a new Objective. |
| Validation shows Dead for a Pack | Pack has no Active version | Activate a version, then request again. |
| SEU Failed at `finalize_commissioning` | A finalization error, for example the activating user lacks an SEU badge | Read the CommissionFailed event reason and repair it. No transition leaves Failed, and the Objective stays assigned to the Failed SEU. |
| SEU stays Activated | Commence-work Policy or Pack Obligation | Resolve the listed Obligation. |
| No participants offered in Assign | Eligibility | Check tenant, Capability, competency and Policy behaviour context. |
| EBM Retired | A reference stopped being live | Repair the reference and compose again. |
