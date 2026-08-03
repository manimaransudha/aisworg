
# Chapter 42 – Multi-Tenancy Architecture

[Sudha: If I look at everything we've built, one concern is still missing.

Not deployment.

Not scalability.

Not high availability.

Those are implementation techniques.

The architectural concern is:

> **How does one physical platform host hundreds or thousands of independent SEUs?**

That is **Multi-tenancy**.

Notice I deliberately said **independent SEUs**, not organisations.

Because an organisation may own hundreds of SEUs.

Likewise, a managed service provider may host SEUs for thousands of customers.

Therefore, tenancy is not necessarily organisational.

I think the tenancy hierarchy should look like this:

```
Platform

↓

Tenant

↓

Workspace (optional)

↓

Software Engineering Unit

↓

Engineering Objects
```

This gives enormous flexibility.

One Tenant could be:

- TCS

Another:

- Accenture

Another:

- A startup

Within TCS:

- Healthcare Workspace
- Banking Workspace
- Insurance Workspace

Within Healthcare:

- Cigna SEU
- NHS SEU
- Kaiser SEU

This feels much more scalable than tying everything directly to Organisations.


--------------

think this chapter introduces an architectural distinction that will become increasingly valuable as the platform grows.

Earlier in the book we used the term **Organisation Pack**, because we were modelling engineering behaviour contributed by organisations such as TCS, Cigna or IBM.

This chapter deliberately avoids making **Organisation** a runtime concept.

Instead, the runtime hosts **Tenants**, and Organisations become one possible type of tenant or one possible source of Packs.

That separation keeps the runtime generic. A tenant could represent:

- a commercial organisation;
- a government department;
- an open-source community;
- a university;
- an individual developer.

The Runtime Kernel doesn't need to know which.

## One refinement I'd recommend

I think we should distinguish three different ownership concepts throughout the platform:

|Concept|Responsibility|
|---|---|
|**Administrative Ownership**|Who administers the platform resources (Tenant/Workspace).|
|**Engineering Ownership**|Which SEU is responsible for an engineering object.|
|**Business Ownership**|Which external business entity ultimately owns the business outcome or product.|

These three ownership dimensions often coincide in small organisations, but diverge significantly in large programmes involving suppliers, customers and partners. Keeping them separate will avoid overloading a single "owner" concept and will make the platform more adaptable to complex delivery models.

I recommend capturing this as an ADR:

> **ADR – Ownership Separation**

**Decision:** The platform shall distinguish Administrative Ownership, Engineering Ownership and Business Ownership. Runtime services shall use Administrative Ownership for platform administration, the Engineering Model shall use Engineering Ownership for execution and governance, and Business Ownership shall remain an external business concern that may be referenced but shall not influence Runtime Kernel behaviour.

This continues the pattern we've followed throughout the architecture: separating concerns rather than combining them into overloaded concepts. I think it will make both the implementation and the mental model significantly cleaner.
]
---

# 1. Purpose

The Multi-Tenancy Architecture defines how the Software Engineering Unit (SEU) Platform securely hosts multiple independent engineering environments within a shared platform infrastructure.

The architecture provides strong isolation while enabling efficient sharing of platform capabilities.

Tenancy is an operational hosting concern.

It is independent of engineering behaviour.

---

# 2. Scope

This chapter defines:

- tenancy model;
- isolation boundaries;
- resource ownership;
- shared platform services;
- tenant administration;
- cross-tenant interaction.

This chapter does not define:

- engineering behaviour;
- organisation engineering practices;
- infrastructure deployment;
- commercial licensing.

---

# 3. Architectural Position

```
Platform

↓

Tenant

↓

Workspace (optional)

↓

Software Engineering Unit

↓

Engineering Objects
```

Every engineering object belongs to exactly one SEU.

Every SEU belongs to exactly one Workspace (if used).

Every Workspace belongs to exactly one Tenant.

---

# 4. Definition

A Tenant is the primary administrative and security boundary within the platform.

A Tenant owns one or more Workspaces.

A Workspace groups related SEUs for administrative purposes.

An SEU remains the fundamental engineering execution unit.

---

# 5. Architectural Principles

## MT-001

