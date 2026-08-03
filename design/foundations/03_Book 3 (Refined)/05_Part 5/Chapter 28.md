# Chapter 28 – Runtime Kernel

[Sudha: I think we've now reached the **Runtime Kernel**.

Up until now, every chapter has defined **engineering concepts**.

Now we define **platform concepts**.

This is a significant transition.

---

# Where are we now?

We have defined:

- the engineering model;
- the execution model;
- the knowledge model;
- the governance model.

But we still haven't defined **the software platform** that hosts all of this.

Originally we thought of it as an "orchestrator."

I don't think that's correct anymore.

It is much closer to an **operating system kernel**.

It doesn't perform software engineering.

It provides services that make software engineering possible.

That distinction is fundamental.

---------------

While writing this chapter(26)  I realised we've naturally arrived at a **microkernel architecture** rather than a monolithic platform.

That's a stronger conclusion than simply saying "modular."

Conceptually, the platform now has three layers:

```
Engineering Layer
-----------------
EBM
Governance
Knowledge
Execution

Platform Layer
--------------
Runtime Kernel

Infrastructure Layer
--------------------
LLMs
Databases
Queues
Cloud
GitHub
Jira
Azure
etc.
```

The Runtime Kernel is deliberately small. Its responsibility is to provide universal runtime services, while almost all engineering intelligence lives above it in declarative models and Packs.

I think we should capture this as another ADR.

> **ADR – Microkernel Runtime Architecture**

**Decision:** The platform shall adopt a microkernel architecture in which the Runtime Kernel provides only generic runtime services. Engineering behaviour, governance, knowledge, domain logic and organisation-specific functionality shall be implemented through declarative models and Packs rather than within the kernel.

**Rationale:** This keeps the kernel stable, simplifies testing, enables independent evolution of runtime services and ensures that new engineering methodologies, domains and governance models can be introduced without modifying the platform core.

I believe this ADR is particularly important because it ties together many of the decisions we've made over the course of Book 3: declarative Packs, composable governance, behaviour-independent runtime services and a stable platform core. It gives the implementation team a clear architectural boundary that should remain valid for many years.
 ]
---

# 1. Purpose

The Runtime Kernel is the foundational runtime environment that hosts every commissioned Software Engineering Unit (SEU).

It provides the common runtime services required for engineering execution while remaining independent of engineering behaviour.

The Runtime Kernel does not perform software engineering.

It provides the infrastructure upon which engineering execution occurs.

Engineering behaviour is defined by the Engineering Behavior Model (EBM).

The Runtime Kernel provides the execution environment.

---

# 2. Scope

This chapter defines:

- Runtime Kernel abstraction;
- runtime services;
- kernel responsibilities;
- kernel lifecycle;
- kernel boundaries;
- kernel extensibility.

This chapter does not define:

- engineering behaviour;
- governance rules;
- participant implementations;
- business logic.

---

# 3. Architectural Position

```
             Software Engineering Unit
                     │
                     ▼
          Engineering Behavior Model
                     │
────────────────────────────────────────
              Runtime Kernel
────────────────────────────────────────
│ State Management                    │
│ Event Bus                           │
│ Execution Planning                  │
│ Scheduling                          │
│ Observability                       │
│ Notifications                       │
│ Integration Framework               │
│ Runtime Administration              │
────────────────────────────────────────
                     │
                     ▼
          Infrastructure Services
```

The Runtime Kernel is the execution substrate for every SEU.

---

# 4. Definition

The Runtime Kernel is the collection of platform services responsible for managing the runtime lifecycle of an SEU.

It provides generic runtime capabilities.

It does not contain engineering knowledge.

It does not encode engineering behaviour.

It does not implement organisation-specific practices.

---

# 5. Architectural Principles

## RK-001

The Runtime Kernel is behaviour-independent.

Engineering behaviour belongs exclusively to the Engineering Behavior Model.

---

## RK-002

The Runtime Kernel is domain-independent.

No business-domain logic shall exist within the Runtime Kernel.

---

## RK-003

The Runtime Kernel is Pack-independent.

Packs extend behaviour without modifying the Runtime Kernel.

