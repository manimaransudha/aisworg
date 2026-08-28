# Software Design

A software design description (SDD) documents the result of software design. It is a “representation of software created to facilitate analysis, planning, implementation, and decision-making. The software design description is used as a medium for communicating software design information and can be thought of as a blueprint or model of the system.

Software design takes place in three stages:
- architectural design of the software system
- high-level or external-facing design of the system and its components
- detailed or internal-facing design

## Software Design Fundamentals

Deisgn thinking process (Ross, Goodenough and Irvine) consists of five basic steps: 
(1) crystallize a purpose or objective
(2) formulate a concept for how the purpose can be achieved
(3) devise a mechanism that implements the conceptual structure 
(4) introduce a notation for expressing the capabilities of the mechanism and invoking its use 
(5) describe the usage of the notation in a specific problem context to invoke the mechanism so the purpose is achieved

issues “deal with some aspect of software’s behavior that is not in the application domain, but which addresses some of the supporting domains” [2]. Such issues, which often crosscut the system’s functionality, are referred to as aspects, which “tend not to be units of software’s functional decomposition, but rather to be properties that affect the performance or semantics of the components in systemic ways” 

Software design principles include the following:
- Abstraction is “a view of an object that focuses on the information relevant to a particular purpose and ignores the remainder of the information” 
- Separation of concerns (SoC). A design concern is an “area of interest with respect to a software design”. By identifying and separating concerns, the designer can focus on each concern for the system in isolation 
- Modularization (or refinement or decomposition) structures large software as comprising smaller components or units 
- Encapsulation (or information hiding) builds upon the principles of abstraction and modularization so that nonessential information is less accessible, allowing users of the module to focus on the essential elements at the interface
- Separation of interface and implementation is an application of encapsulation that involves defining a component by specifying its public interfaces, which are known to and accessible to clients;
- Coupling is defined as “a measure of the interdependence among modules in a computer program”. Most design methods advocate that modules should be loosely or weakly coupled.
- Cohesion (or localization) is defined as “a measure of the strength of association of the elements within a module”. Cohesion highlights organizing a module’s constituents based on their relatedness. Most design methods advocate that modules should maximize their cohesion/locality.
- Uniformity is a principle of consistency across software components — common solutions should be produced to address common or recurring problems.
- Completeness (or sufficiency) means ensuring that a software component captures the important characteristics of an abstraction and leaves nothing out. 
- Verifiability means that information needed to verify the design against its requirements and other constraints is available. 
- The general principles of Ethically Aligned Design are human rights, well-being, data agency, effectiveness, transparency, accountability, awareness of misuse, and competence.

## Software Design Processes

The architectural design stage defines a computational model, the major computational elements, and the important protocols and relationships among them. This stage develops strategies to address crosscutting concerns, such as performance, reliability, security and safety, and articulation of crosscutting decisions, including system-wide styles (e.g., a transactional n-tier style versus a pipes and filters style, together with the rationale for such decisions).
The high-level design stage includes identification of the primary computational elements and significant relationships among them, with a focus on each major component’s existence, role and interfaces. That definition should be sufficiently detailed to allow designers or programmers of client components to correctly and efficiently access each service’s capabilities — without having to read its code.
The detailed design stage defines each module’s internal structure, focusing on detailing and justifying choices of algorithms, data access and data representation. The detailed design specifications should be sufficient to allow programmers

## Software Design Qualities 

- Concurrency: Design for concurrency concerns how software is refined into concurrent units such as processes, tasks, and threads and the consequences of those decisions with respect to efficiency, atomicity, synchronization and scheduling.
- Control and Event Handling: Event handling is concerned with how to organize control flow as well as how to handle reactive and temporal events through various mechanisms including synchronization, implicit invocation and callbacks.
- Data Persistence: Data persistence concerns the storage and
management of data throughout the system.
- Distribution of Components: Distribution concerns how software components are distributed across hardware (including computers, networks and other devices) and how those components communicate while meeting performance, reliability, scalability, availability, monitorability, business continuity and other expectations.
- Errors and Exception Handling, Fault Tolerance: This concern pertains to how to prevent, avoid, mitigate, tolerate and process errors and exceptional conditions.
- Integration and Interoperability: This issue arises at the enterprise or system-of-systems level or for any complex software when heterogeneous systems or applications need to interwork through exchanges of data or accessing one another’s services. Within a software system, the issue arises when components are designed using different frameworks, libraries or protocols.
- Assurance, Security, and Safety: Design for security concerns how to prevent unauthorized disclosure, creation, change, deletion, or denial of access to information and other resources in the face of attacks upon the system or violations of system policies to limit damage; provide continuity of
service; and assist repair and recovery. Design for safety pertains to managing the software’s behavior in circumstances which might lead to harm to or loss of human life or damage to property or the environment.
- Variability: Variability concerns permissible variations in a software system. It is a fundamental aspect of most software. It is the ability to create software system variants for different market segments or contexts of use.

## Recording Software Designs

- Model-Based Design (MBD) is an approach to recording designs where models play an important role.
- Structural Design Descriptions
    - Class and object diagrams 
    - Component diagrams
    - Class responsibility collaborator cards
    - Deployment diagrams 
    - Entity relationship diagrams 
    - Interface description languages
    - Structure charts
- Behavioral Design Descriptions
    - Activity diagrams
    - Interaction diagrams
    - Data flow diagrams
    - Decision tables and diagrams
    - Flowcharts 
    - State (transition) diagrams and statecharts
    - Formal specification languages 
    - Pseudocode and program design languages

- Design Patterns and Styles
    - Creational patterns (e.g., builder, factory, prototype, singleton)
    - Structural patterns (e.g., adapter, bridge, composite, decorator, façade, fly-weight, proxy)
    - Behavioral patterns (e.g., command, interpreter, iterator, mediator, memento, observer, peer-to-peer, publish-subscribe, state, strategy, template, visitor)
- Specialized and Domain-Specific Languages

## Software Design Strategies and Methods

- General Strategies: divide-and-conquer and stepwise refinement strategies; top-down vs. bottom-up strategies; strategies using heuristics, patterns and pattern languages; and iterative and incremental approaches.
- Function-Oriented (or Structured) Design
- Data-Centered Design
- Object-Oriented Design
- User-Centered Design
- Component-Based Design
- Event-Driven Design
- Aspect-Oriented Design 
- Constraint-Based Design
- Domain-Driven Design

## Software Design Quality Analysis and Evaluation

- Design Reviews and Audits
- Quality Attributes
- Quality Analysis and Evaluation Techniques