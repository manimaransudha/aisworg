# CR-040 — Dependency Engine: full nine-event taxonomy (Ch.9 §15)

**Raised:** 2026-08-20 · **Origin:** split out of CR-039 in the same design conversation — owner: "Let us cover the complete set as a new CR." CR-039 publishes only whatever event(s) are strictly required to make push-based evaluation real; this CR is the complete, polished set Chapter 9 §15 actually names. · **Status:** ❌ Closed 2026-08-20 — not needed as its own CR; residue folded into CR-042

> **Closed 2026-08-20, not built.** Re-examined once CR-039/041/043/038 actually existed (this file was written before any of them were built, when the whole taxonomy was still speculative against a per-SEU `dependency_edges` model). Owner's own question going in: "I am trying to understand do we need these many with the changed design" — the honest answer, checked against real usage, is no.
>
> **The actual test applied:** this codebase publishes events almost entirely for audit/telemetry querying (the `events` table, `GET /seus/:id/events`, things like the existing Governance Telemetry's Quality Gate latency metric) — there is exactly **one** live `eventBus.subscribe` in the whole system (`assignmentDelivery.ts`, `WorkItemDispatched`). Every other published event, including `QualityGatePassed`/`Blocked`, has zero reactive subscribers; its value is being queryable later. Measured against "would this answer a real question someone might ask of the audit trail," not "is it theoretically buildable":
>
> - **`DependencyCreated`** — no. `dependency_definitions` rows are authoring-time config, not a governed entity with its own lifecycle; no other junction table in this system (`template_packs`, `template_capabilities`, `profile_packs`) publishes creation events, and Template's own `TemplateCreated`/`TemplatePublished` already capture "when was this Template authored." Would be per-row noise with no precedent behind it.
> - **A finer-grained per-row `DependencySatisfied`/`DependencyBlocked`** (below the aggregate) — no. Nobody needs a report on individual prerequisite rows; the aggregate ("was this Deliverable blocked, for how long") is the metric that actually matters, matching what Quality Gate telemetry already tracks.
> - **`DependencyWaived`, `ConstraintDetected`/`Resolved`, `CircularDependencyDetected`** — still genuinely blocked on mechanisms that don't exist (a waiver flow, a first-class Constraint object, runtime or authoring-time cycle detection). Not a "not needed" verdict — a "can't responsibly build yet" one.
> - **The aggregate pair** (Ch.9's `DeliverableReady`/`DeliverableBlocked`) — yes, this one holds up: it directly mirrors `QualityGatePassed`/`Blocked`'s own proven precedent. Already half-built too — CR-039's `evaluateAndPublishFromTransition` already publishes exactly this aggregate signal, just under the wrong name (`DependencySatisfied`, which reads as per-row when the actual logic is aggregate-only).
>
> Net: 2 of the original 9 survive contact with how this system actually uses its event bus. That's too small to justify a standalone CR — **moved into CR-042** (a rename of what's already built, plus one new counterpart event, both landing exactly where CR-042 was already wiring real triggers).

## Scope (as originally proposed — superseded, kept for history)

Chapter 9 §15 names nine events the Dependency Engine "shall publish." As of the Ch.9 implementation review (2026-08-20), zero exist — the engine doesn't import `eventBus` at all. CR-039 closes that gap partially, publishing whatever minimal event(s) its own push-evaluation mechanism needs. This CR is the rest:

- `DependencyCreated`
- `DependencySatisfied`
- `DependencyBlocked`
- `DependencyWaived`
- `DeliverableReady`
- `DeliverableBlocked`
- `ConstraintDetected`
- `ConstraintResolved`
- `CircularDependencyDetected`

## Open design questions (not resolved — this is a proposal, not a build)

- **`DependencyWaived`** implies a real waiver mechanism for a dependency edge. None exists today (Chapter 9 §19.3 found no `Waived` state anywhere for dependency edges, unlike Findings/Compliance Requirements which do have real waiver flows). Does this event imply building that mechanism, or does it stay unpublishable until/unless a waiver concept is added separately?
- **`ConstraintDetected`/`ConstraintResolved`** presuppose a first-class Constraint object (Ch.9 §11), which CR-039 explicitly does not build (Constraint Detection remains unaddressed by that CR). These two events may need to wait on a Constraint Detection CR of their own, or be redefined to fire off something CR-039 *does* produce (e.g. a Quality-Gate-style block reason) rather than a dedicated Constraint entity.
- **`CircularDependencyDetected`** — CR-038's own authoring-time cycle-detection widget is a validation check, not obviously an event-publishing runtime component. Does this event fire from that widget (an authoring-time event) or does it imply runtime cycle detection CR-039 doesn't build?
- **`DeliverableReady`/`DeliverableBlocked`** are the most directly buildable pair once CR-039's push mechanism exists — likely the natural first two to build here.

## Not in scope

Building any of the above. This CR is a placeholder for a future, explicitly-scoped follow-up once CR-039 is built and these open questions are answered.
