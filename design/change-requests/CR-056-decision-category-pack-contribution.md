# CR-056 — Decision categories contributed through Packs

**Raised:** 2026-08-22 · **Origin:** owner, reviewing Chapter 19's new "§20 Implementation Status & Gaps" section — Chapter 19 §7 claims "additional [Decision] categories may be introduced through Packs," confirmed unbuilt (zero Packs seed a `category:decision` concept, `ontology_concepts.contributed_by_pack` exists as a column but nothing writes it). Owner: "Categories introduced through packs has to be implemented. - open as CR." · **Status:** 🟡 Proposed (not designed, not scheduled)

## The gap, already documented once

`ontology_concepts.contributed_by_pack` has existed as a column since the Ontology Model's original build (referenced in CR-020's own "Not in scope" note: "Pack-contributed concepts (`contributed_by_pack`) — the column and `upsertConcept` support it, but nothing writes it yet") and is still true today, platform-wide, not just for Decision. This CR scopes the problem to Decision's own `category:decision` concept type specifically (Ch.19 §7's explicit claim), but the underlying mechanism — if built — would presumably need to work the same way for every `category:*` concept type that makes the same Pack-contribution claim (`category:pack`, `category:event-types`, etc. — several of these have the identical "Packs may introduce more" framing in their own chapters, all equally unbuilt).

## What "categories introduced through Packs" would mean

Today, `category:decision`'s only 2 seeded concepts (`Engineering Decisions`, `Design Decisions`, migration `030_ontology.sql:42-43`) come from a one-time migration seed — the same mechanism used for every other canonical Ontology vocabulary (`capability-name`, `category:pack`, etc.). A Pack-contributed category would mean: when a Pack is authored/published/installed, it can declare a new `category:decision` concept (e.g. a Compliance Pack introducing `"Regulatory Decisions"`) that becomes available to any SEU that installs that Pack — without an admin manually adding it through the Ontology Management CRUD UI (CR-020) or a platform migration.

## Open questions (not yet designed)

- **Where does a Pack declare this?** Packs already have a `contributions` shape used elsewhere (`pack.contributions?.authorityRules`, read by `compositionEngine.compose()`) — does Decision-category contribution reuse that same shape (`pack.contributions?.ontologyCategories` or similar), or is it a dedicated field?
- **When does the write happen?** At Pack authoring/publish time (so the concept exists platform-wide the moment the Pack is published), or at SEU-commissioning/composition time (so it's scoped to SEUs that actually install that Pack)? These have very different blast radii — the former pollutes the global `category:decision` vocabulary for every tenant the moment any one Pack publishes; the latter needs a tenant/SEU-scoped concept, which `ontology_concepts` doesn't currently support for this concept type (it has `tenant_id` for tenant-scoped Ontology per CR-022, but Decision categories today are seeded at the Platform tenant, globally shared).
- **Conflict handling**: what happens if two installed Packs each contribute a category with the same code but different labels/descriptions? `compositionEngine.ts`'s existing `detectGovernanceConflicts` handles an analogous problem for `authorityRules` — whether that's reusable here, or a new mechanism is needed, isn't decided.
- **Retirement/versioning**: if a Pack is uninstalled or downgraded, does its contributed category get retired? `ontology_concepts.is_active` (CR-020) already supports soft-retire, but nothing currently triggers it from a Pack lifecycle event.
- **Scope beyond Decision**: whether this CR's eventual design should be built generically (any `category:*` concept type, any Pack) or narrowly (just `category:decision`) — the generic version avoids repeating this same CR for `category:pack`/`category:event-types`/etc. later, but is more design work up front.

## Not in scope

- Seeding the 3 missing baseline `category:decision` concepts (Architecture, Operational, Governance) to match Chapter 19 §7's own illustrative list — that's a same-shape, zero-ambiguity data seed (same treatment as `capability-name`/`deliverable-name`, CR-020), tracked separately as a direct fix, not part of this CR's own scope.
- The `contributed_by_pack` column itself, and `upsertConcept`'s existing support for setting it — both already exist; this CR is about the missing *write path* (something in the Pack lifecycle that actually calls it), not the storage.
