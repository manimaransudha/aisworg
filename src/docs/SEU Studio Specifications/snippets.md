Reconstructed the mapping (old 1–15 only; 16–46 keep their numbers — this matches the earlier conclusion that those chapters are already in dependency order):

New #	Chapter	Old #
1	Pack Model	5
2	Capability Model	10
3	Service	11
4	Template Model	6
5	Profile Model	7
6	Composition Engine	4
7	Engineering Behavior Model (EBM)	3
8	Objective	1
9	Software Engineering Unit (SEU)	2
10	SEU Commissioning	8
11	Participant Model	13
12	Capability Fulfilment	12
13	Engineering Collaboration Model	14
14	Deliverable Model	15
15	Dependency Engine	9
16–46	unchanged	16–46
Rationale, same two problems as before: EBM (old 3) is now after Pack/Template/Profile/Composition Engine (old 5/6/7/4), which it's actually composed from; Dependency Engine (old 9) is now after Deliverable (old 15), the entity it operates on.

One residual issue not fixed by this reshuffle (carried over from the original proposal, out of scope since it touches Part 3): Dependency Engine still formally precedes Knowledge/Evidence/Decision/Obligation (old 16–19/23, Part 3), which it also reasons over.

-----
Part	New Chapters	Contents	Proposed Title
Part 1	1–8	Pack, Capability, Service, Template, Profile, Composition Engine, EBM, Objective	Engineering Definition Model
Part 2	9–15	SEU, SEU Commissioning, Participant, Capability Fulfilment, Engineering Collaboration, Deliverable, Dependency Engine	SEU Execution Model
Part 1 is everything defined before an SEU exists (declarative, Pack-composed, build-time). Part 2 is everything that exists only once an SEU is commissioned and running (runtime, instance-level). This also matches the Logical Architecture note's own Software Practice vs. Execution split.

Parts 3–7 (old 16–46) are unaffected since those chapters keep their numbers — their existing titles stand as-is.

---------
No existing Part-title file found — the parts are currently untitled (just folder names "Part 1"..."Part 7"). Proposed titles for 3–7, based on their chapter contents:

Part	Chapters	Contents	Proposed Title
Part 3	16–20	Knowledge, Evidence, Ontology, Decision, Traceability	Knowledge and Trust Model
Part 4	21–27	Governance, Authority, Obligation, Policy, Review, Quality Gate, Compliance	Governance Model
Part 5	28–37	Runtime Kernel, State Management, Event Model, Execution Engine, Work Item, Dispatch Engine, Attention Management, Engineering Telemetry, External Interaction, SEU Lifecycle Management	Runtime Execution Model
Part 6	38–46	Pack SDK, SEU Design Kit, Security, Version Management, Multi-Tenancy, Deployment, Reliability, Reference Architecture, Platform Evolution Strategy	Platform Services and Architecture
Part 7	Logical Architecture, Architecture Catalog, Canonical Information Model	—	Appendices

-------------

The platform is overwhelmingly **declarative**. Packs declare behaviour, policies declare constraints, authority declares permissions, obligations declare commitments, and the Runtime Kernel interprets those declarations. This declarative-first architecture should make the platform significantly easier to extend and customise without modifying its core.

The first 37 chapters + Checklist - what the platform is (Logical Architecture)
Part 6 - How is the platform built (Implementation Architecture)

Implementation Architecture:
- Build the engineering primitives
- Platform itself can evolve without constantly rewriting itself
    - Core Platform
    - Evolving Platform Knowledge
    
