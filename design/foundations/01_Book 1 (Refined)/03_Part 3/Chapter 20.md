# The Capability Reasoning Network

## 20.1 Introduction

The previous chapter introduced the Organisational Reasoning Cycle as the fundamental behavioural model of the AI Software Organisation — how an individual organisational capability transforms activity into organisational learning through the continuous interaction of artefact, evidence, knowledge and decision. Organisations, however, rarely operate through a single capability. Software engineering requires many specialised capabilities operating simultaneously — Requirements Engineering, Architecture, Implementation, Testing, Security, Release Management, Operations, Knowledge Management — each continually reasoning within its own domain. The organisation therefore contains not one reasoning cycle, but many, and this chapter introduces the **Capability Reasoning Network (CRN)**: the model explaining how those many cycles interact to produce coherent organisational behaviour.

## 20.2 Why a Network

Traditional organisational models explain coordination through hierarchy — managers communicate, departments collaborate, teams exchange information. These mechanisms explain administrative structure; they do not adequately explain organisational reasoning. Within the AI Software Organisation, capability interacts because capability exchanges organisational value, so reasoning occurs through interconnected capability network rather than reporting structure. The organisation behaves as a distributed reasoning system, not a hierarchy that happens to reason.

## 20.3 Definition

A **Capability Reasoning Network** is a collection of interacting organisational capabilities whose individual reasoning cycles cooperate through governed service exchange, shared knowledge and shared organisational objective. Every capability possesses its own ORC; the CRN explains how those individual cycles influence one another.

## 20.4 Independent Reasoning and Shared Purpose

Each capability reasons independently, developing its own specialised organisational knowledge: Requirements Engineering reasons continuously about business need, stakeholder intent, requirement consistency and completeness; Architecture reasons about system structure, technology choice, dependency and quality attribute; Testing reasons about verification, coverage, failure analysis and regression; Operations reasons about availability, performance, reliability and capacity.

Although each reasons differently, all remain aligned through shared objective — Requirements, Architecture, Implementation and Testing may reason about entirely different concerns, yet each ultimately contributes toward the same organisational objective, which is what provides global organisational coherence across capabilities that never directly communicate (Part 2 Chapter 8 formalises Objective in full).

## 20.5 How Capabilities Actually Interact

Capabilities never directly manipulate one another. Requirements Engineering provides an Approved Requirements service that Architecture consumes; Architecture provides an Approved Solution Architecture service that Implementation consumes; Implementation provides an Implemented Software Components service that Testing consumes. This separation, examined fully in Part 1 Chapter 7 and Part 2 Chapter 10, preserves organisational independence between capabilities.

Service, however, is not the only thing that flows between capabilities, and it is worth being precise about the others rather than treating every interaction as a service call. Capabilities also exchange **knowledge** — architecture sharing dependency knowledge, testing sharing quality knowledge, operations sharing reliability knowledge, security sharing vulnerability knowledge — propagated rather than duplicated, so that the organisation maintains one organisational understanding to which each capability contributes a specialised perspective. They exchange **evidence** — testing produces evidence that operations consumes, operations produces evidence that architecture consumes, architecture produces evidence that requirements consumes — forming feedback loops that enable organisational adaptation. And they propagate **decision**: architecture's decision to adopt event sourcing changes implementation's coding practice, which changes testing's verification strategy, which changes operational monitoring, which in turn changes what the organisation knows. A single decision, in other words, propagates through the entire reasoning network rather than staying contained within the capability that made it.

These four forms of interaction — service, evidence, knowledge and decision — are the actual vocabulary of capability-to-capability interaction, and distinguishing them matters more than treating every exchange as an undifferentiated "communication." A deliberate choice is made here not to introduce a further ontological entity to represent the exchange itself (an "Organisational Message," carrying one of these four payload types plus notification and event) — such a concept does not carry the same ontological weight as Objective, Capability or Knowledge, and belongs instead to a future treatment of collaboration and coordination mechanics rather than to the ontology itself. That separation between the *things* an organisation is built from and the *interactions* between them is deliberate, and is one of the reasons the ontology in Part 2 has stayed as compact as it has.

## 20.6 Local Optimisation versus Global Optimisation

Individual capabilities naturally optimise their own local objective — testing seeks maximum verification, implementation seeks development efficiency, operations seeks stability, security seeks risk reduction — and these objectives occasionally conflict. The CRN resolves such conflict through organisational governance and shared objective: local optimisation must never be allowed to compromise organisational purpose (Part 2 Chapter 18 formalises Governance in full).

## 20.7 Emergent Behaviour and Resilience

No capability controls the organisation. Each reasons locally, exchanges service, contributes evidence and knowledge — yet collectively the organisation exhibits coherent behaviour, coherence emerging from interaction rather than central control. The AI Software Organisation, in this respect, resembles a complex adaptive system more than a managed hierarchy.

This distributed structure also makes the organisation resilient: a temporary failure within one capability does not eliminate organisational reasoning elsewhere. Other capabilities continue operating, knowledge persists, service continues where possible, and governance maintains organisational integrity throughout. Resilience emerges naturally from distributing reasoning across a network rather than concentrating it in any one place.

## 20.8 AI Implications

Artificial intelligence fundamentally increases the scale at which a Capability Reasoning Network can operate — thousands of specialised AI participants may operate simultaneously without organisational complexity increasing proportionally, because participants remain local to their capability and the CRN coordinates behaviour through service, evidence and knowledge rather than direct communication between participants. This is what lets the network scale where a communication-based coordination model would not.

## 20.9 Relationships

Within the organisational model, a Capability Reasoning Network contains multiple Organisational Reasoning Cycles; connects Capabilities through Services; exchanges Evidence; shares Knowledge; propagates Decisions; and remains governed by Objectives and Governance throughout. The CRN is, in this sense, the behavioural model of the entire organisation, not merely of any one capability within it.

## 20.10 Chapter Summary

The Capability Reasoning Network extends the Organisational Reasoning Cycle from an individual capability to the entire software organisation. Rather than modelling collaboration as communication between department, it models collaboration as governed exchange of service, evidence, knowledge and decision between specialised reasoning capability — explaining how a large software organisation behaves coherently without relying on centralised control.

With the ORC and the CRN both in place, the ontology of Part 2 has a behavioural foundation: individual capabilities reason continuously, and the network of their interaction is what makes the organisation, as a whole, an intelligent system rather than a collection of intelligent parts. One question remains open: both loops, so far, reason within the boundary of a single Software Engineering Unit. The next chapter asks what happens to understanding once that boundary is crossed.
