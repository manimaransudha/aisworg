# Ontology Model (Alias Vocabulary) — Plan (Phase 17)

*Produced 2026-08-12. This is the build plan for §3.3 of `Spec Gap Analysis and Remaining Build Plan.md` — the Ontology Model (Book 3 Ch.18). It mirrors `Participant Integration Plan.md`. Chapter references are to `03_Book 3 (Refined)`.*

## ✅ Built 2026-08-12

Steps 1–4 of §4 are built and verified (migration `030`); step 5 (Pack-contributed concepts) is deferred per §5. `ontology_concepts` is the canonical registry (code = the existing category string, so existing rows are grandfathered), seeded for every category vocabulary + deliverable-name + capability-name. `assertCanonicalCategory` enforces the write path in `createDeliverable/Evidence/Decision/Knowledge/Obligation`. `tenant_concept_aliases` + `resolveLabels` give the per-tenant rename resolved at read time; storage stays canonical (cross-tenant data still joins). Surfaced at `/api/seu/ontology/concepts`, `/tenants/:id/aliases`, `/tenants/:id/vocabulary`. Covered by `tests/ontology-model.test.ts` (142/142 suite green) and the dry-run suite (71/71). Core-invariance held: no core module branches on a tenant label. The §5 open decisions were resolved per their recommendations (governance states stay canonical; Pack contribution deferred; alias layers over the Template name; collision labels allowed).

## 0. The decision this settles

Ch.18 specifies a **shared concept vocabulary** so that independently authored Packs do not contribute conflicting terminology. Today every `category` field across Deliverable, Evidence, Knowledge, Decision, Obligation, and Policy is free text (`TEXT`, no `CHECK`), so nothing keeps those terms consistent or comparable.

**Decision: a platform/Pack-owned canonical vocabulary, with tenants able to rename but not extend it.** The platform, through Packs, owns the canonical set of concepts. A tenant may relabel any canonical concept to match its own methodology, but cannot create new ones. For example, the platform concept `requirements-specification` is shown to Tenant A as "RQSPEC105". This is the **"Alias"** composition strategy the Architecture Catalogue already lists, applied at the tenant scope.

Why rename-only rather than tenant-configurable lists: it gives methodology fit with **no collision risk** (tenants never introduce new terms), and it keeps platform and tenant data **comparable** (everything is stored against one shared canonical identity, so cross-tenant Engineering Capital and Platform-scope Knowledge still join). There is already a precedent in the schema: `packs.category` is an enumerated `CHECK` list (the Pack taxonomy), not free text. This plan extends that discipline to the other category fields, and adds the tenant relabelling layer on top.

## 0.1 Governing principle: canonical identity, tenant label

**Identity is canonical and platform-owned; the label is a per-tenant presentation concern resolved at the edge.** Every row stores a canonical code (`requirements-specification`). The tenant's word ("RQSPEC105") is a lookup applied on the way out. This is the same stable-core / replaceable-edge discipline the Participant Integration work established (§0.1 there): the core reads and writes canonical codes only, and knows nothing about any tenant's labels. If keeping the vocabulary feature working ever forces the core to branch on a tenant's label, the seam is in the wrong place.

The test of the seam: adding, changing, or clearing a tenant alias touches only the alias store and the read-time resolver. It never touches stored data, governance, dependency wiring, attestation, or traceability, all of which operate on the canonical code.

## 1. Decisions made (the design, and why)

1. **The canonical set is owned by the platform and Packs, not tenants.** Packs contribute concepts — Ch.18 Ontology concepts are already a declared Pack capability (Architecture Catalogue, ADR Pack Capability Declaration) — and the platform curates them. Tenants only relabel.

2. **Tenants rename only, through a per-tenant alias map.** A tenant supplies a display label for an existing canonical concept. It cannot mint a new concept, so two tenants' vocabularies can never diverge into incomparable sets.

3. **The alias is display-only and resolved at read time.** The canonical code is stored on every row. The label is applied when rendering the UI and when serialising tenant-facing API responses. Storage is never rewritten with a tenant's word. This preserves history, keeps two tenants' data joinable, and keeps Platform-scope Knowledge and Engineering Capital comparable.

4. **Enforcement lives on the write path, not on the dropdown.** The create APIs validate the incoming category against the canonical set for that field. The dropdown is the convenient front end; without server-side validation, free text returns through the API. Existing rows are grandfathered — validation constrains new writes only.

5. **The scope of what is aliasable is a conscious call.** Deliverable names, each entity's category vocabulary, and capability display names are in scope. Lifecycle states (`Defined`/`Approved`/`Baselined`) carry shared governance meaning and stay canonical; they are aliased cosmetically only if at all.

6. **Deliverable names come from Templates and are already near-canonical.** The category fields are the real normalization work. Deliverable names get the alias layer over the Template-defined name, not a second source of truth.