## My  notes. 
[Sudha: You're right, and this is the crux. Let me concede the core point plainly, because it's the important one: if every actual check is handed to an external participant and the platform only requires-and-records, then the differentiation over Jira-plus-audit-trail is thin. "An external participant verifies and it comes back" does just push the question — the real "how" happens somewhere the platform can't see. That's coordination, not execution.

So here is the line I think is actually correct, and it's a refinement of "execution is external", not a contradiction:

The platform does not execute the tenant's production work (building the source code). But it should execute its own declared standards, and that is a first-party capability — platform-associated AI agents run the checklists. The organisation outsources building. It does not outsource checking its own standards. Those checklists are the organisation's own asset (Pack contributions); the organisation should have the competence to run them.

That distinction is the whole "executable" claim. And it terminates the regress you're pointing at, if you extend the Pack one step further:

A checklist item declares its own verifier. "No hardcoded passwords" in the Pack isn't just English — it carries verifier: platform secret-scan agent. So when the Source Code transition is attempted:

the platform's own verification agent pulls the commit from VCS, runs the secret scan against the diff, and produces the pass/fail + findings itself;
that result is the evidence — the platform generated it, not an outside party;
the quality gate consumes it and the transition proceeds or blocks.
Now the "how" bottoms out inside the organisation: the org's agent read the code and ran the check. No external participant, no "and then magic happens." That is "Packs are declarative" taken to its conclusion — the checklist item carries its own executable check, composed into the SEU, run by the org's agent. That is the thing Jira cannot do: Jira shows you a checkbox and trusts your tick; the executable org runs the checklist itself and produces the evidence.

One honest refinement to "all checklists by an AI agent", and it's a real caveat, not a hedge: checklist items split into two kinds.

Machine-verifiable — "no hardcoded passwords", "dependencies scanned", "tests present and passing", "no PII in logs". A platform agent runs these autonomously and deterministically. This is where your point is fully right, and it should be the default. The org checks itself.
Judgment — "the architecture is sound for this scale", "the API design is coherent". An AI agent can execute these too, but as reasoned opinion, not deterministic verification. Here the agent produces an assessment, and an accountable party (a human, or the agent itself as an accountable participant the org has chosen to trust) signs. The competence is still exercised; it just isn't a true/false scan.
So: yes, make checklist execution a first-party, platform-agent capability, verifier declared per item, machine-verifiable items run autonomously by the org's agents. That is the executable differentiation. Judgment items are agent-executed-as-advice with an accountable sign-off, not left to "someone external verifies somehow."

The one thing to be clear-eyed about, because it changes what the platform is: this means the platform ships competence, not only governance. A verification-agent runtime becomes part of the platform, first-party. That's a real expansion beyond the strict "the platform never executes anything" — and it's exactly the expansion that earns "AI-native" and "executable". The earlier boundary was "don't run the tenant's production agents." The sharper boundary is: the platform runs the organisation's own checks; it does not run the tenant's production build. Production stays orchestrator-agnostic and external. Verification of declared standards comes home.

That's the differentiation you're reaching for, and I think it's correct: an executable organisation is one that can perform its own governance, not merely demand it.

I am going to broaden this. It does not matter whether the checklist execution happens on the platform or on the tenants environment. that is just defined by the contract between the platform and the tenant and an access question.  The competencies required to do this is "just a prompt" not any heavy code strcuture. The AI participant is going to execute it - Dont you think so ?
Yes. And you've just corrected two things I over-committed, both correctly.

First: location is a contract/access question, not architecture. I drew a line — "verification comes home to the platform, production stays external" — that doesn't hold up. Whether the checking AI runs in the platform's environment or the tenant's is a hosting/access/data-residency decision negotiated in the contract, exactly the "execution environment is a per-tenant choice" we already settled for participants. A verification agent is just another participant. So there's no architectural "first-party verifier" requirement. Drop it. It's a deployment detail.

Second, and this is the real point: the competency is "just a prompt." This collapses a distinction the whole industry still treats as fundamental. In the pre-AI world, to make "No hardcoded passwords" executable you had to build a verifier — a scanner, a rules engine, bespoke code per check. In the AI-native world the checklist item's text is the executable instruction, and a general AI participant is the universal executor. You don't build a verifier; you write the standard, and a capable participant runs it. Declarative and executable stop being two things. They're the same artifact, because the executor is an LLM, not a rules engine.

That is the differentiation, stated properly — sharper than how I had it:

A checklist item is simultaneously the standard (human-readable), the governance contribution (a composable Pack asset), and the executable instruction (an AI participant runs it). One artifact, three identities.

Jira has only the first. It shows dead text and trusts a human tick. The executable organisation has all three, and it gets the third for free the moment the executor is a competent AI participant — no per-check engineering, no verifier code in the platform. Write "No hardcoded passwords," and the org can run it. Write "No PII in logs" tomorrow, and the org can run that too, same day, no build. That is what "executable" should mean, and you're right that without it this is a governance skin over Jira.

Now the honest part, so this isn't superficial agreement: "just a prompt" nails the competency, but it moves the entire hard problem to a different place — and that place is the platform's actual job.

If any check is one prompt away from executable, then the risk is no longer "did we build the scanner." It's: which participant ran it, how capable/trustworthy is it, and does its "pass" mean anything? A weak agent will cheerfully report "no hardcoded passwords" and miss one. So the platform's engineering is not verifiers. It's governing the prompt-executing participants:

Authority — which AI participant (which badge) is permitted to certify which checklist. The coding agent cannot also be the checking agent (creator ≠ approver), even when both are "just a prompt."
Assurance level per item — some checks the org accepts on the agent's word; high-stakes ones require the agent to invoke a deterministic tool, or require a second participant, or a human co-sign. That threshold is declared with the checklist item, alongside the prompt.
Attestation — the outcome is bound to the commit and to the certifying agent, permanently, so "the org verified no hardcoded passwords" has a name and an artifact behind it, not just a green tick.
Escalation — a failed or low-confidence result raises Attention, doesn't silently pass.
So the shape is: the checklist item carries its prompt and its assurance policy; an AI participant executes the prompt wherever the contract puts it; the platform governs who may certify, binds the result to the commit, and enforces the transition. The platform ships no verifiers and no heavy code for the checks. It ships the thing that makes a field of prompt-executed checks trustworthy and accountable at organisational scale.

That's the whole game, and I think your instinct is exactly right: the competence is a prompt, the executor is an AI participant, the location is a contract term — and the platform's differentiation is that it turns a written standard into an executed, attributed, gated organisational act, automatically, because the executor is intelligent rather than hand-coded.

You are again overthinking. We already have the governnance and wuthority defined. So all we need is refine the packs definition. We have to review each category and differentiate between what i machine verifiable vs what needs human participant. This coule be part of the pack definition itself.

So the "No hardcoded passwords" checklist would be assigned to an AI particpiant with a prompt "Refer to VCS. Verify that there are no hardcoded passwords. Report Passed or Failed with notes....." etc. 

A checklist item which is abstract like "Ensure architecture is correct for the requirement"  will be AI participant summarising the details looking at whatever is given t it as a reference and the respose will be judgemental" paired with a human participant. 

Do you think this is correct ?
Yes. This is correct, and it's correctly scoped — it's a Pack-definition refinement, not new engine work. The governance, authority, quality gates, Review Model, and attestation already exist. You're just adding metadata to each checklist item and letting it ride on machinery that's already built.

The per-item shape you're describing is basically:

classification: machine-verifiable | judgment
prompt: the instruction ("Refer to VCS, verify no hardcoded passwords, report Passed/Failed with notes")
participant assignment: AI alone, or AI paired with a human
output contract: Passed | Failed + notes
And each classification drops onto an existing gate with no new mechanism:

Machine-verifiable → the AI participant runs the prompt, returns Passed/Failed + notes. Passed/Failed is the gate signal (Evidence / quality gate); the notes become the attested evidence bound to the commit. Done, no human.
Judgment → this is the Review Model you already built (Phase 14). The AI participant looks at the references, produces the summary/assessment — that's the Review content — and the human participant accepts it. The AI advises, the human's acceptance is the accountable sign-off, and creator ≠ approver still holds (the AI drafts, the human certifies). The requires_accepted_review gate consumes it exactly as it does today.
So the "AI + human pairing" isn't a new construct — it's an AI participant generating a Review and a human participant accepting it. The machine-verifiable case is an AI participant generating Evidence. Both already have homes.

The only actual work is the part you named: a classification pass over each Pack category — go item by item, mark it machine-verifiable or judgment, write the prompt, set the participant assignment — and it becomes part of the Pack definition. No kernel change, no new engine. That's the whole thing, and it's right.]


 
## Packs 


