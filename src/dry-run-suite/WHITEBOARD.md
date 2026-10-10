# Demo data whiteboard

Status: DRAFT for discussion. Nothing here is built. Companion to [DECISIONS.md](DECISIONS.md).

## Frame

- Tenant: Demo. Actor: shared "Demo User" participant. A visitor signs in with Google and plays by hand.
- Story: a small team builds an ebook lending platform for a public library. One coherent story, no filler.
- Every item is created and transitioned through the governed path. States below are the targets after seeding.
- "Authority" lists the `transition_definitions` authority rule the Demo User must hold for the visitor to repeat the step by hand. The final badge set is deferred to the owner.
- State names are taken from `transitionDefinitions.json` (working tree).

## Story spine

Library: "Riverbend Public Library". Product: "Riverbend Digital Shelf", an app for members to browse, borrow, return and wait-list ebooks.

## SDK data

Purpose: show that an organisation keeps its existing methodology and standards and integrates them into the platform as governed, declarative Packs and Profiles. The visitor sees the organisation's own practices, not generic platform defaults.

Platform packs come from db:clean-slate and are reused unchanged. The items below are authored through the SDK authoring path (Draft to Validated to Published to Active), with the Demo User as author. They are definitions only (declarative).

### Organisation methodology (the story)

Riverbend IT already has a mobile standard: a React Native coding-standards checklist and a library-catalogue domain glossary. The demo shows each being brought in as a Pack rather than replaced.

### Packs

| # | Pack | Category | Derived from | What the organisation contributes | Dependencies |
|---|---|---|---|---|---|
| P1 | riverbend-react-native | Technology | technology-react-native (platform pack, 26-item "React Native Standards" checklist) | The same standards, re-expressed as Skills in place of checklist items (see Open item A). Retains the platform pack's Capabilities and its Technology/react-native competency. | development 1.0.0 (required) |
| P2 | riverbend-library-catalogue | Domain | New (authored from scratch) | Catalogue-management aspects: bibliographic records (title, author, ISBN, subject) and the catalogue domain vocabulary. Competency Domain/library-catalogue. | development 1.0.0 (required) |

P2 is a new Pack. Its Capabilities and Services reuse existing codes from the db:clean-slate Ontology vocabulary (referenced by code, not redefined):

| Kind | Codes (existing) | Organisation specific addition |
|---|---|---|
| Capabilities | understanding-business-domain, requirements-elicitation, engineering-documentation | Pack-level descriptions in library-catalogue terms |
| Services | domain-model-service, requirements-discovery-service, technical-documentation-service | none |
| Obligation Definitions | none existing | New engineering-work duties, see below |
| Competency | Domain / library-catalogue | none |

### Obligations and Policies

Obligation Definitions are engineering-work duties. Proposed set (codes and wording to confirm):

| Pack | Obligation | Duty |
|---|---|---|
| P1 | native-sdk-deprecation-tracking (inherited from technology-react-native) | Track and migrate deprecated native iOS/Android APIs before the platform removes them |
| P1 | dependency-upgrade-regression-run | Every dependency upgrade is followed by a regression run on both iOS and Android builds |
| P2 | catalogue-schema-migration-plan | A change to the catalogue data model carries a data-migration plan before it is built |
| P2 | search-index-rebuild-verification | The search index is rebuilt and verified after a catalogue metadata change |

Policy: P1 contributes the existing Eligibility Policy `cr104-demo-background-check` (seeded by db:clean-slate in pack cr104-demo-seu-eligibility-policies). A Participant is eligible to fulfil a Capability only if its behaviour_context holds `{policy: cr104-demo-background-check, payload: {cleared: true}}`.

Consequence for seeding: every Participant fulfilled against P1 Capabilities (Priya Raman, Marcus Webb, Demo AI assistant) must carry that behaviour_context entry, or they cannot be selected.

### Additional Packs (organisation practice sets)

The mobile-application Template is not modified. It exposes no overridable parameters, so Profiles differ by the Packs they select. These Packs contribute existing Policy Definitions from db:clean-slate, referenced by code.

| # | Pack | Category | Policies contributed (existing codes) | Used for |
|---|---|---|---|---|
| P3 | riverbend-lean-delivery | Organisation | coding-standards, code-review-required, design-completeness-and-review, requirements-traceability-required | requirements, design, construction, test flows |
| P4 | riverbend-quality-gates | Organisation | test-coverage-threshold, static-analysis-required, dependency-vulnerability-threshold | features with business rules or data |
| P5 | riverbend-release-governance | Organisation | change-approval-required, deployment-approval-required, rollback-capability, release-notification, secrets-management | delivery to production |
| P6 | riverbend-push-integration | Integration | adr-required, secrets-management | notification features that call external push providers |

