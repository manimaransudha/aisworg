# Legacy Knowledge Recovery

## 29.1 Introduction

Most software engineering organisations do not begin with an empty repository. They inherit systems developed over many years, frequently containing millions of lines of source code, incomplete documentation, obsolete architecture diagram, undocumented business rule, retired participant, inconsistent terminology and lost design rationale — and despite these limitations, the organisation must continue evolving them. Within the AI Software Organisation, this is not viewed primarily as software maintenance. It is viewed as **organisational knowledge recovery**: the objective is not merely to understand source code, but to reconstruct the organisational understanding that originally produced the software.

If asked what single capability most distinguishes this platform from existing AI coding tools, the honest answer is not better agents, better workflow, better code generation or better prompting. It is that it can understand an *existing* software organisation. Greenfield software generation, on reflection, is the easier problem; brownfield software understanding is where organisations spend decades of accumulated effort. This chapter is therefore not about reverse engineering in the conventional sense. It is about reconstructing organisational knowledge from incomplete evidence.

## 29.2 Definition

**Legacy Knowledge Recovery** is the governed organisational process of reconstructing evidence, candidate knowledge and organisational reasoning from existing engineering artefacts whose original organisational context is partially or completely unavailable. Recovery operates under uncertainty by design — it does not recreate history, it reconstructs organisational understanding from whatever evidence survives.

## 29.3 Why Legacy Recovery Exists

Software survives longer than the participants who built it — architecture outlives architect, business rule outlives analyst, operational practice outlives operator. As participants leave, their organisational understanding frequently disappears with them, and the remaining software becomes an incomplete record of organisational intent. Legacy knowledge recovery exists to restore that missing understanding rather than simply accept its absence.

## 29.4 Legacy Artefacts and the Recovery Problem

Recovery begins with whatever artefact survives — source code, version control history, requirements document, architecture diagram, database schema, configuration file, test suite, issue tracker, operational log, deployment history, meeting record, email archive. Each contributes partial organisational evidence; none independently explains organisational understanding.

Legacy recovery differs fundamentally from new development in the direction its reasoning runs. In new development, organisational intent exists before implementation, and reasoning proceeds objective → knowledge → decision → implementation. In legacy systems, implementation frequently remains while intent has disappeared, so recovery reverses the direction: implementation → evidence → candidate knowledge → accepted understanding. This inversion is what distinguishes recovery from development, not any difference in the underlying ontology.

## 29.5 Recovery Through Evidence and Candidate Knowledge

The organisation never directly reconstructs knowledge — it reconstructs evidence first: an observed dependency, an observed database relationship, an observed architectural pattern, observed execution behaviour, observed terminology. Evidence remains objective throughout; recovery begins with observation, not interpretation (Part 2 Chapter 15 formalises Evidence in full).

Evidence then supports candidate knowledge — this module probably implements pricing rule, this service likely represents customer authentication, this dependency appears accidental, this database table probably models invoice. These remain organisational hypothesis until governance accepts them; recovered knowledge should never be accepted automatically, and validation may draw on human domain expert, operational observation, historical artefact, AI reasoning, regression testing or policy evaluation. Recovered knowledge also naturally carries varying confidence — direct evidence, strong inference, weak inference, historical assumption, recovered terminology — and confidence accompanies organisational reasoning without ever determining organisational truth on its own (Part 2 Chapter 16 formalises this Candidate → Accepted distinction in full).

## 29.6 Continuous Recovery, and Recovery Within the ORC

Recovery is not a one-time project. Every software modification reveals additional organisational evidence; every deployment generates new observation; every incident uncovers a hidden assumption. Legacy recovery therefore continues throughout the lifetime of the organisation, not merely during an initial modernisation effort.

Recovery is, in fact, simply a specialised instance of the Organisational Reasoning Cycle: activity analyses legacy artefact, artefact produces evidence, evidence suggests candidate knowledge, governance validates understanding, and knowledge improves future engineering activity. The ORC accommodates legacy systems naturally, without requiring a separate model for them (Part 3 Chapter 19 formalises the ORC in full).

## 29.7 Human and AI Collaboration, and Legacy Traceability

Artificial intelligence dramatically improves recovery capability — analysing millions of source file, inferring architectural relationship, recovering domain terminology, identifying duplicated behaviour, detecting inconsistent implementation — while human participants contribute business context, historical knowledge, operational judgement and governance. The resulting understanding combines computational scale with human experience; neither alone reaches as far.

Recovered knowledge should also preserve its provenance carefully, distinguishing original evidence from recovered inference from accepted knowledge at every step. This distinction protects organisational integrity while still enabling continual refinement as more evidence becomes available over time.

## 29.8 Legacy Systems as Organisational Assets

Traditional software engineering frequently treats a legacy system as technical debt. The AI Software Organisation takes a different view: a legacy system represents historical organisational knowledge which, although incomplete, contains valuable evidence — recovery transforms that evidence into reusable organisational understanding, making legacy systems knowledge assets rather than engineering liabilities to be tolerated until replaced.

## 29.9 Relationships

Within the organisational model, Legacy Knowledge Recovery consumes legacy artefact; generates Evidence; proposes candidate Knowledge; enriches organisational Knowledge; updates Deliverables; informs Decisions; and improves Capabilities. Recovery is, in this sense, an organisational learning capability in its own right, not a separate discipline running alongside the rest of the model.

## 29.10 Invariants

Recovery shall preserve original evidence. Recovered knowledge shall identify confidence. Recovered knowledge shall remain distinguishable from accepted knowledge. Recovery shall remain traceable. Recovery shall operate within governance. Violation of these invariants converts recovery into speculation.

## 29.11 Operational Semantics

Legacy artefact is analysed. Evidence is extracted. Candidate knowledge emerges. Governance evaluates the proposal. Accepted knowledge becomes part of organisational understanding, and future engineering benefits immediately. Recovery, throughout, transforms historical software into organisational intelligence rather than merely documenting it after the fact.

## 29.12 AI Implications

Artificial intelligence fundamentally changes the economics of software modernisation. Rather than manually reverse engineering a system, AI continuously extracts evidence, builds dependency model, discovers terminology, recovers architectural intent, identifies business concept and proposes candidate knowledge. The organisation modernises through continuous understanding rather than a one-time documentation effort undertaken before a migration and then abandoned.

## 29.13 Chapter Summary

Legacy Knowledge Recovery enables existing software systems to participate fully within the AI Software Organisation. Rather than treating legacy software as opaque implementation, the organisation reconstructs evidence, candidate knowledge and organisational understanding through governed reasoning that runs backward from implementation toward intent — transforming software modernisation from reverse engineering into continuous organisational learning.

The following chapter examines **Native Knowledge Creation**, where organisational understanding is captured from the moment software is conceived, running the same reasoning forward instead, and eliminating the need for future recovery altogether.
