# The Software Engineering Organisation

## 1.1 Introduction

Software engineering is commonly characterised as the process of translating requirements into executable software through the application of appropriate languages, libraries, architectural patterns, methodologies and engineering practices. Mastery of these technologies is treated as the defining characteristic of a software engineer.

The rapid advancement of artificial intelligence has sharpened the technology-centric view instead of broadening it. AI-powered code completion, code generation, automated testing, bug detection, code review, documentation generation, refactoring assistance and conversational programming assistants have become the most visible manifestations of AI-assisted software development. These advances mark a genuine milestone in the evolution of software engineering. They improve developer productivity by reducing repetitive work, accelerating implementation and lowering the effort required to produce syntactically correct, functionally executable software.

Rather than being absorbed into established practice, artificial intelligence has produced a genuinely new abstraction of software engineering — one built on autonomous agents rather than organisational structure. Software engineering can therefore currently be modelled through two competing abstractions:

1. Emerging practice: as language models have matured, the coordinating structure need not be an organisation at all, but an orchestration of autonomous AI agents coordinating through conversation.

2. Augmented practice: software engineering literature has traditionally described software development as the coordinated activities of an organisation — composed of individuals with specialised responsibilities — structured through projects, teams, processes, methodologies and organisational practices. Artificial intelligence, accordingly, should be adopted to percolate every one of these areas rather than settle into any one of them alone.


## 1.2 Emerging Abstraction for Software Engineering

Software engineering is increasingly represented as a collection of autonomous AI agents interacting through natural language: requirements delegated to one agent, architectural decisions to another, implementation to a third, testing to a fourth, with the overall system emerging from their exchanges. Under this abstraction, software development is modelled primarily as communication between AI agents.

This abstraction shifts the emphasis from organisational structure to conversational interaction, from institutional responsibility to individual autonomy, from coordinated engineering process to distributed system behaviour.

Conversation is certainly a valuable communication mechanism in software engineering — requirements are negotiated, architectural alternatives debated, design decisions reviewed, risks communicated and operational issues coordinated through it. But conversation supplies the content of these exchanges, not their structure: it does not by itself determine who has authority to settle a debated decision, which outcome becomes binding, or who is accountable if that decision proves wrong. Conversation alone, in other words, cannot explain how engineering decisions are authorised, how responsibilities are assigned, how knowledge is retained, or how accountability is maintained over a software system's lifetime. This is because it treats coordination as an inherent property of dialogue rather than as organisational structure.

Organisations, unlike an orchestration of communicating agents, possess characteristics that extend well beyond conversation. They establish clearly defined responsibilities and allocate authority to specific roles. They assign accountability for engineering decisions and project outcomes. They produce and maintain engineering artefacts that persist beyond individual contributors. They accumulate and preserve organisational knowledge, letting future teams understand the rationale behind past decisions. They establish governance mechanisms that define standards, policies and approval processes. They measure performance, monitor quality, manage resources and control organisational risk. Together, these capabilities provide the stability, continuity and coordination that engineering software systems spanning decades requires.

On this account, replacing a human participant with an intelligent one is undermining the importance of these structural requirements. Yet whether a responsibility is performed by a human engineer, an AI agent or a collaborative human-AI team, the organisation must still determine who owns the responsibility, who holds decision-making authority, how accountability is enforced, how knowledge is recorded, how governance is applied and how outcomes are evaluated.

## 1.3 Augmented Abstraction for Software Engineering

Programming is one activity within a considerably wider engineering discipline — one that encompasses problem analysis, requirements engineering, domain modelling, architectural design, quality assurance, project planning, stakeholder communication, governance, maintenance and long-term system evolution, carried out through collaboration among multiple roles and disciplines rather than by isolated individuals. The success of a software system depends not only on the correctness of its implementation but on the quality of the engineering decisions made throughout its lifecycle — decisions whose value compounds as organisations accumulate and institutionalise knowledge, preserve organisational memory and standardise engineering practice, letting software systems evolve over decades, often long after the individuals who originally engineered them have moved on. Such individuals are properly understood as participants (a term this work uses deliberately, which will become evident later) within the organisation responsible for the software system.

