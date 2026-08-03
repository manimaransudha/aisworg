# The Deliverable

## 23.1 Introduction

Software engineering organisations exist to transform intent into outcome. A customer requests a feature; an operational incident requires investigation; a vulnerability must be resolved; a regulatory change demands implementation; a legacy system requires modernisation. These situations differ considerably, yet share a common characteristic: each represents organisational intent requiring coordinated execution.

Traditional software engineering represents such intent through many different constructs — requirement, user story, defect, task, epic, change request, support ticket, work order — a diversity that reflects differences in tooling rather than differences in organisational behaviour. The AI Software Organisation unifies these constructs under a single concept: the **Deliverable**, the organisational representation of intent undergoing execution.

## 23.2 Definition

A **Deliverable** is a persistent organisational entity representing a bounded unit of organisational intent whose lifecycle is managed through the coordinated reasoning of one or more capabilities. It is not merely a request — it carries organisational purpose, organisational context, execution history, organisational knowledge, decision, evidence and governance state together, making it the primary execution entity within the organisation.

It is worth being precise about what kind of thing this is. The Deliverable is not a twelfth ontology entity alongside Objective, Capability, Service, Role, Participant, Activity, Artefact, Evidence, Knowledge, Decision and Governance (Part 2 formalises all eleven). It introduces no new organisational concept. It is instead the **execution aggregate** that binds those eleven concepts together for a single piece of organisational intent — the digital representation of that intent under execution, not a ticket that happens to be stored in Jira, Azure DevOps, GitHub Issues or ServiceNow. Those tools become repositories or views of the Deliverable; the Deliverable itself belongs to the organisation, which is what frees the underlying model from any particular ALM tool.

## 23.3 Why Deliverables Exist

Without a unifying Deliverable, organisational reasoning fragments: requirement exists independently, defect exists elsewhere, architectural decision becomes disconnected, testing operates separately, knowledge becomes difficult to correlate, and traceability becomes expensive to reconstruct after the fact. The Deliverable solves this fragmentation by becoming the organisational container through which all reasoning associated with a particular intent accumulates — the organisation reasons about Deliverables, not about isolated engineering artefact.

## 23.4 Intent-Centric Execution

The defining characteristic of a Deliverable is that it represents **intent**, not implementation — "implement customer authentication," "resolve payment failure," "recover legacy business rules," "improve system scalability," "comply with new regulation" each describe an organisational intention, with implementation emerging later through organisational reasoning. This ordering matters: it prevents premature commitment to a technical solution before the organisation has actually reasoned about the problem.

## 23.5 Deliverable Categories

Different organisations will define different categories, but typical ones include **Feature** (new organisational capability), **Change** (modification of existing behaviour), **Defect** (correction of unintended behaviour), **Incident** (restoration of operational capability), **Investigation** (acquisition of organisational understanding), **Technical Debt** (improvement of organisational quality), **Compliance** (satisfaction of governance obligation), and **Knowledge Recovery** (recovery of organisational understanding from legacy systems). The ontology deliberately permits organisations to define further categories as needed.

## 23.6 Identity, Context and Lifecycle

Every Deliverable possesses persistent organisational identity, surviving participant replacement, capability reassignment, workflow change, tool migration and implementation technology change alike — remaining stable throughout its organisational lifecycle regardless of what changes around it.

It also exists within rich organisational context, referencing at minimum its objective, originating capability, requested service, priority, risk, applicable policy and constraint, related organisational knowledge, associated evidence, related artefact and prior decision. This context is what lets capabilities reason about a Deliverable rather than merely execute against it.

Unlike a traditional lifecycle model, the Deliverable does not simply progress through engineering stage — it evolves through organisational understanding. Typical states include **created** (intent recorded), **under reasoning** (capabilities analyse organisational implication, evidence accumulates, knowledge develops), **planned** (organisational approach accepted), **authorised** (governance permits execution), **executing** (capabilities collaboratively realise intent), **verified** (evidence demonstrates the intended outcome), **accepted** (objective satisfied), and **closed** (execution concludes, knowledge remains). That "under reasoning" occupies its own distinct lifecycle state — rather than being folded silently into "in progress" — is itself a departure from how traditional software engineering models work; reasoning is treated as a first-class stage of execution, not an invisible precursor to it.

## 23.7 Deliverables and the ORC, and Across Capabilities

