# CR-123 — Demo landing page organised into the three manual parts (demo wrapper only)

**Raised:** 2026-10-16 · **Origin:** the Demo page is the first thing prospective investors see. It must explain what the platform does and how to navigate the demo, following the three parts of the user manual (`src/docs/user-manual`).

**Status:** 🟡 Built pending verification

## Intent

| Item | Decision |
|---|---|
| Scope | The demo wrapper only: `src/dry-run-suite/demoLanding.md`. |
| Platform behaviour | No change. The Demo is a tenant. Registry, Ontology, Attention and every other page show what the current functionality shows for that tenant. |
| Access | Governed by `route_authority`. No role, badge or route change is made for the demo. |
| Demo helpers | The helpers (Scenarios, Playbooks, Reset) only simulate the flow. |
| Seed data, Scenarios, Playbooks | Unchanged. |
| Documentation | None created beyond this CR. |

## The three parts

| Part | Manual | Demo content |
|---|---|---|
| 1. Authoring | 01 SDK Authoring | Tour of Packs, Profiles, Templates, Capability Definitions and Objectives. Scenario: accept-reader-privacy-code. |
| 2. Commissioning | 02 SEU Commissioning | The twelve commission-objective Scenarios (O10 to O22). |
| 3. Execution | 03 Execution Engine | complete-deliverable, raise-blocker, release-blocker, raise-risk, raise-finding, convert-finding and waive-blocker Scenarios. |

## Playbook classification

| Playbook | Part 1 | Part 2 | Part 3 |
|---|---|---|---|
| reader-privacy-compliance | accept-reader-privacy-code | | |
| catalogue-first-sprint | | commission-o10 | three Deliverables, blocker raised and released |
| review-finding-to-obligation | | commission-o10 | Finding raised and converted |
| release-readiness | | commission-o19, commission-o21 | two blockers raised and released |

## Page content

Opening pitch and six value points, the Riverbend story, the three parts with numbered navigation steps and a take-away line each, the Playbook table by part, and Reset.

## Access outcome

The landing page names the pages of each part. Whether the Demo User can open a page is decided by `route_authority`, and the demo follows that outcome. No verification item remains open.

## Files

| File | Change |
|---|---|
| `src/dry-run-suite/demoLanding.md` | Rewritten. |

## Analysis of the current demo (2026-10-29)

Basis for the Playbook and Scenario refinement. Sources read in full: this CR, the demo skill, DECISIONS.md, BUILD_PLAN.md, demoSimulator.ts, web/demo.ts, views/seu/demo/index.ejs, demoSeed.ts, and the seed JSON (scenarios, playbooks, profiles, packs). Nothing was run. Runtime behaviour is stated only where the code makes it certain.

### Stage naming

| Where | Names |
|---|---|
| Demo page, DEMO_AREAS, seed `area` | Declare, Commission, Execute |
| Landing card titles | Engineering architecture, SEU commissioning, Execution |
| This CR and the manual | 1. Authoring, 2. Commissioning, 3. Execution |

The mapping Declare = Authoring, Commission = Commissioning, Execute = Execution is implied and recorded nowhere.

### Current Playbooks (6) and Scenarios (36)

| Playbook | `area` | Steps |
|---|---|---|
| catalogue-first-sprint | Execute | commission-o10, complete x2, blocker-design-approval-pending, release-blocker-o10, complete |
| review-finding-to-obligation | Execute | commission-o10, finding, convert |
| release-readiness | Execute | commission-o19, blocker, release, commission-o21, blocker, release |
| declare-technology-archvault-api-standards | Declare | create-pack, accept-code |
| declare-compliance-archvault-accessibility | Declare | create-pack, accept-code |
| declare-organisation-archvault-release-governance | Declare | create-pack, accept-code |

| Scenario kind | Count | In a Playbook |
|---|---|---|
| commission-objective | 12 (O10 to O17, O19 to O22) | O10, O19, O21 |
| complete-deliverable | 3 | 3 |
| raise-blocker | 4 | 3 (not test-environment-unavailable) |
| release-blocker | 4 | 3 (not O12) |
| raise-risk | 3 | 0 |
| raise-finding | 1 | 1 |
| convert-finding | 1 | 1 |
| waive-blocker | 1 | 0 |
| create-pack / accept-ontology-code | 3 / 3 | 3 / 3 |

