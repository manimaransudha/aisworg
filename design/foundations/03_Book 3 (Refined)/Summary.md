# Summary on the demo

The platform is overwhelmingly **declarative**. Packs declare behaviour, policies declare constraints, authority declares permissions, obligations declare commitments, and the Runtime Kernel interprets those declarations. This declarative-first architecture should make the platform significantly easier to extend and customise without modifying its core.

--------------


SEU does not perform software engineering. It provides services that make software engineering possible. It is much closer to an **operating system kernel**.


1. Engineering concepts/layer:

- the engineering model
- the execution model
- the knowledge model
- the governance model

SEU platform  **the software platform** that hosts all of this.


## Persistent Engineering Objects

- Software Engineering Units
- Deliverables
- Decisions
- Knowledge
- Evidence
- Obligations
- Participants
- Capabilities
- Services
- Objectives
- Engineering Behavior Models

## Governance primitives

- Authority
- Policies
- Reviews
- Findings
- Obligations
- Quality Gates
- Compliance

## Runtime Services

**"How the SEU is operated"**—covering runtime services such as state management, eventing, execution planning, observability, notifications, integrations and operational management.

- Execution Engine
- Dispatch Engine
- Participants
- Commands
- Work Items

2. Platform layer/concepts

The SEU platform should be viewed as comprising two distinct parts:


## Stable Platform Core

Runtime Kernel (orchestrator of engineering mode, execution model, knowledge model, governance model)
Core Information Model
Composition Engine
Pack SDK
Runtime Kernel


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

## Evolving Knowledge

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
 

3. Infrastructure layer

Adapters to:

- LLMs
- Gits
- Hyperservices
- Ticketing systems
- SAP/CRM systems 

4. Cross-cutting concerns:

- Security Architecture
- Multi-tenancy
- Scalability
- Reliability and Recovery
- Configuration Management
- Versioning Strategy
- Plugin & Pack SDK
- AI Provider Abstraction
- Reference Architecture
- Deployment Topologies

First 37 chapters + Checklist - what the platform is (Logical Architecture)
Part 6 - How is the platform built (Implementation Architecture)

Implementation Architecture:
- Build the engineering primitives
- Platform itself can evolve without constantly rewriting itself
    - Core Platform
    - Evolving Platform Knowledge

## Packs 
Packs form an useful extensibility mechanism and behave as the **primary unit of platform evolution**.

Packs are a way to 
    - customise engineering practices


- Platform vendor publishes Platform Packs.
- Industry bodies publish Domain Packs (e.g. healthcare, banking, automotive).
- Consulting firms publish Organisation Packs.
- Technology vendors publish Technology Packs.
- Enterprises publish internal Packs.
- Open-source communities publish reusable Packs.


Packs are built using the Software Development Kit.

Pack SDK is not merely a development tool—it is the **ecosystem enablement layer**.

the primary classification (Platform, Organisation, Domain, Technology, Customer, etc.).
- **Pack Capabilities** – the architectural components the Pack contributes.

This gives the Composition Engine a richer understanding of what each Pack provides without forcing artificial categorisation. It also makes the SDK more future-proof because new contribution types can be added without inventing new Pack types.


## Engineering Behavior Model 

An **Engineering Behaviour Model** would be the immutable, versioned result of composing all applicable Packs for an SEU. It would become the single configuration consumed by the Runtime Kernel, Execution Engine and Governance services.

This would have several advantages:

- The Runtime Kernel consumes one configuration rather than many Packs.
- Historical engineering execution becomes perfectly reproducible by referencing the EBM version.
- Configuration changes become explicit lifecycle events.
- Rollback becomes straightforward by reverting to a previous EBM.


## Security

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


## Versioning

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


## State Management
(Part of platform core)
workflow engines focus on **process state**
platform focuses on **engineering state**
It becomes the **authoritative runtime state model**. A Transition Definition becomes the **runtime contract** for changing engineering state of engineering objects.

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

**"Authority to approve"** is too narrow. Authority should instead be modelled as **permission to perform a governed state transition**.

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

While writing this chapter, I realised that we've actually defined something much richer than traditional traceability.

Traditional Application Lifecycle Management (ALM) tools treat traceability as **links**:

- Requirement → Design → Code → Test.

Your platform treats traceability as an **engineering graph**.

Every persistent object we've introduced—

- Templates,
- Profiles,
- Packs,
- Engineering Behavior Models,
- Deliverables,
- Knowledge,
- Evidence,
- Decisions,
- Ontology Concepts,
- Obligations—

becomes a node in that graph.

Relationships themselves become governed engineering objects with identity, provenance and lifecycle.

I think this has a profound implication.

The platform's primary datastore should probably not be thought of as "documents" or "records". Conceptually, it is an **Engineering Knowledge Graph**.

That doesn't mean we must implement it using a graph database such as Neo4j. That's an implementation decision. But architecturally, every persistent object and every relationship forms part of a single connected engineering graph.


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


## Ontology Model


