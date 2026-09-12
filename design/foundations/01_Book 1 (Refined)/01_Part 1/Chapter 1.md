# The Software Engineering Organisation

## 1.1 Introduction

Software engineering is commonly characterised as the process of translating requirements into executable software through the application of appropriate languages, libraries, architectural patterns, methodologies and engineering practices. Mastery of these technologies is treated as the defining characteristic of a software engineer.

The rapid advancement of artificial intelligence has sharpened the technology-centric view instead of broadening it. AI-powered code completion, code generation, automated testing, bug detection, code review, documentation generation, refactoring assistance and conversational programming assistants have become the most visible manifestations of AI-assisted software development. These advances mark a genuine milestone in the evolution of software engineering. They improve developer productivity by reducing repetitive work, accelerating implementation and lowering the effort required to produce syntactically correct, functionally executable software.

Rather than being absorbed into established practice, artificial intelligence has introduced a new abstraction of software engineering based on autonomous agents rather than organisational structure. This gives rise to two contrasting ways of modelling the discipline.

1. **Emerging practice:** As language models have matured, software engineering can be organised as an orchestration of autonomous AI agents that coordinate their activities through conversation, without an organisation serving as the primary coordinating structure.

2. **Augmented practice:** Software engineering can continue to be understood as a coordinated organisational activity involving individuals with specialised responsibilities and structured through projects, teams, processes, methodologies and organisational practices, with artificial intelligence integrated into this existing organisational construct.
 
## 1.2 Emerging Abstraction for Software Engineering

Software engineering is increasingly being described as a collection of autonomous AI agents that interact through natural language. Requirements may be delegated to one agent, architectural decisions to another, implementation to a third and testing to a fourth, with the resulting system emerging from their interactions. In this abstraction, software development is modelled primarily as a distributed system of communicating agents rather than as an activity conducted within an organisation.

This perspective shifts attention from organisational structure and institutional responsibility towards conversational interaction and agent autonomy. Conversation by itself does not provide the authority, responsibility or governance needed to establish how engineering decisions are made and sustained.

Traditional software engineering addresses these concerns through organisational structures, governance and established engineering practices that provide continuity beyond individual interactions and participants. This becomes particularly important for systems that must be maintained and evolved over many years, where decisions, knowledge and responsibilities need to persist beyond the conversations through which they were originally established.

The emerging agent-based abstraction therefore presents a fundamental question for software engineering. If autonomous AI agents become the primary units through which engineering work is performed and coordinated, how are the organisational structures that have traditionally provided authority, accountability, continuity and governance to be represented? Without addressing this question, modelling software engineering solely as interactions among autonomous agents risks overlooking the organisational foundations on which complex and enduring software systems depend.

## 1.3 Augmented Abstraction for Software Engineering

Software engineering organisations accumulate knowledge and practices through successive projects. Participants inherit established ways of working, refine them through experience and add new knowledge as systems evolve. Over time, this accumulated capability becomes engineering capital, representing the organisational knowledge and practices through which software systems are conceived, developed, operated and evolved. This accumulated capability is particularly important for large-scale systems where engineering involves many specialised participants, complex dependencies and, often, significant regulatory obligations. 

Methodologies have traditionally attempted to provide this coordination by specifying how engineering should be performed. In practice, however, there is often a substantial difference between the methodology an organisation documents and the methodology through which engineering actually takes place. Under delivery pressure, teams adapt, bypass or reinterpret prescribed activities to deal with the circumstances they encounter. The documented methodology may subsequently remain as the formal representation of the process even when actual practice has diverged considerably from it. The result is a process that can appear systematic to management, governance bodies or auditors while the engineering work itself follows a much more adaptive path.

Repeatability cannot be achieved simply by documenting a standard sequence of activities and measuring compliance with it. What needs to become repeatable is the organisation's ability to make sound engineering decisions, respond to changing circumstances, preserve what it learns and maintain appropriate control over the system as it evolves. A methodology that exists primarily as documentation does not provide that capability.

The augmented abstraction therefore places artificial intelligence within the software engineering organisation rather than treating it as an autonomous replacement for organisational structure. AI can participate across the engineering lifecycle while operating with the organisation's accumulated knowledge, practices and decision structures. More importantly, AI creates the possibility of moving aspects of methodology from documented expectations into mechanisms that can actively support, guide, record and evaluate engineering work as it is performed.

## 1.4 SEU as the Fundamental Abstraction

The emerging abstraction places autonomous AI agents at the centre and largely dispenses with the organisation as the primary unit of coordination. The augmented abstraction retains the software engineering organisation but largely introduces AI into organisational structures and practices that were designed around human participants. Neither abstraction fully exploits what AI makes possible.

