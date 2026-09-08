# Traceability Analysis: Chapter 30 – Event Model

**Specification File**: [`03_Book 3 (Refined)/05_Part 5/Chapter 30.md`](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book%203%20%28Refined%29/05_Part%205/Chapter%2030.md)  
**Implementation Source Files**:
- Event Engine & Bus: [`src/domain/engine/eventBus.ts`](file:///Volumes/Chennai/gitrepo/aisworg/src/domain/engine/eventBus.ts), [`src/domain/engine/eventHandlerRegistry.ts`](file:///Volumes/Chennai/gitrepo/aisworg/src/domain/engine/eventHandlerRegistry.ts)
- Database & Persistence Layer: [`src/dblayer/eventsDB.ts`](file:///Volumes/Chennai/gitrepo/aisworg/src/dblayer/eventsDB.ts), [`src/dblayer/seuTypes.ts`](file:///Volumes/Chennai/gitrepo/aisworg/src/dblayer/seuTypes.ts)
- Migrations: [`src/dblayer/migrations/089_event_bus_structure.sql`](file:///Volumes/Chennai/gitrepo/aisworg/src/dblayer/migrations/089_event_bus_structure.sql), [`src/dblayer/migrations/090_event_registry_category.sql`](file:///Volumes/Chennai/gitrepo/aisworg/src/dblayer/migrations/090_event_registry_category.sql)

**Date**: September 8, 2026  
**Status**: Completed  

---

## 1. Executive Summary

This document establishes the formal traceability between **Chapter 30 (Event Model)** of *Book 3 (Refined)* and the application codebase in `src/`.

The **Event Model** establishes the event-driven architecture of the platform. The core thesis is that **Events describe facts, not intentions (EM-002)**, and are published by the Runtime Kernel *after* state transitions commit (EM-003). Chapter 30 differentiates **Command → Transition Definition Evaluation → Governance → State Transition → Event Publication → Subscriber Reaction**.

The codebase realizes the Event Model through a DB-backed Event Registry and decoupled Event Bus (`eventBus.ts`, `eventsDB.ts`). 69 publication call sites generate ~90 distinct event types across the platform.

Key realization highlights include:
1. **Post-Commit Event Publication (EM-003, §10)**: `eventBus.publish()` persists events to Postgres (`eventsDB.append`) before notifying subscribers fire-and-forget, guaranteeing events represent committed facts.
2. **DB-Backed Registry & Subscriptions (CR-052, §9)**: Subscriptions are managed in `event_registry` and `event_subscriptions` tables, categorised by ontology (`category:event-types`).
3. **Correlation & Causation Services (EM-004, §13)**: Every event captures `correlation_id` and explicit `causation_id` event chains (e.g. `SEUCommissionRequested` → `SEUCommissioned`).
4. **Monotonic Order (EM-005, FR-30.4)**: Events carry a global sequence order via a `BIGSERIAL` sequence (`events.sequence`).
5. **Gaps**: Event replay services and infrastructure-level bus events (`EventPublished`, `EventReplayStarted`) remain unbuilt.

---

## 2. Requirement-by-Requirement Traceability Matrix

### 2.1 Architectural Principles (EM-001 – EM-006)

| ID | Principle | Codebase Implementation | Traceability Status | Notes / Observations |
|---|---|---|:---:|---|
| **EM-001** | Events are immutable. | Append-only `events` DB table without UPDATE/DELETE methods in `eventsDB.ts`. | **Fully Met** | Strict immutable audit log. |
| **EM-002** | Events describe facts, not intentions. | Published post-commit to record facts after state transitions succeed. | **Fully Met** | CQRS command-event separation. |
| **EM-003** | Published after successful transitions. | Placed after DB state mutations across domain call sites. | **Fully Met** | Strictly published post-transaction commit. |
| **EM-004** | Independently identifiable. | Primary key `id UUID DEFAULT gen_random_uuid()` for every event. | **Fully Met** | Unique UUID assignment. |
| **EM-005** | Preserves ordering. | Monotonic global sequence (`events.sequence BIGSERIAL`) and `occurred_at`. | **Fully Met** | Preserves order per object and globally. |
| **EM-006** | Decouples publishers and subscribers. | Fire-and-forget async dispatch via DB-backed `event_subscriptions`. | **Fully Met** | Publishers do not await subscriber handling. |

### 2.2 Functional Requirements (FR-30.1 – FR-30.7)

| FR ID | Requirement | Codebase Implementation | Traceability Status | Notes / Observations |
|---|---|---|:---:|---|
| **FR-30.1** | Immutable event record for state changes. | Logged in `events` across 69 call sites in `src/`. | **Fully Met** | Comprehensive event coverage. |
| **FR-30.2** | Publish events post-commit. | `eventBus.publish()` executes after state writes. | **Fully Met** | Post-commit guarantee. |
| **FR-30.3** | Unique identifier, timestamp, context. | Stores `id`, `occurred_at`, `seu_id`, `actor_id`, `authority_badge`, `payload`. | **Fully Met** | Complete event envelope. |
| **FR-30.4** | Preserve event ordering per object. | `idx_events_originating` index over `(originating_object_type, originating_object_id, sequence)`. | **Fully Met** | Efficient per-object order queries. |
| **FR-30.5** | Multiple independent subscribers. | DB-backed subscriptions route events to multiple named handlers. | **Fully Met** | Supported via `event_subscriptions`. |
| **FR-30.6** | Correlation & Causation tracking. | Explicit `correlation_id` and `causation_id` columns in `events`. | **Fully Met** | Full causal graph tracing. |
| **FR-30.7** | Support event replay. | `eventsDB` exposes read methods; full event replay engine open. | **Partially Met** | Event log queryable; automated replay loop open. |

---

## 3. Subsystem Architecture & Execution Flow (§3, §9)

### 3.1 Command vs. Event Lifecycle (§3)
```
          Participant Command (Request Action)
                           │
                           ▼
          transitionEngine.evaluate()
                           │
             (Governance / Pre-conditions)
                           │
                           ▼
            *DB.updateStatus()  [State Mutated]
                           │
                           ▼
            eventBus.publish(Event)  [Fact Logged]
                           │
                 ┌─────────┴─────────┐
                 ▼                   ▼
           Persist `events`    Fire-and-Forget Dispatch
            (Postgres DB)     (event_subscriptions)
```

---

## 4. Identified Gaps & Architectural Clarifications

### Gap 1: Automated Event Replay (§14, FR-30.7)
- **Specification**: Event replay service allowing historic events to be re-run against subscribers for diagnostics, testing, or state reconstruction.
- **Codebase Realization**: Historical events are queryable via `eventsDB`, but an automated event re-dispatch replay engine (`EventReplayStarted`, `EventReplayCompleted`) is not implemented.

---

## 5. Conclusion

Chapter 30 specification alignment is **high (~92%)**. The Event Model provides a robust, decoupled, post-commit event bus (`eventBus.ts`). DB-backed subscriptions, correlation/causation tracking, and monotonic sequencing form a solid foundation for the platform's event-driven architecture.
