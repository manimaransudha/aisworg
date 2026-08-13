# CR-013 — Objectives tree UI: styling & layout pass

**Raised:** 2026-08-13 · **Origin:** owner — "Functionally it all works; the UI styling and layout has to be changed." · **Status:** 🟡 Proposed — **not scheduled** (owner: do it later)

### Context
The Objective hierarchy work (CR-009) and the delete/retire actions (CR-012) are **functionally complete and verified**. What remains is a **visual / layout** pass — the current styling is functional-but-rough, assembled incrementally as features landed. No behaviour change is in scope; this is presentation only.

### Surfaces to restyle
- **Objectives tree** — [index.ejs](../../src/views/seu/objectives/index.ejs) (browse + search modes) and the node-row partial [_nodes.ejs](../../src/views/seu/objectives/_nodes.ejs).
- **Objective detail** — [detail.ejs](../../src/views/seu/objectives/detail.ejs) (Lifecycle / Edit / Decomposition / Move / Delete-Retire / Capabilities cards).
- **New Objective form** — [new.ejs](../../src/views/seu/objectives/new.ejs) (contextual create).

### Known rough edges (to detail when scheduled)
- **Dense action rows.** Tree node rows crowd many controls on one line (expand chevron, tier/status badges, Add-child buttons, Commission, Delete/Retire, View). Needs a cleaner hierarchy — likely a primary action + an overflow/kebab menu, or grouping.
- **Ad-hoc button styling.** Buttons were added per-feature (`btn-outline-secondary`, `-primary`, `-danger`, `-warning`, `py-0`) without a consistent system — sizes/colours/spacing vary.
- **Tree affordances.** Indentation is a fixed inline `padding-left` per depth; expand/collapse is a bare chevron with no connecting lines or clear nesting cues; lazy-loaded children appear without transition.
- **Badges & states.** Tier and status badges use inline `<style>` colour maps duplicated across index/detail — consolidate, and make state/tier visually legible at a glance.
- **Search vs browse.** The two modes render quite differently (flat list with breadcrumb vs nested tree); the switch could be smoother and more obviously the same page.
- **Responsive/overflow.** Wide action rows and breadcrumbs should degrade gracefully on narrow widths (horizontal scroll containers, wrapping).
- **Detail page cards.** The stacked dark-headed `.section-card`s are heavy; Move / Delete-Retire could be grouped more sensibly (e.g. a single "Structure & lifecycle" area).

### Not in scope
- Any functional/behavioural change (creation rules, commissioning eligibility, delete/retire semantics, authority) — those are settled in CR-009 / CR-012.
- Navigation/IA beyond these three views.

### Notes
- Deferred — captured now so the visual debt is tracked; to be detailed and scheduled later.
- Worth deciding up front whether this rides on the existing Bootstrap classes or introduces a small shared component/CSS layer for the tree.