[Remarks: Ontology is **the language of the SEU**. It becomes the semantic foundation of the entire platform.

Without it:

- AI Participants use different terminology.
- Organisation Packs introduce conflicting jargon.
- Domain Packs redefine concepts.
- Knowledge becomes ambiguous.
- Evidence becomes difficult to relate.
- Deliverables lose semantic consistency.

Every persistent object that is defined like

- Deliverables
- Knowledge
- Evidence
- Decisions
- Obligations
- Capabilities
- Engineering Behavior Model

should reference **concepts**, not free-text terminology.

This has a profound benefit for the multi-organisation scenario.

Suppose:

- TCS uses "Technical Design".
- IBM uses "Solution Design".
- Cigna uses "Architecture Specification".

Each Organisation Pack contributes its preferred terminology. The Ontology maps all three terms to a single semantic concept. Participants can therefore reason consistently without forcing organisations to abandon their own vocabulary.

This makes the Ontology the **semantic integration layer** of the platform. Just as the Composition Engine integrates behaviour from Packs, the Ontology integrates meaning from Packs. Together, they allow multiple organisations to collaborate within a single SEU while preserving both semantic consistency and organisational identity. This is one of the distinguishing architectural innovations of the platform.
]

## Evidence (17)

[Sudha: In the architecture we've developed, we repeatedly state:

> **Knowledge must be supported by Evidence.**

But we've never formally defined what Evidence is.

In fact, I now think Evidence is the **currency of trust** within the entire platform.

Nothing should become Knowledge.

Nothing should become Accepted.

Nothing should move a Deliverable to Approved.

Nothing should close an Obligation.

...without Evidence.

That makes Evidence one of the core architectural concepts.



---------------

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

This isn't just a sequence—it is the **trust pipeline** of the platform.

Every stage increases confidence:

- **Information** is raw and unvalidated.
- **Evidence** is validated and attributable.
- **Knowledge** is accepted and reusable.
- **Decisions** apply Knowledge to a specific context.
- **Deliverable State Transitions** occur only after sufficient evidence and approved decisions.

I think this trust pipeline deserves to become an explicit architectural principle because it governs how the platform establishes confidence. It also gives the platform a powerful explainability model: every significant engineering outcome can be traced back through the decisions made, the knowledge applied, the evidence supporting that knowledge, and ultimately the original information from which the evidence was derived.

I'd recommend capturing this as an ADR:

> **ADR – Trust Pipeline**

**Decision:** Significant engineering state transitions shall be justified through a trust pipeline of Information → Evidence → Knowledge → Decision → Deliverable State Transition.

**Rationale:** This provides deterministic explainability, auditability and traceability for all engineering outcomes, while ensuring that confidence is built progressively rather than assumed. It also gives future AI reasoning services a principled basis for explaining _why_ a recommendation or state transition occurred.
]

---

## Knowledge 

[Sudha: Because we've just made Work Items **ephemeral**, the next persistent concept is no longer Work Items.

It's **Knowledge**.

In fact, I now think Knowledge is the **second most important object** in the platform after Deliverables.

The platform exists to produce software today.

But it exists to preserve engineering knowledge forever.

That was one of the original themes of Book 1.

So I think we should now begin the Knowledge section.

----------------

While writing this chapter, I realised we've been using the word **Knowledge** rather loosely throughout both Book 1 and Book 3.

I think we now need to distinguish three different concepts that are often conflated:

|Concept|Meaning|
|---|---|
|**Information**|Raw engineering data or observations.|
|**Knowledge**|Information that has been validated and accepted for reuse.|
|**Wisdom**|Engineering judgement applied to a specific context.|

The platform should permanently store **Information** and **Knowledge**, but **Wisdom** is different. Wisdom is contextual. It is the application of Knowledge, the current Engineering Behavior Model, the active Deliverables, Dependencies, Obligations and Objectives to make an engineering decision.

That means Wisdom is **computed**, not stored.

This distinction is important because it prevents the platform from trying to preserve every engineering decision as a universal truth. Instead, it preserves the underlying Knowledge and allows future SEUs to apply that Knowledge differently depending on their context.

I think this is a very AI-native way of thinking about organisational learning. It also opens the door to future reasoning services that can explain _why_ a recommendation was made, based on the Knowledge available at that point in time, rather than simply replaying past decisions. I suspect this distinction between Information, Knowledge and Wisdom will become a recurring theme in the remaining chapters on Evidence, Decisions and the Knowledge Graph.

And where does this all fit into the engineering capital definition. 

]

## Deliverable

[Sudha: I think we're now ready for what is arguably **the heart of the runtime**.

Notice what we've built so far:

- SEU
- EBM
- Packs
- Profiles
- Dependency Engine
- Capabilities
- Participants
- Collaboration

There is still one thing missing.

> **How does engineering work actually happen?**

Interestingly, I no longer think the answer is "Work Items".

I think the answer is:

> **Deliverables evolve through states.**

Work Items are simply one mechanism for changing the state of a Deliverable.

This is a subtle but extremely important shift.

It means the runtime is no longer work-centric.

It is **state-centric**.

----------

While writing this chapter, I realised we've finally uncovered the true runtime model of the platform.

Originally, we thought the runtime revolved around **Work Items**. Then we shifted to **Dependencies**. I now think both are supporting concepts.

The actual runtime revolves around **state transitions of Deliverables**.

The execution loop now looks like this:

```
Deliverable State

↓

Dependency Evaluation

↓

Capability Requirement

↓

Capability Fulfilment

↓

Participant Execution

↓

Evidence

↓

Governance

↓

Deliverable State Transition
```

This is fundamentally different from traditional workflow engines, which execute predefined sequences of tasks. In this architecture, **the state of the Deliverable drives execution**, and everything else exists to enable or validate that state transition.

I think this has an important consequence for the remaining chapters.

**Work Items should no longer be modelled as persistent business objects.**

Instead, they should be treated as **ephemeral execution plans** generated on demand to move a Deliverable from one state to the next. They are analogous to an execution plan generated by a database query optimiser: useful while executing, but not the primary object of the system.

If we adopt that principle, the remainder of the platform becomes even cleaner:

- Deliverables are persistent.
- Knowledge is persistent.
- Decisions are persistent.
- Evidence is persistent.
- Obligations are persistent.
- Participants are transient.
- **Work Items are transient.**

I think that is the logical conclusion of the architecture we've been building, and it distinguishes the platform from virtually every existing software engineering and project management system.

]

