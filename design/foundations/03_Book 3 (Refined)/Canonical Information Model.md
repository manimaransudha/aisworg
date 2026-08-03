# Canonical Information Model

*Editorial note (Refined edition). This document did not exist in the original Book 3. The book's own Epilogue proposes it as the necessary bridge between the architecture and the first line of implementation code: "the definitive list of platform entities and their relationships... the platform's canonical information model — effectively the semantic contract from which databases, APIs, events and SDKs can all be derived consistently." That proposal is correct, and building it is also the fastest way to force answers to the reconciliation questions raised in [Terminology and Reconciliation.md](Terminology%20and%20Reconciliation.md). Every entity below cites the chapter that defines it in prose; this document doesn't replace those chapters, it indexes them into one schema-shaped reference.*

*Fields per entity: **Purpose** (why it exists), **Lifecycle** (its state machine, where one is defined), **Key Attributes** (the fields an implementer needs on day one, not an exhaustive list — see the source chapter's own structure section for the full field list), **Relationships** (what it points to or is pointed to by), **Ownership** (which tenancy level per Ch. 42 administers it), **Versioned** (whether Ch. 41's Version/Revision model applies to it).*

---

## Engineering Layer

### Objective
- **Purpose:** the root of the Engineering Layer — a persistent statement of engineering intent that justifies why an SEU is commissioned and declares or derives the Capabilities required to achieve it. Not a Goal, Requirement or Strategy (see Ch. 1 §4).
- **Lifecycle:** Proposed → Active → Achieved → Archived, with Active additionally able to transition to Superseded or Retired. (Ch. 1)
- **Key Attributes:** identifier, statement, tier (Strategic/Operational/Engineering), parent Objective, required Capabilities, sponsoring Authority, version.
- **Relationships:** decomposes hierarchically (Strategic → Operational → Engineering); required Capabilities consumed by Template Model to validate/select a Template; every Deliverable, Decision and Capability requirement traces back to an Objective — the root of the Engineering Knowledge Graph.
- **Ownership:** Tenant (as the commissioning sponsor); content may reference Capability Packs for automated derivation.
- **Versioned:** Yes.
- **Source:** Ch. 1.

