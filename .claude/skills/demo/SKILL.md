---
name: demo
description: Rules and moving parts of the Demo tenant, its landing page, the /aisworg/seu/demo page, scenarios, playbooks and steps, the data changes for them, the reset seed and the purge. Use whenever work touches src/dry-run-suite, src/dblayer/seed/demo, demoSimulator, the demo routes or views, demo seed JSON, or demo_scenarios and demo_steps.
---

# Demo

The Demo tenant is shown to prospective customers. It runs on real services with the Demo User as actor. Read `src/dry-run-suite/DECISIONS.md` before changing behaviour.

## Terms

| Term | Meaning | Table |
|---|---|---|
| Scenario | What the visitor chooses to try. One item under "What do you want to try". | `demo_scenarios` |
| Playbook | The ordered list of step codes inside one scenario. | the `playbook` column of `demo_scenarios` |
| Step | One runnable action, or one action the visitor does in the application. | `demo_steps` |

- Do not use "goal". It was an older word for scenario.
- Code names follow the terms: `demoScenariosDB`, `demoStepsDB`, `listScenarios`, `listAllSteps`, `runStep`, `advanceScenario`, `setStepEnabled`.

## Pages

| Page | Route | Source |
|---|---|---|
| Landing (after login) | `/aisworg/seu/dashboard/demo` | `views/seu/dashboardDemo.ejs`, `routes/seu/web/dashboard.ts`, `.lp-*` rules in `public/css/style.css` |
| Demo | `/aisworg/seu/demo` | `views/seu/demo/index.ejs`, `routes/seu/web/demo.ts`, `routes/seu/core/demoSimulator.ts` |
| Demo root | `/aisworg/seu/demo/root` | same view, root badge only, enables and disables steps |

- Both pages and every demo POST route need a `route_authority` row in `src/dblayer/seed/data/routeAuthority.json`. A new demo route needs its row in the same pass.
- Demo POST routes: `/demo/steps/:code/run`, `/demo/scenarios/:code/step`, `/demo/root/steps/:code/enabled`, `/demo/reset`, `/demo/contact`, and the guide routes under `/demo/guide`.
- All demo routes are reachable only from the Demo tenant (`requireTenantScope.forParam`). Root is always in reach.
- `src/dry-run-suite/demoLanding.md` is the user's content source. No code reads it.
- Wording the user has fixed: sentence case, no "why" or "how" in titles, "Commission an SEU", "Governance" capitalised, "Capability" capitalised, "Declare" and not "Define". The landing page sections are Proposition and Inside SEU Studio. Both start collapsed, and the call to action sits above them.

## Demo page structure

- Notice at the top: this is a demo, anyone can change the data, changes may not be saved, "contact us" opens a modal.
- Contact us posts to `/demo/contact` and mails `SUPERUSER_EMAIL` (comma separated allowed) through `emailService.sendDemoContact`. SMTP is already configured.
- Three tabs from `DEMO_AREAS` in `src/dblayer/constants.ts`: Declare, Commission, Execute. The tab is the `category` query parameter and is carried through every demo form as a hidden `category` field. Tab labels pair the stage name with the landing page card title (Engineering architecture, SEU commissioning, Execution).
- "How To" is a collapsible panel, collapsed by default. Its steps must not name the Registry as a link. Say "under Registry in the navbar". The How To text and the stage titles come from the `demo_areas` table and are edited on the root page (see Data changes).
- "What do you want to try" lists the scenarios of the tab. Only the next step of a scenario has a Run button. Completed steps show as done.
- The "Steps" table (all steps with Run and Enabled) shows on the root page only.
- The Reset demo data button shows on the root page only. The Demo tenant is reseeded every day at midnight US Pacific time by `scheduleDemoReset()` ([demoSchedule.ts](src/dblayer/seed/demo/demoSchedule.ts), started from `app.ts` when the server listens). The cron expression and timezone are `DEMO_RESET_CRON` and `DEMO_RESET_TIMEZONE` in `constants.ts`.

## Data model

| Table | Holds |
|---|---|
| `demo_steps` | one step: `code`, `kind`, `area`, `title`, `description`, `annotation`, `category`, `severity`, `priority`, `target`, `payload`, `enabled`, `sort_order` |
| `demo_areas` | one tab: `area`, `stage_title`, `how_to_lead`, `how_to_steps` |
| `demo_scenarios` | one scenario: `code`, `area`, `title`, `playbook` (step codes in order), `progress` (index of the next step), `enabled`, `sort_order` |

- Seed JSON: `src/dblayer/seed/data/demo/{steps,scenarios,areas,objectives,packs,profiles,participants,demoUser}.json`. `steps.json` holds the steps. `scenarios.json` holds the scenarios, each with a `playbook` array. Both tables are filled in one batch by `seedCatalogue` in `demoSeed.ts`. Category, severity and priority are checked against the Ontology.
- `area` is required on both tables and decides the tab. A scenario takes the latest stage it reaches.
- `annotation` is the teaching line shown under a step. Every step in a scenario needs one. Write it as one plain sentence that tells the user what the step shows about the platform.
- Progress is stored per scenario for the whole Demo tenant. Reset sets it back to 0.
- Schema lives in `src/dblayer/recovery/demo_*_schema_recovery.sql`. Those files drop and recreate the table. A column or table change is applied by running the file against the live database, because Reset never alters tables. Do not run it unless the user says so.
- The demo organisation is ArchVault. Profile and Pack codes are `archvault-*`.

## Data changes for scenarios and steps