As software engineering organisations mature, they accumulate organisational assets that often become more valuable than any individual technical implementation. Coding standards reduce unnecessary variation and improve readability across large codebases. Architectural principles guide design decisions consistently, reducing complexity and improving long-term maintainability. Review processes catch defects early while spreading engineering knowledge. Testing practices increase confidence that systems satisfy functional and non-functional requirements alike. Configuration management and release processes ensure software evolves in a controlled, reproducible manner. Knowledge repositories capture domain expertise, architectural rationale, operational procedures and lessons learned, reducing dependence on individual contributors. Architectural Decision Records (ADRs), design documents and engineering logs preserve the reasoning behind important technical decisions, letting future participants understand not merely what was built, but why particular alternatives were selected.

Over time, these assets become embedded in the organisation's practice — new participants adopt established conventions, experienced participants refine them, and successive projects add further knowledge to the organisational repository — so engineering capability compounds rather than resets with each project. Together, these accumulated assets constitute **engineering capital**: unlike physical capital, it resides in an organisation's knowledge, process and institutional experience, representing the collective intellectual infrastructure on which future software systems are built.

The organisational dependence matters most where it is tested hardest — in the development of large-scale software systems: enterprise-wide in scope, dependent on extensive third-party integration, and subject to significant legal and regulatory compliance. Every significant software system, whether a banking platform, an airline reservation system, an operating system or a cloud computing platform, is the product of coordinated effort performed by numerous specialised participants working within a structured organisational environment. Large software systems are not built by programmers working in isolation. They are built by software engineering organisations.

The prevailing narrative surrounding AI in software engineering nonetheless remains disproportionately centred on programming assistance. Recognising this broader potential shifts the role of AI from a programming assistant to an engineering collaborator capable of contributing throughout the entire software development lifecycle.

This is the shift in thinking this work asks for: AI-augmented software engineering must be understood and modelled as an organisational system, not as a collection of autonomous AI agents. Only by capturing the structures, roles, responsibilities, knowledge flows and decision processes that define software engineering organisations can AI agents move beyond that autonomy to become genuine organisational participants — capable of contributing to the engineering of complex software systems.

The next stage in the evolution of AI-assisted software engineering should not be measured solely by the sophistication of AI-generated code. It should be measured by the extent to which artificial intelligence can participate as an effective member of a software engineering organisation.

## 1.4 SEU as the Fundamental Abstraction

The appropriate abstraction for modelling AI-assisted software engineering is therefore not the autonomous agent but the software engineering organisation itself. The organisation provides the enduring structure within which responsibilities are defined, decisions governed, knowledge managed and engineering activities coordinated. Individual participants — human or artificial — operate within this organisational framework by performing specific roles and fulfilling assigned responsibilities.

This work adopts the software engineering organisation — hereafter the Software Engineering Unit (SEU) — as its primary modelling abstraction, rather than treating artificial intelligence as an independent abstraction of its own.

The SEU therefore represents the next stage in software engineering's evolution — not a structure invented for artificial intelligence, but the organisational model the discipline has always depended on, now made explicit because artificial intelligence's arrival requires it to be.

Artificial intelligence becomes a participant within the organisation, not the organisation itself.

## 1.5 Implications for Artificial Intelligence

Producing correct source code, while valuable, is only one capability required of an engineering participant. Rather than an autonomous programmer operating independently of the organisation, artificial intelligence is more accurately treated as an organisational participant operating within an established engineering system — one that, like any participant, must acquire capabilities extending well beyond code generation into the broader domain of organisational behaviour: a framework of responsibilities, constraints and organisational expectations that define how engineering work is performed.

An AI participant must first understand **responsibilities** — recognising not only the tasks assigned to it, but the boundaries of its authority, the expectations of its role and the responsibilities of the other participants with whom it collaborates. Engineering activities are rarely performed in isolation; they are coordinated through clearly defined responsibilities that together achieve organisational objectives.

AI participants must also operate within established **governance**. Engineering decisions are constrained by architectural principles, organisational policies, regulatory obligations, security requirements, quality standards and business objectives. An AI system able to generate technically correct solutions but unable to reason within these constraints cannot function as a reliable engineering participant — governance provides the context that makes engineering decisions organisationally acceptable, not merely technically feasible.

Equally important is the ability to create, interpret and maintain **engineering artefacts**. Requirements specifications, architectural models, interface definitions, design documents, test plans, deployment procedures, operational runbooks and architectural decision records are not auxiliary documentation; they are integral to the engineering process, communicating intent, preserving rationale and coordinating work across specialised participants. An AI participant must be able to produce, consume and reason over these artefacts as naturally as it reasons about source code.