[Remarks: **Packs are the unit of evolution**. Every future enhancement should ideally be introduced as a Pack rather than by modifying the Runtime Kernel.

> **A Pack is not a plugin; it is a declarative engineering contribution.**

Traditional plugin systems primarily contribute executable code. In contrast, Packs contribute **engineering behaviour, knowledge and intent**. The Runtime Kernel and runtime services interpret those declarations to produce the desired behaviour.

This distinction has profound implications. It means a Pack can be reasoned about, validated, composed, audited and even generated by an AI without executing arbitrary code. That makes Packs explainable, traceable and governable—properties that are essential for an AI-driven software engineering platform.
]

Important Differentiator — Executable Contributions and Verification Classification

Supplement to the Pack Model. This section records how verifiable Pack contributions are made executable in an AI-native platform. It changes none of the requirements above; it refines how the §9 contributions that are checked (Checklists, Quality Gates, Review Gates, Obligations) are defined and executed. It reuses the platform's existing governance, authority, Quality Gate, Review Model and attestation. No Runtime Kernel change.

### 20.1 Principle: a verifiable contribution carries its own execution
Traditionally a checklist or standard is text a human is trusted to apply. In an AI-native platform a verifiable contribution carries not only the standard but the means to execute it, because the executor is an AI participant. The same artifact is then three things at once: the human-readable standard, the composable governance contribution, and the executable instruction. A checklist item becomes executable simply by being written, given a capable participant, with no bespoke verifier code.

