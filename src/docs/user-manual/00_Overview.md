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
- The `participant` role gates the read-only registry pages and the Attention page. The `sdk_author` role gates the authoring pages. The `superuser` role gates Events, Version Replay and Documentation. The `demo` role gates the Demo pages.
- A button appears only when the signed-in user holds the badge that the action needs.
- Badges are granted on Settings, Identity Management (users and badges) by an `identity_manage` holder, or by a `tenant_admin` for users in their own tenant.
- Every route has a row in the route authority table. A route without a row is denied. The Route Authority and Data Migrations pages are the exception. They are checked in the gate itself and need the `root` badge.

### Menus

| Menu | Entries |
|---|---|
| SEU Platform | Dashboard (or Demo Dashboard), Objectives, All SEUs, Participants, Demo Participants |
| Governance | Attention, Telemetry, Engineering Capital |
| Registry | Capability Registry, Role Registry, Service Registry, Deliverable Registry, Pack Registry, Template Registry, Profile Registry, Policy Registry, Quality Gate Registry, Participant Registry, Schema Registry |
| Authoring | Capability, Service, Quality Gate, Deliverable, Pack, Template, Profile, Policy, Transition Definition |
| Ontology | One entry per Ontology concept type, Metadata, Approvals |
| Settings | Identity Management, Tenant User Management, Event Bus, Version Replay, Data Migrations. Route Authority opens from a card on the Identity page. |
| Demo | ArchVault Demo for the `demo` role. Demo Administration for the `root` badge. |
| Documentation | All Documentation, plus one entry per top-level folder of `src/docs`. Visible to the `superuser` role. |

The Quick View page (`/aisworg/quickview`) has no menu entry. A user holding the `general` role sees My Work on it. Other users see the list of Commissioned SEUs.

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
