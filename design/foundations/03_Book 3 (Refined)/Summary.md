# SEU Studio

The logical architecture of SEU Studio is provided here. 

Software Engineering Unit provides services that make software engineering possible by bringing AI and human participants into the same governing process that typical software engineering processes expect. 

SEU Studio is **the software platform** that hosts all of this.

SEU Studio is organized around four domains.

- Software practice 
- SEU platform 
- Integration 
- Cross-cutting concerns

## 1. Software Practice

The Software practice domain defines the primitives needed to carry out the work. These are grouped into:

- Engineering primitives
- Execution primitives
- Knowledge primitives
- Governance primitives

### Engineering primitives

The Engineering primitives defines persistent engineering objects that are listed below. These objects are required to define the engineering behavior of a software engineering lifecycle. 
 
- Deliverables
- Capabilities
- Services
- Templates
- Profiles
- Objectives
- Reviews
- Participants

#### Deliverables


Deliverables evolve through states.


#### Capabilities

|**Capability**|Defines **what engineering competency** is required.|

#### Services

a capability is an enduring ability; a service is what that ability actually delivers." A Capability Pack that declares a Capability without also declaring what that Capability contracts to deliver is only telling half the story. So Service is declared alongside Capability, by the same Pack, as the natural second half of a Capability's declaration — not a separate concern bolted on afterward.

#### Templates

Templates imply a set of required Capabilities.
At the moment, the Template is carrying three responsibilities:

1. **Structural blueprint** (SEU shape).
2. **Initial engineering artefacts** (deliverables, capabilities, lifecycle).

#### Profiles

Profiles configure a commissioning by deriving from a template. 
3. **Commissioning defaults** (mandatory/recommended packs, parameters).


> **How do we instantiate the same Template differently for different situations?**

That is precisely the purpose of a **Profile**.


For example:

```
Template
    +
Profile
    ↓
Composition Engine
    ↓
Engineering Behavior Model
    ↓
Commission SEU
```

A Template would answer:

> **"What kind of SEU is this?"**

A Profile would answer:

> **"How do you want to commission it today?"**

Examples:

- Startup Profile
- Enterprise Profile
- Healthcare Profile
- Production Profile
- Prototype Profile

The Profile would provide the variable inputs—organisation packs, technology choices, compliance selections, deployment targets—while the Template remains a stable structural blueprint.

I think this separation would keep Templates clean and make commissioning far more flexible. It also aligns with one of our recurring architectural principles: **separate stable structure from variable configuration**. Before we write the Commissioning chapter, I'd like us to decide whether we adopt this refined interpretation of Profiles, because it will influence the commissioning workflow substantially.


#### Objectives

An Objective is the reason why an SEU exists. It states what the SEU should achieve. It does not explain how the SEU will get there.


#### Reviews

#### Participants
 
### Governance primitives

The Governance primitives are required to define the governance associated with a software engineering lifecycle. 

- Authority
- Policies
- Obligations
- Quality Gates
- Compliance
- Attention Items

#### Authority
#### Policies
#### Obligations
#### Quality Gates
#### Compliance
#### Attention Items

### Information primitives

The Information primitives that are required for engineering and governing software engineering is listed below:

- Findings
- Knowledge
- Evidence
- Decisions

#### Findings
#### Knowledge
#### Evidence
#### Decisions


### Execution primitives

The Execution primitives defines persistent engineering objects that enable bringing together all the primitives to execute a software engineering lifecycle. 

- Software Engineering Units
- Engineering Behavior Models

#### Software Engineering Units

SEU is commissioned to achieve one or more software engineering objectives.

#### Engineering Behavior Models

a **Behaviour Model** chapter that defines the taxonomy of behavioural rules contributed by Packs. That taxonomy will make the Composition Engine much more rigorous and will give every Pack a common language for contributing behaviour. I don't think it's a blocker for continuing, but I do think it's an important piece of the implementation model that deserves explicit treatment rather than being left implicit.
The EBM answers **what** governs an SEU.

## Engineering Behavior Model 

An **Engineering Behaviour Model** would be the immutable, versioned result of composing all applicable Packs for an SEU. It would become the single configuration consumed by the Runtime Kernel, Execution Engine and Governance services.

This would have several advantages:

- The Runtime Kernel consumes one configuration rather than many Packs.
- Historical engineering execution becomes perfectly reproducible by referencing the EBM version.
- Configuration changes become explicit lifecycle events.
- Rollback becomes straightforward by reverting to a previous EBM.

## Runtime Services *Is this the execution model?*

