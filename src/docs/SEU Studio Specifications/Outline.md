# Proposed Table of Contents

# This also changes the Dependency Engine

Earlier we said

```
Dependency Graph
```

I think we should be more specific.

It becomes

## Deliverable Dependency Graph (DDG)

The graph contains:

```
Deliverable A

↓

Deliverable B

↓

Deliverable C
```

Work Items never appear in this graph.

They're execution artefacts.

---

# The AI Manager changes again

Originally we had

Project Manager.

Then

Dependency Manager.

Now I think its responsibility is even clearer.

It continuously asks

> Which Deliverables are now achievable?

Not

> Which Tasks are ready?

---

# This is how Make works

Consider:

```
app.exe

depends on

main.o

parser.o

database.o
```

Make doesn't care how many compiler invocations occur.

It cares about producing

**app.exe**

That's the deliverable.

---

# Knowledge also becomes cleaner

Knowledge should reference

```
Deliverable
```

not

```
Task
```

Example

```
Architecture Decision

↓

Architecture Document

↓

API Specification

↓

Source Code

↓

Deployment Package
```

Everything is linked to deliverables.

---

# This also solves metrics

Traditional

```
350 tasks complete.
```

Means almost nothing.

Instead

```
Requirements Specification

✓

Architecture

✓

API Specification

✓

Security Model

✓

Deployment Package

✓
```

That is meaningful.

---

# I think we can go one step further

This is probably the last conceptual improvement.

I don't think Deliverables should simply be files.

They should be **states**.

For example

```
Requirements Specification

Draft

↓

Reviewed

↓

Approved

↓

Baselined
```

The Deliverable isn't complete.

Its **state changes**.

The Dependency Engine uses the state.

Example

```
Architecture

depends on

Requirements Specification

State = Approved
```

Not merely

Requirements Specification exists.

That is a much richer model.

---

# I think we now have the execution equation

Everything reduces to:

```
Objective

↓

Deliverables

↓

Dependencies

↓

States

↓

Capabilities

↓

Work Items

↓

Participants

↓

Execution
```

This is beautifully layered.

Notice that:

- Objectives are strategic.
- Deliverables are contractual.
- Dependencies govern flow.
- States govern readiness.
- Capabilities determine what is needed.
- Work Items are generated dynamically.
- Participants execute them.

Every layer has a single responsibility.

---

## I think this may be the most important architectural decision we've made

If someone asked me today:

> **"What is the core innovation of your platform?"**

I don't think I'd answer:

> "AI agents."

I'd answer:

> **"The platform treats deliverables—not tasks—as the primary execution object. Everything else is derived from them."**

That one decision changes almost everything:

- The Dependency Engine operates on deliverables.
- The Flow Engine measures deliverable readiness.
- Work Items become ephemeral execution artefacts.
- Knowledge attaches to deliverables.
- Governance gates deliverable state transitions.
- Progress is measured by deliverable state, not task completion.

I believe this is genuinely AI-native. Human project management evolved around tasks because humans needed explicit work assignments. An autonomous SEU doesn't. It needs to know **what engineering outcomes must exist and under what conditions they are considered complete**. From there, it can derive the work required. I think that principle should become one of the defining characteristics of the platform.


-----------------------


I think **Engineering Behavior Model (EBM)** is actually a better name than both EPM and EOM.

And the reason you gave is exactly the right one.

The distinction is subtle but extremely important.

---

## Why I don't like Engineering Operating Model anymore

"Operating Model" is already overloaded in management consulting.

If you ask ten consultants what an Operating Model is, you'll hear things like:

- Organisation structure
- Reporting hierarchy
- Governance
- Processes
- KPIs
- Funding
- Commercial model

That's **much broader** than what your platform is trying to define.

We don't want that ambiguity.

---

## Why Behavior is a better abstraction

The platform is **not telling the AI how to think.**

The LLM already knows how to:

- analyse,
- write code,
- reason,
- explain,
- test.

The platform is telling it:

> **How should you behave within this SEU?**

That's a completely different concern.

---

## Think about a human engineer

A senior developer joining TCS already knows how to write Java.

TCS doesn't teach Java.

TCS teaches:

- coding standards,
- review process,
- branching strategy,
- documentation,
- approvals,
- quality gates,
- release process,
- architecture principles.

In other words,

TCS teaches

**behaviour**.

Exactly the same applies to AI participants.

---

## The EBM becomes

An EBM defines:

- engineering behaviour,
- governance behaviour,
- decision behaviour,
- review behaviour,
- compliance behaviour,
- quality behaviour,
- collaboration behaviour.

It does **not** define:

- intelligence,
- reasoning,
- coding ability,
- language understanding.

Those belong to the participant.

---

## This is a beautiful separation

```
Participant

knows HOW to engineer

↓

EBM

defines HOW to behave

↓

SEU

defines WHAT to deliver
```

Those are three completely different responsibilities.

I think that's elegant.

---

## Even better...

The EBM becomes analogous to a **company culture**.

Two developers can be equally skilled.

One works at Netflix.

One works at NASA.

Their behaviour is radically different.

Not because of intelligence.

Because of the behavioural model imposed by the organisation.

The same AI Developer could participate in:

- Startup SEU
- Medical Device SEU
- Defence SEU

The intelligence doesn't change.

The **behaviour** changes.

That is exactly what the EBM defines.