Tenancy is independent of engineering behaviour.

---

## MT-002

SEU isolation shall be preserved regardless of shared infrastructure.

---

## MT-003

Platform services may be shared.

Engineering state shall never be shared implicitly.

---

## MT-004

Cross-tenant interaction shall always be explicit.

---

## MT-005

Tenant boundaries shall be enforced consistently across every Runtime Service.

---

## MT-006

The tenancy model shall support future expansion without structural changes.

---

# 6. Functional Requirements

### FR-42.1

Every SEU shall belong to exactly one Tenant.

---

### FR-42.2

The platform shall support optional Workspace grouping.

---

### FR-42.3

Engineering state shall remain isolated between SEUs.

---

### FR-42.4

Tenant administrators shall manage Tenant resources independently.

---

### FR-42.5

Cross-tenant communication shall occur only through the External Interaction Model.

---

### FR-42.6

Tenant configuration shall be versioned and traceable.

---

### FR-42.7

Tenant isolation shall remain effective during platform upgrades.

---

# 7. Tenant Structure

Every Tenant shall define:

- Tenant Identifier
- Name
- Administrative Contacts
- Platform Configuration
- Security Configuration
- Available Packs
- Workspace Definitions
- Lifecycle State

---

# 8. Workspace Model

Workspaces provide logical grouping of SEUs.

Illustrative examples include:

**Organisation-based**

- Banking
- Healthcare
- Retail

---

**Customer-based**

- Cigna
- HSBC
- Shell

---

**Programme-based**

- Digital Transformation
- ERP Modernisation
- Core Platform

Workspaces do not modify engineering behaviour.

They simplify administration.

---

# 9. Shared Platform Services

The following platform capabilities may be shared:

- Runtime Kernel
- Pack Registry
- SDK
- Identity Services
- Telemetry Infrastructure
- Connector Framework

Shared services shall preserve Tenant isolation.

---

# 10. Resource Ownership

Every resource shall have a clearly defined owner.

Examples include:

|Resource|Owner|
|---|---|
|Pack|Platform or Tenant|
|Workspace|Tenant|
|SEU|Workspace or Tenant|
|Deliverable|SEU|
|Knowledge|SEU|
|Evidence|SEU|
|Events|SEU|
|Telemetry|SEU (aggregated views may exist at Workspace or Tenant level)|

Ownership determines administrative responsibility.

It does not determine engineering authority.

---

# 11. Cross-Tenant Interaction

Cross-tenant interaction shall occur only through governed External Interactions.

Illustrative examples include:

- shared reference Packs;
- published engineering knowledge;
- supplier/customer Deliverables;
- API-based capability requests.

Direct access to engineering state across Tenant boundaries is prohibited.

---

# 12. Tenant Lifecycle

Every Tenant shall progress through:

```
Provisioned

↓

Configured

↓

Operational

↓

Suspended

↓

Retired

↓

Archived
```

Tenant lifecycle is independent of individual SEUs.

---

# 13. Tenant Traceability

The platform shall preserve:

- Tenant configuration history;
- Workspace history;
- SEU ownership history;
- administrative actions;
- configuration changes.

Historical tenancy information shall remain reproducible.

---

# 14. Events

The Multi-Tenancy subsystem shall publish:

- TenantProvisioned
- TenantConfigured
- TenantSuspended
- TenantReactivated
- WorkspaceCreated
- WorkspaceArchived
- TenantRetired

---

# 15. Non-Functional Requirements

The Multi-Tenancy Architecture shall:

- support thousands of Tenants;
- support millions of engineering objects;
- preserve strict isolation;
- support horizontal scaling;
- remain independent of cloud providers.

---

# 16. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Every SEU belongs to one Tenant.

✓ Engineering state is isolated.

✓ Shared services do not compromise isolation.

✓ Cross-tenant interactions are governed.

✓ Tenant history is traceable.

✓ The architecture scales without structural redesign.

---

# 17. Deliverables

Implementation of this chapter shall produce:

- Tenant Management Service.
- Workspace Management Service.
- Tenant Registry.
- Tenant Configuration Service.
- Multi-tenancy APIs.
- Tenant Events.
- Administrative interfaces.