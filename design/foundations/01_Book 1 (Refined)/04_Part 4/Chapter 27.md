# Knowledge Acquisition

## 27.1 Introduction

Organisational knowledge is the primary strategic asset of the AI Software Organisation, but it does not arise spontaneously. Organisations continuously encounter new requirement, new technology, new regulation, new operational behaviour, new failure and new architectural constraint — each an opportunity for organisational learning. The process through which these observations become organisational knowledge is **Knowledge Acquisition**, treated here not as documentation but as a continuous organisational capability in its own right.

## 27.2 Definition

**Knowledge Acquisition** is the governed organisational process through which observation, evidence and experience are transformed into accepted organisational knowledge, encompassing discovery, validation, refinement, integration and acceptance. Its purpose is not merely to collect information — it is to improve organisational capability.

## 27.3 Why Knowledge Acquisition Exists

Software engineering organisations constantly generate information — requirement changes, code evolves, tests execute, deployments occur, incidents arise — and without systematic acquisition, these observations disappear into organisational history. The same mistake recurs, the same architectural discussion repeats, the same business rule requires rediscovery. Knowledge acquisition exists to prevent this organisational amnesia.

## 27.4 Sources of Knowledge

Knowledge may originate from requirement (business intent, business rule, terminology, constraint), architecture (design rationale, technology choice, architectural principle), implementation (pattern, dependency, framework usage, algorithm), testing (behaviour, quality, failure mode, coverage), operations (performance, reliability, incident, capacity), governance (policy, standard, compliance finding, risk assessment), human experience (engineering judgement, lesson learned, design discussion, operational experience) and artificial intelligence (semantic analysis, pattern discovery, dependency inference, impact analysis, hypothesis generation). The ontology deliberately treats every source symmetrically — none is privileged over any other simply because of where it originated.

## 27.5 Explicit and Implicit Knowledge

Organisations possess both explicit knowledge, already present in organisational artefact (requirement, architecture, policy, decision record), and implicit knowledge, existing only indirectly (undocumented business rule, architectural assumption, coding convention, operational practice, legacy behaviour). Knowledge acquisition must address both — implicit knowledge is not a lesser form of understanding, merely a harder one to surface.

## 27.6 Continuous Acquisition

Traditional software engineering often performs knowledge acquisition only after project completion — retrospective, lesson learned, project documentation. The AI Software Organisation instead acquires knowledge continuously: every activity, every deployment, every review, every operational incident and every decision is a potential contribution to organisational knowledge, not merely a candidate for a future retrospective.

## 27.7 Knowledge Candidates and Validation

Not every observation becomes knowledge. New observation first becomes a **Knowledge Candidate** — a proposed proposition together with its supporting evidence, confidence, origin, affected objective, affected capability and governance status — remaining hypothesis until organisational acceptance. Validation may involve evidence correlation, human review, AI analysis, policy verification, historical comparison or simulation; only once validation is sufficient may organisational governance accept the proposition (Part 2 Chapter 16 formalises Knowledge, and the Candidate → Accepted transition, in full).

## 27.8 Integration and Evolution

Accepted knowledge must integrate with existing organisational understanding — ontology alignment, conflict detection, terminology normalisation, relationship creation and impact analysis, with the objective being organisational coherence rather than a pile of isolated facts. Knowledge acquisition never concludes, either: business rule changes, architecture evolves, technology advances, operational behaviour changes, so acquisition continually updates organisational understanding rather than merely extending it once and leaving it fixed.

## 27.9 Knowledge Acquisition and the ORC

Knowledge acquisition occurs naturally within the Organisational Reasoning Cycle: activity creates artefact, artefact generates evidence, evidence proposes candidate knowledge, governance validates it, and accepted knowledge influences future decision. Knowledge acquisition, seen this way, is simply the name for the transition between evidence and organisational understanding within the cycle (Part 3 Chapter 19 formalises the ORC in full).

## 27.10 Human and AI Collaboration

Knowledge acquisition benefits from genuinely complementary strength. Human participants contribute domain expertise, context, judgement and strategic reasoning; AI participants contribute scale, pattern recognition, correlation, inference and continuous observation. Neither is independently sufficient — together they produce richer organisational knowledge than either could alone.

## 27.11 Three Modes of Acquisition

It is worth separating knowledge acquisition into three distinct modes, since each answers a genuinely different question and maps directly onto the three-engine architecture introduced in Part 2 Chapter 16.

**Discovery** asks *something exists* — a new dependency detected, a new business rule inferred, a new architectural relationship found — and its output is candidate evidence. **Interpretation** asks *what does this mean* — a dependency implies coupling, a business rule affects pricing, an architectural relationship violates layering — and its output is candidate knowledge. **Institutionalisation** asks *should the organisation accept this* — approve a recovered business rule, accept an architectural constraint, publish a new domain concept, update the organisational ontology — and its output is accepted organisational knowledge.

These three modes align precisely with the three engines: the **Observation Engine** performs discovery, the **Reasoning Engine** performs interpretation, and the **Governance Engine** performs institutionalisation. Together they form a complete, end-to-end acquisition model — discovery without interpretation is merely data collection, interpretation without institutionalisation is merely hypothesis, and neither, on its own, constitutes organisational knowledge.

## 27.12 Relationships

Within the organisational model, Knowledge Acquisition consumes Evidence; produces Knowledge Candidates; updates organisational Knowledge; enriches Deliverables; influences Decisions; strengthens Capabilities; and operates under Governance throughout. Knowledge acquisition is, in this sense, the organisation's learning mechanism, not merely a documentation activity running alongside engineering work.

## 27.13 Invariants

Acquisition shall identify supporting evidence. Acquisition shall preserve provenance. Acquisition shall remain traceable. Acquisition shall operate within governance. Acquisition shall improve organisational understanding. Violation of these invariants introduces unsupported organisational belief.

## 27.14 Operational Semantics

New evidence appears. The organisation proposes candidate knowledge. Candidate knowledge undergoes validation. Governance evaluates acceptance. Accepted knowledge integrates with existing organisational understanding, and future organisational reasoning benefits immediately. Knowledge acquisition operates continuously throughout organisational execution, not as a distinct phase set apart from it.

## 27.15 AI Implications

Artificial intelligence fundamentally changes the economics of knowledge acquisition. Rather than relying on periodic documentation, AI continuously analyses repository, observes deployment, extracts evidence, identifies relationship, discovers anomaly, proposes knowledge and detects inconsistency. It does not, however, determine organisational truth — it continuously expands the set of candidate knowledge awaiting organisational evaluation, leaving institutionalisation to governance as Part 2 Chapter 18 requires.

## 27.16 Organisational Intelligence

Traditional organisations become more intelligent primarily through accumulated human experience. The AI Software Organisation becomes more intelligent through accumulated organisational knowledge instead — participants contribute, knowledge persists, capability improves, and objectives become easier to achieve as a result. Intelligence, understood this way, is an organisational property, not an individual attribute belonging to whoever happens to be most experienced at a given moment.

## 27.17 Chapter Summary

Knowledge acquisition is the organisational capability responsible for transforming observation into accepted understanding. Rather than documenting engineering activity retrospectively, the AI Software Organisation acquires knowledge continuously throughout execution, through the three distinct modes of discovery, interpretation and institutionalisation. This continual acquisition enables organisational learning, improves capability maturity, and reduces dependence on any individual participant.

The next chapter extends this discussion to **Traceability**, examining how organisational understanding remains explainable across objective, capability, evidence, knowledge, decision and implementation — and, in particular, why the question traceability should really be answering is not "what is connected?" but "why does the organisation believe what it believes?"