| P7 | riverbend-reader-privacy | Compliance | Declares a new Compliance Framework with declarative Requirements for reader privacy (borrowing history, device identifiers) | Compliance view (UC10) |

P7 uses a new compliance code that is not yet in the Ontology. It is authored and published but cannot become Active until the Ontology accepts the code. Seeding leaves it Published. The simulator scenario "Accept the new compliance code" simulates the Ontology acceptance, after which the Pack can be activated (authority-transition-pack-elevated). P7 is not selected by any Profile.

Each Pack also carries engineering Obligation Definitions in the same way as P1 and P2 (codes and wording to confirm).

### Profiles

Every Profile uses the mobile-application Template and selects P1 and P2. An SEU is commissioned against one leaf Objective and uses one Profile. Rules enforced by commissioning: the Objective is Active, is not Strategic, has no child Objectives, and has no SEU yet. Only the Engineering leaf Objectives are therefore commissioned.

| # | Profile | Environment | Optional Packs | Leaf Objectives (one SEU each) |
|---|---|---|---|---|
| PR1 | riverbend-catalogue-build | development | P1, P2, P3 | O10, O11 |
| PR2 | riverbend-lending-build | development | P1, P2, P3, P4 | O12, O13, O14, O15 |
| PR3 | riverbend-notifications-build | development | P1, P2, P3, P4, P6 | O16, O17 |
| PR4 | riverbend-release | production | P1, P2, P5, P4 | O19, O20, O21, O22 |

O1 to O9 and O18 cannot be commissioned (Strategic, or Operational with children). Leaf Objectives are commissioned from the demo-state view.
Open: more Profiles, such as one for requirements-only work, if the Objectives call for them (open item C).

### Scope of the visitor experience

Nothing new is built for the demo. Once the data is seeded, the visitor sees whatever the application already offers over that data. Bug fixes and feature tuning found along the way are separate work, outside this scope.

### Seeding order for SDK data

1. Confirm the platform Packs, the mobile-application Template and the Capabilities exist (from db:clean-slate).
2. Author P1 and P2 and transition them to Active.
3. Author P3 to P6 and transition them to Active. Author P7 and leave it Published.
4. Author PR1 to PR4 and transition them to Active.

## Objectives (hierarchy)

Each Objective states one outcome or one build item. Combined statements are split.

| ID | Tier | Statement | Parent | Target state |
|---|---|---|---|---|
| O1 | Strategic | Let Riverbend members borrow ebooks from home, so loan volume grows without new branch hours. | none | Active |
| O2 | Strategic | Offer a web-only reader on the library website. | none | Active |
| O3 | Operational | Let members find ebooks through a searchable catalogue. | O1 | Active |
| O4 | Operational | Let members borrow an ebook for a fixed loan period. | O1 | Active |
| O5 | Operational | Let members return a borrowed ebook before the loan period ends. | O1 | Active |
| O6 | Operational | Let members place a hold on a title that is unavailable. | O1 | Active |
| O7 | Operational | Let members renew a loan once. | O1 | Active |
| O8 | Operational | Notify members on their phone when a held title becomes available. | O1 | Active |
| O9 | Operational | Offer a printed-book renewal kiosk. | O1 | Active |
| O10 | Engineering | Build the catalogue metadata model. | O3 | Active |
| O11 | Engineering | Build the catalogue search index. | O3 | Active |
| O12 | Engineering | Build the checkout service. | O4 | Active |
| O13 | Engineering | Build the return service. | O5 | Active |
| O14 | Engineering | Build the hold waitlist queue. | O6 | Active |
| O15 | Engineering | Build the loan renewal rule. | O7 | Active |
| O16 | Engineering | Build push notification dispatch. | O8 | Active |
| O17 | Engineering | Build member device registration for push notifications. | O8 | Active |
| O18 | Operational | Decide how the app is deployed to members. | O1 | Active |
| O19 | Engineering | Conduct integration testing of the app against the library lending service. | O18 | Active |
| O20 | Engineering | Prepare the production deployment manifest. | O18 | Active |
| O21 | Engineering | Submit the app to the Apple App Store. | O18 | Active |
| O22 | Engineering | Submit the app to Google Play. | O18 | Active |

All Objectives are progressed to Active during seeding. No SEU is seeded; SEU commissioning and progress belong to part 2 (demo-state view).
Wording is new for this demo. Owner to confirm or reword.

## Part 2: Demo landing page and simulator (draft)

