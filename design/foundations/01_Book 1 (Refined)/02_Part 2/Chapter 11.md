# Role

## 11.1 Intent

Objectives define organisational purpose; capabilities define organisational ability; services expose organisational value. The remaining question is who ensures that capability continues to exist, evolve and deliver value. The answer is not the participant — participants are temporary, organisations persist — but the **Role**.

Part 1 Chapter 5 established that a role is a sustained organisational responsibility, independent of whoever currently fulfils it. This chapter sharpens that definition: a role is not merely accountable for a capability, it is the capability's **guardian**. Most organisational thinking, and most contemporary AI agent design, proceeds from person to role to work. The ontology inverts this: capability comes first, and the role exists because the capability must survive; the participant exists because the role must be exercised; the activity exists because the participant must act. A role is the organisational custodian of one or more capabilities, ensuring that capability remains healthy, governed and continuously improving irrespective of who performs the operational work.

## 11.2 Definition

A **Role** is a persistent organisational responsibility for governing one or more capabilities and the services they provide. A role represents organisational stewardship, existing independently of any human engineer, AI participant or organisational structure. Participants occupy roles; they do not define them, so the lifecycle of a role is organisational rather than operational.

## 11.3 Why Roles Exist

Suppose an organisation possesses an Architecture Capability. Who ensures that architectural principle remains consistent, that architectural knowledge is preserved, that architectural service continues improving, that architectural standard evolves, that architectural decision remains coherent? The answer cannot be "the current architect" — architects change, projects change, technology changes, and the organisation still requires architectural stewardship. That stewardship is the role, protecting organisational capability from organisational change.

## 11.4 Characteristics

A role is **persistent**, outliving participants — an organisation may employ hundreds of developers over decades while the Development Role remains. It exercises **stewardship**: it governs capability, it does not merely perform work. It carries **accountability** that remains even when execution is delegated — execution may vary, responsibility does not. It is **independent** of implementation technology — changing from Java to Rust does not create a new Development Role, and changing AI model does not create a new Requirements Role. And it preserves **continuity** in a way distinct from the continuity participants provide: roles preserve organisational continuity, participants provide only operational continuity.

## 11.5 Role versus Participant, Role versus Capability

Traditional organisations blur these concepts freely — "John is the architect" sounds entirely reasonable. Within the ontology this is technically imprecise: John occupies the Architecture Role, which exists independently of John, exactly as an AI participant may temporarily occupy the Testing Role while the role itself remains organisationally persistent. This distinction matters increasingly as AI participants are dynamically instantiated: participants become transient, roles remain.

Capability and role are equally distinct. Requirements Engineering is a capability; Requirements Steward is a role. Architecture is a capability; Architecture Steward is a role. Testing is a capability; Quality Steward is a role. The capability performs no work. The role performs no work. The participant performs work. The role governs; the capability exists.

## 11.6 Responsibilities

Every role carries several categories of responsibility: **capability stewardship**, ensuring the capability remains effective; **service governance**, ensuring the services it exposes satisfy organisational expectation; **knowledge stewardship**, maintaining the organisational knowledge relevant to the capability; **standards**, defining and evolving engineering convention; **decision authority**, approving organisational decision within the capability's domain; and **organisational learning**, improving the capability through evidence. These responsibilities continue irrespective of which participant currently occupies the role.

## 11.7 Role Composition and Hierarchy

Complex organisational responsibility frequently requires collaboration between multiple roles — Software Delivery may involve a Requirements Steward, Architecture Steward, Implementation Steward, Quality Steward, Release Steward and Operations Steward, each governing its own capability while collectively governing the larger organisational outcome. Roles therefore compose organisational governance much as capabilities compose organisational ability.

This is distinct from reporting hierarchy. Traditional organisations define reporting relationships that are administrative; the ontology instead recognises governance relationships that are operational. An Architecture Steward need not manage Development Stewards, yet because Development Capability depends on Architecture Capability, their roles collaborate — authority follows capability dependency, not the organisational chart.

## 11.8 Role Lifecycle

A role moves through identifiable states: **defined**, when the organisation recognises the need for capability stewardship; **established**, once responsibility has been formally specified; **operational**, while participants actively occupy it; **improving**, as its governance evolves through organisational learning; and **retired**, once the underlying capability no longer exists. Role retirement therefore follows capability retirement, never participant retirement.

## 11.9 Stewardship versus Ownership

The software industry speaks readily of "ownership" — teams own products, developers own modules, architects own designs. The ontology deliberately avoids this language: ownership implies possession, stewardship implies responsibility. Capabilities belong to the organisation; roles steward them; participants temporarily exercise that stewardship. The organisation therefore remains the true owner of every engineering asset, reinforcing organisational continuity.

## 11.10 Relationships

Within the ontology, a Role governs one or more Capabilities and the Services they expose; may be occupied by one or more Participants; performs no Activities directly; approves organisational Decisions; maintains organisational Knowledge; operates under organisational policy; and contributes Evidence through its own governance activity. The role therefore becomes the organisational control point.

## 11.11 Invariants

A role shall govern at least one capability. A role shall exist independently of participants. A role shall possess clearly defined responsibility. A role shall maintain organisational knowledge. A role shall define governance authority. Violation of these invariants indicates organisational ambiguity.

## 11.12 Operational Semantics

Roles do not execute engineering work. Participants execute work while acting within a role; the role defines expectation, approves outcome, maintains standard, protects organisational capability, learns from evidence and improves organisational behaviour. The participant merely exercises the role temporarily.

## 11.13 AI Implications

Artificial intelligence fundamentally changes role occupancy. Traditional organisations generally associate one participant with one role; AI participants may simultaneously occupy multiple roles, and multiple AI participants may collaborate within a single role, entering and leaving dynamically. Despite this flexibility, role identity remains unchanged — the organisation becomes significantly more elastic while preserving governance, a property developed fully in Part 1 Chapter 3 §3.3's treatment of Principle 2 (Roles Are Organisational Constructs).

## 11.14 Chapter Summary

Roles are not participants, and they are not job titles — they are organisational stewardship constructs that preserve capability, govern service, maintain knowledge, approve decision and improve organisational learning. Participants come and go; capabilities evolve; roles ensure that organisational ability survives both. The next chapter formally specifies the **Participant**, the operational entity — human or artificial — that temporarily occupies roles and performs engineering activity.
