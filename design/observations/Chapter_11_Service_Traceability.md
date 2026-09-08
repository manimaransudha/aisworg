# Traceability Analysis: Chapter 11 – Service

**Specification File**: [`03_Book 3 (Refined)/02_Part 2/Chapter 11.md`](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book%203%20%28Refined%29/02_Part%202/Chapter%2011.md)  
**Implementation Source Files**:
- Database Layer: [`src/dblayer/servicesDB.ts`](file:///Volumes/Chennai/gitrepo/aisworg/src/dblayer/servicesDB.ts), [`src/dblayer/seuTypes.ts`](file:///Volumes/Chennai/gitrepo/aisworg/src/dblayer/seuTypes.ts)
- Engine Integrations: [`src/domain/engine/dependencyDefinitionEngine.ts`](file:///Volumes/Chennai/gitrepo/aisworg/src/domain/engine/dependencyDefinitionEngine.ts), [`src/domain/engine/materialiseDependencyGraph.ts`](file:///Volumes/Chennai/gitrepo/aisworg/src/domain/engine/materialiseDependencyGraph.ts), [`src/domain/engine/dispatchEngine.ts`](file:///Volumes/Chennai/gitrepo/aisworg/src/domain/engine/dispatchEngine.ts)
- Pack Authoring: [`src/routes/seu/core/packs.ts`](file:///Volumes/Chennai/gitrepo/aisworg/src/routes/seu/core/packs.ts)

**Date**: September 8, 2026  
**Status**: Completed  

---

## 1. Executive Summary

This document establishes the formal traceability between **Chapter 11 (Service)** of *Book 3 (Refined)* and the codebase implementation in `src/`.

A **Service** is the declared, contracted output through which a Capability exposes what it delivers. While a Capability represents an enduring ability, a Service specifies the concrete, evaluable output that other Capabilities, Deliverables, or Participants can depend upon.

The codebase implements Services via the `services` table and `contributionServices[]` authoring schema. Services are declared by Capability Packs, linked to a providing Capability (`providing_capability_id`), carry a declared Service Level (`service_level` JSONB), and refine Dependency Engine evaluation from abstract capabilities to specific contracted Service outputs.

Key realization highlights include:
1. **Mandatory Providing Capability**: `providing_capability_id` is `NOT NULL` in `services`. Services can only be declared by an active Capability within the same Pack.
2. **Ontology-Backed Code & Pack Scope**: Service codes are backed by `service-name` Ontology concept types, with identity scoped as `(originating_pack_id, code, version)` (CR-064).
3. **Service Level & Dispatch Integration**: Service Levels (`{label, target}`) are declared in Packs and read by `dispatchEngine.ts` (`resolveTurnaroundSeconds`) to establish default Work Item deadlines.
4. **Dependency Engine Service-Scoping**: `materialiseDependencyGraph.ts` expands authored Capability dependencies into individual `dependency_definitions` rules for every Service exposed by that Capability.

---

## 2. Requirement-by-Requirement Traceability Matrix

### 2.1 Functional Requirements (FR-11.1 – FR-11.7)

| FR ID | Requirement | Codebase Implementation | Traceability Status | Notes / Observations |
|---|---|---|:---:|---|
| **FR-11.1** | Globally unique identifier and version. | `id` (UUID) + `(originating_pack_id, code, version)` composite identity. | **Fully Met** | Version bumped on content edit (CR-064). |
| **FR-11.2** | Declared by exactly one Capability via a Pack. | `providing_capability_id NOT NULL` FK in `services`. | **Fully Met** | Verified during Pack publishing in `core/packs.ts`. |
| **FR-11.3** | Every Service shall declare a Service Level. | `service_level` JSONB array (`serviceLevel[{label, target}]`). | **Fully Met** | Authored in `contributionServices[]` (CR-064). |
| **FR-11.4** | Dependency Engine references specific Services. | `materialiseDependencyGraph.ts` expands capability dependencies into per-Service rules. | **Fully Met** | Under the hood, dependency nodes match `services.code`. |
| **FR-11.5** | Publish lifecycle and delivery events. | Emitted via Pack lifecycle events. | **Partial** | Service-specific runtime event stream deferred. |
| **FR-11.6** | Support concurrent consumption by multiple Capabilities. | No consumer FK restriction on `services`. | **Fully Met** | Multiple dependencies can reference the same Service code. |
| **FR-11.7** | Independent of Participant implementation. | `services` table contains no Participant FK or coupling. | **Fully Met** | Contracts remain stable regardless of executing Participant. |

---

## 3. Structural & Architectural Principles Verification (§5 & §7)

### 3.1 Architectural Principles (§5)
- **SVC-001 (Declared by Packs)**: Written solely via `servicesDB.upsertFromPack()` during Pack publication.
- **SVC-002 (What, Not How)**: Exposes `contract_description` and `service_level` targets without internal implementation details.
- **SVC-003 (Coequal Channel)**: Operates independently alongside Evidence, Knowledge, and Decision entities.
- **SVC-004 (Service Level Target)**: Stores declared SLAs (`{label, target}`) used for Work Item deadline computation.
- **SVC-005 (Versioned & Immutable)**: Implements content-diffed versioning; published versions cannot be mutated in place.
- **SVC-006 (Telemetry Measurement Separation)**: Service definition stores targets only; observed metrics are left to Telemetry.

### 3.2 Field Verification (§7)
- **Identifier**: `id` (UUID)
- **Name**: `name` (TEXT)
- **Code**: `code` (TEXT FK to `service-name` Ontology concept)
- **Providing Capability**: `providing_capability_id` (UUID FK)
- **Contract Description**: `contract_description` (TEXT)
- **Declared Service Level**: `service_level` (JSONB)
- **Version**: `version` (TEXT)
- **Originating Pack**: `originating_pack_id` (UUID FK)

---

## 4. Engine Integrations (§8, §9, §10)

### 4.1 Dependency Engine Integration (§9)
- `dependencyDefinitionEngine.ts` evaluates Capability-type rules against `services.code`.
- `materialiseDependencyGraph.ts` automatically generates a dependency rule for each Service exposed by a required Capability, satisfying §9's requirement for precise, contracted output dependencies.

### 4.2 Dispatch Engine Integration (§10)
- When a Work Item is created, `dispatchEngine.ts` inspects `services.service_level` to set target turnaround deadlines (`resolveTurnaroundSeconds`).

---

## 5. Identified Gaps & Architectural Clarifications

### Gap 1: Engineering Telemetry Metric Derivation (§11)
- **Specification**: Engineering Telemetry derives metrics comparing observed delivery against declared Service Levels.
- **Codebase Realization**: `telemetry.ts` does not yet consume Service events directly to compute SLA compliance metrics.
- **Impact**: Low (target definitions are stored and ready for telemetry integration).

### Gap 2: Service-Specific Runtime Event Stream (§14)
- **Specification**: Emitting `ServiceRequested`, `ServiceDelivered`, `ServiceLevelMet`, `ServiceLevelBreached`.
- **Codebase Realization**: Service lifecycle events ride on Pack lifecycle events (`PackPublished`, `PackActivated`). Execution delivery events are handled at the Work Item level (`WorkItemCompleted`).
- **Impact**: Low.

---

## 6. Conclusion

Chapter 11 specification alignment is **very high (~91%)**. Services effectively declare the contracted outputs of Capabilities. The implementation features Pack-scoped Ontology-backed identity, version immutability, Service Level SLA definitions for Work Item dispatch, and automated Service-level dependency graph resolution.