This work introduces the **Software Engineering Unit (SEU)** as an organisational abstraction designed to exploit the capabilities of AI while retaining the organisational foundation of software engineering. The SEU makes the methodology executable by embedding it within mechanisms that continuously observe, guide, evaluate and adapt engineering work. AI can carry out engineering activities that would otherwise be performed by human participants while also enabling forms of continuous organisational operation that were impractical when engineering depended primarily on human participants.

This changes the significance of time and project management within the SEU. Much of traditional project management exists because human work has to be organised around schedules, milestones, meetings, reporting cycles and periodic decisions. When AI can continuously monitor work, evaluate progress, identify emerging problems and coordinate activities, these temporal boundaries become less fundamental. SEU shifts from managing work primarily through discrete projects and periodic control points towards continuously managing engineering outcomes.

## 1.5 Implications for Artificial Intelligence
 
Producing correct source code, while valuable, is only one capability required of an engineering participant. An AI system intended to participate in software engineering must operate within the organisation's responsibilities, constraints, practices and objectives rather than function solely as an autonomous programmer.

An AI participant must understand **responsibilities**, including the work assigned to it, the boundaries of its authority and the responsibilities of the other participants with whom it collaborates. It must also operate within **governance**, taking into account architectural principles, organisational policies, regulatory obligations, security requirements, quality standards and business objectives. A technically feasible solution is not necessarily an organisationally acceptable one.

AI must also work with the **engineering artefacts** through which the organisation expresses and preserves its engineering intent. Requirements specifications, architectural models, interface definitions, design documents, test plans, deployment procedures, operational runbooks and architectural decision records provide the context needed to understand, perform and review engineering work. An AI participant therefore needs to create, interpret and maintain these artefacts as part of the engineering activity rather than treating them as secondary documentation.

This participation must contribute to **organisational knowledge**. Domain expertise, architectural rationale, operational experience, lessons learned, engineering standards and established practices accumulate across projects and provide the context for future decisions. AI should therefore contribute to this shared knowledge so that engineering activity builds organisational capability rather than remaining a series of isolated interactions.

AI participants must also be able to **justify engineering decisions**. Software engineering involves trade-offs among cost, performance, scalability, maintainability, security and delivery objectives. The rationale behind a decision allows other participants to evaluate it, challenge its assumptions and understand its implications as the system evolves. AI therefore needs to make the basis and consequences of its engineering decisions available to the organisation.

Together, these capabilities enable AI to contribute to the **continuity** of software engineering. As systems evolve over years or decades and participants change, organisational knowledge, decisions, practices and engineering context need to remain available. AI can strengthen this continuity by contributing to the creation and maintenance of that institutional record while continuing to participate in the engineering work itself.
 
## 1.6 What Makes an SEU?

A **Software Engineering Unit (SEU)** is an executable organisational system composed of interdependent entities realised by human and AI participants, working individually or in teams to transform business objectives into software systems.

The SEU has two layers. The first defines its organisational structure and the second defines how that structure operates in practice.

The **SEU Structure** defines the entities that fulfil distinct organisational functions and the relationships that connect them. It establishes the organisational context within which engineering responsibilities are assigned and coordinated.

The operational layer consists of **SEU Loops** and the **SEU Workbench**. SEU Loops provide the closed-loop interactions through which entities continuously inform, evaluate and influence one another, allowing engineering knowledge and capability to accumulate as engineering capital. The SEU Workbench provides the environment through which organisational intent is translated into executed engineering outcomes.

The SEU is not a model of the entire enterprise. It covers only those organisational functions whose primary purpose is to engineer, evolve and operationally support software systems. Functions such as contract management, commercial pricing, sales, procurement, finance and corporate administration remain external to the SEU and interact with it through defined interfaces. Their outputs, including contractual obligations, budgets, regulatory constraints and commercial priorities, become inputs to the engineering organisation without becoming engineering activities themselves.

Accordingly, **organisation**, when used without further qualification throughout this work, refers to the Software Engineering Unit rather than the enterprise that contains it.

Part 2 defines the SEU Structure, while Parts 3 and 4 develop its operation through SEU Loops and the SEU Workbench respectively.

## 1.7 Chapter Summary

Software is engineered by organisations, with programming representing only one of the capabilities required to develop and sustain software systems. Large and complex systems depend on coordinated engineering across multiple responsibilities, participants and organisational practices.

Software methodologies seek to provide repeatable engineering outcomes, but documentation alone does not make a methodology effective. Its value depends on being embedded in the actual execution of engineering work and adapting to the conditions in which that work takes place.

The Software Engineering Unit (SEU) provides an organisational abstraction for making methodology executable. It retains the organisational foundation of software engineering while exploiting AI not only to perform engineering activities but also to enable continuous observation, decision making and adaptation across the organisation.