**"How the SEU is operated"**—covering runtime services such as state management, eventing, execution planning, observability, notifications, integrations and operational management.

- Execution Engine
- Dispatch Engine
- Participants
- Commands
- Work Items

#### Work Items
Work Items are simply one mechanism for changing the state of a Deliverable.

# 2. Platform domain

The SEU platform should be viewed as comprising two distinct parts:


## Stable Platform Core

Implementation of the Software Practice primitives
Composition Engine
Runtime Kernel 
SEU Design Kit

### Runtime Kernel

|Runtime Service|Responsibility|
|---|---|
|**State Management**|Owns authoritative engineering state.|
|**Event Model**|Publishes engineering facts.|
|**Execution Engine**|Decides what engineering action should occur next.|
|**Work Item Generator**|Produces participant-specific execution instructions.|
|**Dispatch Engine**|Assigns work to suitable Participants.|
|**Attention Management**|Determines where human or AI attention is required.|
|**Engineering Telemetry**|Measures engineering health and flow.|
|**External Interaction Model**|Manages all interactions beyond the Runtime Kernel boundary.|
|**SEU Lifecycle Management**|Manages the operational existence of Software Engineering Units.|

#### State Management
(Part of platform core)
workflow engines focus on **process state**
platform focuses on **engineering state**
It becomes the **authoritative runtime state model**. A Transition Definition becomes the **runtime contract** for changing engineering state of engineering objects.

#### ## Composition Engine


[Remarks:

The EBM answers **what** governs an SEU.

Composition Engine answers **how** the EBM is created.

This chapter should **not** describe Pack internals. It describes the orchestration that transforms Packs into an executable Engineering Behavior Model.

This is the **compiler** of the platform.

The Composition Engine takes:

- Packs
- Templates
- Behavioural contributions,
- Governance,
- Engineering constraints
- Other definitions

and produces an executable **Engineering Behavior Model**.

Just as modern compilers produce diagnostics (warnings, errors and informational messages), the Composition Engine should produce a **Composition Report** as a first-class artefact.

The report should include:

- Packs used and their versions.
- Resolved dependencies.
- Automatic conflict resolutions.
- Conflicts requiring manual intervention.
- Warnings (for example, recommended packs not installed).
- Effective behavioural summary.
- Traceability matrix from Pack → Behaviour → EBM.

This report would be invaluable for governance, audits and debugging why a particular SEU behaves the way it does. I think it should become a permanent artefact attached to every commissioned SEU, alongside its Engineering Behavior Model. It also reinforces the platform's principle that behaviour is not only composable but fully explainable and traceable.
]



### SEU Design Kit

## 1. Packs 
Packs form an useful extensibility mechanism and behave as the **primary unit of platform evolution**.

Packs are a way to 
    - customise engineering practices


- Platform vendor publishes Platform Packs.
- Industry bodies publish Domain Packs (e.g. healthcare, banking, automotive).
- Consulting firms publish Organisation Packs.
- Technology vendors publish Technology Packs.
- Enterprises publish internal Packs.
- Open-source communities publish reusable Packs.


Packs are built using the SEU Design Kit.

Pack SDK is not merely a development tool—it is the **ecosystem enablement layer**.

the primary classification (Platform, Organisation, Domain, Technology, Customer, etc.).
- **Pack Capabilities** – the architectural components the Pack contributes.



This gives the Composition Engine a richer understanding of what each Pack provides without forcing artificial categorisation. It also makes the SDK more future-proof because new contribution types can be added without inventing new Pack types.

2. Templates
3. Profiles

### Composition engine
 

|Concept|Responsibility|
|---|---|
|**Template**|Defines the structural blueprint of the SEU.|
|**Profile**|Defines how that blueprint is commissioned for a specific context.|
|**Pack**|Contributes behaviour, knowledge, governance, integrations and other engineering assets.|
|**Engineering Behavior Model (EBM)**|Represents the fully composed behavioural specification that governs the commissioned SEU.|

These concepts are deliberately independent. A single Template can be commissioned using many Profiles. A Profile can select different Packs over time. The Composition Engine synthesises a new EBM whenever those inputs change.

I believe we've now completed the conceptual model required to commission an SEU. The next chapter should therefore shift from static definitions to **dynamic behaviour**:
]
## Evolving Knowledge
|**Pack**|Contributes behaviour, knowledge, governance, integrations and other engineering assets.|

Most future innovation will occur by publishing new Packs rather than releasing new versions of the platform itself.

