
# Chapter 4 – Composition Engine

[Sudha

I think this is the right point to introduce the **Composition Engine**.

The EBM answers **what** governs an SEU.

The next logical question is:

> **How is the EBM created?**

That is the sole responsibility of the Composition Engine.

Importantly, this chapter should **not** describe Pack internals. It describes the orchestration that transforms Packs into an executable Engineering Behavior Model.


------------------

I think this chapter establishes the **compiler** of your platform.

That analogy is intentional.

A compiler takes:

- source files,
- libraries,
- dependencies,

and produces an executable program.

The Composition Engine takes:

- Packs,
- Templates,
- behavioural contributions,
- governance,
- engineering constraints,

and produces an executable **Engineering Behavior Model**.

That analogy suggests another refinement for the architecture.

Just as modern compilers produce diagnostics (warnings, errors and informational messages), the Composition Engine should produce a **Composition Report** as a first-class artefact.

The report should include:

- Packs used and their versions.
- Resolved dependencies.
- Automatic conflict resolutions.
- Conflicts requiring manual intervention.
- Warnings (for example, recommended packs not installed).
- Effective behavioural summary.
- Traceability matrix from Pack → Behaviour → EBM.

This report would be invaluable for governance, audits and debugging why a particular SEU behaves the way it does. I think it should become a permanent artefact attached to every commissioned SEU, alongside its Engineering Behavior Model. It also reinforces the platform's principle that behaviour is not only composable but fully explainable and traceable.
]
---

# 1. Purpose

The Composition Engine is responsible for constructing an **Engineering Behavior Model (EBM)** by composing behavioural contributions from one or more Packs.

The Composition Engine is the only platform component authorised to create, validate, version and activate an Engineering Behavior Model.

The Composition Engine performs no software engineering work itself. Its responsibility is limited to producing a complete, internally consistent and traceable behavioural model suitable for commissioning a Software Engineering Unit (SEU).

---

# 2. Scope

This chapter defines:

- Composition Engine responsibilities.
- Inputs and outputs.
- Composition lifecycle.
- Conflict detection.
- Behaviour resolution.
- Validation.
- Versioning.
- Activation.

This chapter does not define:

- Pack structure.
- Pack lifecycle.
- Engineering behaviour.
- Runtime execution.

---

# 3. Architectural Position

```
Pack Registry
      │
      ▼
Composition Engine
      │
      ▼
Engineering Behavior Model
      │
      ▼
Commissioned SEU
```

The Composition Engine is a build-time service.

It is not part of normal SEU execution.

---

# 4. Responsibilities

The Composition Engine shall:

- discover Packs;
- resolve dependencies;
- validate compatibility;
- compose behavioural contributions;
- detect conflicts;
- resolve deterministic conflicts;
- identify non-deterministic conflicts;
- construct the Engineering Behavior Model;
- version the Engineering Behavior Model;
- activate the Engineering Behavior Model.

The Composition Engine shall not:

- execute Work Items;
- manage Participants;
- manage Deliverables;
- preserve Knowledge.

---

# 5. Inputs

The Composition Engine shall accept:

- one SEU Template;
- zero or more Organisation Packs;
- zero or more Domain Packs;
- zero or more Compliance Packs;
- zero or more Technology Packs;
- zero or more Integration Packs;
- Platform Packs.

Additional Pack categories may be introduced through the Extension Framework.

---

# 6. Output

The output of the Composition Engine shall be exactly one Engineering Behavior Model.

The Engineering Behavior Model shall contain:

- behavioural rules;
- governance rules;
- authority rules;
- engineering standards;
- terminology mappings;
- quality gates;
- review gates;
- behavioural metadata.

The Composition Engine shall not expose partially composed models.

---

# 7. Functional Requirements

### FR-4.1

The platform shall invoke the Composition Engine before commissioning every SEU.

---

### FR-4.2

The Composition Engine shall construct exactly one Engineering Behavior Model for each commissioned SEU.

---

### FR-4.3

Every behavioural contribution shall retain its originating Pack reference.

---

### FR-4.4

The Composition Engine shall maintain complete composition traceability.

