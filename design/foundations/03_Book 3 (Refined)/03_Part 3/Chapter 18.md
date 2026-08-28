# Chapter 18 – Ontology Model


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

## 1. Purpose

The Ontology Model defines the shared semantic vocabulary used by a Software Engineering Unit (SEU).

Its purpose is to ensure that all Participants, Deliverables, Knowledge, Evidence, Decisions and Packs operate using a common understanding of engineering concepts.

The Ontology provides the semantic foundation for the platform.

It is not merely a glossary of terms.

It defines concepts, relationships, meanings and contextual interpretations.



## 2. Scope

This chapter defines:

- Ontology abstraction
- semantic concepts
- relationships
- terminology management
- ontology composition
- ontology evolution

This chapter does not define:

- knowledge reasoning
- natural language processing
- storage implementation
- graph database technologies
 

## 3. Architectural Position

```
Platform Packs
       │
Organisation Packs
       │
Domain Packs
       │
Technology Packs
       │
       ▼
Ontology
       │
───────────────────────────
       │
Deliverables
Knowledge
Evidence
Decisions
Participants
Engineering Behavior Model
```

The Ontology provides the shared semantic model for every architectural concept.



## 4. Definition

An Ontology is a structured representation of engineering concepts and the relationships between those concepts.

The Ontology establishes the authoritative meaning of terms used within an SEU.

Every engineering artefact references concepts from the Ontology rather than relying upon free-form interpretation.



## 5. Architectural Principles

### OM-001

Every engineering concept shall possess a unique semantic identity.

### OM-002

Concepts shall be independent of terminology.

### OM-003

Multiple terms may represent the same concept.

### OM-004

Concept relationships shall be explicit.

### OM-005

Ontologies shall be composable.

### OM-006

Semantic consistency shall take precedence over linguistic consistency.

## 6. Functional Requirements

### FR-18.1

The platform shall maintain an Ontology for every commissioned SEU.

### FR-18.2

Concepts shall possess globally unique identifiers.

### FR-18.3

Every Knowledge Item shall reference one or more Ontology concepts.

### FR-18.4

Every Deliverable category shall reference Ontology concepts.

### FR-18.5

Ontology composition shall occur during EBM composition.

### FR-18.6

Ontology conflicts shall be detected during commissioning.

### FR-18.7

Ontology evolution shall preserve semantic traceability.

## 7. Ontology Components

The Ontology shall consist of:

### Concepts

Fundamental engineering ideas.

Examples:

- Requirement
- Service
- Capability
- Decision
- Deliverable



## Terms

Human-readable labels.

Examples:

- Requirement
- User Story
- Feature Specification

Different terms may reference the same concept.



## Definitions

Authoritative descriptions of concepts.

Definitions establish meaning independently of terminology.



## Relationships

Examples include:

- is-a
- part-of
- depends-on
- produces
- validates
- supersedes
- implements



## Constraints

Semantic rules governing valid relationships.



## Synonyms

Alternative names for the same concept.

Examples:

- Pull Request
- Merge Request

Both may map to the same Ontology concept.



## Aliases

Organisation-specific terminology.

Example:

One Organisation Pack may use "Design Review".

Another may use "Architecture Review".

Both can resolve to a common semantic concept.



# 8. Ontology Composition

The platform shall construct an effective Ontology by composing contributions from:

- Platform Packs;
- Organisation Packs;
- Domain Packs;
- Technology Packs;
- Compliance Packs.

Composition shall preserve semantic consistency.



# 9. Ontology Relationships

Relationships shall possess explicit meaning.

Illustrative relationships include:

- specialises;
- generalises;
- derives;
- validates;
- implements;
- fulfils;
- references;
- governs.

Relationship semantics shall be versioned.



# 10. Semantic Resolution

The platform shall resolve terminology differences between Packs.

Example:

```
TCS Pack

"Technical Design"

↓

Ontology

Solution Design Concept

↑

Client Pack

"Solution Architecture"
```

Participants therefore collaborate using concepts rather than organisation-specific vocabulary.