### Findings against the code

| # | Finding | Evidence |
|---|---|---|
| F1 | The Commission tab has no Playbook. Every Playbook that commissions an SEU also executes work, so its `area` is Execute. The tab shows "Nothing to try for this area yet." The twelve commission Scenarios are reachable only from the root Steps table. | `playbooks.json` areas; `demo.ts` filters Playbooks by `area`; `index.ejs` empty-state text |
| F2 | The Part 1 Playbook named in this CR ("Reader privacy compliance", `accept-reader-privacy-code`) does not exist. The seed has three Declare Playbooks. Each creates a new Pack and then accepts its code. | `playbooks.json`, `scenarios.json` |
| F3 | The "Playbook classification" table in this CR lists four Playbooks. The seed has six. | this CR vs `playbooks.json` |
| F4 | `catalogue-first-sprint` and `review-finding-to-obligation` both begin with `commission-o10`. The second one run on a tenant cannot commission O10 again. | `playbooks.json`; commission handler requires an Objective with no SEU |
| F5 | Fifteen Scenarios are in no Playbook: commission-o11 to o17, o20, o22, blocker-test-environment-unavailable, release-blocker-o12, the three Risks and waive-dependency-finding. Risk and waive Scenarios also need an SEU commissioned first (O10, O12, O16). | `playbooks.json` vs `scenarios.json` |
| F6 | `waive-dependency-finding` and `convert-dependency-finding` act on the same Finding. They are alternatives, so one Playbook cannot hold both. | `scenarios.json` targets |
| F7 | `complete-deliverable` reports the Work Item done. It does not approve or baseline the Deliverable. The CR text says "three Deliverables approved in sequence". | `demoSimulator.ts` complete-deliverable handler |
| F8 | `raise-blocker` and `release-blocker` act on the first outstanding Work Item or the oldest open Attention Item of the SEU. The Scenario does not name which one. The result depends on the dispatch state. | `outstandingWorkItem`, release-blocker handler |
| F9 | No handler adds a Pack to a Template or overrides an exposed parameter in a Profile. The Declare goals cover Packs only. | `handlers` in `demoSimulator.ts` |
| F10 | The `accept-ontology-code` error text says "the reader privacy Pack is not seeded". It applies to any Declare Pack. | `demoSimulator.ts` |
| F11 | All steps of the six Playbooks carry an annotation. The 15 Scenarios in no Playbook carry none, so each needs one when it joins a goal. | `scenarios.json` annotation values |
| F12 | Playbook progress is stored once per Demo tenant. Concurrent visitors share and advance the same progress. | `demoPlaybooksDB.setProgress`, DECISIONS |

### Findings against the documents

| # | Document | Finding |
|---|---|---|
| D9 | BUILD_PLAN.md | Table columns, route paths, the README rewrite and `lib/` removal describe the first plan. `demo_playbooks` is shown with `enabled` and no `area` or `progress`; `demo_scenarios` is shown with no `area` or `annotation`. |
| D10 | demo skill | "Profile and Pack codes are `archvault-*`" holds for Profiles and for the Declare-goal Packs only. Seeded Packs use other codes. The `demo_playbooks` row also has an `enabled` column that the data model table omits. |
| D11 | DECISIONS.md | Consistent with the code. Its Open list (review goals, add goals for unreferenced Scenarios, Template and Profile steps, O10 collision) matches F1 to F9. The stage naming in F-Stage is the one gap. |

### Decisions needed before editing the Playbooks

| # | Decision |
|---|---|
| 1 | Record the stage mapping Declare = Authoring, Commission = Commissioning, Execute = Execution, or rename one side. |
| 2 | Give the Commission tab at least one Playbook of commissioning steps only, and confine Execute Playbooks to a single shared commission step per Objective (resolves F1 and F4). |
| 3 | Decide where the fifteen unreferenced Scenarios go (F5), including a Risk Playbook and the waive alternative (F6). |
| 4 | Decide whether to add Template and Profile handlers for the Declare goals (F9). |
| 5 | Settle the wording of Deliverable steps against what the handler does (F7). |
| 6 | Bring DECISIONS.md, BUILD_PLAN.md and the demo skill in line (D9, D10). |

