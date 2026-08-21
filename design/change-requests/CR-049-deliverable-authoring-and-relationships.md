# CR-049 — Deliverable authoring: tenant specialisation from Ontology-defined Platform "code," and the Derivation/Implementation/Decomposition relationship types

**Raised:** 2026-08-21 · **Origin:** owner, working through Chapter 15's own gaps (§7 Deliverable Categories, §12 Deliverable Relationships, §15/§18/§21.9 Versioning) — "Deliverables should have their own authoring similar to template." Design only — **not to be coded until the design below is worked through and confirmed.** · **Status:** 🟡 Proposed (design in progress, not scheduled)

## The core idea

Deliverable becomes a first-class authorable entity, the way Template/Pack/Profile already are — not just a name picked off the `deliverable-name` Ontology list and embedded verbatim in a Template's `deliverableCatalogue`.

**The Platform's `deliverable-name` Ontology concept is the canonical "code."** Today (confirmed, see the immediately preceding investigation in this conversation) a tenant adding their own `deliverable-name` concept is a plain, unrelated CRUD row — same code, different tenant, two independent rows that happen to share a string, no relationship between them at all. That's wrong for this purpose. **Tenants inherit from the Platform's own `deliverable-name` concept**, the same shape Template Inheritance (CR-026) already established: a real, tracked lineage, not an independent row that coincidentally shares a name.

Owner's own example: *"a tenant's 'Claims Adjudication Rules Document' inherits from the platform-standard 'Business Rules' or 'Requirements Specification' entry — genuinely new, but always reportable and comparable as 'a specialisation of X' rather than an orphan concept nobody else can reason about."*

**Versioning happens at the tenant-inheritance point** — mirroring Template/Profile's own tenant-scoped versioning (CR-024/026): the Platform's root `deliverable-name` concept doesn't itself need a version chain; a tenant's own derived/specialised Deliverable definition does, starting fresh from the moment of inheritance.

**In scope: a `Description` field on the Definition.** Chapter 15 §21.1 flags this as declared but missing anywhere in the codebase ("no column, no field"). Definition-side, not Instance — the same role Template's own `purpose` field plays: what this kind of Deliverable is for, authored once on the Definition, not re-typed per SEU instance.

