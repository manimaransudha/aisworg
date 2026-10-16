# Part 1. SDK Authoring

SDK Authoring covers every declarative definition of the platform. A definition describes what can exist. It does not run. Execution is described in Part 3.

## 1. What is authored

| Definition | Authoring page | Registry page | Lifecycle |
|---|---|---|---|
| Ontology concept | Ontology menu | Ontology menu | Draft, Active, Deprecated, Retired, Archived |
| Capability | `sdk/capability-authoring` | `capability-definitions` | Defined, Published, Active, Deprecated, Retired, Archived |
| Service | `sdk/service-authoring` | `service-definitions` | Defined, Published, Active, Deprecated, Retired, Archived |
| Deliverable definition | `sdk/deliverable-authoring` | `deliverable-definitions` | Draft, Validated, Published, Active, Deprecated, Retired, Archived |
| Policy | `sdk/policy-authoring` | `policy-definitions` | Draft, Validated, Published, Active, Deprecated, Retired, Archived |
| Pack | `sdk/pack-authoring` | `packs` | Draft, Validated, Published, Active, Retired, Archived |
| Template | `sdk/template-authoring` | `templates` | Draft, Validated, Published, Active, Deprecated, Retired, Archived |
| Profile | `sdk/profile-authoring` | `profiles` | Draft, Validated, Published, Active, Deprecated, Retired, Archived |
| Transition Definition | `sdk/transition-definition-authoring` | same page | Added and retired in place |
| Schema definition | `sdk/schema-registry` | same page | Created, Validated, Tested, Packaged, Published |

## 2. Recommended authoring order

1. Ontology concepts. Every coded value in a form is chosen from the Ontology.
2. Capabilities, then Services (each Service names one Capability), Deliverable definitions and Policies.
3. Packs that contribute Capabilities, Services, Policies, Checklists, Review Gates, Quality Gates, Obligation Definitions and Engineering Capital.
4. Templates that select Packs and declare a Deliverable catalogue.
5. Profiles that fix a Template's parameters for one environment.
6. Transition Definitions, when a new lifecycle hop or badge binding is required.

Each step refers to the previous one by code. A reference to a definition with no Active version is rejected at validation or at commissioning.

## 3. The common authoring workflow

The same workflow applies to Pack, Template, Profile, Deliverable, Service, Policy and Capability.

### 3.1 Create

1. Open the authoring page. It lists the definitions visible to the user with Code, Name, Status, Created and Actions.
2. Choose New. This needs the `<kind>_define` badge, for example `pack_define`.
3. Complete the generated form. The form is built from the published schema of that kind (section 9). Coded fields offer an Ontology picker with the concept description shown as guidance. A field marked as Ontology-composable lets the author propose a new concept in place (section 7).
4. Choose Create draft. The row is created in the first state with the creator recorded as author.

### 3.2 Edit

| Control | Effect |
|---|---|
| Save draft | Stores the form content. Required fields and enumerations are validated. |
| Next version | Raises the version field by one patch number (x.y.z becomes x.y.z+1). The version field is read only and changes only through this button. |
| JSON import | Fills the form from a pasted JSON document. |
| Add another / Remove | Adds or removes a row in a list field such as Dependencies or a contribution section. |
| Compose from sources | Pack only. See section 4.3. |

Save the draft before using an advance button. The page prompts when there are unsaved changes.

### 3.3 Advance through the lifecycle

- The Actions column and the draft page show one button per allowed next step.
- The button label is the verb of the next transition, for example Validate, Publish, Activate.
- A button is shown only to a holder of `<kind>_<verb>`.
- A different holder can take each step, so one author can define and a second person can publish.
- The forward path Draft to Validated to Published to Active is advanced one step at a time. Retire, Deprecate, Archive and Reject are separate buttons.
- Validation runs when a draft moves out of Draft. The step is refused with the list of errors when the content is invalid.
- Rejecting a Pack to Draft requires a comment.

