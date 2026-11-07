# CR-140 — Review gate: the governed step names the Deliverable, as a quality gate does

**Raised:** 2026-11-06 · **Origin:** EBM composition review (CR-139), review gates table.
**Status:** 🟡 Raised — design in progress

## Fix the following

- A review gate carries only a governed step, written as `Deliverable|from|to`. The step names the kind of thing and its states, not a specific Deliverable. A quality gate carries the step and also the Deliverable it is for. A review gate should be defined the same way as a quality gate, with the Deliverable.
- The composition of review gates is addressed in this change request. Until then, CR-139 compares review gates at the same step, whatever the Deliverable.

## Settled design

Nothing yet. The change to the review gate definition and to its composition is to be designed here.

## Still open

- The change to the Pack grammar for review gates and to the stored review gate rows.
- How review gates are grouped for comparison once they name a Deliverable.
