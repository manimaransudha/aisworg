# Workflow

## 24.1 Introduction

The previous chapter introduced the Deliverable as the primary execution entity within the AI Software Organisation — the carrier of organisational intent. Intent alone, however, does not produce software; it must progress through multiple capabilities in turn: requirements, architecture, implementation, testing, security, deployment, operations, knowledge management. Traditional software engineering models this progression as a workflow, but typically assumes a predetermined sequence of engineering task. The AI Software Organisation takes a different view: a workflow is not a predefined task sequence. It is the governed progression of organisational intent through a network of reasoning capabilities.

## 24.2 Definition

A **Workflow** is the governed progression of a Deliverable through one or more organisational capabilities in order to realise organisational objective. It determines which capability reasons next, which service is required, which decision must be made, which evidence is required, and when execution may proceed — coordinating organisational reasoning, not merely scheduling activity.

## 24.3 Why Workflows Exist

No individual capability possesses complete organisational understanding — requirements understands business intent, architecture understands system structure, testing understands verification, operations understands production behaviour. Deliverables must therefore move between capabilities, and the workflow provides the organisational mechanism through which that movement occurs.

## 24.4 Workflow versus Process, Workflow versus Pipeline

"Workflow" and "process" are frequently used interchangeably; here they represent different concepts. A **process** defines organisational policy — change management, incident management, release management, requirements management. A **workflow** represents one execution of a process: the process remains organisational knowledge, the workflow realises that knowledge for an individual Deliverable.

Engineering **pipelines**, by contrast, are deterministic — compile, test, package, deploy — executing predefined technical operation. A workflow coordinates organisational reasoning and may invoke multiple pipelines along the way; pipelines therefore become implementation mechanisms *within* a broader workflow, not substitutes for it.

## 24.5 Workflow Coordinates Capabilities, Not Participants

A workflow does not primarily coordinate participants — it coordinates capabilities. Requirements Capability reasons, Architecture Capability reasons, Implementation Capability reasons, Testing Capability reasons; participants merely execute the local reasoning within each. Participants may change; capabilities remain stable — a distinction that is what ensures organisational continuity as a workflow's underlying participants are replaced over its lifetime.

## 24.6 Workflow States and Transitions

A Deliverable may occupy several workflow states — waiting for requirements, waiting for architecture, waiting for security review, waiting for implementation, waiting for verification, waiting for deployment, waiting for operational validation — each describing organisational *responsibility* rather than engineering *activity*. Movement between states should occur because of organisational reasoning — requirement accepted, architecture approved, evidence sufficient, governance satisfied, testing successful, operational acceptance achieved — so that transition depends on organisational knowledge rather than an arbitrary status change.

## 24.7 Dynamic Workflows and Capability Autonomy

Traditional workflows are predetermined. The AI Software Organisation permits dynamic ones: if an AI participant discovers that a proposed feature affects payment processing, the workflow can automatically involve security, compliance and performance engineering without any human manually modifying it — the organisation reasons about the Deliverable, and execution adapts accordingly.

Each capability nonetheless retains local autonomy throughout. The workflow does not dictate how Requirements Engineering reasons, how Architecture evaluates alternative, or how Testing verifies behaviour — it determines only *when* each capability participates. Reasoning stays local; coordination stays organisational.

## 24.8 Parallel Workflows and Exception Handling

Many capabilities may reason simultaneously — architecture evaluating scalability, security evaluating threat, operations evaluating deployment impact, knowledge management analysing prior implementation — with the Deliverable accumulating organisational understanding from every capability that participates. Parallel reasoning is a natural property of the workflow, not a special case requiring extra machinery.

Not every workflow proceeds normally, either. New evidence may emerge, knowledge may change, policy may evolve, a deployment may fail, a requirement may be withdrawn. Rather than treating these as failures, the AI Software Organisation treats them as additional reasoning opportunity — the Deliverable simply continues through another ORC iteration rather than being routed into a separate "exception path."

## 24.9 Human and AI Collaboration, and Observability