---

## RK-004

The Runtime Kernel provides services, not decisions.

Engineering decisions belong to higher architectural layers.

---

## RK-005

Runtime services are composable.

Each service shall have a single responsibility.

---

## RK-006

The Runtime Kernel shall remain replaceable.

Individual runtime services may evolve independently.

---

# 6. Functional Requirements

### FR-28.1

The Runtime Kernel shall host multiple concurrent SEUs.

---

### FR-28.2

Runtime services shall be isolated between SEUs.

---

### FR-28.3

The Runtime Kernel shall expose services through stable interfaces.

---

### FR-28.4

Runtime services shall remain independent of engineering behaviour.

---

### FR-28.5

The Runtime Kernel shall support runtime extensibility.

---

### FR-28.6

The Runtime Kernel shall preserve complete runtime traceability.

---

### FR-28.7

The Runtime Kernel shall support graceful recovery from runtime failures.

---

# 7. Runtime Services

The Runtime Kernel provides the following core services.

## State Management

Maintains the runtime state of engineering objects.

---

## Event Bus

Distributes engineering events.

---

## Execution Planning

Produces transient execution plans.

---

## Scheduling

Coordinates execution opportunities.

---

## Observability

Provides runtime telemetry.

---

## Notifications

Publishes engineering notifications.

---

## Integration Framework

Connects external systems.

---

## Runtime Administration

Supports operational management.

---

These services are platform capabilities rather than engineering capabilities.

---

# 8. Runtime Boundaries

The Runtime Kernel shall not:

- define engineering behaviour;
- perform governance decisions;
- maintain engineering knowledge;
- implement organisation-specific workflows;
- interpret business-domain semantics.

Those responsibilities belong to higher architectural layers.

---

# 9. Runtime Isolation

Each commissioned SEU shall execute within an isolated runtime context.

Isolation shall include:

- runtime state;
- event streams;
- execution planning;
- notifications;
- observability data;
- configuration.

Isolation does not prevent controlled collaboration between SEUs where explicitly supported.

---

# 10. Runtime Lifecycle

The Runtime Kernel shall support the following lifecycle.

```
Initialised

↓

Available

↓

Hosting SEUs

↓

Maintenance

↓

Shutdown

↓

Archived
```

Individual SEUs possess independent lifecycles.

---

# 11. Runtime Extensibility

Runtime services shall support extension without Runtime Kernel modification.

Extensions may be introduced through:

- Packs;
- configuration;
- service implementations;
- integration adapters.

The Runtime Kernel shall remain stable while extensions evolve.

---

# 12. Runtime Resilience

The Runtime Kernel shall:

- recover from service failures;
- isolate failing runtime services;
- preserve engineering state;
- maintain event consistency;
- support controlled restart of runtime services.

Engineering continuity shall be preserved whenever possible.

---

# 13. Runtime Traceability

The Runtime Kernel shall preserve traceability for:

- runtime service invocations;
- state transitions;
- event publication;
- execution planning;
- scheduling decisions;
- integration activities.

Runtime traceability complements engineering traceability.

---

# 14. Events

The Runtime Kernel shall publish:

- KernelStarted
- KernelAvailable
- RuntimeServiceStarted
- RuntimeServiceStopped
- RuntimeFailureDetected
- RuntimeRecovered
- SEUHosted
- SEUReleased

---

# 15. Non-Functional Requirements

The Runtime Kernel shall:

- support horizontal scalability;
- support concurrent SEUs;
- remain stateless where practical;
- support service isolation;
- support high availability;
- remain implementation independent.

---

# 16. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Multiple SEUs execute concurrently.

✓ Runtime services remain behaviour-independent.

✓ Runtime services are isolated.

✓ Runtime failures do not compromise engineering history.

✓ Runtime services expose stable interfaces.

✓ Runtime extensions do not require Runtime Kernel modification.

---

# 17. Deliverables

Implementation of this chapter shall produce:

- Runtime Kernel architecture.
- Runtime service registry.
- Runtime lifecycle management.
- Runtime service interfaces.
- Kernel APIs.
- Runtime events.
- Runtime operational documentation.