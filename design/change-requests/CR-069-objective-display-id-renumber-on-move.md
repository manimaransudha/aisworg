# CR-069 — Objective display id: renumber on re-parent (deferred)

**Raised:** 2026-08-28 · **Origin:** split out of CR-068 (Objective hierarchical display identifier) during design discussion. CR-068 settled on freeze-on-move as its own default — the display id is assigned once, at creation (`objectivesDB.create`), and `POST /objectives/:id/move` (`reParentObjective`, CR-009) never touches it, since nothing in that path re-runs the assignment logic. Owner: "freeze-on-move is the default, no-extra-code behavior for the current CR. Open renumber on move as a separate CR and keep it open/deferred." · **Status:** 🔵 Deferred — not designed, not scheduled, no open questions worked yet.

## The gap

Under CR-068's freeze-on-move default, an Objective's display id ("1.2", "1.2.1", ...) reflects only where it was *created*, not where it currently lives in the tree. After a re-parent (`reParentObjective`), a moved subtree's ids go stale relative to the tree shape — e.g. "1.2" moved under Strategic root "3" stays "1.2" forever, even though nothing under Strategic "1" is named "1.2" any more and nothing under "3" reflects the move.

This CR exists to hold that gap. Whether staleness after a move is actually a problem worth solving — versus freeze being the permanently correct answer — is itself unresolved.

## Not in scope for CR-068

Any change to `POST /objectives/:id/move` or `reParentObjective`. CR-068 ships with freeze-on-move only.

## Open questions (none resolved yet)

- Is renumbering actually wanted, or does freeze turn out to be the permanently correct behavior once lived with?
- If renumbering is wanted: does it cascade through the whole moved subtree (every descendant's segment re-derived from its new ancestor chain), and does that happen synchronously inside the move transaction or as a follow-up step?
- Does a renumbered Objective's *old* id become invalid immediately, or does something (a redirect, an alias record) keep old links/references working after a move?
- Interacts with CR-068's own still-open "where it's surfaced" question — anywhere the id is cached/displayed outside the Objective's own detail page (e.g. a Deliverable or SEU that mentions "Objective 1.2" in its own text) would go stale too.
