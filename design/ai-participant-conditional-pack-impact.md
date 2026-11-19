# Conditional Pack composition: impact assessment

**Status:** Built pending testing (2026-11-19). `tsc` is clean. `db:clean-slate` and the tests have not been run.
**Belongs to:** the AI Participant design (step 5 of the pilot). Working notes are in [ai-participant-skills-design.md](ai-participant-skills-design.md).
**Date:** 2026-11-19

## 1. What step 5 needs

A Conditional Pack is selected when the Profile's configuration satisfies a condition the Pack declares. The Pack spec states this rule (`01_Pack.md:226-236`). Before this work no code implemented it.

Searches that support the absence claim:

| Search | Result |
|---|---|
| `conditional`, case-insensitive, across `src/**/*.ts` (excluding `src/docs`) | Only the Pack dependency type unions: `packsDB.ts:39`, `packsDB.ts:102`, `seuTypes.ts:117`, `packs.ts:99`, `packs.ts:144`. Nothing reads the value. |
| `findActiveMandatory` across `src` and `tests` | `packsDB.ts` (definition), `composedPacks.ts:26` (the only live caller). The caller in `profileCompositionUnravel.ts:172` is commented out. |
| `"Conditional"` and `'Conditional'` across `src` and `tests` `*.ts` | No hits |
| Classification and category of every `src/dblayer/seed/data/*.pack.json` | Mandatory, Recommended and Optional only, before the three AI skill Packs |

## 2. Design as built

The owner's direction: save the condition on the Pack, and process it only at the Profile.

| Element | Design |
|---|---|
| Declaration | A Pack property `compositionConditions`, a list of rows `{parameter, value}`. `parameter` is a `profile-configuration` Ontology code (for example `ai-provider-preference`). `value` is a code of that parameter. The Pack only stores it. |
| Form | The list shows on every Pack form. Top-level fields support `x-show-when` on a field that has a value, and `x-show-when-values` only on list item fields (`_referentialListGroup.ejs`). Restricting the list to Conditional would need form code. The help text says it applies to Conditional Packs. |
| Processing | The Profile hop Validated to Published runs the `unravel-profile` action, which calls `materialiseProfileDraft`. That function writes the Profile's Pack selections to `profile_packs`. It now also calls `matchingConditionalPackCodes`. |
| Rule | A Conditional Pack is selected when any row matches the Profile. A list parameter matches when it holds the value. A single-value parameter matches when it equals the value. |
| Storage of the selection | The matched Packs are written to `profile_packs` under the list kind `conditional`. `getProfilePackCodes` reads every list kind, so composition, `compositionEngine` and commissioning pick the Pack up with no change. The Profile form and copy-as-new-version read only the known list kinds, so a conditional Pack never becomes an explicit selection. |
| Validation | A Conditional Pack needs at least one condition. Each row needs a parameter and a value. The parameter must be a `profile-configuration` concept and the value a concept of that parameter. A condition on a non-Conditional Pack is accepted and ignored. |

## 3. Storage of the condition

A new column `composition_conditions JSONB NOT NULL DEFAULT '[]'` on `packs`, mirroring `composition_sources`. The alternative was the `metadata` column, whose helper `packMetadataFromSeed` accepts only strings (`packs.ts:126-133`). The column keeps that convention.

## 4. Files changed

| # | File | Change |
|---|---|---|
| 1 | `src/dblayer/seed/data/schemaDefinitions.json` | Pack schema gains `compositionConditions`, placed after `installationClassification` in the property order |
| 2 | `src/dblayer/recovery/packs_schema_recovery.sql` | Adds the column. `db:clean-slate` recreates the table. A live database needs the column before use. |
| 3 | `src/dblayer/seuTypes.ts` | `PackRow.composition_conditions` |
| 4 | `src/dblayer/packsDB.ts` | `create` and `updateDraftContent` write it. New finder `findActiveConditionalVisibleTo`. |
| 5 | `src/dblayer/constants.ts` | `PACK_CLASSIFICATION_CONDITIONAL`, `PROFILE_CONDITIONAL_PACK_LIST_KIND` |
| 6 | `src/routes/seu/core/packs.ts` | `PackSeedInput.compositionConditions`. `validatePackSeed` validates it. |
| 7 | `src/routes/seu/core/sdkAuthoring.ts` | Create, save and copy-as-new-version carry it |
| 8 | `src/domain/engine/entityAdapters.ts` | `packContent` returns it |
| 9 | `src/routes/seu/core/profiles.ts` | `matchingConditionalPackCodes`, called from `materialiseProfileDraft` |
| 10 | `src/dblayer/seed/data/ai-skill-job-anthropic.pack.json` | The condition `ai-provider-preference = anthropic` |
| 11 | `tests/schemaFixtures.ts` | The maximal Pack holds a condition. `FIXTURE_VERSION` is 1.0.8. |
| 12 | `tests/cr150-conditional-packs.test.ts` | New test file |

