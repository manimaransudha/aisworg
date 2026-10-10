# Chapter 34 – Attention Management Model

## 1. Purpose

The Attention Management Model defines how the platform identifies, prioritises, routes and manages situations requiring intervention by Participants, users or external systems.

Attention Management ensures that attention is directed only towards engineering situations requiring action or awareness.

The platform shall minimise unnecessary interruptions while ensuring that significant engineering events receive appropriate attention.

---

## 2. Scope

This chapter defines:

- Attention abstraction
- attention evaluation
- attention routing
- attention prioritisation
- attention lifecycle
- attention traceability

This chapter does not define:

- event publication
- engineering behaviour
- participant implementation
- communication technologies

---

## 3. Architectural Position

```
Events

↓

Attention Evaluation

↓

Attention Items

↓

Routing

↓

Participants
Users
External Systems
```

Attention Management determines who, if anyone, needs to be informed or engaged.

---

## 4. Definition

An Attention Item represents a situation requiring awareness, acknowledgement or action.

Attention Items are derived from engineering events and runtime state.

Not every Event produces an Attention Item.

---

## 5. Architectural Principles

##### AM-001

Attention is demand-driven.

##### AM-002

Attention shall be minimised.

Only situations requiring intervention shall generate Attention Items.

##### AM-003

Attention shall be prioritised.

##### AM-004

Attention shall be context-aware.
 
##### AM-005

Attention routing shall be declarative.

##### AM-006

Attention decisions shall be traceable.

---

## 6. Functional Requirements

##### FR-34.1

The platform shall evaluate Events to determine whether attention is required.
 
##### FR-34.2

Attention rules shall be contributed through Packs.
 
##### FR-34.3

Attention Items shall possess explicit priority.
 
##### FR-34.4

Attention Items shall support acknowledgement.
 
##### FR-34.5

Attention Items shall support escalation.
 
##### FR-34.6

Attention routing shall consider Authority, responsibility and engineering context.
 
##### FR-34.7

Attention history shall remain permanently traceable.
 
## 7. Attention Categories

Illustrative categories include:

##### Informational

Engineering awareness only.
 
##### Action Required

Requires Participant or user intervention.
 
##### Approval Required

Requires an authorised engineering decision.
 
##### Escalation

Requires management attention.
 
##### Exception

Engineering execution cannot proceed.
 
##### Advisory

Provides useful engineering guidance without requiring action.

Additional categories may be introduced through Packs.

---

## 8. Attention Structure

Every Attention Item shall define:

- Identifier
- Category
- Priority
- Triggering Event
- Related Engineering Objects
- Intended Recipients
- Required Action
- Due Context
- Escalation Rules
- Status

---

## 9. Attention Lifecycle

Attention Items shall progress through the following lifecycle.

```
Created

↓

Delivered

↓

Acknowledged

↓

In Progress

↓

Resolved

↓

Closed
```

Historical Attention Items remain available for audit purposes.

---

## 10. Attention Evaluation

The platform shall evaluate:

- engineering Events
- Deliverable state
- Governance outcomes
- unresolved Obligations
- Review findings
- runtime failures

Evaluation determines whether attention is required.

---

## 11. Routing

Attention may be routed to:

- AI Participants
- Human Participants
- SEU Managers
- Organisation representatives
- external systems

Routing shall consider:

- Authority
- engineering responsibility
- participant availability
- organisational preferences

---

## 12. Prioritisation

Priority shall consider:

- engineering impact
- dependency impact
- governance impact
- customer impact
- operational risk
- urgency

Priority algorithms are contributed through Packs.

---

## 13. Escalation

Attention Items may escalate according to declarative rules.

Escalation may depend upon:

- elapsed time
- engineering stage
- unresolved obligations
- repeated failures
- governance rules

Escalation shall preserve complete traceability.

---

## 14. Attention Traceability

Every Attention Item shall preserve:

- triggering Event
- originating engineering object
- routing decision
- recipients
- acknowledgements
- escalations
- resolution history

---

## 15. Events

The Attention subsystem shall publish:

- AttentionCreated
- AttentionDelivered
- AttentionAcknowledged
- AttentionEscalated
- AttentionResolved
- AttentionClosed

---

## 16. Non-Functional Requirements

The Attention Management Model shall:

- minimise unnecessary notifications
- support intelligent routing
- preserve traceability
- support high-volume event streams
- remain independent of communication technologies

---

## 17. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Not every Event creates an Attention Item.

✓ Attention Items are prioritised.

✓ Routing is context-aware.

✓ Escalation is declarative.

✓ Attention history is preserved.

✓ Routing remains extensible through Packs.

---

## 18. Deliverables

Implementation of this chapter shall produce:

- Attention Engine
- Attention rule framework
- Routing service
- Escalation service
- Attention registry
- Attention APIs
- Attention events

---