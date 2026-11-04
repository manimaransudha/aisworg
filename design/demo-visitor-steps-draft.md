# Demo visitor-action steps: draft for review

Status: draft. Nothing here is in `steps.json` or the database.

Each row is one `visitor-action` step. The visitor performs it on the real page. A scenario is a playbook that lists step codes in order.
Routes are relative to `/aisworg/seu`. They become the `payload.routes` allow list of the step. `:id` stands for a row id.
Handlers come later. A step keeps its code when a handler replaces the visitor action.

Tab column: D = Declare, C = Commission, E = Execute.

## 1. Ontology

| Code | Tab | Visitor does | Routes |
|---|---|---|---|
| open-ontology | D | Open SDK / Ontology and choose a concept type. | GET /sdk/ontology |
| propose-ontology-code | D | Add a new code under a concept type. The code is a proposal. | POST /sdk/ontology/add |
| review-ontology-approvals | D | Open Ontology Approvals and find the pending code. | GET /sdk/ontology/approvals |
| approve-ontology-code | D | Approve the pending code. | POST /sdk/ontology/approvals/approve |
| reject-ontology-code | D | Reject a pending code with a reason. | POST /sdk/ontology/approvals/reject |
| compose-ontology-code | D | Compose a code from existing codes. | POST /sdk/ontology/compose |


## 2. Pack

| Code | Tab | Visitor does | Routes |
|---|---|---|---|
| find-pack-in-registry | D | Open Registry / Packs and find the Pack. | GET /packs |
| open-pack-authoring | D | Open SDK / Pack Authoring and choose New Pack. | GET /sdk/pack-authoring, GET /sdk/pack-authoring/new |
| create-pack-draft | D | Enter code, name, category, version and classification. Create the draft. | POST /sdk/pack-authoring, GET /sdk/pack-authoring/:id, POST /sdk/pack-authoring/:id/save |
| import-pack-contributions | D | Paste a Pack document into the JSON import card and import it. | POST /sdk/pack-authoring/:id/import |
| compose-pack | D | Choose a Composition Strategy and source Packs on the draft, save, then Compose from sources. | POST /sdk/pack-authoring/:id/save, POST /sdk/pack-authoring/:id/compose |
| validate-pack | D | Validate the Pack. | POST /sdk/pack-authoring/:id/transition |
| publish-pack | D | Publish the Pack. | POST /sdk/pack-authoring/:id/publish |


## 3. Template

| Code | Tab | Visitor does | Routes |
|---|---|---|---|
| browse-templates | D | Open Registry / Templates. | GET /templates |
| copy-template | D | Copy an existing Template into a new draft. | POST /templates/:id/copy |
| open-template-authoring | D | Open SDK / Template Authoring and choose New Template. | GET /sdk/template-authoring, GET /sdk/template-authoring/new |
| create-template-draft | D | Enter the Template details and create the draft. | POST /sdk/template-authoring, POST /sdk/template-authoring/:id/save |
| select-template-packs | D | Select the Packs the Template composes and save the draft. | POST /sdk/template-authoring/:id/save |
| validate-template | D | Validate the Template. | POST /sdk/template-authoring/:id/transition |
| publish-template | D | Publish the Template. | POST /sdk/template-authoring/:id/publish |

## 4. Profile

| Code | Tab | Visitor does | Routes |
|---|---|---|---|
| browse-profiles | D | Open Registry / Profiles. | GET /profiles |
| copy-profile | D | Copy an existing Profile into a new draft. | POST /profiles/:id/copy |
| open-profile-authoring | D | Open SDK / Profile Authoring and choose New Profile. | GET /sdk/profile-authoring, GET /sdk/profile-authoring/new |
| create-profile-draft | D | Enter the Profile details and create the draft. | POST /sdk/profile-authoring, POST /sdk/profile-authoring/:id/save |
| select-profile-packs | D | Select the Packs the Profile uses and save the draft. | POST /sdk/profile-authoring/:id/save |
| create-profile-change-service-level | D | Set the service level on the Profile and save. | POST /sdk/profile-authoring/:id/save |
| validate-profile | D | Validate the Profile. | POST /sdk/profile-authoring/:id/transition |
| publish-profile | D | Publish the Profile. | POST /sdk/profile-authoring/:id/publish |