`toPackSeedInput` spreads the content, so the property reaches the seed without a change there. Composition files are unchanged.

## 5. Existing behaviour that could break

| Area | Assessment |
|---|---|
| Existing Packs and seeds | No existing Pack is Conditional (section 1). The column default is an empty list. |
| `PackRow` literals | A search for `composition_sources` in `src` and `tests` found no Pack row literal. `tsc` is clean. |
| Pack write validator | `validatePackWriteAgainstSchema` builds a fixed content subset and ignores the new property. The property is optional. |
| Maximal Pack fixture | Its classification is a fixture-only code. It carries a condition row, which validation accepts. |
| Copy and inherit | The conditional list kind is not read by `getProfilePackSelections`, so a Profile copy does not carry the Pack as a choice. |
| Re-unravel | `setPackSelection` deletes the list kind before it writes, so the selection follows the Profile's current configuration. |
| Schema tests | `tests/schema-registry.test.ts` treats Pack as a load-bearing kind. It has not been read for property counts. Check it on the first run. |
| Demo data | The four demo Profiles take `anthropic`. Their Profiles select the Anthropic Pack once they publish. This is the intended effect. |
| Seed order | The Packs must be Active before the Profiles publish. The existing seeds already select Packs by code in that order. |

## 6. Existing behaviour already affected by steps 2 and 3

This section concerns changes made earlier, not the Conditional work.

| # | Finding | Evidence |
|---|---|---|
| 1 | The two Mandatory skill Packs compose into every EBM. Every Work Item `execution_context` therefore carries their text as `engineeringCapital` entries, for human Participants too. | `workItemGenerator.ts:87-98` |
| 2 | The SEU page renders the context to markdown with `executionContextMarkdown`. Its Engineering Capital table puts `c.url` in a cell, and `cell()` replaces newlines with spaces and escapes pipes. A skill text would appear as one very long cell with its tables and lists flattened. | `executionContextMarkdown.ts:5-8` and `:50`, called from `seus.ts:496` |
| 3 | The EBM Engineering Capital tab displays entries as they are. Its rendering of a long markdown value has not been read. | `ebm.ejs` |
| 4 | The Engineering Capital conflict check compares `url` text. Distinct types keep the three skill Packs apart. | `conflicts/engineeringCapital.ts:29-41` |
| 5 | `tests/execution-engine.test.ts:454-456` compares the context entries with the settled entries and expects an empty list for a Deliverable with no producing Capability. Both hold under the new data. | |

Finding 2 is open. A skill entry should render as its type and a short note in the SEU page, and not as a cell holding the full text. The rule must identify a skill entry without a literal in code. One way is an Ontology marker on the `engineering-capital` concept. This is the owner's design choice.

## 7. Tests

| File | Coverage |
|---|---|
| `tests/cr150-conditional-packs.test.ts` | Validation (empty list, blank row, unknown parameter, unknown value, valid row). A Profile holding the test-only provider value selects the Pack. A Profile holding `none` does not. The Profile form selections never hold the Pack. |
| `tests/schemaFixtures.ts` | The maximal Pack fixture carries a condition. |

## 8. Decisions

| # | Decision | Outcome |
|---|---|---|
| 1 | Storage: new column or `metadata` | New column |
| 2 | A condition on a non-Conditional Pack | Accepted and ignored |
| 3 | Where the condition is processed | At the Profile, when it is unravelled (owner) |
| 4 | How the SEU page shows a skill entry (section 6, finding 2) | Open |

## 9. Verification

`tsc` was run and is clean. `db:clean-slate` and the tests have not been run.