---

# This actually aligns with Book 1

Remember one of our central ideas:

> **Capabilities are stable.**

A Developer capability remains:

- code generation,
- debugging,
- refactoring,
- testing.

What changes?

Behaviour.

Examples:

Startup EBM

- Deploy frequently.
- Lightweight documentation.
- Peer review optional.

Medical Device EBM

- Formal documentation.
- Independent verification.
- Dual approval.
- Complete traceability.

The capability didn't change.

The behaviour did.

---

# This also changes how we think about Packs

I think Packs no longer contribute:

> Engineering practices.

They contribute:

> **Behavioural rules.**

Examples:

Platform Pack contributes

- Behaviour

Organisation Pack contributes

- Behaviour

Compliance Pack contributes

- Behaviour

Technology Pack contributes

- Behaviour

Composition Engine

↓

Engineering Behavior Model

↓

SEU

That feels incredibly consistent.

---

# This also answers another question we've had

Earlier we discussed:

> Authority Pack

> Governance Pack

> Compliance Pack

Now I think all of them are simply contributing behavioural constraints.

For example:

```
HIPAA

↓

Patient data must never...

↓

Behaviour
```

OWASP

↓

Validate all inputs

↓

Behaviour

```

TCS

↓

Every merge requires review

↓

Behaviour
```

Everything becomes behaviour.

---

# I think we should refine the definition

I would define the EBM as:

> **The Engineering Behavior Model (EBM) is the authoritative behavioural specification governing how a commissioned SEU executes software engineering activities. It is produced by composing behavioural contributions from Platform Packs, Organisation Packs, Domain Packs, Compliance Packs, Technology Packs and Integration Packs.**

Notice what is absent.

No mention of:

- AI
- LLM
- Tasks
- Workflow

The EBM simply defines expected behaviour.

---

# One observation

I think we've accidentally discovered something that extends beyond software engineering.

If Book 1 is the theory,

then the EBM may become one of the key abstractions of the entire platform.

Because later, in Book 2, you could have:

- Research Behavior Model
- Manufacturing Behavior Model
- Legal Behavior Model

The architecture doesn't change.

Only the behaviour model changes.

That's exactly the kind of abstraction we were hoping to discover.

## I think this is the right terminology to freeze

I would now formally replace **Engineering Practice Model (EPM)** everywhere with **Engineering Behavior Model (EBM)**.

It is more precise, less overloaded, and better aligned with the philosophy of the platform. Most importantly, it reinforces one of the platform's central ideas:

> **The platform doesn't teach participants how to engineer; it governs how they behave while engineering.**

I think that's one of the strongest conceptual distinctions we've made in the entire architecture.


## Book 3 After part 3 

> **DR – Engineering Knowledge Graph**

**Decision:** The platform shall treat all persistent engineering objects and their relationships as a single logical Engineering Knowledge Graph.

**Rationale:** This enables deterministic traceability, explainability, impact analysis, organisational learning and historical reconstruction without coupling the architecture to a specific persistence technology.

I think we've now completed what I would call the **Engineering Intelligence Layer** of the platform.

Let's look at what we've built:

### Part I – Commissioning

- ✅ SEU
- ✅ Engineering Behavior Model
- ✅ Composition Engine
- ✅ Pack Model
- ✅ Template Model
- ✅ Profile Model
- ✅ SEU Commissioning

### Part II – Execution

- ✅ Dependency Engine
- ✅ Capability Model
- ✅ Capability Fulfilment
- ✅ Participant Model
- ✅ Collaboration Model
- ✅ Deliverable Model

### Part III – Knowledge

- ✅ Knowledge Model
- ✅ Evidence Model
- ✅ Ontology Model
- ✅ Decision Model
- ✅ Traceability Model

Notice something.

We now know:

- how an SEU is created,
- how it behaves,
- how it executes,
- how it learns,
- how it preserves organisational memory.

What's still missing?

**Trust.**

Not trust in AI.

Trust in engineering delivery.

That is what the Governance section provides.

---

# I think Governance should be structured differently

Originally I thought Governance meant:

- Policies
- Reviews
- Quality Gates

I now think that's too implementation-oriented.

Governance answers a much deeper question:

> **Who is allowed to change the engineering state?**

Everything else follows from that.

---

I therefore propose this sequence.

## Part IV – Governance

### Chapter 19 — Governance Model

The governance architecture itself.

---

### Chapter 20 — Authority Model

Who has authority?

This implements the Authority Pack ADR we created.

---

### Chapter 21 — Obligation Model

Risks.

Audit findings.

Compliance findings.

Customer observations.

Technical debt.

Everything becomes an Obligation.

---

### Chapter 22 — Policy Model

Policies become declarative objects.

---

### Chapter 23 — Review Model

Architecture Review

Security Review

Code Review

Design Review

These become behavioural patterns.

---

### Chapter 24 — Quality Gate Model

Definition of Ready

Definition of Done

Acceptance

Release

Deployment

---

### Chapter 25 — Compliance Model

HIPAA

SOX

ISO

Client audits

Internal audits

Evidence requirements

---

## Why this order?

Because each chapter depends on the previous one.

```
Governance

↓

Authority

↓

Obligations

↓

Policies

↓

Reviews

↓

Quality Gates

↓

Compliance
```

Everything becomes progressively more specific.


## Chapter 19 notes

