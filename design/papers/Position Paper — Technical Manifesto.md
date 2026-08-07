# Governance as Architecture, Not Configuration — A Technical Manifesto

*For engineers and architects evaluating this platform's design. This is a manifesto, not a specification — it argues the architectural choices and shows they're real. The full specification lives in Book 3, published separately as reference documentation.*

## The design problem, stated precisely

Once an AI system can propose a change to engineering state — approve a design, mark work complete, escalate a decision — you have to answer a question most platforms never actually face: what stops it from being wrong, and how do you know, after the fact, why it was allowed to proceed? A chatbot with tool access doesn't need an answer to that question, because nothing it does is authoritative. A system that governs real engineering organisations does.

The architecture here answers that question the same way for every kind of participant and every kind of entity, rather than special-casing "AI actions" as a separate, more-trusted or less-trusted path. That single decision — one generic governance mechanism, applied uniformly — is the thing everything else in this document follows from.

## One transition engine, twelve entity types, zero special cases

Every governed thing in the platform — SEU, Deliverable, Objective, Obligation, Evidence, Knowledge, Decision, Pack, Participant, and others — moves through state via the same generic evaluation: authority check, policy check, quality-gate check, applied identically regardless of which entity type is transitioning. Adding a new governed entity type is a matter of declaring its legal state graph as data (`transition_definitions` rows), not writing a new enforcement path. Participant lifecycle governance — added after most of the rest of the system existed — is the clearest proof this actually holds: it slotted into the exact same mechanism every other entity type already used, with zero new evaluation code.

This matters architecturally for a reason beyond elegance: a governance mechanism that has to be re-implemented per entity type is a governance mechanism that will eventually be implemented incorrectly somewhere, quietly, under deadline pressure. One mechanism, exercised by everything, is auditable in a way that N mechanisms never are.

## Evidence and decision are preconditions, not audit trail

The Trust Pipeline — information into evidence, evidence supporting knowledge, knowledge informing decision, decision justifying a state change — is not a logging feature bolted onto the state machine. It is a real precondition, enforced by the same Quality Gate mechanism as everything else: a Deliverable cannot reach its terminal, delivered state without either accepted Evidence or an approved Decision pointing at it. The gate doesn't care which — evidence-based and decision-based justification are treated as equally valid, both tested independently against real Deliverables in this session's own end-to-end runs.

The practical consequence: "the AI said it was done" is never, by itself, sufficient. Something has to exist — a real Evidence row, a real Decision row, both independently governed with their own lifecycle — before the platform will move the Deliverable forward. That's what makes an AI participant's output auditable the same way a human's is: not code review as a courtesy, but a structural precondition the platform enforces whether anyone remembers to check or not.

## Dual authority, tested adversarially, not just designed

Authority in this system splits into two genuinely separate checks: Platform authority (can this identity administer the platform itself) and Engineering authority (can this specific identity perform this specific governed action, scoped to a Capability and, where relevant, a specific instance). Creator, Reviewer, and Approver are not three hardcoded roles per entity type — they're one generalized badge scoped by `governed_entity_type` + `Capability` + instance, so the same mechanism that stops a Creator approving their own Deliverable also stops an SEU-scoped engineer from authoring a platform-level Pack definition, with no separate code path for either case.

This was verified adversarially, not just designed: two independently authenticated sessions, one holding only a Creator grant and one holding only an Approver grant, run against the same real transition. The Creator was denied with a specific, correctly-differentiated error (`acting_badge_type_mismatch`); a further attempt outside the Creator's granted Capability was denied with a *different*, also-correct error (`no_acting_badge_declared`). Separation of duties as something the system actually enforces under a real HTTP request, not a policy statement nobody re-tests.

## The platform authors itself through its own mechanism

Pack, Template, Profile, and Transition Definition — the building blocks that describe what an engineering organisation actually is — are themselves authored as governed Deliverables, produced by commissioning an ordinary SEU against a small bootstrap Template, walked through the platform's own real lifecycle (draft, review, publish), with the real Trust Pipeline gate applying to that authoring process exactly as it applies to any other Deliverable. There is no separate, privileged "admin mode" that bypasses governance to define what governance looks like. The schema each of these four grammars follows is itself data — versioned, stored, read by one generic form generator — so a new field doesn't require a code deploy, and an old, already-published instance keeps validating against the exact grammar version it was authored against, permanently.

This was proven, not assumed: a complete domain Pack, Template, and Profile for a real scenario were authored from nothing through this exact mechanism this session, including deliberately exercising the generated form (not just the JSON-import shortcut) to confirm the schema-to-submission path actually round-trips correctly.

## Telemetry measures the system, not the participants

Engineering Telemetry derives every metric from data the platform already records — no parallel logging system, no manual status reporting. Flow (cycle time), Governance (quality-gate friction), Runtime (dispatch latency), Knowledge (growth), and Quality (rework rate) are all live queries over the same event stream every governed transition already writes to, computed through one generic metric-registry interpreter rather than a hardcoded dashboard per category — the same "declare it as data, dispatch by a metadata field" shape the governance engine and the schema registry both already use.

The mechanism that matters most here isn't a metric — it's what happens when a pattern is sustained rather than transient. A Quality Gate that keeps blocking the same SEU, a Policy repeatedly waived, a Capability chronically unfulfilled across many SEUs: each of these, past a threshold, automatically raises a real Organisational Learning Obligation and a corresponding Attention Item, closing the loop from measurement to organisational action without requiring a human to notice the pattern first. Telemetry stays strictly passive otherwise — it observes and it raises this one class of obligation; it never itself changes engineering state.

## What this buys you, architecturally

A platform where governance is one generic, uniformly-applied mechanism rather than N per-feature checks is a platform where a new capability — a new entity type, a new Pack, a new Participant kind — doesn't require re-deciding how authority, evidence, and audit work for it. It already knows. That's the actual bet this architecture makes: that governance belongs in the kernel, not the application layer, and that betting on one mechanism used everywhere is cheaper, in the long run, than betting on flexibility to reimplement governance differently each time something new needs it.

The full entity model, chapter by chapter, is published separately as the platform's technical specification. This document exists to argue why the architecture is built the way it is, and to be honest about what's been tested versus merely designed — the distinction this session's own audit discipline insisted on throughout, and the same distinction this document has tried to hold to.
