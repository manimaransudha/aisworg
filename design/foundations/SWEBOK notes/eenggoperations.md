# Software Engineering Operations

Software engineering operations refers to the set of activities and tasks necessary to deploy, operate and support a software application or system while preserving its integrity and stability. These activities include the deployment and configuration of the software in the targeted operational environments and the monitoring and management of the application while it is in use (until it is retired). Once the application is operational, software engineering operations must manage any defects that are uncovered, any changes made to the system software environment and hardware equipment over time, and any new user requirements that surface.

Some organizations use the the concept of Platform Engineering and Site Reliability Engineering (SRE) to increase productivity and software quality. The role of platform engineering is to build and manage self-service platform capabilities that can be used by software engineers to develop, deploy, and operate software applications. On the other hand, the role of SRE is to monitor, automate, and improve software operations with respect to non-functional aspects, including availability, performance, latency, and security. SRE is also responsible for change management, emergency response, capacity planning, and overall efficiency of software systems.

Operations engineer, who is responsible for developing operations services made available as a service and accessible through an application programming interface (API), and software engineer, who can use the resulting operations services (available as a service) to independently deploy and manage applications without directly involving IT operations specialists.

Operations engineer works closely with software engineers to develop and offer operations services such as the following:
- Provisioning, deployment, configuration, and support for containers and virtual servers
- Designing and offering on-demand services (e.g., environment on demand, versioning, continuous integration (CI) and testing, deployment, and surveillance) for use by software engineering
- Monitoring and troubleshooting system and application software incidents by running diagnostics, documenting problems and resolutions, prioritizing problems, and assessing impact of issues
- Performing, automating and implementing appropriate processes for security, data protection and failover procedures
- Overseeing capacity, storage planning and database management system
(DBMS) performance
- Providing documentation and technical specifications to IT staff for planning and implementing new or upgraded IT infrastructure and system software

ISO/IEC/IEEE 20000-1 is the reference standard that presents an overview of operations processes. 

- service delivery processes, release processes, control processes, resolution processes and relationship processes. 

This international standard describes four main operations process activities: 
- prepare for the operation: that requires to define an operation strategy; 
- perform the operation: which consist of operating and monitoring; 
- manage the results of operation:where anomalies are recorded and addressed;
- support the customer: which means to give assistance and consultation to any user of the operations services.

## Software Engineering Operations Planning

Operations engineers should document their software engineering operations steps and tools, using any type, form or medium suitable for the purpose (e.g., Wikis, documents, and more). The following topics are typically considered suitable as evidence of well documented operations:

- Policies and plans,
- Service documentation,
- Procedures,
- Processes,
- Process control records

Operations and maintenance plan should address the following:

- Scope of the operations and software maintenance,
- Adaptation of the software engineering operations process and tools,
- Identification of the software engineering operations organization,
- Estimate of software engineering operations and maintenance costs.

Develop a software engineering operations plan, or concept of operations (CONOPS). This plan should be prepared during software development and should specify how users will request software modifications and report problems or
issues when the software will be operational.

The operations organization must conduct business planning activities (e.g., budgetary, financial and human resources), just as all the other divisions of the organization with a number of planning perspectives, including the following:

- The roles and responsibilities for implementing, operating and maintaining the new or changed service,
- Activities to be performed by customers and suppliers,
- Changes to the existing service management framework and services,
- Communication to the relevant parties,
- New or changed contracts and agreements to align with changes in business needs,
- Staffing and recruitment requirements,
- Skills and training requirements (e.g. users, technical support), Processes, measures, methods and tools to be used in connection with the new or changed service,
- Capacity management,
- Financial management,
- Budgets and timescales,
- Service acceptance criteria, and
- The expected outcomes from operating the new service, expressed in measurable terms.

- typically defined as the development environment, the testing or quality assurance (QA) environment, the preproduction environment, and the production environment.

DevOps recommends that the creation of all the different environments be automated and built from a single code repository. In mature DevOps organizations, the creation of the different environments is completely automated and made available as a service.     

Service availability and continuity must be managed to ensure that customer commitments are met.

- Software Capacity Management
- Software Backup, Disaster Recovery, and Failover
- Software and Data Safety, Security, Integrity, Protection, and Controls

- In line with the evolution of DevOps, DevSecOps is promoting the integration
of security early and throughout the software process, which includes the integration of different security mechanisms and tools at the operations level. The goal is to automate the detection and correction of security issues as early as possible in the overall process.

- Continuous delivery (CD) is a software engineering practice that uses automated tools to provide frequent releases of new systems (including software) to staging or various test environments. CD continuously assembles the latest code and configuration from the head into release candidates
- Continuous testing is a software testing practice that involves testing the software at every stage of the software development life cycle. Continuous testing aims to evaluate the quality of software at every step of the CD process by testing early and often. Continuous testing involves various stakeholders, such as developers, DevOps personnel, and QA and end-users
- Continuous deployment (aka CD) is an automated process of deploying changes to production by verifying intended features and validations to reduce risk 
- Different container/virtualization technologies and management tools (also called orchestrators) are available to operations engineers to improve the scalability of applications and standardize software deployment across multiple computer and server suppliers
- To enable fast and constant feedback to the developers, testing must be automated as much as possible throughout the entire software delivery process
- Monitoring and telemetry are key aspects of software engineering operations

