# SEU Studio

Engineering knowledge, governance and working practice, combined into one executable model.

SEU Studio runs software engineering from that model. An Objective states what the organisation wants. The platform assembles the engineering unit that delivers it, staffs it with people and AI agents, governs every decision and keeps the evidence. The organisation keeps what it learned.

## Why it matters

- **Practice is defined once and applied everywhere.** Coding standards, quality gates, release rules and compliance requirements are authored as reusable Packs. Every new unit of work inherits them without reconfiguration.
- **Work starts from the goal.** Commissioning turns an Objective into a running engineering unit in a guided sequence. Nothing is assembled by hand.
- **Authority is enforced by the platform.** A state changes only when the participant holds the authority for that step. Each approval records the evidence behind it.
- **People are asked only when a decision is needed.** Blockers, risks and review findings reach the right person. All other work continues.
- **Every outcome can be explained.** Objectives, Deliverables, decisions and evidence form one connected record.
- **Knowledge outlives the team.** Participants and units are temporary. What they learned stays with the organisation.

## The story

A small team at the Riverbend Public Library is building Riverbend Digital Shelf, an app that lets members browse, borrow, return and wait-list ebooks. The library's practices, four Profiles and twenty-two Objectives are already in place. No engineering unit exists yet. You create them as you go.

## The demo in three parts

The three parts follow the order in which the platform is used. Each part opens with a short action on this page and continues on the pages named below.

### Part 1. Authoring: see how the organisation's practice is defined

The library's way of working was authored once, as declarative definitions. This part shows what the rest of the demo stands on and then extends it with one new definition.

1. Open **Registry, Packs**. Each Pack is a reusable practice: coding standards, lean delivery, quality gates, release rules and push notifications.
2. Open **Registry, Profiles**. Each of the four Profiles selects the Packs for a kind of work: catalogue, lending, notification and release.
3. Open **Registry, Templates** and **Registry, Capability Definitions**. Templates give the shape of a unit. Capabilities state the engineering skills it needs.
4. Open **Objectives**. The goal tree runs from two strategic goals down to the engineering work that delivers them.
5. Run **Accept the new compliance code** from the Scenarios table. A new reader-privacy code enters the library's Ontology through the approval path. Open **Ontology** to see it.

What to take away: the organisation's rules are data that is authored, versioned and approved. They are not buried in code or in people's heads.

### Part 2. Commissioning: turn an Objective into a running unit

1. On this page, run **Commission an SEU for O10** from the Scenarios table. The platform selects a Template and a Profile, composes the rules for this unit, activates them and brings the unit to Operational.
2. Any of the other eleven **Commission an SEU** Scenarios (O11 to O22) commissions a further unit in the same way.
3. Open **SEUs**. The new unit appears with its Capabilities and the Deliverables it will produce.
4. Open **Objectives**. The Objective now has a unit working on it.

What to take away: a goal becomes a governed, staffed engineering unit in one guided flow, with the Profile's practices already applied.

### Part 3. Execution: watch governed work run

1. Run **Complete requirements-specification on O10**. The Deliverable moves forward, and work that depended on it becomes ready.
2. Run **Test environment is unavailable** or **Critical vulnerability in a dependency**. The platform records the problem and raises it for attention.
3. Open **Attention**. Only items that need a decision appear here.
4. Run **Release the open blocker on O10** or **Convert the Finding to an Obligation**. The problem is resolved with its evidence recorded.
5. Open **Telemetry** to see where work waits and why. Open **Knowledge Capital** to see what the organisation has gained.

The Scenarios for this part fall into four groups:

| Group | Scenarios |
| --- | --- |
| Deliverables | Complete requirements-specification, architecture-decision-record or detailed-design-specification on O10. |
| Blockers | Test environment unavailable, Lending service API not ready, App store rejects the build, Design approval pending. Release the open blocker on O10, O12, O19 or O21. |
| Risks | Lead reviewer unavailable, Push provider changes its API terms, Library board requests a scope change. |
| Findings | Critical vulnerability in a dependency. Convert it to an Obligation or waive it. |

What to take away: the platform keeps work moving, asks for people only at decisions, and leaves a complete trail.

## Prepared stories

The Playbooks table runs a complete story one step at a time. Enter the step number and choose **Run step**, then open the pages named in the part after each step. Each step belongs to one of the three parts.

| Playbook | Part 1. Authoring | Part 2. Commissioning | Part 3. Execution |
| --- | --- | --- | --- |
| Reader privacy compliance | Accept the new compliance code into the Ontology. | | |
| Catalogue first sprint | | Commission O10. | Three Deliverables approved in sequence. A blocker raised and released. |
| Review Finding to Obligation | | Commission O10. | A critical Finding raised and converted into a tracked Obligation. |
| Release readiness | | Commission O19 and O21. | Two units blocked on their dependencies and released in turn. |

## Starting again

**Reset demo data** returns the demo to its starting point. The library's practices and Objectives stay. Every unit commissioned during the demo is removed, so the story can be played again.
