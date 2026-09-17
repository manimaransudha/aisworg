# Position

The core claim is that safe AI autonomy is primarily an organisational problem, not a model-capability problem: the persistent executable unit is the organisation, not any human or AI participant. The book should clearly establish:
- why prompts, workflows, and agent orchestration are not organisations;
- the organisational chain—Objective → Capability → Service → Role → Participant—plus evidence, knowledge, governance, and learning;
- executable governance as runtime enforcement of authority, accountability, evidence, and state change;
- the separation of doing work from approving it;
- auditability rather than a promise of correct judgement; and
- why this becomes necessary as autonomous participation scales.

# Foreword

The foreword establishes the book’s reader contract: this is organisational theory first, AI theory second; “organisation” means the Software Engineering Unit rather than the parent company; and the book moves from argument, to ontology, to organisational behaviour, to execution mechanics. It also appropriately frames the manuscript as a coherent theory to be tested, not a claim of completed empirical validation.

## Chapter 1 

The better distinction is:
- Chapter 1 §1.5: establish the organisational conditions AI must participate within—responsibility, governance, artefacts, knowledge, justification, and continuity.
- Chapter 2: show precisely how current agent-centred systems fail to represent those conditions, through its six constructs.
The edit needed is not removal; it is to ensure Chapter 2 does not restate §1.5 as if it were new. Chapter 1 should make the positive case for mature engineering practice, while Chapter 2 turns it into a focused critique of current AI-agent models.

AI-enabled organisational management is superior to managing execution mainly through periodic project-control mechanisms.

--------

@_Editorial Log is a log of the edits that have been made on the manuscript so far and/or has details of unfinished edits. Can you see that ?
And continue to use that to log the edits you make. is this understood ?

/Volumes/Shirdi/Vaults/Sudha Manimaran/AI Software Organisation/Academic Publishing/Position Paper — Academic Draft.md  gives the view of the intent of the book.


Objectives define purpose; capabilities define organisational ability; services expose those abilities; roles govern them; participants realise them; knowledge improves them. 

  
--------------
Sentence-level style
There are few literal sentence fragments in the body. The larger issue is a repeated, fragmented-feeling cadence built from chained and constructions:
“planned and coordinated and governed and continuously improved”

“A role carries responsibility and authority and competency and accountability.”

Use normal syntax and selective lists instead:
“A role carries responsibility, authority, competence, and accountability.”

Also standardise spelling. The manuscript mostly uses British English—“organisation,” “organisational”—but Chapters 2 and 3 intermittently use American forms such as “organizational,” “specialized,” and “behavior.” Choose one house style and apply it consistently.
My overall view: the intellectual spine is sound. A targeted consolidation and style pass—not conceptual expansion—would make Part 1 substantially more authoritative and less repetitive.

------------

Every service should possess an explicit contract, defining organisational expectation independently of implementation: its **purpose** (why the service exists), its **provider** (which capability provides it), its **consumers** (which organisational entities consume it), its **inputs** (what artefact or request is required), its **outputs** (what value is delivered), its **preconditions** and **postconditions** (what must be true before and after execution), its **quality expectations** (accuracy, timeliness, completeness, compliance, reliability), and the **evidence produced** to demonstrate successful delivery. No implementation detail appears in any of these — the contract describes organisational expectation, not operational procedure (Part 1 Chapter 7 §7.6 specifies the Service Contract in full, including a worked example).

-------------

Every role carries several categories of responsibility: **capability stewardship**, ensuring the capability remains effective; **service governance**, ensuring the services it exposes satisfy organisational expectation; **knowledge stewardship**, maintaining the organisational knowledge relevant to the capability; **standards**, defining and evolving engineering convention; **decision authority**, approving organisational decision within the capability's domain; and **organisational learning**, improving the capability through evidence. These responsibilities continue irrespective of which participant currently occupies the role.

-------------

Artefacts also differ from the **Deliverable** (Chapter 23), though the two are closely related: a Deliverable is the execution aggregate binding Objective, Capability, Service, Role, Participant, Activity, Artefact, Evidence, Knowledge, Decision and Governance together for a single piece of organisational intent, while an artefact is one persistent output that a Deliverable's activity produces along the way. A requirements specification, an architecture model and a test report may all be artefacts contributing to the same Deliverable; the Deliverable is the container through which they accumulate into one coherent piece of organisational intent, while each artefact continues to serve the organisation independently of any single Deliverable's lifecycle — supporting maintenance, audit and future development long after the Deliverable that produced it has closed.

------------

Evidence alone does not establish organisational truth. Suppose the organisation observes that PaymentService directly accesses CustomerRepository — this is evidence. Whether it constitutes an architectural violation, an acceptable implementation or technical debt depends on organisational policy, so knowledge requires organisational evaluation beyond the evidence itself. Evidence informs; knowledge concludes (Chapter 16 formalises this further).


------------