**The Definition IS `ontology_concepts`, extended — not a new table (resolves open question #1, 2026-08-21).** A tenant's specialised Deliverable is still just a `deliverable-name` row, same as today, in the same tenant-scoped Ontology layer — the only change is that `ontology_concepts` itself gains a lineage column (which Platform concept this derives from) and a version. **This means Template's `deliverableCatalogue` widget (CR-038) doesn't change at all** — it already resolves `x-referential: "deliverable-name"` against "Platform + this viewer's own tenant," the same visibility rule that already surfaces a tenant's own specialised rows today. The only thing that changes is what's now *reachable* through that same picker (a real derivation, not an orphan row) and what's recorded on the row itself (lineage, version) — not the mechanism that reads it. Consequently: the 11 already-seeded Templates' `deliverableCatalogue` entries need **no migration** — they keep referencing Platform's root concepts exactly as they do today; testing this CR means testing new inheritance/derivation cases, not touching existing seed data.

**Authority — no new noun needed, one known data addition when built.** `Deliverable` already exists as a governed noun (`authorityVocabulary.json`'s `nouns` list, confirmed live) — its instance-transition badges (`deliverable_approve`, etc.) already use it. `authoringMappings` (which grants a noun `define`/`publish` verbs specifically for *authoring*, distinct from instance transitions) doesn't have `Deliverable` yet — the same one-line addition Ontology itself got when CR-020 made it authorable (`{"noun": "Ontology", "verbs": ["define"]}`). Not a design question, just a known step.

## Definition vs. instance — the scope boundary, unlike Template

Owner's own clarification: Deliverable has two distinct aspects, where Template effectively has one from this CR's own vantage point.

- **Definition** — the authored thing (Platform's `deliverable-name` concept as the root "code," a tenant's own specialised derivation of it, versioned at the point of inheritance). **This is the entirety of what CR-049 is about.** It goes through an authoring lifecycle — Draft → Validated → Published → Active — the same shape Template/Pack/Profile already have.
- **Instance** — a specific SEU's own `deliverables` row, created when the SEU is commissioned from a Template whose catalogue references a Definition. This already exists, fully built, and is **completely out of scope for this CR**: the `deliverables` table, its own lifecycle (`Defined → In Progress → Approved → Baselined`), `DeliverableTransitioned` events, and everything Chapter 9's Dependency Engine gates and reacts to (`dependencyDefinitionEngine`, `DeliverableReady`/`DeliverableBlocked`). This is the execution/event cycle, and CR-049 never touches it.

Concretely: CR-049 is entirely upstream of commissioning. It changes what a Template's `deliverableCatalogue` entry (or a Pack/Profile-owned dependency row, per CR-047) is allowed to *point at* — today a bare Ontology string with no lineage; after CR-049, a versioned, tenant-inheritable Definition entity. Once an SEU is commissioned, the existing instance/event machinery takes over exactly as it does today, unchanged — CR-049 doesn't alter what a `deliverables` row is, how it transitions, or what it publishes.

## Chapter 15 §12's seven relationship types — classified, not all in scope here

§12: *"Deliverables may relate to one another through: dependency; derivation; refinement; validation; implementation; supersession; decomposition."* Owner's own classification, working through each:

### Derivation, Implementation, Decomposition — in scope, Template-owned, edge-shaped, CR-047 unaffected

*"These are relationships between deliverable nodes (Architecture decomposing into Data Architecture + Integration Architecture; Architecture 'implemented as' Source Code) — structurally identical to a dependency edge, just a different edge label. Which deliverables derive from, decompose into, or get implemented as which others is part of 'what kind of SEU is this' — it varies by Template (a Legacy Modernisation Template might decompose Architecture differently than Enterprise Web Application does). That means Template Inheritance handles variants of it, the same as we established for dependency ordering — not Profile."*

**Two different "Derivation" senses, disambiguated (2026-08-21):**
1. **Core-idea sense** (see above) — a tenant's own `deliverable-name` Ontology concept inheriting from Platform's. Not a Template-graph edge at all; unrelated to `dependency_definitions` either way.
2. **§12-relationship-type sense** — one Template catalogue entry related to a *different* catalogue entry within the same graph, the same shape as Implementation/Decomposition.

**Locked vs. editable on Template inheritance — the real distinction between these three (owner, 2026-08-21):**
- **Implementation and Decomposition are locked.** When a tenant derives their own Template from a parent, these edges carry over unchanged — the inheriting Template cannot alter them. This is a new instance of a rule Template Inheritance already enforces (CR-026: a derived Template is rejected at publish if it drops one of its parent's mandatory Packs) — not a new kind of rule, just applied to a new field.
- **Derivation (§12 sense) is editable.** A tenant deriving their own Template *can* change these edges. Unlike the above, this would be a genuinely new pattern for Template Inheritance — everything inherited today is "must preserve the parent's own set"; this is the first "the inheriting tenant may freely override" case.

**CR-047 doesn't change, for any of the three** — confirmed by walking through its own scope, not asserted: `to_name` nullable (irrelevant — TO side is always a named Deliverable), `toEntityType`/`toState` becoming authored (irrelevant — both sides stay `"Deliverable"`, the existing hardcoded `toState = "In Progress"` default is already correct), `fromType`/`toType` widened to the full noun vocabulary (irrelevant — never needs anything but Deliverable), `dependencyGraph` added to Pack/Profile schemas (irrelevant — these three are Template-owned only, editability doesn't change that), push-evaluation wiring for Decision/Obligation/Evidence/Knowledge (irrelevant, different entity types). The only shared surface is the underlying table/widget CR-047 also happens to be modifying — a scheduling courtesy (don't redesign the same widget twice in close succession), not a design dependency. CR-049's work here can proceed independently of CR-047's own timeline.

Whether these three reuse `dependency_definitions` (a `relationship_kind` column alongside the existing `(entity_type, name?, state)` shape) or become a separate, simpler structure is still open — see "gating vs. informational," next.

**Still open: gating vs. informational.** `dependency_definitions` today is built entirely around *gating* — a row exists to block a transition until satisfied. The core-idea's own framing of deliverable-name derivation — "always reportable and comparable as 'a specialisation of X'" — sounds informational, not gating. Whether the §12-sense Implementation/Decomposition/Derivation edges are *also* purely informational (a structural fact for traceability/reporting) or genuinely gating (like plain `dependency` — "Source Code can't start until Architecture, which it's implemented from, is Approved") isn't decided yet. If informational, they don't need `dependency_definitions`'s `(from_state, to_state, satisfaction)` shape at all — a much simpler table would do.

### Refinement, Validation — open, deferred; no new mechanism needed

*"Neither Template nor Profile. Runtime, governed by the EBM. §14 states it directly: 'Acceptance criteria are governed by the Engineering Behavior Model.' These aren't authored as a field anywhere — they're events that happen during execution, evaluated by whichever Quality/Review Gates the composed Packs contributed (exactly the §19 checklist machinery we built). Profile only touches this indirectly, by choosing which Packs get composed — it doesn't 'customise validation' as a direct setting."*

Not a build item for this CR. Already covered conceptually by the existing Quality Gate / Review mechanism (`qualityGateEngine.ts`, Ch.26). Recorded here so Chapter 15's own review can point at this reasoning instead of leaving Refinement/Validation looking like an unexplained gap.

### Supersession — genuinely undecided

Owner: *"not sure yet. open."* No direction yet — revisit once the above is further along. Owner: may end up dropped from this CR's scope entirely rather than resolved — kept open, not presumed to land either way.

## What this CR is not (yet)

- Not scheduled, not designed in enough detail to build. This file exists to hold the scope of the conversation, not to specify an implementation.
- Not a decision that `dependency_definitions` itself gains a new column — confirmed independent of CR-047's own design (see "CR-047 doesn't change" above), but still genuinely undecided against the "gating vs. informational" question, which could point toward a wholly separate, simpler structure instead.
- Not touching Refinement/Validation (see above — deferred, no mechanism proposed) or Supersession (undecided).
- Not addressing Chapter 15 §21.1 (Acceptance Criteria — the dead column), §21.7 (Ownership), or §21.8 (Acceptance via Quality Gates) — unrelated to this CR's own scope.
- **Not touching the `deliverables` table, `dependencyDefinitionEngine`, or any SEU-instance/event mechanism at all** — see "Definition vs. instance" above. Nothing about how a commissioned SEU's own Deliverable behaves, transitions, or publishes events changes because of this CR.

## Resolved

1. ~~Does a tenant's inherited/specialised Deliverable definition live as its own row in a new table, or as a specially-flagged `deliverable-name` Ontology concept with an added lineage column?~~ **Resolved 2026-08-21: the latter.** `ontology_concepts` itself gains lineage + version columns; no new table, no change to CR-038's own picker. See "The Definition IS `ontology_concepts`, extended" above.
2. ~~Does the Instance need to record which Definition/version it was created from?~~ **Resolved: no.** Definition and Instance are fully distinct (see "Definition vs. instance" above) — an Instance's own traceability runs through SEU → Profile → Template → the Template's own `deliverableCatalogue` entry as authored at commissioning time; nothing about that changes, and nothing new needs recording on `deliverables` itself.
3. ~~Does Deliverable authoring need its own noun/badge infrastructure?~~ **Resolved: no new noun** — `Deliverable` already exists in `authorityVocabulary.json`'s `nouns` list. One known, trivial data addition when built: add it to `authoringMappings` with `["define", "publish"]`, the same pattern Ontology got under CR-020.
4. ~~Do the 11 already-seeded Templates need any migration?~~ **Resolved: no** — their `deliverableCatalogue` entries keep referencing Platform's root concepts unchanged; this CR is tested via new derivation cases, not seed changes.

5. ~~"Inherit... or use it as is" — operational meaning?~~ **Resolved 2026-08-21, by direct precedent: "use as is" = no inheritance action taken at all.** Same as Template Inheritance already works (CR-026) — a Template just references Platform's `deliverable-name` concept directly, no tenant row created, no lineage recorded. Nothing new to design; the same picker, same visibility rule (Platform + own tenant), already does this today.
6. ~~How do Derivation/Implementation/Decomposition edges interact with the existing `dependency` edges — same table, or a parallel structure?~~ **Resolved: same table.** "Structurally identical to a dependency edge, just a different edge label" (owner, repeated) means these are genuinely gating-shaped, not informational — they reuse `dependency_definitions`'s existing `(from_state, to_state, satisfaction)` machinery with an added `relationship_kind` column, not a separate structure.
7. ~~Versioning identity model?~~ **Resolved: same as Template's `(code, version, tenant)`** (CR-024/026) — already stated in "The core idea" above; not a separate open question.
8. ~~How is locked-vs-editable actually enforced?~~ **Not an open design question — this is the build task itself.** Same shape as CR-026's own mandatory-Pack-preservation check for the locked pair (Implementation/Decomposition — reject publish if altered); new comparison logic for Derivation's "may override" case, since nothing inherited today is allowed to diverge from its parent. Both are implementation work under this CR's own scope, not something to resolve before starting.
9. **Lifecycle independence** — owner, 2026-08-21: no change to anything already instantiated if Platform later retires/supersedes a root concept; a tenant's already-derived Definition keeps working unaffected. But **at SEU-commissioning time, whatever Definition is being referenced must be checked as Active at that instant** — not this CR's own job (Definition authoring, not commissioning). Filed as **CR-050**, placeholder only, to revisit when SEU commissioning itself is reviewed.

## No longer treated as open (resolved by direct precedent, 2026-08-21)

- **Definition-authoring lifecycle** — not a new mechanism. Deliverable Definition becomes a 4th `SchemaDefinitionEntityKind` (alongside Pack/Template/Profile), using the same generic `schema_definitions`/`transition_definitions`/`createAuthoringDraft`/`publishAuthoringDraft` pipeline already proven three times — new `transition_definitions` rows for the `Deliverable` noun's Draft→Validated→Published→Active states, same shape as every other authored entity. A known, mechanical step, not an unsolved problem.
- **Noun** — confirmed no new noun; `Deliverable` is reused as-is.