The workflow remains independent of participant implementation — human participant, AI participant, automated participant and hybrid team all occupy organisational role, and the workflow coordinates capability rather than implementation technology, preserving organisational stability despite continual technological evolution.

Every workflow should also be continuously observable: the organisation should know the current capability, the current reasoning state, outstanding evidence, pending decision, governance status and organisational risk at any point. Observability is an inherent organisational property here, not an operational afterthought bolted on separately.

## 24.10 Workflow Completion

A workflow completes when organisational intent has been realised — which does not necessarily mean software has been delivered. Knowledge successfully recovered, an incident resolved, a regulatory obligation satisfied, an architecture decision accepted, or a capability improved can each constitute completion in their own right. Completion depends on objective, not on activity completion.

## 24.11 Three Layers of Workflow

It is worth being precise that "workflow" names three distinct layers, not one, and keeping them separate is what preserves encapsulation throughout the model.

The **Organisational Workflow** is what the preceding sections define: it coordinates capability, and is strategic and capability-oriented — feature development, production incident resolution, legacy knowledge recovery are all organisational workflows in this sense.

The **Capability Workflow** is each capability's own internal reasoning process. Architecture, for instance, might analyse constraint, explore alternative, evaluate trade-off, produce candidate design, generate evidence and recommend a decision — but the rest of the organisation never needs to know how this happens internally. Only the service contract matters externally (Part 2 Chapter 10 formalises the Service Contract in full).

The **Participant Workflow** is an individual participant's own execution strategy. An AI developer's internal workflow might include planning, code generation, static analysis, unit testing, self-review and documentation — again entirely internal to the participant, invisible to the capability it operates within.

This layering mirrors software architecture directly: systems expose interface, hide implementation, and let components evolve independently. The organisation coordinates capabilities; capabilities manage their own internal reasoning; participants choose their own execution strategy. Practically, it means an AI participant's internal algorithm can change without affecting organisational behaviour, and a capability's internal process can be redesigned without disrupting the wider organisation — encapsulation applied to organisational structure exactly as it is applied to software.

## 24.12 Relationships

Within the organisational model, a Workflow coordinates one or more Deliverables; traverses multiple Capabilities; invokes organisational Services; generates Activities; accumulates Artefacts; produces Evidence; develops Knowledge; records Decisions; and operates under Governance throughout. The workflow is, in this sense, the execution path through the organisational ontology, not a structure imposed on top of it.

## 24.13 Invariants

A workflow shall realise one or more organisational objectives. A workflow shall coordinate organisational capabilities rather than individual participants. A workflow shall preserve complete traceability. A workflow shall remain observable throughout execution. A workflow shall adapt to new organisational knowledge. Violation of these invariants results in rigid execution rather than intelligent execution.

## 24.14 Operational Semantics

A Deliverable enters the workflow. Capabilities reason; services are exchanged; evidence accumulates; knowledge evolves; decisions redirect execution; activities realise implementation. The workflow terminates only once organisational intent has been satisfied — it is not merely a path through engineering task, but the visible manifestation of organisational reasoning.

## 24.15 AI Implications

Artificial intelligence changes workflow execution fundamentally. Rather than simply automating predefined steps, AI participants continuously evaluate which capability should participate next, whether additional evidence is required, whether governance should intervene, whether reasoning can proceed in parallel, and whether organisational knowledge has changed sufficiently to alter execution. The workflow, in consequence, becomes adaptive rather than procedural — one of the defining characteristics distinguishing the AI Software Organisation from a conventional workflow engine.

## 24.16 Chapter Summary

A workflow is the governed progression of organisational intent through specialised reasoning capability, coordinating reasoning rather than execution. Deliverables move through capability; capability contributes understanding; evidence strengthens knowledge; knowledge influences decision; decision determines subsequent workflow evolution. Execution, understood this way, is an adaptive organisational reasoning process, not a fixed engineering sequence — with the three-layer distinction between organisational, capability and participant workflow preserving encapsulation at every level.