Two screens in the main application, both with route_authority rows and CR-083 styling.

### 2a. Demo landing page (the demo participant)

| Element | Behaviour |
|---|---|
| About the demo | Explains what the demo does, the Riverbend story and what the visitor can try. |
| Reset demo data | A button that runs the seeding part of the demo (Demo-tenant purge, then part 1 seeding). |
| Allowed scenarios | Lists the scenarios from the catalogue that the demo participant may simulate. |
| Simulate as the participant | Raise a blocker, release a blocker, waive a blocker, and issue commands such as "Deliverable complete", as a participant would. |

The demo participant is the shared Demo User. The simulator acts as that participant. Before an event, the badge helper adds any badge the event needs. Granted badges are never revoked, so the visitor can repeat those actions by hand.

### 2b. Root screen

A separate screen for the root user. It offers everything the demo landing page offers, so root can run the demo, and adds enabling or disabling each scenario for the demo participant.

### Blocker actions and existing entry points

| Action | Entry point (existing) |
|---|---|
| Raise a blocker | completeWorkItem, outcome blocked or failed (workItems.ts); raises an Attention Item |
| Release a blocker | transitionAttentionItem through Acknowledged, In Progress and Resolved (attentionItems.ts) |
| Waive a blocker | transitionFinding Open to Waived (findings.ts); grantWaiver for a Compliance requirement (compliance.ts); grantQualityGateWaiver (qualityGateWaivers.ts) |
| Complete work | completeWorkItem, outcome done; advances the Deliverable |

### Run modes

| Mode | Behaviour |
|---|---|
| Manual stepping | The root user triggers one event per click. Each click is one governed event, and the screen shows the effect. |
| Scripted playbook | A playbook is an ordered list of catalogue events held in the same JSON file. It plays in order and can be paused or stepped. |

Both modes call the same governed entry points. Location: inside the main application, not the dry-run-suite.

### Simulated risks and blockers

The view lets the root user inject imaginary risks and typical project blockers on an SEU. The platform has no Risk or Blocker entity, so each scenario is expressed through existing entities. Obligations already carry an Ontology category "Risk" (category:obligation) with severity and priority concepts.

| Kind | Example scenario | Expressed as |
|---|---|---|
| Risk | Lead reviewer unavailable for the next two weeks | Obligation, category Risk, severity and priority from the Ontology |
| Risk | Push provider changes its API terms | Obligation, category Risk |
| Risk | Library board requests a scope change | Obligation, category Risk |
| Blocker | Test environment is unavailable | Work Item outcome blocked, with its Attention Item |
| Blocker | Lending service API is not ready for integration | Work Item outcome blocked, with its Attention Item |
| Blocker | App store review rejects the build | Work Item outcome failed, with its Attention Item |
| Blocker | Design approval is pending | Work Item outcome blocked, with its Attention Item |
| Finding | Critical vulnerability in a dependency | Review Finding, High severity (converts to an Obligation) |
| Finding | Convert the Finding to an Obligation | convertFindingToObligation |
| Ontology | Accept the new compliance code so the reader-privacy Pack can be activated | Ontology Draft to Active, then Pack Published to Active |

The scenario list is data held in a database table, seeded from a JSON file. It is not code. Each scenario names its kind, title, description, category, severity and priority, and the target Deliverable or Work Item.

## Use cases

Use cases UC2 to UC12 are produced by the simulator in part 2, not by seeding. They stay as the target story the simulator can reach.

| UC | Title | What the visitor sees | Seeded state | Hand-play action | Authority |
|---|---|---|---|---|---|
| UC1 | Strategy to engineering traceability | Objective tree O1 to O22; trace from a Deliverable back to O1 | O1 to O22 as above | Open the trace view | `authority-transition-objective` |
| UC2 | Deliverable lifecycle | Five Deliverables from the mobile-application Template | see UC2 table | Start, approve and baseline a Deliverable | `authority-deliverable-creator`, `authority-deliverable-approver` |
| UC3 | Work in flight | Work Items against Deliverables, with Participants (Human and AI) | see UC3 | Reassign or replace a Participant | `authority-transition-participant` |
| UC4 | Review with a Finding | A completed Architecture Review with one open High Finding | Review Completed; Finding Open | Resolve or waive the Finding; accept the Review | none (Review, Finding) |
| UC5 | Obligation from a Finding | An Obligation raised from the Finding | Obligation Analysed | Assign, progress, resolve, verify, close | `authority-transition-obligation` |
| UC6 | Evidence trail | Collected, Validated and Accepted Evidence on the baselined Deliverable | mixed | Validate or reject Evidence | `authority-transition-evidence` |
| UC7 | Attention queue | Items raised by the Finding and a stalled Work Item | Created and Delivered | Acknowledge and resolve | `authority-transition-attentionitem` |
| UC8 | Decision record | A Decision: "Use push notifications only for release 1" | Proposed | Review, approve, apply | none |
| UC9 | Knowledge capture | Two Knowledge items from the architecture work | Observed; Proposed | Validate and accept | none |
| UC10 | Compliance view | A Compliance Framework evaluated read-only over the SEU (reader privacy) | one requirement satisfied, one unsatisfied | Raise a Waiver on the unsatisfied one | `authority-transition-pack` is not involved; Waiver authority to confirm |
| UC11 | Governance model | The effective Governance Model of the SEU from its EBM | EBM Active | Read-only | none |
| UC12 | SEU lifecycle | The SEU is Operational | SEU Operational | Suspend and resume | none |

