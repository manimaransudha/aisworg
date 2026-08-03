# Artefact

## 14.1 Intent

Activity changes organisational state. Once an activity has completed, the organisation requires a persistent representation of the outcome — without persistence, organisational learning cannot occur, traceability disappears, and knowledge becomes dependent on participant memory. The purpose of the **Artefact** is to preserve organisational state beyond the lifetime of the activity that created it, constituting the durable memory of organisational behaviour and letting future participants understand not only what currently exists but how the organisation reached its present state.

This definition is broader than the conventional software-engineering sense of an artefact as a document, code file or diagram. An artefact is any persistent manifestation of organisational knowledge or intent — a pull request is an artefact, a risk register is an artefact, a decision record is an artefact. An AI conversation itself is not an artefact; the decision extracted from it is. That distinction becomes important once Evidence, Knowledge and Decision are formalised in the chapters that follow.

## 14.2 Definition

An **Artefact** is a persistent organisational object, created, modified or consumed by one or more activities, that records organisational intent, state or outcome. Artefacts persist beyond the execution of the activity that produced them, becoming part of the organisation's enduring memory. Unlike an activity, an artefact is not behaviour — it is the lasting result of behaviour.

## 14.3 Why Artefacts Exist

Organisations accumulate knowledge across many years while participants change, projects conclude and technology becomes obsolete. Without persistent artefact, the organisation would repeatedly rediscover previous decision. Artefacts preserve intent, design, implementation, verification, governance and operational experience, together letting the organisation evolve without continually restarting from first principles.

## 14.4 Characteristics

An artefact possesses **persistence**, surviving the activity that produced it until explicitly superseded or retired. It possesses **identity**, a unique organisational identity independent of storage technology — whether stored in a version control system, a document repository or a knowledge graph is irrelevant to what the artefact organisationally is. It is **versionable**: artefacts evolve, and organisations therefore require version history rather than replacement, since the historical evolution of an artefact frequently contains valuable organisational knowledge in its own right. It is **traceable** — the organisation should know which activity created it, which participant contributed, which objective it supports and which capability owns it. And it is **governable**, existing within organisational policy that determines who may create, modify, approve or retire it.

## 14.5 Categories of Artefacts

Rather than categorising artefact by technology, the ontology categorises by organisational purpose. **Intent artefacts** capture desired organisational outcome — business vision, objective, requirement, user story, acceptance criteria. **Design artefacts** describe proposed organisational solution — architecture model, interface specification, data model, security model, process model. **Implementation artefacts** represent executable engineering solution — source code, configuration, infrastructure definition, database schema, build script. **Verification artefacts** capture confidence about organisational behaviour — test case, test report, code review outcome, static analysis report, validation record. **Operational artefacts** describe the running organisation — deployment manifest, monitoring dashboard, incident report, operational runbook, service catalogue. **Governance artefacts** represent organisational control — policy, standard, decision record, risk register, compliance report, approval record. And **knowledge artefacts** preserve organisational understanding — domain glossary, architecture decision record, lessons learned, design rationale, knowledge graph snapshot, recovered legacy knowledge. A single artefact may belong to more than one category; the classification serves understanding, not restriction.

## 14.6 Artefacts versus Documents, versus the Deliverable

Traditional software engineering frequently equates artefact with document, which is unnecessarily restrictive: a document is one representation of an artefact. An architecture decision may exist as a Markdown file, a structured database record, a node within a knowledge graph or an object within organisational memory — the underlying artefact remains the same while its representation changes. The ontology therefore separates organisational meaning from physical representation.

Artefacts also differ from the **Deliverable** (Chapter 23), though the two are closely related: a Deliverable is the execution aggregate binding Objective, Capability, Service, Role, Participant, Activity, Artefact, Evidence, Knowledge, Decision and Governance together for a single piece of organisational intent, while an artefact is one persistent output that a Deliverable's activity produces along the way. A requirements specification, an architecture model and a test report may all be artefacts contributing to the same Deliverable; the Deliverable is the container through which they accumulate into one coherent piece of organisational intent, while each artefact continues to serve the organisation independently of any single Deliverable's lifecycle — supporting maintenance, audit and future development long after the Deliverable that produced it has closed.

## 14.7 Artefact Lifecycle

An artefact moves through a defined lifecycle: **proposed**, identified but not yet created; **draft**, with initial content that remains incomplete; **reviewed**, having undergone organisational evaluation; **approved**, satisfying organisational governance; **active**, contributing operational organisational value; **superseded**, replaced by a newer artefact while historical traceability remains; **archived**, no longer contributing directly to current operations but remaining part of organisational history; and **retired**, having reached the end of its organisational lifecycle — retirement never implying deletion, since historical integrity remains essential.

## 14.8 Artefacts and Organisational Memory

Every artefact contributes to organisational memory, though not equally — some preserve implementation, others preserve reasoning, others preserve governance. Collectively, the artefact ecosystem forms the organisation's persistent memory, existing independently of any participant, which is what makes organisational continuity achievable despite continual participant replacement.

## 14.9 Relationships

Within the ontology, an Artefact is created or modified by Activities; realises one or more Services; supports one or more Objectives; belongs to one or more Capabilities; is governed by one or more Roles; is produced by one or more Participants; generates Evidence; contributes organisational Knowledge; and may influence organisational Decisions. Artefacts thereby become central organisational connectors.

## 14.10 Invariants

An artefact shall possess organisational identity. An artefact shall be traceable to one or more activities. An artefact shall participate in organisational governance. An artefact shall possess lifecycle state. An artefact shall remain historically recoverable. Violation of these invariants indicates organisational memory loss.

## 14.11 Operational Semantics

Activities produce artefacts. Roles govern artefacts. Participants modify artefacts. Capabilities consume artefacts. Services expose artefacts. Evidence is extracted from artefacts. Knowledge is inferred from evidence. The organisation accumulates understanding through the continual evolution of artefact.

## 14.12 AI Implications

Artificial intelligence enables entirely new classes of organisational artefact — recovered business rule, architecture inference model, traceability graph, semantic dependency map, decision explanation, capability health report, continuous organisational knowledge summary. These do not merely document engineering work; they represent organisational understanding generated continuously by the organisation itself, evolving artefact from passive documentation into an active organisational asset that participates in organisational reasoning rather than merely storing information.

## 14.13 Chapter Summary

Artefacts are the persistent products of organisational behaviour, preserving organisational intent, state and outcome beyond the activity that created them. Unlike traditional software engineering, which frequently treats artefact as project deliverable, the ontology treats it as an enduring organisational asset enabling governance, traceability, memory and continuous learning.

This chapter deliberately stops short of interpretation. Possessing an artefact is not the same as understanding what it demonstrates, and it is worth stating plainly the four-way distinction the remaining ontology chapters depend on: an **artefact** is what the organisation has; **evidence** is what the artefact objectively demonstrates; **knowledge** is what the organisation accepts as true on the basis of that evidence; and a **decision** is what the organisation chooses to do because of that knowledge. A source code repository, a pull request and a requirements document are artefacts, not knowledge — the next chapter formally specifies **Evidence**, drawing the critical line between what the organisation possesses and what it can legitimately conclude from it.
