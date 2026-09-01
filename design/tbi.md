# To be implemented

This is my notes. Not to be used for any implementation source of truth. Anything that needs an implementation will be specifically a CR.
Claude agents should not update this.

## Cross-cutting

~~- Create a UI to show the EventBus (events table) filterable by SEU id~~
- Packs can contribute to Ontology
- UI similar to marketplace extensions
- Show behavior trees 
- Build capability packs (ecosystem-specific patterns for asynchronous operations, module structure, and error handling)

## Chapter 1 - Objective
1. OBJ-003/FR-1.3: Every Objective shall declare, or allow derivation of, the Capabilities required to achieve it. 
NFR: remain reproducible: given the same Objective and Pack set, the same required Capabilities shall always be derived. 
*[Remarks: Something is implemented. Check if it is meaningful. It does not impact SEU because this layer does not finalise the capabilities. Maybe initial thought was to "intelligently" suggest capabilities ; Potentially pricing should be initiated from here.]*

2. FR-1.6: Objective state changes shall be governed and fully traceable. 
*[Remarks: Check for completeness]*

3. Objective lifecycle: An Active Objective may instead transition to **Superseded** (replaced by a revised Objective) or **Retired** (abandoned without replacement) *[Remarks: This transition has not been implemented. Check if there is a CR]*

5. Engineering Knowledge Graph *[Remarks: Create a CR - Show the Engineering Knowledge Graph visually from an Objective]*

~~6. Write scenarios for edit/delete/activate/reject - a thorough analysis is required.~~

~~7. Check event bus~~

8. Multi-tenancy should define a client contract and strategic objectives should be scoped to a client contract. Move should scope to a contract.

- There is a retire button. Check the functionality. 

~~- Delete in a proposed state is correct.~~

7. Objective registry. *[Remarks: the registry is not named as such, but objectives are listed and can be navigated through. At a tenant level this should become an engineering capital asset]*



 

Chapter 5

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