## Engineering colloboration


[Sudha: I actually want to make one change before continuing.

The commentary at the end of the previous chapter raised a question:

> Should Participants communicate directly?

I think the answer is **No.**

And I think this is much more important than it first appears.

It affects the entire architecture.

---

### I think we've been subconsciously thinking like humans

Human software teams work like this:

```
Developer

↓

Talks to Architect

↓

Talks to Tester

↓

Talks to DBA

↓

Talks to Product Owner
```

Lots of communication.

Lots of meetings.

Lots of chat.

---

An SEU shouldn't work like that.

It should work much closer to an operating system.

A Participant doesn't ask another Participant:

> "Have you finished?"

Instead it asks the platform:

> "Which Deliverable is ready?"

-----------------

I think this chapter captures a deeper architectural idea than simply "how agents talk."

It says that **the SEU itself is the collaboration medium**.

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
]
---

## Participant



[Sudha: I think we're now at one of the most important chapters in the entire book.

Interestingly, this chapter is **not** about AI.

It is about **identity**.

One thing has become clear over the last few chapters:

- Roles are design-time concepts.
- Capabilities are engineering concepts.
- Behaviour comes from the EBM.
- Participants are runtime entities.

That means a Participant is not simply an "AI Agent". It is the **runtime identity** that fulfils capabilities within an SEU.

I also think we should avoid calling them "Agents" throughout the platform. "Agent" is an implementation. "Participant" is an architectural concept.

---------------


While writing this chapter, I think we've identified another architectural distinction that is worth preserving.

The platform currently has three concepts that are often conflated in existing AI systems:

|Concept|Responsibility|
|---|---|
|**Capability**|Defines _what engineering competency is required_.|
|**Participant Type**|Defines the kind of entity capable of fulfilling competencies (AI, Human, External).|
|**Participant Instance**|Represents the runtime entity commissioned within an SEU.|

This separation gives the platform remarkable flexibility. For example, the **Development Capability** could be fulfilled today by an AI coding participant, tomorrow by a human engineer, and later by a coordinated swarm of specialised AI participants—all without changing the Capability Model or the Engineering Behavior Model.

One refinement I'd suggest before we continue is to think about whether a Participant Instance should expose **services** to other Participants, or whether all inter-participant interaction should occur through Deliverables, Knowledge, Events and the Runtime Kernel. My inclination is the latter, because it avoids creating tightly coupled participant-to-participant dependencies and keeps the architecture centred on engineering artefacts rather than conversational interactions. That question will naturally lead us into the next chapter on collaboration and execution.
]

---

## Capability fulfilment

I think the next chapter should **not** be Participants.

There's an important concept between Capabilities and Participants that we've referred to several times but never formally defined.

That concept is **Capability Fulfilment**.

Remember the ADR we created:

> **The platform commissions capabilities, not participants.**

That ADR deserves its own chapter because it fundamentally changes how software teams are assembled.

In traditional software engineering:

> Recruit people → assign work.

In an SEU:

> Identify required capabilities → fulfil them → assign execution.

That's a major architectural shift.

-----------------

While writing this chapter, I realised we've established a layered execution chain that is quite different from traditional project management systems:

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

For example:

- "AI Architect" is not a Participant.
- It is a **Participant Type**.

When an SEU commissions an actual AI Architect, it creates a **Participant Instance** with its own identity, lifecycle, memory bindings, capabilities and execution history.

The same applies to humans:

- "Senior Developer" is a Participant Type.
- "Priya assigned to SEU-042" is a Participant Instance.

Making that distinction will give us a much cleaner Participant Model in the next chapter, because we'll be modelling runtime entities rather than abstract roles or job titles. I think that's consistent with the rest of the architecture, where Templates define structure, the EBM defines behaviour, Capabilities define competencies, and runtime instances execute within the commissioned SEU.


---
## Service

