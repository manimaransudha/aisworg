# Part 1. SDK Authoring

SDK Authoring covers every declarative definition of the platform. A definition describes what can exist. It does not run. Execution is described in Part 3.

## 1. What is authored

| Definition | Authoring page | Registry page | Lifecycle |
|---|---|---|---|
| Ontology concept | Ontology menu | Ontology menu | Draft, Active, Deprecated, Retired, Archived |
| Capability | `sdk/capability-authoring` | `capability-definitions` | Defined, Validated, Published, Active, Deprecated, Retired, Archived |
| Service | `sdk/service-authoring` | `service-definitions` | Defined, Validated, Published, Active, Deprecated, Retired, Archived |
| Deliverable definition | `sdk/deliverable-authoring` | `deliverable-definitions` | Draft, Validated, Published, Active, Deprecated, Retired, Archived |
| Policy | `sdk/policy-authoring` | `policy-definitions` | Draft, Validated, Published, Active, Deprecated, Retired, Archived |
| Quality Gate Definition | `sdk/quality-gate-authoring` | `quality-gate-definitions` | Draft, Validated, Published, Active, Deprecated, Retired, Archived |
| Pack | `sdk/pack-authoring` | `packs` | Draft, Validated, Published, Active, Retired, Archived |
| Template | `sdk/template-authoring` | `templates` | Draft, Validated, Published, Active, Deprecated, Retired, Archived |
| Profile | `sdk/profile-authoring` | `profiles` | Draft, Validated, Published, Active, Deprecated, Retired, Archived |
| Transition Definition | `sdk/transition-definition-authoring` | same page | Added and retired in place |
| Schema definition | `sdk/schema-registry` | same page | Created, Validated, Tested, Packaged, Published |

## 2. Recommended authoring order

1. Ontology concepts. Every coded value in a form is chosen from the Ontology.
2. Capabilities, then Services (each Service names one Capability), Deliverable definitions, Policies and Quality Gate Definitions.
3. Packs that contribute Capabilities, Services, Policies, Checklists, Review Gates, Quality Gates, Obligation Definitions and Engineering Capital.
4. Templates that select Packs and declare a Deliverable catalogue.
5. Profiles that fix a Template's parameters for one environment.
6. Transition Definitions, when a new lifecycle hop or badge binding is required.

Each step refers to the previous one by code. A reference to a definition with no Active version is rejected at validation or at commissioning.

## 3. The common authoring workflow

The same workflow applies to Pack, Template, Profile, Deliverable, Service, Policy, Quality Gate and Capability.

### 3.1 Create

1. Open the authoring page. It lists the definitions visible to the user with Code, Name, Status, Created and Actions.
2. Choose New. This needs the `<kind>_define` badge, for example `pack_define`. The Deliverable kind uses `deliverabledefinition_define`.
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

Save the draft before using an advance button. The advance button is disabled as soon as any field changes, and is enabled again by the page that loads after a save.

### 3.3 Advance through the lifecycle

- The Actions column and the draft page show one button per allowed next step.
- The button label is the verb of the next transition, for example Validate, Publish, Activate.
- A button is shown only to a holder of `<kind>_<verb>`.
- A different holder can take each step, so one author can define and a second person can publish.
- The forward path Draft to Validated to Published to Active is advanced one step at a time. Retire, Deprecate, Archive and Reject are separate buttons.
- Validation runs on the hop out of Draft and again on the hop to Published. The step is refused with the list of errors when the content is invalid.
- Publishing a Template or a Profile unravels it into its tables (catalogue, Pack selections, dependency graph, parameter overrides). The step is refused when the content cannot be unravelled.
- Activating a Pack writes the rows its contributions name: Capabilities, Services, authority rules, Policies, Checklists, Review Gates and Quality Gates. A failure leaves the Pack Published.
- Rejecting a Pack, Template or Profile to Draft, or a Service to Defined, requires a comment.
- Capability, Deliverable, Policy and Quality Gate have no Reject step.

The Pack, Template, Service and Ontology routes under `/aisworg/api/seu` answer 501 Not implemented. The authoring pages are the supported path.

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
| dependencies | Other Packs. Each entry has a `packCode`, a `type` (required, optional, conditional or incompatible; the default is required) and a `version`. |
| minSupportedPlatformVersion, maxSupportedPlatformVersion, supportedPlatformVersion | Platform version bounds. |
| incompatiblePackVersions, migrationGuidance | Compatibility notes. |

### 4.2 Contribution sections