## Working scope and the three areas (2026-10-29)

### Scope of the current work

| Item | Decision |
|---|---|
| In scope | Tuning the Playbooks and Scenarios: `playbooks.json`, `scenarios.json`, and a handler in `demoSimulator.ts` only where a new kind of step needs one. |
| Out of scope | `demoLanding.md`, WHITEBOARD.md, BUILD_PLAN.md, DECISIONS.md, the demo skill, and the Part naming. These are done or set aside by the owner. |
| Findings that apply | F1 to F12 and decisions 1 to 5 of the analysis above. |

### The areas

| Area | Meaning | Current Scenario kinds |
|---|---|---|
| Declare | Defining what the platform may build and under which rules: Packs, Templates, Profiles, and Ontology acceptance of new codes. | `create-pack`, `accept-ontology-code` |
| Commission | Turning an Objective into a governed SEU: initiate, validate, compose the EBM, activate it. | `commission-objective` |
| Execute | Work inside a commissioned SEU: completing Deliverables, raising and releasing blockers, Risks and Findings. | `complete-deliverable`, `raise-blocker`, `release-blocker`, `raise-risk`, `raise-finding`, `convert-finding`, `waive-blocker` |

Each Scenario and each Playbook carries one `area`, which decides its tab. The demo skill states that a goal takes the latest stage it reaches. Whether that rule stays is an open question for the owner.

### Working rule for the conversation

The conversation is compacted often. Replies stay under 200 words, and anything longer goes into this CR.

### Intent of the Playbooks (owner, 2026-10-29)

| Item | Statement |
|---|---|
| Purpose | The demo user understands the platform. |
| Structure | The platform is shown in three areas: Declare, Commission, Execute. |
| Content | Each area offers things the user can try. Each of these guides the user through its steps. |
| Open | The rule "a goal takes the latest stage it reaches" is possibly legacy. It is not a requirement. |

### Guided tries, not automatic runs (owner, 2026-10-29)

| Item | Statement |
|---|---|
| Current behaviour | The Run button on a step executes the step through the simulator. The user does nothing. |
| Required behaviour | Each "What do you want to try" item shows its steps as instructions for the user. Run does not execute anything. The user performs the steps in the real application. |
| Example | "Create the Release Governance Pack" shows: go to Packs, choose New Pack, and the following actions, each in the user's own words and navigation. |
| Consequence | The simulator handlers are no longer the means by which a try is done by the demo user. Their role (root only, or setup of state for a try) is to be decided. |

### Role of Run (owner, 2026-10-29)

| Item | Statement |
|---|---|
| Run | Sets up the underlying information a try depends on, such as an Ontology code or a commissioned SEU, so the demo is seamless. |
| User steps | The visitor performs the try itself, following the steps shown. |
| Handlers | The simulator handlers remain, used for this setup. |

### Numbering (owner, 2026-10-29)

The tries ("What do you want to try" items, stored as Playbooks) are numbered and ordered within each tab. The steps within a try are already ordered. In the owner's wording a "scenario" is a try.

## Draft: numbered tries per area (2026-10-29)

Status: DRAFT for the owner's review. "Run" is the setup the simulator performs. "You" is the visitor's own action in the application. Page names and clicks are written from the existing How To text and must be checked against the real pages before the steps are fixed.

### Design points behind the draft

| # | Point |
|---|---|
| 1 | Each try owns its own Objective, so no two tries collide on an SEU (removes F4). |
| 2 | Execute tries start with a Run step that commissions the SEU they need. This puts the unreferenced commission Scenarios (O11, O13 to O17, O20, O22) to use. |
| 3 | The Commission tab tries use O10, O12 and O19. The visitor commissions these by hand. No Execute try uses them. |
| 4 | The commission handler fails when the Objective already has an SEU. A setup step needs a "commission if absent" behaviour, which is a handler change. |
| 5 | Finding and Risk Scenarios are bound to one Objective. Each try needs its own copy bound to its own Objective. |
| 6 | Where the application offers no page for the action (for example completing a Work Item), Run performs the action and the steps tell the visitor where to see the result. To be confirmed per try. |

