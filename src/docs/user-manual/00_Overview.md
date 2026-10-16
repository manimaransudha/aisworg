# SEU Studio User Manual

## Parts

| Part | File | Audience |
|---|---|---|
| 1. SDK Authoring | [01_SDK_Authoring.md](01_SDK_Authoring.md) | Authors of the declarative definitions: Ontology, Capabilities, Services, Deliverables, Policies, Packs, Templates, Profiles, Transition Definitions. |
| 2. SEU Commissioning | [02_SEU_Commissioning.md](02_SEU_Commissioning.md) | Sponsors and commissioners who turn an Objective into a running SEU. |
| 3. Execution Engine | [03_Execution_Engine.md](03_Execution_Engine.md) | Everyone who works inside an Operational SEU, including the Trust Pipeline and Governance. |

The parts follow the order in which the platform is used. Part 1 produces the definitions. Part 2 composes them for one Objective. Part 3 describes what happens while the SEU runs.

## Conventions used in every part

### Badges

- Authority is held as a badge named `noun_verb` in lower case, for example `pack_define`, `objective_activate`, `seu_commission`, `deliverable_approve`, `qualitygate_waive`.
- The noun is the governed entity. The verb is the transition or authoring action.
- The `root` badge satisfies every badge check.
- The `participant` role gates the read-only registry pages and the Attention page.
- A button appears only when the signed-in user holds the badge that the action needs.
- Badges are granted on Settings, Identity (users and badges) by an `identity_manage` holder, or by a `tenant_admin` for users in their own tenant.
- Every route has a row in the route authority table. A route without a row is denied.

### Menus

| Menu | Entries |
|---|---|
| SEU Platform | Dashboard, Quick View, Objectives, SEUs |
| Governance | Attention, Telemetry, Knowledge Capital |
| Registry | Capability Definitions, Participants, Packs, Templates, Profiles, Deliverable Definitions, Service Definitions, Policy Definitions, Schema Registry |
| Authoring | Pack, Template, Profile, Transition Definition, Deliverable, Service, Policy, Capability |
| Ontology | One entry per Ontology concept type, Metadata, Approvals |
| Settings | Identity, Tenant Admin users, Route Authority, Data Migrations, Events, Version Events |

A menu entry is shown when the user's badges satisfy that route.

### Lists

Every list supports search, column sorting and paging. State values are shown as coloured state badges.

### Lifecycles

Every entity moves only along its Transition Definitions. A Transition Definition names the verb. The verb and the entity give the badge. A transition can be `manual` (a person clicks a button) or `governed` (the engine performs it when its conditions hold).

### Tenancy

Objects belong to a tenant. A user sees the Platform tenant's published definitions and the user's own tenant's definitions.

### Identifiers used in this manual

- Source paths are given relative to the repository root, for example `src/domain/engine/executionEngine.ts`.
- Page paths are given relative to `/aisworg/seu`.