# 11. Ontology Evolution

Ontologies evolve independently of SEUs.

Evolution may include:

- new concepts;
- revised definitions;
- new relationships;
- deprecated concepts;
- merged concepts.

Historical semantic interpretations shall remain reproducible.



# 12. Ontology Versioning

Every Ontology shall record:

- version;
- contributing Packs;
- semantic changes;
- deprecated concepts;
- compatibility information.

Historical Ontologies shall remain available.



# 13. Ontology Governance

Ontology changes shall require governance.

Governance may include:

- semantic review;
- engineering review;
- domain review;
- Pack compatibility validation.

Ontology changes shall never invalidate historical engineering records.



# 14. Events

The Ontology subsystem shall publish:

- ConceptCreated
- ConceptUpdated
- ConceptDeprecated
- OntologyComposed
- OntologyValidated
- SemanticConflictDetected
- SemanticConflictResolved



# 15. Non-Functional Requirements

The Ontology Model shall:

- support semantic composition;
- support multiple vocabularies;
- preserve semantic traceability;
- remain independent of implementation technologies;
- support incremental evolution.



# 16. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Every concept possesses a unique semantic identity.

✓ Multiple terminologies can map to the same concept.

✓ Semantic conflicts are detected during composition.

✓ Ontology evolution preserves historical meaning.

✓ Deliverables, Knowledge and Evidence reference Ontology concepts.

✓ Organisation Packs can contribute terminology without introducing ambiguity.



# 17. Deliverables

Implementation of this chapter shall produce:

- Ontology domain model.
- Concept registry.
- Semantic resolution service.
- Ontology composition service.
- Ontology versioning service.
- Ontology APIs.
- Ontology events.

---

# 18. Implementation Specifics (2026-08-25)

Verified directly against the live codebase (migrations through `119`, `seuTypes.ts`, `ontologyDB.ts`, `core/ontology.ts`, `api/ontology.ts`, `web/ontology.ts`, `views/seu/sdk/ontology/index.ejs`, `tests/ontology-model.test.ts`, CR-020 through CR-067) and against `design/mvp-build-plan/Ontology Plan.md` — the chapter's own build plan (Phase 17, produced 2026-08-12, claiming steps 1–4 of its own §4 built) — not from memory. Format follows Ch.17 §20's own convention: number, claim, status, at the heading level, so the outline itself shows what's done. The plan doc is two weeks stale in one respect worth naming up front: it describes 8 concept types; **18 exist today** (17 live — one, `category:quality-gate`, was seeded then deleted). Its core claim otherwise holds up well: the registry, write-path enforcement, and tenant aliasing it describes are real and built, confirmed independently below — but one of its own claims needs a correction (§18.5).

## 18.1 The Concept Registry ✅ — Ontology Plan.md steps 1–2 built, grown far beyond its own 2026-08-12 snapshot (§4/§7 Concepts, Terms)

`ontology_concepts` (`030_ontology.sql:10–29`, tenant-scoped by CR-022 in `055_ontology_concepts_tenant_scoped.sql`, `description` added by `056`) is the canonical registry the chapter's §7 "Concepts" describes: `(id, concept_type, code, default_label, description, contributed_by_pack, is_active, tenant_id, created_at)`, unique on `(concept_type, code, tenant_id)`. `ontologyDB.ts` provides `findConcept`/`findConceptsByType`/`listDistinctConceptTypes`/`upsertConcept`/`retireConcept` (soft-retire only — `is_active = FALSE`, never a hard delete); `core/ontology.ts` wraps these into the write-path gate `assertCanonicalCategory` plus the admin-facing `addConcept`/`retireConcept`/`listConceptTypes`/`listConceptsForType`.