### Declare

| # | Try | Run (setup) | You |
|---|---|---|---|
| D1 | Declare the ArchVault API Standards Pack (Technology) | Accepts the new Technology code in the Ontology and activates the Pack, after you create it. | Registry, Packs, New Pack. Enter the code and contents given on screen. Save and submit through Draft, Validated and Published. |
| D2 | Declare the ArchVault Accessibility Pack (Compliance) | Same setup for a Compliance code. | Same path with a Compliance Pack. |
| D3 | Declare the ArchVault Release Governance Pack (Organisation) | Same setup for an Organisation code. | Same path with an Organisation Pack. |
| D4 | Add a Pack to a Template | None | Open a Template, add an Active Pack. To be confirmed as possible in the application. |
| D5 | Override an exposed parameter in a Profile | None | Open a Profile, change a parameter. To be confirmed as possible in the application. |

### Commission

| # | Try | Run (setup) | You |
|---|---|---|---|
| C1 | Commission an SEU for the catalogue metadata model (O10, Profile archvault-catalogue-build) | None | Objectives, open O10, compose the Engineering Behavior Model, commission the SEU. Open it from SEUs. |
| C2 | Commission an SEU for the checkout service (O12, Profile archvault-lending-build) | None | Same path. Compare the Packs applied with C1. |
| C3 | Commission an SEU for integration testing (O19, Profile archvault-release) | None | Same path. Compare the Packs applied with C1 and C2. |

### Execute

| # | Try | Run (setup) | You |
|---|---|---|---|
| E1 | Move a Deliverable forward (O11) | Commissions O11. | SEUs, open the SEU, open its Work Items, report the requirements-specification work done. Watch the next Deliverable become ready. |
| E2 | Raise and release a blocker (O14) | Commissions O14. | Report a Work Item blocked. Attention, acknowledge, progress and resolve the item. |
| E3 | Turn a Finding into an Obligation (O16) | Commissions O16. | Raise a Review Finding on source-code, then convert it to an Obligation. |
| E4 | Waive a Finding (O17) | Commissions O17. | Raise a Review Finding on source-code, then waive it. |
| E5 | Record a Risk (O20) | Commissions O20. | Raise an Obligation of category Risk with a severity and priority. |
| E6 | Release readiness across two SEUs (O21, O22) | Commissions O21 and O22. | Block one Work Item in each SEU and release both from Attention. |

### Data changes implied

| Area | Change |
|---|---|
| `playbooks.json` | Replace the six Playbooks with D1 to D5, C1 to C3, E1 to E6. Add an order number to each, per area. Declare D4 and D5 only if confirmed possible. |
| `scenarios.json` | Keep the commission Scenarios used as setup. Remove the ones the visitor now does by hand (create-pack steps, C1 to C3 commissions). Add Finding, Risk and blocker copies bound to O14, O16, O17, O20, O21, O22. |
| `demoSimulator.ts` | Commission step becomes "commission if absent". Playbook rows gain an order field. |
| Page | The Run button appears on setup steps only. Visitor steps show as instructions with no button. A Playbook needs a way to mark a step as setup or as visitor action. |

## Worked try: D3 Declare the ArchVault Release Governance Pack (2026-10-29)

Read from `navbar.ejs`, `sdkAuthoring.ts`, `views/seu/sdk/authoring/index.ejs` and `edit.ejs`, `views/seu/sdk/ontology/approvals.ejs` and the current `create-release-governance-pack` Scenario. Not run in a browser.

### Real path in the application

| # | Page | Control |
|---|---|---|
| 1 | Navbar, SDK / Authoring, Pack Authoring (`/aisworg/seu/sdk/pack-authoring`) | New Pack |
| 2 | Pack Definition form (tabbed) | Create draft |
| 3 | Same page, after the draft exists | JSON import card: paste a document, Import (replaces the whole document) |
| 4 | Same page | Advance button named by the next verb plus "Pack" (Validate Pack, then Publish Pack, then Activate Pack) |
| 5 | A Pack with a new code stops at Validated until the Ontology accepts the code | Navbar, Ontology, Approvals, Accept (confirm dialog) |
| 6 | Pack Authoring, open the Pack | Publish Pack, then Activate Pack |
| 7 | Navbar, Registry, Packs | The new Pack is listed as Active |

