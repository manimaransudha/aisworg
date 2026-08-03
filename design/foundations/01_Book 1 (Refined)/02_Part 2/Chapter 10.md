# Service

## 10.1 Intent

Capabilities describe what an organisation is able to accomplish, but organisations do not exist merely to possess capability — capability exists because it produces value, and that value is realised through the **Service**. Part 1 Chapter 7 argued this at length and drew a deliberate line against the conventional software-architecture reading of the term: a service is not an API. An API exposes functionality; a service exposes *value*. Within the AI Software Organisation, a service is the mechanism through which one capability delivers value to another capability, participant, project or external stakeholder — the operational interface of the organisation, exposing outcome rather than internal behaviour, letting capability evolve internally while organisational interaction remains stable.

## 10.2 Definition

A **Service** is a governed commitment by a capability to produce a defined outcome for one or more consumers. A service specifies what value will be delivered, under what condition, to whom, and with what quality expectation — but it does not specify *how* the value is produced. Implementation remains entirely within the capability; the service forms the contractual boundary between capabilities.

## 10.3 Why Services Exist

An organisation does not benefit merely because its architects possess expertise — it benefits because architectural guidance becomes available to others. Testing capability creates value because it provides confidence about software quality; knowledge capability creates value because it enables organisational understanding; security capability creates value because it reduces organisational risk. Every capability exists only because it provides one or more services — without them, capabilities become isolated organisational resources; with them, they become participants in organisational value creation (Part 1 Chapter 7 §7.2 develops this argument in full).

## 10.4 Characteristics

A service is **value-oriented** — it always produces value for an identifiable consumer, and a service with no identifiable consumer should be questioned. It is **observable**: consumers observe outcome, not the internal work that produced it — a Development capability may spend weeks implementing a feature, but the consuming capability observes only "implemented software component available." It is **stable**, expected to evolve more slowly than its implementation, so the organisation remains free to improve internal process without continually changing service expectation. It is **governed**, operating within organisational policy — quality expectation, security policy, compliance rule, architectural principle — that regulates its behaviour independently of implementation. And it is **measurable**: consumers should be able to determine whether the promised service has actually been delivered, so every service possesses observable success criteria.

## 10.5 Service Contract

Every service should possess an explicit contract, defining organisational expectation independently of implementation: its **purpose** (why the service exists), its **provider** (which capability provides it), its **consumers** (which organisational entities consume it), its **inputs** (what artefact or request is required), its **outputs** (what value is delivered), its **preconditions** and **postconditions** (what must be true before and after execution), its **quality expectations** (accuracy, timeliness, completeness, compliance, reliability), and the **evidence produced** to demonstrate successful delivery. No implementation detail appears in any of these — the contract describes organisational expectation, not operational procedure (Part 1 Chapter 7 §7.6 specifies the Service Contract in full, including a worked example).

## 10.6 Services versus Activities, and Service Consumers

Activities frequently resemble services but represent fundamentally different concepts: executing a regression test suite is an activity; providing a verified regression assessment is a service. One describes work, the other describes organisational value. Activities belong to participants; services belong to capabilities — a distinction that separates operational execution from organisational responsibility, developed fully in Chapter 13 (Activity).

Every service has one or more consumers — other capabilities, projects, governance function, human or artificial participant, external customer, regulatory authority — and because consumers determine whether a service has delivered the expected value, services should always be defined from the consumer's perspective rather than the provider's. Services divide naturally into **internal services**, consumed entirely within the organisation (architecture review, code review, knowledge validation, traceability generation, configuration management), and **external services**, consumed outside it (software delivery, customer support, technical documentation, operational reporting, regulatory submission). Both remain services; the distinction lies only in the consumer (Part 1 Chapter 7 §7.7 develops this distinction and its strategic implications further).

## 10.7 Service Networks and Composition

Services rarely exist independently — they form interconnected value networks. Developing a software feature, for instance, flows through Requirement Specification, Architecture, Implementation, Verification, Security Assessment, Release Approval, Deployment and Operational Monitoring services in sequence, each consuming organisational value and producing new value in turn, the organisation behaving as a network of value transformation rather than a sequence of engineering task. Complex organisational outcome — "Deliver Production Feature," for example — does not belong to any single capability but emerges through the coordinated composition of many services (Part 1 Chapter 7 §7.9 develops Service Composition fully, including how it lets organisations absorb new requirements, such as a regulatory privacy assessment, by composing in an additional service rather than redesigning process).

Services evolve more slowly than activities but more rapidly than capabilities: objectives remain comparatively stable, capabilities evolve gradually, services evolve as organisational expectation changes, activities change continuously, and participants change most frequently of all. This layered rate of change provides organisational stability while permitting continual operational improvement.

## 10.8 Relationships

Within the ontology, a Service is produced by exactly one Capability; may contribute to one or more Objectives; may invoke other Services; is governed by organisational policy; produces organisational Artefacts; generates organisational Evidence; is realised through Activities; and is consumed by one or more consumers. These relationships establish the Service as the organisational interface through which value flows.

## 10.9 Invariants

A service shall have exactly one owning capability. A service shall produce observable organisational value. A service shall define one or more consumers. A service shall possess explicit success criteria. A service shall produce evidence supporting organisational evaluation. Violation of these invariants represents an organisational design defect.

## 10.10 Operational Semantics

Operationally, a capability exposes service; consumers request service; participants perform activity; activity produces artefact; artefact generates evidence; evidence validates service delivery; knowledge improves future service quality. The organisation therefore behaves as a continuously improving network of service-producing capability.

## 10.11 AI Implications

Artificial intelligence fundamentally changes the economics of service. Historically, many services were periodic because continuous execution was prohibitively expensive — architecture reviewed monthly, compliance audited quarterly, documentation lagging implementation. Artificial intelligence enables many of these services to become continuous, so the primary benefit of AI is not merely faster execution but continuous organisational awareness — a shift examined fully in Part 1 Chapter 7 §7.8, which changes the role of the software engineering organisation from a periodically managed system to a continuously adaptive one.

## 10.12 Chapter Summary

Services define how capabilities exchange value. Capabilities explain what the organisation can do; services expose those abilities; activities realise them; evidence validates them; knowledge improves them. The service becomes the organisational equivalent of a public interface, letting capability evolve independently while organisational collaboration remains stable. The next chapter formally specifies the **Role**, not as a job title but as the organisational custodian of capability and the services it provides.