**Growth since the plan doc**: the plan named 8 concept types (`category:deliverable/evidence/decision/knowledge/obligation/policy`, `deliverable-name`, `capability-name`). **17 live concept types exist today**: those 8, plus `category:pack` (`049`), `category:obligation-origin` (`110`, CR-062), `category:event-types` (`090`), `installation-classification` (`051`), `template-categories` (`053`), `profile-categories` (`065`), `feature-flag` (`065`), `composition-strategy` (`069`), and `service-name` (`113`, CR-064, 124 codes). One more, `category:quality-gate` (`091`), was seeded then fully deleted in `093` once CR-058's own follow-up settled on reusing `category:evidence` directly instead. §7's "Definitions" is thinly but genuinely real: `description` carries real per-code "when to use this" authoring guidance (e.g. `057`'s 9 template-category texts, `069`'s per-composition-strategy definitions), closer to a usage note than the chapter's "authoritative description establishing meaning independently of terminology," but populated, not empty.

**Write-path enforcement (Ontology Plan.md step 2) is complete and broader than the plan's own 5-caller list**: `assertCanonicalCategory` is called from Deliverable (`core/deliverables.ts:58`), Evidence (`core/evidence.ts:73`), Decision (`core/decisions.ts:27`), Knowledge (`core/knowledge.ts:28`), Obligation (`core/obligations.ts:29`), Profile (`core/profiles.ts:151`), Template (`core/templates.ts:216`), and — the largest single consumer — Pack (`core/packs.ts`, 9 separate checks: the Pack's own `code` against `capability-name`, its `category`/`installationClassification`/`compositionStrategy`, and per-contribution checks for Quality Gate category, Policy category, Obligation category/origin, and Service code). An off-canonical value is rejected with a real validation error in every one of these paths; existing rows are grandfathered, matching the plan's own step-2 design.

## 18.2 OM-001–006 Architectural Principles ⚠️ — identity and terminology-independence built, relationships and composability not (§5)

- **OM-001 unique semantic identity** ✅ — `(concept_type, code, tenant_id)` uniqueness, DB-enforced.
- **OM-002 concepts independent of terminology** ✅ — the canonical `code` is what every row stores and every write-path check validates; `default_label`/`description`/a tenant's alias are all presentation, never the stored identity (Ontology Plan.md §0.1's own "canonical identity, tenant label" principle, confirmed live).
- **OM-003 multiple terms may represent the same concept** ⚠️ — true in the narrow sense a tenant can rename a concept (§18.5), false in the chapter's own broader "Synonyms" sense (§7) — see §18.5.
- **OM-004 concept relationships shall be explicit** ❌ — no relationship exists between any two `ontology_concepts` rows anywhere; the registry is a flat, unlinked list per `concept_type`.
- **OM-005 ontologies shall be composable** ❌ — no "compose an effective Ontology" function exists anywhere (confirmed by direct search); see §18.6.
- **OM-006 semantic consistency over linguistic consistency** ✅ in spirit — the canonical-code-over-label discipline is exactly this principle, and it holds everywhere checked.

## 18.3 FR-18.1–7 Functional Requirements ⚠️ — mixed, one requirement with no backing at all (§6)