Engineering Packs
Organisation Packs
Customer Packs
Domain Packs
Technology Packs
Capability Packs
Templates
Policies 
Profiles
 

# 3. Infrastructure layer

Adapters to:

- LLMs
- Gits
- Hyperservices
- Ticketing systems
- SAP/CRM systems 

# 4. Cross-cutting concerns:
 
## Trust pipeline

### Traceability

While writing this chapter, I realised that we've actually defined something much richer than traditional traceability.

Traditional Application Lifecycle Management (ALM) tools treat traceability as **links**:

- Requirement → Design → Code → Test.

The platform treats traceability as an **engineering graph**.

Every persistent object becomes a node in that graph.

Relationships themselves become governed engineering objects with identity, provenance and lifecycle.
Every persistent object and every relationship forms part of a single connected engineering graph.

## Security Architecture

In the SEU platform, **security protects the platform**, while **governance protects the engineering process**. They complement each other but remain architecturally independent.

> **Everything is explicitly trusted. Nothing is implicitly trusted.**


|Concern|Question|Architectural Component|
|---|---|---|
|**Platform Security**|_May this entity access the platform or invoke this API?_|Security Architecture|
|**Engineering Governance**|_May this entity approve or perform this engineering state transition?_|Authority Model|


Platform security:

- Authentication
- Authorisation
- Encryption
- Secrets
- Network security

Engineering Authority governs permission to perform engineering state transitions:

- Governance
- Authority
- Policies
- Evidence
- Traceability
- External Interaction
- Packs

## Versioning Strategy

Objects in our architecture that are versioned:

- Engineering Behavior Models
- Packs
- Profiles
- Templates
- Policies
- Authority Rules
- Reviews
- Quality Gates
- Ontologies
- Decisions
- Deliverables 





- Multi-tenancy
- Scalability
- Reliability and Recovery
- Configuration Management
- Plugin & Pack SDK
- AI Provider Abstraction
- Reference Architecture
- Deployment Topologies

















## Engineering telemetry

Answers the question "What is the health and behaviour of engineering itself?" Is the **SEU healthy**?

Jira, Azure DevOps and similar tools because they measure **activities**, while we measure **engineering flow**.

**time is not the primary constraint in an AI-first engineering organisation**. Dependencies are.


Traditional project management asks:

- Are we on schedule?
- How many tasks are complete?
- How many hours were spent?
- What percentage is finished?

The SEU should ask different questions:

- Where is engineering flow constrained?
- Which Deliverables are waiting, and why?
- Which Quality Gates create the most friction?
- Which Decisions are repeatedly reused?
- Which Obligations most frequently block progress?
- Which Organisation Packs consistently introduce delays?
- Which Engineering Behavior Models produce the best outcomes?

Differentiator: In an AI-native SEU, elapsed time and individual utilisation are secondary effects. The primary objective is maintaining uninterrupted engineering flow through the dependency graph. This aligns the platform with systems thinking and the Theory of Constraints, making bottlenecks explicit and optimisable without relying on traditional project management metrics.

Engineering Telemetry measures **engineering execution**.

It would include:

- SEU health
- Deliverable flow
- Dependency bottlenecks
- Participant utilisation
- Command throughput
- Work Item latency
- Governance latency
- Review cycle time
- Knowledge growth
- Evidence generation
- Decision turnaround

In other words, the platform doesn't merely monitor infrastructure—it measures the behaviour and effectiveness of software engineering itself. I think that is a much more distinctive and valuable architectural concept than a conventional observability


## Why "Attention Management"?

An SEU should not notify people because something happened.

It should notify Participants or users **because attention is required**.

Those are very different things.

For example:

A build completed.

**Event?**

Yes.

**Attention required?**

No.

---

A security review failed.

**Event?**

Yes.

**Attention required?**

Yes.

---

A Deliverable became executable.

**Event?**

Yes.

**Attention required?**

Perhaps not.

The Execution Engine can automatically continue.

---

Customer approval required.

**Event?**

Yes.

**Attention required?**

Absolutely.

---

A concept that is more appropriate for an AI-native engineering platform than "notifications."

A notification is a **delivery mechanism**.

Attention is a **decision**.

That's a much more powerful abstraction.

For example, if a test suite fails:

- The Event Model records that the failure occurred.
- The Execution Engine determines whether execution can continue.
- The Governance Model determines whether the failure blocks a state transition.
- The Dispatch Engine may assign remediation work automatically.
- **Only if human intervention is actually required does the Attention Engine create an Attention Item.**