### UC2 Deliverables (from the mobile-application Template)

| Deliverable | Target state | Why this state |
|---|---|---|
| requirements-specification | Baselined | A finished example |
| architecture-decision-record | Approved | Ready for Baselining |
| detailed-design-specification | In Progress | Shows live work |
| source-code | In Progress | Has a blocked Work Item (UC7) |
| security-assessment-report | Defined | Not started; visitor starts it |

### UC3 Work Items and Participants

| Participant | Type | Role in story |
|---|---|---|
| Priya Raman | Human | Product analyst, owns the requirements-specification |
| Marcus Webb | Human | Lead architect, owns the architecture-decision-record |
| Demo AI assistant | AI | Fulfilled against all P1 Capabilities (holds Technology/react-native competency); builds source-code under the React Native standards |
| Riverbend IT Operations | External | Hosts the production environment |

Participant names are placeholders for the owner to approve. These are seeded Participants shown on Work Items. They are not identities the simulator acts as.

## Seeding order (part 1, governed path)

1. Reset the Demo tenant (purge helper). Keep the Demo tenant row and the Demo User participant.
2. Set badges and role on the Demo User participant (single editable input).
3. Author and activate Packs P1 to P6.
4. Author and activate Profiles PR1 to PR4.
5. Create Objectives O1 to O22 and progress all to Active.
6. Load the scenario catalogue from JSON into the database table in one batch.

Everything after this point (SEU commissioning, Deliverable progress, Work Items, Reviews, Findings, Obligations, Evidence, Decisions, Knowledge, Compliance) is produced by the simulator in part 2, not seeded.

## Open questions

| # | Question | Needed for |
|---|---|---|
| 1 | RESOLVED. The story, names and Objective wording are accepted by the owner. |  |
| 2 | RESOLVED. Template is mobile-application; Profiles PR1 to PR4 are authored; UC2 and UC3 realigned to its Deliverables. No ebook-library artefacts are carried over. | Step 3 |
| 3 | RESOLVED. P7 is a new Compliance Pack with a new code; it stays Published until the simulator simulates Ontology acceptance. |  |
| 4 | DROPPED. Ontology codes are read from the Ontology at build time. |  |
| 5 | RESOLVED. Converting a Finding to an Obligation is a manual call (convertFindingToObligation) and is a simulator scenario. |  |
| 6 | DROPPED. Use cases UC2 to UC12 are produced by the simulator catalogue, not seeded. |  |
| A | RESOLVED. A Skill is work an AI Participant can be assigned. P1 carries one Capability contribution per standards group (existing capability code, React Native description, role and worktype) plus the Technology/react-native competency. An AI Participant is fulfilled against those Capabilities and holds the competency, so it is eligible for dispatch. | P1 |
| B | RESOLVED. P1 and P2 carry engineering Obligation Definitions (table above). P1 also contributes the existing background-check Eligibility Policy. | P1, P2 |
| C | More Profiles may be required. Decide after the Objectives are agreed. | Profiles |
| D | RESOLVED. All Objectives seeded Active; no SEU seeded. SEU commissioning and progress are part 2. | Seeding |
| E | RESOLVED. Releasing a blocker is the Attention Item chain. Re-dispatch follows as event consumption. | Part 2 |
| F | RESOLVED. The scenario catalogue is stored in the database, tenant scoped to Demo. The JSON file is the seed source, loaded once and written in one batch on reset. Category, severity and priority reference Ontology codes and are validated against the Ontology on load. | Part 2 |
| G | RESOLVED. The root screen does everything the demo participant can do (so root can run the demo) and also enables or disables scenarios. | Part 2 |
