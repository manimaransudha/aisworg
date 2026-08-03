# The Limits of Agent-Centred Software Development

## 2.1 Introduction

Artificial intelligence has transformed software development at an unprecedented pace. A new generation of development environments — AI software engineers, AI coding agents, autonomous software developers — increasingly plan, implement, test and refine software with limited human intervention. As these systems improve, the distinction between programming assistance and autonomous implementation appears to narrow, raising an obvious question: if artificial intelligence can increasingly perform software engineering tasks, what remains to be solved? One answer treats autonomous software engineering as a scaling problem — sufficiently intelligent models, larger context windows and more sophisticated autonomous agents will eventually perform everything human software engineers currently do.

This chapter outlines that such an answer is incomplete. Treating the autonomous agent as software engineering's primary modelling abstraction is a design choice, separable from the intelligence of the models involved, and it is that choice — not the intelligence — that has to be critically looked at.

This chapter traces the consequences of treating the agent as that primary abstraction — in how contemporary systems are built, in the organisational constructs they lack, and in what autonomous software engineering would actually require.

The point is that autonomous programming and autonomous software engineering are different problems. The book develops the alternative: artificial intelligence modelled not as an autonomous programmer operating independently of an organisation, but as an organisational participant operating within a Software Engineering Unit.

## 2.2 The Evolution of AI-Assisted Development

The evolution of AI-assisted software development can be read as a gradual expansion in the scope and complexity of the engineering activities artificial intelligence is capable of performing, with each generation automating more sophisticated aspects of development while requiring progressively less human intervention.

The earliest generation of AI development assistants supported individual programming tasks without aiming to replace the programmer: code completion, syntax assistance, documentation lookup, error explanation and simple code suggestions reduced the effort of routine implementation while leaving significant engineering decisions under human control.

Later generations extended AI support beyond individual code fragments to larger implementation units — generating complete functions, producing unit tests, refactoring implementations, explaining unfamiliar code, reviewing pull requests and translating software between languages. AI evolved from assisting with syntax to reasoning about the structure and behaviour of software components.

Large language models accelerated this progression considerably. Because these models could reason over larger contexts and respond to natural language instructions, software development increasingly became a conversational activity: developers no longer needed to express intent solely through programming languages, since engineering objectives could be communicated in natural language and AI systems could infer implementation strategies and generate corresponding artefacts.

The most recent generation extends this trajectory further still, attempting to execute complete engineering tasks rather than isolated programming operations — commonly described as coding agents, AI software engineers, autonomous developers or multi-agent software engineering systems. Given a high-level engineering objective, these systems combine planning, reasoning and implementation into integrated workflows: decomposing objectives, modifying multiple source files, executing build processes, running automated tests, diagnosing failures and iteratively refining solutions until predefined objectives are satisfied — often through multiple specialised AI agents collaborating on different activities (one analysing requirements, another generating implementation plans, others producing code, reviewing it, executing tests or diagnosing failures), coordinating primarily through communication with one another and with the developer, and reducing human involvement to supervision, clarification and final approval.

The motivation is both practical and compelling: these systems have already demonstrated the ability to perform engineering activities that would previously have required experienced developers, and as reasoning capability improves, the range and complexity of tasks that can be delegated to AI will almost certainly keep expanding. The architectural assumptions underlying these systems nonetheless deserve closer examination. Most autonomous coding agents implicitly assume that software engineering can be adequately represented as a collection of implementation activities coordinated through communication among intelligent participants.

It is this assumption — not the sophistication of the underlying language models — that constitutes the principal limitation examined in this chapter.

## 2.3 Activity Automation versus Organisational Modelling

Governance is a property of the organisational system, not a task; organisational memory is an accumulated organisational capability, not an activity. Accountability and traceability likewise arise from the structures and relationships that coordinate engineering work, not from isolated implementation effort.

The more fundamental distinction, then, is not between human engineers and artificial intelligence, nor between manual and automated programming. It is between **automating work** and **modelling the organisation that performs the work**. Activity automation improves the execution of individual engineering tasks; organisational modelling enables those tasks to contribute to a coherent, governed and continuously evolving engineering system.