Pack steps accept alternate badges. Draft to Validated accepts `pack_validate`, `pack_define` or `pack_reject`. Validated to Draft accepts `pack_reject` or `pack_validate`.

### 3.4 Versions

Only an Active version is usable. Publishing a new version of the same code supersedes the previous Active version. Existing SEUs keep the Pack versions captured in their Engineering Behavior Model.

## 4. Packs

A Pack is the unit of contribution. It is declarative only.

### 4.1 Identity fields

| Field | Meaning |
|---|---|
| code, name, description | Identity. The code is unique per tenant and version. |
| category | One of Compliance, Domain, Engineering, Organisation, Integration, Technology (Ontology `category:pack`). |
| packVersion | Semantic version. |
| installationClassification | Mandatory, Recommended, Optional or Conditional. A Mandatory Pack is composed into every Template. |
| dependencies | Other Packs required. |
| minSupportedPlatformVersion, maxSupportedPlatformVersion, supportedPlatformVersion | Platform version bounds. |
| incompatiblePackVersions, migrationGuidance | Compatibility notes. |

### 4.2 Contribution sections

| Section | Content |
|---|---|
| contributionCapabilities | Abilities introduced, such as software-construction. Chosen from Ontology `capability-name`. |
| contributionServices | Work products. Each entry names a Service Definition whose Capability is declared in the same Pack. |
| contributionPolicies | Canonical Policy Definitions the Pack adopts. |
| contributionChecklists | A name, a description and ordered items. An item can carry a configurable dimension and value pair that a Template can expose and a Profile can filter. |
| contributionReviewGates | Verifiable review requirements for a governed transition, for example `Deliverable|In Progress|Approved`. |
| contributionQualityGates | Pass or fail criteria for one transition (entity, from state, to state). |
| contributionObligationDefinitions | Obligations the Pack can raise, each with a category, title, origin and priority. |
| contributionEngineeringCapital | Engineering Behaviour, Engineering Metrics, Reusable Components or Engineering Templates, each with a type and a location. |
| contributionCompetencies | Competencies the Pack expects of Participants. |
| contributionAuthorityRules | Legacy role authorisations. New Packs rely on the platform `noun_verb` badges. |

A Review Gate item has these fields:

| Field | Values and meaning |
|---|---|
| statement | The claim to verify, in plain language. |
| classification | `machine-verifiable` (a tool checks it and records Evidence), `judgment` (an AI assessment that a human accepts as a Review), `human-attested` (a human attests directly). |
| prompt | The instruction handed to the assigned Participant. |
| participant | AI, AI with human, or human only. |
| outputContract | `passed-failed-notes` or `assessment-acceptance`. |
| externalEvidence | Set when verification comes from an external system such as a CI run. |
| checklistIds, recommendedChecklistIds | Checklists of the same Pack that are required or advisory for the gate. |

### 4.3 Composition

Composition builds a new Draft from existing Packs. Set the Composition Strategy and the source Pack codes on the draft, save, then choose Compose from sources.

| Strategy | Sources | Result |
|---|---|---|
| specialization | exactly 1 | Copies the parent and allows overrides. |
| override | 0 | Uses the normal Next version flow. The prior Active version is superseded when the new version is activated. |
| merge | 2 or more, same code | Keeps agreed values and reports conflicts. |
| union | 2 or more | Combines values. |
| intersection | 2 or more | Keeps only values on which all sources agree. |
| supplement | 2 or more | Takes a base and adds from the others. |

Conflict detection runs inside merge and union and is not selected on its own. Every source must have an Active version. Only a Draft can be composed.

## 5. Templates

A Template groups Packs and declares what an SEU produces.

