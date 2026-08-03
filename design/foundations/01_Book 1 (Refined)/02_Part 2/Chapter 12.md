# Participant

## 12.1 Intent

Objectives define organisational purpose; capabilities define organisational ability; services expose organisational value; roles provide organisational stewardship. The remaining question is who performs engineering work. Traditional software engineering answers simply: people. The AI Software Organisation adopts a broader definition — engineering work may be performed by human engineer, artificial intelligence system, automated service or external organisation, all treated uniformly under the common abstraction of the **Participant**: the operational entity that temporarily occupies organisational roles and performs governed engineering activity. The participant is the organisation's execution mechanism; the organisation itself remains unchanged by whichever participant currently occupies a given role.

## 12.2 Definition

A **Participant** is an entity capable of occupying one or more organisational roles and performing engineering activity within the constraints of the Organisational Operating Model. Participants execute work; they do not define organisational structure. Participants may vary. The organisation persists.

## 12.3 Categories of Participants

The ontology deliberately avoids distinguishing participants by implementation technology, recognising instead several categories by function. **Human participants** — engineer, architect, business analyst, project manager, operations personnel — bring expertise originating through education and experience. **AI participants** are artificial intelligence systems capable of reasoning, planning and performing engineering work such as requirements analysis, architecture evaluation, code implementation, testing, knowledge recovery or documentation, the ontology intentionally remaining independent of any particular AI architecture. **Automated participants** are software systems executing deterministic engineering behaviour — continuous integration, static analysis, build system, deployment pipeline, automated verification — which, although not intelligent in the conventional sense, participate operationally within the organisation. **External participants** are engineering organisations or third-party services operating outside the organisational boundary — security assessment provider, cloud service provider, regulatory auditor, consultant — contributing organisational value while remaining external to the organisation itself.

## 12.4 Occupancy and Identity

Participants do not permanently possess organisational role — they **occupy** it. Occupancy has several consequences: multiple participants may simultaneously occupy the same role; a single participant may occupy multiple roles; and participants may enter and leave a role without affecting organisational continuity. Occupancy thereby separates organisational identity from operational execution.

Every participant possesses an organisational identity that should remain independent of implementation — replacing one language model with another does not create a new organisational role, it creates a new participant occupying the existing role, exactly as changing personnel should not require redefining organisational governance. Identity belongs to the participant, not to its implementation technology.

## 12.5 Participant Competencies

Participants possess **competencies** — domain analysis, architecture, programming, testing, documentation, knowledge reasoning — describing what a participant is capable of performing. Unlike capability, which belongs to the organisation, competency belongs to the participant, a distinction fundamental to the whole ontology (Part 1 Chapter 4 §4.2 previews Competency; this chapter develops it fully): organisations possess capability, participants possess competency, and capability survives participant replacement precisely because the two are not the same thing.

## 12.6 Participant Lifecycle

A participant moves through a defined lifecycle: **registration**, when its identity becomes known to the organisation, its competencies declared and its governance constraint assigned; **qualification**, when it demonstrates competency sufficient to occupy one or more roles, through assessment, training, evaluation, certification or simulation; **assignment**, when it is assigned one or more roles and occupancy begins; **operation**, while it performs governed engineering activity, evidence accumulating and performance becoming observable; **improvement**, as its competency improves through organisational learning, remaining local to the participant rather than organisational, unlike capability improvement; and **retirement**, when it ceases organisational operation — affecting only participant availability, never organisational capability.

## 12.7 Participant Independence

Participants should be replaceable. This principle is central to the ontology: if replacing a participant requires redesigning organisational capability, the organisational model has failed. Objective, capability, role, knowledge, policy and governance remain organisational constants; participants alone become variable.

This may be stated as a formal design principle, analogous to the Liskov Substitution Principle in object-oriented design: **an organisational capability shall not depend on the identity or implementation of any specific participant**. Any qualified participant — human, artificial or automated — should be able to occupy a role and perform its activity without requiring any change to the organisational model itself.

## 12.8 Participant Collaboration and Human-AI Symmetry

Participants collaborate through organisational construct rather than unrestricted communication: they consume services, produce artefacts, generate evidence, update organisational knowledge, and operate within governance. Conversation is therefore only one possible collaboration mechanism; organisational knowledge becomes the primary medium, reducing dependence on transient communication (Part 1 Chapter 3 §3.8 develops this collective-reasoning perspective fully, within its treatment of SEU Loops).

A related design principle is **participant symmetry**: the organisational model should not distinguish between human and AI participants unless organisational behaviour genuinely differs. Both require identity, role assignment, governance, performance evaluation, knowledge access and evidence generation — implementation differs, organisational semantics remain identical. This symmetry is what enables hybrid organisations in which human and artificial participants collaborate under the same organisational framework.

## 12.9 Disposable Participants

Traditional software organisations frequently become dependent on individual participants: critical knowledge concentrates in them, and operational continuity suffers when they leave. The ontology deliberately rejects this dependency — participants should be considered organisationally **disposable**. This does not imply participants are unimportant; it implies the organisation should remain capable of operating despite participant replacement, because knowledge, capability and governance belong to the organisation, not to the participants who contribute to them. This is perhaps the strongest available protection against organisational fragility.

## 12.10 Relationships

Within the ontology, a Participant occupies one or more Roles; performs Activities; consumes organisational Services; produces Artefacts; generates Evidence; contributes organisational Knowledge; operates under organisational policy; and participates in organisational Decisions. The participant is the operational actor within the organisational model — it neither defines nor owns organisational structure.

## 12.11 Invariants

A participant shall possess an organisational identity. A participant shall occupy one or more roles before performing governed engineering activity. A participant shall perform activity only within its assigned competency. A participant shall remain replaceable. Participant replacement shall not invalidate organisational capability. Violation of these invariants indicates organisational coupling.

## 12.12 AI Implications

Artificial intelligence introduces participant behaviour impossible within traditional organisations: participants may be instantiated dynamically, may duplicate competency, may specialise temporarily, may operate continuously, may collaborate asynchronously and may access organisational knowledge immediately. These characteristics dramatically alter organisational economics — but they do not alter organisational structure. The organisation remains stable; only participant behaviour changes (Part 1 Chapter 3 §3.3 develops this dynamic-organisation property in full, within Principle 2).

## 12.13 Chapter Summary

Participants are the operational entities that execute engineering work: they occupy role, exercise competency, perform activity, generate artefact, produce evidence and contribute knowledge. Unlike traditional organisational thinking, participants are deliberately separated from organisational capability and stewardship, a separation that lets AI Software Organisations evolve continually while preserving organisational continuity. The next chapter shifts attention from organisational structure to organisational behaviour, formally specifying the **Activity**.