### Proposed try

| Step | Who | Text shown |
|---|---|---|
| 1 | You | Open SDK / Authoring, Pack Authoring. Choose New Pack. |
| 2 | You | Enter the code `organisation-archvault-release-governance`, category Organisation, and the other required fields shown below. Choose Create draft. |
| 3 | You | In the JSON import card, paste the contributions document shown below and choose Import. The Pack now carries the Release Readiness checklist and the Release approval Obligation. |
| 4 | You | Choose Validate Pack. The Pack stops at Validated because its code is new. |
| 5 | Run | Accepts the code in the Ontology (existing `accept-ontology-code` handler). Optional for the visitor: Ontology, Approvals, Accept. |
| 6 | You | Choose Publish Pack, then Activate Pack. |
| 7 | You | Open Registry, Packs. The Pack is Active and can now be selected by a Profile. |

### Gaps this exposes

| # | Gap | Effect |
|---|---|---|
| G1 | A step needs a copyable text block (field values, the JSON document). Scenarios hold only a title, description and annotation. | Add a field for step text and for a copyable block, or hold the block in the payload and render it. |
| G2 | Steps need a type: Run (simulator) or You (visitor). A step may be both, as step 5. | Add a step type to the Scenario. |
| G3 | The required fields on the New Pack form are not confirmed. | Confirm by opening the form before the step text is fixed. |
| G4 | The Demo User must hold `pack_define` and the Pack hop badges to do steps 1 to 6. The seed grants them at reset. Whether the Ontology Accept needs a badge the visitor lacks is unconfirmed. | Confirm against `route_authority` for the approvals route. |
| G5 | Step 5 as Run needs the visitor's Pack to exist with the exact code. The handler finds the Pack by code. | Show the code in step 2 and have step 5 fail with a clear message when the Pack is absent. |
| G6 | `create-pack` handler is no longer needed for D1 to D3. `accept-ontology-code` stays. | Remove the three `create-pack` Scenarios. The Pack content moves into the copyable block. |

### Built for D3 (2026-10-29)

Not run, not type-checked, not seeded. The owner runs the reset to load the new rows.

| Item | Change |
|---|---|
| Step type | No schema change. A step of kind `visitor-action` (`DEMO_VISITOR_STEP_KIND` in `constants.ts`) is done by the visitor. Its instruction is the Scenario `description`. Copyable blocks are `payload.copy` (`label`, `text`). |
| Steps | 1 Open Pack Authoring, 2 Create the draft, 3 Add the release checklist and Obligation (JSON import block, schema-shaped), 4 Validate the Pack, 5 Run: accept the code and activate the Pack, 6 Find the Pack in the Registry. The Publish and Activate clicks were dropped from the visitor steps because the existing handler advances the Pack to Active. |
| `scenarios.json`, `playbooks.json` | `create-release-governance-pack` removed. Five `visitor-action` rows added. The accept row reworded. The Playbook lists the six steps. |
| `demoSimulator.ts` | `stepPlaybook` advances a visitor step without running anything. `runScenario` refuses a visitor step. `accept-ontology-code` now looks up the Pack before accepting the code and reports the missing Pack by code. |
| `web/demo.ts`, `index.ejs` | Steps carry instruction and copy blocks. A visitor step shows a Done button and a Copy button on each block. Other steps keep Run. |
| Not verified | The New Pack form accepts the five entries in step 2. The import document passes the Pack schema. The Demo User may open the Approvals page. Done is not checked against what the visitor actually did. |

### Built: numbered tries and the Declare focus (2026-10-29)

| Item | Change |
|---|---|
| Column | `demo_playbooks.sort_order INTEGER NOT NULL` added to `demo_playbooks_schema_recovery.sql`. The owner applies the file to the live database before the next reset. |
| Order | `demoPlaybooksDB` writes and reads `sort_order`. `findByTenant` orders by `sort_order`, then `code`. `playbooks.json` carries `sortOrder`, numbered from 1 within each area. |
| Page | Each try shows its position among the tries on the tab, as "1. Title". |
| Declare focus | The API Standards and Accessibility tries carry `enabled: false` in `playbooks.json`, so only Release Governance shows on the Declare tab until the others are converted. |