This distinction sharpens as artificial intelligence takes on greater responsibility within software engineering. So long as AI is modelled primarily as a collection of autonomous task performers, progress will keep being measured by the range of activities that can be automated. But if the objective is autonomous software engineering rather than autonomous programming, the primary modelling abstraction must shift from the engineering activity to the engineering organisation. Only then can AI participate not merely in the execution of work, but in the organisational system that gives that work meaning, continuity and lasting value.

## 2.4 Conversation Is Not Organisation

Section 1.2 argued that conversation supplies the content of engineering coordination but not its structure — it cannot by itself establish who has authority to decide, what becomes binding, or who is accountable if a decision proves wrong. The organisational roles found in any mature software engineering organisation make that argument concrete: a reviewer's authority to approve or reject an implementation, a configuration manager's control over an official baseline, a release manager's sign-off on production readiness, an architect's responsibility for structural direction — none of these depend on the conversations through which they are exercised. Their significance comes from the authority, accountability and governance the organisation assigns to the roles themselves, not from how effectively a decision was communicated.

Two autonomous agents can therefore exchange thousands of messages without ever forming an organisation. They may negotiate implementation details, refine algorithms, review generated code and resolve technical inconsistencies, and still lack the organisational structures that turn collaborative activity into engineering practice. Without explicitly defined responsibilities, there is no ownership. Without delegated authority, there are no binding decisions. Without accountability, there is no mechanism for ensuring engineering outcomes satisfy organisational objectives. Without governance, there is no guarantee that individual decisions remain consistent across projects or over time.

The absence of these structures has real consequences. Engineering decisions become transient conversational outcomes rather than institutional commitments. Responsibilities emerge implicitly from interaction rather than being explicitly assigned. Decision rationale stays embedded in conversational history instead of becoming organisational knowledge. As conversations accumulate, maintaining consistency comes to depend on reconstructing previous interactions rather than consulting established organisational artefacts and governance mechanisms.

The same holds for AI-assisted software engineering: conversation supports the organisation; it does not define it. Artificial intelligence should therefore be modelled not as a collection of agents whose behaviour emerges solely through conversation, but as participants operating within an explicit organisational framework that defines how engineering responsibilities are assigned, exercised and governed.

## 2.5 The Missing Organisational Constructs

The distinction between activity automation and organisational modelling sharpens when set against the organisational constructs found in mature software engineering organisations — constructs that are not implementation techniques or programming practices, but mechanisms that let an organisation coordinate engineering work over years or decades.

Contemporary AI systems often perform engineering activities impressively while leaving the constructs that coordinate those activities implicit or entirely absent. The result is AI systems that grow steadily more effective at performing work without necessarily participating in the organisational system that gives that work continuity, accountability and purpose.

### Roles

A role is a sustained organisational responsibility, not a temporary task or capability — an enduring position within the engineering organisation, together with the responsibilities, authority and expectations attached to it.

An architect remains responsible for architectural integrity across the lifecycle of a system, spanning numerous projects, releases and decisions. A product owner remains accountable for requirements prioritisation; a release manager retains responsibility for deployment readiness. These responsibilities persist regardless of which engineering activities happen to be underway on a given day.

Current AI systems assign tasks to specialised agents, but a task assignment is not an organisational role. An agent instructed to review a design performs an isolated activity; a reviewer within an organisation performs a continuing organisational function governed by defined responsibility, authority and accountability. A role represents organisational continuity. A task represents a temporary unit of work.

### Authority

Engineering organisations do not treat every participant as possessing identical decision-making authority. Different decisions require different levels of approval, consultation or oversight according to their organisational significance: some may be made independently by engineers, others require peer review or architectural approval, security-sensitive changes may need authorisation from designated specialists, production deployments may need release-manager or operational sign-off, regulatory changes may need compliance consultation before implementation proceeds.

Authority is therefore independent of technical competence. An engineer may understand an architectural issue perfectly while lacking the authority to approve the change; a manager may hold approval authority without participating in implementation directly.

Current AI systems generally optimise for technical reasoning rather than organisational authority. When agents disagree, resolution tends to come from further reasoning or conversation rather than from explicit organisational decision structures — the distinction between *knowing* the correct answer and *possessing the authority* to decide is largely absent.

### Accountability

Engineering organisations carefully distinguish performing work from owning its outcomes. A complex implementation may involve architects, developers, testers, reviewers, security specialists and operations personnel, yet organisational accountability typically stays with a single role or function. This distinction matters most when engineering decisions carry long-term consequences: someone must ultimately answer for architectural integrity, software quality, operational reliability or regulatory compliance, and accountability is what gives important engineering decisions identifiable ownership across a system's lifecycle.