This has an important consequence: the platform should strive for **zero unnecessary human interruptions**. Human attention becomes a scarce engineering resource that is allocated deliberately, just as CPU time is allocated by an operating system.


## Dispatch Engine


In traditional software delivery, there are three questions:

- **What should be done?** (Planning)
- **Who should do it?** (Assignment)
- **When should it be done?** (Scheduling)

In the SEU architecture, those become:

- **Execution Engine** → _What should happen next?_
- **Dispatcher** → _Who is the best Participant right now?_
- **Dependency Engine** → _When can it happen?_

Dependencies are the primary constraint. Time is only a consequence.


|Runtime Service|Question Answered|
|---|---|
|**Execution Engine**|_What engineering action should happen next?_|
|**Work Item Generator**|_How should this Command be expressed for a specific type of Participant?_|
|**Dispatch Engine**|_Who should execute this Work Item now?_|
|**Participant**|_How do I actually perform this engineering activity?_|
|**Runtime Kernel**|_How is execution managed, observed and recorded?_|

This separation gives us a very clean pipeline:

```
Engineering State
        │
        ▼
Execution Engine
        │
     Command
        │
        ▼
Work Item Generator
        │
    Work Item
        │
        ▼
Dispatch Engine
        │
 Participant Assignment
        │
        ▼
Participant Execution
        │
        ▼
State Transition
        │
        ▼
Event
```

- **Capability Fulfilment** answers: _which Participants are eligible to provide this Capability at all?_ This is a comparatively slow-moving, structural concern. It changes when a Participant is onboarded, retired, upgraded or reassigned, not on every unit of work.
- **Dispatch** answers: _given that eligible pool, who should execute this specific Work Item right now?_ This is a fast, per-Work-Item runtime decision, sensitive to load, availability, cost and context.

Collapsing both into one service would force a single component to do slow-changing eligibility bookkeeping and fast-changing per-item selection at the same time, which is exactly the kind of mixed responsibility this architecture has consistently avoided elsewhere (compare Governance vs Authority, or Review vs Quality Gate).


- **Capability Fulfilment (Ch. 12)** remains the service of record for **which Participants are eligible** to fulfil a given Capability, and for maintaining that eligibility as Participants change.
- **Dispatch Engine (this chapter)** consumes Capability Fulfilment's eligible-Participant output as one of its dispatch inputs (see §7) and performs the final, per-Work-Item selection among eligible Participants using dispatch strategies (cost, load, locality, and so on).

Capability Fulfilment is therefore upstream of Dispatch, not a duplicate of it.

## Work Items

*[Remarks: What is the relationship between **Deliverables** and **Work Items**? Deliverables are the primary concept and Work Items subordinate to them because it aligns with the dependency-driven execution model. 

The key question is:
> **Should Deliverables be the fundamental unit of execution, or should they simply be outcomes produced by Work Items?**

**Deliverables should remain primary**. Software engineering ultimately exists to produce engineering artefacts and outcomes. Work Items are transient execution steps, whereas Deliverables become part of the enduring engineering knowledge of the SEU. If we accept that, then the Dependency Engine naturally operates on Deliverables, and Work Items become implementation mechanics rather than the centre of the execution model. This is more consistent with the knowledge-first philosophy.
]*

Work Items are not engineering objects. They are **execution artefacts**.

A Deliverable exists because the business needs it.

A Command exists because the Runtime Kernel wants something done.

A Work Item exists only because a particular Participant needs instructions for carrying out that Command.

After execution completes, the Work Item has served its purpose.

Different Participants may receive different Work Items for the same Command.

Traditional ALM systems treat **Work Items** as the primary object:

- Jira Issues
- Azure DevOps Work Items
- GitHub Issues
- Rally Stories

Everything revolves around them.

In this architecture, Work Items become almost disposable.

The real engineering assets are:

- Deliverables
- Knowledge
- Evidence
- Decisions
- Obligations

Work Items merely help Participants contribute to those assets.

Four different runtime concepts

|Concept|Purpose|Lifetime|
|---|---|---|
|**Command**|Expresses engineering intent.|Transient|
|**Work Item**|Expresses participant-specific execution instructions.|Transient|
|**Event**|Records that something happened.|Permanent|
|**State Transition**|Changes authoritative engineering state.|Permanent|

In a human organisation, scheduling dominates because people are scarce and time is the primary constraint.

In an AI-first SEU, scheduling is often trivial—many AI Participants can execute immediately and in parallel. The more interesting runtime decision is **dispatching**: selecting the most appropriate Participant (or Participants), considering capabilities, cost, latency, specialisation, confidence, workload, locality, or organisational policy.

