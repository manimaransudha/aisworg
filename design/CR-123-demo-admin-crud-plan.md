# Demo administration CRUD: build plan (built)

Companion to [CR-123-demo-admin-crud-decisions.md](CR-123-demo-admin-crud-decisions.md). Terms: scenario, playbook, step.

## 1. Data

| Item | Change |
|---|---|
| `demo_scenarios` | No column change. |
| `demo_steps` | No column change. |
| `demo_areas` (new) | One row per tab and tenant: `area` (one of `DEMO_AREAS`), `stage_title`, `how_to_lead`, `how_to_steps` JSONB (array of `{ text }`, HTML allowed for links as today), `author_id`, `author_badge`, timestamps. `UNIQUE (area, tenant_id)`. |
| Recovery SQL | New `src/dblayer/recovery/demo_areas_schema_recovery.sql`. The user applies it. |
| DB layer | New `src/dblayer/demoAreasDB.ts`. `demoStepsDB` and `demoScenariosDB` gain `update` (by code, all editable fields). |
| Constants | `DEMO_AREAS` stays in `constants.ts` and fixes the tab set. No other constant is added. |

## 2. Reset and bootstrap

| Item | Change |
|---|---|
| Purge | `demo_scenarios`, `demo_steps` and `demo_areas` are not in `DEMO_PURGE_PLAN`. They are listed in `DEMO_CATALOGUE_TABLES` (constants.ts) so the purge check leaves them alone. |
| Reset | `resetDemo` sets every scenario's `progress` to 0 after the tenant data is reseeded. |
| Bootstrap | `seedCatalogue` loads `steps.json`, `scenarios.json` and a new `areas.json` (today's How To text and stage titles) only when the table is empty. Batch insert with the Ontology loaded once, as today. |
| Step targets | `objectiveFor` reads `objectives.json` by key. Unchanged. The CRUD validates the key against that file. |

## 3. Validation on save (create and update)

| Rule | Source |
|---|---|
| Step `kind` is a key of the simulator `handlers` or the visitor step kind | `demoSimulator.ts` |
| `area` is in `DEMO_AREAS` | constants |
| `category`, `severity`, `priority` are canonical Ontology concepts | Ontology, loaded once per request |
| `target` and `payload` are valid JSON objects | form |
| A scenario's playbook lists existing step codes, and no step belongs to a later tab than the scenario (a scenario takes the latest stage it reaches) | `demo_steps` |
| A new code does not exist yet | `UNIQUE (code, tenant_id)` |

## 4. Routes (root only, each with a `route_authority` row in `routeAuthority.json`)

| Method and path | Purpose |
|---|---|
| `GET /demo/root` | Existing page, extended per tab with scenario and step lists and forms |
| `POST /demo/root/areas/:area` | Update stage title, How To lead and How To steps |
| `POST /demo/root/scenarios` | Create a scenario |
| `POST /demo/root/scenarios/:code` | Update a scenario (title, playbook, sort order) |
| `POST /demo/root/scenarios/:code/enabled` | Disable or enable a scenario (the delete) |
| `POST /demo/root/steps` | Create a step |
| `POST /demo/root/steps/:code` | Update a step |
| `POST /demo/root/steps/:code/enabled` | Existing, kept |

Each route redirects back to the same tab with the `category` field, through a `redirects.ts` entry. The core functions live in a new `demoCatalogue.ts` beside `demoSimulator.ts`, and the routes call them.

## 5. View (`views/seu/demo/index.ejs`, full CR-083)

| Item | Change |
|---|---|
| How To and tab labels | Read from `demo_areas` instead of `_guides` and `_stageTitles`. |
| Scenarios (root) | Each scenario card gets an Edit action and an Enable or Disable button. A "New scenario" form sits above them. |
| Steps (root) | The Steps table keeps `parseListParams`, `paginateList`, `listControls` and `sortLink`. Each row gets Edit. A "New step" form sits above the table. |
| Forms | Collapsible section cards. The `target` and `payload` fields are JSON text areas validated on save. |
| Visitor page | Unchanged apart from the data source. Disabled scenarios are hidden there. |

## 6. Tests and fixtures

No test references the demo tables today. I will confirm this again before building.

## 7. Out of scope

| Item | Reason |
|---|---|
| New step `kind` handlers | A new kind is code. The CRUD offers only existing kinds. |
| Deleting the bootstrap JSON | Deferred by decision 5. |
| Running the recovery SQL, the seed, tsc and the tests | Only on your direct instruction. |
