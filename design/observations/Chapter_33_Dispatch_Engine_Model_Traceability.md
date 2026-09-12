# Traceability Analysis: Chapter 33 – Dispatch Engine Model

**Specification File**: [`03_Book 3 (Refined)/05_Part 5/Chapter 33.md`](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book%203%20%28Refined%29/05_Part%205/Chapter%2033.md)  
**Implementation Source Files**:
- Domain Engines: [`src/domain/engine/dispatchEngine.ts`](file:///Volumes/Chennai/gitrepo/aisworg/src/domain/engine/dispatchEngine.ts), [`src/domain/engine/executionEngine.ts`](file:///Volumes/Chennai/gitrepo/aisworg/src/domain/engine/executionEngine.ts)
- Database Layer: [`src/dblayer/seuCapabilitiesDB.ts`](file:///Volumes/Chennai/gitrepo/aisworg/src/dblayer/seuCapabilitiesDB.ts), [`src/dblayer/capabilityFulfilmentsDB.ts`](file:///Volumes/Chennai/gitrepo/aisworg/src/dblayer/capabilityFulfilmentsDB.ts), [`src/dblayer/participantsDB.ts`](file:///Volumes/Chennai/gitrepo/aisworg/src/dblayer/participantsDB.ts), [`src/dblayer/servicesDB.ts`](file:///Volumes/Chennai/gitrepo/aisworg/src/dblayer/servicesDB.ts)

**Date**: September 8, 2026  
**Status**: Completed  

---

## 1. Executive Summary

This document establishes the formal traceability between **Chapter 33 (Dispatch Engine Model)** of *Book 3 (Refined)* and the application codebase in `src/`.

The **Dispatch Engine Model** governs the runtime assignment of transient Work Items to suitable Participants. A key architectural clarification in Chapter 33 is the separation between **Capability Fulfilment (Chapter 12)** and **Dispatch Engine (Chapter 33)**: Capability Fulfilment determines *which Participants are eligible* to provide a required Capability (slow-moving structural concern), while the Dispatch Engine determines *which eligible Participant executes a specific Work Item now* (fast, per-work-item runtime decision) (DE-001–004).

The codebase realizes the Dispatch Engine in `src/domain/engine/dispatchEngine.ts`. It consumes Capability Fulfilment records (`seuCapabilitiesDB`, `capabilityFulfilmentsDB`), evaluates Participant assignment, applies turnaround SLAs from linked Service definitions (`servicesDB`), and updates participant lifecycle states.

Key realization highlights include:
1. **Upstream Capability Fulfilment Integration (§3, §7)**: `dispatchEngine.dispatch()` queries `capabilityFulfilmentsDB.findActiveBySeuCapabilityId()` to retrieve the eligible Participant pool.
2. **Turnaround SLA Resolution (§7)**: Evaluates turnaround SLAs declared on Service definitions (`servicesDB`) to compute target completion timestamps (`setTargetCompletion`).
3. **Decoupled Participant Lifecycle (§8)**: Updates Participant status to `Assigned` (`participantsDB.updateStatus`) without directly executing work inside the engine.
4. **Event Emission (§14)**: Publishes `WorkItemDispatched`, `ParticipantSelected`, `ParticipantAssigned`, and `DispatchDeferred` events.
5. **Gaps**: Multi-participant competitive dispatch strategies (cost optimization, load balancing, locality preference) are deferred in favor of direct single-eligible participant dispatch.

---

## 2. Requirement-by-Requirement Traceability Matrix

### 2.1 Architectural Principles (DE-001 – DE-006)

| ID | Principle | Codebase Implementation | Traceability Status | Notes / Observations |
|---|---|---|:---:|---|
| **DE-001** | Capability-driven dispatch. | Resolves producing capability IDs to eligible participants via `capabilityFulfilmentsDB`. | **Fully Met** | Driven by required capabilities. |
| **DE-002** | Context-sensitive dispatch. | Considers SEU ID, target completion SLA, and active capability assignments. | **Fully Met** | Evaluates active SEU context. |
| **DE-003** | Dynamic assignment. | Evaluated dynamically per Work Item at runtime. | **Fully Met** | Runtime assignment resolution. |
| **DE-004** | Replaceable dispatch strategies. | `dispatchEngine.ts` acts as an isolated strategy engine. | **Fully Met** | Strategy pattern implementation. |
| **DE-005** | Traceable dispatch decisions. | Emits `ParticipantSelected`, `WorkItemDispatched`, `DispatchDeferred` with strategy labels. | **Fully Met** | Complete audit logging. |
| **DE-006** | Technology-independent. | Operates over generic Participant IDs regardless of AI model or human participant type. | **Fully Met** | Uniform participant abstraction. |

### 2.2 Functional Requirements (FR-33.1 – FR-33.7)

| FR ID | Requirement | Codebase Implementation | Traceability Status | Notes / Observations |
|---|---|---|:---:|---|
| **FR-33.1** | Dispatched post-generation. | `executionEngine.ts` calls `dispatchEngine.dispatch()` after `workItemGenerator.generate()`. | **Fully Met** | Strict ordering enforced. |
| **FR-33.2** | Evaluate eligible Participants. | Consumes eligible pool from `capabilityFulfilmentsDB`. | **Fully Met** | Queries capability fulfilment pool. |
| **FR-33.3** | Support assignment strategies. | `sole-eligible-participant` strategy active; multi-participant pool open. | **Partially Met** | Single-participant active; multi-participant selection open. |
| **FR-33.4** | Preserve engineering traceability. | Logs assignment events with `workItemId`, `participantId`, `seuId`, `correlationId`. | **Fully Met** | Full traceability preserved. |
| **FR-33.5** | Support redispatch. | If dispatch defers or fails, `DispatchDeferred` event triggers re-evaluation. | **Fully Met** | Supported via deferred state handling. |
| **FR-33.6** | Respect Governance constraints. | Evaluated post-governance check; SLA deadlines attached. | **Fully Met** | Governance-compliant dispatch. |
| **FR-33.7** | Reproducible decisions. | Deterministic matching over active DB capability fulfilments. | **Fully Met** | Reproducible resolution. |

---

## 3. Subsystem Architecture & Dispatch Flow (§3 & §9)

### 3.1 Dispatch Engine Execution Flow (§3)
```
          WorkItem Generated (executionEngine.ts)
                             │
                             ▼
                dispatchEngine.dispatch()
                             │
                             ▼
        Query `seuCapabilitiesDB` & `capabilityFulfilmentsDB`
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
   Participant Found                    No Participant
            │                                 │
            ▼                                 ▼
1. Assign `workItemsDB.assign()`    1. Publish `DispatchDeferred`
2. Set SLA `setTargetCompletion()`  2. Return `dispatched: false`
3. Update `participantsDB` -> Assigned
4. Publish `WorkItemDispatched` & `ParticipantSelected`
```

---

## 4. Identified Gaps & Architectural Clarifications

### Architectural Realization: Single-Eligible Dispatch vs. Multi-Candidate Auction (§9)
- **Specification**: Describes pluggable dispatch strategies evaluating multiple candidates on cost, latency, confidence, and load metrics.
- **Codebase Realization**: `dispatchEngine.ts` cleanly separates the dispatch boundary and consumes Capability Fulfilment outputs. Active seed data assigns a single eligible Participant per Capability (`sole-eligible-participant`), leaving multi-candidate auction scoring as an extension point for multi-agent pools.

---

## 5. Conclusion

Chapter 33 specification alignment is **high (~93%)**. The Dispatch Engine correctly maintains the architectural separation between Capability Fulfilment (eligibility) and Dispatch (per-work-item selection). SLA resolution, event publishing, and participant status transitions are fully realized.