| Section | Content |
|---|---|
| contributionCapabilities | Abilities introduced, such as software-construction. Chosen from Ontology `capability-name`. |
| contributionServices | Work products. Each entry has a `code` (a Service Definition whose Capability is declared in the same Pack), a `serviceDefinitionId` (the exact Service Definition version the Pack composes) and optional `serviceLevel` overrides. Each override has a `code` and a numeric `target`. |
| contributionPolicies | Canonical Policy Definitions the Pack adopts. |
| contributionChecklists | A name, a description and ordered items. An item can carry a configurable dimension and value pair that a Template can expose and a Profile can filter. |
| contributionReviewGates | Verifiable review requirements for a governed transition (`governedTransition`, for example `Deliverable|In Progress|Approved`). Each has a `code` (the Deliverable type the Review Gate is for, from Ontology `deliverable-name`) and a name. |
| contributionQualityGates | The Quality Gates the Pack applies. Each entry names an Active Quality Gate Definition by `qualityCode` and says where it applies. The fields of an entry are listed below. |
| contributionObligationDefinitions | Obligations the Pack can raise. Required: `code`, `category`, `severity`. Optional: title, description, origin, priority, completionCriteria, requiredEvidence (title, category, description, collection method), and the verification fields `participant`, `classification`, `outputContract`, `prompt`, `assurance` and `externalEvidence`. `applicabilityDeliverables` lists the Deliverables it applies to, each with a name, its transitions and a governing condition. |
| contributionEngineeringCapital | Engineering Behaviour, Engineering Metrics, Reusable Components or Engineering Templates, each with a type and a URL. |
| contributionCompetencies | Competencies the Pack expects of Participants, each a dimension and a value. |
| contributionAuthorityRules | Legacy role authorisations (code, authorised role, governed transition). New Packs rely on the platform `noun_verb` badges. |

A Quality Gate Definition holds what the gate is: its code (Ontology `quality-gate-name`), name, description, category, `criteriaType` (Part 3, section 8) and, for the Evidence criterion, its `evidenceCategory`. It also carries the verification fields `statement`, `assurance`, `participant` (AI, AI+human or human), `classification`, `outputContract`, `prompt` and `externalEvidence`, with the meanings given for a Review Gate item below. It holds no transition, Checklist, Policy or Deliverable. The Pack entry supplies those.

A Quality Gate entry in a Pack has these fields:

| Field | Values and meaning |
|---|---|
| qualityCode | The code of an Active Quality Gate Definition of the tenant. Required. Each code can appear once in a Pack. |
| governedTransition | The transition the gate governs, as `EntityType|from|to`, for example `Deliverable|In Progress|Approved`. The transition must exist. Required. |
| deliverableName | The Deliverable the gate applies to, chosen from Ontology `deliverable-name`. Empty means every Deliverable at the transition. For the Accepted Review criterion it also names the Review Gate that must be accepted, so it is required there. |
| checklists | A list of Checklists of the same Pack, each with a `checklistId` and a `mandatory` flag. A Checklist is optional unless `mandatory` is set. Every listed Checklist must exist in the Pack, whatever the flag. |
| requiredPolicyCodes | Policy Definitions that must hold. Each must be a Policy the Pack adopts. The Active Policy criterion requires at least one. |

When the Pack is published, the platform writes the Quality Gate from the Definition and this entry. The mandatory Checklists become the gate's required Checklists. The others become its recommended Checklists.

A Review Gate item has these fields:

| Field | Values and meaning |
|---|---|
| statement | The claim to verify, in plain language. |
| assurance | The assurance level of the item. |
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
| specialization | exactly 1 | Copies the parent, identity fields included, and allows overrides. |
| override | 0 | Uses the normal Next version flow. The prior Active version is superseded when the new version is activated. |
| merge | 2 or more, same code | Keeps agreed values and reports conflicts. |
| union | 2 or more | Combines values. |
| intersection | 2 or more | Keeps only values on which all sources agree. |
| supplement | 2 or more | The first source is the base. Fields from the others are added. A field the base already has is not applied and is reported. |

Conflict detection runs inside merge and union and is not selected on its own. Merge needs every source to share one code. Every source must have an Active version. Only a Draft can be composed. Composition is available for Packs only.

## 5. Templates

A Template groups Packs and declares what an SEU produces.

| Field | Meaning |
|---|---|
| code | Chosen from the Ontology `template-categories`. |
| name, purpose, templateVersion | Identity. |
| compliancePackCodes, domainPackCodes, engineeringPackCodes, integrationPackCodes, organisationPackCodes, technologyPackCodes | One list per Pack category. Each list accepts Packs of its own category only. |
| deliverableCatalogue | The Deliverables created when an SEU is commissioned. Each entry has a Deliverable code. |
| dependencyGraph | Edges between Deliverables and Capabilities. Each edge has `toCode`, `fromType` (Deliverable or Capability), `fromCode` or `fromCapabilityCode`, an optional `requiredState` and an optional `relationshipKind` (dependency, derivation, implementation or decomposition; the default is dependency). |
| exposedParameters | Parameters of a Service, Policy, Checklist or Dependency that a Profile may set. Each has `sourceType`, `sourceCode`, `parameterName`, `value` and `overridable`. |

