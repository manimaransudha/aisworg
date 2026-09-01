# CR-082 — Pack contribution kind `EngineeringCapital` (Engineering Behaviour / Engineering Metrics / Reusable Components / Engineering Templates)

**Raised:** 2026-08-30 · **Origin:** owner, working from `design/tbi.md`'s own §9 contribution-classification note (line 75). · **Status:** ✅ **Built 2026-08-30.**

## The gap

Ch.5 §9 "Pack Contributions" names 14 kinds a Pack may contribute; §19.4 (the section's own closure audit, CR-058 through CR-065) confirms which are actually Pack-contributable in the running app and which aren't. Four named in §9 were never built at all: **Engineering Behaviour**, **Engineering Metrics**, **Reusable Components**, **Engineering Templates**. (§19.4's own wording groups the latter two under "User-Interface Components" and "Metrics-via-Pack" respectively — same gap, different label.)

Owner: "Template Entity this app defines is not the same as Engineering Templates. Completely unrelated." — ruled out the one candidate for "this might already be covered": the platform's own first-class Template entity (Draft→Active lifecycle, inheritance, a Pack *dependency*, not a Pack *contribution*) has nothing to do with this. All four are a genuine, live gap.

## Design

Owner: "Just say EngineeringCapital. Inside provide a minimal stub both in schema and UI. Type, Url. Type will be Engineering Behaviour / Engineering Metrics / Reusable Components / Engineering templates etc. Url will be a text field to hold the url. [Type] should be in a dropdown and the dropdown should source from a new ontology concept engineering-capital."

One new contribution kind, not four separate schema fields — `contributionEngineeringCapital[]`, each item:
- **`type`** — Ontology-backed dropdown, new concept type `engineering-capital`, seeded with the four §9 names. Freely-extensible (same treatment `service-name`/`capability-name` already get — not a fixed enum; a fifth kind is an Ontology seed change, not a schema change).
- **`url`** — plain text, where the actual resource lives.

Deliberately not a §20 verifiable item (no `statement`/`classification`/`prompt`/etc.) — `tbi.md`'s own §9 classification note: "Classification applies to the contributions that are *checked*... [Ontology, Knowledge Assets, Templates, UI Components, Services, Metrics] not classified — inputs and assets, not checks." Engineering Capital is squarely in that bucket.

Owner: "We will define that these should be in details later" — this is a minimal stub, matching every other §9 subsection's own current one-line depth in Ch.5 itself. Richer structure (per-type fields, an Owner/Status, etc.) is explicitly deferred to a future CR, not decided here.

## Built

- **Migration `141`** — new `engineering-capital` concept type, seeded with the four names (Platform tenant, freely-extensible).
- **Migration `142`** — `contributionEngineeringCapital[]` added to Pack's schema (`jsonb_set`, same mechanism CR-062's Obligation Definitions migration used), `x-widget: "referential-list"`, `type`/`url` both required.
- **`seuTypes.ts`** — `PackContributions.engineeringCapital?: Array<{type?: string; url?: string}>`.
- **`core/sdkAuthoring.ts`** — `contributionEngineeringCapital` ↔ `contributions.engineeringCapital` wired through all three existing conversion points (`toPackSeedInput`, `packRowToContent`, `inheritedPackVersionContent` — the same three CR-081's branch-picker flow already touches for every other contribution kind).
- **`core/packs.ts`** — `validatePackSeed` gained a validation loop: `type` must resolve to a real, active `engineering-capital` concept (`assertCanonicalCategory`, same discipline every other Ontology-backed contribution field gets); `url` just needs to be non-empty.
- **`web/sdkAuthoring.ts`** — `loadReferentialOptions` gained the `engineering-capital` concept fetch, so the form's `type` dropdown is populated the same way every other referential-list item field's is. No new UI mechanism — renders through the existing generic `referential-list` widget (Quality Gates/Review Gates/Checklists/Policies/Obligation Definitions all already use it).
- `pnpm typecheck` clean.

## Explicitly out of scope for this CR

- Per-type-specific fields (an Engineering Behaviour entry vs. a Reusable Component entry currently look identical — `type` + `url` only). Owner: details later.
- Materialisation into a real table — stays JSONB-only, same call CR-062 made for Obligation Definitions (nothing else on the platform needs to cross-reference one by id).
- Any execution-side consumption (nothing reads `contributionEngineeringCapital[]` at SEU-commissioning or runtime yet — declaration only, same boundary every other contribution kind in this series respects).
