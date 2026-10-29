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
