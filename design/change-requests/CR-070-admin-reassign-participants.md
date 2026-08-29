# CR-070 — Admin screens: reassign Deliverables and entities to new Participants

**Raised:** 2026-08-28 · **Origin:** owner — "Admin screens have to be created to reassign deliverables and entities to new participants." Surfaced during CR-068's discussion of `requested_by`/participant attribution, but is a separate, broader concern of its own. · **Status:** 🔵 Deferred — not designed, not scheduled, no open questions worked yet.

## The gap

No admin-facing mechanism exists today to reassign a Deliverable — or any other entity attributed to a Participant — to a different Participant after the fact (e.g. someone leaves, a team reorganizes, an attribution was wrong). Whatever the real set of reassignable entities turns out to be (Deliverables at minimum; possibly Objectives' own `requested_by`, SEUs, work items, or others attributed to a `participant_id`/`requested_by`-style column), there is no built UI or route for changing that attribution once a row exists.

## Not in scope yet

Nothing has been designed. This CR exists to hold the gap raised, not to commit to a mechanism, an entity list, or a UI shape.

## Open questions (none resolved yet)

- Which entities need this — Deliverables only, or every entity carrying a `participant_id`/`requested_by`-style attribution (Objectives, SEUs, work items, evidence, ...)?
- Is this a single generic "reassign" admin screen parametrized by entity kind, or a per-entity-kind screen?
- Who can perform a reassignment — a badge-gated action (this platform's own noun×verb model), and if so, which badge?
- Does reassignment leave an audit trail (who reassigned what, from whom, to whom, when) — this platform already has real Evidence/Event Bus machinery that a reassignment action would presumably need to feed.
- Does a reassignment affect only future behavior, or does it rewrite history (e.g. does a reassigned Deliverable's own past events/evidence get re-attributed too, or only its current-state attribution)?