| FR | Verdict | Note |
|----|---------|------|
| FR-18.1 an Ontology per commissioned SEU | ❌ | No per-SEU scoping exists at all — see §18.7's own callout below; the registry is Platform/tenant-scoped only (`tenant_id`, CR-022), never `seu_id`-scoped, and no per-commissioning snapshot is ever recorded. |
| FR-18.2 globally unique concept identifiers | ✅ | UUID PK plus the `(concept_type, code, tenant_id)` unique constraint. |
| FR-18.3 every Knowledge Item references concepts | ⚠️ | Real, but narrower than "one or more": exactly one `category` string per Knowledge Item, write-path validated (`core/knowledge.ts:28`) — a governed field, not a concept-relationship model. |
| FR-18.4 every Deliverable category references concepts | ⚠️ | Same shape as FR-18.3 — one validated `category` string (`core/deliverables.ts:58`), not a reference array. |
| FR-18.5 Ontology composition occurs during EBM composition | ❌ | No such mechanism exists; `compositionEngine.compose()` composes whole Packs, never Ontology concepts (confirmed directly against Ch.4's own CR-067 audit, which frames this exact gap). |
| FR-18.6 Ontology conflicts detected during commissioning | ❌ | No semantic/ontology conflict detection exists anywhere. `compositionEngine.ts`'s real `detectGovernanceConflicts` checks authority-role and Quality-Gate-category disagreements across composed Packs — a governance concern, not an Ontology one; it never inspects an `ontology_concepts` row. Easy to conflate with this FR; confirmed distinct. |
| FR-18.7 Ontology evolution preserves semantic traceability | ❌ | See §18.7 — no version/history mechanism exists; `is_active` hides a retired concept going forward only. |

## 18.4 Ontology Relationships & Constraints ❌ — no concept-to-concept linking exists anywhere (§7 Relationships/Constraints, §9)

The chapter names two overlapping relationship vocabularies — §7's is-a/part-of/depends-on/produces/validates/supersedes/implements, and §9's specialises/generalises/derives/validates/implements/fulfils/references/governs ("relationship semantics shall be versioned") — and a §7 "Constraints" concept (semantic rules governing valid relationships). None has any backing: no table, column, or function connects one `ontology_concepts` row to another in any way, versioned or otherwise. `dependency_definitions` (Ch.15/CR-039/CR-043) is this codebase's real relationship-graph mechanism, but it links Deliverables/Templates/Packs to each other, never Ontology concepts to each other — a different layer entirely, same distinction CR-067 draws for its own composition work.

## 18.5 Synonyms & Aliases ⚠️ — tenant renaming is real and built; general synonyms are not; the plan doc's own "wired at read time" claim is corrected here (§7 Synonyms/Aliases, §10 Semantic Resolution)

**Aliases — built, but as a narrower mechanism than the chapter's own architecture position implies.** `tenant_concept_aliases` (`030_ontology.sql`, unmodified since — `(tenant_id, concept_type, canonical_code, display_label)`, unique per triple, no `is_active`) plus `core/ontology.ts`'s `setAlias`/`clearAlias`/`listAliases`/`resolveLabels`/`resolveLabel` are exactly Ontology Plan.md's own step 3. `tests/ontology-model.test.ts` proves it directly: two tenants see different labels for the same canonical code, storage stays canonical and cross-tenant-joinable, clearing an alias reverts to the platform default, and aliasing an unknown concept is refused (tenants rename, never mint — Ontology Plan.md §1.2's own rule, held).

The chapter's own §7 example and architecture position (§3) both frame this as **Organisation Packs** contributing terminology ("One Organisation Pack may use 'Design Review'. Another may use 'Architecture Review'"). What's actually built is **tenant-scoped, not Pack-contributed**: a tenant sets its own alias directly through an API, with no Organisation Pack authoring step involved at all. The outcome the chapter wants (an organisation sees its own word) is real; the mechanism it describes (a Pack carrying the alias) is not — that's Ontology Composition's own gap (§18.6).

**Correction to Ontology Plan.md's own claim**: the plan states this is "surfaced at web views/API serializers." Traced exhaustively — `resolveLabels` has exactly one caller anywhere in the app, `api/ontology.ts`'s own `GET /tenants/:id/vocabulary` endpoint; `resolveLabel` (singular) is called from nowhere in application code at all. No web view, no other API response, anywhere in the product, ever resolves a tenant's alias — a tenant-facing client would have to call this endpoint itself. Relatedly, the tenant alias **management** surface (Ontology Plan.md's own step 4) is API-only too: `GET`/`POST /tenants/:id/aliases` exist and work, but the Ontology Management admin page (`views/seu/sdk/ontology/index.ejs`) has zero alias-related UI — a tenant admin cannot set their own alias through any screen in the product today.

**Synonyms (§7) — no backing at all**, and genuinely distinct from Aliases: a tenant may set only one `display_label` per concept (unique per `tenant_id, concept_type, canonical_code`), never several simultaneously-valid names in the same scope the way the chapter's own "Pull Request"/"Merge Request" example describes.

