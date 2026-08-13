# CR-012 — Objective delete (Proposed leaf) and retire (Active subtree)

**Raised:** 2026-08-13 · **Origin:** owner — "Allow delete if no SEU is commissioned against any objective in the tree; otherwise retire." (refined over several messages) · **Status:** ✅ Built 2026-08-13

> **Built 2026-08-13.** `tsc` clean; full suite **142 pass / 0 fail / 1 skip** (the pre-existing CR-006 skip); delete/retire flows smoke-verified end-to-end (delete blocked on Active + on parents, allowed on Proposed leaves, bottom-up deletion; subtree retire retires the node + Active descendants and skips non-Active ones; tree rows show the right button). Not committed (owner commits via GitHub Desktop).
>
> **Files:** [objectivesDB.ts](../../src/dblayer/objectivesDB.ts) (`delete`), core [objectives.ts](../../src/routes/seu/core/objectives.js) (`deleteObjective`, `retireObjectiveSubtree`, `deletable`/`retirable` on `ObjectiveListItem` + `ObjectiveDetailView`), web route [objectives.ts](../../src/routes/seu/web/objectives.js) (`POST /:id/delete`, `POST /:id/retire`), views [_nodes.ejs](../../src/views/seu/objectives/_nodes.ejs) + [detail.ejs](../../src/views/seu/objectives/detail.ejs).

### The rule (as agreed)

Each objective node in the tree offers **either** a Delete **or** a Retire action, by its state:

**Delete — hard delete**
- Offered **only** when the objective is **`Proposed`** *and* a **leaf** (no children).
  - A parent (has children) is never deletable — remove a branch bottom-up: delete the SEU-free Proposed leaves, and each parent becomes deletable once its children are gone.
  - "Once defined [Active] only retire is allowed" — an Active (or later) objective is never deletable.
- **No SEU is possible** on a Proposed objective (commissioning requires `Active`), so the "not commissioned in its subtree" rule is satisfied by construction; the code still asserts it defensively.
- **Effect:** removes the objective row and its `objective_capabilities` links only. Nothing to unwind — no SEU / EBM / Deliverables can exist for a Proposed leaf.

**Retire — governed, node + subtree**
- Offered when the objective is **`Active`**.
- Transitions the node **and every Active descendant** to **`Retired`** via the existing governed transition (`objective_retire`, `Active → Retired`; needs the `objective_retire` badge; preserves history + SEUs).
- **Mixed-state descendants:** a descendant not currently `Active` (e.g. a `Proposed` child, or an already-terminal one) has no `→ Retired` edge, so it is **skipped and reported** (e.g. "4 retired, 1 skipped — not Active"), not force-changed. *(Flagged: this can leave a Proposed child under a Retired parent; acceptable for now — the Proposed child remains independently deletable.)*

### States → action
| Objective state | Leaf? | Action shown |
|---|---|---|
| `Proposed` | leaf | **Delete** |
| `Proposed` | has children | *(neither — delete its children first)* |
| `Active` | any | **Retire** (node + subtree) |
| `Achieved` / `Superseded` / `Retired` / `Archived` | any | *(neither)* |

### Authority
- **Retire** is governed — the existing `objective_retire` badge via `transitionEngine` (CR-006). Unchanged.
- **Delete** is **ungoverned** (gatekeeper-authenticated only), consistent with Objective *creation* being ungoverned today (Ch.1 §18.10). It only ever removes a not-yet-activated draft with nothing downstream. *(Residual: if creation/deletion authority is later governed, delete joins that track.)*

### Surfaces
- **Tree node rows** (`_nodes.ejs`) and the **Objective detail page** (`detail.ejs`) each render the state-appropriate Delete or Retire button (CSRF-protected form).
- New routes: `POST /aisworg/seu/objectives/:id/delete`, `POST /aisworg/seu/objectives/:id/retire`.
- `ObjectiveListItem` gains `deletable` (`Proposed && leaf && !commissioned`) and `retirable` (`Active`) so the views don't re-derive the rule.

### Not in scope
- No new lifecycle states or transition definitions (uses the seeded `Active → Retired`).
- No cascade *delete* of subtrees (delete is leaf-only by rule).
- Events beyond what `transitionObjective` already emits (`ObjectiveTransitioned`); the named `ObjectiveRetired` event stays under CR-010.
