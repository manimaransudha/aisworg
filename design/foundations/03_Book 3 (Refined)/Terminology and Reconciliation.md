# Terminology and Reconciliation

*Editorial note (Refined edition). This is a new document, not present in the original Book 3. It exists because Book 3 is meant to be implementable, and an implementation team cannot build a consistent schema from two books that use different words for related concepts without someone deciding, explicitly, how those words map onto each other. Where a decision was needed, it is stated as a decision, not left as an open question, so that implementation work is not blocked on it. Where something is genuinely still open, it is marked as such.*

---

## 1. Engineering Practice Model (EPM) → Engineering Behavior Model (EBM)

**Status: Resolved.**

Book 3's own design log (`Outline.md`) records the decision to rename EPM to EBM. That rename was not fully carried through the original chapters — Chapter 2 and the Architecture Catalogue still said EPM in several places. In this refined edition, all normative text uses **Engineering Behavior Model (EBM)** consistently. `Outline.md` is left untouched, since it is the historical record of the rename decision itself, not a normative chapter.

If you find "EPM" or "Engineering Practice Model" anywhere else in this refined edition, treat it as a bug and report it — it should not exist.

---

## 2. Role (Book 1) vs Participant Type vs Capability (Book 3)

**Status: Resolved, with one open gap flagged below.**

Book 1 treats **Role** as one of the eleven canonical SEU Structure entities: a stable position within the organisation that carries responsibilities, independent of who or what currently occupies it.

Book 3 never defines Role as a formal chapter-level concept, even though Chapter 2's SEU composition diagram (§7) lists "Roles" as a runtime component of an SEU. That's a dangling reference — nothing in Book 3 formally specifies what a Role is, how it's structured, or how it relates to Capability and Participant.

The reconciliation:

| Book 1 concept | Book 3 concept | Relationship |
|---|---|---|
| **Role** | **Participant Type** (Ch. 12, Ch. 13) | A Book 1 Role and a Book 3 Participant Type are the same idea under different names: a stable, reusable definition of a kind of engineering contributor ("AI Architect", "Senior Developer"), independent of any specific occupant. |
| — | **Capability** (Ch. 10) | Capability is *not* Role. Capability answers "what competency is needed"; Role/Participant Type answers "what kind of contributor typically holds that competency." A single Role/Participant Type usually maps to multiple Capabilities, and a single Capability can be fulfilled by more than one Role/Participant Type. |
| **Participant** (Book 1, a characteristic-bearing entity) | **Participant Instance** (Ch. 12) | The actual runtime occupant — "Priya assigned to SEU-042" — with identity, lifecycle and execution history. |

**Implementation guidance:** when you build the Participant Type schema (Ch. 13), treat it as the formal home of Book 1's Role entity. Don't build a separate "Role" table — it would duplicate Participant Type with no behavioural difference.

**Open gap:** Book 1's Role entity carries organisational *responsibilities and accountabilities* that are broader than what Chapter 13's Participant Type currently specifies (which is oriented around capability-matching and dispatch eligibility, not accountability). If accountability modelling becomes a requirement, Chapter 13 will need an explicit "Responsibilities" attribute on Participant Type, not a new entity.

---

## 3. Artefact (Book 1) vs Deliverable (Book 3)

**Status: Resolved.**

Book 1's **Artefact** is a broad entity: any tangible or intangible output of engineering work. Book 3's **Deliverable** (Ch. 2, and the primary object of the entire execution model) is narrower and more operational: a Deliverable is a dependency-graph node with an explicit lifecycle, acceptance criteria, and producing capabilities.

The reconciliation: **every Deliverable is a Book 1 Artefact, but not every Artefact needs to become a Deliverable.** A Deliverable is the subset of Artefacts that the platform tracks as a first-class execution and dependency object. Working notes, scratch analysis, or intermediate content a Participant produces on the way to a Deliverable are still Artefacts in the Book 1 sense, but they don't need Deliverable-grade lifecycle machinery (dependency graph membership, acceptance criteria, governance gates) unless the organisation chooses to promote them.

**Implementation guidance:** when mapping Book 1's data model onto Book 3's schema, `Deliverable` is the implementation of `Artefact`, not a sibling concept. Don't build two parallel tables. If a future need arises to track non-Deliverable Artefacts (e.g., working notes worth preserving but not worth governing), extend the Knowledge Model (Ch. 16) rather than inventing a second Artefact table — Book 3 already treats persisted, reusable content as Knowledge.

---

## 4. "Service" — two unrelated meanings

**Status: Resolved by convention, not by renaming.**

Book 1's **Service** is one of the eleven canonical entities: the formal unit of value exchange an organisation offers. Book 3 separately uses the lowercase word "service" constantly, and unrelatedly, to mean a runtime software component (Runtime Service, Dispatch Service, Capability Fulfilment service, Telemetry service, and so on).

These are not the same concept and were never intended to be. The collision is only lexical. Book 3's execution-layer "services" are implementation infrastructure; Book 1's Service is a business-facing organisational entity that would, if modelled in Book 3 at all, sit in the Engineering Layer as something closer to a named Capability grouping or an EBM-level concept — Book 3 doesn't currently model it explicitly, because Book 3 operates at the execution layer, one level below where Book 1's Service entity lives.

