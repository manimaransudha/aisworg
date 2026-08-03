# Knowledge

## 16.1 Intent

Every engineering organisation acts on what it believes to be true — architectures are designed because certain assumptions are accepted, requirements are implemented because business rules are believed correct, testing strategy exists because quality assumption has been established. These accepted organisational beliefs collectively constitute organisational **Knowledge**.

Knowledge, within the ontology, is neither accumulated information nor the output of an artificial intelligence model. Participants may hold opinion; artificial intelligence may produce hypothesis; evidence may support multiple interpretations. Knowledge begins only when the organisation accepts a proposition as sufficiently justified for operational use — it is an organisational commitment, not a body of information, and this distinction is central to the theory developed throughout this work.

## 16.2 Definition

**Knowledge** is an organisationally accepted proposition whose validity is supported by sufficient evidence and whose use is authorised through organisational governance. Knowledge differs fundamentally from information: information may be incomplete, inconsistent or even incorrect, while knowledge represents information the organisation has chosen to rely on. Knowledge is therefore an organisational commitment, not merely a collection of fact.

## 16.3 Why Knowledge Exists

Software engineering depends on assumption — that the payment service authenticates customers, that customer identifiers are unique, that an interface is stable, that two components may communicate, that a regulation applies. If these assumptions remain undocumented, the organisation becomes dependent on participant memory; if they remain unsupported, the organisation cannot justify its decisions. Knowledge solves both problems by capturing organisational understanding together with the evidence that supports it.

## 16.4 Characteristics

Knowledge is **accepted**: it has passed beyond hypothesis into organisational acceptance. It is **evidence-based**: every knowledge item is supported by identifiable evidence, and knowledge without evidence is organisational opinion. It is **governed**: acceptance occurs within organisational governance, though different organisations may require different approval mechanism — the ontology specifies only that governance must exist. It is **traceable**: every knowledge item should answer why the organisation believes it, where the supporting evidence originated, and which objectives depend on it. And it is **evolvable**: acceptance today does not guarantee acceptance tomorrow — as evidence changes, knowledge may be refined, superseded or withdrawn.

## 16.5 Knowledge versus Information, Knowledge versus Evidence

Information becomes knowledge only after organisational evaluation. "CustomerService invokes PaymentGateway" is, at first, information extracted from source code; once evidence confirms the dependency and the organisation evaluates its architectural intent, knowledge may be established — "the Customer capability depends on the Payment capability." The second statement carries organisational meaning; the first does not. Information describes; knowledge interprets.

Evidence supports knowledge; it does not determine it. Evidence may show that a database table contains encrypted passwords — that is evidence. Knowledge may then conclude that the authentication subsystem satisfies the organisation's password storage policy — but only after governance authorises that conclusion. Evidence observes; knowledge reasons; governance authorises (Chapter 18 formalises Governance in full).

## 16.6 Knowledge Categories

Knowledge naturally takes several forms: **domain knowledge** (business terminology, business rule, domain concept, stakeholder intent); **architectural knowledge** (component relationship, technology decision, integration constraint, design principle); **implementation knowledge** (coding standard, framework usage, implementation pattern, dependency structure); **operational knowledge** (deployment practice, performance characteristic, incident history, operational procedure); **governance knowledge** (policy, standard, compliance obligation, decision authority); and **organisational knowledge** proper (objective, capability, role, service, process, lesson learned, engineering practice). These categories classify rather than restrict.

## 16.7 Knowledge Lifecycle

Knowledge progresses through identifiable states: **candidate**, a proposition suggested with possible supporting evidence but no acceptance yet; **under review**, while evidence is evaluated and governance assesses organisational implication; **accepted**, once the proposition becomes organisational knowledge that participants may rely on; **operational**, while it actively influences decision, policy, activity and service; **challenged**, once new evidence contradicts it and re-evaluation becomes necessary; **superseded**, once improved understanding replaces it, historical traceability remaining; and **withdrawn**, once the organisation no longer accepts the proposition, again preserving the historical reasoning rather than erasing it.

## 16.8 Organisational Knowledge versus Participant Knowledge

