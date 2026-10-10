# SEU Studio — Logical Architecture

The logical architecture of SEU Studio is explained in this document. 

Source of truth: `design/foundations/03_Book 3 (Refined)/`.

## 1. Purpose

SEU Studio commissions and operates Software Engineering Units (SEUs) that has both human and AI agent participants. The platform organizes software engineering around Software Engineering Units rather than around people, AI agents, schedules, or tasks. It composes engineering knowledge, governance, and practice into an executable behavioural model. It executes delivery through dependency-driven orchestration. It preserves knowledge, governance, and traceability.

SEU Studio is organized around four domains: 
- Software Practice defines the primitives needed to carry out engineering work
- SEU Platform provides the stable core and extensibility mechanism that implements those primitives
- Integration connects the platform to other common services 
- Cross-Cutting Concerns covers aspects that run through every domain

## 2. Software Practice Domain

The Software Practice domain groups its primitives into four broad sets: Engineering, Governance, Information, and Execution primitives.

##### 2.1 Engineering Primitives

The Engineering primitives are the persistent objects required to define the engineering behaviour of a software engineering lifecycle. An Objective is the reason an SEU exists, stating what the SEU should achieve without describing how it will get there. A Deliverable is the primary unit of execution, and rather than being treated as a file, it is treated as a state that evolves through stages such as Draft, Reviewed, Approved, and Baselined; every runtime activity ultimately contributes to one or more Deliverables. A Capability defines what engineering competency is required, and it remains stable while the behaviour around it changes. A Service defines what a Capability actually delivers, and is declared alongside the Capability by the same Pack, forming the second half of that Capability's declaration. A Template is the structural blueprint of an SEU, carrying its initial Deliverables, Capabilities, and lifecycle shape, and answers the question of what kind of SEU is being built. A Profile configures a commissioning by deriving from a Template and supplying the mandatory and recommended Packs, parameters, and other variable inputs, answering the question of how that Template is commissioned for a given context; a single Template can be commissioned through many different Profiles. A Review is a governed engineering evaluation that determines whether an engineering object is fit to transition to its next state. A Participant is a runtime identity that fulfils Capabilities within an SEU: Roles belong to design time, Capabilities belong to the engineering model, behaviour comes from the Engineering Behavior Model, and Participants exist only at runtime.

##### 2.2 Governance Primitives

The Governance primitives define the governance associated with a software engineering lifecycle. Authority is the permission to perform a governed state transition, and it attaches to the transition itself rather than to the object undergoing it. A Policy is a declarative constraint on engineering behaviour. An Obligation is a persistent governance object representing an outstanding engineering commitment, and it may originate from a risk, an audit finding, a compliance finding, a customer observation, technical debt, or an organisational-learning signal; a Resolution is simply one outcome that satisfies an Obligation's completion criteria, and a single Obligation can admit several acceptable Resolution paths. A Quality Gate is a declarative engineering contract that must evaluate to true before a governed state transition may occur, and a checklist is merely one possible way of implementing it. Compliance expresses regulatory and standards requirements, such as HIPAA, SOX, or ISO, as behaviour. An Attention Item is created only when human or AI attention is actually required to proceed; an Event simply records that something happened, while an Attention Item records that a decision now requires intervention.

##### 2.3 Information Primitives

The Information primitives carry the platform's Trust Pipeline, which progresses from Information to Evidence to Knowledge to Decision to Deliverable State Transition, with each stage increasing confidence. A Finding is an observation produced by a Review, and it moves through its own lifecycle of being discussed, challenged, accepted, converted into an Obligation, resolved, verified, and sometimes reopened. Knowledge is information that has been validated and accepted for reuse, and it exists independently of any particular execution, remaining reusable across SEUs; Wisdom, by contrast, is computed from that Knowledge at the point of use rather than stored. Evidence is validated and attributable information that supports Knowledge. A Decision is a knowledge object rather than a governance object: it records not only what was decided but why the platform was justified in deciding it, including the observations, information, evidence, knowledge, and alternatives that were considered, while Governance separately determines who may approve that Decision.

