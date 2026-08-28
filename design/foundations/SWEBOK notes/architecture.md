# Software Architecture


## Software Architecture Fundamentals

### The Senses of “architecture”

Architecture is about what is fundamental to a software system; not every element, interconnection, or interface is considered fundamental.

Architecture considers a system in its environment. Software architecture is outward-looking; it considers a system’s context beyond its boundaries including the people, organizations, software, hardware and other devices with which the system must interact.

Outcome is **architecture descriptions**

### Architectural Concerns

affordability, agility, assurance, autonomy, availability, behavior, business goals and strategies, complexity, compliance with regulation, concurrency, control, cost, data accessibility, deployability, disposability, energy efficiency, evolvability, extensibility, feasibility, flexibility, functionality, information assurance, inter-process communication, interoperability, known limitations, maintainability, modifiability, modularity, openness, performance, privacy, quality of service, reliability, resource utilization, reusability, safety, scalability, schedule, security, system modes, software structure, subsystem integration, sustainability, system features, testability, usability, usage, user experience

- classified as functional, non-functional or constraint

### Uses of Architecture

- shared understanding of the system to guide its design and construction
- serves as a preliminary conception of the software system that provides a basis to analyze and evaluate alternatives


## Software Architecture Description

ADs document an architecture for a software system. ADs serve as a blueprint to guide the construction of the software system.

Various representations of AD are called architecture views.
- logical view depicts how the system will satisfy the functional
requirements
- process view depicts how the system will use concurrency
- physical view depicts how the system is to be deployed and distributed
- development view depicts how the top-level design is broken down into implementation units, the dependencies among those units and how the implementation is to be constructed
- module viewpoint is used to express a software system’s implementation in terms of its modules and their organization
- component and connector viewpoint, used to express the software’s large-scale runtime organization and interactions 
- scenarios/use cases viewpoint is used to express how users interact with the system 
- information viewpoint is used to express a system’s key information elements and how they are accessed and stored 
- deployment viewpoint is used to express how a system is configured and deployed for operation
- Other documented viewpoints include viewpoints for availability, behavior, communications, exception handling, performance, reliability, safety and security

**In model-based architecting, each view can be machine-checked against its viewpoint.**

There are two common approaches to the construction of views: the synthetic approach and the projective approach. In the synthetic approach, architects construct views of the system-of-interest and integrate these views within an architecture description using correspondence rules. In the projective approach, an architect derives each view through some routine, possibly mechanical, procedure of extraction from a single unified model (or “uber model”).

Various architectural styles and patterns have been documented:
- General structures (e.g., layered, call-and-return, pipes and filters, blackboard, services and microservices)
- Distributed systems (e.g., client-server, n-tier, broker, publish-subscribe, point-to-point, representational state transfer (REST))
- Method-driven (e.g., object-oriented, event-driven, data flow)
- User-computer interaction (e.g., model-view-controller, presentation-abstraction-control)
- Adaptive systems (e.g., microkernel, reflection and meta-level architectures)
- Virtual machines (e.g., interpreters, rule-based, process control)
- Pattern catalogs (or systems of patterns) are
used to express architectural styles and solutions through coordinated sets of patterns.

**Reference architectures have been developed and used in many domains including automotive systems, healthcare, Internet of Things, cloud computing, avionics, manufacturing and telecommunications.**

Examples are AUTOSAR for the automotive industry, OMG’s Unified Architecture Framework (UAF®) and ISO Reference Model for Open Distributed Processing.

The architectural design activity creates a network of decisions as its outcome, with some decisions deriving from prior decisions. Decisions can be explicitly documented, along with an explanation of the rationale for each nontrivial decision. Decision analysis provides one approach to architecture evaluation. 

Architecture rationale captures why an architectural decision was made. This includes assumptions made before the decision, alternatives considered, and trade-offs or criteria used to select an approach and reject others. Recording rejected decisions and the reasons for their rejection can also be useful. 

Architectural technical debt has been introduced to reflect that today’s decisions for an architecture may have significant consequences later in the software system’s life cycle. 

Some requirements will be architectural drivers, influencing major decisions about the architecture, while other requirements are deferred to subsequent stages of the software process, such as design or construction.

## Software Architecture Process

In agile approaches, there is not usually an architecture design stage. Although this approach has had some success with user-centric information systems, it is difficult to ensure an adequate architecture emerges for other classes of applications, such as embedded and cyber-physical systems, when critical architectural properties might not be articulated by any user stories.
In enterprise and system-of-systems contexts, as in product lines and families, the overarching architecture (of the enterprise, system or product line/family) provides primary requirements and guidance on the form and constraints upon the software architecture. This baseline can be enforced through specifications, additional requirements, application programming interfaces (APIs) or conformance suites.

There are various contrasts: design often focuses on an established set of requirements, whereas architecture often must shape the requirements through negotiation with stakeholders and requirements analysis. In addition, architecture often must recognize and address a wider range of concerns that may or may not end up as requirements on the software system of interest

Typical concerns in architectural design include the following:
- Overall architecture styles and computing paradigms
- Large-scale refinement of the system into key components
- Communication and interaction among components
- Allocation of concerns and design responsibilities to components
- Component interfaces
- Understanding and analysis of scaling and performance properties, resource consumption properties, and reliability properties
- Large-scale/system-wide approaches to dominating concerns (such as safety and security, where applicable)


## Architectural Design

Architecture analysis gathers and formulates architecturally significant requirements (ASRs), defined as any requirement upon a software system which influences its architecture

ASRs reflect the design problems the architecture must solve. Often the combination of initial requirements and known constraints cannot be satisfied without consequences to cost, schedule, etc. In such cases, negotiation is used to modify incoming needs, requirements and expectations to make solutions possible. Architecture analysis produces ASRs, initial system-wide decisions and any overarching system principles derived from the context 

Synthesis proceeds byworking out detailed solutions to design problems identified by ASRs, and makes trade-offs to accommodate interactions between those solutions. These outcomes feed back to architecture analysis resulting in elaborated ASRs, principles and decisions which then lead to further detailed solution elements.

- architecture implementation: over-seeing implementation and certifying that implementations conform to the architecture
- architecture maintenance: managing and extending the architecture following its implementation
- architecture management: managing an
organization’s portfolio of interrelated architectures
- architecture knowledge management: extracting, maintaining, sharing and exploiting reusable architecture assets, including decisions, lessons learned, specifications and documentation across the organization
 
## Software Architecture Evaluation

### Goodness in Architecture

Of a software system and its architecture, one can ask:
- Is it robust over its lifetime and possible evolution?
- Is it fit for its intended use?
- Is it feasible and cost-effective to construct software systems using this architecture?
- Is it, if not beautiful, then at least clear and understandable to those who must construct, use and maintain the software?

The Architecture Tradeoff Analysis Method (ATAM) provides a methodical approach to evaluating software architectures based on quality attributes in a utility tree and scenarios illustrating the qualities. 
ADs can be queried, examined and analyzed. 

Often architecture documentation is unfinished, incomplete, out of date or nonexistent. In such cases, the evaluation effort must rely on the knowledge of participants as a primary information source.

Active reviews, where instead of checklists, each evaluation item entails a specific activity by a reviewer to obtain the needed information.

Many organizations have institutionalized architecture review practices.

Metrics include component dependency, cyclicity and cyclomatic complexity, internal module complexity, module coupling and cohesion, levels of nesting, and compliance with the use of patterns, styles and (required) APIs.