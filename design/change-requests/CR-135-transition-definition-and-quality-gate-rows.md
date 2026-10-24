# CR-135 — TransitionDefinition and QualityGate: states and rows for the authoring pairs that have none

**Raised:** 2026-10-23 · **Origin:** CR-128, Open question 2. Three `authoringMappings` pairs have no entity in `transitionDefinitions.json`.

**Status:** 🟡 Raised — design in progress

## Fix the following

| # | Item |
|---|---|
| 1 | The pairs `TransitionDefinition define`, `TransitionDefinition publish` and `QualityGate waive` have no row in `transitionDefinitions.json`. |
| 2 | Decide the states and transitions TransitionDefinition and QualityGate receive, so that each pair derives from rows. |
| 3 | Each new entity gets a birth row and wires `event_type`, `version_event` and `entityId` in at build time. |
| 4 | Once the rows exist, `authoringMappings` loses its last entries (CR-128 Design 13). |

## Still open

| # | Question |
|---|---|
| 1 | Does TransitionDefinition carry a lifecycle of its own, given that a row today has only `is_active` and `retired_at`? |
| 2 | Is `QualityGate waive` a transition of a QualityGate, or of the gate evaluation outcome (`Waived`)? |