The platform does not perform the check. It declares it, assigns it to a participant, records the outcome as Evidence or a Review bound to the commit, gates the transition, and attests who certified it. Where the participant runs, in the platform environment or the tenant environment, is a contract and access decision, not an architectural one.

### 20.2 What a verifiable contribution declares
Every verifiable item (a checklist item, a quality-gate criterion, a review requirement, an obligation) declares:

Statement — the standard, human-readable ("No hardcoded passwords").
Classification — machine-verifiable, judgment, or human-attested (§19.3).
Prompt — the instruction the AI participant executes, for the AI-executed classes ("Refer to the VCS reference. Verify there are no hardcoded passwords or secrets. Report Passed or Failed with notes.").
Participant assignment — an AI participant, an AI participant paired with a human, or a human authority.
Output contract — the shape the platform consumes: Passed/Failed plus notes, or an assessment plus a human acceptance.
Assurance policy (optional) — a confidence or severity threshold at which the result escalates to a human, reusing Attention and Review.
This is metadata on the contribution, part of the Pack definition. It needs no new engine.

### 20.3 Verification classifications
The axis is who or what can authoritatively determine Pass/Fail, and who is accountable.

1. Machine-verifiable. An objective result determinable from the artifact by an AI participant, which may invoke a tool. The AI participant is accountable for the reported result. Output: Passed/Failed plus notes, no human in the loop.
Examples: no hardcoded passwords, no PII in logs, tests present and passing, dependencies scanned, coverage above threshold, naming convention followed.

2. Judgment (AI-assessed, human-ratified). A contextual or subjective determination. The AI participant analyses the references and produces a reasoned assessment; a human participant accepts it. The human is accountable, and separation of duties holds because the assessing participant is not the approving one. This maps directly onto the built Review Model: the AI produces the Review, the human moves it to Accepted, and the requires_accepted_review gate consumes it.
Examples: the architecture is appropriate for the requirement, the API design is coherent, the failure handling is adequate for the risk.

3. Human-attested (authority act). The check is an authoritative human or organisational act that cannot be derived from the artifact, so an AI can neither verify it nor meaningfully advise on it. A designated authority attests, and that recorded act is the evidence. Common in Compliance and Governance contributions.
Examples: customer sign-off obtained, legal approval received, regulatory submission accepted, budget sponsor approved.

### 20.4 Are two classifications sufficient?
Machine-verifiable and Judgment are the correct primary split, but they are not complete. Both assume the answer comes from analysing the artifact. Some real checks are not artifact analysis at all; they are an authority's act, such as a customer signature or a regulator's acceptance. Forcing those into Judgment would wrongly imply an AI can assess them, when the only thing that counts is the recorded human or organisational decision. Hence the recommended third class, Human-attested.

One further case is best handled as a variant, not a new class. External evidence is a result supplied by an external system of record rather than by reading the artifact: a CI pipeline green, a deployment succeeded, an external vendor's penetration test passed, a ticket approved in an external tool. Treat this as Machine-verifiable with the verifier being an Integration-pack connector rather than direct artifact analysis. It is still an objective, automatable Pass/Fail; only the source of truth differs. Surface it as a separate tag if Integration packs need it explicit, but it does not warrant a fourth top-level classification.

