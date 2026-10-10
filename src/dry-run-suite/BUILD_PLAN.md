# Demo build plan

Status: DRAFT for approval. Nothing is built. Inputs: [DECISIONS.md](DECISIONS.md), [WHITEBOARD.md](WHITEBOARD.md).

## 1. What happens to src/dry-run-suite

| Item | Fate | Reason |
|---|---|---|
| lib/harness.mjs, lib/platform.mjs, lib/edge.mjs | Remove | They are the old black-box HTTP client and the Atlas/Babylon edge simulators. Nothing in the new design calls them. |
| scenarios.mjs | Remove | Old pass/fail scenarios for Atlas and Babylon. The new scenarios are catalogue data. |
| run.mjs | Remove | The reset button on the landing page is the only way to run the seeding. |
| README.md | Rewrite | Becomes the content shown on the demo landing page. |
| DECISIONS.md, WHITEBOARD.md, BUILD_PLAN.md | Keep | Design record. |

Removed on the owner's instruction.

## 2. Components

### 2.1 Seeding and helpers (src/dblayer/seed/demo/)

| File | Role |
|---|---|
| demoBadges.ts | Badge helper modelled on tests/testFixtures.ts (grantBadge, grantRouteBadges, grantTransitionBadge). Adds to the Demo User participant's authorised_badges. Never revokes. No import from tests/. |
| demoPurge.ts | Deletes Demo-tenant rows only. Holds its own copy of the USAGE_DATA_TABLES list from cleanSlate.ts, in the same order, plus the tables it omits and the new demo tables. Never deletes tenants, users or participants_master. Skips tables without a tenant column. |
| demoSeed.ts | Orchestrator: purge, set Demo User role and badges, author and activate Packs P1 to P6, author P7 and leave it Published, author Profiles PR1 to PR4, create Objectives O1 to O22 and progress them to Active, load the scenario catalogue. Loads the Ontology once. Runs through the governed path with the Demo User as actor. |
| data/demo/*.json | Packs, Profiles, Objectives, scenarios and playbooks as data. Codes reference Ontology concepts and are validated on load. |

### 2.2 Database

| Item | Detail |
|---|---|
| demo_scenarios | tenant_id, code, kind, title, description, category, severity, priority, target, payload, enabled, sort_order. No lifecycle, no versioning. |
| demo_playbooks | tenant_id, code, title, steps (ordered scenario codes), enabled. |
| Schema files | Written in src/dblayer/recovery/, one file per table, named demo_scenarios_schema_recovery.sql and demo_playbooks_schema_recovery.sql. They follow the existing files: BEGIN; DROP TABLE IF EXISTS ... CASCADE; CREATE TABLE with id UUID PRIMARY KEY DEFAULT gen_random_uuid(); tenant_id UUID NOT NULL REFERENCES tenants(id) with a tenant index; author_id UUID NOT NULL REFERENCES participants_master(id) and author_badge TEXT NOT NULL; created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(); a UNIQUE (code, tenant_id) constraint; GRANT ALL PRIVILEGES ON TABLE ... TO weirdo; COMMIT;. Applied directly, not through migration replay. |
| DB layer | demoScenariosDB.ts, demoPlaybooksDB.ts in src/dblayer/. |

### 2.3 Core (src/routes/seu/core/demoSimulator.ts)

| Function | Calls (existing) |
|---|---|
| listAllowedScenarios, listPlaybooks | demo DB layer |
| runScenario, stepPlaybook | the entry points below |
| commissionObjective | commissionSeu |
| completeDeliverable, raiseBlocker | completeWorkItem (done, blocked, failed) |
| releaseBlocker | transitionAttentionItem (Acknowledged, In Progress, Resolved); re-dispatch follows as event consumption |
| waiveBlocker | transitionFinding (Open to Waived), grantWaiver, grantQualityGateWaiver |
| raiseRisk | Obligation core, category Risk |
| convertFinding | convertFindingToObligation |
| acceptOntologyCode, activatePack | Ontology Draft to Active, then Pack Published to Active |
| setScenarioEnabled | demo DB layer (root screen only) |
| resetDemo | demoSeed |

Every call carries the real Demo User actorId and badge. The badge helper runs first.

### 2.4 Web (src/routes/seu/web/demo.ts, registered in web/index.ts)

| Route | Screen | Required |
|---|---|---|
| GET /aisworg/demo | Landing: README content via renderMarkdown, reset button, allowed scenarios, simulate controls | row in route_authority |
| POST /aisworg/demo/reset | Runs resetDemo | row in route_authority |
| POST /aisworg/demo/scenarios/:code/run | Runs a scenario as the Demo User | row in route_authority |
| POST /aisworg/demo/playbooks/:code/step | Steps or plays a playbook | row in route_authority |
| GET /aisworg/demo/root | Root screen: everything on the landing page plus enable or disable | row in route_authority (root) |
| POST /aisworg/demo/root/scenarios/:code/enabled | Toggle | row in route_authority (root) |

Rows are added to src/dblayer/seed/data/routeAuthority.json in the same build pass. Pages follow CR-083 styling. The scenario list uses parseListParams, paginateList, listControls and sortLink.

### 2.5 Other changes

| Item | Detail |
|---|---|
| passportConfig.js | Done. Non-superuser Google users get the Demo tenant id. |
| CLAUDE.md | Done. Demo seeding recorded as an exception. |
| Ontology | One new compliance-name concept for P7, in a state that the simulator can accept. Verify that Draft concepts can be created through the governed path. |
| README.md | Rewritten as landing-page content, in the book register. |

## 3. Test fixtures

No existing table changes, so no existing fixture needs an update. The two new tables need no fixture. The purge copies a table list, so a test that confirms every tenant table is either in the purge list or deliberately skipped is proposed. New tests are run by the owner.

## 4. Build order

1. Recovery SQL and DB layer for demo_scenarios and demo_playbooks.
2. demoBadges.ts.
3. Data files for Packs, Profiles, Objectives.
4. demoSeed.ts without the purge. The owner runs it on a clean database.
5. demoPurge.ts, then the full reset.
6. Scenario and playbook data files, then demoSimulator.ts.
7. Web routes, views, route_authority rows.
8. README rewrite.

## 5. Risks to check at build time

| Risk | Check |
|---|---|
| USAGE_DATA_TABLES omits tenant tables (reviews, findings and others) | Enumerate tables with a tenant column from the live schema once and compare with the copied list. |
| The Demo User needs an authority the Pack and Profile transitions require | The badge helper grants it per transition from transition_definitions. |
| Ontology Draft concept path | Confirm the governed route exists before relying on it. |
| Redispatch consumed on release | Confirm the subscriber exists and fires for Demo-tenant events. |

## 6. Open questions

None.
