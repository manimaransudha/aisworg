# CR-136 — seedTransitionDefinitions refuses a row with no event, and the 62 rows are given one

**Raised:** 2026-10-23 · **Origin:** CR-128, Build progress row 14. The seed reports a row with no `eventType` as a problem and throws, once every row has an event.

**Status:** 🟡 Raised — design in progress

## Fix the following

| # | Item |
|---|---|
| 1 | 62 of the 157 rows in `transitionDefinitions.json` have no `eventType`: SEU 15, Deliverable 12, Participant 10, ExternalInteraction 6, AttentionItem 5, Review 5, Template 3, Profile 3, Finding 2 and EBM 1. Each gets an event, with a `version_event` where the entity is versioned. |
| 2 | `seedTransitionDefinitions.ts` throws when a row has no `eventType`. |
| 3 | The count of 62 is from the CR-128 audit. It is recounted before the build, because CR-130, CR-131, CR-132 and CR-133 have since added events to some entities. |

## Depends on

| # | CR | Why |
|---|---|---|
| 1 | CR-134 | ExternalInteraction rows get their events there. |
| 2 | CR-137 | The UI must refuse the same gap the seed refuses. |
