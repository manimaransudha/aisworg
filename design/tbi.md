# To be implemented

This is my notes. Not to be used for any implementation source of truth. Anything that needs an implementation will be specifically a CR.
Claude agents should not update this.

## Cross-cutting

- Create a UI to show the EventBus (events table) filterable by SEU id
- Packs can contribute to Ontology
- UI similar to marketplace extensions
- Show behavior trees 
- Build capability packs (ecosystem-specific patterns for asynchronous operations, module structure, and error handling)

## Chapter 1 - Objective
1. User identifier 1.1, 1.1.1 three tiers
1. OBJ-003/FR-1.3: Every Objective shall declare, or allow derivation of, the Capabilities required to achieve it. 
NFR: remain reproducible: given the same Objective and Pack set, the same required Capabilities shall always be derived. 
*[Remarks: Something is implemented. Check if it is meaningful. It does not impact SEU because this layer does not finalise the capabilities. Maybe initial thought was to "intelligently" suggest capabilities ; Potentially pricing should be initiated from here.]*

2. FR-1.6: Objective state changes shall be governed and fully traceable. 
*[Remarks: Check for completeness]*

3. Objective lifecycle: An Active Objective may instead transition to **Superseded** (replaced by a revised Objective) or **Retired** (abandoned without replacement) *[Remarks: This transition has not been implemented. Check if there is a CR]*

4. Missing fields: 

5. Engineering Knowledge Graph *[Remarks: Create a CR - Show the Engineering Knowledge Graph visually from an Objective]*

6. Events:

Lifecycle implementation is incomplete. 

Proposed - Active (this is participant invoked transition)

Active - Propose (this is participant invoked transition)
Active - Achieved  (this should be governance)
Active - Retired (this is participant invoked transition ; can sometimes be governed??)
Active - Superseded (this is participant invoked transition)

Achieved - Archived

- When an objective is created, it should be in the draft state. objective_propose is the badge to propose. This should not see the lifecycle actions. If the badge has access to do the transition, it should be shown as an action button in the objectives list page. If no transition access is present for a user, only view button should be shown. When a transition button is clicked, the objectives should be opened and the lifecycle transition button "Active" should be shown(which is the current implementation where the transition happens.) There should be a comment field so the user can add notes and send it back to proposed state. 

- There is a retire button. Check the functionality. 

- Delete in a proposed state is correct.
- ObjectiveProposed
- ObjectiveActivated
- ObjectiveAchieved
- ObjectiveSuperseded
- ObjectiveRetired
- ObjectiveArchived

7. Objective registry. *[Remarks: the registry is not named as such, but objectives are listed and can be navigated through. At a tenant level this should become an engineering capital asset]*

8. Implementation specifics:
- 18.1 can be marked closed
- 18.3 can be marked closed
- 18.4 is open. Deliverables are part of template. That will not change. Traceability has to be established.
- 18.7 can be marked closed
- 18.10 can be marked closed
- 18.11 can be marked closed

9. Sponsoring Authority / tenant: tenant_id is already there. If a tenant wants to expand Sponsoring Authority, we should handle it through multi-tenancy. So keep it open for now. 

10. Defects

- In the objectives UI, only objectives corresponding to the tenant should be visible. Objectives created by root/platform users should be visible only to platform users. 
*[Remarks: This is the first scoping. When we get to multi-tenant, there will be more scoping]*

Chapter 5

1. a re-published Pack version can mutate a shared contributed object in place - this should also bump up the version as this is a definition change for the pack. why are we not doing this?

2. pack codes have been using capability codes ; versioning is correct. Feeding back to ontology when a publishing happens. Also "packCode": "development", in dependencies should point to capability code, not the pack code or both ? Have a type so only capabilities are filtered. Service name has to be Ontology

3. Implementation of installation classification - where does this fall?

4. Check composition

5. Is there a capability flag?

