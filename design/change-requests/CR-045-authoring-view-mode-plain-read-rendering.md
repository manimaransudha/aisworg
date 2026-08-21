# CR-045 — Authoring view mode: plain read text, not disabled dropdowns/inputs

**Raised:** 2026-08-20 · **Origin:** owner, looking at a non-Draft Template's authoring page: "The view should show the details. It is resembling the edit form, just not editable, showing dropdowns etc." · **Status:** ✅ Built 2026-08-20

> **Built 2026-08-20.**

### The gap this closes

The authoring edit page (`seu/sdk/authoring/edit.ejs`) is the same generated form for viewing and editing — `canEdit` (`canDefine && isDraft`, `web/sdkAuthoring.ts`) only ever toggled the HTML `disabled` attribute on the same controls. Once a Template/Pack/Profile left Draft (the common case — most rows a viewer opens are Published/Active), the page still rendered a full stack of grayed-out `<select>`s and `<input>`s: a referential-select field showed a disabled dropdown with the raw stored code as its selected `<option>`, a referential-list (Pack Codes, Deliverable Catalogue, Dependency Graph, Pack's own Dependencies/Contributions) still rendered every blank offered row alongside the real ones, all as disabled controls. Functionally inert, but visually still "an edit form someone can't touch" rather than "a details view" — exactly the owner's complaint.

### What changed

**`_generatedFieldGroups.ejs`** (the "simple" per-field grid — Identity & Metadata, Compatibility, Pack Codes, Deliverable Catalogue) and **`_referentialListGroup.ejs`** (every referential-list field, standalone or nested in a dedicated tab like Pack's Dependencies) both gained a real `!canEdit` branch, replacing the disabled-control rendering with plain read markup:

- **string / textarea / select / version** — plain text (`<div class="small">`), `—` when blank. `textarea` keeps `white-space: pre-wrap` so multi-line content (e.g. Template's `purpose`) still wraps naturally.
- **`json`** — a read-only `<pre>` block instead of a disabled textarea (also applied to Pack's own JSON-widget Contributions, e.g. Compliance).
- **`referential-select` with `x-ontology`** — resolves to the Ontology concept's own `label` (not the bare stored code), same "⚠ code (not currently active)" fallback the disabled `<option>` used to show when the value no longer resolves. The CR-023 guidance text still shows underneath when the matched concept has a `description`.
- **`referential-select` sourced from `template-code`** (Profile's `baseTemplateCode`) — resolves to the Template's `name`, same fallback treatment.
- **`referential-list`** (Pack Codes, Deliverable Catalogue, Dependency Graph, Pack's Dependencies/Contributions) — only real, existing rows (`field.rows.slice(0, field.existingCount)`); the blank "New item" row `generateFields()` always appends for the edit form's own convenience is dropped entirely, since there's nothing to add in view mode. Each row renders as a plain-text card: item fields resolve the same way scalar fields do — Pack-code references (Dependencies, Template's `mandatoryPackCodes`/category-scoped fields, Profile's `optionalPackCodes`) resolve to the Pack's `name — vVersion`, booleans render as Yes/No, everything else as plain text. Zero existing rows renders `None`, not an empty control.
- No Add/Remove controls, no "+ Add another" button — view mode has nothing to add or remove.

Untouched: `_generatedFields.ejs` (the schema-registry's own meta-schema form — always editable, never a view-only surface) and the Lifecycle transition / JSON import cards in `edit.ejs` itself (separate, already-correct `canEdit`/`canPublish`-gated actions, not part of the generated field rendering this CR touched).

### Verification

- `npx tsc --noEmit` clean (EJS-only change; no TS surface touched).
- Full suite: **149/149** passing, no test changes needed (no existing test asserted on disabled-control markup).
- **Live HTTP smoke tests** (in-process `app.listen`, `NODE_ENV=test` dev auto-login):
  - An **empty** Active Template (no `draft_content` — created via direct DB seeding, not the authoring form) — confirmed Code/Name/Purpose/Template Version render as resolved plain text, and every Pack Codes / Deliverable Catalogue / Dependency Graph field correctly renders `None` (a genuinely empty state, not a bug — `draft_content` legitimately has no schema-shaped content for Templates created outside the authoring form, e.g. the SDLC seed script and the test fixture — a separate, pre-existing gap this CR did not touch).
  - A **real** Template authored through `createAuthoringDraft` with actual `compliancePackCodes`/`deliverableCatalogue`/`dependencyGraph` content, then flipped to `Active` — confirmed the Pack code resolved to its real `name — vVersion` ("Security, Privacy & Compliance (SDLC Phase 4) — v1.0.0"), the Deliverable Catalogue row rendered its Name/Category as plain text and the empty `producingCapabilityCode` as `—`, and the Dependency Graph row rendered all four fields (`toName`/`fromName`/`fromType`/`requiredState`) as plain text — no disabled controls anywhere on either page.

### Not in scope

- The separate, pre-existing gap surfaced during verification (not this CR's own bug): Templates/Packs created via a direct-DB seed script rather than the real authoring form (`seedSdlcStandardTemplates.ts`, `tests/testFixtures.ts`) have no `draft_content`, so their view page correctly shows `None` for every schema-shaped field even though the real relational data (junction tables, `deliverable_catalogue` column, `dependency_definitions`) exists elsewhere. Not raised by the owner; noted here only so a future "why does this seeded Template look empty" question has an answer on record.
- Any visual/layout redesign beyond swapping controls for plain text — card structure, tab structure, and labels are unchanged from CR-044.
