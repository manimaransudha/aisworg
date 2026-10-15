# Riverbend Digital Shelf demo

This page belongs to the Demo tenant. It follows a small team at the Riverbend Public Library as they build Riverbend Digital Shelf, an app for members to browse, borrow, return and wait-list ebooks.

## What this application does

SEU Studio helps an organisation plan, run and keep track of software engineering work. Each piece of work is organised as a Software Engineering Unit (SEU), a team of people and AI agents brought together to achieve a goal.

- You state a goal, called an Objective, and the application assembles the SEU needed to deliver it.
- The SEU works towards Deliverables, such as a specification, a design or a release. Each Deliverable moves through clear stages from Draft to Approved.
- People and AI agents carry out the work. Each one is given the tasks that suit their skills.
- Every important step needs someone with the right authority to approve it, and the supporting evidence is recorded with the approval.
- When something needs a person's attention, such as a blocker, a risk or a review finding, the application raises it. Everything else proceeds on its own.
- The application shows where work is waiting and why, so that teams can improve how they work.

The result is engineering work that is organised, accountable and easy to explain.

## What the demo contains

The Demo tenant holds the organisation's own methodology, brought into the platform as governed definitions.

- Riverbend IT's React Native coding standards and the catalogue domain practices are Packs.
- The lean delivery, quality gate, release governance and push integration practices are Packs.
- Four Profiles select those Packs for catalogue work, lending work, notification work and release work.
- Twenty-two Objectives trace from two Strategic goals down to the Engineering work that delivers them.

No Solution Engineering Unit exists until a scenario commissions one. The base state is exactly this definition set and the Objective tree.

## Playing the demo

The Demo User is the shared participant that every scenario acts as. A scenario adds the badges it needs to the Demo User before it runs and never removes them, so the same action can be repeated by hand afterwards.

1. Run a commission scenario to create an SEU against an Engineering Objective.
2. Run scenarios that complete a Deliverable, raise a blocker, release a blocker, raise a risk or raise a finding.
3. Open the other pages of the application to see the effect on Deliverables, Work Items, Attention Items, Obligations and Reviews.
4. Run a playbook, one step at a time, to follow a prepared sequence of scenarios.

Each scenario is one governed event. The effect is visible in the same screens a real participant would use.

## Resetting the demo

The reset button removes every Demo-tenant row created by the demo and seeds the base state again. Tenants, users and participants are kept. The Demo User keeps its participant record and loses its granted badges, which the next reset or scenario grants again.

## Root screen

The root screen offers everything on this page. It also enables or disables each scenario for the Demo User.

<!--
## Source

The seed code is in `src/dblayer/seed/demo`. The scenario and playbook catalogue is in `src/dblayer/seed/data/demo`. The simulator is `src/routes/seu/core/demoSimulator.ts`. Design records are in `DECISIONS.md`, `WHITEBOARD.md` and `BUILD_PLAN.md` beside this file.
-->