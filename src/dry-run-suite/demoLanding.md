# SEU Studio

# Why?

## Card 1: AI agents execute work, but lack organisational governance
 
AI systems perform substantial software engineering tasks through prompt-based coordination and workflow execution and agent orchestration. These mechanisms assign tasks and coordinate execution. They do not establish an organisational hierarchy with defined roles, decision rights, authority relationships and persistent accountability. When a session ends, the reasoning behind the work is no longer active, and later work loses access to it unless it is deliberately preserved and brought back into context. The organisation therefore lacks continuity of reasoning, traceable decision evidence and persistent institutional knowledge needed to govern engineering work reliably across activities and over time.

**AI orchestration coordinates execution. It does not govern it.**

## Card 2: Methodologies define governance, but do not enforce it through execution 

Software engineering methodologies document processes, roles, responsibilities and controls. Their value depends on being applied as written. In practice, engineering activities diverge considerably from the documented methodology. Under delivery pressure, teams adapt or bypass prescribed steps while the documentation continues to present an orderly process to management and auditors.

Methodologies were also designed around human participants. Shared understanding therefore remains in meetings, chats, emails and informal discussions. This knowledge is difficult to audit, rarely captured as reusable engineering knowledge, and often leaves with the people who hold it.

**A methodology documents the process. It does not enforce it.**

# How? 

## Card 1: SEU Studio makes methodology executable

SEU Studio shifts from managing work primarily through project plans and periodic control points towards continuously managing engineering outcomes. The organisation's authority limits, accountability relationships, evidence requirements and governance rules are held in the platform, which interprets and enforces them as the work happens. 

Humans and AI systems are treated as equal participants. What the organisation decides and learns remains with the organisation irrespective of which participant carried out the work. 

The SEU stores the shared understanding in explicit engineering records and participants rely on those records in place of informal conversation.

AI can carry out engineering activities that would otherwise be performed by human participants while also enabling forms of continuous organisational operation that were impractical when engineering depended primarily on human participants. 
 

**AI agents execute engineering work. SEU Studio executes the structure, rules and knowledge that govern it.**
  


# What ?

## 1. Engineering Architecture: Defines the organisation's software methodology

Software methodologies, framework, standards and guidelines are structured as declarative definitions. Unlike traditional implementations that use these as references or model them into organisational hierarchies, SEU studio converts them into an executable. 

The declartive components are available in the *Registry*. The declarative components are authored through the SEU Design Kit (SDK Authoring).

**Capabilities** are competencies an organisation possesses to deliver software engineering work. 

Capabilities constitute the fundamental operational ability of an organisation. They become providers and consumers of value within a continuously operating ecosystem. 

Examples: 
- Testing Capability 
- Requirements Analysis Capability

**Service** is the mechanism through which one capability delivers value to another capability or participant or external stakeholder. It forms the operational interface of the organisation, exposing outcome rather than internal execution.

Service is the observable value a capability makes available to the rest of the capabilities.  Capabilities interact with each other by providing Services. It defines what another capability can expect to receive without exposing the internal activity, participant or technology through which that value is produced.

Capabilities describe what the organisation is able to accomplish; Services describe how that ability becomes available to the rest of the organisation.  Capabilities represent organisational potential,Services the operational expression of it.

Value flows through the organisation as Services; Knowledge accumulates as Services are exercised; Evidence is generated as Services produce outcomes; Capabilities improve as service quality improves.

Example: 
- An architectural capability is an organisational ability; an architecture review, an approved architectural specification, an architectural risk assessment are services produced by that capability.
- Requirements engineering is a capability; validated requirements, business process models and requirement traceability are services it provides to the rest of the organisation.

**Templates** provide a typical structural blueprint and engineering artefacts of the software engineering lifecycle for different kinds of work. Templates imply a set of required Capabilities, Deliverables and Lifecycle.

For example:
- Enterprise Web Application
- API Plaform
- AI/ML Development

**Profiles** tailor the Templates and create the executable engineering configuration. They provide the variable inputs such as organisation packs, technology choices, compliance selections, deployment targets etc.