### Built: guide panel (2026-10-29)

Not run, not type-checked. The visitor follows a try in a panel that stays on every page, so the steps remain visible while the visitor navigates.

| Item | Change |
|---|---|
| Panel | `views/partials/demoGuide.ejs`, included from `footer.ejs` when `GET /aisworg/seu/demo/guide` is visible to the user. Fixed bottom-right, collapsible, closable. Shows the try number and title, "n of m done", the current step, its copy blocks, and a Done or Run button. The button acts in place, with no page load. |
| Demo page | Each try has Start guide or Resume guide. The per-step Run and Done forms are removed from the page. The steps list remains as a read-only outline. |
| Routes | `GET /demo/guide`, `POST /demo/guide/start/:code`, `POST /demo/guide/step`, `POST /demo/guide/close` in `web/demo.ts`. Each returns JSON. Four rows added to `routeAuthority.json` (role `demo`). |
| State | The try being followed is `req.session.demoGuide` (typed in `types/express-session.d.ts`). Progress stays in `demo_playbooks.progress`. |
| Core | `getGuide(code)` in `demoSimulator.ts`. |
| `app.ts` | `GET /aisworg/seu/demo/guide` added to the navbar visibility list. |
| Left in place | `POST /demo/playbooks/:code/step` is no longer called from the page. |

### Verified by the owner (2026-10-29)

| Item | Result |
|---|---|
| Guide panel | Works after the `route_authority` rows were loaded with `pnpm tsx src/dblayer/seed/seedRouteAuthority.ts`. |
| Deployment order for new demo routes | Add the rows to `routeAuthority.json`, load them into the table, then use the page. Until the rows are loaded, the access check denies the routes and the panel does not appear. |
| Still open | The D3 steps have not been walked end to end against the real pages: the New Pack form entries, the JSON import, the Ontology Approvals access for the Demo User. Tries D1, D2 and E1 to E6 are not yet converted to guided tries. |

## Demo User authority for guided tries (2026-10-29)

Read: `tests/testFixtures.ts`, `src/dblayer/seed/demo/demoBadges.ts`, `demoSeed.ts`, `demoUser.json`, and the `route_authority` rows for the Pack authoring routes.

### Helpers

| Helper | Test fixtures | Demo (`demoBadges.ts`) |
|---|---|---|
| `grantBadge`, `grantRouteBadges`, `grantTransitionBadge` | Present | Identical copies. Adds to `participants_master.authorised_badges`, never revokes. |
| `grantAllTransitionBadges` | Absent | Present. Run before every simulator scenario. |
| `ensureDemoUserRoles` | Absent | Present. Sets `authorised_role` from `demoUser.json` when empty. |

### What the Demo User holds after a reset

| Kind | Source | Value |
|---|---|---|
| Badges | `grantAuthoringBadges` in `demoSeed.ts` | `pack_define`, `profile_define`, `template_define`, the Pack, Template and Profile hop badges, the Objective activation badge, `objective_<birth verb>`. |
| Badges at run time | `runScenario` | All governed transition badges, plus route badges for commissioning. Granted only when the simulator runs. |
| Roles | `demoUser.json` | `general`, `demo`. |

### Gap

A guided visitor step is done by the visitor in the application. The simulator does not run for it, so nothing is granted at run time. Whatever the visitor needs must exist after the reset.

| Route (step) | Requires | Demo User |
|---|---|---|
| `GET /aisworg/seu/sdk/:slug` (open Pack Authoring) | role `sdk_author` or `demo` | Allowed |
| `GET /sdk/:slug/new` (New Pack) | role `sdk_author` | Not held |
| `POST /sdk/:slug` (Create draft) | role `sdk_author` | Not held |
| `GET /sdk/:slug/:draftId`, `/save`, `/import`, `/transition`, `/publish` | role `sdk_author` | Not held |
| `GET /aisworg/seu/packs` (Registry, Packs) | role `participant` or `demo` | Allowed |

D3 steps 2 to 4 therefore fail for the Demo User. The badges (`pack_define`, Pack hops) are held. The role `sdk_author` is not.

