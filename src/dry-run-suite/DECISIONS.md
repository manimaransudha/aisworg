# dry-run-suite rework — decisions

Detail lives in [WHITEBOARD.md](WHITEBOARD.md). This file is the short index of decisions.

## Settled

### Purpose and users
- The suite becomes a Demo-tenant data seeder, not a test or HTTP client. No assertions, no pass/fail.
- Demo is the only tenant. Atlas and Babylon are dropped.
- A visitor signs in with Google as a non-superuser, lands in the Demo tenant, and maps to the shared "Demo User" participant.
- passportConfig.js is fixed: non-superuser Google users get users.tenant_id = Demo tenant (done).

### Part 1: seeding
- Seeds Packs (P1 to P7), one Template inherited into the Demo tenant, Profiles (PR1 to PR4) and all 22 Objectives, all progressed to Active.
- No SEU is seeded. Commissioning belongs to part 2.
- Seed data is real and sensible. The mobile-application Template is not modified. Profiles differ by selected Packs.
- P7 (reader-privacy Compliance Pack) uses the existing compliance code compliance-us-state-privacy and is seeded Active. The Ontology acceptance flow is shown by the Declare scenarios that create a Pack with a new code (create-pack step, then accept-ontology-code step).
- Seeding uses the governed path (real services and transitions, Demo User as actor), with no bulk-insert bypass.
- Reset is a Demo-tenant-only purge helper, independent of db:clean-slate. It is an approved exception to the "only participants and badges" direct-write rule.
- The purge deletes only Demo-tenant rows. It never deletes the Demo tenant row, users or participants_master, and never touches platform-level rows.
- The purge runs a fixed plan, DEMO_PURGE_PLAN in src/dblayer/constants.ts. The plan lists the tables in delete order with the filter for each table. It was read from the live foreign keys once and is not rediscovered on each run.
- A new table with a tenant_id, seu_id or sponsoring_authority column, or a foreign key into one of those tables, has to be added to the plan. The purge stops with an error when a scoped table is missing from it.
- Events carry a tenant_id. eventBus.publish takes an optional tenantId and otherwise stores the tenant of the actor. The purge deletes the events of the Demo tenant.
- The demo seeding code lives in src/dblayer/seed, beside the clean-slate seeding. The root page reset button, the daily schedule and the dry-run-suite command all call it.
- The seed data is the base. Anything the demo user introduces is transient and removed on reset.

### Part 2: demo landing page, simulator and root screen
- Both screens live in the main application, with route_authority rows and CR-083 styling.
- Demo page: a notice that the data is shared and reset periodically, a contact link, and three tabs named after the stages on the landing page (Declare, Commission, Execute). Each tab has a collapsed How To panel and a list of scenarios (the "What do you want to try" section).
- Terms: a scenario is what the visitor chooses to try. Its playbook is the ordered list of its steps. A step is one runnable action. Steps are shown in order with an annotation that explains what the step shows. Only the next step can be run, and completed steps show as done. Progress is stored per scenario for the whole Demo tenant.
- Root screen: the same page, plus the Steps table with run and enable or disable for each step, and the Reset demo data button.
- The Reset demo data button is on the root screen only. The Demo tenant is reseeded every day at midnight US Pacific time by a schedule started with the server (DEMO_RESET_CRON and DEMO_RESET_TIMEZONE in constants.ts).
- A visitor can write to the superuser from the demo page. The message is sent by email to SUPERUSER_EMAIL.
- Simulator modes: a step run from a scenario, and a step run alone by root.
- The simulator acts as the shared Demo User. A badge helper adds the badges an event needs at run time and never revokes them. There is no fixed badge set to decide.
- Step catalogue (demo_steps): tenant-scoped DB table seeded from steps.json. Each step has an area (Declare, Commission or Execute), an annotation and an enabled flag. No versioning or lifecycle. Category, severity and priority reference Ontology codes.
- Scenario table (demo_scenarios): tenant-scoped, seeded from scenarios.json. Each scenario has an area, its playbook (the ordered step codes in the playbook column), an enabled flag and a progress index. A reset recreates the rows, so progress returns to zero.
- Built (CR-123): the database is the source for steps, scenarios and the per-tab How To text and stage titles (demo_areas). The JSON files are a one-time bootstrap, loaded only while the tables are empty. Delete is a disable. Root edits them on the Demo root page, per tab. A reset keeps them and sets every scenario's progress to zero. Plan in design/CR-123-demo-admin-crud-plan.md.
- The Declare scenarios create Packs with new codes, and then accept each code in the Ontology. The new Pack stays at Validated until the code is accepted.
- The demo organisation is ArchVault.
- SEU lifecycle covers commissioning only for now. An SEU is commissioned against one leaf Objective and uses one Profile.
- Releasing a blocker is the Attention Item chain. Re-dispatch follows as event consumption.

### Helpers
- Demo helpers are new files in dry-run-suite/lib, with no import from tests/.
- The only direct writes are authorisedBadges and authorisedRole on the existing Demo User participant, plus the Demo-tenant purge.
- Authority and tenant scope are enforced by the platform, never by the suite.

### Performance
- A reset takes about 40 seconds. It took about three minutes before the changes below.
- seedDemo runs inside withLookupMemo (src/utils/db.ts). A repeated read-only SELECT is answered from memory, and a write drops the cached reads of the table it changes. The memo is active only inside that scope.
- Inside the memo scope, the Pack-code option lists read only code, status and category of the Packs. Outside the scope the full rows are read.
- Templates are published with publishTemplate, as db:clean-slate publishes them. Profiles use publishProfile.
- db:clean-slate runs its Pack, Template, Profile and Objective seeding inside the same memo scope.
- The remaining time is round trips to the database. About 900 queries at about 37 ms each.

## Open
- Scenarios and steps: review the content of the scenarios, and add scenarios for the steps that no scenario contains.
- Template and Profile steps for the Declare scenarios (add a Pack to a Template, override an exposed parameter in a Profile) need new simulator handlers.
- Two scenarios that begin by commissioning the same Objective collide when both are run.
- README rewrite, after the design is agreed.