Participation in a software engineering organisation also requires preserving and evolving **organisational knowledge** — extending beyond algorithms and implementation technique to domain expertise, architectural rationale, operational experience, lessons learned, engineering standards and institutional practice accumulated over successive projects. AI systems must contribute to this shared knowledge rather than treating each engineering task as an isolated interaction; every completed activity should strengthen the organisation's collective understanding and improve its future engineering capability.

Another essential capability is the ability to **justify engineering decisions**. Engineering decisions invariably involve trade-offs among competing objectives — cost, performance, scalability, maintainability, security, delivery schedule. Human organisations rely on documented rationale to explain why particular alternatives were selected and to support future maintenance and governance activity; AI participants must likewise provide transparent reasoning that lets other organisational participants review, challenge and understand their recommendations.

Perhaps most importantly, AI participants must contribute to the **continuity** of the engineering organisation. Software systems frequently remain in operation for decades, during which technologies evolve, personnel change and business priorities shift. It is the organisation — not the individual participant — that provides the continuity needed to sustain these systems over time; AI should strengthen that continuity by preserving engineering knowledge, maintaining decision histories, enforcing standards, supporting governance and keeping critical understanding available regardless of changes in individual participants.

These observations motivate the organisational model developed throughout this work.

## 1.6 What Makes an SEU?

A Software Engineering Unit (SEU) is an evolved organisational system composed of interdependent entities realised by human and AI participants working individually or in teams to transform business objectives into software systems.

A Software Engineering Unit comprises two things: an abstraction layer defining what it is, and a concrete instantiation of how that abstraction reasons and acts. 

The abstraction layer comprises:
- **SEU Structure**: entities that each fulfil a distinct organisational function
- **Trace Relationship**: the explicit link that binds those entities together

The concrete instantiation begins with reasoning about how to use the entities. This reasoning must, in turn, be carried into coordinated action to achieve the outcomes. The instantiation layer comprises:

- **SEU Loops**: principally the closed loops through which entities continuously inform one another, producing engineering capital as a result
- **SEU Workbench**: the environment through which organisational intent becomes executed outcome

The Software Engineering Unit should not be read as a model of the entire enterprise. It models only those organisational functions whose primary purpose is engineering, evolving and operationally supporting software systems. Enterprise functions such as contract management, commercial pricing, sales, procurement, finance and corporate administration are external organisational systems that interact with the SEU through well-defined interfaces. Their outputs — contractual obligations, budgets, regulatory constraints, commercial priorities — become inputs to the engineering organisation, but the functions themselves are not engineering activities.

As the Foreword notes, **organisation** — used throughout this work without further qualification — refers to the Software Engineering Unit itself, not the enterprise that contains it.

Part 2 defines this abstraction layer — SEU Structure — formally, entity by entity; Parts 3 and 4 develop its concrete instantiation, through SEU Loops and the SEU Workbench respectively.

## 1.7 Chapter Summary

This chapter has argued that software engineering is best understood as an organisational activity rather than an implementation activity. Programming remains essential, but it is one component of a much broader organisational system that transforms business objectives into long-lived software systems.

It introduced the **Software Engineering Unit (SEU)** as the fundamental organisational abstraction for software engineering — modelling software development not as a sequence of programming tasks or conversations between autonomous agents, but as a coordinated organisational system of specialised roles, defined responsibilities, structured processes, governance mechanisms, engineering artefacts, organisational knowledge and continuous learning. Software systems emerge from the interaction of these entities, not from programming alone.

This has a direct implication for artificial intelligence. If software engineering is organisational at its foundation, AI-assisted software engineering cannot be achieved by improving code generation alone. Artificial intelligence must instead participate within the organisational structures, processes and governance through which software is engineered, maintained and evolved — as a member of the organisation, not a replacement for it.

The chapters that follow build on this foundation, examining how artificial intelligence can be integrated into the Software Engineering Unit as an organisational participant, operating within defined roles, responsibilities, processes and governance.

The central propositions of this chapter may be stated as follows.

1. Software is engineered by organisations. Programming is one capability performed within them.
2. Large software systems are built by software engineering organisations, not by programmers working in isolation.
3. The Software Engineering Unit — not the autonomous agent, not the enterprise as a whole — is the fundamental unit of software engineering.
4. Accumulated organisational knowledge, process and institutional experience — engineering capital — not individual expertise, sustains software systems across decades of change.
5. Artificial intelligence becomes a participant within the organisation; it does not become the organisation.
