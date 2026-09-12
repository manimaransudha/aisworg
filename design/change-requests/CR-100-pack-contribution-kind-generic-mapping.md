# CR-100 — Generalise Pack contribution-kind display/save mapping (stop hand-writing it 3 times per kind)

**Raised:** 2026-09-11 · **Origin:** owner, directly off CR-099's own "Competencies tab shows none" bug — *"contribution kind added to Pack will hit this exact same 'tab shows empty' bug unless someone generalizes it — Make this a CR."* · **Status:** 🟡 Proposed — design only, nothing built.

## The gap

A Pack's `contributions` JSONB stores each contribution kind under a short key (`capabilities`, `engineeringCapital`, `competencies`, ...); the Pack authoring **schema** exposes each one as a flattened, `contribution`-prefixed field (`contributionCapabilities`, `contributionEngineeringCapital`, `contributionCompetencies`, ...) for the generic form generator to render as its own tab. Something has to translate between the two shapes, and today that translation is **hand-written, separately, in three different places** in `core/sdkAuthoring.ts`:

1. `toPackSeedInput`'s `arr(...)` list (~line 65-82) — form → save direction.
2. `packRowToContent` (~line 351-378) — an existing Pack → view/edit-form content.
3. `inheritedPackVersionContent` (~line 805-856) — an existing Pack's content, inherited into a brand-new Draft (new version / "Copy as new Draft").

Each of these three functions lists all 10 current contribution kinds (`capabilities`, `services`, `authorityRules`, `policies`, `qualityGates`, `checklists`, `reviewGates`, `obligationDefinitions`, `engineeringCapital`, `competencies`) as its own explicit object-literal line. Adding an 11th kind means remembering to add a line to all three — miss one, and that kind's tab silently shows empty (view) or silently drops edits (save) with no error, exactly what just happened to `contributionCompetencies` in CR-099: the schema field, the Ontology backing, the validation, and every seed file were all correct; only the view-side mapping was missing, and nothing caught it until a human looked at the tab.

## Why this is safe to generalise — the mapping is 100% mechanical

Checked every one of the 10 existing kinds directly (`grep` across all three functions): without exception, the schema field name is always `"contribution" + PascalCase(shortKey)`, and the short key is always `lowercaseFirst(schemaFieldName without the "contribution" prefix)`. No kind breaks this pattern — not even `competencies` (`contributionCompetencies` ↔ `competencies`) or `qualityGates` (`contributionQualityGates` ↔ `qualityGates`). There is no case where the short key isn't derivable from the schema field name by a plain string transform, and no case where a `contribution`-prefixed schema field means something other than "this Pack's own short-keyed contribution of the same name."

## Design — proposed, not owner-confirmed

- **One small, pure utility, both directions**: `shortKeyFor(schemaFieldName: string): string` (strip the `"contribution"` prefix, lowercase the first remaining character) and its inverse `schemaFieldFor(shortKey: string): string`. No hardcoded kind list anywhere.
- **Derive the kind list from the schema itself**, not a hand-typed array — `Object.keys(schema.properties).filter(k => k.startsWith("contribution"))`, the same schema-is-the-source-of-truth discipline `ontologyConceptTypesIn`/`dynamicReferentialSourceFieldsIn` (`formGenerator.ts`) already use for their own schema-driven scans. A new contribution kind becomes visible to all three functions automatically the moment its schema field is added — no `sdkAuthoring.ts` edit at all for the mapping itself.
- **Replace all three hand-written blocks** with one small loop each, using the shared utility:
  - `toPackSeedInput`: `for (const field of contributionFieldsIn(schema)) contributions[shortKeyFor(field)] = arr(field, shortKeyFor(field));`
  - `packRowToContent` / `inheritedPackVersionContent`: `for (const field of contributionFieldsIn(schema)) content[field] = c[shortKeyFor(field)] ?? [];`
- **`normalizeServiceContributions`** (currently special-cased inline for `services` in `toPackSeedInput`, CR-086's own service-level merge logic) stays a special case — not every kind is a plain pass-through, so the generic loop needs an escape hatch for the one or two kinds with real transform logic, not a blanket "every kind is identical" assumption.

## What this does NOT fix (separate, not this CR's job)

- `validatePackSeed`'s own per-kind semantic checks (`core/packs.ts`) — genuinely different per kind (capability-name lookups, competency's two-layer dimension/value check, mandatory-when-category, ...) and can't be generalised the same way; still one block per kind, by design.
- `materializeContributions` — only some kinds (Capabilities/Services/Authority Rules/Policies/Quality Gates/Review Gates/Checklists) get written into their own real tables; Competencies/Obligation Definitions/Engineering Capital deliberately stay declaration-only (JSONB). This split is a real per-kind decision, not boilerplate to eliminate.
- The Pack **schema itself** (`schema_definitions`) — still authored per kind, one migration each; this CR is about the code that reads/writes an already-declared schema field, not about generating the schema field itself.

## Open questions

- Exact naming/location of the new utility (`formGenerator.ts`, alongside `ontologyConceptTypesIn`/`dynamicReferentialSourceFieldsIn`, seems the natural home — not decided).
- Whether to apply this retroactively to the 9 pre-existing hand-written kinds in the same pass, or only stop the bleeding for kinds added from here on (touches more code at once vs. leaves the old duplication in place alongside the new generic path). Leaning toward doing all 10 in one pass — a mix of generic-for-new/hardcoded-for-old is its own confusing state — but not decided.

## Not in scope

- Template's and Profile's own equivalent authoring plumbing (if they have the same 3-places pattern for their own fields) — not audited here, this CR is scoped to what CR-099 actually hit (Pack).
