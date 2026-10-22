# CR-130 — SEU transition rows with no implementation

**Raised:** 2026-10-22 · **Origin:** CR-128, Entity 11 (SEU). The owner kept the rows below out of CR-128 and asked for them to be listed here.

**Status:** 🟡 Raised. Only the rows are recorded. No design and no build.

## Scope

This CR lists the SEU rows in `transitionDefinitions.json` that no code performs and that name no event. CR-128 leaves them unchanged. Their implementation is decided and built here.

## The rows

The from-states are written as they are after the CR-128 rename of `Pending` to `Initiated` and the new live row `Initiated → Validated`.

| # | From | To | Verb | Badge | Trigger | Event | Caller |
|---|---|---|---|---|---|---|---|
| 1 | `Validated` | `Composed` | `compose` | `seu_compose` | `governed` | none | none |
| 2 | `Composed` | `RuntimeAllocated` | `allocate_runtime` | `seu_allocate_runtime` | `governed` | none | none |
| 3 | `RuntimeAllocated` | `KnowledgeInitialised` | `initialise_knowledge` | `seu_initialise_knowledge` | `governed` | none | none |
| 4 | `KnowledgeInitialised` | `ParticipantsRecruited` | `recruit_participants` | `seu_recruit_participants` | `governed` | none | none |
| 5 | `ParticipantsRecruited` | `Commissioned` | `commission` | `seu_commission` | `governed` | none | none |
| 6 | `Commissioned` | `Configured` | `configure` | `seu_configure` | `governed` | none | none |
| 7 | `Configured` | `Activated` | `activate` | `seu_activate` | `governed` | none | none |

The trigger of each row is `governed` (set by CR-128), so `nextActionsFor` offers no button for it. With the seed default, `manual`, a holder of the badge would have seen a button such as Compose on a `Validated` SEU.

## Verbs

| Verb | Used only by an unwired row | Also used by a live row |
|---|---|---|
| `compose` | Yes (row 1) | No |
| `allocate_runtime` | Yes (row 2) | No |
| `initialise_knowledge` | Yes (row 3) | No |
| `recruit_participants` | Yes (row 4) | No |
| `commission` | No | Yes, the birth row `None → Initiated` and `Configured → Commissioned` |
| `configure` | No | Yes, `Validated → Configured` |
| `activate` | No | Yes, `Commissioned → Activated` |

## Facts recorded from CR-128

| # | Fact |
|---|---|
| 1 | No code in `src` calls these hops. No event subscription or handler runs them. |
| 2 | The live commissioning path is `Initiated → Validated → Configured → Commissioned → Activated → Operational`. The EBM flow (Compose EBM, validate, activate) runs while the SEU stays `Validated`. |
| 3 | The states of rows 1 to 4 appear in the spec text and in `tests/seu-ebm-event-lifecycle-table.test.ts`. |
| 4 | The four verbs of rows 1 to 4 are in `authorityVocabulary.json` with the note "vocabulary only for now; not yet wired into commissionSeu" (owner, 2026-09-06). |

## Open

| # | Question |
|---|---|
| 1 | Which rows become governed hops with events, and which are deleted? |
| 2 | For each row kept: its trigger, its event, its version event, and the code or subscriber that performs it. |
