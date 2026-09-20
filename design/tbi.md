# To be implemented

**This file should not be loaded into the context** 

This is my notes. Not to be used for any implementation source of truth. Anything that needs an implementation will be specifically a CR.
Claude agents should not update this.

## Cross-cutting

~~- Create a UI to show the EventBus (events table) filterable by SEU id~~
- Packs can contribute to Ontology
- UI similar to marketplace extensions
- Show behavior trees 
- Build capability packs (ecosystem-specific patterns for asynchronous operations, module structure, and error handling)
- After an event is published, there should be no more logic unless there is a governed transition

## Chapter 1 - Objective
  
- Objective lifecycle: An Active Objective may instead transition to **Superseded** (replaced by a revised Objective) or **Retired** (abandoned without replacement) *[Remarks: This transition has not been implemented. Check if there is a CR]*

- Engineering Knowledge Graph *[Remarks: Create a CR - Show the Engineering Knowledge Graph visually from an Objective]*

- Multi-tenancy should define a client contract and strategic objectives should be scoped to a client contract. Move should scope to a contract.

- Active to Retire: SEU_id does not exist. Disable commissioning against the parent. Allow commissioning against the retired objective. 
- Active to Supersede: SEU_id exists: Carry forward the parent SEU_id to the new one. Supersede should be an Engineering decision. Include this payload to the superseded objective. 
 

- Objective registry. *[Remarks: the registry is not named as such, but objectives are listed and can be navigated through. At a tenant level this should become an engineering capital asset]*

Objective page - Buttons in a single column - layout is clumsy

## Chapter 5 - Pack

1. a re-published Pack version can mutate a shared contributed object in place - this should also bump up the version as this is a definition change for the pack. why are we not doing this?

3. Implementation of installation classification - where does this fall?

4. Check composition

Capability:
Is just a bare slot (similar to  a phase with no definition; definition is in the packs)

Reach for packs: Platform packs will be available to all users of the platform"
- This should be a tenant configuration. address it in multi-tenancy

Classification applies to the contributions that are *checked*. The rest inform or provide, and are not classified.

| Contribution (§9) | Typical classification |
|---|---|
| Checklists | per item; span all three |
| Quality Gates | mostly machine-verifiable |
| Review Gates | judgment (AI-assessed, human-ratified) by nature |
| Obligation Definitions | machine-verifiable (evidence present) or human-attested (approval obtained) |
| Policies / Standards / Decision Rules | machine-verifiable where objective, judgment where interpretive |
| Ontology, Knowledge Assets, Templates, UI Components, Services, Metrics | not classified — inputs and assets, not checks |

By Pack taxonomy (§6), the weight differs:

- **Technology packs** — mostly machine-verifiable (conventions, build, test).
- **Compliance packs** — a mix of machine-verifiable (evidence present) and human-attested (approvals, sign-offs).
- **Domain and architecture concerns** — largely judgment.
- **Integration packs** — external-evidence (machine-verifiable via connectors).
- **Platform and Organisation packs** — spread across all three.

Engineering Behaviour, Engineering Templates, Engineering Metrics, Reusable Components, 

## Chapter 6 - Template

- **List the packs available based on what is in the objectives**

## Chapter 11 - Service

- Check service lifecycle thoroughly. Only one service can be active. When one is activated, the previous version has to be deprecated. this is not done. 
- User service registry to also add a new capability code that feeds into ontology. 
- Service versioning. 

when a capability is chosen, the corresponding services have to be chosen in the services tab. What is editable is only the service levels and that has to be stored as part of the contributionServices[] array. I am supposing this array is a jsonb within the pack row. 

## Chapter 38 

- Pack recomposition updates active EBM - Not implemented
Pack retiring should notify EBM owners and recomposition updates should be materialised. 
- Lifecycle testing
- Pack dependency graph (dependency declaration is present) and 
- Pack compatibility not implemented. Compatibility to be checked before activation
- Export as json & schema validator. Take existing templates and convert them

## Chapter 28

- Instead of being monolithic, break the runtime kernel separately


So: commissioning gets the SEU to Operational, but that only means the SEU is now in the state where its Deliverables are eligible to move. Actual execution starts only when a human (or an API caller) transitions one of this SEU's own Deliverables — e.g. Defined → In Progress — through the SEU detail page or the Deliverables API. That transition is what calls transitionDeliverable, which calls executionEngine.execute, which creates the Command, generates the Work Item, and calls dispatchEngine.dispatch (which then requires an eligible Participant to actually fulfil the producing Capability, or the dispatch is deferred).

One thing I checked and did not find: there's no code-level gate anywhere in transitionDeliverable that requires seus.lifecycle_state === 'Operational' before allowing a Deliverable transition — it's a conceptual precondition (Ch.2's own lifecycle), not an enforced one in the current build. So technically a Deliverable could be dispatched even if the owning SEU weren't Operational yet; nothing checks.


-------------


The Template commissionIsolatedSeu builds has no required Capabilities at all (setRequiredCapabilities(template.id, [])), so the Deliverable's producing_capability_id is null.

The fixture's own comment (cr109-work-item-generator.test.ts:160) says: "no producing Capability declared, so dispatch is unconditional" — but that's not what dispatchEngine.ts actually does. Case 1a there (!input.producingCapabilityId) calls rejectDispatch — a hard, terminal rejection (Command → Failed, an Obligation + Attention Item raised), not an unconditional pass-through.

So in the failing test (line 320, CR-109 §6.1: ... Approved-with-Conditions), the transitionDeliverable call at line 342 requests the hop, but the resulting Command is rejected immediately (no capability → Case 1a). The test then calls waitForDispatchedWorkItem(deliverableId, "Defined", "In Progress") at line 352, which polls for a Command reaching Dispatched/Deferred — a state it can never reach, since it's already Failed. That's the timeout error in the log.

This is a stale assumption in the fixture, not a bug in dispatchEngine.ts — case 1a's hard-reject behavior is real, documented, intentional design (confirmed earlier this session while fixing the Idle/Available bug). Two ways to fix the fixture, your call:

Give the Template a real required Capability and fulfil it with a genuine eligible Participant (same pattern used everywhere else this session) so the Command actually dispatches for real — closest to what the test's later assertions (execution_context.governingPolicies, .activeObligations) seem to want, since those live on the dispatched Work Item.
Stop expecting dispatch at all — assert the Command reaches Failed (matching real Case 1a behavior) and check the Work Item's execution_context at whatever status it lands at (if workItemGenerator.ts populates it at generation time, before dispatch is even attempted, it may still be readable off a Disposed/rejected Work Item).