[Sudha:
This chapter fills the largest actual gap the Book 1 comparison turned up. Book 1 gives Service full peer status alongside Objective and Capability — its own narrative chapter, its own formal chapter, and a central role in the Capability Reasoning Network as one of four things Capabilities exchange with one another (Service, Evidence, Knowledge, Decision). Book 3 had nothing. Not a chapter, not an entity, not a line in the Canonical Information Model.

The placement question resolved itself once I looked at where Capability (Chapter 10) and Capability Packs (Chapter 5) already sit. Book 1 says it precisely: "a capability is an enduring ability; a service is what that ability actually delivers." A Capability Pack that declares a Capability without also declaring what that Capability contracts to deliver is only telling half the story. So Service is declared alongside Capability, by the same Pack, as the natural second half of a Capability's declaration — not a separate concern bolted on afterward.

I want to be careful about scope here, because it would be easy to let Service become too much. Two guardrails:

First, Service is not the sole coordination mechanism between Capabilities. Book 1's own Capability Reasoning Network chapter is explicit that Evidence, Knowledge and Decision propagate independently of Service, and warns directly against "treating every interaction as a service call." Service gets exactly one job here: it's the concrete, contracted unit that sharpens what the Dependency Engine's existing "Capability Dependency" type (Chapter 9) actually means — not "Architecture Capability is available" in the abstract, but "the Approved Solution Architecture service has been delivered," specifically.

Second, Service is not a metrics database. It declares a Service Level — a target, part of its own versioned definition — but the *observed* performance against that target is Engineering Telemetry's job (Chapter 35), derived from Service's own events, never written back onto the Service object itself. That keeps faith with Telemetry's own stated principles: passive, derived, no duplicate data entry. Service defines what's measurable about it; it doesn't measure itself.
]

---

## Capability

[Sudha: this chapter captures one of the most significant departures from traditional software engineering platforms.

While writing it, I realised we've arrived at what I believe is one of the platform's defining architectural separations:

|Concept|Responsibility|
|---|---|
|**Engineering Behavior Model (EBM)**|Defines **how** engineering should be performed.|
|**Capability**|Defines **what engineering competency** is required.|
|**Participant**|Provides the competency.|
|**Work Item**|Applies the competency to advance a Deliverable.|

These four concepts are orthogonal. They should never be collapsed into one another.

For example, a **Developer Participant** doesn't "own" the Development Capability. It merely fulfils it for a period of time. Tomorrow, another AI model, a human engineer, or an external autonomous service could fulfil exactly the same Capability without changing the SEU.

I think that's a stronger and more durable abstraction than today's agent frameworks, which often equate an "agent" with a fixed role and a fixed set of skills. Here, **Capabilities are permanent, Participants are transient**, and the platform composes them dynamically to satisfy engineering objectives. That separation will make the platform significantly more adaptable over time.
]

---

## Dependency engine


[Sudha: 
we've reached the point where **Part I is complete**.

Let's check:

- ✅ SEU
- ✅ Engineering Behavior Model
- ✅ Composition Engine
- ✅ Pack Model
- ✅ Template Model
- ✅ Profile Model
- ✅ SEU Commissioning

There is one thing that is still missing before an SEU starts working.

It is something we have deliberately postponed because we kept discovering better abstractions.

Originally we called it:

- AI Project Manager
- AI Orchestrator
- Scheduler
- Dependency Manager
- Flow Engine

I now think we know exactly what it is.

It is **the Dependency Engine**.

Not because it schedules work.

Because it decides **what engineering outcome becomes achievable next**.

]
---


