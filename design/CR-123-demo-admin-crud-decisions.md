# Demo administration CRUD: decisions so far

## Terms

| Term | Meaning | Table |
|---|---|---|
| Scenario | What the visitor chooses to try (one item under "What do you want to try") | `demo_scenarios` |
| Playbook | The ordered list of step codes in a scenario | `playbook` column of `demo_scenarios` |
| Step | One runnable action | `demo_steps` |

The word "goal" is not used. The code, routes, JSON files and recovery SQL were renamed to these terms.

## Settled

| # | Decision |
|---|---|
| 1 | The Demo root page keeps the three tabs (Declare, Commission, Execute) and the Reset demo data button. |
| 2 | Each tab gets create, read and update for the scenarios (with their playbooks) and the steps of that tab. |
| 3 | Delete is a disable. It sets `enabled` to false. No row is removed. Both tables already have `enabled`. |
| 4 | The database becomes the source for scenarios, steps, and the per-tab How To text and stage titles. Reset no longer reloads them from JSON. |
| 5 | `steps.json` and `scenarios.json` stay as a one-time bootstrap, loaded only while the tables are empty. They are deleted once the demo stabilises. |
| 6 | How To text and stage titles are editable and stored in a new `demo_areas` table, bootstrapped from a new `areas.json`. |
| 7 | Everything is renamed for consistency, including tables, DB files, core functions, routes, `route_authority`, redirects and JSON files. |

## Consequences to build

| Area | Change |
|---|---|
| Purge | Remove `demo_scenarios` and `demo_steps` from `DEMO_PURGE_PLAN`. Reset sets each scenario's `progress` to 0. |
| Seed | `seedCatalogue` loads the JSON only when the tables are empty. Ontology checks on category, severity and priority move to the save path. |
| Validation | A scenario's playbook lists existing step codes, none from a later tab than the scenario. Kind, Ontology values and JSON fields are validated on save. |
| Routes | New root-only POST routes, each with a `route_authority` row in the same pass. |
| Schema | New `demo_areas` recovery SQL. The user applies all recovery SQL files. |

## Rename status

Done in code: tables, recovery SQL files, DB files, `demoSimulator.ts`, `demo.ts`, view, view model, redirects, `routeAuthority.json`, `constants.ts`, `demoSeed.ts`, seed JSON file names, `DECISIONS.md`, `Known Issues.md`, the demo skill.
Not done: `src/dry-run-suite/BUILD_PLAN.md` and the CR files, which are historical records.
The live database needs both recovery SQL files applied by the user before the renamed code runs.

## Next step

The CRUD is built per [the build plan](CR-123-demo-admin-crud-plan.md). The user applies the three demo recovery SQL files, runs `db:clean-slate` (for the new `route_authority` rows) and then a Demo reset, which bootstraps the tables from the JSON files.