Built in CR-123 (plan in `design/CR-123-demo-admin-crud-plan.md`, decisions in `design/CR-123-demo-admin-crud-decisions.md`). Core functions are in `routes/seu/core/demoCatalogue.ts`, the routes are on the Demo root page.

| Rule | Detail |
|---|---|
| Source | The database is the source for steps, scenarios and the per-tab How To text and stage titles (`demo_areas`, one row per tab). Content changes are data changes, not code changes. |
| JSON | `steps.json`, `scenarios.json` and `areas.json` are a one-time bootstrap, loaded only while the tables are empty. They are deleted once the demo stabilises. |
| Editing | Root edits scenarios, their playbooks, steps and the tab text on the Demo root page, per tab. A step form field named `stepCategory` is the step's Ontology category; `category` is the tab. The three tabs and the Reset demo data button stay. New routes: `POST /demo/root/areas/:area`, `/demo/root/scenarios`, `/demo/root/scenarios/:code`, `/demo/root/scenarios/:code/enabled`, `/demo/root/steps`, `/demo/root/steps/:code`, each with a root-badge `route_authority` row. |
| Delete | Delete is a disable. It sets `enabled` to false. No row is removed. |
| Reset | Reset no longer reloads steps and scenarios. It reseeds the Demo-tenant data and sets every scenario's `progress` to 0. `demo_scenarios`, `demo_steps` and `demo_areas` are not in `DEMO_PURGE_PLAN`; they are listed in `DEMO_CATALOGUE_TABLES` so the purge check skips them. |
| Validation on save | `kind` is a key of the simulator `handlers`, the visitor step kind or the note kind. `area` is in `DEMO_AREAS`. Category, severity and priority are canonical Ontology concepts. `target` and `payload` are valid JSON objects. A scenario's playbook lists existing step codes, none from a later tab than the scenario. A changed playbook sets the scenario's progress back to 0. |
| Limit | A new `kind` is code, so the editor offers only existing kinds. |

## Adding a step or scenario

1. Add the step with `kind`, `area`, `annotation` and `sortOrder`. Pick an existing `kind` handler in `demoSimulator.ts` or add one.
2. A handler uses the governed path only: real services, the Demo User as actor, the badge from `authorBadgeFor` or `resolveAuthorBadge`, `grantBadge` or `grantRouteBadges` for the badges the route declares. A creation badge name goes in the step payload, not in code.
3. Add the scenario with its ordered step codes in `playbook`. A step in no scenario is reachable from the root page only.
4. Steps of one scenario must work in order on a freshly reset tenant. Two scenarios that commission the same Objective collide, so give each scenario its own Objectives or one shared commission step.
5. Existing kinds: `commission-objective`, `complete-deliverable`, `raise-blocker`, `release-blocker`, `raise-risk`, `raise-finding`, `convert-finding`, `waive-blocker`, `accept-ontology-code`, `create-pack`, the visitor step kind `visitor-action`, and the note kind `note`.
6. A Pack whose code is new stays at Validated until the Ontology accepts the code. Pair a `create-pack` step with an `accept-ontology-code` step whose `conceptType` is `<category>-name`.
7. A standalone note between steps is a step of kind `note` (`DEMO_NOTE_STEP_KIND`). Its Title is the heading and its Description is the text. It has no action and no handler. Put its code in the playbook between the steps it separates. Notes take a playbook slot, and the page and guide panel leave them out of "n of m done" and the step numbers.
8. A step target such as `objectiveKey` is resolved from `objectives.json` by `objectiveFor`, so the key must exist there.

## Seed and purge

- `seedDemo()` order: purge, authoring badges, Packs, Templates, Profiles, participants, Objectives, step and scenario catalogue.
- The purge deletes Demo-tenant rows only, from `DEMO_PURGE_PLAN` in `src/dblayer/constants.ts`. It runs no foreign-key discovery. A new table with `tenant_id`, `seu_id` or `sponsoring_authority`, or a foreign key into one of those tables, is added to the plan in delete order. The purge stops with an error when a scoped table is missing.
- `events` carries `tenant_id`. `eventBus.publish` takes an optional `tenantId` and otherwise stores the tenant of `actorId`. The purge deletes the events whose `tenant_id` is the Demo tenant.
- The purge never deletes the tenant row, users or `participants_master`. The Demo User keeps its participant row and loses its badges.
- The Demo seed is independent of `db:clean-slate` and writes through the governed path, not `bulkInsert`. Run it with `pnpm tsx src/dblayer/seed/demo/demoSeed.ts`, only on a direct instruction. A run takes about 45 seconds. `seedDemo` runs inside `withLookupMemo` (`src/utils/db.ts`), which answers a repeated read-only SELECT from memory and drops the entries a write affects. The memo is active only inside that scope. Before it the run took about 2.5 minutes, spent on repeated lookups over the remote database.
- Do not add a `pnpm seed:` entry for the demo.

## Known open items

- Steps in no scenario: `commission-o11` to `o17`, `o20`, `o22`, `blocker-test-environment-unavailable`, `release-blocker-o12`, the three risk steps and `waive-dependency-finding`.
- `catalogue-first-sprint` and `review-finding-to-obligation` both begin by commissioning O10.
- No step yet adds a Pack to a Template or overrides an exposed parameter in a Profile.
- The Enable form on the root page returns to the default tab.
- A new demo route works only after its `route_authority` row is loaded with `pnpm tsx src/dblayer/seed/seedRouteAuthority.ts`. The Demo data is reset with `pnpm tsx src/dblayer/seed/demo/demoSeed.ts`. `db:clean-slate` does not seed the Demo tenant.