##### 2.4 Execution Primitives

The Execution primitives bring together all the other primitives so that a software engineering lifecycle can actually be carried out. An SEU is commissioned to achieve one or more Objectives. The Engineering Behavior Model, or EBM, is the immutable, versioned result of composing all applicable Packs for an SEU, and it defines what governs that SEU, including its engineering, governance, decision, review, compliance, quality, and collaboration behaviour; intelligence, reasoning, coding ability, and language understanding remain properties of the Participant rather than of the EBM.

The platform's execution chain runs from Objective to Deliverables to Dependencies to readiness States to Capabilities to Capability Fulfilment to Participants to Work Items to Execution. Each layer in this chain carries a single responsibility: Objectives are strategic, Deliverables are contractual, Dependencies govern flow, States govern readiness, Capabilities determine what is needed, Work Items are generated dynamically, and Participants carry them out.

Four runtime concepts move through this chain with different lifetimes. A Command expresses engineering intent and is transient. A Work Item expresses participant-specific execution instructions for a Command and is also transient; it exists only because a given Participant needs instructions to carry out that Command, and different Participants may receive different Work Items for the same Command, so a Work Item is treated purely as an execution artefact that never appears in the Deliverable Dependency Graph. An Event records that something happened and is permanent. A State Transition changes authoritative engineering state and is also permanent.

A recurring pattern throughout the platform separates the service that evaluates an outcome from the mechanism that acts on it. The Dependency Engine determines whether a dependency is satisfied and therefore what becomes achievable next, while leaving how that dependency gets satisfied to other components. Capability Fulfilment determines which Participants are eligible to provide a given Capability, a comparatively slow-moving, structural concern that only changes when a Participant is onboarded, retired, upgraded, or reassigned. Dispatch then selects, from that eligible pool, who should execute a specific Work Item right now, a fast, per-Work-Item decision that is sensitive to load, availability, cost, and context; Capability Fulfilment is therefore upstream of Dispatch rather than a duplicate of it. The Execution Engine interprets engineering state and decides what engineering action should be requested next by interpreting declarative models, and it does so by generating Commands, leaving a separate service to translate those Commands into Work Items. Governance evaluates whether a requested state transition is permissible, leaving the transition itself to be carried out by another mechanism once it is permitted.

Dependencies, rather than schedules, govern execution, with time acting only as an influence on that execution rather than a determinant of it. The Deliverable Dependency Graph tracks readiness from one Deliverable to another, with each dependency conditioned on a Deliverable's state, so that, for example, Architecture depends on Requirements Specification having reached the state of Approved, rather than merely on a Requirements Specification existing at all.

Attention, in this architecture, is treated as a decision rather than as a delivery mechanism. An Event simply records that something happened, and an Attention Item is raised only when a decision requires intervention: the Event Model records the fact, the Execution Engine determines whether execution can continue, the Governance Model determines whether the fact blocks a transition, Dispatch may assign remediation automatically, and only when human intervention still remains necessary is an Attention Item actually raised. Human attention is treated throughout as a scarce resource that is allocated deliberately rather than triggered reflexively.

## 3. SEU Platform Domain

The SEU Platform comprises a Stable Platform Core together with an extensibility mechanism built on top of it.

The Runtime Kernel provides generic engineering-state, event, execution, dispatch, attention, telemetry, external-interaction, and SEU-lifecycle services, and it remains domain independent, holding no software-engineering knowledge of its own. The Composition Engine acts as the platform's compiler: it takes Packs, Templates, behavioural contributions, governance, and engineering constraints, and produces an executable Engineering Behavior Model by orchestrating the transformation of those Packs into that EBM; alongside every commissioned SEU it produces a permanent Composition Report recording the Packs used, the resolved dependencies, the automatic and manual conflict resolutions, any warnings, an effective behavioural summary, and a traceability matrix running from Pack to Behaviour to EBM. The SEU Design Kit is the ecosystem-enablement layer through which Packs, Templates, and Profiles are built.

