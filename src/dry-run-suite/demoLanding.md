# SEU Studio

## 1. The application

SEU Studio is an execution environment for commissioning and operating Software Engineering Units (SEUs). An SEU is a self-contained unit of software engineering. It exists to achieve an Objective and to produce the Deliverables that Objective needs.

People, schedules and tasks are not the starting point. SEU Studio starts from the engineering itself. It combines the organisation's engineering knowledge, governance rules and working practices into one executable model. It then runs the SEU from that model.

### How it works

- **An Objective is the reason an SEU exists.** It states what is to be achieved and leaves the method open. Objectives are arranged in a tree, from strategic goals down to engineering work.
- **Deliverables are the focus.** A Deliverable is an outcome such as a requirements specification, a design or a release. It moves through stages such as Draft, Reviewed and Approved. All work in an SEU contributes to a Deliverable.
- **Dependencies decide what happens next.** Work becomes ready when the Deliverables it depends on have reached the required state. For example, architecture work begins when the requirements specification is Approved.
- **Capabilities say what is needed.** When an SEU is commissioned, the application works out which engineering Capabilities are required. It then fulfils them with Participants, who may be people or AI agents.
- **Practices are chosen, not built in.** Coding standards, quality gates, release rules and compliance requirements are defined once, as Packs. A Profile selects the Packs for a kind of work. The application composes them into the rules that govern each SEU.
- **Approvals follow authority.** A change of state, such as approving a Deliverable, needs a Participant who holds the authority for that step. The approval is recorded with the evidence that justified it.
- **Attention is requested only when a decision is needed.** A blocker, a risk or a review finding becomes an Attention Item only when someone must decide. Other work continues without interruption.
- **Knowledge is kept.** Participants and SEUs are temporary. The knowledge gained stays with the organisation and can be reused.
- **Every decision can be traced.** Objects and the links between them form one connected record, so any outcome can be explained afterwards.
- **Telemetry shows how work flows.** It shows where Deliverables are waiting and why. It measures the flow of engineering work and does not measure individual people.

## 2. The demo

### The story

The demo follows a small team at the Riverbend Public Library. They are building Riverbend Digital Shelf, an app that lets library members browse, borrow, return and wait-list ebooks.

### What is already set up

The demo starts with the library's way of working and its plan already loaded.

- **Practices.** The library's coding standards, lean delivery, quality gates, release rules and push notification practices.
- **Four Profiles.** One each for catalogue work, lending work, notification work and release work. A Profile chooses the practices for that kind of work.
- **Twenty-two Objectives.** They run from two strategic goals down to the engineering work that delivers them.

No SEU exists yet. You commission them as you play the demo.

### How to play the demo

The demo is run from the Riverbend Demo page. It lists Scenarios and Playbooks. A Scenario is one event in the life of the project. A Playbook is a prepared story made of several Scenarios, played one step at a time.

1. **Commission an SEU.** Run a Scenario named "Commission an SEU". The application commissions an SEU for that Objective.
2. **Make progress.** Run a Scenario such as "Complete requirements-specification". A Deliverable moves forward.
3. **Introduce a problem.** Run a Scenario such as "Test environment is unavailable", "Lead reviewer unavailable" or "Critical vulnerability in a dependency". The application records the problem and raises it for attention.
4. **Resolve it.** Run a Scenario such as "Release the open blocker" or "Convert the Finding to an Obligation". The problem is worked through to a resolution.
5. **Follow a story.** Run a Playbook one step at a time. The four Playbooks are Catalogue first sprint, Review Finding to Obligation, Release readiness and Reader privacy compliance.

### Where to see the effect

After each Scenario, open these pages from the navigation bar.

| Page | What it shows |
| --- | --- |
| Objectives | The goal tree and the status of each goal. |
| Commissioned SEUs | The SEUs that exist and the Deliverables each one is working on. |
| Attention | Blockers, risks and findings that need a decision. |
| Telemetry | Where work is waiting and why. |
| Engineering Capital | The knowledge the organisation has built up. |

### Starting again

The Reset demo data button on the Riverbend Demo page returns the demo to its starting point. The library's practices and the Objectives stay. Every SEU commissioned during the demo is removed. The same story can then be played again.

<!--
## Source

The seed code is in `src/dblayer/seed/demo`. The scenario and playbook catalogue is in `src/dblayer/seed/data/demo`. The simulator is `src/routes/seu/core/demoSimulator.ts`. Design records are in `DECISIONS.md`, `WHITEBOARD.md` and `BUILD_PLAN.md` beside this file.
-->