Notes:

- The Capabilities a Template requires are derived from its Packs.
- Mandatory Packs are added automatically.
- A tenant author can start from a published Platform or tenant Template with Inherit. Profiles and Deliverable definitions offer Inherit in the same way. The code is locked to the parent and all content is editable.
- The dependency graph decides when a Deliverable may move (Part 3, section 6).

## 6. Profiles

A Profile configures one Template for one environment. Exactly one Profile is chosen at commissioning.

| Group | Fields |
|---|---|
| Identity | name, baseTemplateCode, environment (development, staging, production), profileVersion, description, readme, domain |
| Extra Packs | optionalPackCodes, plus domain, compliance, technology, engineering, integration and organisation lists |
| Deliverables | deliverableCatalogue and dependencyGraph. A new Profile starts with the catalogue of its base Template. Remove the entries the Profile does not need. A Service Level override of a Service that makes none of the remaining Deliverables is rejected when the Profile is saved. |
| Parameters | exposedParameterOverrides, limited to parameters the Template marks as overridable |
| AI providers | aiProviderPreference and aiProviderCredentials. Each credential has a `provider`, an `endpoint` (Simulated or Anthropic) and an `apiKey`. Simulated uses no tokens. The key is needed for the Anthropic endpoint only and is shown masked after it is saved. |
| Delivery configuration | developmentMethodology, primaryProgrammingLanguage, sourceControlProvider, targetCloudProvider, deploymentStrategy, aiProviderPreference, defaultRepositoryStructure, documentationLevel, deploymentTargets, environmentConfiguration, featureFlagCodes, participatingOrganisationCodes, knowledgeLocations |
| Dispatch | dispatchStrategyPreference (ordered list), redispatchMaxAttempts, redispatchAttentionThreshold |
| Composition options | compositionOptions. The field is stored for documentation and is not enforced by the Composition Engine. |

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

## 6A. Capabilities, Services, Deliverable definitions, Policies and Quality Gates

These kinds follow the common workflow (section 3). Their fields come from the published schema of each kind.

### Capability

| Field | Meaning |
|---|---|
| code, defaultLabel, description | Identity. The code becomes a `capability-name` concept. |
| category | Ontology `category:capability`. |
| roles | The roles the Capability decomposes into, each with the worktypes it covers. Capability fulfilment is matched against them. |

The Role Registry page (`roles`) lists each role with its description, its work item types and the Capabilities whose roles name it. It is read only.

### Service

| Field | Meaning |
|---|---|
| code, name, purpose | Identity. |
| capabilityCode | The single Capability the Service is aligned to. |
| inputs, outputs | Deliverable codes the Service consumes and produces. A Deliverable names its producing Capability through the outputs of an Active Service (Part 2, section 8). |
| success, governance | Plain-language success criterion and governing standard. |
| consumers | Capability codes that consume the Service. |
| serviceLevel | Expectations, each with code, label, units, target and target_level (minimum, maximum or exact). A label containing "turnaround" sets the dispatch target time (Part 3, section 5.3). |

### Deliverable definition

| Field | Meaning |
|---|---|
| code | A `deliverable-name` concept. |
| name | Required. A new definition takes it from the Ontology label of its code. |
| description | Plain-language description. |
| guideLocation | Where the format or guide for the Deliverable is kept. A Work Item for the Deliverable shows it as its input location. |
| definitionVersion | Semantic version, for example 1.0.0. |

### Quality Gate Definition

The fields are listed in section 4.2. Creation needs `qualitygate_define`. The Quality Gate Registry page lists the definitions of the Platform and of the user's tenant. A Pack adopts a definition by `qualityCode`.

### Policy

| Field | Meaning |
|---|---|
| code, name, category, description | Identity. Category is Ontology `category:policy`. |
| scope | Transition (default) governs a state hop. Eligibility governs the choice of Participants for a Capability. |
| constraintType | Policy blocks the hop when the condition fails. Standard records a deviation and lets the hop continue. |
| applicabilityEnvironments | Environments the Policy governs. Empty matches every environment. |
| conditions | One or more conditions. Each has a statement and a severity (both required), the evidence required (title, category, description, collection method), the Obligations raised on violation (category and severity required), exception rules and the Deliverables and transitions it governs. An exception rule has a statement, a duration, a scope, approvers (Authority Vocabulary badges), a composition (all or any approvers) and review requirements. Exception rules apply to the constraint type Policy only. |