## 2. The model

Two new tables, both small; the pattern mirrors the tenant-scoped config the Participant Integration work already added (`tenants`, tenant contract, execution targets).

- **`ontology_concepts`** — the canonical registry. `(id, concept_type, code, default_label, contributed_by_pack, created_at)`, unique on `(concept_type, code)`. `concept_type` distinguishes the vocabularies: `category:deliverable`, `category:evidence`, `category:decision`, `category:knowledge`, `category:obligation`, `category:policy`, `deliverable-name`, `capability-name`. Seeded with platform defaults; Packs may add rows (build step 5).
- **`tenant_concept_aliases`** — the per-tenant relabelling. `(tenant_id, concept_type, canonical_code, display_label)`, unique on `(tenant_id, concept_type, canonical_code)`. Absence means "use `ontology_concepts.default_label`".

Already-canonical concepts the registry can reference rather than duplicate: `packs.category` (an existing `CHECK` enum), lifecycle states (defined by `transition_definitions`), and capability codes.

## 3. What is new vs. what is extension

**Genuinely new:**
- The `ontology_concepts` registry and its platform-default seed.
- The `tenant_concept_aliases` store and a small tenant-scoped management surface.
- A read-time label resolver used by views and tenant-facing serialisers.
- Write-path validation of category values against the registry.

**Extension of existing machinery:**
- The create/transition APIs gain a validation call (they already take `category`).
- The web detail views and API responses gain a resolve-label step (they already render categories/names).
- Pack authoring gains an optional Ontology-concept contribution (the Pack capability declaration already anticipates it).

The state machine, governance, dependency resolution, attestation, and traceability are untouched — they operate on canonical codes, which do not change.

## 4. Build sequence

Naming continues the platform's phase scheme. Every step carries a **core-invariance check** as well as a functional "done when", the same discipline as `Participant Integration Plan.md` §4: the core must read and write canonical codes only, with the label resolved at the edge.

1. **Canonical registry + platform seed + normalization.** Create `ontology_concepts`; seed the platform defaults for each `concept_type`; normalize existing free-text `category` values onto canonical codes (deliverable names are already near-canonical via Templates). *Done when:* every existing category value maps to a canonical concept and the registry is queryable. *Core-invariance check:* the registry holds canonical codes and default labels only, no tenant data.
2. **Write-path enforcement.** The create APIs (`createDeliverable`, `createEvidence`, `createDecision`, `createKnowledgeItem`, `createObligation`) validate the incoming category against the registry for that `concept_type`. *Done when:* an off-list category is rejected with a validation error and an on-list one succeeds; existing rows are unaffected. *Core-invariance check:* validation is against the canonical set only, with no per-tenant branch.
3. **Per-tenant alias store + read-time resolution.** Create `tenant_concept_aliases`; add a resolver applied in web views and tenant-facing API responses; storage stays canonical. *Done when:* two tenants see different labels for the same canonical concept, the stored rows are identical, and a cross-tenant query still joins on the canonical code. *Core-invariance check:* the resolver runs at the edge (view/serialiser); the core never reads a tenant label; a tenant with no aliases sees the platform defaults.
4. **Tenant alias management surface.** A small tenant-scoped config API and UI to set and clear aliases, alongside the tenant contract. *Done when:* a tenant can set or clear an alias and see it reflected, with no effect on another tenant. *Core-invariance check:* the management surface writes only the alias store.
5. **(Optional, may defer) Pack-contributed concepts.** Let Packs declare Ontology concepts that union into the registry at composition, using the existing Pack capability declaration. *Done when:* a Pack contributing a concept makes it available platform-wide with no code change. *Core-invariance check:* Pack concepts land in the same registry as platform defaults; nothing tenant-specific.

## 5. Open decisions still to make

- **Lifecycle-state aliasing.** Recommend leaving governance states canonical for now; alias them only cosmetically if a tenant asks. A conscious call, not a default.
- **Pack contribution now or later (step 5).** The registry supports it from step 1; whether Packs contribute in this phase or a later one is a scoping choice. Recommend deferring step 5 until a Domain Pack actually needs to add a concept.
- **Deliverable-name registry vs. Template as source of truth.** Recommend the alias layers over the Template-defined name rather than duplicating names into the registry.
- **Whether a tenant may alias a concept to a label that collides with another concept's default label.** Recommend allowing it (labels are presentation) but warning in the management UI.

## 6. Consequences for the gap plan

- **Ch.18 Ontology → Built** once this ships; §3.3 and the §8 open question are resolved by this plan.
- **Sequenced as Phase 17, and confirmed to run before Phase 16** (Governance & EBM sharpening). It is self-contained and needs no per-tenant core change, so it is safe to slot ahead.
- Nothing else in the roadmap moves; Phase 16, then Phase 11, then Phase 12 follow as planned.