Each Deliverable undergoes repeated reasoning: activity creates artefact, artefact generates evidence, evidence refines knowledge, knowledge informs decision, decision triggers further activity. The Deliverable, in other words, carries its own Organisational Reasoning Cycle, and multiple iterations of that cycle may occur before its organisational intent is fully realised (Part 3 Chapter 19 formalises the ORC in full).

Deliverables also do not belong permanently to one capability — they travel between capabilities. Requirements Capability reasons first; Architecture Capability contributes; Implementation Capability executes; Testing Capability evaluates; Operations Capability observes; Knowledge Capability learns. Each capability enriches the Deliverable as it passes through, so that it accumulates organisational understanding rather than merely accumulating status updates.

## 23.8 Deliverables versus Tickets

The distinction matters. A ticket records work to be performed — description, priority, status, assignee. A Deliverable records organisational *reasoning* — objective, capability history, evidence, knowledge, decision, governance state, traceability and reasoning history, in addition to everything a ticket already captures. A ticket, in consequence, becomes one possible implementation of a Deliverable, not its definition — the platform is free to expose Deliverables through whatever tool a team already uses, provided the underlying reasoning accumulates in the organisation rather than in the tool.

## 23.9 Deliverable Traceability

Traditional traceability connects artefact — requirement to code, code to test, test to defect. The Deliverable extends this: every Deliverable should preserve why it exists, how organisational understanding evolved while it was open, which evidence supported which decision, which capabilities contributed, which participants participated, and which objectives were ultimately satisfied. Traceability, seen through the Deliverable, becomes narrative rather than merely structural (Chapter 28 develops Traceability fully).

## 23.10 Relationships

Within the organisational model, a Deliverable supports one or more Objectives; invokes one or more Services; traverses multiple Capabilities; is governed by one or more Roles; is executed by Participants; generates Activities; accumulates Artefacts; references Evidence; accumulates Knowledge; and records Decisions. The Deliverable is, in this sense, the organisational thread connecting every ontology entity to a single piece of organisational intent.

## 23.11 Invariants

A Deliverable shall possess persistent identity. A Deliverable shall support one or more organisational objectives. A Deliverable shall participate in one or more ORC iterations. A Deliverable shall remain governed throughout execution. A Deliverable shall preserve organisational reasoning history. Violation of these invariants results in fragmented organisational execution.

## 23.12 Operational Semantics

Deliverables enter the organisation representing intent. Capability reasons about them. Service transforms them. Participants execute activity. Artefact accumulates, evidence grows, knowledge matures, decision guides execution, and objective determines completion. The Deliverable, throughout, represents organisational intent progressing through organisational reasoning.

## 23.13 Deliverables as Organisational Memory

A completed Deliverable remains valuable — it preserves intent, reasoning, evidence, knowledge, decision and execution history, so future organisational reasoning may reuse it directly. A completed Deliverable is reusable organisational experience, not a closed record with no further value.

## 23.14 AI Implications

Artificial intelligence transforms the execution of Deliverables. Rather than simply being assigned one, an AI participant continuously analyses it — identifying missing evidence, recovering relevant organisational knowledge, proposing architectural alternative, estimating organisational impact, recommending which capability should be involved, and identifying governance concern. The Deliverable, in consequence, becomes the shared reasoning object of the organisation — not merely a container to be updated, but something every participant, human or artificial, actively reasons over.

## 23.15 Chapter Summary

The Deliverable is the primary execution entity of the AI Software Organisation. Rather than representing an isolated engineering task, it encapsulates organisational intent together with the reasoning required to realise that intent, preserving objective, evidence, knowledge, decision and execution history within a single organisational construct. It introduces no new ontological concept — it is the aggregate that binds the eleven entities of Part 2's ontology together for one piece of intent — which is precisely what is likely to make it, in implementation terms, the central persistent object around which most execution is organised.

It is also worth resisting the temptation to make the Deliverable software-specific. Defined as organisational intent under execution, nothing in it depends on the intent being a software feature — the same construct could carry a production incident, a governance audit, an architectural investigation or a knowledge recovery effort, and, were the theory ever generalised beyond software engineering, an entirely different domain's intent as well. That breadth of definition is deliberate.

The next chapter examines **Workflow**, showing how Deliverables move between capabilities while each capability preserves its own organisational autonomy.
