# CR-134 — ExternalInteraction: birth row, generic transition and the gaps against the chapter

**Raised:** 2026-10-23 · **Origin:** CR-128, Entity 36 (ExternalInteraction). CR-128 closed with this entity not moved to the generic transition function.

**Status:** 🟡 Raised — design in progress

## Fix the following

| # | Item |
|---|---|
| 1 | ExternalInteraction has a birth row `None → Created`, but the `Created` state is a hop out of the initial state, not a creation. Decide the birth state and move creation onto `findBirth`. |
| 2 | The six rows `Created → Validated → Dispatched → Acknowledged → Completed → Archived` and `Dispatched → Failed` name no `eventType` and no `version_event`. They gain them at build time. |
| 3 | Move the entity to `transitionEntity` and `publishTransition` through an adapter in `entityAdapters.ts`, with `nextActionsFor` for the buttons. |
| 4 | `evaluateGoverned` is called by ExternalInteraction today. `transitionEntity` calls `transitionEngine.evaluate`, which has no Quality Gate check. Decide how the adapter supplies the `seuId`, as for Evidence and Review. |
| 5 | One `route_authority` row per verb, one button per manual action, and the status DEFAULT dropped in the recovery SQL. |
| 6 | `Dispatched → Failed` is not in the specification. Confirm or remove it. |

## Still open

| # | Question |
|---|---|
| 1 | Chapter to read first. The chapter number for ExternalInteraction is not yet recorded in this CR. |