### Options

| # | Option |
|---|---|
| 1 | Add `sdk_author` to `authorisedRoles` in `demoUser.json`. One data change. Every demo visitor can then author in every SDK kind, not only Packs. |
| 2 | Add `demo` to the roles of the SDK authoring `route_authority` rows. Same reach as option 1, held on the route side. |
| 3 | Add `demo` only to the rows the guided tries use (Pack kind routes cannot be separated, because the slug is a path parameter). |

Decision (owner): grant through a helper, as for badges. Revised 2026-11-01: a guide grants badges only, never roles.

### Built: route-driven grant (2026-10-29)

Not run, not type-checked.

| Item | Change |
|---|---|
| Helpers | `grantRouteAuthority` in `demoBadges.ts` reads the badges `route_authority` declares for a method and path and adds them to `participants_master.authorised_badges`. It returns the badges it added. `revokeAuthority` removes them. The role helpers `grantRole` and `grantRouteRoles` were built first and are removed (2026-11-01). |
| Step data | A visitor step lists the routes it sends the visitor to in `payload.routes` (`method`, `path`). The five Release Governance steps carry theirs. |
| Trigger | `POST /demo/guide/start/:code` calls `grantGuideAuthority`, which grants the badges for every visitor step of the goal. `POST /demo/guide/close` revokes them. No role or badge is named in code. See "Built: guide grants badges only and revokes on close". |

### Built: note steps and page presentation (2026-11-01)

Not run, not type-checked.

| Item | Change |
|---|---|
| Note step kind | `DEMO_NOTE_STEP_KIND` (`"note"`) in `constants.ts`. A note is a standalone step with no action. Its Title is the heading and its Description is the note text. It sits in a scenario's playbook between two steps and uses the existing playbook mechanism. `listStepKinds` offers it. `runStep` refuses it. `advanceScenario` treats continuing past a note as advancing the scenario. |
| Counting | Notes are left out of the displayed count. The scenario list and the guide panel show "n of m done" and the step numbers from the non-note steps only. Stored `progress` still indexes the whole playbook. `getGuide` returns `index` and `total` without notes and a `note` flag on the step. |
| Presentation of a note | The scenario list shows the title with a note icon and the text, without a number. The guide panel shows the note with a Continue button. The steps table shows no Run button for a note. The view receives the kind as `noteKind`, registered in `seu_demo_index.ts`. |
| About note | A callout above the tabs describes the Demo tenant (ArchVault Public Library and the ArchVault Digital Shelf). The "This is a demo" disclaimer stays above it, muted. |
| Tabs | The area tabs carry the `demo-tabs` class (`public/css/style.css`): filled tab buttons, rounded top corners, and a solid active tab joined to a rule under the row. |
| Root page | The How To panel is shown on the landing page only. The "Edit tab text" form remains on the root page. |
| Seed behaviour confirmed | `demo_steps`, `demo_scenarios` and `demo_areas` load from JSON only while empty. A reset keeps their rows and sets every scenario's `progress` to 0. The step and scenario tables load together, only when both are empty. |

## Step library from visitor actions (2026-11-01)

Owner direction: the scenarios become compositions of individual steps, one step per feature action in the application (for example create-pack, create-template, create-profile, create-ontology). The owner reviews the full list section by section and the steps and scenarios are created from the review. This stage covers visitor-action steps only. Handlers for the simulator-run kinds follow after the review is complete.

### Working files

| File | Purpose |
|---|---|
| `design/demo-visitor-steps-draft.md` | The complete draft list: about 130 visitor-action steps in 12 sections (Ontology, Pack, Template, Profile, Definitions, Authority, Objective, SEU, Work, Evidence/knowledge/decisions, Review/attention/compliance, Observe). Each row has a code, a tab (Declare, Commission, Execute), what the visitor does and the routes. It ends with an open-points table. |
| `src/dblayer/seed/data/demo/steps.json` | Holds only the steps reviewed and accepted so far. |
| `src/dblayer/seed/data/demo/scenarios.json` | Holds only scenarios whose steps exist in `steps.json`. |

### Review progress

| Section | Status |
|---|---|
| Ontology | Done. Six visitor-action steps and one note step. |
| Pack to Observe | Not reviewed. Not yet in `steps.json`. |