## Execution Engine

Execution Engine responsibilities:

- listens to Events
- evaluates Dependencies
- evaluates Transition Definitions
- requests Capability Fulfilment
- generates transient Work Items
- issues Commands

|Runtime Service|Responsibility|
|---|---|
|**Runtime Kernel**|Provides generic platform infrastructure (state, events, scheduling, persistence, integrations).|
|**Execution Engine**|Interprets engineering state and decides what engineering actions should be requested next.|


**Execution Engine becomes the only runtime component that "understands" engineering execution, and even then, it does so by interpreting declarative models rather than embedding engineering logic in code.**

The Execution Engine should **never create Work Items directly**.

Instead, it should generate **Commands**. A separate service can then translate those Commands into transient execution plans (Work Items) appropriate for the assigned Participant.

That keeps planning separate from execution. It also allows different Participant types—AI models, humans or external systems—to receive different execution plans while responding to the same engineering Command.

## Event Model 

The platform is fundamentally **event-driven**.

State changes produce events.

Events cause evaluations.

Evaluations produce new state transitions.

|Concept|Meaning|
|---|---|
|**Command**|A request to perform an engineering action.|
|**Transition Definition**|The declarative contract describing how a state transition may occur.|
|**State Transition**|The successful change of an engineering object's authoritative state.|
|**Event**|The immutable fact that the transition has occurred.|

**Engineering truth belongs to the Runtime Kernel**, not to individual Participants.


## Reference Architecture Chapter 45 specifies the general architecture. 



The SEU Platform  provides universal engineering services:

- Engineering State
- Engineering Execution
- Engineering Governance
- Engineering Knowledge
- Engineering Traceability
- Engineering Continuity
- Engineering Extensibility

Everything else is supplied declaratively through the Engineering Behavior Model.

Almost every subsystem follows the same lifecycle:

```
Define
    ↓
Validate
    ↓
Compose
    ↓
Activate
    ↓
Execute
    ↓
Observe
    ↓
Evolve
```

You can apply it to:

- Packs
- Policies
- Profiles
- Templates
- Engineering Behavior Models
- SEUs
- Runtime Services

This isn't accidental. It is the **universal lifecycle** of the platform.


## Deployment

- What is an SEU?
- How does it execute?
- How is it governed?
- How is it hosted?
- How is it extended?
- How is it secured?
- How is it versioned?
- How is it multi-tenant?

How is the platform physically deployed?


The platform should run:

- on a laptop,
- in an enterprise data centre,
- in Kubernetes,
- in a sovereign cloud,
- in an air-gapped defence environment,
- as a SaaS platform.

Deployment should therefore be **topology-independent**.

That becomes the architectural objective.

**Three independent configuration domains**:

|Configuration|Purpose|Changes when…|
|---|---|---|
|**Engineering Behavior Model (EEC)**|Defines _how the SEU behaves_.|Packs or engineering practices change.|
|**Tenant Configuration**|Defines _who owns and administers the environment_.|Administrative structure changes.|
|**Deployment Configuration**|Defines _where and how the platform runs_.|Infrastructure changes.|

These three should never be coupled.

For example:

- Moving from Azure to an on-premises data centre changes only the **Deployment Configuration**.
- Updating the TCS Engineering Practices Pack changes only the **EEC**.
- Creating a new customer workspace changes only the **Tenant Configuration**.

This separation dramatically reduces operational risk because infrastructure evolution, administrative evolution and engineering evolution become independent activities.

## Multi-tenancy


Three different ownership concepts throughout the platform:

|Concept|Responsibility|
|---|---|
|**Administrative Ownership**|Who administers the platform resources (Tenant/Workspace).|
|**Engineering Ownership**|Which SEU is responsible for an engineering object.|
|**Business Ownership**|Which external business entity ultimately owns the business outcome or product.|

These three ownership dimensions often coincide in small organisations, but diverge significantly in large programmes involving suppliers, customers and partners. Keeping them separate will avoid overloading a single "owner" concept and will make the platform more adaptable to complex delivery models.

## Governance

**Governance is not a gatekeeper—it is a decision service**.

Traditional governance is often perceived as something that _blocks_ engineering progress until a committee or reviewer grants permission. In the SEU, governance should instead answer a deterministic question:

> **"Given the current engineering state, is this transition permissible?"**

That subtle shift is important.