[Sudha: This chapter captures one of the most significant departures from traditional software engineering platforms.

However, while writing it, I realised there's an important distinction we should preserve going forward.

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

The Dependency Engine evaluates engineering state. Other components act upon that evaluation. Maintaining that separation will keep the architecture modular, testable and extensible as the platform evolves. I think it's worth capturing this as another ADR because it clearly delineates responsibilities between orchestration and execution.]

---

## Profile


[Sudha: I think this is exactly the right point to introduce **Profiles**.

Notice what we've built so far:

```
SEU
        ▲
        │
EBM
        ▲
        │
Composition Engine
        ▲
        │
Packs
        ▲
        │
Templates
```

The missing piece is:

> **How do we instantiate the same Template differently for different situations?**

That is precisely the purpose of a **Profile**.

I also think we've finally converged on the correct definition of a Profile. Earlier, we had several different ideas about Profiles. I think we can now define it very precisely.

------------------

While writing this chapter, I realised we have now established four orthogonal concepts that form the heart of the commissioning process:

|Concept|Responsibility|
|---|---|
|**Template**|Defines the structural blueprint of the SEU.|
|**Profile**|Defines how that blueprint is commissioned for a specific context.|
|**Pack**|Contributes behaviour, knowledge, governance, integrations and other engineering assets.|
|**Engineering Behavior Model (EBM)**|Represents the fully composed behavioural specification that governs the commissioned SEU.|

These concepts are deliberately independent. A single Template can be commissioned using many Profiles. A Profile can select different Packs over time. The Composition Engine synthesises a new EBM whenever those inputs change.

I believe we've now completed the conceptual model required to commission an SEU. The next chapter should therefore shift from static definitions to **dynamic behaviour**:
]

---

## Template


[Sudha: 

I also think we've now finished the **architectural backbone**.

From this point onwards, we're specifying the objects that an SEU is composed of.

The next chapter should **not** be Templates.

I changed my mind after thinking about the last four chapters.

The sequence should be:

```
Architecture Catalogue

↓

SEU

↓

Engineering Behavior Model

↓

Composition Engine

↓

Pack Model

↓

Template Model

↓

Commissioning
```

Why?

Because **Templates** are the missing abstraction between Packs and a commissioned SEU.

A Pack contributes behaviour.

A Template defines **what kind of SEU you want to create**.

For example,

```
Enterprise Web Application

↓

Template

↓

Composition Engine

↓

EBM

↓

SEU
```

Without Templates, the Composition Engine doesn't know **what** it is composing for.

--------------------


While writing this chapter, I realised we need to be careful not to overload the Template concept.

At the moment, the Template is carrying three responsibilities:

1. **Structural blueprint** (SEU shape).
2. **Initial engineering artefacts** (deliverables, capabilities, lifecycle).
3. **Commissioning defaults** (mandatory/recommended packs, parameters).

I think (1) and (2) unquestionably belong in a Template. I'm less certain about (3).

There is another concept we discussed earlier but haven't formally introduced: the **Profile**.

I now think we should redefine Profiles.

Instead of using Profiles for engineering behaviour (which the EBM now covers), Profiles should become **commissioning configurations**.

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

]
---

## Packs 


[Remarks: **Packs are the unit of evolution**. Every future enhancement should ideally be introduced as a Pack rather than by modifying the Runtime Kernel.

> **A Pack is not a plugin; it is a declarative engineering contribution.**

Traditional plugin systems primarily contribute executable code. In contrast, Packs contribute **engineering behaviour, knowledge and intent**. The Runtime Kernel and runtime services interpret those declarations to produce the desired behaviour.

This distinction has profound implications. It means a Pack can be reasoned about, validated, composed, audited and even generated by an AI without executing arbitrary code. That makes Packs explainable, traceable and governable—properties that are essential for an AI-driven software engineering platform.
]

Important Differentiator — Executable Contributions and Verification Classification

Supplement to the Pack Model. This section records how verifiable Pack contributions are made executable in an AI-native platform. It changes none of the requirements above; it refines how the §9 contributions that are checked (Checklists, Quality Gates, Review Gates, Obligations) are defined and executed. It reuses the platform's existing governance, authority, Quality Gate, Review Model and attestation. No Runtime Kernel change.

### 20.1 Principle: a verifiable contribution carries its own execution
Traditionally a checklist or standard is text a human is trusted to apply. In an AI-native platform a verifiable contribution carries not only the standard but the means to execute it, because the executor is an AI participant. The same artifact is then three things at once: the human-readable standard, the composable governance contribution, and the executable instruction. A checklist item becomes executable simply by being written, given a capable participant, with no bespoke verifier code.

The platform does not perform the check. It declares it, assigns it to a participant, records the outcome as Evidence or a Review bound to the commit, gates the transition, and attests who certified it. Where the participant runs, in the platform environment or the tenant environment, is a contract and access decision, not an architectural one.

### 20.2 What a verifiable contribution declares
Every verifiable item (a checklist item, a quality-gate criterion, a review requirement, an obligation) declares:

Statement — the standard, human-readable ("No hardcoded passwords").
Classification — machine-verifiable, judgment, or human-attested (§19.3).
Prompt — the instruction the AI participant executes, for the AI-executed classes ("Refer to the VCS reference. Verify there are no hardcoded passwords or secrets. Report Passed or Failed with notes.").
Participant assignment — an AI participant, an AI participant paired with a human, or a human authority.
Output contract — the shape the platform consumes: Passed/Failed plus notes, or an assessment plus a human acceptance.
Assurance policy (optional) — a confidence or severity threshold at which the result escalates to a human, reusing Attention and Review.
This is metadata on the contribution, part of the Pack definition. It needs no new engine.

### 20.3 Verification classifications
The axis is who or what can authoritatively determine Pass/Fail, and who is accountable.

1. Machine-verifiable. An objective result determinable from the artifact by an AI participant, which may invoke a tool. The AI participant is accountable for the reported result. Output: Passed/Failed plus notes, no human in the loop.
Examples: no hardcoded passwords, no PII in logs, tests present and passing, dependencies scanned, coverage above threshold, naming convention followed.

2. Judgment (AI-assessed, human-ratified). A contextual or subjective determination. The AI participant analyses the references and produces a reasoned assessment; a human participant accepts it. The human is accountable, and separation of duties holds because the assessing participant is not the approving one. This maps directly onto the built Review Model: the AI produces the Review, the human moves it to Accepted, and the requires_accepted_review gate consumes it.
Examples: the architecture is appropriate for the requirement, the API design is coherent, the failure handling is adequate for the risk.

3. Human-attested (authority act). The check is an authoritative human or organisational act that cannot be derived from the artifact, so an AI can neither verify it nor meaningfully advise on it. A designated authority attests, and that recorded act is the evidence. Common in Compliance and Governance contributions.
Examples: customer sign-off obtained, legal approval received, regulatory submission accepted, budget sponsor approved.

### 20.4 Are two classifications sufficient?
Machine-verifiable and Judgment are the correct primary split, but they are not complete. Both assume the answer comes from analysing the artifact. Some real checks are not artifact analysis at all; they are an authority's act, such as a customer signature or a regulator's acceptance. Forcing those into Judgment would wrongly imply an AI can assess them, when the only thing that counts is the recorded human or organisational decision. Hence the recommended third class, Human-attested.

One further case is best handled as a variant, not a new class. External evidence is a result supplied by an external system of record rather than by reading the artifact: a CI pipeline green, a deployment succeeded, an external vendor's penetration test passed, a ticket approved in an external tool. Treat this as Machine-verifiable with the verifier being an Integration-pack connector rather than direct artifact analysis. It is still an objective, automatable Pass/Fail; only the source of truth differs. Surface it as a separate tag if Integration packs need it explicit, but it does not warrant a fourth top-level classification.

Recommendation: three classifications, Machine-verifiable, Judgment, Human-attested, with an optional external-evidence marker on machine-verifiable items.

### 20.5 Mapping the contribution categories
Classification applies to the contributions that are checked. The rest inform or provide, and are not classified.

Contribution (§9)	Typical classification
Checklists	per item; span all three
Quality Gates	mostly machine-verifiable
Review Gates	judgment (AI-assessed, human-ratified) by nature
Obligation Definitions	machine-verifiable (evidence present) or human-attested (approval obtained)
Policies / Standards / Decision Rules	machine-verifiable where objective, judgment where interpretive
Ontology, Knowledge Assets, Templates, UI Components, Services, Metrics	not classified — inputs and assets, not checks
By Pack taxonomy (§6), the weight differs:

Technology packs — mostly machine-verifiable (conventions, build, test).
Compliance packs — a mix of machine-verifiable (evidence present) and human-attested (approvals, sign-offs).
Domain and architecture concerns — largely judgment.
Integration packs — external-evidence (machine-verifiable via connectors).
Platform and Organisation packs — spread across all three.
19.6 Reuse of existing machinery
Nothing here adds an engine. Each classification lands on what is already built:

Machine-verifiable → the AI participant's Passed/Failed is Evidence; the Quality Gate consumes it; the notes are attested against the commit.
Judgment → the Review Model (Phase 14): the AI produces the Review, a human accepts, requires_accepted_review gates the transition.
Human-attested → an authority-gated Obligation or Review whose acceptance is the attested act.
The only work is a classification pass over each Pack's verifiable contributions: mark each item's classification, write its prompt, and set its participant assignment and output contract, all recorded in the Pack definition.

### 20.7 Packaging pattern: master pack, classified sub-packs, and graduation
A checklist concern is packaged as a master checklist Pack that declares Required dependencies (§10) on two sub-Packs: a machine-verifiable Pack and a judgment Pack. Packs do not nest; the Composition Engine pulls the master and both sub-Packs into the EBM through dependency resolution. Consumers depend on the master, which is the concern's public unit. The split beneath it is an authoring and evolution concern, not something a commissioning tenant needs to see.

Rationale. The two sub-Packs change differently and are curated by different owners. The machine-verifiable Pack is a prompt-and-tool asset, refined through prompt engineering and tool integration. The judgment Pack is an assessment-rubric asset, curated by domain expertise. Separating them gives each its own version line (PM-003) and a single coherent responsibility (PM-001), so one can be tuned or released without churning the other. The master restores the whole topic at composition. The factoring axis is therefore lifecycle and ownership, with the master providing the topical view.

Graduation. An item may move from judgment to machine-verifiable as prompts and tools mature. This is a version-governed move, not a silent reclassification: the item leaves the judgment Pack in one version increment and enters the machine-verifiable Pack in another. Because every EBM records the exact Pack versions it composed (§12), SEUs commissioned before the graduation remain reproducible with the item still classified as judgment, while new SEUs receive the automated form. The innovation pathway is thus auditable and non-destructive.

Learning loop. Graduation candidates need not be guessed. Engineering Telemetry (Ch.35) can detect judgment items whose AI assessment consistently agrees with the human sign-off and raise an Organisational Learning Obligation (Architecture Catalogue ADR – Telemetry-Driven Organisational Learning) proposing that the item graduate into the machine-verifiable Pack. The classified-sub-Pack structure gives that signal a clean destination, making "judgment to machine-verifiable" a measured maturity path rather than a manual judgement.

Discipline. The split axis is classification only, two sub-Packs per master. The master remains the unit consumers depend on. Tenants should not depend on the sub-Packs directly, or the aggregation benefit is lost and Packs proliferate.


## My  notes. 
[Sudha: You're right, and this is the crux. Let me concede the core point plainly, because it's the important one: if every actual check is handed to an external participant and the platform only requires-and-records, then the differentiation over Jira-plus-audit-trail is thin. "An external participant verifies and it comes back" does just push the question — the real "how" happens somewhere the platform can't see. That's coordination, not execution.

So here is the line I think is actually correct, and it's a refinement of "execution is external", not a contradiction:

The platform does not execute the tenant's production work (building the source code). But it should execute its own declared standards, and that is a first-party capability — platform-associated AI agents run the checklists. The organisation outsources building. It does not outsource checking its own standards. Those checklists are the organisation's own asset (Pack contributions); the organisation should have the competence to run them.

That distinction is the whole "executable" claim. And it terminates the regress you're pointing at, if you extend the Pack one step further:

A checklist item declares its own verifier. "No hardcoded passwords" in the Pack isn't just English — it carries verifier: platform secret-scan agent. So when the Source Code transition is attempted:

the platform's own verification agent pulls the commit from VCS, runs the secret scan against the diff, and produces the pass/fail + findings itself;
that result is the evidence — the platform generated it, not an outside party;
the quality gate consumes it and the transition proceeds or blocks.
Now the "how" bottoms out inside the organisation: the org's agent read the code and ran the check. No external participant, no "and then magic happens." That is "Packs are declarative" taken to its conclusion — the checklist item carries its own executable check, composed into the SEU, run by the org's agent. That is the thing Jira cannot do: Jira shows you a checkbox and trusts your tick; the executable org runs the checklist itself and produces the evidence.

One honest refinement to "all checklists by an AI agent", and it's a real caveat, not a hedge: checklist items split into two kinds.

Machine-verifiable — "no hardcoded passwords", "dependencies scanned", "tests present and passing", "no PII in logs". A platform agent runs these autonomously and deterministically. This is where your point is fully right, and it should be the default. The org checks itself.
Judgment — "the architecture is sound for this scale", "the API design is coherent". An AI agent can execute these too, but as reasoned opinion, not deterministic verification. Here the agent produces an assessment, and an accountable party (a human, or the agent itself as an accountable participant the org has chosen to trust) signs. The competence is still exercised; it just isn't a true/false scan.
So: yes, make checklist execution a first-party, platform-agent capability, verifier declared per item, machine-verifiable items run autonomously by the org's agents. That is the executable differentiation. Judgment items are agent-executed-as-advice with an accountable sign-off, not left to "someone external verifies somehow."

The one thing to be clear-eyed about, because it changes what the platform is: this means the platform ships competence, not only governance. A verification-agent runtime becomes part of the platform, first-party. That's a real expansion beyond the strict "the platform never executes anything" — and it's exactly the expansion that earns "AI-native" and "executable". The earlier boundary was "don't run the tenant's production agents." The sharper boundary is: the platform runs the organisation's own checks; it does not run the tenant's production build. Production stays orchestrator-agnostic and external. Verification of declared standards comes home.

That's the differentiation you're reaching for, and I think it's correct: an executable organisation is one that can perform its own governance, not merely demand it.

I am going to broaden this. It does not matter whether the checklist execution happens on the platform or on the tenants environment. that is just defined by the contract between the platform and the tenant and an access question.  The competencies required to do this is "just a prompt" not any heavy code strcuture. The AI participant is going to execute it - Dont you think so ?
Yes. And you've just corrected two things I over-committed, both correctly.

First: location is a contract/access question, not architecture. I drew a line — "verification comes home to the platform, production stays external" — that doesn't hold up. Whether the checking AI runs in the platform's environment or the tenant's is a hosting/access/data-residency decision negotiated in the contract, exactly the "execution environment is a per-tenant choice" we already settled for participants. A verification agent is just another participant. So there's no architectural "first-party verifier" requirement. Drop it. It's a deployment detail.

Second, and this is the real point: the competency is "just a prompt." This collapses a distinction the whole industry still treats as fundamental. In the pre-AI world, to make "No hardcoded passwords" executable you had to build a verifier — a scanner, a rules engine, bespoke code per check. In the AI-native world the checklist item's text is the executable instruction, and a general AI participant is the universal executor. You don't build a verifier; you write the standard, and a capable participant runs it. Declarative and executable stop being two things. They're the same artifact, because the executor is an LLM, not a rules engine.

That is the differentiation, stated properly — sharper than how I had it:

A checklist item is simultaneously the standard (human-readable), the governance contribution (a composable Pack asset), and the executable instruction (an AI participant runs it). One artifact, three identities.

Jira has only the first. It shows dead text and trusts a human tick. The executable organisation has all three, and it gets the third for free the moment the executor is a competent AI participant — no per-check engineering, no verifier code in the platform. Write "No hardcoded passwords," and the org can run it. Write "No PII in logs" tomorrow, and the org can run that too, same day, no build. That is what "executable" should mean, and you're right that without it this is a governance skin over Jira.

Now the honest part, so this isn't superficial agreement: "just a prompt" nails the competency, but it moves the entire hard problem to a different place — and that place is the platform's actual job.

If any check is one prompt away from executable, then the risk is no longer "did we build the scanner." It's: which participant ran it, how capable/trustworthy is it, and does its "pass" mean anything? A weak agent will cheerfully report "no hardcoded passwords" and miss one. So the platform's engineering is not verifiers. It's governing the prompt-executing participants:

Authority — which AI participant (which badge) is permitted to certify which checklist. The coding agent cannot also be the checking agent (creator ≠ approver), even when both are "just a prompt."
Assurance level per item — some checks the org accepts on the agent's word; high-stakes ones require the agent to invoke a deterministic tool, or require a second participant, or a human co-sign. That threshold is declared with the checklist item, alongside the prompt.
Attestation — the outcome is bound to the commit and to the certifying agent, permanently, so "the org verified no hardcoded passwords" has a name and an artifact behind it, not just a green tick.
Escalation — a failed or low-confidence result raises Attention, doesn't silently pass.
So the shape is: the checklist item carries its prompt and its assurance policy; an AI participant executes the prompt wherever the contract puts it; the platform governs who may certify, binds the result to the commit, and enforces the transition. The platform ships no verifiers and no heavy code for the checks. It ships the thing that makes a field of prompt-executed checks trustworthy and accountable at organisational scale.

That's the whole game, and I think your instinct is exactly right: the competence is a prompt, the executor is an AI participant, the location is a contract term — and the platform's differentiation is that it turns a written standard into an executed, attributed, gated organisational act, automatically, because the executor is intelligent rather than hand-coded.

You are again overthinking. We already have the governnance and wuthority defined. So all we need is refine the packs definition. We have to review each category and differentiate between what i machine verifiable vs what needs human participant. This coule be part of the pack definition itself.

So the "No hardcoded passwords" checklist would be assigned to an AI particpiant with a prompt "Refer to VCS. Verify that there are no hardcoded passwords. Report Passed or Failed with notes....." etc. 

A checklist item which is abstract like "Ensure architecture is correct for the requirement"  will be AI participant summarising the details looking at whatever is given t it as a reference and the respose will be judgemental" paired with a human participant. 

Do you think this is correct ?
Yes. This is correct, and it's correctly scoped — it's a Pack-definition refinement, not new engine work. The governance, authority, quality gates, Review Model, and attestation already exist. You're just adding metadata to each checklist item and letting it ride on machinery that's already built.

The per-item shape you're describing is basically:

classification: machine-verifiable | judgment
prompt: the instruction ("Refer to VCS, verify no hardcoded passwords, report Passed/Failed with notes")
participant assignment: AI alone, or AI paired with a human
output contract: Passed | Failed + notes
And each classification drops onto an existing gate with no new mechanism:

Machine-verifiable → the AI participant runs the prompt, returns Passed/Failed + notes. Passed/Failed is the gate signal (Evidence / quality gate); the notes become the attested evidence bound to the commit. Done, no human.
Judgment → this is the Review Model you already built (Phase 14). The AI participant looks at the references, produces the summary/assessment — that's the Review content — and the human participant accepts it. The AI advises, the human's acceptance is the accountable sign-off, and creator ≠ approver still holds (the AI drafts, the human certifies). The requires_accepted_review gate consumes it exactly as it does today.
So the "AI + human pairing" isn't a new construct — it's an AI participant generating a Review and a human participant accepting it. The machine-verifiable case is an AI participant generating Evidence. Both already have homes.

The only actual work is the part you named: a classification pass over each Pack category — go item by item, mark it machine-verifiable or judgment, write the prompt, set the participant assignment — and it becomes part of the Pack definition. No kernel change, no new engine. That's the whole thing, and it's right.]

## Composition Engine


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

## EBM

[Sudha: I think this chapter is a solid first version, but while writing it I noticed one concept that I deliberately did **not** define because I think it deserves its own chapter.

We keep referring to **Behavioural Rules**, but we haven't answered:

> **What is a Behaviour?**

That may sound philosophical, but I think it's actually a modelling question.

For example, is:

- "Every merge requires two reviewers."

a Behaviour?

Or is it a **Constraint**?

Is:

- "Use GitFlow."

a Behaviour?

Or is it a **Workflow**?

Is:

- "Validate all inputs."

a Behaviour?

Or is it a **Policy**?

I don't think we should answer that in this chapter because it would make it too broad. Instead, I think Book 3 should later introduce a **Behaviour Model** chapter that defines the taxonomy of behavioural rules contributed by Packs. That taxonomy will make the Composition Engine much more rigorous and will give every Pack a common language for contributing behaviour. I don't think it's a blocker for continuing, but I do think it's an important piece of the implementation model that deserves explicit treatment rather than being left implicit.
The EBM answers **what** governs an SEU.
]


## 
[Remarks: What is the relationship between **Deliverables** and **Work Items**? Deliverables are the primary concept and Work Items subordinate to them because it aligns with the dependency-driven execution model. 

The key question is:
> **Should Deliverables be the fundamental unit of execution, or should they simply be outcomes produced by Work Items?**

**Deliverables should remain primary**. Software engineering ultimately exists to produce engineering artefacts and outcomes. Work Items are transient execution steps, whereas Deliverables become part of the enduring engineering knowledge of the SEU. If we accept that, then the Dependency Engine naturally operates on Deliverables, and Work Items become implementation mechanics rather than the centre of the execution model. This is more consistent with the knowledge-first philosophy.
]

---

## Objective


[Remarks:
- SEU chapter says an SEU is "commissioned to achieve one or more software engineering objectives." 
- Templates imply a set of required Capabilities. 
- Profiles configure a commissioning. But nothing says where that initial list of required Capabilities actually comes from. 
- Somewhere, something has to decide *why* this SEU is being commissioned and *what it must be able to do* before Template Model can validate anything or the Composition Engine can compose anything. Objective is that something.

- which Template fits, which Capabilities get composed, which Packs get pulled in is answerable *from* an Objective.

— an Objective is *why*, not *how much by when* (that's a Goal), not *what property the system must have* (a Requirement), and not *the approach chosen to pursue it* (a Strategy). That distinction is worth preserving exactly, because it's what stops Objective from becoming a dumping ground for everything upstream of engineering work. An Objective says why an SEU exists. It does not say how the SEU will get there — that's Template, Profile and Pack composition's job, downstream.

- Objective should not declare or allow derivation of required Capabilities, but it should not itself pick a Template or compose Packs. 
- Objective's job ends at "here is what must be achieved, and here is what ability that requires" — it hands off from there.
]
 

## Ontology through packs 

Pack Categories
Template Categories
Dependency types
Deliverable categories
Knowledge categories
Evidence categories
Decision categories
Relationship types (traceability)
Obligation categories 
Policy categories
Review categories
Quality Gate categories
Event categories
Attention categories
Interaction categories
