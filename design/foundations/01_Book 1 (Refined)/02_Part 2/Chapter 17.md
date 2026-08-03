# Decision

## 17.1 Intent

Organisations continuously acquire information: they observe evidence, they establish knowledge. Neither, by itself, changes organisational behaviour unless the organisation commits to a course of action — that commitment is the **Decision**.

Most software engineering treats decisions as documents — an architecture decision record, a change request, an approval note, a set of meeting minutes. These are merely *representations* of a decision. A decision is something more fundamental: the point at which the organisation commits to changing its future behaviour. Knowledge tells the organisation what it believes; a decision tells it what it will do because of that belief. Within the ontology, decisions are first-class organisational entities — not meeting outcomes, not documents, but organisational commitments that influence future behaviour. Without decision, knowledge remains passive; with decision, knowledge becomes organisational action.

## 17.2 Definition

A **Decision** is an organisational commitment to a course of action, based on accepted knowledge and exercised under organisational governance. A decision records what the organisation has chosen, why it has chosen it, what knowledge supports the choice, what consequence is expected, and who possesses the authority to decide. It represents the transition from organisational understanding to organisational intent.

## 17.3 Why Decisions Exist

Software engineering involves continual choice: should a requirement be accepted, should a dependency be introduced, should a deployment proceed, should a technology be adopted, should a vulnerability delay release? Every such choice influences future organisational behaviour. If it remains undocumented, future participants lose organisational context, the same discussion recurs, knowledge fragments and engineering consistency deteriorates. Decisions exist to preserve organisational intent against this erosion.

## 17.4 Characteristics

A decision is **intentional**: it always represents a deliberate organisational commitment, and accidental behaviour is not a decision. It is **knowledge-based**: every decision relies on accepted organisational knowledge — knowledge without decision remains merely informational, decision without knowledge becomes arbitrary. It is **governed**, occurring within organisational authority, approval, policy and compliance that determine who may decide. It is **traceable**: every decision should answer what knowledge supported it, which evidence justified that knowledge, who approved it, and which objectives benefit. And it is **consequential**: a decision influences future organisational behaviour, and if organisational behaviour remains unchanged, no decision has actually occurred.

## 17.5 Decision versus Knowledge, Decision versus Activity

Knowledge explains organisational understanding; decision explains organisational intention. Knowledge might state that the current authentication service cannot satisfy projected transaction volume; the corresponding decision states that the authentication service will be replaced before the next production release. Knowledge explains reality; decision changes it.

Approving a decision is itself an activity — reviewing alternative, evaluating risk, conducting discussion and approving recommendation are all activities that occur within an architecture review, for instance — but the resulting architectural choice, unlike the meeting that produced it, becomes a Decision that persists. The meeting concludes; the decision remains (Chapter 13 formalises Activity in full).

## 17.6 Decision Categories

Engineering organisations make several classes of decision. **Strategic decisions** concern long-term organisational direction — technology strategy, architecture principle, platform selection. **Architectural decisions** concern component structure, integration pattern, technology adoption and boundary definition. **Operational decisions** concern release approval, incident response, deployment timing and capacity change. **Governance decisions** concern policy approval, compliance exception, security acceptance and risk disposition. And **knowledge decisions** concern the acceptance of inferred business rule, the validation of recovered architecture, the approval of organisational terminology and the confirmation of traceability.

## 17.7 Decision Lifecycle and Rationale

A decision moves through identifiable states: **proposed**, once an alternative has been identified; **under evaluation**, while knowledge and evidence are assessed; **approved**, once organisational commitment is established; **operational**, while it actively influences behaviour; **challenged**, once new knowledge calls it into question; **superseded**, once improved organisational understanding results in replacement; and **retired**, once it no longer influences organisational behaviour, historical traceability remaining throughout.

Every decision should preserve its rationale — the objective it served, the alternatives considered, the knowledge relied on, the evidence supporting that knowledge, the expected consequence and the known risk. Future participants should understand not merely what was chosen but why, which dramatically reduces organisational rediscovery.

## 17.8 Decision Authority and Quality

Not every participant may make every decision. Authority belongs to roles, not to participants — participants exercise authority only while occupying an organisational role, so changing participants should never alter organisational decision structure. Decision authority is therefore itself a persistent organisational asset (Chapter 11 formalises Role in full).

Decision quality depends on evidence quality, knowledge quality, governance quality, traceability and genuine consideration of alternative and organisational objective. Poor decisions frequently originate from poor organisational reasoning rather than poor participant capability — a reframing with direct implications for how organisations should respond to a bad decision: by strengthening the reasoning that produced it, not merely by replacing the participant who made it.

## 17.9 Relationships

Within the ontology, a Decision is supported by Knowledge; indirectly depends on Evidence; influences Activities; constrains Services; may establish organisational policy; may modify Capabilities; is governed by one or more Roles; and contributes to organisational memory. The decision is the bridge between organisational understanding and organisational behaviour.

## 17.10 Invariants

A decision shall be supported by accepted knowledge. A decision shall identify organisational authority. A decision shall influence future organisational behaviour. A decision shall preserve organisational rationale. A decision shall remain historically traceable. Violation of these invariants transforms decision into undocumented organisational behaviour.

## 17.11 Operational Semantics

Knowledge informs decision; roles exercise authority; participants execute activity; activity implements decision; artefact records outcome; evidence evaluates consequence; knowledge evolves; future decisions improve. The organisation therefore behaves as a continuous organisational decision system.

## 17.12 AI Implications

Artificial intelligence can propose decision, analyse alternative, estimate consequence and identify risk — but it should not become the source of organisational authority, which remains an organisational construct. Participants, whether human or artificial, exercise authority only within assigned role, a distinction that preserves organisational governance while permitting increasingly autonomous reasoning.

## 17.13 Decisions as Organisational Capital

Financial organisations accumulate capital; engineering organisations accumulate decision. Every sound decision reduces future uncertainty; every preserved rationale reduces rediscovery; every traceable commitment strengthens organisational continuity. Decisions therefore represent accumulated organisational judgement — assets, not administrative record.

## 17.14 Chapter Summary

Decisions transform organisational knowledge into organisational commitment. Knowledge explains what the organisation accepts as true; decision determines how the organisation will behave because of that understanding. By elevating decision to a first-class organisational entity, the ontology preserves organisational intent, reduces repeated reasoning and enables explainable organisational behaviour. The final chapter of this Part formally specifies **Governance**, the entity that constrains every objective, capability, service, role, participant, activity, artefact, evidence, knowledge and decision introduced throughout this ontology — and, with it, closes the loop that connects them all.