It means governance becomes a **pure evaluation layer**. It examines the current Deliverable state, applicable policies, active obligations, required evidence, authority assignments and Engineering Behavior Model, then produces a decision. It does not perform the transition itself; it authorises or constrains it.

This aligns perfectly with another architectural pattern we've established throughout the platform:

- The **Dependency Engine** evaluates readiness but does not execute.
- The **Capability Fulfilment Service** assigns capabilities but does not perform engineering work.
- The **Governance Model** evaluates permissibility but does not execute state transitions.

That consistent separation of **evaluation** from **execution** is becoming one of the defining characteristics of the platform's architecture. I think it will make the system easier to reason about, easier to test and significantly more extensible as new Packs and governance models are introduced.

------------ 

|Concept|Responsibility|
|---|---|
|**Engineering Behavior Model**|Defines how engineering is performed.|
|**Policy**|Defines what constraints apply.|
|**Authority**|Defines who may authorise governed actions.|
|**Obligation**|Defines outstanding engineering commitments.|
|**Governance**|Evaluates whether a requested state transition is permissible.|

Each concept answers a different question:

- **EBM:** _How should this be done?_
- **Policy:** _What constraints must be respected?_
- **Authority:** _Who may approve or perform this action?_
- **Obligation:** _What commitments remain outstanding?_
- **Governance:** _May this state transition occur now?_


## Quality Gate model

(Quality Gate unifies four traditionally-separate gate concepts the same way; Obligation unifies four traditionally-separate commitment concepts the same way).

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

- the source state;
- the target state;
- applicable Quality Gates;
- required Authority;
- applicable Policies;
- required Reviews;
- required Evidence;
- required Obligations.

In other words, the transition itself becomes a first-class architectural object. That idea would unify the state models we've created across the platform and eliminate duplicated governance logic. I suspect it will become an important architectural concept when we later define the Runtime Kernel and state management.


## Review Model 

A Review is not about people examining documents.

A Review is:

> **A governed engineering evaluation that determines whether an engineering object is fit to transition to its next state.**

- A **Review** is an evaluation activity.
- A **Finding** is an observation produced by that evaluation.
- An **Obligation** is a governed commitment created in response to an accepted Finding (or from another source).
- **Governance** determines whether the existence of Findings or unresolved Obligations prevents a state transition.



This creates a clean engineering chain:

```
Review

↓

Finding

↓

Obligation

↓

Resolution

↓

Verification

↓

Governance Evaluation

↓

State Transition
```

Not every Finding needs to become an Obligation, and not every Obligation originates from a Review.


A Finding has its own lifecycle. It can be:

- discussed,
- challenged,
- accepted,
- converted into an Obligation,
- resolved,
- verified,
- reopened.

## Obligations

**Obligations** are to Governance what **Deliverables** are to Execution.

They are the objects that governance continuously manages.

Most engineering tools fragment these concerns:

- Risks live in a risk register.
- Audit findings live in an audit tool.
- Technical debt lives in Jira.
- Security vulnerabilities live in another system.
- Compliance actions live in spreadsheets.
- Customer action items live in email.

Architecturally, they're all the same thing:

> **An outstanding engineering commitment that influences delivery.**

That's exactly what an Obligation is.

I think we can go one step further.

We should distinguish between **Obligation** and **Resolution**.

An Obligation is a persistent governance object.

A Resolution is simply one possible outcome that satisfies its completion criteria.

For example:

- A security vulnerability (Obligation) may be resolved by changing code, applying a configuration, replacing a dependency, or formally accepting the risk.
- A customer clarification (Obligation) may be resolved by receiving an answer, changing requirements, or withdrawing the feature.
- A technical debt item (Obligation) may be resolved by refactoring, redesigning, or consciously deferring it with an approved waiver.

This distinction is powerful because it prevents the platform from assuming there is only one way to satisfy an engineering commitment. The **Engineering Behavior Model**, **Policies** and **Authority Model** determine which resolution paths are acceptable, while the Obligation remains the stable governance object throughout its lifecycle.

I think this chapter also reinforces a broader architectural pattern that has emerged repeatedly:

- **Deliverables** represent engineering outcomes.
- **Knowledge** represents engineering understanding.
- **Evidence** represents engineering confidence.
- **Decisions** represent engineering judgement.
- **Obligations** represent engineering commitments.

Together, these five persistent object types form the core information model of the SEU. I suspect almost every future capability in the platform will revolve around one or more of them.

-------------