Four concepts make up the platform's composition model, and they remain deliberately independent of one another. A Template defines the structural blueprint of the SEU. A Profile defines how that blueprint is commissioned for a specific context. A Pack contributes behaviour, knowledge, governance, integrations, and other engineering assets. The Engineering Behavior Model represents the fully composed behavioural specification that governs the commissioned SEU. Because these four remain independent, a single Template can be commissioned by many different Profiles, a Profile can select different Packs over time, and the Composition Engine synthesises a new EBM whenever any of these inputs changes.

Packs form the platform's extensibility mechanism and serve as its primary unit of evolution, so that most future innovation happens by publishing new Packs rather than by releasing new versions of the platform itself. Packs contribute behavioural rules rather than engineering practices as such, so that compliance, organisational, and technology concerns are each expressed as behaviour: a HIPAA requirement becomes a behavioural rule governing patient data, and an organisational standard becomes a behavioural rule requiring review before every merge. The platform vendor publishes Platform Packs, industry bodies publish Domain Packs, consulting firms publish Organisation Packs, technology vendors publish Technology Packs, enterprises publish their own internal Packs, and open-source communities publish reusable Packs, spanning the categories of Platform, Engineering, Organisation, Domain, Compliance, Technology, Integration, and Capability Packs.

## 4. Integration Domain

The Integration domain provides the adapters that connect the platform to external systems, including language models, source-code systems, hyperservices, ticketing systems, and enterprise systems such as SAP or CRM platforms. This domain marks the boundary across which the platform interacts with the world outside it.

## 5. Cross-Cutting Concerns Domain

The platform's Trust Pipeline runs from Information to Evidence to Knowledge to Decision to Deliverable State Transition, and every significant engineering outcome follows this progression, with a Deliverable State Transition occurring only after sufficient Evidence has accumulated and a Decision has been approved. This progression is itself the platform's explainability mechanism, since treating explainability as a property of the engineering process, rather than as a feature of any particular AI model, keeps it resilient as the underlying AI technology changes over time.

The platform treats traceability as an engineering graph rather than as a simple set of links such as Requirement to Design to Code to Test. Every persistent object becomes a node in that graph, and the relationships between them become governed engineering objects in their own right, carrying identity, provenance, and lifecycle, so that every persistent object and every relationship together form a single connected Engineering Knowledge Graph. This traceability connects every persistent object in the platform and underpins the Trust Pipeline, explainability, governance, and knowledge reuse.

Security protects the platform itself, while Governance protects the engineering process, and every entity is explicitly trusted rather than implicitly trusted. Platform Security asks whether a given entity may access the platform or invoke a given capability, and it is implemented through authentication, authorisation, encryption, secrets management, and network security. Engineering Governance asks whether a given entity may approve or perform a given engineering state transition, and it is implemented through the Authority Model, which is composed from Governance, Authority, Policies, Evidence, Traceability, External Interaction, and Packs.

Governance operates as a pure evaluation layer that answers a single question: given the current engineering state, is this transition permissible? It examines Deliverable state, applicable Policies, active Obligations, required Evidence, Authority assignments, and the EBM, and produces a decision, leaving the transition itself to be carried out by another mechanism once governance has permitted it. The Engineering Behavior Model answers how something should be done, a Policy answers what constraints must be respected, Authority answers who may approve or perform an action, an Obligation answers what commitments remain outstanding, and Governance answers whether a state transition may occur now. Every governed lifecycle transition, whether for a Deliverable, a Decision, a Knowledge Item, an Obligation, or an SEU itself, is specified by a Transition Definition naming its source state, target state, applicable Quality Gates, required Authority, applicable Policies, required Reviews, required Evidence, and required Obligations, which unifies governance logic across every state-bearing object in the platform.