## 5. Definitions

| Code | Tab | Visitor does | Routes |
|---|---|---|---|
| browse-capability-definitions | D | Open Registry / Capability Definitions. | GET /capability-definitions |
| copy-capability-definition | D | Copy a Capability Definition into a new draft. | POST /capability-definitions/:id/copy |
| author-capability-definition | D | Create, save, validate and publish a Capability Definition in SDK / Capability Authoring. | GET /sdk/capability-authoring/new, POST /sdk/capability-authoring, POST /sdk/capability-authoring/:id/save, POST /sdk/capability-authoring/:id/transition, POST /sdk/capability-authoring/:id/publish |
| browse-deliverable-definitions | D | Open Registry / Deliverable Definitions. | GET /deliverable-definitions |
| copy-deliverable-definition | D | Copy a Deliverable Definition into a new draft. | POST /deliverable-definitions/:id/copy |
| author-deliverable-definition | D | Create, save, validate and publish a Deliverable Definition in SDK / Deliverable Authoring. | GET /sdk/deliverable-authoring/new, POST /sdk/deliverable-authoring, POST /sdk/deliverable-authoring/:id/save, POST /sdk/deliverable-authoring/:id/transition, POST /sdk/deliverable-authoring/:id/publish |
| browse-service-definitions | D | Open Registry / Service Definitions. | GET /service-definitions |
| copy-service-definition | D | Copy a Service Definition into a new draft. | POST /service-definitions/:id/copy |
| author-service-definition | D | Create, save, validate and publish a Service Definition in SDK / Service Authoring. | GET /sdk/service-authoring/new, POST /sdk/service-authoring, POST /sdk/service-authoring/:id/save, POST /sdk/service-authoring/:id/transition, POST /sdk/service-authoring/:id/publish |
| browse-policy-definitions | D | Open Registry / Policy Definitions. | GET /policy-definitions |
| copy-policy-definition | D | Copy a Policy Definition into a new draft. | POST /policy-definitions/:id/copy |
| author-policy-definition | D | Create, save, validate and publish a Policy Definition in SDK / Policy Authoring. | GET /sdk/policy-authoring/new, POST /sdk/policy-authoring, POST /sdk/policy-authoring/:id/save, POST /sdk/policy-authoring/:id/transition, POST /sdk/policy-authoring/:id/publish |
| author-transition-definition | D | Create, save, validate and publish a Transition Definition in SDK / Transition Definition Authoring. | GET /sdk/transition-definition-authoring/new, POST /sdk/transition-definition-authoring, POST /sdk/transition-definition-authoring/:id/save, POST /sdk/transition-definition-authoring/:id/transition, POST /sdk/transition-definition-authoring/:id/publish |
| browse-schema-registry | D | Open Registry / Schema Registry. | GET /sdk/schema-registry |
| browse-participants | D | Open Registry / Participants. | GET /participants |

## 6. Authority

| Code | Tab | Visitor does | Routes |
|---|---|---|---|
| view-authority-nouns | D | Open the authority nouns. | GET /authority/nouns |
| add-authority-noun | D | Add a noun. | POST /authority/nouns/add |
| view-authority-verbs | D | Open the authority verbs. | GET /authority/verbs |
| add-authority-verb | D | Add a verb. | POST /authority/verbs/add |
| view-authority-mapping | D | Open the noun and verb mapping. | GET /authority/mapping |
| add-authority-mapping | D | Map a verb to a noun. | POST /authority/mapping/add |
| edit-authority-trigger | D | Change the trigger of a mapping. | POST /authority/mapping/edit-trigger |
| view-transition-definition | D | Open a transition definition. | GET /authority/transition-definitions/:id |
| edit-transition-definition | D | Edit a transition definition and save. | GET /authority/transition-definitions/:id/edit, POST /authority/transition-definitions/:id/update |
| grant-user-badge | D | Open Tenant Users and grant a badge to a user. | GET /tenant-admin/users, POST /tenant-admin/users/:id/badges |

