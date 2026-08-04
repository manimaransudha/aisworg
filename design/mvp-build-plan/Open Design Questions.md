

# Open Design Questions

*Running log of design questions surfaced by building and testing the MVP, deliberately not resolved now — each is a real fork in how the full system (beyond this MVP) should behave, not a bug. Resolve these when the relevant fuller subsystem gets built, not before; recorded here so they aren't lost or silently decided by accident.*

---

## 1. Does a Deliverable's dependency gate *every* transition of it, or only the specific transition that needs the dependency?

**Surfaced:** 2026-08-03, while investigating a reported "Dependency Engine doesn't gate transitions" observation (see `design/observations/mvp1.md`) that turned out to be a display bug, not a gating bug (fixed same day — `getSeuDetailView` now recomputes edge readiness against live data before rendering, instead of reading the stored `readiness_state` column raw). Fixing that display bug is what surfaced this separate, still-open question underneath it.

**The question:** Architecture Document has one dependency edge — on Requirements Specification reaching `Approved`. As implemented, `dependencyEngine.isDeliverableReady()` checks *all* of a Deliverable's outgoing edges before allowing *any* transition of it, regardless of which target state is being requested. So today, Architecture Document can't even move `Defined → In Progress` (start work) until Requirements Specification is fully `Approved` — not just its own eventual `→ Approved` step.

Is that the right semantics, or should starting work be allowed to proceed in parallel, with only the transition that actually *needs* the upstream artefact gated on it?

- **Current MVP behavior (conservative):** nothing about a Deliverable moves until every one of its dependencies is satisfied. Simple, safe, but doesn't reflect how engineering often actually proceeds — architecture drafting frequently starts against a not-yet-finalized requirements spec.
- **Alternative (per-transition scoping):** a dependency edge would need to declare *which* transition it gates (e.g., "requires Requirements Specification Approved before Architecture Document can reach `Approved`", not before it can even reach `In Progress`). This is a real schema change — `dependency_edges` would need to carry a target transition (or target state), not just apply blanket-wide to the owning Deliverable.

**Why this waits for the full system, not this MVP:** the honest answer depends on machinery this MVP doesn't have yet — Work Items/Commands (Ch.31/32) that would let multiple Participants work on dependent Deliverables concurrently, and the Workflow Runtime that the platform's own dashboard already labels "partial" for exactly this reason ("Dependency Engine sequences Deliverables; no separate Workflow abstraction"). Deciding this now, against the MVP's flat two-Deliverable seed data, risks guessing at a shape the fuller execution model would just have to redo.

**Resolve when:** the Execution Engine / Work Item / Dispatch Engine layer gets built (see the orchestration-gap discussion in this session — Book 3 Ch.31–33), since that's what would actually let "start work in parallel, gate only the final transition" mean something operationally, rather than being a schema change with no behavior behind it.