Governance's mechanism runs as a chain from Review to Finding to Obligation to Resolution to Verification to Governance Evaluation to State Transition, though some Findings never become Obligations and some Obligations originate outside any Review. Across the platform, Deliverables represent engineering outcomes, Knowledge represents engineering understanding, Evidence represents engineering confidence, Decisions represent engineering judgement, and Obligations represent engineering commitments, and together these five persistent object types form the core information model of the SEU.

Accumulated Knowledge and Evidence are expected to feed back into actually improving a Capability, rather than merely accumulating as telemetry about it. When Engineering Telemetry detects a sustained pattern, such as the same architectural decision being independently reached across many Deliverables, a Service chronically missing its declared service level, or a Policy being repeatedly waived, that pattern itself constitutes an outstanding engineering commitment to improve something, and the platform raises it as an Organisational Learning Obligation, resolved by publishing a revised Capability, Service, or Policy through the existing Pack lifecycle. This closes the learning loop using the same Obligation and Pack-composition machinery the platform already defines elsewhere.

Engineering Telemetry answers the question of what the health and behaviour of engineering itself is, measuring engineering flow rather than activity such as tasks completed, hours spent, or percentage finished, because in an AI-first SEU elapsed time and individual utilisation are secondary effects while the primary objective is maintaining uninterrupted engineering flow through the dependency graph. Telemetry identifies where that flow is constrained, which Deliverables are waiting and why, which Quality Gates create the most friction, which Decisions are repeatedly reused, which Obligations most frequently block progress, which Packs introduce delay, and which EBMs produce the best outcomes.

Collaboration across the platform is state-driven rather than conversational: shared understanding resides in explicit engineering artefacts such as Deliverables, Knowledge, Decisions, Evidence, Obligations, and Events, and a Participant publishes an engineering intent, for example that an Architecture Specification has been approved or that a Security Review is required, rather than addressing another Participant directly. The Runtime Kernel, together with the Dependency Engine and Capability Fulfilment, then determines what happens next, which keeps Participants decoupled from one another and keeps engineering flow governed by the platform rather than by ad hoc interaction between them.

Versioning extends across many of the platform's objects, including Engineering Behavior Models, Packs, Profiles, Templates, Policies, Authority Rules, Reviews, Quality Gates, Ontologies, Decisions, and Deliverables, and nearly every configurable architectural artefact, including Packs, Policies, Profiles, Templates, EBMs, SEUs, and Runtime Services, follows the same universal lifecycle of Define, Validate, Compose, Activate, Execute, Observe, and Evolve.

Three distinct ownership concepts run through the platform, coinciding in small organisations but diverging significantly in large programmes involving suppliers, customers, and partners. Administrative Ownership determines who administers the platform's resources at the Tenant or Workspace level. Engineering Ownership determines which SEU is responsible for a given engineering object. Business Ownership determines which external business entity ultimately owns the business outcome.

Deployment rests on three configuration domains that remain independent of one another. The Engineering Behavior Model defines how the SEU behaves, and changes only when Packs or engineering practices change. The Tenant Configuration defines who owns and administers the environment, and changes only when the administrative structure changes. The Deployment Configuration defines where and how the platform runs, and changes only when the infrastructure changes. Because these three stay separate, moving infrastructure from one provider to another changes only the Deployment Configuration, updating a Pack changes only the EBM, and onboarding a new customer changes only the Tenant Configuration. Deployment itself is topology independent, and the platform is architected to run equally on a laptop, in an enterprise data centre, in a sovereign cloud, in an air-gapped environment, or as a SaaS offering.

## 6. Combined Architecture Diagram

Chapter 45 gives the platform's own master diagram, layering the architecture from top to bottom as the Engineering Layer, the Execution Layer, the Platform Layer, Platform Services, and the Infrastructure Layer. Every other chapter in Book 3 carries its own "Architectural Position" diagram, placing one entity relative to its immediate neighbours. The diagram below combines all of those individual positions into one picture, nested inside Chapter 45's five layers, with the Integration domain carried through as the Infrastructure Layer and the Cross-Cutting Concerns domain carried through as Platform Services plus the governance and knowledge columns inside the Engineering Layer.