Current AI systems often blur execution and ownership. Agents generate implementations, review code, execute tests and refine solutions, but responsibility for the resulting decisions frequently stays undefined — the ability to perform an activity gets conflated with accountability for its consequences. Execution produces work. Accountability owns the outcome.

### Institutional Memory

Engineering organisations accumulate knowledge over years of software evolution. Every significant decision adds to an expanding organisational understanding of the system and its domain: why was one technology chosen over another, why was an interface designed a particular way, why does a seemingly unnecessary business rule persist, why was a performance optimisation introduced years ago.

The answers frequently outlive the participants who made the original decisions. Mature organisations preserve this understanding through architecture documents, decision records, operational runbooks, issue histories, engineering standards and accumulated experience, so that future participants understand not merely what exists but why. Without institutional memory, organisations repeatedly rediscover solved problems; decisions detach from their rationale; architectural intent disappears; engineers reconstruct history from source code and fragmented documentation rather than extend existing systems.

Most contemporary AI systems rely primarily on conversational context or retrieved documents rather than a structured, evolving organisational memory. Their knowledge is often sufficient to solve the immediate problem without strengthening the organisation's long-term understanding of the system.

### Governance

Engineering organisations operate within explicit governance frameworks that regulate behaviour independently of who performs the work — coding standards, architectural principles, security policies, compliance obligations, review procedures, quality gates, release processes and organisational policy, all defining acceptable engineering behaviour and keeping individual decisions consistent with broader objectives.

Governance exists independently of the participants themselves. Engineers change, technologies evolve, projects conclude — governance continues to provide stability and consistency across successive generations of software systems. Current AI systems generally treat governance as additional context supplied in prompts or retrieved from documentation: guidance rather than an explicit mechanism that constrains behaviour and defines permissible decisions. An engineering organisation does not merely *know* its governance; it *operates under* it.

### Traceability

Software engineering produces far more than source code — an interconnected network of engineering artefacts whose relationships capture the system's evolution over time. Requirements shape architectural design; architectural decisions constrain implementation; implementation satisfies functional and non-functional requirements; test cases verify specific behaviours; deployment releases verified implementations into operational environments; operational feedback generates new requirements and architectural improvement. Each artefact sits within a network of traceable relationships spanning the entire engineering lifecycle.

Traceability lets engineers understand the consequences of change: a modified requirement traces to affected designs, implementations, tests and operational documentation; an operational defect traces back through implementation and design to its originating requirement. These relationships matter for maintenance, auditing, regulatory compliance, impact analysis and long-term evolution.

Current AI systems generally optimise individual artefacts rather than the network connecting them — generating code, documentation or tests with impressive accuracy while the persistent relationships between those artefacts remain implicit or must be reconstructed afterward.

None of these constructs reduces to a prompt, a conversation or an isolated task, because each is a property of the organisation itself — the source of the stability, continuity and coordination that let software systems evolve over years or decades. Their absence explains why many contemporary AI-assisted development environments, for all their advances in code generation and task automation, remain models of engineering **activities** rather than models of engineering **organisations**. It is precisely these constructs that the SEU introduced in this work makes explicit.

## 2.6 Knowledge Is More Valuable Than Code

Chapter 1 described the organisational assets — standards, principles, review practice, decision records — that accumulate into what it called *engineering capital*. This section examines the same erosion from a narrower angle: what happens specifically to AI-assisted development when code is treated as the primary output and knowledge as a by-product.

One defining characteristic of long-lived software systems is that source code frequently survives while the knowledge required to understand it gradually disappears. Systems often remain operational for decades, undergoing continual enhancement and adaptation long after their original developers have left the organisation: business rules become embedded in implementation detail rather than explicit organisational knowledge, architectural assumptions become implicit rather than documented, design trade-offs lose their historical context, and operational experience survives only in the memories of experienced participants. The implementation persists; the reasoning that produced it slowly erodes.

This matters because software engineering is fundamentally a process of making informed decisions, not simply producing source code. Reading source code may reveal *what* a system does; it seldom explains *why* it behaves that way, why one architectural alternative was chosen over another, or why a business rule that looks unnecessary continues to exist — questions that accumulated organisational knowledge can often answer and source code alone cannot.

