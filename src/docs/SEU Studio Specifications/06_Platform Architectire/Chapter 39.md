# Chapter 39 – SEU Design Kit (SDK) Architecture

## 1. Purpose

The SEU Design Kit (SDK) Architecture defines how the Platform Elements are created, versioned, composed, validated, deployed and managed within the Software Engineering Unit (SEU) platform.

The SDK provides a stable contract between the Platform Core and the Elements developers.

The SDK enables platform evolution through extension rather than modification. Every engineering behaviour, governance model, domain capability and organisational customisation shall be introduced through SDK elements rather than modifications to the Runtime Kernel.

---

## 2. Scope

This chapter defines:

- SDK architecture
- SDK authoring
- SDK validation
- SDK testing
- SDK packaging
- SDK publishing

This chapter does not define:

- Runtime Kernel implementation
- engineering behaviour
- deployment infrastructure
 
---

## 3. Architectural Position

```
Platform Elements Developer

↓

SEU Design Kit (SDK)

↓

Element Package

↓

Element Registry

↓

Composition Engine

↓

Engineering Behavior Model

↓

Runtime Kernel
```

The SDK is the sole supported mechanism for creating production Schemas.

---

## 4. Definition

The SDK is the development framework that enables creation of versioned, declarative Elements that conform to platform standards.

The SDK shall provide:

- authoring support
- schema validation
- dependency validation
- testing tools
- packaging tools
- publishing tools

The SDK defines **how Platform Elements are produced**.

It does not define **what Platform Elements contain**.

---

## 5. Architectural Principles

### SDK-001

Every production Platform Element shall be created using the SDK.

### SDK-002

The SDK shall remain independent of Runtime Kernel implementation.

### SDK-003

SDK outputs shall be deterministic.

### SDK-004

The SDK shall validate the before publication.

### SDK-005

The SDK shall support automation.

### SDK-006

The SDK shall evolve independently of the Runtime Kernel.

---

## 6. Functional Requirements

### FR-39.1

The SDK shall provide Element widgets.

### FR-39.2

The SDK shall validate Element schemas.

### FR-39.3

The SDK shall validate Element dependencies.

### FR-39.4

The SDK shall validate compatibility declarations.

### FR-39.5

The SDK shall support automated testing.

### FR-39.6

The SDK shall package Element into a deployable artefact.

### FR-39.7

The SDK shall support publishing to the element Registries.

---

## 7. SDK Components

The SDK shall provide the following features.

### Schema Generator

Creates Element Schemas using standard layouts.

### Schema Validator

Validates declarative Element Schema definitions.

### Dependency Validator

Ensures dependency consistency.

### Compatibility Validator

Checks compatibility against platform versions and Element Schema dependencies.

### Test Framework

Executes Element Schema validation tests.

### Packaging Service

Creates immutable Element Schema artefacts.

### Publishing Service

Publishes validated Element Schemas to authorised registries.

---

## 8. SDK Elements Taxonomy

An SDK element is a versioned, declarative package that contributes engineering behaviour or engineering metadata to the platform.

The SDK is responsible for:

- SDK element discovery
- validation
- dependency management
- version compatibility
- composition
- activation
- lifecycle management

The Runtime Kernel consumes the composed result through Engineering Behavior Model. 

---

## 9. Validation

The SDK shall validate:

- manifest correctness
- schema compliance
- dependency graph
- compatibility rules
- duplicate identifiers
- semantic integrity
- required metadata

Validation shall fail before packaging if errors are detected.

---

## 10. Testing

The SDK shall support:

- schema tests
- composition tests
- compatibility tests
- regression tests
- example execution tests

Tests shall execute independently of the Runtime Kernel.

---

## 11. Packaging

Packaging shall produce an immutable schema artefact containing:

- declarative definitions
- metadata
- documentation
- digital signature
- version information
- compatibility declarations

Packaging shall be deterministic.

---

## 12. Publishing

Publishing shall:

- verify Schema signatures
- validate permissions
- enforce versioning rules
- update registry metadata
- publish Schema documentation

Publishing shall not modify Schema contents.

---

## 13. SDK Extensibility

The SDK shall support extension through:

- validators
- project templates
- testing modules
- packaging plugins
- publishing targets

SDK extensions shall not modify SDK core behaviour.

---

## 14. Traceability

The SDK shall preserve:

- version
- validation results
- test results
- publishing history
- digital signatures

Every published Schema shall be reproducible.

---

## 15. Events

The SDK shall publish:

- SDKElementSchemaCreated
- SDKElementSchemaValidated
- SDKElementSchemaTested
- SDKElementSchemaPackaged
- SDKElementSchemaPublished
- SDKElementSchemaPublicationRejected

---

## 16. Non-Functional Requirements

The SDK shall:

- support automated pipelines
- support offline development
- remain platform-independent
- produce deterministic outputs
- support future SDK versions 

---

## 17. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ SDK Elements can be created using Element Schema.

✓ Validation detects structural and semantic errors.

✓ Packaging is deterministic.

✓ Published Schemas are reproducible.

✓ SDK supports automated build pipelines.

✓ SDK evolves independently of the Runtime Kernel.

---

## 18. Deliverables

Implementation of this chapter shall produce:

- SDK framework
- Project generator
- Validation framework
- Testing framework
- Packaging service
- Publishing service
- SDK documentation
- Reference schemas

---

## 19. Implementation Notes

CR-115 gives `schema_definitions` (the Element Schema registry) a real lifecycle and authorship, per §15's own event vocabulary.

`lifecycle_state`: `Created` → `Validated` → `Tested` → `Packaged` → `Published`, with a `Packaged` → `PublicationRejected` branch (`transition_definitions`, `entity_type = 'SchemaDefinition'`).

`Created`/`Validated`/`Tested`/`Packaged` are `governed`-trigger, verb-null hops, auto-advanced server-side in the same request as the SDK's own inline schema and compatibility validation (§9), immediately after the row is inserted — there is no separate user-triggered action for the Schema Generator/Validator/Compatibility Validator/Test Framework/Packaging Service today. `Packaged` → `Published` and `Packaged` → `PublicationRejected` are the two real, manual, badge-gated decisions (`schemadefinition_publish` / `schemadefinition_reject`), surfaced as Publish/Reject actions on a Packaged schema version.

`author_id` is set at creation; `author_badge` is set on each governed transition thereafter, from the resolved authority.

Not yet implemented: digital signatures (§11/§12), packaging as a distinct immutable artefact format, and a documentation-publishing step.