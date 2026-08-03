# Activity

## 13.1 Intent

Objectives define organisational purpose; capabilities define organisational ability; services define organisational value; roles provide organisational stewardship; participants perform work. The remaining question is what constitutes the fundamental unit of organisational behaviour. The answer is the **Activity**.

Most software engineering methodology defines an activity as a task performed by a person. Part 1 Chapter 4 §4.2 already previews the stronger definition below, and this chapter formalises it in full: an activity is not work in the colloquial sense — it is the smallest observable organisational behaviour that changes the state of the organisation. Every requirement analysed, every architectural decision approved, every source file modified and every deployment performed is an activity in this sense. Unlike capability, an activity is transient; unlike a participant, it is not an actor; unlike an artefact, it is not a persistent output. Activities are events of organisational behaviour.

## 13.2 Definition

An **Activity** is a bounded organisational action, performed by one or more participants while occupying one or more organisational roles, that produces an observable change in organisational state. Every activity occurs within organisational governance, contributes toward one or more organisational services, and produces an observable outcome.

## 13.3 Why Activities Exist

Capability describes organisational potential; activity realises it. The Requirements Engineering Capability itself performs nothing — it enables activity such as discovering stakeholder need, analysing business rule, validating requirement and approving requirement specification. Implementation Capability enables activity such as designing a software component, modifying source code, executing an automated build and refactoring an implementation. Without activity, capability remains potential; through activity, it becomes organisational behaviour.

## 13.4 Characteristics

An activity is **atomic**: it represents a single organisational action rather than combining several unrelated outcomes — "Approve Architecture" is an activity, "Design, Implement, Test and Deploy" is not, and atomicity is what enables precise organisational reasoning. It is **observable**: the organisation must be able to determine when it occurred, who performed it, why it occurred and what changed, since an activity hidden from organisational observation cannot contribute to organisational learning. It is **governed**, occurring only within organisational policy, standard, role assignment, capability constraint and service contract. It is **state-changing** — requirement status changing, architecture being approved, source code being modified, knowledge being refined, decision being recorded — and if no organisational state changes, the action should not be modelled as an activity at all. And it is **traceable**: the organisation should always be able to identify which objective motivated it, which capability performed it, which participant executed it, which artefacts resulted and which evidence was generated.

## 13.5 Activities versus Services, versus Tasks

Activities and services are frequently confused. A service represents organisational value; an activity represents work. The service "Provide Approved Architecture" is realised through activities such as reviewing the architecture, analysing constraint, evaluating alternative and approving the design. Consumers request services; participants perform activities — the distinction separates organisational outcome from operational execution (Chapter 10 develops the Service side of this distinction in full).

Activities should also not be confused with project-management **tasks**. A task such as "implement authentication" may involve many activities — analysing requirement, designing interface, modifying implementation, executing test, reviewing implementation, approving release — so activities provide considerably finer organisational granularity than task planning does.

## 13.6 Activity Context and Lifecycle

No activity exists in isolation. Every activity executes within a minimum organisational context comprising its objective, capability, service, role, participant, governing policy, input and expected outcome — without which its organisational significance cannot be determined.

An activity moves through a defined lifecycle: **planned**, when the organisation intends it to occur; **authorised**, once governance has permitted execution and required approval has been obtained; **executing**, while participants perform the organisational work; **completed**, once the intended state change has occurred; **verified**, once evidence confirms successful completion; and **archived**, once its historical record becomes part of organisational memory. Activities themselves are transient; their history persists.

## 13.7 Activities, State, Events and Evidence

One distinguishing characteristic of the ontology is that activities explicitly modify organisational state — a requirement moving from Draft to Approved, an architecture from Proposed to Accepted, a feature from Implemented to Verified, a participant from Qualified to Assigned, a capability from Operational to Improving, a knowledge item from Candidate to Verified. The organisation therefore behaves as a state machine, with activities as its transitions.

Every activity also generates one or more organisational **events** — Requirement Approved, Architecture Accepted, Test Failed, Deployment Completed, Decision Recorded, Knowledge Verified — representing facts, where activities represent behaviour; this distinction lets organisational history be reconstructed independently of current organisational state. And every activity generates **evidence** — source code, review comment, approval record, test report, performance measurement, meeting transcript — providing the basis on which organisational knowledge is subsequently established (Chapter 15 formalises Evidence in full). Activities are therefore the primary producers of organisational evidence.

## 13.8 Relationships

Within the ontology, an Activity realises one or more Services; is performed by one or more Participants; is governed by one or more Roles; belongs to exactly one Capability; produces one or more Artefacts; generates Evidence; may create or update Knowledge; may record Decisions; and operates under organisational policy. These relationships position the Activity as the central behavioural entity of the organisation.

## 13.9 Invariants

An activity shall belong to exactly one capability. An activity shall produce an observable organisational state change. An activity shall execute within organisational governance. An activity shall generate evidence. An activity shall be traceable to one or more organisational objectives. Violation of these invariants indicates incomplete organisational modelling.

## 13.10 Operational Semantics

Participants perform activity while occupying roles; activity realises service; service exposes capability; capability fulfils objective. Activity generates artefact; artefact becomes evidence; evidence refines knowledge; knowledge improves future capability. Activities therefore form the behavioural engine of the AI Software Organisation — every observable organisational change ultimately occurs because one or more activities have been executed.

## 13.11 AI Implications

Artificial intelligence fundamentally changes activity execution. Activity may become continuous, parallel, self-triggered, adaptive and predictive. Traditional organisations execute activity largely because humans schedule it; AI-native organisations may execute activity because organisational condition requires it — a new dependency vulnerability appears, no human requests analysis, and the Security Capability automatically initiates a vulnerability assessment activity. This is not automation alone. It is goal-directed organisational behaviour, and it is developed fully in Part 1 Chapter 6 §6.10's treatment of AI-native capability.

## 13.12 Chapter Summary

Activities are the smallest observable units of organisational behaviour, transforming organisational capability into organisational action. Unlike a task, an activity is defined by its organisational significance rather than by project planning; unlike a service, it describes work rather than value. By modelling activity as state-changing organisational behaviour, the ontology provides a precise foundation for traceability, organisational learning and continuous improvement. The next chapter formally specifies the **Artefact**, examining how the persistent outputs of activity become the long-term memory of the organisation.