Recommendation: three classifications, Machine-verifiable, Judgment, Human-attested, with an optional external-evidence marker on machine-verifiable items.

### 20.5 Mapping the contribution categories
Classification applies to the contributions that are checked. The rest inform or provide, and are not classified.

Contribution (§9)	Typical classification
Checklists	per item; span all three
Quality Gates	mostly machine-verifiable
Review Gates	judgment (AI-assessed, human-ratified) by nature
Obligation Definitions	machine-verifiable (evidence present) or human-attested (approval obtained)
Policies / Standards / Decision Rules	machine-verifiable where objective, judgment where interpretive
Ontology, Knowledge Assets, Templates, UI Components, Services, Metrics	not classified — inputs and assets, not checks
By Pack taxonomy (§6), the weight differs:

Technology packs — mostly machine-verifiable (conventions, build, test).
Compliance packs — a mix of machine-verifiable (evidence present) and human-attested (approvals, sign-offs).
Domain and architecture concerns — largely judgment.
Integration packs — external-evidence (machine-verifiable via connectors).
Platform and Organisation packs — spread across all three.
19.6 Reuse of existing machinery
Nothing here adds an engine. Each classification lands on what is already built:

Machine-verifiable → the AI participant's Passed/Failed is Evidence; the Quality Gate consumes it; the notes are attested against the commit.
Judgment → the Review Model (Phase 14): the AI produces the Review, a human accepts, requires_accepted_review gates the transition.
Human-attested → an authority-gated Obligation or Review whose acceptance is the attested act.
The only work is a classification pass over each Pack's verifiable contributions: mark each item's classification, write its prompt, and set its participant assignment and output contract, all recorded in the Pack definition.

### 20.7 Packaging pattern: master pack, classified sub-packs, and graduation
A checklist concern is packaged as a master checklist Pack that declares Required dependencies (§10) on two sub-Packs: a machine-verifiable Pack and a judgment Pack. Packs do not nest; the Composition Engine pulls the master and both sub-Packs into the EBM through dependency resolution. Consumers depend on the master, which is the concern's public unit. The split beneath it is an authoring and evolution concern, not something a commissioning tenant needs to see.

Rationale. The two sub-Packs change differently and are curated by different owners. The machine-verifiable Pack is a prompt-and-tool asset, refined through prompt engineering and tool integration. The judgment Pack is an assessment-rubric asset, curated by domain expertise. Separating them gives each its own version line (PM-003) and a single coherent responsibility (PM-001), so one can be tuned or released without churning the other. The master restores the whole topic at composition. The factoring axis is therefore lifecycle and ownership, with the master providing the topical view.

Graduation. An item may move from judgment to machine-verifiable as prompts and tools mature. This is a version-governed move, not a silent reclassification: the item leaves the judgment Pack in one version increment and enters the machine-verifiable Pack in another. Because every EBM records the exact Pack versions it composed (§12), SEUs commissioned before the graduation remain reproducible with the item still classified as judgment, while new SEUs receive the automated form. The innovation pathway is thus auditable and non-destructive.

Learning loop. Graduation candidates need not be guessed. Engineering Telemetry (Ch.35) can detect judgment items whose AI assessment consistently agrees with the human sign-off and raise an Organisational Learning Obligation (Architecture Catalogue ADR – Telemetry-Driven Organisational Learning) proposing that the item graduate into the machine-verifiable Pack. The classified-sub-Pack structure gives that signal a clean destination, making "judgment to machine-verifiable" a measured maturity path rather than a manual judgement.

Discipline. The split axis is classification only, two sub-Packs per master. The master remains the unit consumers depend on. Tenants should not depend on the sub-Packs directly, or the aggregation benefit is lost and Packs proliferate.


## Template


[Sudha: 

I also think we've now finished the **architectural backbone**.

From this point onwards, we're specifying the objects that an SEU is composed of.

The next chapter should **not** be Templates.

I changed my mind after thinking about the last four chapters.

The sequence should be:

```
Architecture Catalogue

↓

SEU

↓

Engineering Behavior Model

↓

Composition Engine

↓

Pack Model

↓

Template Model

↓

Commissioning
```

Why?

Because **Templates** are the missing abstraction between Packs and a commissioned SEU.

A Pack contributes behaviour.

A Template defines **what kind of SEU you want to create**.

For example,

```
Enterprise Web Application

↓

Template

↓

Composition Engine

↓

EBM

↓

SEU
```

Without Templates, the Composition Engine doesn't know **what** it is composing for.

--------------------



]