**A real, confirmed cross-reference**: this chapter's own "Alias" (§7, organisation-terminology-synonym) is the *reason* Chapter 4's Composition Strategy dropped its own, unrelated "Alias" value. `117_composition_strategy_specialization_rename.sql`'s own comment: *"resolves a naming collision with Ontology's own, unrelated 'Alias' concept (Ch.18 §7 organisation-specific terminology synonyms)"* — confirmed, CR-067 restates it near-verbatim, quoting this chapter's own "Design Review"/"Architecture Review" example directly. Two entirely separate "Alias" concepts existed simultaneously; the Composition Strategy one was renamed to `specialization` specifically so it stops colliding with this chapter's own vocabulary.

## 18.6 Ontology Composition ❌ — Pack-contributed concepts remain fully deferred, unchanged since the plan doc (§8)

`contributed_by_pack` (`030_ontology.sql`) is never set to a non-null value anywhere in the system today — traced to its one real write path, `ontologyDB.upsertConcept`, whose only caller (`core/ontology.ts`'s `addConcept`) never passes it. Every `ontology_concepts` row has `contributed_by_pack IS NULL`, exactly matching Ontology Plan.md's own step 5, explicitly deferred on 2026-08-12 ("recommend deferring step 5 until a Domain Pack actually needs to add a concept") and still untouched. **CR-056** ("the Pack-feeds-Ontology mechanism," 🟡 Proposed, raised 2026-08-22) scopes this gap narrowly to `category:decision` and lists five open design questions — none resolved. CR-067 (2026-08-24) references CR-056 again as still-open territory for its own, unrelated Specialization code-change-registration need. No "compose an effective Ontology from Platform/Organisation/Domain/Technology/Compliance Packs" function exists anywhere.

## 18.7 Ontology Evolution & Versioning ❌ — no version field, no history, `is_active` only hides going forward (§11/§12)

`ontology_concepts` has no `version` column and no history table anywhere in the schema. `retireConcept` does exactly one thing — `is_active = FALSE` — the row's own current content stays readable, but there is no snapshot of what it looked like before, and `upsertConcept`'s own `ON CONFLICT ... DO UPDATE` silently overwrites `default_label`/`description` on a real edit with no trace of the prior value. §12's own list — "version; contributing Packs; semantic changes; deprecated concepts; compatibility information" — has no backing beyond the bare `is_active` flag and the permanently-null `contributed_by_pack` (§18.6). §11's "historical semantic interpretations shall remain reproducible" and §12's "historical Ontologies shall remain available" both assume an "Ontology" exists as its own versioned, composable snapshot object — it doesn't; there is only the one live, mutable `ontology_concepts` table.

**FR-18.1's own gap, called out directly**: no per-SEU Ontology exists at all — no `seu_id` on `ontology_concepts`, nothing on `seus`/`seusDB.ts` referencing an Ontology instance or version. Every SEU under a tenant shares that tenant's (plus Platform's) vocabulary; nothing is composed or snapshotted per commissioning.

## 18.8 Ontology Governance ⚠️ — badge-gated CRUD exists; no review workflow (§13)

The Ontology Management admin route is gated on the `ontology_define`/`root` badge (`web/ontology.ts:55–65`) — a real authority check, not open to anyone. §13's own "semantic review; engineering review; domain review; Pack compatibility validation" workflow has no backing beyond that single gate — adding or retiring a concept is a direct, unreviewed action once the badge is held. "Ontology changes shall never invalidate historical engineering records" holds trivially today, since nothing currently *changes* a concept's identity once rows reference it (`code` is never rewritten by any code path) — but this is a property of what's absent (no rename-in-place mechanism), not a deliberately built safeguard.

## 18.9 Events ❌ — zero of the 7 named events exist (§14)

`ConceptCreated`, `ConceptUpdated`, `ConceptDeprecated`, `OntologyComposed`, `OntologyValidated`, `SemanticConflictDetected`, `SemanticConflictResolved` — checked individually, exact-name search across the whole codebase: zero matches for every single one. `ontologyDB.ts` and `core/ontology.ts` have no `eventBus` import at all, unlike sibling domains (`core/deliverables.ts` alone publishes several real named events). Adding a concept, retiring one, or setting an alias publishes nothing today.

## 18.10 Non-Functional Requirements ⚠️ — mixed (§15)

Support semantic composition ❌ (§18.6), support multiple vocabularies ✅ (17 live concept types, tenant-scoped), preserve semantic traceability ❌ (§18.7), remain independent of implementation technologies ✅ (a plain relational table, no graph-DB dependency, matching §2's own explicit exclusion of "graph database technologies"), support incremental evolution ⚠️ (new concept types/codes are added freely via migrations — real incremental growth, 8→17 concept types since the plan doc alone — but "evolution" in the chapter's own versioned/reproducible sense, §18.7, is not supported).

## 18.11 Acceptance Criteria ⚠️ — mixed, re-scored against the code (§16)

| Criterion | Verdict |
|---|---|
| Every concept possesses a unique semantic identity | ✅ |
| Multiple terminologies can map to the same concept | ⚠️ (tenant rename only — §18.5) |
| Semantic conflicts are detected during composition | ❌ (§18.3 FR-18.6) |
| Ontology evolution preserves historical meaning | ❌ (§18.7) |
| Deliverables, Knowledge and Evidence reference Ontology concepts | ⚠️ (one governed category string each, not a concept-relationship model — §18.3) |
| Organisation Packs can contribute terminology without introducing ambiguity | ⚠️ (the outcome is real via tenant aliasing; the Pack-contribution mechanism itself, §18.6, is not built) |

## 18.12 Deliverables ⚠️ — mixed, re-scored (§17)

Ontology domain model ✅ (`ontology_concepts`/`tenant_concept_aliases`, `seuTypes.ts`), Concept registry ✅ (`ontologyDB.ts`/`core/ontology.ts` plus the admin CRUD UI), Semantic resolution service ⚠️ (`resolveLabels`/`resolveLabel` and their 2 API endpoints are real and tested, but wired into zero internal consumers — an API, not yet a used service — §18.5), Ontology composition service ❌ (no such function exists — §18.6), Ontology versioning service ❌ (no version field or history anywhere — §18.7), Ontology APIs ✅ (concept CRUD + tenant alias endpoints, `api/ontology.ts`), Ontology events ❌ (zero of 7 named events ever published — §18.9).

## Summary — what's genuinely open, ranked

1. **[Design, unscoped]** Ontology composition / Pack-contributed concepts (§18.6) — the largest gap; partially raised already: **[CR-056](../../../change-requests/CR-056-decision-category-pack-contribution.md)**, but scoped narrowly to `category:decision` so far, not the general mechanism.
2. **[Design, unscoped]** Ontology relationships and constraints (§18.4) — the registry is a flat, unlinked list; nothing connects one concept to another.
3. **[Design, unscoped]** Ontology evolution and versioning (§18.7), including the FR-18.1 per-SEU Ontology gap — no version field, no history, no per-SEU snapshot; not yet tracked in any CR.
4. **[Design, unscoped]** Semantic conflict detection (§18.3 FR-18.6, §18.9) — zero mechanism, and easily mistaken for the real but unrelated governance-conflict detection in the Composition Engine (Ch.4).
5. **[Code, small-medium]** Wire `resolveLabels`/`resolveLabel` into at least one real internal consumer, and build the tenant-alias-management UI (Ontology Plan.md's own step 4 — the API exists, the screen never got built) (§18.5).
6. **[Code, small, well-precedented]** Full named event set (§18.9) — the same `EVENT_BY_TARGET_STATE`-map pattern already used elsewhere in this codebase, just not applied to Ontology yet.
7. **[Test gap]** The Ontology Management CRUD layer (`addConcept`/`retireConcept`/the whole admin web route) has zero automated test coverage today — only manually reachable; `tests/ontology-model.test.ts`'s own 4 tests cover write-path enforcement and tenant aliasing only.

**Also raised, exploratory, separate from the above**: a stray untracked debug script, `check-ontology-vocab-tmp.mjs`, sits at the repo root (dumps `capability-name`/`template-categories` codes) — a one-off aid, not part of the build, not tracked by git.