# CR-050 — SEU commissioning must check referenced Definitions are Active at commissioning time

**Raised:** 2026-08-21 · **Origin:** owner, working through CR-049 (Deliverable authoring) — "no change to anything that is already instantiated. At the time of SEU commissioning, it has to check that whatever it is picking is active at that instant. Not in scope here, but may be create a CR so we check it when we review SEU." Filed as a placeholder so it isn't lost, not designed yet. · **Status:** 🟡 Proposed (not scheduled)

## The gap

Once Deliverable Definitions exist (CR-049) as real, versioned, lifecycle-governed entities (Draft → Validated → Published → Active, same shape as Template/Pack/Profile), a Template's `deliverableCatalogue` entry references one. Nothing today checks, at the moment an SEU is actually commissioned from that Template, whether the referenced Definition is still **Active** — it could have been retired, superseded, or never published at all by the time commissioning happens.

This mirrors a real, established discipline already applied elsewhere in commissioning (e.g. Pack composition already excludes non-Active Packs and warns by name, `compositionEngine`) — Deliverable Definitions would be the one referenced entity in the commissioning path without an equivalent live check.

## Explicitly not in scope for CR-049

CR-049 is Definition-authoring only (see its own "Definition vs. instance" scope boundary) — it doesn't touch commissioning. This CR is the commissioning-side counterpart, deliberately kept separate.

## Scope (not designed yet — placeholder)

- Where exactly this check belongs in the commissioning flow (`commissionSeu`/`compositionEngine`) — not decided.
- What happens on failure — hard-block commissioning (like a composition conflict) vs. a warning, per-Definition — not decided.
- Whether this only applies to tenant-derived Definitions or also to Platform's own root concepts — not decided.

## Not to be worked on before CR-049's own design lands

This CR only makes sense once CR-049 gives Definitions a real Active/inactive lifecycle to check against. Revisit when SEU commissioning itself is under review.