## 7. Objective

| Code | Tab | Visitor does | Routes |
|---|---|---|---|
| browse-objectives | C | Open Objectives. | GET /objectives |
| propose-objective | C | Choose New under a parent Objective, enter the details and create it. | GET /objectives/new, POST /objectives |
| open-objective | C | Open an Objective. | GET /objectives/:id, GET /objectives/:id/children |
| edit-objective | C | Edit the Objective and save. | GET /objectives/:id/edit, POST /objectives/:id/update |
| move-objective | C | Move the Objective under another parent. | POST /objectives/:id/move |
| comment-on-objective | C | Add a comment. | POST /objectives/:id/comments |
| activate-objective | C | Activate the Objective. | POST /objectives/:id/transition/activate |
| supersede-objective | C | Supersede the Objective. | POST /objectives/:id/transition/supersede |
| retire-objective | C | Retire the Objective. | POST /objectives/:id/transition/retire |
| archive-objective | C | Archive the Objective. | POST /objectives/:id/transition/archive |
| reject-objective | C | Reject a proposed Objective. | POST /objectives/:id/transition/reject |
| delete-objective | C | Delete a draft Objective. | POST /objectives/:id/delete |
| validate-commission | C | Check the Objective is ready to commission. | GET /objectives/:id/validate-commission |
| compose-ebm | C | Compose the Evidence-Based Model for the Objective. | GET /objectives/:id/compose-ebm, POST /objectives/:id/compose-ebm |

## 8. SEU

| Code | Tab | Visitor does | Routes |
|---|---|---|---|
| browse-seus | C | Open SEUs. | GET /seus |
| commission-seu | C | Choose New SEU, select the Objective, Template and Profile, and commission. | GET /seus/new, POST /seus |
| open-seu | C | Open an SEU. | GET /seus/:id |
| move-seu-state | C | Move the SEU to its next lifecycle state. | POST /seus/:id/transition/:verb |
| view-ebm | C | Open the Evidence-Based Model of the SEU. | GET /seus/:id/ebm |
| move-ebm-state | C | Move the Evidence-Based Model to its next state. | POST /seus/:id/ebm/transition/:verb |
| fulfil-capability | C | Fulfil a Capability with a Participant. | POST /seus/:id/capabilities/:capabilityId/fulfil |
| replace-participant | C | Replace the Participant on a Capability. | POST /seus/:id/capabilities/:capabilityId/participant/:participantId/replace |
| release-capability | C | Release a Capability. | POST /seus/:id/capabilities/:capabilityId/release |

## 9. Work

| Code | Tab | Visitor does | Routes |
|---|---|---|---|
| open-work-queue | E | Open the work queue of the SEU. | GET /seus/:id/work-queue |
| complete-work-item | E | Complete a work item. | POST /seus/:id/work-items/:workItemId/complete |
| transition-deliverable | E | Move a Deliverable to its next state. | POST /seus/:id/deliverables/:deliverableId/transition |
| transition-obligation | E | Move an Obligation to its next state. | POST /seus/:id/obligations/:obligationId/transition/:verb |
| revise-obligation | E | Revise an Obligation. | POST /seus/:id/obligations/:obligationId/revise |

## 10. Evidence, knowledge, decisions

