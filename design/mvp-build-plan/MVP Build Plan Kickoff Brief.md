# Kickoff Brief — SEU Commissioning Platform MVP Build Plan

*Paste this as the opening message of a new session. It is self-contained — the new session has no memory of the work that produced it.*

## Context

Book 1 (`01_Book 1 (Refined)/`) is the organisational theory: the Software Engineering Unit, its eleven-entity structure, and the three loops through which it reasons (Organisational Reasoning Cycle, Capability Reasoning Network, Continuous Organisational Learning). Book 3 (`03_Book 3 (Refined)/`) is the platform architecture that implements that theory — 46 chapters, SRS-style, covering everything from Objective and Capability through the Runtime Kernel to Deployment.

Both books have been through an extensive reconciliation pass: naming collisions between the two books were resolved, gaps Book 3 had against Book 1's theory were closed (Objective and Service were added as new chapters; Policy absorbed Book 1's Standard as a Constraint Type rather than a second entity; an Organisational Learning Obligation loop now lets Engineering Telemetry and Knowledge-scope promotion actually trigger a Capability/Service/Policy Pack revision, not just measure a metric; Deliverables now carry an Acquisition Scope — SEU/Capability/Enterprise/Platform — giving Engineering Capital a precise, queryable definition). Four supporting documents in `03_Book 3 (Refined)/` index all of this:

- `Introduction.md` — orientation and pointers to the other three
- `Architecture Catalog.md` — the constitutional document: first principles (AP-001 through AP-009), ADRs, stable architectural concepts, Pack taxonomy
- `Canonical Information Model.md` — every persistent entity in the platform: purpose, lifecycle, key attributes, relationships, ownership, versioning
- `Terminology and Reconciliation.md` — where Book 1's and Book 3's vocabulary don't line up on their own, and how that's resolved
- `Book 1 to Book 3 Mapping.md` — entity-by-entity and chapter-by-chapter check of Book 3's implementation against Book 1's theory, including what's still open (Finding 6: the Knowledge Acquisition pipeline — discovery/validation/refinement of Knowledge — isn't modelled, only the Knowledge object itself once accepted)

**The goal now is narrower than "build all 46 chapters."** The target is a platform that does one thing well: **commission a Software Engineering Unit** — given an Objective, derive required Capabilities, select or validate a Template, apply a Profile, compose the Packs into an Engineering Behavior Model, stand up the SEU, get at least one Capability fulfilled by a Participant, and get one Deliverable moving through its lifecycle. Everything else in Book 3 exists to make a *mature* commissioning platform; most of it isn't needed to prove commissioning works at all.

## What to read first

1. `03_Book 3 (Refined)/Introduction.md`
2. `03_Book 3 (Refined)/Architecture Catalog.md`
3. `03_Book 3 (Refined)/Canonical Information Model.md`
4. `03_Book 3 (Refined)/Book 1 to Book 3 Mapping.md`
5. `01_Book 1 (Refined)/03_Part 3/Chapter 21.md` (Continuous Organisational Learning — the Acquisition Scope / Engineering Capital theory, if the MVP's data model needs to account for it)
6. Then, selectively, the individual Book 3 chapters for whatever ends up in scope (see below) — Chapter numbers in Book 3 (Refined) were shifted twice during reconciliation (Objective inserted as Ch. 1, Service as Ch. 11), so trust the current file names over any external memory of chapter numbers.

Do not modify either book. This is a planning exercise producing a new document, not an editing pass.

## The deliverable: an MVP Build Plan

Produce a single planning document (suggest saving it as `MVP Build Plan.md` at the vault root, alongside this brief) containing:

**1. Scope decision — in vs. deferred.** Below is a draft starting hypothesis from the session that produced this brief. Validate it against your own read of the current manuscripts rather than taking it as settled — the books may have changed since this brief was written, and the split is a judgment call, not a fact.

| Likely in scope for MVP | Likely deferred / simplified |
|---|---|
| Objective, SEU, EBM, Composition Engine, Pack Model, Template Model, Profile Model, SEU Commissioning | Pack SDK — hand-author Packs as YAML/JSON, no tooling yet |
| Capability, Service (declared, not necessarily fully enforced) | Dispatch Engine sophistication — manual/round-robin assignment is enough |
| Capability Fulfilment, Participant Model (minimal: assign one Participant, no dynamic pool) | Engineering Telemetry, Organisational Learning Obligation |
| Deliverable Model (basic lifecycle, no Quality Gates yet) | Quality Gate, Review, Compliance |
| Dependency Engine (basic dependency graph; the full Capability-Dependency-via-Service sharpening can wait) | Ontology Model — skip semantic reconciliation for a single-organisation MVP |
| State Management, Event Model (some persistence and event log is needed even for a thin slice) | Multi-Tenancy — assume a single tenant |
| Authority, Policy (a minimal "who can commission" check, not full depth) | Security Architecture depth, Reliability/Checkpointing, Deployment topology abstraction |
| SEU Lifecycle Management (the actual state machine) | Attention Management, External Interaction |

**2. Concrete technology stack** — language/runtime, database, API style, event/messaging mechanism, first deployment target. Book 3 deliberately leaves this open (technology-independence is one of its architectural principles); this plan closes it.

**3. A real schema** for every in-scope entity, derived from the Canonical Information Model's "Key Attributes" lists — actual field types and constraints, not bullet points.

**4. API contracts** for the core commissioning journey end to end: create an Objective → derive required Capabilities → select/validate a Template → apply a Profile → commission (Composition Engine runs) → SEU reaches Operational → assign a Participant to a Capability → create and progress one Deliverable. That sequence is also the MVP's acceptance test.

**5. Explicit, stated simplifications** — every place the MVP deliberately does less than Book 3 specifies should be written down plainly (e.g. "Dispatch = whoever's assigned, no selection algorithm," "Security = basic auth, not the Dual Authority Model"), so it's a visible decision rather than a silent gap discovered later.

**6. Internal build milestones and acceptance criteria** — a sequence for building the MVP itself (roughly: data model → Composition Engine → commissioning flow/SEU lifecycle → Capability/Participant/Deliverable basics), and a concrete definition of "MVP done": can commission a real SEU via API, watch it reach Operational, with one Capability fulfilled and one Deliverable moving through its lifecycle.

## After the plan

Do not start writing platform code in this session unless asked. Producing the plan is the deliverable. Building from it, validating against a real commissioning scenario, and expanding scope back toward the full Book 3 vision are later, separate steps.