The earlier 49 catalogue steps and the scenarios that pointed at them were removed from the seed files so that they do not mix with the library being built. Four further Ontology rows (update-ontology-metadata and the deprecate, retire and archive code steps) remain in the draft only.

### Ontology steps built

| Code | Kind | Tab |
|---|---|---|
| `ontology-what-note` | note | Declare |
| `open-ontology` | visitor-action | Declare |
| `propose-ontology-code` | visitor-action | Declare |
| `review-ontology-approvals` | visitor-action | Declare |
| `approve-ontology-code` | visitor-action | Declare |
| `reject-ontology-code` | visitor-action | Declare |
| `compose-ontology-code` | visitor-action | Declare |

| Scenario | Tab | Playbook | State |
|---|---|---|---|
| View existing Ontology | Declare | ontology-what-note, open-ontology | Enabled |
| Create new Ontology | Declare | open-ontology, propose-ontology-code, review-ontology-approvals, approve-ontology-code | Disabled. The Demo User holds no `sdk_author` role, so the POST routes are denied. |

### Text shown to the visitor

| Field | Where it is used |
|---|---|
| Description | One-line summary. Shown to the administrator only, under the step picker of the scenario form. |
| Annotation | The only step text a visitor sees. It states what to do and why. For a note it is the note text. |

The separate instruction field is removed from the guide panel and the scenario list.

## Built: administration changes for the step library (2026-11-01)

Not run, not type-checked.

| Item | Change |
|---|---|
| Scenario form | A step picker above the Playbook field lists the catalogue steps (title, code, tab). Choosing one shows its description. Add appends its code to the Playbook. `stepOptions` is registered in `seu_demo_index.ts`. |
| Step code edit | The step edit form accepts a new Code. `updateStep` validates the format, rejects a code held by another step, updates the row and rewrites the playbooks of the scenarios that listed the old code. The two writes are not atomic. |
| Note presentation | A note row in the scenario list and the guide panel carries the `demo-note` class (`public/css/style.css`): tinted background, left rule, italic text. It shows the title and the annotation only. |
| Completed scenario | The scenario header shows a green tick beside the muted "n of m done" text when every step is done. The Start guide button is hidden for a finished scenario until a reset. |
| Existing note rows | A note stored with its text in Description shows nothing to the visitor until the text is moved to Annotation. The seed loads only into empty tables, so the new `steps.json` takes effect after the tables are emptied or the rows are edited on the Steps tab. |

## Built: guide grants badges only and revokes on close (2026-11-01)

Not run, not type-checked. This replaces the role grant described under "Built: route-driven grant".

| Item | Change |
|---|---|
| Rule | A guide grants the Demo User only badges. It grants no role. `route_authority` is unchanged. |
| Effect | The route check requires the badge and the role. A route that needs a role the Demo User lacks stays denied after the grant. The Ontology POST routes need `sdk_author`, so they stay denied. |
| Helpers | `demoBadges.ts`: `grantRouteAuthority` returns the badges it added. `revokeAuthority` removes them. `grantRole` and `grantRouteRoles` are removed. `demoSimulator.ts`: `grantGuideAuthority` returns the added badges and `revokeGuideAuthority` removes them. |
| Session | `req.session.demoGuideGrants` holds the badges added for the open guide (`express-session.d.ts`). |
| Start | `POST /demo/guide/start/:code` revokes any earlier grant of the session, then grants for the new guide. |
| Close | `POST /demo/guide/close` revokes the grant and clears the session entries. A failure returns a 500 with the message. |

### Open points

| # | Point |
|---|---|
| 1 | The Demo User is one shared participant. Closing a guide removes badges that another visitor's open guide may need. |
| 2 | A guide that is never closed leaves its badges until a reset. Whether the reset clears them is not verified. |
| 3 | Whether Create new Ontology stays disabled, shows the denial deliberately, or the scenarios stay read-only. |
| 4 | Nothing has been loaded in a browser. |
| 5 | The demo skill (`.claude/skills/demo/SKILL.md`) is not yet updated for the steps above. |
| 6 | `redirects.seu.demoRootStepsEnabled` is unused. |