| Field | Meaning |
|---|---|
| code | Chosen from the Ontology `template-categories`. |
| name, purpose, templateVersion | Identity. |
| compliancePackCodes, domainPackCodes, engineeringPackCodes, integrationPackCodes, organisationPackCodes, technologyPackCodes | One list per Pack category. Each list accepts Packs of its own category only. |
| deliverableCatalogue | The Deliverables created when an SEU is commissioned. Each entry has a Deliverable code. |
| dependencyGraph | Edges between Deliverables and Capabilities. Each edge has `toCode`, `fromType` (Deliverable or Capability), `fromCode` or `fromCapabilityCode`, an optional `requiredState` and an optional relationship kind. |
| exposedParameters | Parameters of a Service, Policy, Checklist or Dependency that a Profile may set. Each has `sourceType`, `sourceCode`, `parameterName`, `value` and `overridable`. |

Notes:

- The Capabilities a Template requires are derived from its Packs.
- Mandatory Packs are added automatically.
- A tenant author can start from a published Platform or tenant Template with Inherit. The code is locked to the parent and all content is editable.
- The dependency graph decides when a Deliverable may move (Part 3, section 6).

## 6. Profiles

A Profile configures one Template for one environment. Exactly one Profile is chosen at commissioning.

| Group | Fields |
|---|---|
| Identity | name, baseTemplateCode, environment (development, staging, production), profileVersion, description, readme, domain |
| Extra Packs | optionalPackCodes, plus domain, compliance, technology, engineering, integration and organisation lists |
| Capabilities | additionalCapabilityCodes |
| Parameters | exposedParameterOverrides, limited to parameters the Template marks as overridable |
| Delivery configuration | developmentMethodology, primaryProgrammingLanguage, sourceControlProvider, targetCloudProvider, deploymentStrategy, aiProviderPreference, defaultRepositoryStructure, documentationLevel, deploymentTargets, environmentConfiguration, featureFlagCodes, participatingOrganisationCodes, knowledgeLocations |
| Dispatch | dispatchStrategyPreference (ordered list), redispatchMaxAttempts, redispatchAttentionThreshold |

The allowed values for the delivery configuration fields are Ontology concepts of the type `profile-configuration` and the matching value types (for example `deployment-strategy`: blue-green, canary, rolling, recreate).

Dispatch strategies available in the Ontology:

| Strategy | Selection rule |
|---|---|
| capability-match | First available candidate. This is the default. |
| specialist-preference | A candidate with Expert proficiency in any competency. |
| cost-optimisation | The lowest cost among candidates that have a cost. |
| confidence-optimisation | The candidate with the most prior engagements. |
| load-balancing | The candidate with the fewest active Work Items. |
| locality-preference | A candidate that previously served the same Objective. |
| organisation-preference | A candidate whose Organisation competency matches `participatingOrganisationCodes`. |

Strategies are tried in order. The first that yields a candidate wins.

A tenant author can start from a published Profile with Inherit.

## 7. Ontology

The Ontology holds every coded value. Examples of concept types are `capability-name`, `deliverable-name`, `service-name`, `category:pack`, `category:policy`, `category:quality-gate`, `category:obligation`, `installation-classification`, `composition-strategy`, `dispatch-strategy-preference`, `proficiency-level`, `participant-types` and `authorised-role`.

| Task | Where |
|---|---|
| View concepts of one type | Ontology menu, choose the type |
| Add a concept | Ontology page, Add |
| Deprecate, retire, archive | Ontology page |
| Edit labels and metadata | Ontology, Metadata |
| Compose a concept from sources | Ontology page, Compose |
| Approve or reject a proposed concept | Ontology, Approvals |

Every task except Approvals needs one of the badges `ontology_define` or `ontology_manage`, or the `sdk_author` role. Approvals needs the `ontology_approve` badge together with the `sdk_author` role.

Lifecycle:

1. A new concept starts as Draft and publishes a ConceptCreated event.
2. An approver accepts it (Draft to Active) or rejects it with mandatory feedback (it stays Draft).
3. An Active concept can be Deprecated, then Retired, then Archived.