### SEU (Software Engineering Unit)
- **Purpose:** the primary execution entity; a temporary engineering construct commissioned to achieve one or more objectives.
- **Lifecycle:** Commissioned → Configured → Activated → Operational → Suspended ⇄ Operational → Retired → Archived. (Ch. 37)
- **Key Attributes:** identifier, active EBM reference, active EEC reference, objectives, lifecycle state.
- **Relationships:** executes against exactly one EBM/EEC; owns Deliverables, Knowledge, Evidence, Obligations, Events, Telemetry; belongs to one Workspace/Tenant.
- **Ownership:** Workspace or Tenant (Ch. 42).
- **Versioned:** No (the SEU itself isn't versioned; its EEC is).
- **Source:** Ch. 2, Ch. 37.

### Engineering Behavior Model (EBM)
- **Purpose:** the composed, executable definition of how engineering is performed for a given SEU. (Renamed from "Engineering Practice Model" — see Terminology and Reconciliation §1.)
- **Lifecycle:** Draft → Validated → Published → Active → Deprecated → Retired → Archived (follows the Version lifecycle, Ch. 41).
- **Key Attributes:** version, composing Packs, governance rules, decision rules, quality gates, terminology bindings.
- **Relationships:** produced by the Composition Engine from Packs; consumed by SEU; superseded by the EEC as the actual runtime input (see below).
- **Ownership:** Tenant (as composition target); content sourced from Packs at any tenancy level.
- **Versioned:** Yes.
- **Source:** Ch. 2, Ch. 4.

### Effective Engineering Configuration (EEC)
- **Purpose:** the immutable, versioned result of composing all applicable Packs for one SEU; the single object the Runtime Kernel actually consumes. (ADR – Effective Engineering Configuration, Architecture Catalogue.)
- **Lifecycle:** follows the universal lifecycle (Define → Validate → Compose → Activate → Execute → Observe → Evolve).
- **Key Attributes:** identifier, version, composing Pack versions, composition report.
- **Relationships:** composed from Packs by the Composition Engine; referenced by every Engineering Checkpoint; consumed by Runtime Kernel, Execution Engine, Governance.
- **Ownership:** SEU.
- **Versioned:** Yes — this is the canonical example of a Version (Ch. 41), not a Revision.
- **Source:** Ch. 38.

### Pack
- **Purpose:** a versioned, declarative package contributing engineering behaviour or metadata (Platform / Organisation / Customer / Domain / Technology / Capability / Profile / Template Pack).
- **Lifecycle:** Created → Validated → Published → Installed → Activated → Deprecated → Retired → Archived. (Ch. 38)
- **Key Attributes:** identifier, semantic version, Pack Type, declared capabilities (ADR – Pack Capability Declaration), dependency declaration, digital signature.
- **Relationships:** composed by the Composition Engine into an EBM/EEC; published by a Publisher (Platform, Organisation, Customer, Domain, Technology vendor, or individual).
- **Ownership:** Platform or Tenant, depending on Pack Type.
- **Versioned:** Yes.
- **Source:** Ch. 5, Ch. 38, Ch. 39.

### Template
- **Purpose:** a structural blueprint for commissioning an SEU (what capabilities, roles and Deliverable types a given kind of engineering effort needs).
- **Lifecycle:** follows the universal lifecycle.
- **Key Attributes:** identifier, required Capabilities, structural composition rules.
- **Relationships:** consumed at commissioning time; orthogonal to Profile (see below).
- **Ownership:** Platform, Organisation or Customer Pack.
- **Versioned:** Yes.
- **Source:** Ch. 6.

### Profile
- **Purpose:** the commissioning-time configuration applied to a Template — the specific parameters for one SEU instance.
- **Lifecycle:** follows the universal lifecycle.
- **Key Attributes:** identifier, target Template reference, configuration values.
- **Relationships:** deliberately orthogonal to Template — same Template, many possible Profiles.
- **Ownership:** Tenant or Customer Pack.
- **Versioned:** Yes.
- **Source:** Ch. 7.

### Capability
- **Purpose:** a stable, persistent unit of engineering competency required to progress Deliverables. Capabilities outlive Participants. (ADR – Capability-First Commissioning.)
- **Lifecycle:** follows the universal lifecycle.
- **Key Attributes:** identifier, name, competency definition, dependency type ("Capability Dependency" in Ch. 9's dependency graph).
- **Relationships:** required by Deliverables (via the Dependency Engine); fulfilled by Participant Types through Capability Fulfilment (Ch. 12); selected among by the Dispatch Engine (Ch. 33) at the Participant Instance level.
- **Ownership:** Platform, Organisation or Domain Pack.
- **Versioned:** Yes.
- **Source:** Ch. 10.

### Service
- **Purpose:** the declared, contracted output through which a Capability exposes what it delivers to other Capabilities or external consumers, without exposing how — declared by the same Capability Pack that declares the Capability itself.
- **Lifecycle:** Defined → Published → Active → Deprecated → Retired → Archived. (Ch. 11)
- **Key Attributes:** identifier, providing Capability, contract description, declared Service Level, consuming Capabilities, version, originating Pack.
- **Relationships:** declared by a Capability Pack alongside its Capability; referenced by the Dependency Engine's Capability Dependency edges (Ch. 9 §8) in place of a bare Capability reference; fulfilled via Capability Fulfilment (Ch. 12) and the Dispatch Engine (Ch. 33); its declared Service Level and delivery events are one of Engineering Telemetry's sources (Ch. 35 §9), on equal footing with Knowledge, Decisions and every other source — Service does not drive or govern Telemetry.
- **Ownership:** Platform, Organisation, Domain or Customer Pack.
- **Versioned:** Yes.
- **Source:** Ch. 11.

### Deliverable
- **Purpose:** the primary, persistent unit of engineering execution — the implementation of Book 1's Artefact entity (see Terminology and Reconciliation §3).
- **Lifecycle:** SEU/organisation-defined via Transition Definitions; readiness states include Unknown/Pending/Satisfied/Blocked at the dependency level (Ch. 9) plus its own domain lifecycle (Ch. 15).
- **Key Attributes:** identifier, dependencies, producing capabilities, required evidence, acceptance criteria, completion status, Acquisition Scope (SEU/Capability/Enterprise/Platform, Ch. 15 §9).
- **Relationships:** the central node of the Dependency Graph; produced/modified by Work Items; drives Command generation (Execution Engine, Ch. 31); subject to Quality Gates and Reviews before state transitions; its Acquisition Scope is inherited by the Knowledge, Evidence and Decisions it produces.
- **Ownership:** SEU.
- **Versioned:** No (Deliverables have lifecycle state, not Version/Revision — a new Deliverable state is a State Transition, not a new Version).
- **Source:** Ch. 2, Ch. 9, Ch. 15.

### Knowledge (Item)
- **Purpose:** organisational understanding, persisted independently of the Participant or SEU that produced it.
- **Lifecycle:** Information → Knowledge stage (see Terminology and Reconciliation §5 — "Wisdom" is non-normative).
- **Key Attributes:** identifier, supporting Evidence reference(s), Ontology concept reference, Acquisition Scope (SEU/Capability/Enterprise/Platform, inherited from producing Deliverable, governed-promotable thereafter).
- **Relationships:** requires Evidence to be accepted; referenced by Decisions; reusable across SEUs within the bounds of its Acquisition Scope; Capability/Enterprise/Platform-scoped Knowledge in aggregate constitutes **Engineering Capital** (Ch. 16 §13, Terminology and Reconciliation §6); sustained promotion may raise an Organisational Learning Obligation (Ch. 23 §7).
- **Ownership:** SEU (propagates per Acquisition Scope; Platform scope requires Pack codification to cross Tenants, per Ch. 42 isolation).
- **Versioned:** No — superseded rather than versioned; historical Knowledge remains queryable.
- **Source:** Ch. 16.

### Evidence
- **Purpose:** the substantiation that justifies a Knowledge claim or Decision — the second stage of the Trust Pipeline.
- **Lifecycle:** captured → accepted → (optionally) superseded.
- **Key Attributes:** identifier, source, content reference, acceptance status.
- **Relationships:** supports Knowledge and Decisions; required by Obligation resolution and Quality Gate criteria.
- **Ownership:** SEU.
- **Versioned:** No.
- **Source:** Ch. 17.

### Ontology Concept
- **Purpose:** the shared semantic identity that lets multiple organisations' terminology (e.g. "Technical Design" / "Solution Design" / "Architecture Specification") resolve to one meaning.
- **Lifecycle:** Ch. 18 §9 (concept lifecycle, composition-governed).
- **Key Attributes:** identifier, canonical name, mapped terminology (per contributing Pack), version.
- **Relationships:** referenced by Deliverables, Knowledge, Evidence, Decisions, Obligations, Capabilities, EBM — anything that would otherwise use free-text terminology.
- **Ownership:** composed from Organisation/Domain Packs.
- **Versioned:** Yes.
- **Source:** Ch. 18.

### Decision
- **Purpose:** a knowledge object recording engineering judgement — not a governance object (Governance decides *who* may approve; Decision defines *what was decided*).
- **Lifecycle:** Ch. 19's decision lifecycle (proposed → justified via Trust Pipeline → approved/superseded).
- **Key Attributes:** identifier, justifying Evidence/Knowledge references, outcome, superseding Decision reference (if any).
- **Relationships:** completes the Trust Pipeline (Information → Evidence → Knowledge → Decision → Deliverable State Transition); required by Quality Gates and Obligation resolution.
- **Ownership:** SEU.
- **Versioned:** No — superseded, not versioned (a new Decision supersedes an old one; the old one remains in history).
- **Source:** Ch. 19.

### Obligation
- **Purpose:** any outstanding engineering commitment that must be satisfied before some outcome can be considered complete — unifies risk, audit finding, tech debt, compliance gap, customer clarification, *and organisational learning* into one concept (see the Organisational Learning category below, ADR – Telemetry-Driven Organisational Learning, Architecture Catalogue).
- **Lifecycle:** Identified → Analysed → Assigned → In Progress → Resolved → Verified → Closed → Archived. (Ch. 23)
- **Key Attributes:** identifier, category (including Organisational Learning), severity, completion criteria, blocking scope, resolution reference.
- **Relationships:** participates directly in the Dependency Graph (Ch. 9's "Obligation Dependency"); may block Deliverable state transitions; distinct from its Resolution (one possible satisfying outcome, not the Obligation itself); an Organisational Learning Obligation is raised by Engineering Telemetry (Ch. 35 §11) on a sustained pattern, and resolved by publishing a revised Capability, Service or Policy Pack version — the mechanism that makes Continuous Organisational Learning active rather than passive (Book 1 to Book 3 Mapping.md Finding 5).
- **Ownership:** SEU.
- **Versioned:** No.
- **Source:** Ch. 23.

---

## Execution Layer

### Participant Type
- **Purpose:** a stable, reusable definition of a kind of engineering contributor — the implementation of Book 1's Role entity (see Terminology and Reconciliation §2).
- **Lifecycle:** follows the universal lifecycle.
- **Key Attributes:** identifier, name (e.g. "AI Architect", "Senior Developer"), associated Capabilities.
- **Relationships:** instantiated as Participant Instances; referenced by Capability Fulfilment as the class of eligible fulfillers.
- **Ownership:** Organisation or Platform Pack.
- **Versioned:** Yes.
- **Source:** Ch. 12, Ch. 13.

### Participant Instance
- **Purpose:** the actual runtime occupant of a Participant Type — AI, human, or external system — with its own identity and execution history.
- **Lifecycle:** Assigned ⇄ Executing ⇄ Idle → Released. (Ch. 13)
- **Key Attributes:** identifier, Participant Type reference, identity/credentials, current assignment state.
- **Relationships:** made eligible for Capabilities via Capability Fulfilment (Ch. 12); selected for specific Work Items by the Dispatch Engine (Ch. 33); replaceable without invalidating Deliverable history.
- **Ownership:** SEU.
- **Versioned:** No.
- **Source:** Ch. 12, Ch. 13.

### Command
- **Purpose:** the expression of *what* engineering action is required, generated by the Execution Engine. (ADR – Command-Driven Execution.)
- **Lifecycle:** Generated → Dispatched (as one or more Work Items) → Completed/Failed.
- **Key Attributes:** identifier, target Deliverable, requested action, originating Transition Definition.
- **Relationships:** generated by the Execution Engine (Ch. 31) from engineering state; expanded into Work Items by participant-specific generation (Ch. 32); consumed by the Dispatch Engine (Ch. 33).
- **Ownership:** SEU.
- **Versioned:** No.
- **Source:** Ch. 29 (Event Model's Command/Event distinction), Ch. 31.

### Work Item
- **Purpose:** a transient, Participant-specific execution artefact derived from a Command — explicitly *not* a persistent engineering record (contrast with ALM tools, where work items are primary).
- **Lifecycle:** Generated → Dispatched → In Progress → Completed/Failed. (Ch. 32)
- **Key Attributes:** identifier, originating Command reference, target Deliverable, assigned Participant Instance.
- **Relationships:** exists solely to progress one or more Deliverables; never exists independently of a Deliverable; assigned by the Dispatch Engine.
- **Ownership:** SEU.
- **Versioned:** No — transient, not versioned.
- **Source:** Ch. 2 §12, Ch. 32.

### Capability Fulfilment (relationship record)
- **Purpose:** the eligibility record connecting a Capability to the Participant Types/Instances qualified to provide it. See Terminology-adjacent note: this is upstream of Dispatch, not a duplicate of it (Ch. 12 §2, Ch. 33 §3).
- **Lifecycle:** established → maintained (as Participants change) → revoked.
- **Key Attributes:** Capability reference, eligible Participant references, fulfilment strategy (AI / Human / External / Hybrid / Composite).
- **Relationships:** consumed by the Dispatch Engine as one of its dispatch inputs; does not itself bind a Participant to a specific Deliverable or Work Item.
- **Ownership:** SEU.
- **Versioned:** No.
- **Source:** Ch. 12.

---

## Platform Layer (Runtime Kernel)

### Event
- **Purpose:** an immutable record of an engineering fact that has occurred. Engineering truth belongs to the Runtime Kernel, not to Participants.
- **Lifecycle:** none — Events are immutable once published.
- **Key Attributes:** identifier, type, originating object reference, timestamp, sequence position.
- **Relationships:** published by every subsystem in the book (each chapter's own "Events" section); consumed by Telemetry, Attention Management, External Interaction, Reliability/replay.
- **Ownership:** SEU.
- **Versioned:** No.
- **Source:** Ch. 29.

### Transition Definition
- **Purpose:** the declarative contract governing one lifecycle state change — source state, target state, and every prerequisite (Authority, Policies, Quality Gates, Reviews, Evidence, Obligations). (ADR – Transition Definitions.) First proposed in Ch. 26, generalized as a Runtime Kernel concept in Ch. 28.
- **Lifecycle:** follows the universal lifecycle.
- **Key Attributes:** identifier, source state, target state, required Authority/Policies/Quality Gates/Reviews/Evidence/Obligations.
- **Relationships:** referenced by every governed state transition in the platform — Deliverables, Decisions, Knowledge, Obligations, Packs, Versions, even SEU lifecycle transitions (Ch. 37 §8).
- **Ownership:** composed from Governance-contributing Packs.
- **Versioned:** Yes.
- **Source:** Ch. 26, Ch. 28.

### Attention Item
- **Purpose:** a situation requiring awareness, acknowledgement or action by a Participant, user or external system — deliberately distinct from a raw Event (not every Event needs attention).
- **Lifecycle:** Created → Delivered → Acknowledged → In Progress → Resolved → Closed. (Ch. 34)
- **Key Attributes:** identifier, category (Informational/Action Required/Approval Required/Escalation/Exception/Advisory), priority, triggering Event, intended recipients.
- **Relationships:** derived from Events, Deliverable state, Governance outcomes, unresolved Obligations, Review findings.
- **Ownership:** SEU.
- **Versioned:** No.
- **Source:** Ch. 34.

### Telemetry Metric
- **Purpose:** a derived, automatically-calculated measurement of engineering behaviour, flow or outcomes — never manually entered.
- **Lifecycle:** calculated → aggregated → (superseded by later calculation).
- **Key Attributes:** identifier, category (Flow/Governance/Knowledge/Runtime/Quality/Collaboration), measurement method, time window.
- **Relationships:** derived from State Transitions, Events, Deliverables, Reviews, Decisions, Knowledge, Evidence, Obligations.
- **Ownership:** SEU (aggregated views may exist at Workspace/Tenant level).
- **Versioned:** No — reproducible by recalculation, not versioned.
- **Source:** Ch. 35.

### External Interaction
- **Purpose:** a controlled exchange between the SEU and anything outside the Runtime Kernel boundary (tools, enterprise systems, other SEUs).
- **Lifecycle:** Created → Validated → Dispatched → Acknowledged → Completed → Archived. (Ch. 36)
- **Key Attributes:** identifier, interaction type, direction, target system, payload reference.
- **Relationships:** occurs only through Interaction Adapters hosted in Connectors (ADR – Interaction Adapter Architecture); never bypasses Governance.
- **Ownership:** SEU.
- **Versioned:** No.
- **Source:** Ch. 36.

### Engineering Checkpoint
- **Purpose:** a logically consistent, deployment-independent snapshot of engineering execution, used for deterministic recovery — an "engineering snapshot," not an infrastructure backup. (ADR – Engineering Checkpoints.)
- **Lifecycle:** Created → (referenced by Recovery) → superseded by later Checkpoint.
- **Key Attributes:** identifier, referenced EEC version, referenced artefact versions, event sequence position.
- **Relationships:** used by Recovery to restore state, followed by Event replay to reconstruct exact engineering state.
- **Ownership:** SEU.
- **Versioned:** No — each Checkpoint is already an immutable point-in-time snapshot.
- **Source:** Ch. 44.

---

## Platform Services

### Policy
- **Purpose:** a declarative constraint that must be satisfied before a governed action may proceed. Does not execute, authorise, or review — only constrains. Absorbs Book 1's separate Standard entity as a Constraint Type value rather than a second entity (see Ch. 24 §4, and Book 1 to Book 3 Mapping.md Finding 4) — same shape, same evaluation path, differing only in whether a violation blocks.
- **Lifecycle:** Draft → Validated → Published → Active → Deprecated → Retired → Archived. (Ch. 24)
- **Key Attributes:** identifier, category, Constraint Type (Policy = mandatory/blocking, Standard = preferred/non-blocking), applicability conditions, required Evidence, exception rules, severity (independent of Constraint Type).
- **Relationships:** evaluated during Governance evaluation, which blocks the transition only for Constraint Type "Policy" violations (Ch. 21 §10); contributed through Packs; may generate Obligations when violated; Constraint Type "Standard" deviations surface through Engineering Telemetry's Governance Telemetry category (Ch. 35 §7) instead of blocking.
- **Ownership:** composed from Platform/Organisation/Customer/Compliance Packs.
- **Versioned:** Yes.
- **Source:** Ch. 24.

### Authority Rule
- **Purpose:** permission to perform a governed state transition. Attaches to transitions, not to objects or job titles. (ADR – Dual Authority Model distinguishes this, Engineering Authority, from Platform Authority — see Security Architecture, Ch. 40.)
- **Lifecycle:** follows the universal lifecycle; supports delegation with explicit scope/duration.
- **Key Attributes:** identifier, governed transition, authorised Participant/Participant Type, delegation scope.
- **Relationships:** evaluated whenever a governed action is requested; composed from multiple organisations' Authority Packs; enforces separation-of-duties constraints.
- **Ownership:** composed from Platform/Organisation/Compliance Packs.
- **Versioned:** No (rules are Pack-versioned; individual authorisation decisions are traceability records, not versioned objects).
- **Source:** Ch. 22, Ch. 40.

### Review / Finding
- **Purpose:** Review — a governed evaluation determining fitness to transition state. Finding — a first-class observation produced by a Review, with its own lifecycle (may become an Obligation).
- **Lifecycle:** Review: Planned → Prepared → In Progress → Completed → Accepted → Archived. Finding: raised → discussed → accepted/challenged → (optionally) converted to Obligation → resolved → verified → (optionally) reopened. (Ch. 25)
- **Key Attributes:** Review — category, criteria, outcome. Finding — description, source Review, status, linked Obligation (if any).
- **Relationships:** Review outcome consumed by Governance; Findings may generate Obligations; distinct concepts, not one annotation field.
- **Ownership:** SEU.
- **Versioned:** No (immutable historical record instead).
- **Source:** Ch. 25.

### Quality Gate
- **Purpose:** a declarative engineering contract that must evaluate to true before a governed state transition may occur — unifies Definition-of-Ready, Definition-of-Done, stage gates, release gates and production-readiness reviews into one abstraction.
- **Lifecycle:** follows the universal lifecycle; evaluation outcomes are Passed / Passed with Conditions / Blocked / Waived / Deferred / Not Applicable.
- **Key Attributes:** identifier, category, applicable lifecycle transition, evaluation criteria, waiver rules.
- **Relationships:** references required Reviews, Evidence, Decisions, Obligations, Policies; feeds into Governance evaluation via a Transition Definition.
- **Ownership:** composed from Platform/Organisation/Customer/Compliance Packs.
- **Versioned:** Yes.
- **Source:** Ch. 26.

### Version / Revision
- **Purpose:** Version — an immutable, published snapshot of a versioned artefact, consumable by the Runtime Kernel. Revision — a mutable in-progress working state, never referenced by an active SEU. (ADR – Revision and Version Separation.)
- **Lifecycle:** Revision(s) → Publish → Version (Draft → Validated → Published → Active → Deprecated → Superseded → Archived).
- **Key Attributes:** identifier, artefact identifier, parent version, compatibility declaration.
- **Relationships:** applies to EBM, Pack, Profile, Template, Ontology, Policy, Authority Rule, Review, Quality Gate, Capability Definition, EEC.
- **Ownership:** matches the owning artefact's ownership.
- **Versioned:** N/A — this entity *is* the versioning mechanism.
- **Source:** Ch. 41.

### Tenant / Workspace
- **Purpose:** Tenant — the primary administrative and security boundary. Workspace — optional logical grouping of SEUs within a Tenant for administrative convenience only (never alters engineering behaviour).
- **Lifecycle:** Tenant: Provisioned → Configured → Operational → Suspended → Retired → Archived. (Ch. 42)
- **Key Attributes:** Tenant — identifier, administrative contacts, available Packs. Workspace — identifier, grouping criterion (organisation/customer/programme-based).
- **Relationships:** every SEU belongs to exactly one Tenant, optionally via one Workspace; owns Administrative Ownership of Packs/Workspaces/SEUs (distinct from Engineering Ownership and Business Ownership — ADR – Ownership Separation).
- **Ownership:** self-owning (Tenant is the top administrative boundary).
- **Versioned:** No (configuration is versioned; the Tenant/Workspace identity is not).
- **Source:** Ch. 42.

---

## What this document deliberately excludes

Deployment Units (Ch. 43), Security identities/credentials (Ch. 40), and SDK build artefacts (Ch. 39) are implementation infrastructure, not persistent engineering objects an SEU's domain model needs to represent — they're left to the chapters that already specify them in full. If a future pass finds a persistent object missing from this list, add it here rather than leaving it implicit in prose; that's the entire point of this document.