---

### FR-4.5

Composition shall be deterministic.

Identical inputs shall always produce identical Engineering Behavior Models.

---

### FR-4.6

The Composition Engine shall support incremental recomposition.

---

### FR-4.7

Recomposition shall produce a new Engineering Behavior Model version.

---

# 8. Composition Lifecycle

Every composition shall progress through the following stages.

```
Collect Inputs

↓

Resolve Dependencies

↓

Validate Packs

↓

Compose Behaviour

↓

Detect Conflicts

↓

Resolve Conflicts

↓

Validate Model

↓

Version Model

↓

Activate Model
```

Failure at any stage shall terminate the composition process.

---

# 9. Dependency Resolution

The Composition Engine shall determine:

- required Packs;
- optional Packs;
- conditional Packs;
- incompatible Packs;
- missing Packs.

Dependencies shall be declared by Packs.

Dependencies shall not be inferred.

---

# 10. Behaviour Composition

The Composition Engine shall compose contributions according to declared composition strategies.

Supported strategies include:

- Merge
- Override
- Supplement
- Union
- Intersection
- Alias
- Conflict Detection

The platform shall permit future strategies without modification of the Runtime Kernel.

---

# 11. Conflict Detection

The Composition Engine shall identify behavioural conflicts.

Examples include:

- contradictory authority rules;
- incompatible workflows;
- conflicting quality gates;
- inconsistent terminology;
- incompatible compliance requirements;
- incompatible technology constraints.

Conflicts shall be classified as:

- deterministic;
- non-deterministic.

---

# 12. Conflict Resolution

Deterministic conflicts shall be resolved automatically.

Non-deterministic conflicts shall require explicit resolution before commissioning.

Every resolution shall be recorded.

Every resolution shall remain traceable.

---

# 13. Validation

The Composition Engine shall validate:

- behavioural completeness;
- Pack compatibility;
- governance completeness;
- dependency completeness;
- mandatory Pack availability;
- mandatory behavioural rules;
- terminology consistency.

Validation shall fail if the resulting Engineering Behavior Model is incomplete.

---

# 14. Composition Traceability

Every behavioural rule in the Engineering Behavior Model shall be traceable to:

- originating Pack;
- originating Pack version;
- composition strategy;
- conflict resolution (if applicable).

Composition traceability shall remain permanently available.

---

# 15. Activation

Only validated Engineering Behavior Models may be activated.

Activation shall:

- assign an identifier;
- assign a version;
- publish activation events;
- make the Engineering Behavior Model available for SEU commissioning.

Activation shall not modify existing Engineering Behavior Models.

---

# 16. Recomposition

Engineering Behavior Models may be recomposed when:

- Packs are upgraded;
- behavioural conflicts are resolved;
- governance changes;
- new mandatory Packs become available;
- authorised users request recomposition.

Recomposition shall never modify historical Engineering Behavior Models.

---

# 17. Events

The Composition Engine shall publish domain events including:

- CompositionStarted
- DependencyResolved
- DependencyFailed
- PackValidated
- BehaviourComposed
- ConflictDetected
- ConflictResolved
- CompositionValidated
- EBMCreated
- EBMActivated
- CompositionFailed

---

# 18. Non-Functional Requirements

The Composition Engine shall:

- produce deterministic output;
- support concurrent composition requests;
- maintain complete auditability;
- preserve historical versions;
- support incremental recomposition;
- remain independent of execution technologies.

---

# 19. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Mandatory Packs are resolved.

✓ Behavioural contributions are successfully composed.

✓ Deterministic conflicts are resolved automatically.

✓ Non-deterministic conflicts prevent commissioning.

✓ Every Engineering Behavior Model is versioned.

✓ Every behavioural contribution is traceable to its source.

✓ Engineering Behavior Models are immutable after activation.

---

# 20. Deliverables

Implementation of this chapter shall produce:

- Composition Engine service.
- Composition pipeline.
- Dependency resolver.
- Conflict detection service.
- Conflict resolution framework.
- Validation service.
- Engineering Behavior Model builder.
- Composition traceability service.
- Composition APIs.
- Domain events.