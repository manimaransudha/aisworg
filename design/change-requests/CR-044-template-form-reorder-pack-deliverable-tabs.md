# CR-044 — Template authoring form: Code/Name/Purpose/Version first, dedicated Pack Codes and Deliverable Catalogue tabs

**Raised:** 2026-08-20 · **Origin:** owner, looking at the Template view form: "The fields in the template definition form has to be reordered... Code, Name, Purpose, Template version (there are metadata). A tab for pack codes. In this tab show the categories: Domain, Engineering, Integration etc. A tab for deliverable catalogue. This is where the dependency graph should be." · **Status:** ✅ Built 2026-08-20

> **Built 2026-08-20.** The Template edit page (`seu/sdk/authoring/edit.ejs` + `_generatedFieldGroups.ejs`) is the same generated form for both viewing and editing an existing Draft (`canEdit` just disables the controls) — this fix applies to both, answering the owner's own "not sure if the edit form is also the same" uncertainty: yes, same template.

### What changed

**1. `groupFieldsForDisplay` (`domain/sdk/formGenerator.ts`) gained two new groups**, `packSelection` and `deliverables`, alongside the existing `metadata`/`compatibility`/`dependencies`/`contributions`/`other`:
- `packSelection` — Template's six category-scoped Pack fields (`compliancePackCodes`/`domainPackCodes`/`engineeringPackCodes`/`integrationPackCodes`/`organisationPackCodes`/`technologyPackCodes`, CR-038).
- `deliverables` — `deliverableCatalogue` + `dependencyGraph` (CR-038/CR-041) together, catalogue before graph (the graph's `toName` picker resolves against the catalogue's own rows).

Purely name-driven, same discipline the existing groups already followed — no schema/DB change. Profile shares four of the six `packSelection` field names (its own §7 category pickers, migration 066) and picks up the same "Pack Codes" tab automatically; Pack has none of these field names and is unaffected.

**2. A real bug fix in passing.** `engineeringPackCodes`, `organisationPackCodes`, and `dependencyGraph` were missing from the old `METADATA_FIELD_NAMES` set entirely — never added alongside their siblings when migrations 077/078/076 shipped — so they silently fell into the catch-all `other` bucket (rendered, but grouped as leftover) instead of anywhere meaningful. Naming them explicitly in the new dedicated groups fixes that too.

**3. Deterministic field order, independent of storage order.** `generateFields()` iterates `Object.entries(schema.properties)`, and Postgres jsonb does **not** reliably preserve object-key insertion order — so relying on it for display order was never sound, even before this change. A new `FIELD_DISPLAY_ORDER` array + `byDisplayOrder` comparator (stable sort) is applied to `metadata`/`packSelection`/`deliverables` after grouping: `code, name, purpose, templateVersion, …` for metadata (exactly the owner's requested order), then the six pack categories alphabetically, then `deliverableCatalogue` before `dependencyGraph`. Fields not in the list keep their original relative order, appended after every named one — so this is additive for Pack's own Identity & Metadata tab (mandatoryPackCodes-era fields, `configParameters`, etc. — untouched, no regression).

**4. `_generatedFieldGroups.ejs`** — two new tabs, "Pack Codes" and "Deliverable Catalogue", inserted between Identity & Metadata and Compatibility (both empty/absent for Template, so Template now renders exactly three tabs, in this order). Rendered as `type: 'simple'` panes, reusing the same referential-list rendering path (`_referentialListGroup.ejs`) the existing bug-fixed metadata-tab code already had for `mandatoryPackCodes`/`optionalPackCodes` — no new EJS control logic needed, just two more entries in the tab-building array and the default `sections` list. `edit.ejs` itself needed no change: Template has no `dependencies`/`contributions` fields, so it already takes the flat (non-stepper) render path, and the new tabs simply appear via the ungated default `sections` list.

### Verification

- `npx tsc --noEmit` clean.
- Full suite: **149/149** passing, no test changes needed (nothing asserted on tab structure or field order before this).
- **Live HTTP smoke test** (in-process `app.listen`, `NODE_ENV=test` dev auto-login, same harness as CR-038/CR-041's own): `GET /seu/sdk/template-authoring/:id` for the `enterprise-web-application` fixture Template — confirmed, by direct inspection of the rendered HTML:
  - Exactly three vertical tabs, in order: "Identity & Metadata", "Pack Codes", "Deliverable Catalogue".
  - Identity & Metadata tab fields, in order: Code, Name, Purpose, Template Version.
  - Pack Codes tab: all six categories (Compliance/Domain/Engineering/Integration/Organisation/Technology Pack Codes).
  - Deliverable Catalogue tab: Deliverable Catalogue field, then Dependency Graph field.

### Not in scope

Any change to Pack's or Profile's own tab set beyond the free side effect above (Profile's four shared category fields moving out of Identity & Metadata into their own "Pack Codes" tab) — not separately verified beyond the type-check + full suite passing; no test exercises Profile's own authoring page HTML directly.
