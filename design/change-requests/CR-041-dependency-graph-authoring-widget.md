# CR-041 — Dependency graph authoring widget (generic, self-referential repeatable-list mechanism)

**Raised:** 2026-08-20 · **Origin:** owner, reviewing CR-038's parked design — "I think we have to first create the dependency creator widget because that is needed for CR38." Owner's explicit constraints: "This authoring has to finally be inside the template" (not a separate tool), and "don't call it template-side authoring, it is a widget and can be used anywhere" — the mechanism is a generic addition to the schema-driven form pipeline, not something conceptually owned by Template. Whichever entity kind's Draft authors it owns the resulting rows (`owning_entity_type`/`owning_entity_id`, CR-043) — Template is simply the first, not the only, caller. · **Status:** ✅ Built 2026-08-20

> **Built 2026-08-20.**

## The gap this closed

CR-038's Deliverable Catalogue redesign (Ontology multi-select for `deliverable-name`) answers *which* Deliverable names a Template's catalogue declares. It never answered *how those names relate to each other*.

That relationship used to live in `deliverableCatalogue[].dependsOnDeliverableCodes`/`dependsOnCapabilityServiceCodes` — hand-typed JSON, translated into real `dependency_definitions` rows only via `deriveDependencyDefinitionsFromCatalogue.ts` (CR-039's transitional bridge). Owner's call mid-build: **no bridge** — the seed data itself had to be corrected to the new shape, not kept dual-path.

## The mechanism (verified against, and built into, the live pipeline)

Every Pack/Template/Profile field renders and parses through one generic, schema-driven pipeline — `schema_definitions` rows drive `generateFields`/`parseFormBody` (`src/domain/sdk/formGenerator.ts`); `x-widget: "referential-list"` is a repeatable-row field whose item fields resolve against `referentialOptions`, computed server-side in `src/routes/seu/web/sdkAuthoring.ts`.

**The one real gap this CR closed:** `referentialOptions` only ever resolved against an external source (a Registry/Ontology lookup) — never against *the other rows already entered on this same Draft*. Fixed generically, not Template-specifically: `x-referential` now accepts a self-referential form, `"self:<fieldName>"`, resolved from the Draft's own current content by a new function (`loadSelfReferentialOptions`, alongside `loadReferentialOptions`/`loadOntologyOptions`, same merge point) — schema-driven and entity-kind-agnostic, no per-kind branch. Template's `dependencyGraph.toName` is the first caller; the mechanism itself assumes nothing about Template.

## What changed

- **Migration 076** — Template's schema gains `dependencyGraph`, a `referential-list` field. Item shape: `{ toName: <self-referential from deliverableCatalogue>, fromType: "Deliverable"|"Capability", fromName: <free text — a Deliverable name or a Service code>, requiredState: <free text, schema default "Approved"> }`. `requiredState` is pre-filled but author-editable (owner: "the author should be able to change. Show a default. And author can change") — not hardcoded, not omitted.
- **`sdkAuthoring.ts` (web route)** — `selfReferentialFieldNamesIn`/`loadSelfReferentialOptions` added; merged into `referentialOptions` at the one render call site. No change to `formGenerator.ts`/`_referentialListGroup.ejs` — the existing `kind:"referential"` rendering already handles any `referentialOptions` key verbatim, self-referential or not.
- **`materialiseDependencyGraph.ts`** replaces `deriveDependencyDefinitionsFromCatalogue.ts` outright (deleted, not kept as a fallback). Takes an explicit `dependencyGraph` array directly — no more translating from embedded per-catalogue-entry codes. Wired into both `publishTemplate` and `materialiseTemplateDraft` (`core/templates.ts`), and into all three seed scripts (`seedSdlcStandardTemplates.ts`, `seedEbookLibraryPilot.ts`, `tests/testFixtures.ts`).
- **`TemplateDeliverableSeed`** lost `dependsOnDeliverableCodes`/`dependsOnCapabilityServiceCodes` outright; new `TemplateDependencyGraphEntry` type (`toCode`, `fromType`, `fromCode`/`fromCapabilityCode`, optional `requiredState`) added to `seuTypes.ts`.
- **Retrofit — no bridge, the seed JSON itself was corrected** (owner's explicit call): all 11 Template seed JSON files (9 CR-034 standard + `web-application` + `ebook-library`) converted programmatically from the embedded shape to an explicit top-level `dependencyGraph` array, `deliverableCatalogue` entries stripped of their old embedded fields. `validateTemplateSeed` (`core/templates.ts`) gained a matching referential cross-check (`toCode`/`fromCode`/`fromCapabilityCode` must resolve) replacing the old dependsOnDeliverableCodes ordering check; cycle detection remains explicitly out of scope (an authoring-time widget concern, not built here).
- **Cycle detection** — still not built. Parked exactly where CR-039 left it; this CR didn't add it.

## Verification

- `npx tsc --noEmit` clean throughout.
- Full suite: **149/149** passing after the seed conversion, the bridge's removal, and the new field's schema migration.
- `pnpm db:clean-slate` run live twice (before and after migration 076) — clean both times, all 9 standard Templates reseeded via the new `materialiseDependencyGraph` path, no bridge involved.
- **Live HTTP smoke test** (in-process `app.listen` + real session, matching the existing e2e test pattern — a raw dev-server/curl attempt hit CSRF protection unrelated to this change, so this is the same harness the real e2e suite already uses):
  - `GET /aisworg/seu/sdk/template-authoring/new` → 200, `dependencyGraph` renders as a proper "Dependency Graph" repeatable-row card with a `toName` select.
  - A Draft seeded directly with `deliverableCatalogue: [{name: "Requirements Specification"}, {name: "Architecture Document"}]` → `GET` its edit page → the `toName` select correctly shows both names as real `<option>`s, proving the self-referential resolution works against real Draft content, not just renders emptily.
- The write path (posted `dependencyGraph[i][...]` rows → real `dependency_definitions` rows on publish) was not separately smoke-tested over HTTP (blocked by CSRF in a scripted, cookie-only client) — it rests on `parseFormBody`'s existing, unchanged `referential-list` parsing (already covered by other fields' own SDK authoring tests) composed with `materialiseDependencyGraph`, which the seed-script cutover already proves correct for the identical shape.

## Not in scope (unchanged from the proposal)

- Any Pack-side or Profile-side authoring UI — this CR proved the mechanism generic but only Template actually uses it yet.
- Cycle detection — still parked, not built.
- A cascading requiredState picker (options narrowed by `fromType`) — `requiredState` is free text with a static default; a real per-type picker is a future refinement, not required to close the original gap.