As that knowledge diminishes, the cost shows up concretely: participants spend progressively more time reconstructing intent than implementing new functionality, changes become riskier as the consequences of modifying existing behaviour are less well understood, architectural consistency deteriorates, and technical debt accumulates — not necessarily because the code has grown more complex, but because the organisation's understanding of the system has eroded.

Artificial intelligence offers a genuine opportunity here. Unlike traditional development tools, AI systems can reason over heterogeneous engineering artefacts, synthesise information from multiple sources and generate explanations connecting requirements, designs, implementations and operational behaviour — but only if organisational knowledge is treated as a **first-class engineering asset** rather than a by-product generated after the fact. Requirements should preserve business intent. Architectural decisions should record their rationale. Design reviews should capture accepted alternatives and rejected options. Operational incidents should enrich organisational memory. Lessons learned should become institutional knowledge rather than remain personal experience.

Source code is a transient expression of engineering decisions, one that can often be regenerated, refactored or even rewritten; the organisational knowledge that explains why it exists in its current form is far harder to reconstruct once lost. For long-lived systems, preserving that knowledge is at least as important as preserving the implementation itself.

## 2.7 Scaling Beyond Individual Projects

Most contemporary AI-assisted software development systems operate within the scope of a single task, repository or project: implement a feature, correct a defect, review a pull request, generate documentation. Once the activity concludes, the interaction ends, and the knowledge generated during that session is retained only partially, if at all — a model well suited to task automation, but not to how software engineering organisations actually evolve.

Software organisations rarely exist to deliver a single project. They develop and maintain portfolios of products, services and platforms over many years, and their most valuable asset is not the completion of any one project but the cumulative engineering capability — architectural patterns that become organisational standards, reusable frameworks and tools, maturing testing and deployment practice, governance itself refined through repeated application — that accumulates across successive ones. This learning is institutionalised, not merely individual: captured, shared and folded into organisational process, so that participants joining new projects start from a higher level of engineering maturity than their predecessors, regardless of which participants remain.

Current AI-assisted development systems show little of this organisational learning. They may retain conversational context, retrieve documents or access existing repositories, but they rarely improve the organisation's engineering capability as a direct consequence of completing a project. The implementation may be delivered successfully; the organisation itself does not necessarily become more capable of engineering future systems.

Two different models of learning are at work here. In the first, learning happens at the level of the individual task: the objective is to solve the current problem as effectively as possible. In the second, learning happens at the level of the organisation: every completed project adds to a growing body of organisational knowledge that improves future decisions, strengthens governance, refines process and expands institutional capability. Mature software organisations operate the second way — the organisation, not the task or the individual project, is the primary unit of learning, turning individual experience into collective capability.

This carries real implications for autonomous software engineering. If artificial intelligence is to participate as a member of an SEU, every engineering activity should strengthen the organisation as well as solve the immediate problem: architectural decisions should enrich organisational knowledge, successful design patterns should become reusable organisational assets, operational incidents should refine governance and practice, and lessons learned should join institutional memory rather than stay confined to individual projects. An autonomous software organisation should therefore exhibit **organisational learning**, not merely **task completion** — growing more capable with every project it undertakes.

The ultimate measure of such an organisation is not the quality of the software it produces today, but its ability to engineer better software tomorrow because of what it learned yesterday. That capability comes not from isolated AI agents or individual engineering activity, but from an organisational system that continuously captures, preserves and applies engineering knowledge across the entire portfolio of software it is responsible for.

## 2.8 Reframing the Problem

The organisational constructs examined in this chapter point toward a different set of questions than the ones current AI-assisted development typically asks. The critical questions confronting future AI systems are therefore unlikely to concern programming syntax or implementation technique. They concern the organisational context in which engineering decisions are made — for example:

- Who owns this engineering decision?
- Why was this architectural approach selected instead of an alternative?
- Which requirement or business objective motivated this implementation?
- Which architectural principle or organisational policy governs this design?
- Which regulatory or security constraint influenced this decision?
- Which business capability is affected if this component changes?
- Which systems, services and stakeholders depend on this interface?
- What evidence supports this recommendation?
- Which previous decisions constrain the available alternatives?
- How should this knowledge be preserved for future projects?

