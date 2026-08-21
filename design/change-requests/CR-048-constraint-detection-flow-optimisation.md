# CR-048 — Constraint Detection (§11) + Flow Optimisation (§14): continuous incoming-edge-unsatisfied checking

**Raised:** 2026-08-21 · **Origin:** owner, reviewing Chapter 9 §19.5/§19.8's own "not built" verdicts — owner's own operational definition: "Constraint Detection is the Dependency Engine continuously checking, for every node, whether any incoming edge is still unsatisfied." Flow Optimisation (§14) folded into the same CR — its own criteria (unnecessary blocking dependencies, parallel-execution opportunities, bottlenecks) are analyses that naturally build on whatever Constraint Detection produces, not a separate mechanism. Specifics deliberately not detailed yet — this CR exists to hold the scope, not to fully design it. · **Status:** 🟡 Proposed (not scheduled)

## What exists to build on

- `isRowSatisfied` (`dependencyDefinitionEngine.ts:129-141`) already computes, per row, whether one FROM edge is currently satisfied — the exact primitive Constraint Detection needs, just never called proactively across a whole graph.
- `isTargetReady` already aggregates that per-target (`ready: boolean`, plus the raw `rows`) — but only ever for one specific `(toEntityType, toName, toState)` at a time, on demand (pull), never "for every node."
- `DeliverableBlocked`'s `reason` string (`deliverables.ts:143-150`) already names which rows are unsatisfied at the moment a transition is refused — the closest thing to a "constraint," but reactive (only exists at attempt time) and unstructured (a flattened string, not queryable data).

## The gap, per the owner's own definition

Nothing today asks "across this SEU's (or this Template's) whole graph, which nodes currently have an unsatisfied incoming edge, right now, unprompted." §11's own requirement — "shall remain independent of elapsed time" — reads as: this isn't a scheduled/batch job, it's always-current, the same way `isRowSatisfied` is always computed fresh, just scoped to the whole graph instead of one target.

## Scope (to be detailed later — placeholder only)

1. A real Constraint Detection mechanism: for a given SEU's applicable scope (Template + composed Packs + Profile, the existing `resolveOwningScope`), evaluate every governed node's incoming edges and report which are currently unsatisfied — as structured data, not just a refusal-time string.
2. Flow Optimisation (§14) as analysis on top of (1): unnecessary blocking dependencies, parallel-execution opportunities, bottleneck detection, decomposition recommendations — deferred until (1)'s shape is settled, since these all read the same underlying "what's currently unsatisfied, and where" data.
3. Whether this is push (event-driven, alongside `DeliverableReady`/`DeliverableBlocked`), pull (an on-demand query/API), or both — not decided.
4. Whether "Constraint" becomes a first-class object/table (as §11's own language implies — "constraints preventing engineering flow") or stays a computed view over existing data — not decided.

## Not in scope (for this CR as currently scoped)

- CR-047's own authoring-surface work (widening `fromType`/`toType`, Pack/Profile schemas) — unrelated; Constraint Detection reads whatever graph exists today, regardless of how narrow it currently is.
- External Dependency type support — separate, Chapter 9 §19.2's own still-open engine-layer gap.