One more source of Obligations is worth naming explicitly, because without it the platform only ever measures organisational learning, never acts on it. Book 1 treats Continuous Organisational Learning as an active process: accumulated Knowledge and Evidence feed back into actually improving a Capability, not just accumulating telemetry about it. Engineering Telemetry (Chapter 35) already computes exactly the right signals — Knowledge growth, Decision reuse, recurring rework — but nothing consumed them.

I don't think that needs a new persistent object. It's the same shape as everything else in this chapter: an outstanding commitment, with an owner, a priority, and completion criteria. When Telemetry detects a sustained pattern — the same architectural decision independently reached across many Deliverables, a Service chronically missing its declared Service Level, a Policy repeatedly waived — that's an outstanding engineering commitment to *improve* something, and it belongs here as an **Organisational Learning** Obligation, resolved by publishing a revised Capability, Service or Policy through the existing Pack lifecycle. That closes the loop using machinery this book has already fully specified: Telemetry raises the Obligation, the Pack SDK and Composition Engine resolve it, and the next Engineering Behavior Model is measurably improved. Nothing new to build except the connection.

## Authority

Authority is the  **permission to perform a governed state transition**.

That includes approvals, but also many other actions:

- transition a Deliverable from **Under Review → Approved**;
- create or close an Obligation;
- waive a Quality Gate;
- supersede a Decision;
- activate a new Engineering Behavior Model;
- commission or decommission an SEU.

In other words, authority should attach to **transitions**, not to objects.

This fits beautifully with the state-centric architecture we've developed:

- Deliverables evolve through states.
- Decisions evolve through states.
- Knowledge evolves through states.
- Obligations evolve through states.
- Governance evaluates state transitions.
- **Authority authorises state transitions.**

I think this is a stronger and more general model than traditional RACI matrices.

In fact, I now see RACI as **one possible implementation** of an Authority Pack rather than as the architectural foundation itself. An Organisation Pack could implement a RACI-based authority model, while another organisation might use a policy-based or risk-based model, and both would fit naturally into the same platform architecture. That flexibility is exactly what we wanted when we introduced composable Authority Packs.


## Traceability


Traceability is the **thread that connects every persistent object** in the platform.

Without it:

- the Trust Pipeline breaks,
- explainability disappears,
- governance becomes impossible,
- knowledge reuse becomes unreliable.

I would therefore make Traceability the final chapter of the Knowledge section.

----------------




# Decision Model
[Sudha: I think we're now at the chapter that completes the **Trust Pipeline**.

We have defined:

- Information (implicitly)
- Evidence
- Knowledge
- Ontology

The next persistent concept is **Decision**.

Originally, I thought Decisions belonged in Governance.

I now think that's incorrect.

A Decision is first and foremost a **knowledge object**.

Governance determines **who may approve a decision**.

The Decision Model defines **what a decision is**.

That's a much cleaner separation.

-------------------

While writing this chapter, I realised we've completed something much larger than a Decision Model.

We've actually defined the **engineering reasoning model** of the platform.

Every significant engineering outcome now follows a consistent progression:

```
Observation

↓

Information

↓

Evidence

↓

Knowledge

↓

Decision

↓

Deliverable State Transition
```

This has an important implication.

A Decision should never simply record **what** was decided.

It should record **why the platform was justified in deciding it**.

That means the Decision Model becomes the platform's primary explainability mechanism. When an auditor, engineer or future SEU asks:

> "Why was this architecture chosen?"

the answer is not merely the approved Decision. It is the entire chain:

- the observations that triggered the question;
- the information gathered;
- the evidence validated;
- the knowledge applied;
- the alternatives considered;
- the engineering context at that point in time.

In other words, **the Decision becomes the explainable conclusion of the Trust Pipeline**.

I think this is one of the strongest architectural ideas in the platform because it transforms explainability from a feature of AI models into a property of the engineering process itself. That distinction will make the platform resilient to future changes in AI technologies while preserving engineering accountability.
]



## Evidence  

The **trust pipeline** of the platform.

While writing this chapter, I realised we've identified a chain that runs through almost every architectural concept we've created:

```
Information

↓

Evidence

↓

Knowledge

↓

Decision

↓

Deliverable State Transition
```

Every stage increases confidence:

- **Information** is raw and unvalidated.
- **Evidence** is validated and attributable.
- **Knowledge** is accepted and reusable.
- **Decisions** apply Knowledge to a specific context.
- **Deliverable State Transitions** occur only after sufficient evidence and approved decisions.

It gives the platform a powerful explainability model: every significant engineering outcome can be traced back through the decisions made, the knowledge applied, the evidence supporting that knowledge, and ultimately the original information from which the evidence was derived.