None of these questions can be answered reliably from source code alone; they require organisational knowledge accumulated throughout the engineering lifecycle — requirements, architectural rationale, governance policy, operational experience and institutional memory. Building that capability, not merely more capable coding agents, is where autonomous software engineering turns next.

## 2.9 Towards an Organisational Model

The organisational construct **Software Engineering Unit (SEU)** — not the individual engineer, nor the autonomous agent — should serve as the mechanism for software engineering. Human engineers and AI systems participate within this organisational structure by assuming defined responsibilities, operating under established governance and contributing to the organisation's collective engineering capability.

Within this model, artificial intelligence takes on a different role. Rather than an autonomous software engineer operating independently of the organisation, AI becomes one of the mechanisms through which organisational responsibility is fulfilled. An AI participant may perform architectural analysis, generate implementations, conduct design reviews, execute testing activity, maintain documentation or preserve engineering knowledge — but these activities take their meaning from the organisational context in which they occur. They are performed on behalf of defined organisational roles, constrained by governance, informed by organisational knowledge and evaluated against organisational objectives.

Replacing a human engineer with an AI participant does not alter this model: roles remain, authority remains, accountability remains, institutional memory remains, governance remains, traceability remains. Only the entity performing a given organisational function changes. The organisation becomes the enduring element of the engineering system, while human engineers and AI participants become interchangeable contributors operating within it according to their respective competencies and responsibilities.

This gives autonomous software engineering a more stable foundation for the future. As AI capability improves, organisational functions may gradually shift from human participants to artificial intelligence — some responsibilities eventually performed entirely by AI, others remaining under human control, many becoming genuinely collaborative — without altering the structure of the engineering organisation itself, because that structure is independent of the implementation mechanism.

This organisational perspective grounds the remainder of this work. The chapters that follow develop the architecture of the SEU — organisational entities, engineering roles, knowledge structures, governance mechanisms and intelligent participants integrated into a coherent engineering system — with the aim not simply of automating software development, but of building an engineering organisation capable of sustaining software systems, organisational knowledge and engineering excellence over extended periods of time.

## 2.10 Chapter Summary

This chapter examined the current state of AI-assisted software development and argued that, for all its achievements, it remains focused on automating engineering activities rather than modelling engineering organisations.

AI-assisted development has expanded steadily — from code completion and programming assistance to autonomous planning, implementation, testing and multi-agent development — increasing productivity and demonstrating that many software development activities can be performed with progressively less human intervention. These advances mark a genuine milestone in the application of AI to software engineering.

But automating engineering activity is fundamentally different from modelling the organisational system within which that activity occurs. Contemporary AI systems largely treat software engineering as a sequence of tasks coordinated through conversation among autonomous agents; such interaction facilitates collaboration, but does not by itself establish the organisational constructs that distinguish a software engineering organisation from a collection of intelligent participants. Roles, authority, accountability, institutional memory, governance and traceability are properties of the organisation itself, not outcomes of conversation, however sophisticated.

The long-term value of a software engineering organisation lies not only in the software it produces but in the knowledge it accumulates. Source code captures the outcome of engineering decisions; organisational knowledge captures the reasoning, constraints, experience and governance that explain them. As systems mature, preserving that knowledge matters increasingly for maintenance, evolution and organisational continuity.

These observations reframe the challenge facing autonomous software engineering. It is no longer simply to automate programming or individual engineering tasks, but to build engineering organisations that create, preserve, govern and continuously enrich organisational knowledge throughout the software lifecycle — organisations in which artificial intelligence is not merely a producer of code, but a participant that strengthens the organisation's collective engineering capability.

This reframing motivates the remainder of this work. Rather than treating the autonomous agent as the primary modelling abstraction, the chapters that follow develop the SEU — an organisational model in which artificial intelligence operates within explicitly defined roles, responsibilities, governance structures, knowledge systems and engineering processes, strengthening the organisation rather than replacing it.

6. Automating engineering activities is not the same as modelling the organisation that performs them.
7. Conversation between AI systems produces collaboration, not organisation.
8. Roles, authority, accountability, institutional memory, governance and traceability are properties of organisations; no accumulation of agent conversation creates them.
9. Source code records what was decided; organisational knowledge records why — and knowledge outlasts code.
10. An autonomous engineering organisation is measured by what it learns from each project, not by how quickly it completes the next one.