---

I realised we have now established four orthogonal concepts that form the heart of the commissioning process:

|Concept|Responsibility|
|---|---|
|**Template**|Defines the structural blueprint of the SEU.|
|**Profile**|Defines how that blueprint is commissioned for a specific context.|
|**Pack**|Contributes behaviour, knowledge, governance, integrations and other engineering assets.|
|**Engineering Behavior Model (EBM)**|Represents the fully composed behavioural specification that governs the commissioned SEU.|

These concepts are deliberately independent. A single Template can be commissioned using many Profiles. A Profile can select different Packs over time. The Composition Engine synthesises a new EBM whenever those inputs change.

I believe we've now completed the conceptual model required to commission an SEU. The next chapter should therefore shift from static definitions to **dynamic behaviour**:
]

---

 
platform's defining architectural separations:

|Concept|Responsibility|
|---|---|
|**Engineering Behavior Model (EBM)**|Defines **how** engineering should be performed.|
|**Capability**|Defines **what engineering competency** is required.|
|**Participant**|Provides the competency.|
|**Work Item**|Applies the competency to advance a Deliverable.|

These four concepts are orthogonal. They should never be collapsed into one another.


For example, a **Developer Participant** doesn't "own" the Development Capability. It merely fulfils it for a period of time. Tomorrow, another AI model, a human engineer, or an external autonomous service could fulfil exactly the same Capability without changing the SEU.

I think that's a stronger and more durable abstraction than today's agent frameworks, which often equate an "agent" with a fixed role and a fixed set of skills. Here, **Capabilities are permanent, Participants are transient**, and the platform composes them dynamically to satisfy engineering objectives. That separation will make the platform significantly more adaptable over time.

-------



## Service

[Sudha:
This chapter fills the largest actual gap the Book 1 comparison turned up. Book 1 gives Service full peer status alongside Objective and Capability — its own narrative chapter, its own formal chapter, and a central role in the Capability Reasoning Network as one of four things Capabilities exchange with one another (Service, Evidence, Knowledge, Decision). Book 3 had nothing. Not a chapter, not an entity, not a line in the Canonical Information Model.

The placement question resolved itself once I looked at where Capability (Chapter 10) and Capability Packs (Chapter 5) already sit. Book 1 says it precisely: "a capability is an enduring ability; a service is what that ability actually delivers." A Capability Pack that declares a Capability without also declaring what that Capability contracts to deliver is only telling half the story. So Service is declared alongside Capability, by the same Pack, as the natural second half of a Capability's declaration — not a separate concern bolted on afterward.

I want to be careful about scope here, because it would be easy to let Service become too much. Two guardrails:

First, Service is not the sole coordination mechanism between Capabilities. Book 1's own Capability Reasoning Network chapter is explicit that Evidence, Knowledge and Decision propagate independently of Service, and warns directly against "treating every interaction as a service call." Service gets exactly one job here: it's the concrete, contracted unit that sharpens what the Dependency Engine's existing "Capability Dependency" type (Chapter 9) actually means — not "Architecture Capability is available" in the abstract, but "the Approved Solution Architecture service has been delivered," specifically.

Second, Service is not a metrics database. It declares a Service Level — a target, part of its own versioned definition — but the *observed* performance against that target is Engineering Telemetry's job (Chapter 35), derived from Service's own events, never written back onto the Service object itself. That keeps faith with Telemetry's own stated principles: passive, derived, no duplicate data entry. Service defines what's measurable about it; it doesn't measure itself.
]


----------


## Deliverable

