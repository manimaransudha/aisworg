# CR-003 — Commission an SEU from the Objectives screen (not the navbar)

**Raised:** 2026-08-12 · **Origin:** Chapter 1 §18 deep-dive (§18.8) · **Status:** ✅ Built 2026-08-12 · **Depends on:** CR-002

### ✅ Built 2026-08-12
The "Commission new SEU" navbar entry is removed. The Objectives list now renders a per-row **Commission SEU** action for objectives that are `commissionable` (Engineering-tier, Active, not already assigned) and a **Commissioned** badge for ones that already have an SEU (`listObjectives` gained `commissioned`/`commissionable`, backed by `seusDB.commissionedObjectiveIds()`); the action POSTs to the existing `/objectives/:id/commission` → `commissionFromExistingObjective`. The standalone `/seus/new` route is left intact (still used by the e2e commission helper); only its navbar surface is removed. **Verified:** tsc · regression **146/146** (clean DB) · dry-run **77/77** · HTTP audit — navbar entry gone; an Engineering objective shows the button and commissions to a new SEU (list then marks it Commissioned); a Strategic objective shows no button.

### Decision
Commissioning is initiated from the **Objectives screen**, not a global navbar action:
- Remove the standalone "Commission new SEU" entry from the navbar.
- On the Objectives list, the user selects a single **Engineering, un-commissioned** Objective and commissions an SEU for it (one-to-one — exactly one Objective per commissioning; see CR-002 / Ch.1 §18.1).
- If the selected Objective already has an SEU, refuse with a **correctable** error (show which are already assigned; let the user deselect/regroup). This "already assigned" guard rests on CR-002's `UNIQUE(seus.objective_id)`.

### Impact (for build, when approved)
- **Navbar** ([partials/navbar.ejs](../../src/views/partials/navbar.ejs)) — remove the commission link.
- **Objectives index** ([objectives/index.ejs](../../src/views/seu/objectives/index.ejs)) — add per-row "Commission SEU" affordance, filtered to Engineering-tier + un-commissioned; the recent list-UI retrofit (search/sort/pager) stays.
- **Commissioning flow** ([web/seus.ts](../../src/routes/seu/web/seus.ts), [core/commissioning.ts](../../src/routes/seu/core/commissioning.ts)) — repurpose/retire the standalone `/seus/new` form + `commissionFromForm`; entry now carries the chosen Objective id.
- **Open sub-questions** (from the §18 review): Template/Profile selection in the new flow (auto-derive from the Objective's required Capabilities vs. explicit pick); what a SEU row shows for its Objective (unchanged under 1:1).
- Tests + dry-run (`commission({ objectiveId })`) — unaffected in shape (still one Objective), but the web entry path changes.

### Depends on
CR-002 (the `UNIQUE` invariant powers the "already assigned" detection).