A condition names the Deliverables and the transitions (`Entity|From|To`) it governs. A condition with no transition governs `Deliverable|Approved|Baselined`. Each Deliverable row carries a governing condition of type `always_true`, `always_false`, `field_in`, `comparison` or `threshold`. A row with no type is attested by a person and the engine does not check it.

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


## 8. Transition Definitions and the authority vocabulary

### 8.1 Transition Definitions

Open `sdk/transition-definition-authoring`. The table shows Entity, From, To, Verb, Badge (noun_verb), Authority rule, Policies, Gates and Status.

| Field | Meaning |
|---|---|
| entityType, fromState, toState | One hop. The triple is unique. A row whose fromState is `None` is the birth row of the entity. It gives the initial state, the creation verb, the creation badge and the creation event. |
| verb | Names the badge. The badge is the entity noun joined to the verb. |
| requiredPolicyCodes | Policy Definitions that must hold for the hop. |
| requiredQualityGateCodes | Quality Gates that must pass for the hop. |
| requiredAuthorityRuleCode | Optional authority rule. |
| createsObligation | Obligation raised by the hop. |
| trigger | `manual` or `governed`. |
| eventType | The event published when the hop completes. |
| versionEvent | The version event published for Version Management. |
| submitVerb | A preliminary submit step that must precede the hop. No seeded row uses it. |
| actionCode | Optional action that runs inside the hop, for example `validate-seu-request` on the SEU hop Initiated to Validated. |
| attestationRequired | Records an attestation when the hop completes (Part 3, section 9). |

Add, Edit, View, Retire and Refresh cache need the `transitiondefinition_define` badge.

A new entity or hop is created with its event type and version event set at the same time.

### 8.2 Authority vocabulary

Open Nouns, Verbs and Mapping from the same area. A noun is a work outcome. A verb is a work process. The mapping lists the verbs allowed for each noun and can set the trigger for a mapped verb. Authoring verbs (define, publish, propose, waive, observe, identify) are mapped to nouns here. Adding, retiring and editing entries needs `transitiondefinition_define`.

## 9. Schema Registry

Each authorable kind has a versioned schema. The authoring forms are generated from the latest published schema of the kind.

1. Open `sdk/schema-registry`. Access needs the `root` badge or the `sdk_author` role. Publishing needs the `schemadefinition_publish` badge and rejecting needs the `schemadefinition_reject` badge.
2. Choose New to add a field or a new version of a schema. The page shows a review step before saving.
3. On the schema version page, use the Publish or Reject button. Each button appears for a holder of its badge. A schema moves Created, Validated, Tested, Packaged, Published. Rejection at the last step gives PublicationRejected.
4. New forms and validation use the new version immediately.

## 10. Administration

| Task | Page | Badge or role |
|---|---|---|
| Create tenants | Identity, Tenants | `root` |
| Create users and set roles | Identity, Users | `identity_manage` |
| Edit badge types | Identity, Badges | `identity_manage` |
| Grant badges to users of one tenant | Tenant Admin, Users | `tenant_admin` role |
| Edit route requirements | Route Authority (card on the Identity page) | `root` |
| Run data migrations | Data Migrations | `root` |
| Inspect events | Events | `superuser` role |
| Inspect version events | Version Events | `superuser` role |
| Read implementation notes | Docs | `superuser` role |

Creating a user also creates a Human Participant record for the user. The user receives an email verification link. When mail is not configured the page shows the link.

Every new route needs a row in the route authority table. A route without a row is denied. The Route Authority and Data Migrations pages need the `root` badge and have no row.

## 11. Common errors

| Message | Cause | Action |
|---|---|---|
| You don't have the required badge for that. | The user lacks `<kind>_define` or the verb badge. | Ask an `identity_manage` holder for the badge. |
| You don't hold the required badge(s) for this action: ... | A route or action needs a badge the user lacks. | Ask an `identity_manage` holder for the badge. |
| "field" is required | A required schema field is empty. | Complete the field. |
| must be one of ... | A value is outside the enumeration or Ontology. | Pick from the list or propose the concept. |
| choose a Composition Strategy before composing | No strategy saved on the draft. | Save the strategy and sources first. |
| Composition Strategy "x" requires exactly or at least N composition source(s), got M. | Source count does not match the strategy. | Adjust the sources. |
| Composition Strategy "x" requires every composition source to share the same code | Merge sources differ in code. | Use sources with one code. |
| only a Draft can be composed | The Pack is past Draft. | Compose from a Draft. |
| composition source Pack "x" has no Active version. | A source is not Active. | Activate the source. |
| No governed `<step>` is available from `<state>`. | The state has no such hop. | Use the transition buttons. |