[Sudha: I think we're now ready for what is arguably **the heart of the runtime**.

Notice what we've built so far:

- SEU
- EBM
- Packs
- Profiles
- Dependency Engine
- Capabilities
- Participants
- Collaboration

There is still one thing missing.

> **How does engineering work actually happen?**

Interestingly, I no longer think the answer is "Work Items".

I think the answer is:

> **Deliverables evolve through states.**

Work Items are simply one mechanism for changing the state of a Deliverable.

This is a subtle but extremely important shift.

It means the runtime is no longer work-centric.

It is **state-centric**.

----------

While writing this chapter, I realised we've finally uncovered the true runtime model of the platform.

Originally, we thought the runtime revolved around **Work Items**. Then we shifted to **Dependencies**. I now think both are supporting concepts.

The actual runtime revolves around **state transitions of Deliverables**.

The execution loop now looks like this:

```
Deliverable State

↓

Dependency Evaluation

↓

Capability Requirement

↓

Capability Fulfilment

↓

Participant Execution

↓

Evidence

↓

Governance

↓

Deliverable State Transition
```

This is fundamentally different from traditional workflow engines, which execute predefined sequences of tasks. In this architecture, **the state of the Deliverable drives execution**, and everything else exists to enable or validate that state transition.

> **Deliverables evolve through states.**

I think this has an important consequence for the remaining chapters.

**Work Items should no longer be modelled as persistent business objects.**

Instead, they should be treated as **ephemeral execution plans** generated on demand to move a Deliverable from one state to the next. They are analogous to an execution plan generated by a database query optimiser: useful while executing, but not the primary object of the system.

If we adopt that principle, the remainder of the platform becomes even cleaner:

- Deliverables are persistent.
- Knowledge is persistent.
- Decisions are persistent.
- Evidence is persistent.
- Obligations are persistent.
- Participants are transient.
- **Work Items are transient.**

I think that is the logical conclusion of the architecture we've been building, and it distinguishes the platform from virtually every existing software engineering and project management system.

]

-------------


I think we now need to distinguish three different concepts that are often conflated:

|Concept|Meaning|
|---|---|
|**Information**|Raw engineering data or observations.|
|**Knowledge**|Information that has been validated and accepted for reuse.|
|**Wisdom**|Engineering judgement applied to a specific context.|

The platform should permanently store **Information** and **Knowledge**, but **Wisdom** is different. Wisdom is contextual. It is the application of Knowledge, the current Engineering Behavior Model, the active Deliverables, Dependencies, Obligations and Objectives to make an engineering decision.

That means Wisdom is **computed**, not stored.

This distinction is important because it prevents the platform from trying to preserve every engineering decision as a universal truth. Instead, it preserves the underlying Knowledge and allows future SEUs to apply that Knowledge differently depending on their context.

I think this is a very AI-native way of thinking about organisational learning. It also opens the door to future reasoning services that can explain _why_ a recommendation was made, based on the Knowledge available at that point in time, rather than simply replaying past decisions. I suspect this distinction between Information, Knowledge and Wisdom will become a recurring theme in the remaining chapters on Evidence, Decisions and the Knowledge Graph.

And where does this all fit into the engineering capital definition. 

-----------------

## Ontology Model


[Remarks: Ontology is **the language of the SEU**. It becomes the semantic foundation of the entire platform.

Without it:

- AI Participants use different terminology.
- Organisation Packs introduce conflicting jargon.
- Domain Packs redefine concepts.
- Knowledge becomes ambiguous.
- Evidence becomes difficult to relate.
- Deliverables lose semantic consistency.

Every persistent object that is defined like

- Deliverables
- Knowledge
- Evidence
- Decisions
- Obligations
- Capabilities
- Engineering Behavior Model

should reference **concepts**, not free-text terminology.

This has a profound benefit for the multi-organisation scenario.

Suppose:

- TCS uses "Technical Design".
- IBM uses "Solution Design".
- Cigna uses "Architecture Specification".

Each Organisation Pack contributes its preferred terminology. The Ontology maps all three terms to a single semantic concept. Participants can therefore reason consistently without forcing organisations to abandon their own vocabulary.

This makes the Ontology the **semantic integration layer** of the platform. Just as the Composition Engine integrates behaviour from Packs, the Ontology integrates meaning from Packs. Together, they allow multiple organisations to collaborate within a single SEU while preserving both semantic consistency and organisational identity. This is one of the distinguishing architectural innovations of the platform.
]


## Ontology through packs 

Pack Categories
Template Categories
Dependency types
Deliverable categories
Knowledge categories
Evidence categories
Decision categories
Relationship types (traceability)
Obligation categories 
Policy categories
Review categories
Quality Gate categories
Event categories
Attention categories
Interaction categories