A form field marked Ontology-composable lets an author propose a concept without leaving the form. The proposal is a Draft until approved.

A tenant can define aliases for concept labels. The API paths are `GET/POST /aisworg/api/seu/tenants/:id/aliases` and `GET /aisworg/api/seu/tenants/:id/vocabulary`.

## 8. Transition Definitions and the authority vocabulary

### 8.1 Transition Definitions

Open `sdk/transition-definition-authoring`. The table shows Entity, From, To, Verb, Badge (noun_verb), Authority rule, Policies, Gates and Status.

| Field | Meaning |
|---|---|
| entityType, fromState, toState | One hop. The triple is unique. |
| verb | Names the badge. The badge is the entity noun joined to the verb. |
| requiredPolicyCodes | Policy Definitions that must hold for the hop. |
| requiredQualityGateCodes | Quality Gates that must pass for the hop. |
| requiredAuthorityRuleCode | Optional authority rule. |
| createsObligation | Obligation raised by the hop. |
| trigger | `manual` or `governed`. |
| eventType | The event published when the hop completes. |
| versionEvent | The version event published for Version Management. |
| submitVerb | A preliminary submit step that must precede the hop (for example Objective Proposed to Active needs `objective_propose` first). |
| attestationRequired | Records an attestation when the hop completes (Part 3, section 9). |

Add, Edit, View and Retire need the `transitiondefinition_define` badge.

A new entity or hop is created with its event type and version event set at the same time.

### 8.2 Authority vocabulary

Open Nouns, Verbs and Mapping from the same area. A noun is a work outcome. A verb is a work process. The mapping lists the verbs allowed for each noun and can set the trigger for a mapped verb. Authoring verbs (define, publish, propose, waive, observe, identify) are mapped to nouns here. Adding, retiring and editing entries needs `transitiondefinition_define`.

## 9. Schema Registry

Each authorable kind has a versioned schema. The authoring forms are generated from the latest published schema of the kind.

1. Open `sdk/schema-registry`. Access needs the `root` badge or the `sdk_author` role. Publishing and rejecting need the `sdk_author` role.
2. Choose New to add a field or a new version of a schema. The page shows a review step before saving.
3. Publish the schema version, or Reject it. A schema moves Created, Validated, Tested, Packaged, Published. Rejection at the last step gives PublicationRejected.
4. New forms and validation use the new version immediately.

## 10. Administration

| Task | Page | Badge or role |
|---|---|---|
| Create tenants | Identity, Tenants | `root` |
| Create users and set roles | Identity, Users | `identity_manage` |
| Edit badge types | Identity, Badges | `identity_manage` |
| Grant badges to users of one tenant | Tenant Admin, Users | `tenant_admin` role |
| Edit route requirements | Route Authority | `root` |
| Run data migrations | Data Migrations | `root` |
| Inspect events | Events | `superuser` role |
| Inspect version events | Version Events | `superuser` role |
| Read implementation notes | Docs | `superuser` role |

Creating a user also creates a Human Participant record for the user. The user receives an email verification link. When mail is not configured the page shows the link.

Every new route needs a row in the route authority table. A route without a row is denied.

## 11. Common errors

| Message | Cause | Action |
|---|---|---|
| You don't have the required badge for that. | The user lacks `<kind>_define` or the verb badge. | Ask an `identity_manage` holder for the badge. |
| "field" is required | A required schema field is empty. | Complete the field. |
| must be one of ... | A value is outside the enumeration or Ontology. | Pick from the list or propose the concept. |
| choose a Composition Strategy before composing | No strategy saved on the draft. | Save the strategy and sources first. |
| Composition Strategy "x" requires N composition source(s) | Source count does not match the strategy. | Adjust the sources. |
| composition source Pack "x" has no Active version | A source is not Active. | Activate the source. |
| No governed publish is available from `<state>` | The state has no forward hop. | Use the transition buttons. |