This provides deterministic explainability, auditability and traceability for all engineering outcomes, while ensuring that confidence is built progressively rather than assumed. It also gives future AI reasoning services a principled basis for explaining _why_ a recommendation or state transition occurred.


## Knowledge 

The platform exists to produce software today. But it exists to preserve engineering knowledge forever.

Knowledge is the information that has been validated and accepted for reuse.|
 
That means Wisdom is **computed**, not stored.

This distinction is important because it prevents the platform from trying to preserve every engineering decision as a universal truth. Instead, it preserves the underlying Knowledge and allows future SEUs to apply that Knowledge differently depending on their context.

It also opens the door to future reasoning services that can explain _why_ a recommendation was made, based on the Knowledge available at that point in time, rather than simply replaying past decisions. I suspect this distinction between Information, Knowledge and Wisdom will become a recurring theme in the remaining chapters on Evidence, Decisions and the Knowledge Graph.

 
### Engineering Colloboration 

The architecture is centred on engineering artefacts rather than conversational interactions. 

In traditional software development, much of the team's shared understanding lives in conversations—meetings, chats, emails, and hallway discussions. Those conversations are difficult to audit, hard to reuse, and often disappear when people leave.

The SEU should be different. Its shared understanding should reside in explicit engineering artefacts: deliverables, knowledge, decisions, evidence, obligations and events. Participants interact with those artefacts rather than with each other directly.

I would add one refinement that will influence later chapters:

> **A Participant should not "ask another Participant to do something."**

Instead, it should **publish an engineering intent**.

For example:

- "Architecture Specification Approved."
- "Security Review Required."
- "Performance Evidence Missing."

The Runtime Kernel, together with the Dependency Engine and Capability Fulfilment service, determines what happens next. This keeps Participants decoupled and ensures that engineering flow is governed by the platform rather than by ad hoc interactions between runtime entities.

I believe this is another defining characteristic of the platform. It shifts collaboration from **conversation-driven** to **state-driven**, making the SEU more deterministic, auditable and resilient.

## Participant

 
- Roles are design-time concepts.
- Capabilities are engineering concepts.
- Behaviour comes from the EBM.
- **Participants are runtime entities.**

That means a Participant is not simply an "AI Agent". It is the **runtime identity** that fulfils capabilities within an SEU.


---------------
 


---

## Capability fulfilment

|Concept|Responsibility|
|---|---|
|**Capability**|Defines _what engineering competency is required_.|
|**Participant Type**|Defines the kind of entity capable of fulfilling competencies (AI, Human, External).|
|**Participant Instance**|Represents the runtime entity commissioned within an SEU.|

This separation gives the platform remarkable flexibility. For example, the **Development Capability** could be fulfilled today by an AI coding participant, tomorrow by a human engineer, and later by a coordinated swarm of specialised AI participants—all without changing the Capability Model or the Engineering Behavior Model.

In traditional software engineering:

> Recruit people → assign work.

In an SEU:

> Identify required capabilities → fulfil them → assign execution.

That's a major architectural shift.

-----------------

**Execution chain** 

The SEU Studio has a layered execution chain that is quite different from traditional project management systems:

```
Objective

↓

Deliverables

↓

Dependencies

↓

Capabilities

↓

Capability Fulfilment

↓

Participants

↓

Work Items

↓

Execution
```

Notice what is **absent** from this chain:

- Tasks
- Resource allocation
- Project schedules
- Team staffing

Those concepts have been replaced by more fundamental abstractions.

One refinement I'd suggest before we move on is that we should reserve the term **Participant** for _runtime instances_ only.
The abstraction for a participant is a role. 

Templates define structure, the EBM defines behaviour, Capabilities define competencies, and runtime instances execute within the commissioned SEU.
 
--- 


#### Dependency engine

**Dependency Engine** decides **what engineering outcome becomes achievable next**.


The **Dependency Engine** should not decide **how** to satisfy a dependency. It should only determine **whether** the dependency has been satisfied.

For example:

- It should determine that an architecture decision is required.
- It should not decide what the architecture should be.
- It should determine that a security review is outstanding.
- It should not perform the security review.
- It should determine that a capability is required.
- It should not decide whether that capability is fulfilled by an AI participant, a human expert or an external service.

This reinforces a principle that has been emerging throughout the architecture:

> **Evaluation and execution are separate responsibilities.**

The Dependency Engine evaluates engineering state. Other components act upon that evaluation. Maintaining that separation will keep the architecture modular, testable and extensible as the platform evolves..