```
══════════════════════════════════════════════════════════════════════════
 DEFINITION TIME                                            ENGINEERING LAYER
══════════════════════════════════════════════════════════════════════════

  Objective
     │
     ▼
  Required Capabilities ──────────────────────────────┐
     │                                                 │
     ▼                                                 ▼
  Template ──────┐                              Capability ── Service
     │           │                                 (declared together by a Capability Pack)
     ▼           ▼
  Profile   Pack Selection
     │           │
     └─────┬─────┘
           ▼
  Pack Registry ── Platform / Organisation / Domain / Compliance / Technology /
                    Integration / Capability Packs
           │
           ▼
  Composition Engine  (build-time; discovers, resolves, validates, composes,
                        detects conflicts, versions, activates)
           │
           ▼
  Engineering Behavior Model (EBM)
           │
           ▼
  Commissioned Software Engineering Unit (SEU)

══════════════════════════════════════════════════════════════════════════
 ENGINEERING LAYER — GOVERNANCE COLUMN        ENGINEERING LAYER — KNOWLEDGE COLUMN
══════════════════════════════════════════════════════════════════════════

  EBM                                           Engineering Activity / Deliverables
   │                                                      │
   ▼                                                      ▼
  Governance Model                                     Evidence
   │        │        │                                    │
   ▼        ▼        ▼                                     ▼
Authority Obligations Policies                          Knowledge
   │        │        │                                    │
   └────────┼────────┘                                     ▼
            │                                           Decision
   Reviews ─┼─ Quality Gates                                │
            │                                               │
            ▼                                               ▼
   Governance Evaluation ───────────────────────────► Deliverable State Transition
            │
            ▼
   Compliance Evaluation (Policies + Authority + Reviews + Quality Gates +
                           Obligations + Evidence, evaluated together)

  Ontology underlies every box above: every Deliverable, Knowledge Item, Evidence
  Item, Decision, Participant and the EBM itself references Ontology concepts.
  Traceability records the relationships between every one of those boxes as
  governed objects in their own right, feeding Engineering Explainability.

══════════════════════════════════════════════════════════════════════════
 EXECUTION LAYER
══════════════════════════════════════════════════════════════════════════

  Deliverable (state) ──► Dependency Engine ──► Ready Deliverables
                                                      │
                                                      ▼
                                          Required Capabilities
                                                      │
                                                      ▼
                                          Capability Fulfilment ◄── eligible pool
                                                      │
                                                      ▼
  Engineering Events ──► Execution Engine ──► Transition Definition Evaluation
                                │
                                ▼
                            Command
                                │
                                ▼
                      Work Item Generator
                                │
                                ▼
       Dispatch Engine ◄── eligible Participants ── Capability Fulfilment
                                │
                                ▼
                           Participant
                                │
                                ▼
                            Execution
                                │
                                ▼
                 Deliverable State Transition ──► Event Publication

══════════════════════════════════════════════════════════════════════════
 PLATFORM LAYER — RUNTIME KERNEL
══════════════════════════════════════════════════════════════════════════

  Persistent Engineering Objects (Deliverables, Knowledge, Evidence, Decisions,
  Obligations, Participants, SEUs)
            │
            ▼
  State Management ──► Event Model ──► Runtime Services ──► Participants
            │
            ▼
  Attention Evaluation ──► Attention Items ──► Routing ──► Participants / Users /
                                                            External Systems
            │
            ▼
  Engineering Telemetry ──► Analytics ──► Dashboards ──► Engineering Decisions

  External Interaction Model ──► Interaction Adapters ──► External Systems

  SEU Lifecycle Management governs whether the SEU may execute at all.

══════════════════════════════════════════════════════════════════════════
 PLATFORM SERVICES                                      (= Cross-Cutting Concerns)
══════════════════════════════════════════════════════════════════════════

  Identity ─► Authentication ─► Authorisation ─► Governance ─► Engineering State
  (Security; answers whether an entity may participate at all, distinct from
   Governance, which answers whether a transition is permitted)

  Revisions (mutable, authoring) ──► Versions (immutable) ──► Runtime Kernel ──►
  Historical Reconstruction
  (Version Management, applied to EBMs, Packs, Profiles, Templates, Policies,
   Authority Rules, Reviews, Quality Gates, Ontologies, Decisions, Deliverables)

  Platform ──► Tenant ──► Workspace (optional) ──► SEU ──► Engineering Objects
  (Multi-Tenancy: every engineering object belongs to exactly one SEU, every SEU
   to exactly one Workspace, every Workspace to exactly one Tenant)

  Platform Elements Developer ──► SEU Design Kit ──► Element Package ──►
  Element Registry ──► Composition Engine ──► EBM ──► Runtime Kernel
  (Pack SDK: the sole supported mechanism for authoring Packs, Templates, Profiles)

  Engineering State ──► State Management ──► Reliability & Engineering Continuity
  ──► {Recovery, Replay, Checkpointing} ──► Runtime Kernel

  Logical Platform ──► Deployment Architecture ──► Deployment Units ──►
  Infrastructure ──► Physical Environment
  (the same logical architecture, realised on different deployment topologies)

══════════════════════════════════════════════════════════════════════════
 INFRASTRUCTURE LAYER                                   (= Integration domain)
══════════════════════════════════════════════════════════════════════════

  LLM Providers · Databases · Event Infrastructure · Identity Providers ·
  Cloud Platforms · Storage · Source Control · Enterprise Systems ·
  Ticketing Systems
```