Examples:

- Enterprise Profile
- Healthcare Profile
- Production Profile
- Prototype Profile

Example configurations:
- Environment is pre-production
- Github Connection Strings, DB Connection Strings etc.
- Programming Language is React-Native
- Every merge requires two reviewers
- Use GitFlow

**Packs** are reusable declarative contributions that are included in the Templates and Profiles so the engineering configuration can be enriched as an extension instead of redefinition. 

Examples: 

- An Enterprise Profile includes a Pack that provides coding standards for React-Native
- A Healthcare Profile includes a Pack that provides HIPAA standards

## 2. SEU Commissioning: Turn a configuration into an executable

**Objectives** define the intentions that have to be converted to software systems. 

Examples:

- Write an API to connect to SEU Studio
- Fix Jira defect 4576

**Composition Engine** composes the declarations from the engineering blueprint and configurations to produce an executable **Engineering Behavior Model**. Composition Engine integrates behaviour from Packs.

**Engineering Behavior Model** is used to commission the SEU for the objective and make it operational. Engineering lifecycle for this SEU becomes a a governed unit in one guided flow. EBM is common to all participants - Human, AI, Automated Entities.

A **Software Engineering Unit (SEU)** is an instantiation of an EBM to execute software engineering work realised by human and AI participants, working individually or in teams to transform  objectives into software systems.
 
The Development Capability could be fulfilled today by by a human engineer, tomorrow  an AI coding participant and later by a coordinated swarm of specialised AI participants without changing Engineering Behavior.

A **Deliverable** is a persistent organisational entity that defines the outcomes of the SEU.  it carries organisational purpose, organisational context, execution history, organisational knowledge, decision, evidence and governance state together, making it the primary execution entity within the SEU.

It is the **execution aggregate** that binds all the declaratives and platform services for a single piece of organisational intent unlke a ticket in a ALM tools. Those tools become repositories or views of the Deliverable; the Deliverable itself belongs to the organisation, which is what frees the underlying model from any particular ALM tool.
 

## 3. Execution: watch governed work run

The execution of SEU is centered around **state transitions of Deliverables**. Platform provides runtime services such as state management, eventing, execution planning, observability, notifications, integrations and operational management.
 
In traditional software delivery, there are three questions:

- **What should be done?** (Planning)
- **Who should do it?** (Assignment)
- **When should it be done?** (Scheduling)

In the SEU architecture, those become:

- **Execution Engine** → _What should happen next?_
- **Dispatcher** → _Who is the best Participant right now?_
- **Dependency Engine** → _When can it happen?_

Dependencies are the primary constraint. Time is only a consequence.


The Runtime Kernel, together with the Dependency Engine and Capability Fulfilment service, determines what happens next. This keeps Participants decoupled and ensures that engineering flow is governed by the platform rather than by ad hoc interactions between runtime entities.

It is the application of Knowledge, the current Engineering Behavior Model, the active Deliverables, Dependencies, Obligations and Objectives to make an engineering decision.

Significant engineering state transitions shall be justified through a trust pipeline of Information → Evidence → Knowledge → Decision → Deliverable State Transition.

This provides deterministic explainability, auditability and traceability for all engineering outcomes, while ensuring that confidence is built progressively rather than assumed. It also gives future AI reasoning services a principled basis for explaining _why_ a recommendation or state transition occurred.



Traditional Application Lifecycle Management (ALM) tools treat traceability as **links**:

- Requirement → Design → Code → Test.

Your platform treats traceability as an **engineering graph**.

**An outstanding engineering commitment that influences delivery.**

For example:

- A security vulnerability (Obligation) may be resolved by changing code, applying a configuration, replacing a dependency, or formally accepting the risk.
- A customer clarification (Obligation) may be resolved by receiving an answer, changing requirements, or withdrawing the feature.
- A technical debt item (Obligation) may be resolved by refactoring, redesigning, or consciously deferring it with an approved waiver.

A Review is not about people examining documents.

A Review is:

> **A governed engineering evaluation that determines whether an engineering object is fit to transition to its next state.**

- A **Review** is an evaluation activity.
- A **Finding** is an observation produced by that evaluation.
- An **Obligation** is a governed commitment created in response to an accepted Finding (or from another source).
- **Governance** determines whether the existence of Findings or unresolved Obligations prevents a state transition.

(Quality Gate unifies four traditionally-separate gate concepts the same way; Obligation unifies four traditionally-separate commitment concepts the same way).

**Evidence** is an objectively observable fact, derived from one or more organisational artefacts, that supports, contradicts or qualifies an organisational assertion. Evidence is neither opinion nor interpretation — it represents observable information that can be independently verified. "A source file imports another module," "a requirement references a business rule," "a deployment failed," "a vulnerability scanner detected an exposed dependency" are all evidence in this sense. None of these statements yet constitutes organisational knowledge.

**Knowledge** is an organisationally accepted proposition whose validity is supported by sufficient evidence and whose use is authorised through organisational governance. Knowledge differs fundamentally from information: information may be incomplete, inconsistent or even incorrect, while knowledge represents information the organisation has chosen to rely on. Knowledge is therefore an organisational commitment, not merely a collection of fact.

Every engineering organisation acts on what it believes to be true — architectures are designed because certain assumptions are accepted, requirements are implemented because business rules are believed correct, testing strategy exists because quality assumption has been established. These accepted organisational beliefs collectively constitute organisational **Knowledge**.

Knowledge, within the ontology, is neither accumulated information nor the output of an artificial intelligence model. Participants may hold opinion; artificial intelligence may produce hypothesis; evidence may support multiple interpretations. Knowledge begins only when the organisation accepts a proposition as sufficiently justified for operational use — it is an organisational commitment, not a body of information, and this distinction is central to the theory developed throughout this work.

------

A **Decision** is an organisational commitment to a course of action, based on accepted knowledge and exercised under organisational governance. A decision records what the organisation has chosen, why it has chosen it, what knowledge supports the choice, what consequence is expected, and who possesses the authority to decide. It represents the transition from organisational understanding to organisational intent.

Organisations continuously acquire information: they observe evidence, they establish knowledge. Neither, by itself, changes organisational behaviour unless the organisation commits to a course of action — that commitment is the **Decision**.

Most software engineering treats decisions as documents — an architecture decision record, a change request, an approval note, a set of meeting minutes. These are merely *representations* of a decision. A decision is something more fundamental: the point at which the organisation commits to changing its future behaviour. Knowledge tells the organisation what it believes; a decision tells it what it will do because of that belief. Within the ontology, decisions are first-class organisational entities — not meeting outcomes, not documents, but organisational commitments that influence future behaviour. Without decision, knowledge remains passive; with decision, knowledge becomes organisational action.

--------

**Governance** is the organisational system of principle, policy, authority, constraint and control mechanism that regulates organisational behaviour while ensuring continued alignment with organisational objective. Governance determines what participants may do, under what condition, using what authority, producing what evidence, and subject to which organisational policy — regulating, in consequence, every organisational entity introduced in this ontology.

An organisation consists of more than participant, activity and engineering artefact. It must also determine what behaviour is permitted, who may make decision, how knowledge becomes accepted, how conflict is resolved, how quality is assured and how organisational integrity is preserved. These responsibilities collectively constitute **Governance**.

Within the ontology, governance is not administrative overhead.