| Code | Tab | Visitor does | Routes |
|---|---|---|---|
| record-evidence | E | Record Evidence against an Obligation. | POST /seus/:id/evidence |
| validate-evidence | E | Validate the Evidence. | POST /seus/:id/evidence/:evidenceId/validate |
| transition-evidence | E | Move the Evidence to its next state. | POST /seus/:id/evidence/:evidenceId/transition/:verb |
| link-evidence | E | Link the Evidence to another record. | POST /seus/:id/evidence/:evidenceId/link |
| record-knowledge | E | Record a Knowledge item. | POST /seus/:id/knowledge |
| transition-knowledge | E | Move the Knowledge item to its next state. | POST /seus/:id/knowledge/:knowledgeItemId/transition/:verb |
| promote-knowledge-scope | E | Promote the Knowledge item to a wider scope. | POST /seus/:id/knowledge/:knowledgeItemId/promote-scope |
| view-knowledge-capital | E | Open Knowledge Capital. | GET /knowledge/capital |
| record-decision | E | Record a Decision. | POST /seus/:id/decisions |
| transition-decision | E | Move the Decision to its next state. | POST /seus/:id/decisions/:decisionId/transition/:verb |
| record-external-interaction | E | Record an external interaction. | POST /seus/:id/external-interactions |
| transition-external-interaction | E | Move the external interaction to its next state. | POST /seus/:id/external-interactions/:interactionId/transition |

## 11. Review, attention, compliance

| Code | Tab | Visitor does | Routes |
|---|---|---|---|
| open-reviews | E | Open the reviews of the SEU. | GET /seus/:id/reviews |
| start-review | E | Start a review. | POST /seus/:id/reviews |
| transition-review | E | Move the review to its next state. | POST /seus/:id/reviews/:reviewId/transition/:verb |
| raise-review-finding | E | Raise a Finding in the review. | POST /seus/:id/reviews/:reviewId/findings |
| transition-finding | E | Move the Finding to its next state. | POST /seus/:id/findings/:findingId/transition/:verb |
| convert-finding-to-obligation | E | Convert the Finding into an Obligation. | POST /seus/:id/findings/:findingId/convert |
| raise-attention-item | E | Raise an Attention item (Blocker or Risk). | POST /seus/:id/attention-items |
| transition-attention-item | E | Resolve, release or waive an Attention item on the SEU. | POST /seus/:id/attention-items/:attentionItemId/transition/:verb |
| open-attention | E | Open Attention across SEUs. | GET /attention |
| transition-attention-from-list | E | Move an Attention item from the Attention list. | POST /attention/:id/transition/:verb |
| open-compliance | E | Open the compliance view of the SEU. | GET /seus/:id/compliance |
| waive-obligation | E | Record a waiver. | POST /seus/:id/compliance/waivers |

## 12. Observe

| Code | Tab | Visitor does | Routes |
|---|---|---|---|
| open-dashboard | E | Open the dashboard. | GET /, GET /dashboard/demo |
| open-telemetry | E | Open Telemetry. | GET /telemetry |
| open-events | E | Open Events. | GET /events |
| open-version-events | E | Open Version Events. | GET /version-events |

## Open points

| Point | Note |
|---|---|
| Steps that move through several states | One step names one hop. A scenario repeats the step for each hop. |
| `author-*-definition` steps | Each bundles create, save, validate and publish. Split them as in the Pack rows if you prefer one action per step. |
| Authority and Tenant Users steps | These need a Superuser or admin badge. The guide grants authority per scenario. |
| Existing steps | The five `release-governance-*` visitor steps overlap rows 1 to 7 of section 2. They stay as they are. |


## Reviewed / Baselined steps

|Step                               |Status       |
|-----------------------------------|-------------|
|open-ontology                      | complete    |
|propose-ontology-code              | pending     |
|review-ontology-approvals          | pending     |
|approve-ontology-code              | pending     | 
|reject-ontology-code               | pending     |
|compose-ontology-code              | pending     |
|ontology-what-note                 | complete    |
|find-pack-in-registry-note         | complete    |
|find-pack-in-registry              | complete    |
|capability-definitions-note        | complete    |
|browse-capability-definitions      | complete    |
|copy-capability-definition-note    | complete    |
|copy-capability-definition         | complete    |

## Reviewed / Baselined scenarios

|Scenario                            |Status       |
|------------------------------------|-------------|
|view-existing-ontology              | complete    |
|create-new-ontology                 | pending     |
|view-existing-capability-definitions| pending     |

 