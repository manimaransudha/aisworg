# Chapter 42 – Multi-Tenancy Architecture

## 1. Purpose

The Multi-Tenancy Architecture defines how the Software Engineering Unit (SEU) Platform securely hosts multiple independent engineering environments within a shared platform infrastructure.

The architecture provides strong isolation while enabling efficient sharing of platform capabilities.

Tenancy is an operational hosting concern.

It is independent of engineering behaviour.

---

## 2. Scope

This chapter defines:

- tenancy model
- isolation boundaries
- resource ownership
- shared platform services
- tenant administration
- cross-tenant interaction

This chapter does not define:

- engineering behaviour
- organisation engineering practices
- infrastructure deployment
- commercial licensing

---

## 3. Architectural Position

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

## 4. Definition

A Tenant is the primary administrative and security boundary within the platform.

A Tenant owns one or more Workspaces.

A Workspace groups related SEUs for administrative purposes.

An SEU remains the fundamental engineering execution unit.

---

## 5. Architectural Principles

### MT-001

Tenancy is independent of engineering behaviour.

### MT-002

SEU isolation shall be preserved regardless of shared infrastructure.

### MT-003

Platform services may be shared.

Engineering state shall never be shared implicitly.

### MT-004

Cross-tenant interaction shall always be explicit.

### MT-005

Tenant boundaries shall be enforced consistently across every Runtime Service.

### MT-006

The tenancy model shall support future expansion without structural changes.

---

## 6. Functional Requirements

### FR-42.1

Every SEU shall belong to exactly one Tenant.
 
### FR-42.2

The platform shall support optional Workspace grouping.
 
### FR-42.3

Engineering state shall remain isolated between SEUs.
 
### FR-42.4

Tenant administrators shall manage Tenant resources independently.
 
### FR-42.5

Cross-tenant communication shall occur only through the External Interaction Model.
 
### FR-42.6

Tenant configuration shall be versioned and traceable.

### FR-42.7

Tenant isolation shall remain effective during platform upgrades.

---

## 7. Tenant Structure

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

## 8. Workspace Model

Workspaces provide logical grouping of SEUs.

Illustrative examples include:

**Organisation-based**

- Banking
- Healthcare
- Retail
 
**Customer-based**

- Cigna
- HSBC
- Shell
 
**Programme-based**

- Digital Transformation
- ERP Modernisation
- Core Platform

Workspaces do not modify engineering behaviour.

They simplify administration.

---

## 9. Shared Platform Services

The following platform capabilities may be shared:

- Runtime Kernel
- Pack Registry
- SDK
- Identity Services
- Telemetry Infrastructure
- Connector Framework

Shared services shall preserve Tenant isolation.

---

## 10. Resource Ownership

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

## 11. Cross-Tenant Interaction

Cross-tenant interaction shall occur only through governed External Interactions.

Illustrative examples include:

- shared reference Packs
- published engineering knowledge
- supplier/customer Deliverables
- API-based capability requests

Direct access to engineering state across Tenant boundaries is prohibited.

---

## 12. Tenant Lifecycle

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

## 13. Tenant Traceability

The platform shall preserve:

- Tenant configuration history
- Workspace history
- SEU ownership history
- administrative actions
- configuration changes

Historical tenancy information shall remain reproducible.

---

## 14. Events

The Multi-Tenancy subsystem shall publish:

- TenantProvisioned
- TenantConfigured
- TenantSuspended
- TenantReactivated
- WorkspaceCreated
- WorkspaceArchived
- TenantRetired

---

## 15. Non-Functional Requirements

The Multi-Tenancy Architecture shall:

- support thousands of Tenants
- support millions of engineering objects
- preserve strict isolation
- support horizontal scaling
- remain independent of cloud providers

---

## 16. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Every SEU belongs to one Tenant.

✓ Engineering state is isolated.

✓ Shared services do not compromise isolation.

✓ Cross-tenant interactions are governed.

✓ Tenant history is traceable.

✓ The architecture scales without structural redesign.

---

## 17. Deliverables

Implementation of this chapter shall produce:

- Tenant Management Service
- Workspace Management Service
- Tenant Registry
- Tenant Configuration Service
- Multi-tenancy APIs
- Tenant Events
- Administrative interfaces


## Proposed structure

A better abstraction

I would therefore define the tenant as a container of hierarchical organisational/delivery units, rather than defining a fixed hierarchy.

Something like:

Tenant
   │
   └── Unit
       │
       ├── Unit
       │   ├── Unit
       │   └── Unit
       │
       └── Unit
           └── Execution Unit

Each Unit can have attributes such as:

Unit
-------------------------
id
tenant_id
parent_unit_id
name
unit_type
purpose
owner
status

with unit_type being configurable:

ENTERPRISE
DIVISION
BUSINESS_UNIT
DEPARTMENT
ACCOUNT
PORTFOLIO
PROGRAMME
PROJECT
EXECUTION_UNIT
TEAM