Participants possess experience, intuition and expertise, all of which remain valuable — but organisational knowledge must exist independently of them, because otherwise participant replacement destroys organisational capability. The objective of the AI Software Organisation is therefore not merely intelligent participants; it is an intelligent *organisation*, a distinction that fundamentally changes the purpose of knowledge management: from capturing what individuals know to establishing what the organisation itself has accepted.

## 16.9 Knowledge Validation and Quality

Knowledge should never be accepted merely because an AI participant proposes it. Acceptance requires evidence, governance, review, traceability and organisational approval — artificial intelligence may accelerate discovery, it does not replace organisational judgement. Knowledge quality in turn depends on completeness, consistency, currency, traceability, explainability, evidence quality and governance quality; organisations should continuously evaluate these characteristics, making knowledge quality an organisational capability rather than an individual responsibility.

## 16.10 Relationships

Within the ontology, Knowledge is supported by one or more Evidence items; influences organisational Decisions; guides organisational Activities; constrains organisational Services; contributes toward organisational Capabilities; is governed by organisational Roles; may justify organisational policy; and supports one or more Objectives. Knowledge is the semantic centre of the organisation.

## 16.11 Invariants

Knowledge shall possess supporting evidence. Knowledge shall identify its provenance. Knowledge shall participate in governance. Knowledge shall remain traceable. Knowledge shall remain subject to organisational review. Violation of these invariants reduces knowledge to unsupported assertion.

## 16.12 Operational Semantics

Activities produce artefact; artefact generates evidence; evidence supports candidate knowledge; governance evaluates candidate knowledge; accepted knowledge influences future activity. The organisation learns through this continuous reasoning cycle rather than through static documentation — knowledge is not fixed, it evolves as organisational understanding matures.

## 16.13 Knowledge as Organisational Capital and the Knowledge Feedback Loop

Traditional organisations often treat knowledge as documentation. The ontology treats it as organisational capital: like financial capital, it accumulates, it compounds, it increases organisational capability, it reduces future engineering effort, and it enables organisational continuity. The objective of software engineering therefore extends beyond producing software to continuously increasing organisational knowledge capital (Part 1 Chapter 6 §6.3 develops the closely related idea of capability as organisational capital, of which knowledge is one component).

Knowledge, once established, feeds back into future organisational behaviour: improved knowledge leads to improved service, improved decision, improved governance, improved capability, improved evidence generation and improved organisational learning in turn. Knowledge therefore does not terminate organisational reasoning — it reinforces it, making the organisation self-improving through the accumulation of knowledge over time.

## 16.14 AI Implications

Artificial intelligence changes knowledge *acquisition*; it does not change the *definition* of knowledge. AI participants may discover candidate knowledge, correlate evidence, identify inconsistency, propose architectural relationship, recover legacy business rule or infer undocumented dependency — none of which automatically becomes organisational knowledge. AI becomes a knowledge discovery participant; the organisation remains the authority that establishes knowledge, a distinction that protects organisational integrity while fully exploiting AI capability.

One way to organise this discovery process, developed further in Book 3, is as three cooperating engines addressing three distinct questions. An **Observation Engine** observes organisational reality — legacy code, runtime telemetry, repository, issue tracker, architecture model, document and test result — answering *what exists?* and producing artefact, event and evidence. A **Reasoning Engine** transforms evidence into candidate organisational understanding — inferred relationship, hypothesis, impact analysis, confidence score — answering *what might be true?*, without itself establishing knowledge. And a **Governance Engine** determines organisational truth — accepted knowledge, decision, policy, standard, traceability, organisational commitment — answering *what will the organisation accept as true and act upon?* This separation cleanly explains the difference between recovering knowledge from a legacy system, where the Observation Engine reconstructs evidence from existing artefact for the Reasoning Engine to interpret and the Governance Engine to validate, and creating knowledge natively, where every activity feeds the Observation Engine in real time while the Reasoning and Governance Engines continuously maintain the organisation's understanding.

## 16.15 Chapter Summary

Knowledge represents organisationally accepted understanding, supported by evidence and authorised through governance. Unlike information, it carries organisational commitment; unlike evidence, it carries organisational meaning; unlike participant expertise, it belongs to the organisation itself. This transforms knowledge from passive documentation into the central strategic asset of the AI Software Organisation. The next chapter formally specifies **Decision**, explaining how organisational knowledge influences behaviour and how engineering choice becomes an explicit, traceable organisational commitment.
