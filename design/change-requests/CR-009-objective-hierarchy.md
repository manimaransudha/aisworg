# CR-009 — Objective hierarchy: mandatory parent + contextual creation + tree view + re-parenting

**Raised:** 2026-08-13 · **Origin:** owner — "Parent is a must for Operational and Engineering objectives; current implementation has it as optional." · **Status:** ✅ Built 2026-08-13

> **Built 2026-08-13.** Backend + tree UI landed; `tsc` clean, migration `037` applied, full suite **142 pass / 0 fail / 1 skip** (the pre-existing CR-006 skip), and all seven tree/detail/new/fragment routes smoke-render 200. Not committed (owner commits via GitHub Desktop).
>
> **Files:** core [objectives.ts](../../src/routes/seu/core/objectives.ts) (mandatory-parent, `reParentObjective`, tier-integrity `updateObjective`, tree helpers `getObjectiveRootsPage`/`getObjectiveChildren`/`searchObjectives`/`listReParentCandidates`, `ensureOneShotContainer`), [commissioning.ts](../../src/routes/seu/core/commissioning.ts) (non-Strategic-leaf gate; one-shot container), [sdkAuthoring.ts](../../src/routes/seu/core/sdkAuthoring.ts) (authoring Objective under container), [objectivesDB.ts](../../src/dblayer/objectivesDB.ts) (`findRootsPage`, `childCounts`, `findDescendantIds`, `findAncestorPath`, `updateParent`, `findStrategicByStatement`), migration [037](../../src/dblayer/migrations/037_objective_parent_required.sql), web route [objectives.ts](../../src/routes/seu/web/objectives.ts), views [index.ejs](../../src/views/seu/objectives/index.ejs)/[_nodes.ejs](../../src/views/seu/objectives/_nodes.ejs)/[new.ejs](../../src/views/seu/objectives/new.ejs)/[detail.ejs](../../src/views/seu/objectives/detail.ejs), ViewModels `seu_objectives_index.js`/`seu_objectives_new.js`.
>
> **One-shot commissioning (owner decision, 2026-08-13):** the "commission from a bare statement" paths (`commissionFromForm` behind the prod `/seus/new` form + 25 tests; and `startAuthoring`) have no natural parent. Rather than remove them, they now hang their Engineering Objective under a single **reused Strategic container root** (`ensureOneShotContainer`, sentinel statement *"Uncategorised — directly-commissioned SEUs"*). Keeps those paths + all tests working; the container is one auto-generated root, not one per SEU. Tests that build Objectives directly (objective-lifecycle, commission-profile-choice, governance-ebm-sharpening, engine, acceptance.e2e, dry-run client) were updated to construct a valid Strategic→Engineering tree.

### The rule
- **Parent is mandatory for `Operational` and `Engineering`.** `Strategic` is the only tier allowed to be parentless (the root).
- **No strict decomposition** — the parent only has to be *not more strategic* than the child: `TIER_RANK[child] ≥ TIER_RANK[parent]` (the existing check; `Strategic`=0, `Operational`=1, `Engineering`=2). So e.g. Engineering directly under Strategic is still allowed.

### The gap today
`createObjective` treats `parentObjectiveId` as optional for every tier (it only validates a parent *if given*), and `objectives.parent_objective_id` is nullable — so orphan Operational/Engineering Objectives can be created.

### Enforcement (backend)
- `createObjective` rejects `Operational`/`Engineering` with no parent (clear, correctable error), alongside the existing tier-rank check.
- DB invariant: `CHECK (tier = 'Strategic' OR parent_objective_id IS NOT NULL)`. First verify no existing Operational/Engineering rows are parentless (backfill/guard, else the constraint add fails).

### Creation UX — contextual (parent = the node you create from)
- **No objectives yet** → only **Create Strategic** is offered.
- On a **Strategic** node → **Add Operational** / **Add Engineering** child.
- On an **Operational** node → **Add Engineering** child.
- **Engineering** node → leaf (no add-child in the flow).

The child's tier is set by the button (no free tier picker), and the parent is always the node — so "parent required" and a valid tier relationship are guaranteed by construction.

### Display — tree (paginated + searchable)
The Objectives page **becomes** the tree (replaces the flat list). Because there can be many roots:
- **Browse mode (no search):** the **Strategic roots are paginated** (server-side page over Strategic objectives); each root is expandable to reveal its children, recursively (children lazy-loaded per node).
- **Search mode:** a text search over statements returns a **flat, paginated result list**, each match shown with its **path/breadcrumb to root** for context (searching a tree by filtering branches is deferred; flat-with-path is the first cut).

### Commissioning — any non-Strategic **leaf** (supersedes CR-002's Engineering-tier rule)
- **Commission SEU** is offered on any node that is a **leaf** (no children) **and not Strategic** — i.e. an Operational or Engineering objective with no children, Active, not already commissioned.
- Rationale: an SEU serves the *finest-grained* objective. If an Operational objective has no Engineering children, it *is* the leaf and gets an SEU directly; if it has Engineering children, those leaves get the SEUs.
- **Strategic is never commissionable** (even as a lone leaf).
- **Changes CR-002 / Ch.1 §18.2:** the "Engineering-tier only" guard in `commissionSeu` becomes "**not Strategic AND is a leaf**." The `UNIQUE(seus.objective_id)` (one SEU per objective) invariant is unchanged.

### Re-parenting — parent picker
Move an objective to a different parent via a **parent picker** (valid parents only — drag-and-drop rejected as clumsy at scale). Its **whole subtree comes with it** automatically (descendants point at the moved node; only the moved node's `parent_objective_id` changes). Guards:
- new parent must be *not more strategic* than the moved node (same rank rule);
- no cycles — cannot move a node under itself or any of its descendants;
- if the moved node is Operational/Engineering, a parent is required (can't move to "no parent").

### Tier edit — allowed while tree integrity holds
`updateObjective` may change an objective's tier **iff no invariant is violated**:
- if the new tier is Operational/Engineering, the node must have a parent (a Strategic root can't become Operational/Engineering — it has no parent);
- the node's parent (if any) must be *not more strategic* than the new tier;
- **every child** must be *not more strategic* than the new tier.

E.g. a Strategic objective with children cannot be changed to Operational (it's a root → no parent). Otherwise allow it.