Reading the diagram top to bottom traces the platform's own universal lifecycle. An Objective, Template, Profile, and set of Packs are defined and composed at design time into an EBM, which activates a commissioned SEU. Once running, the Execution Layer advances Deliverables through the Dependency Engine, Capability Fulfilment, and Dispatch, producing Events and State Transitions. Every transition is checked against the Engineering Layer's governance column, which evaluates Authority, Obligations, Policies, Reviews, and Quality Gates before permitting it, while the knowledge column accumulates Evidence, Knowledge, and Decisions that justify it. The Platform Layer's Runtime Kernel carries State Management, the Event Model, Attention Management, Telemetry, External Interaction, and Lifecycle Management underneath all of this. Platform Services and the Infrastructure Layer support every layer above them without themselves carrying engineering meaning.

## Appendix A — First Principles

A set of first principles frames every domain described above. The Runtime Kernel remains domain independent. Engineering behaviour is composed rather than hard-coded. Everything that evolves over time is represented as a Pack wherever practical. Dependencies govern execution, with time acting only as an influence rather than a determinant. Knowledge is the platform's permanent organisational asset: Participants and SEUs are temporary, while Knowledge persists. Governance remains explicit, and every significant decision remains traceable. Every architectural concept carries a single responsibility. The Platform Core requires no modification in order to introduce new engineering behaviour. Deliverables are primary, so that every runtime activity ultimately contributes to one or more of them, and Work Items exist solely to create, modify, or validate them.

## Appendix B — Distinguishing Characteristics

Several characteristics together distinguish this architecture from traditional project and delivery tooling. Deliverables serve as the platform's primary execution object, so that dependency evaluation, flow measurement, knowledge attachment, governance gating, and progress measurement all derive from Deliverable state rather than from task completion. Capability remains stable while behaviour varies by organisation, domain, and compliance context, so that the same Participant capability, Development for instance, can operate under a Startup EBM or a Medical Device EBM with very different behaviour while the capability itself stays unchanged. Attention functions as an allocated decision rather than as a notification stream. Explainability is carried as a property of the engineering process itself, through the Trust Pipeline and the Decision Model, rather than as a property of any particular AI model.
