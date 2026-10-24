# CR-137 — TransitionDefinition UI: an event field, and refusal of a row with no event

**Raised:** 2026-10-23 · **Origin:** CR-128, Build progress row 15. `addTransitionDefinition` in `core/transitionDefinitions.ts` accepts a row with no event, and the form has no event field.

**Status:** 🟡 Raised — design in progress

## Fix the following

| # | Item |
|---|---|
| 1 | The Add form on the Transition Definitions tab gains an event field. The options come from the Ontology event types. |
| 2 | `addTransitionDefinition` refuses a row with no event. |
| 3 | `insertDefinition` in `transitionDefinitionsDB.ts` writes `event_type` and the transition definition cache reloads as it does for the other writers. |
| 4 | The edit form (`/authority/transition-definitions/:id/edit`) shows the event. |

## Depends on

| # | CR | Why |
|---|---|---|
| 1 | CR-136 | The seed and the UI apply the same rule. |