**Convention going forward:** capitalise **Service** only when referring to Book 1's formal entity. Every other use ("Runtime Service", "Dispatch Engine service", etc.) refers to a software component and should stay lowercase in body text. This is a documentation convention, not a renaming exercise — renaming Book 3's forty-plus uses of "service" would cost far more than the ambiguity it resolves, since context always disambiguates in practice.

**Open item, not blocking:** if a future chapter needs to represent Book 1's Service entity explicitly (e.g., for external-facing capability marketing or billing), it belongs in the Engineering Layer, most likely as an attribute of Capability or a thin new model referencing Capability groupings — not as a Runtime Kernel concept.

---

## 5. Information → Knowledge → Wisdom vs. the Trust Pipeline

**Status: Partially resolved — Wisdom is explicitly non-normative.**

Chapter 16 (Knowledge Model) introduces an Information → Knowledge → Wisdom maturity chain. Chapter 17 (Evidence Model) separately introduces the **Trust Pipeline**: Information → Evidence → Knowledge → Decision → Deliverable State Transition. Both chains start at "Information" and diverge from there, and "Wisdom" never reappears anywhere else in the other 45 chapters — no Wisdom object, no Wisdom lifecycle, no Wisdom event.

The reconciliation: these describe two different things and were never meant to be the same chain.

- The **Trust Pipeline** (Ch. 17) is the *governance* chain: it's how raw Information becomes strong enough, through Evidence, to justify a Knowledge claim, which in turn justifies a Decision, which in turn justifies a governed state transition. This chain is fully specified and is load-bearing throughout the Governance chapters (21–27).
- **Information → Knowledge → Wisdom** (Ch. 16) is an *epistemic maturity* framing, borrowed from classic knowledge-management theory (DIKW). It describes how well-understood a piece of content is, independent of whether it's ever used to justify a Decision.

**Implementation guidance:** implement the Trust Pipeline as specified — it's the one with functional requirements, events, and acceptance criteria attached to it. Treat "Wisdom" as **aspirational and non-normative**: do not build a Wisdom state, table, or API. If the Knowledge Model needs a maturity attribute, use the two stages that are actually operationalized elsewhere in the book — Information and Knowledge — and drop Wisdom from any implementation-facing schema. If a future edition of Book 3 wants to operationalize Wisdom (e.g., as a cross-SEU synthesis capability), that's new work, not a gap-fill of existing chapters.

---

## 6. Engineering Capital (Book 1) — a precise query over Knowledge, not a new Book 3 object

**Status: Resolved — concretely defined 2026-08-03 via Acquisition Scope.**

Book 1 (Chapters 1 and 6) frames **engineering capital** as the organisation's accumulated, persistent capability portfolio — the economic argument for why Capability Independence matters. Book 3 initially never used the term, and an earlier version of this entry treated it as a pure non-mapping ("realized implicitly, no schema needed"). That was too loose to implement against, so it has been sharpened.

Every Deliverable (Ch. 15 §9) now declares an **Acquisition Scope** — SEU, Capability, Enterprise or Platform — determining how far the Knowledge, Evidence and Decisions it produces are entitled to propagate. SEU-scoped Knowledge stays local to the SEU that produced it. Capability-scoped Knowledge is reusable by any SEU within the same Tenant that fulfils the same Capability. Enterprise-scoped Knowledge is reusable Tenant-wide regardless of Capability. Platform-scoped Knowledge is a codification candidate for a Platform Pack, reusable across every Tenant once codified — never an automatic cross-Tenant exposure, which would violate Multi-Tenancy's isolation principles (Ch. 42).

**Engineering Capital is precisely the aggregate of Knowledge Items whose Acquisition Scope is Capability, Enterprise or Platform** — every Knowledge Item that outlives the SEU that produced it (Ch. 16 §13). It still needs no table of its own: it's a filter over the Knowledge Model, groupable by contributing Capability and by Tenant. What changed is that "engineering capital" now has an exact, implementable boundary instead of an impressionistic one — see **ADR – Engineering Capital via Acquisition Scope** (Architecture Catalogue) for the full decision, and **ADR – Telemetry-Driven Organisational Learning** for how Capital promotion can trigger an actual Pack revision (Ch. 23 §7) rather than sitting as an inert query result.

---

## Summary table

| # | Book 1 term | Book 3 term(s) | Resolution |
|---|---|---|---|
| 1 | — | EPM / EBM | Renamed to EBM everywhere in this edition. |
| 2 | Role | Participant Type | Same concept; Participant Type is the implementation. Accountability attributes may need adding later. |
| 3 | Artefact | Deliverable | Deliverable is the governed subset of Artefact that the platform tracks as an execution/dependency object. |
| 4 | Service (formal entity) | "service" (runtime component) | Lexical collision only. Capitalise for the Book 1 entity; Book 3's execution-layer usage is unrelated and stays as-is. |
| 5 | — | Information→Knowledge→Wisdom vs. Trust Pipeline | Two different chains for two different purposes. Trust Pipeline is normative; Wisdom is non-normative/aspirational. |
| 6 | Engineering Capital | Knowledge filtered by Acquisition Scope (Capability/Enterprise/Platform) | Not a distinct object — a precise, implementable query over Knowledge (Ch. 16 §13), driven by Deliverable's Acquisition Scope field (Ch. 15 §9). |
