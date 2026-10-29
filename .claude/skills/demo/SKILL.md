---
name: demo
description: Rules and moving parts of the Demo tenant, its landing page, the /aisworg/seu/demo page, goals and steps, the reset seed and the purge. Use whenever work touches src/dry-run-suite, src/dblayer/seed/demo, demoSimulator, the demo routes or views, demo seed JSON, or demo_scenarios and demo_playbooks.
---

# Demo

The Demo tenant is shown to prospective customers. It runs on real services with the Demo User as actor. Read `src/dry-run-suite/DECISIONS.md` before changing behaviour.

## Pages

| Page | Route | Source |
|---|---|---|
| Landing (after login) | `/aisworg/seu/dashboard/demo` | `views/seu/dashboardDemo.ejs`, `routes/seu/web/dashboard.ts`, `.lp-*` rules in `public/css/style.css` |
| Demo | `/aisworg/seu/demo` | `views/seu/demo/index.ejs`, `routes/seu/web/demo.ts`, `routes/seu/core/demoSimulator.ts` |
| Demo root | `/aisworg/seu/demo/root` | same view, root badge only, enables and disables steps |

- Both pages and every demo POST route need a `route_authority` row in `src/dblayer/seed/data/routeAuthority.json`. A new demo route needs its row in the same pass.
- All demo routes are reachable only from the Demo tenant (`requireTenantScope.forParam`). Root is always in reach.
- `src/dry-run-suite/demoLanding.md` is the user's content source. No code reads it.
- Wording the user has fixed: sentence case, no "why" or "how" in titles, "Commission an SEU", "Governance" capitalised, "Capability" capitalised, "Declare" and not "Define". The landing page sections are Proposition and Inside SEU Studio. Both start collapsed, and the call to action sits above them.

## Demo page structure

- Notice at the top: this is a demo, anyone can change the data, changes may not be saved, "contact us" opens a modal.
- Contact us posts to `/demo/contact` and mails `SUPERUSER_EMAIL` (comma separated allowed) through `emailService.sendDemoContact`. SMTP is already configured.
- Three tabs from `DEMO_AREAS` in `src/dblayer/constants.ts`: Declare, Commission, Execute. The tab is the `category` query parameter and is carried through every demo form as a hidden `category` field. Tab labels pair the stage name with the landing page card title (Engineering architecture, SEU commissioning, Execution).
- "How To" is a collapsible panel, collapsed by default. Its steps are static text in the view and must not name the Registry as a link. Say "under Registry in the navbar".
- "What do you want to try" lists goals. Each goal is a `demo_playbooks` row and its steps are `demo_scenarios` rows. Only the next step of a goal has a Run button. Completed steps show as done.
- The "Steps" table (all scenarios with Run and Enabled) shows on the root page only.
- The Reset demo data button shows on the root page only. The Demo tenant is reseeded every day at midnight US Pacific time by `scheduleDemoReset()` ([demoSchedule.ts](src/dblayer/seed/demo/demoSchedule.ts), started from `app.ts` when the server listens). The cron expression and timezone are `DEMO_RESET_CRON` and `DEMO_RESET_TIMEZONE` in `constants.ts`.

## Data model

| Table | Holds |
|---|---|
| `demo_scenarios` | one step: `code`, `kind`, `area`, `title`, `description`, `annotation`, `target`, `payload`, `enabled`, `sort_order` |
| `demo_playbooks` | one goal: `code`, `area`, `title`, `steps` (scenario codes in order), `progress` (index of the next step) |

- Seed JSON: `src/dblayer/seed/data/demo/{scenarios,playbooks,objectives,packs,profiles,participants,demoUser}.json`. Both tables are filled in one batch by `seedCatalogue` in `demoSeed.ts`. Category, severity and priority are checked against the Ontology.
- `area` is required on both tables and decides the tab. A goal takes the latest stage it reaches.
- `annotation` is the teaching line shown under a step. Every step in a goal needs one. Write it as one plain sentence that tells the user what the step shows about the platform.
- Progress is stored per goal for the whole Demo tenant. Reset re-inserts the goals, so progress returns to 0.
- Schema lives in `src/dblayer/recovery/demo_*_schema_recovery.sql`. Those files drop and recreate the table. A column change is applied by running the file against the live database, because Reset never alters tables. Do not run it unless the user says so.
- The demo organisation is ArchVault. Profile and Pack codes are `archvault-*`.

## Adding a step or goal

1. Add the scenario to `scenarios.json` with `kind`, `area`, `annotation` and `sortOrder`. Pick an existing `kind` handler in `demoSimulator.ts` or add one.
2. A handler uses the governed path only: real services, the Demo User as actor, the badge from `authorBadgeFor` or `resolveAuthorBadge`, `grantBadge` or `grantRouteBadges` for the badges the route declares. A creation badge name goes in the scenario payload, not in code.
3. Add the goal to `playbooks.json` with its ordered step codes. A scenario in no goal is reachable from the root page only.
4. Steps of one goal must work in order on a freshly reset tenant. Two goals that commission the same Objective collide, so give each goal its own Objectives or one shared commission step.
5. Existing kinds: `commission-objective`, `complete-deliverable`, `raise-blocker`, `release-blocker`, `raise-risk`, `raise-finding`, `convert-finding`, `waive-blocker`, `accept-ontology-code`, `create-pack`.
6. A Pack whose code is new stays at Validated until the Ontology accepts the code. Pair a `create-pack` step with an `accept-ontology-code` step whose `conceptType` is `<category>-name`.

## Seed and purge

- `seedDemo()` order: purge, authoring badges, Packs, Templates, Profiles, participants, Objectives, scenario catalogue.
- The purge deletes Demo-tenant rows only, from `DEMO_PURGE_PLAN` in `src/dblayer/constants.ts`. It runs no foreign-key discovery. A new table with `tenant_id`, `seu_id` or `sponsoring_authority`, or a foreign key into one of those tables, is added to the plan in delete order. The purge stops with an error when a scoped table is missing.
- `events` carries `tenant_id`. `eventBus.publish` takes an optional `tenantId` and otherwise stores the tenant of `actorId`. The purge deletes the events whose `tenant_id` is the Demo tenant.
- The purge never deletes the tenant row, users or `participants_master`. The Demo User keeps its participant row and loses its badges.
- The Demo seed is independent of `db:clean-slate` and writes through the governed path, not `bulkInsert`. Run it with `pnpm tsx src/dblayer/seed/demo/demoSeed.ts`, only on a direct instruction. A run takes about 45 seconds. `seedDemo` runs inside `withLookupMemo` (`src/utils/db.ts`), which answers a repeated read-only SELECT from memory and drops the entries a write affects. The memo is active only inside that scope. Before it the run took about 2.5 minutes, spent on repeated lookups over the remote database.
- Do not add a `pnpm seed:` entry for the demo.

## Known open items

- Scenarios in no goal: `commission-o11` to `o17`, `o20`, `o22`, `blocker-test-environment-unavailable`, `release-blocker-o12`, the three risk scenarios and `waive-dependency-finding`.
- `catalogue-first-sprint` and `review-finding-to-obligation` both begin by commissioning O10.
- No step yet adds a Pack to a Template or overrides an exposed parameter in a Profile.
- The Enable form on the root page returns to the default tab.
