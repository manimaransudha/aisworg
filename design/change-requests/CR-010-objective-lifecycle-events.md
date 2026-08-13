# CR-010 — Objective lifecycle & decomposition events (Ch.1 §14)

**Raised:** 2026-08-13 · **Origin:** Chapter 1 review — §14 gap recorded in Ch.1 §18.13 · **Status:** 🟡 Proposed — **not scheduled** (owner: raise now, not for work right away)

### The gap
Ch.1 §14 requires the Objective subsystem to publish eight events:

- `ObjectiveProposed`
- `ObjectiveActivated`
- `ObjectiveDecomposed`
- `ObjectiveCapabilitiesResolved`
- `ObjectiveAchieved`
- `ObjectiveSuperseded`
- `ObjectiveRetired`
- `ObjectiveArchived`

Today only a single generic `ObjectiveTransitioned` event is published (from `transitionObjective` in [objectives.ts](../../src/routes/seu/core/objectives.js)). No decomposition event (`ObjectiveDecomposed`) is emitted on create/re-parent, and no `ObjectiveCapabilitiesResolved` when required Capabilities are attached. Downstream traceability currently relies on **structural edges** (§13 — `Deliverable → SEU → Objective`, `parent_objective_id`), not on this event stream.

### What's wanted (to detail when scheduled)
- Emit the named lifecycle events, mapped from the governed transitions (`Proposed→Active` ⇒ `ObjectiveActivated`, etc.), either in place of or alongside the generic `ObjectiveTransitioned`.
- Emit `ObjectiveProposed` on creation, `ObjectiveDecomposed` when a parent/child edge is established (create under a parent, and CR-009 re-parent), and `ObjectiveCapabilitiesResolved` when required Capabilities are declared/derived.
- Decide whether the generic `ObjectiveTransitioned` stays (as a coarse audit event) or is replaced by the specific ones.

### Design questions to settle
- **Specific vs. generic.** Keep both (specific for consumers, generic for audit) or collapse to specific only?
- **Decomposition granularity.** One `ObjectiveDecomposed` per edge, or per re-parent move (which changes one edge but moves a whole subtree)?
- **Consumers.** Nothing consumes these yet — confirm there's a real consumer (projection, notification, external integration) before building, so this isn't events-for-events'-sake. Structural traceability (§13) already covers the graph.

### Not in scope / notes
- Not being built now — placeholder to capture the §14 delta.
- Purely additive to the event bus; no schema or lifecycle change implied.
