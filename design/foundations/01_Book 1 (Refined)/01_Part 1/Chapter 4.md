# The SEU Meta-Model

## 4.1 Introduction

Chapter 3 established that formalising the SEU requires distinguishing three things that are easy to conflate: what the organisation *is*, how it *reasons*, and how it *executes*. It named these three layers — **SEU Structure**, **SEU Loops** and **Workbench** — without developing any of them. This chapter is where that development begins.

*[Placeholder: a short bridge paragraph belongs here once Parts 2-4 are settled, explaining why the SEU needs to be explicitly, formally representable at all — the argument that human organisations tolerate implicit, undocumented convention in a way artificial participants cannot. Earlier drafts of this chapter made that argument at length under the name "Organisational Operating Model"; whether it's still needed here, or is now redundant with Chapter 3 §3.2's "intelligence alone is insufficient" argument, is a decision for that later pass.]*

## 4.2 SEU Structure: What the Organisation Is

SEU Structure is the static entity layer of the meta-model: the organisational entities that exist, and the trace relationships that connect them. This section introduces all thirteen briefly, in the order each depends on the last; Part 2 takes each of them further.

- **Objective** — a persistent statement of organisational intent: it defines why the organisation, or a given capability, exists, without prescribing how that purpose is achieved. Objectives exist at several levels of abstraction — strategic, operational and engineering — and every other entity below must ultimately trace back to one or more of them. An objective is not a goal (the measurable target that makes it concrete at a point in time), a requirement (the system property it motivates) or a strategy (the approach chosen to pursue it).
- **Capability** — the enduring organisational ability required to achieve an objective: what the organisation must be able to do, independent of who performs the work or how it is currently implemented. Capabilities are persistent and composable, and they belong to the organisation rather than to any participant — the distinction that separates a capability from a competency.
- **Service** — a specific, contracted output through which a capability exposes what it can do to the rest of the organisation, without exposing how it is done. Where a capability is an enduring ability, a service is what that ability actually delivers, on terms other capabilities can depend on — the organisation's real point of interdependency.
- **Role** — a sustained organisational responsibility, established to realise one or more capabilities, that exists independently of who or what currently fulfils it. Roles carry authority, accountability and constraint; governance attaches to the role rather than to whoever occupies it, which is what lets participants change without disturbing organisational accountability.
- **Participant** — the operational entity, human, artificial, or a collaboration of both, that fulfils one or more roles and performs the activity a role requires. Participants are implementation; the organisation is not — competency belongs to the participant, authority belongs to the role, and the two are deliberately kept separate.
- **Competency** — the demonstrable ability a participant needs to fulfil a role's responsibility effectively. Competency is not a peer of the entities around it but a characteristic of Participant: capabilities belong to the organisation, competencies belong to whoever is performing the work, and representing competency explicitly is what lets it be replicated across many participants rather than remaining scarce.
- **Activity** — the smallest unit of organised work that changes the state of the organisation or advances an objective: an organisational concept, not merely a task assigned to an individual. Activities are transient and belong to the organisation; participants execute them, but the organisation defines them.
- **Artefact** — a persistent output of activity that preserves organisational state, intent or knowledge beyond the lifetime of the activity that produced it. An artefact is not itself knowledge — it is the medium through which knowledge is represented and preserved.
- **Evidence** — observable, verifiable information that supports, refutes or qualifies an organisational claim: what turns an assertion into a justified conclusion. Evidence differs from raw data in that it has been interpreted against organisational context, and from artefact in that it is what an artefact is shown to demonstrate.
- **Knowledge** — verified organisational understanding, supported by evidence and accepted for organisational use. It belongs to the organisation rather than to any participant, which is what lets organisational understanding survive participant turnover.
- **Decision** — a persistent organisational entity recording an authorised choice, made on the basis of available knowledge and evidence, in pursuit of one or more objectives. A decision is distinct from the act of deciding: it persists, carries its own rationale, and can be reviewed, reaffirmed or superseded long after the moment that produced it has passed.
- **Governance** — the organisational system of principle, policy, authority and control that regulates behaviour across every other entity in this list. It does not sit beside them as a peer; it intersects all of them, comprising **Policy** (mandatory constraint on what may be done) and **Standard** (preferred convention for how work is normally performed).
- **Trace Relationship** — the explicit, formally recognised dependency that connects two or more of the entities above while preserving the meaning of their relationship: objective to capability, capability to service, activity to artefact, evidence to knowledge, and so on. If the entities above are the vocabulary of the organisation, trace relationships are its grammar.

Together, these thirteen elements are what this work means by organisation: not a hierarchy of people and departments, but a network of purpose, ability and value exchange, connected by explicit relationship and regulated throughout by governance. Chapters 5 through 7 develop the three at the centre of that network — Objective, Capability and Service — in full; Chapters 8 through 18 define all eleven entities formally, one per chapter.

## 4.3 SEU Loops: How the Organisation Reasons

SEU Loops are the recurring cycles through which the entities above interact to produce understanding and decision. Part 3 develops these in full.

*[Placeholder: name and briefly gloss each loop once Part 3 is settled (the Organisational Reasoning Cycle, the Capability Reasoning Network, and any others that emerge from that work). One line each, same discipline as §4.2.]*

## 4.4 Workbench: How the Organisation Executes

Workbench is the environment within which SEU Structure and SEU Loops are put to work: objective translated into executable intent, coordinated through collaboration. Part 4 develops this in full.

*[Placeholder: name and briefly gloss Workbench's own core constructs once Part 4 is settled (Deliverable, Workflow, and whatever else that Part's own architecture settles on). One line each.]*

## 4.5 Chapter Summary

*[Placeholder: once §4.2-4.4 are filled in against settled Parts 2-4, this closes the chapter the way every other Part 1 chapter does — a short prose recap plus a numbered list continuing the manifesto (items 16 onward). Not drafted yet, deliberately, so it isn't built on specifics that may still change.]*