*[Review — this chapter follows the original draft in calling governance "the operating system that enables autonomous participants to operate safely." Part 1 Chapter 3 §3.5 separately calls the SEU itself "the organisational operating system." Chapter 4 formerly gave the same label, at length, to its "Organisational Operating Model," but Chapter 4 has since been rebuilt as a skeletal SEU Meta-Model chapter and no longer makes that claim, narrowing this from a three-way naming collision to a two-way one (this chapter vs. Ch3 §3.5). Both claims are defensible on their own terms, but the book should settle on one. Not resolved here — kept as the original argument intends, flagged for the same future pass as Ch3 §3.5's own operating-system analogy (see Editorial Log).]*

Without governance, increasing autonomy results in increasing organisational risk; with governance, increasing autonomy becomes organisational capability.

-----------

Software engineering organisations exist to transform intent into outcome. A customer requests a feature; an operational incident requires investigation; a vulnerability must be resolved; a regulatory change demands implementation; a legacy system requires modernisation. These situations differ considerably, yet share a common characteristic: each represents organisational intent requiring coordinated execution.

Traditional software engineering represents such intent through many different constructs — requirement, user story, defect, task, epic, change request, support ticket, work order — a diversity that reflects differences in tooling rather than differences in organisational behaviour. The AI Software Organisation unifies these constructs under a single concept: the **Deliverable**, the organisational representation of intent undergoing execution.

## 23.2 Definition


---------

A **State Management** is the governed progression of a Deliverable through one or more organisational capabilities in order to realise organisational objective. It determines which capability reasons next, which service is required, which decision must be made, which evidence is required, and when execution may proceed — coordinating organisational reasoning, not merely scheduling activity.


The previous chapter introduced the Deliverable as the primary execution entity within the AI Software Organisation — the carrier of organisational intent. Intent alone, however, does not produce software; it must progress through multiple capabilities in turn: requirements, architecture, implementation, testing, security, deployment, operations, knowledge management. Traditional software engineering models this progression as a workflow, but typically assumes a predetermined sequence of engineering task. The AI Software Organisation takes a different view: a workflow is not a predefined task sequence. It is the governed progression of organisational intent through a network of reasoning capabilities.

--------


Governance mechanism:

- Policies define **constraints**.
- Authority defines **who may authorise**.
- Reviews produce **findings**.
- Findings may create **Obligations**.
- Evidence supports **Knowledge**.
- Knowledge supports **Decisions**.
- Quality Gate evaluates all of these.

A Quality Gate is actually:

> **A declarative engineering contract that must evaluate to true before a governed state transition may occur.**

A Quality Gate is **not** a checklist. 
A checklist is merely one possible implementation.

> **A Quality Gate evaluates whether a specific lifecycle transition is permitted.**

Every lifecycle transition in the platform—not just Deliverables, but also Decisions, Knowledge Items, Obligations and even SEUs—should reference a **Transition Definition**. A Transition Definition would specify:


Execution Engine responsibilities:

- listens to Events
- evaluates Dependencies
- evaluates Transition Definitions
- requests Capability Fulfilment
- generates transient Work Items
- issues Commands




**Execution Engine becomes the only runtime component that "understands" engineering execution, and even then, it does so by interpreting declarative models rather than embedding engineering logic in code.**

The Execution Engine should **never create Work Items directly**.

Instead, it should generate **Commands**. A separate service can then translate those Commands into transient execution plans (Work Items) appropriate for the assigned Participant.

That keeps planning separate from execution. It also allows different Participant types—AI models, humans or external systems—to receive different execution plans while responding to the same engineering Command.

The platform is fundamentally **event-driven**.

State changes produce events.

Events cause evaluations.

Evaluations produce new state transitions.



**Policies** 

The Policy Model defines how engineering constraints, organisational rules and governance directives are represented, composed and evaluated within a Software Engineering Unit (SEU).

Policies express **what conditions must be satisfied** before governed engineering actions may proceed.

A Policy's Constraint Type determines whether it behaves as a mandatory constraint or a preferred convention (§8, §11). Both are represented as Policies; only their enforcement differs.

Policies do not execute engineering work.

Policies do not grant authority.

Policies do not perform reviews.

Policies declare engineering constraints that are interpreted by the Governance Model.
 
---------

List of entities and services provided by the platform

|Component|Responsibility|
|**Capability**|Defines what engineering competency is required.|
|**Participant**|Provides the competency.|
|**Template**|Defines the structural blueprint of the SEU.|
|**Profile**|Defines how that blueprint is commissioned for a specific context.|
|**Pack**|Contributes behaviour, knowledge, governance, integrations and other engineering assets.|
|**Engineering Behavior Model (EBM)**|Represents the fully composed behavioural specification that governs the commissioned SEU.|
|**Runtime Kernel**|Provides generic platform infrastructure (state, events, scheduling, persistence, integrations).|
|**Execution Engine**|Interprets engineering state and decides what engineering actions should be requested next.|
|**Command**|A request to perform an engineering action.|
|**Work Item Generator**|Expression of Command for a specific type of Participant?|
|**Work Item**|Expresses participant-specific execution instructions.|
|**Dispatch Engine**| Determines who should execute this Work Item|
|**Transition Definition**|The declarative contract describing how a state transition may occur.|
|**State Transition**|The successful change of an engineering object's authoritative state.|
|**Event**|The immutable fact that the transition has occurred.|
|**Policy**|Defines what constraints apply.|
|**Authority**|Defines who may authorise governed engineering actions.|
|**Obligation**|Defines outstanding engineering commitments.|
|**Governance**|Evaluates whether a requested state transition is permissible.|
|**Platform Security**|Defines access to the platform|

Each concept answers a different question:

|Component|Responsibility|
|**Capability**|_What engineering competency is offered?_|
|**Participant**|_Who provides the competency?_|
|**Template**|_What is the blueprint?_|
|**Profile**|_What are the specifics required for this work_|
|**Engineering Behavior Model (EBM)**|_How should this work be done?_|
|**Execution Engine**|_What engineering action should happen next?_|
|**Work Item Generator**|_How should this Command be expressed for a specific type of Participant?_|
|**Dispatch Engine**|_Who should execute this Work Item now?_|
|**Participant**|_How do I actually perform this engineering activity?_|
|**Runtime Kernel**|_How is execution managed, observed and recorded?_|
|**Dispatch Engine**| _Who is the best Participant right now?_|
|**Dependency Engine**|_When can it happen?_|
|**Transition Definition**|_What next states are possible?_|
|**Policy**|_What constraints must be respected?_|
|**Authority**|_Who may approve or perform this action?_|
|**Obligation**|_What commitments remain outstanding?_|
|**Governance**|_May this state transition occur now?_|
|**Platform Security**|_May this entity access the platform or invoke this API?_|

 

## Why it matters

- **Practice is defined once and applied everywhere.** Coding standards, quality gates, release rules and compliance requirements are authored as reusable Packs. Every new unit of work inherits them without reconfiguration.
- **Work starts from the goal.** Commissioning turns an Objective into a running engineering unit in a guided sequence. Nothing is assembled by hand.
- **Authority is enforced by the platform.** A state changes only when the participant holds the authority for that step. Each approval records the evidence behind it.
- **People are asked only when a decision is needed.** Blockers, risks and review findings reach the right person. All other work continues.
- **Every outcome can be explained.** Objectives, Deliverables, decisions and evidence form one connected record.
- **Knowledge outlives the team.** Participants and units are temporary. What they learned stays with the organisation.

## The story

A small team at the ArchVault Public Library is building ArchVault Digital Shelf, an app that lets members browse, borrow, return and wait-list ebooks. The library's practices, four Profiles and twenty-two Objectives are already in place. No engineering unit exists yet. You create them as you go.


### Part 

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

The computational system implements the organisational constructs, authority constraints, accountability relationships, service obligations, evidence requirements, and governance rules.
SEU  transforms software engineering methodology into a computational system that can actively support, guide, record and evaluate engineering work as it is performed.
  
---------


1. Run **Complete requirements-specification on O10**. The Deliverable moves forward, and work that depended on it becomes ready.
2. Run **Test environment is unavailable** or **Critical vulnerability in a dependency**. The platform records the problem and raises it for attention.
3. Open **Attention**. Only items that need a decision appear here.
4. Run **Release the open blocker on O10** or **Convert the Finding to an Obligation**. The problem is resolved with its evidence recorded.
5. Open **Telemetry** to see where work waits and why. Open **Knowledge Capital** to see what the organisation has gained.
