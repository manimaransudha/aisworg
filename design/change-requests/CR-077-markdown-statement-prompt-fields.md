# CR-077 — Markdown-formatted `statement`/`prompt` fields (Checklist/Quality Gate/Review Gate/Obligation Definition)

**Raised:** 2026-08-29 · **Origin:** owner, working from Ch.5 (Pack Model): "One of the things that I need is a markdown style editor for the statements in checklists. I may need this in other places as well where i may want to insert a code snippet like coding guidelines." · **Status:** ✅ **Built 2026-08-29.**

## The gap

Every verifiable Pack contribution's long-text fields (`statement`, `prompt` — Ch.5 §19.4/§20) render as a plain `<textarea>` in edit mode and a `white-space: pre-wrap` div in view mode. `marked` and `sanitize-html` have been in `package.json` since the very first baseline commit but were never wired up anywhere — the plumbing for exactly this need existed, unused.

The relevant control-shape decision was already a field-*name* special case, not a schema fact: `_referentialListGroup.ejs` hardcodes `itemField.name === 'statement' || itemField.name === 'prompt'` (twice — once for top-level item fields, once for Checklist's own nested item fields) to decide "give this one a `<textarea>` instead of a one-line `<input>`." That's the exact discipline the rest of this codebase's schema-driven form generator argues against (`x-ontology`, `x-widget`, `x-property-order` are all schema markers precisely so the view never branches on a field's name) — left as an acknowledged, pre-existing shortcut, not reopened by this CR beyond adding a parallel marker alongside it.

## Design

**A schema marker, not a new widget or table.** `x-format: "markdown"` is a new JSON Schema extension keyword (`formGenerator.ts`'s `JsonSchemaProperty`), orthogonal to `x-widget`: `x-widget` picks the control *shape* (input / textarea / referential-list / …), `x-format` layers content *semantics* on top of a string-kind field, top-level or nested-list item field. `buildItemFields` copies it into `ReferentialListItemField.markdown` the same way it already copies `x-help`/`x-label` into `help`/`label`. No DB schema change, no new contribution kind, no change to how a submitted value is reassembled (`formGenerator.ts`'s POST-side path) — a markdown field is still a plain string in, plain string out. Storage stays raw markdown text; there is no separate rendered-HTML column, so there's nothing to keep in sync (render-on-read, not render-on-write).

**Editing.** Same `<textarea>`, same `name`/`value` contract — enhanced with a small toolbar (Bold / Italic / Inline code / Code block / List / Link) that inserts markdown syntax around the cursor selection, client-side, no new dependency (`public/js/markdownEditor.js`, delegated on `document` the same way `referentialListGroup.js` already delegates its nested-row add/remove so cloned "+ Add another"/"+ Add item" rows work with zero re-init). Code snippets are markdown fenced blocks (` ```lang … ``` `), not a separate embedded code-editor widget — that's a materially heavier capability (line numbers, live language-aware highlighting) nobody asked for.

**Rendering.** View mode for a `markdown`-flagged field runs the stored value through `marked` → `sanitize-html` (`domain/sdk/markdownRender.ts`) instead of the plain pre-wrap div. Sanitization is mandatory, not optional: Pack contributions are authored by any actor holding the relevant `pack_*` badge and read by every other viewer, so unsanitized markdown-to-HTML is a stored-XSS surface across tenants — every render goes through the allow-list, no path skips it.

**Live preview: deferred, split to CR-078.** Owner: "Save to see for now. Open a CR for live preview and defer it." No preview toggle in the editor — an author saves the Draft and sees the rendered result in view mode, same round trip every other field already uses.

**Tables and images: out of scope**, owner's own call. The `sanitize-html` allow-list has no `table`/`thead`/`tbody`/`tr`/`td`/`th` or `img` — markdown table/image syntax typed into one of these fields renders as inert text, not a security hole and not a supported feature.

## Scope

`statement` + `prompt`, on all four contribution kinds that carry them:

| Contribution kind | Field | Schema path |
|---|---|---|
| Checklist item (nested, `contributionChecklists[].items[]`) | `statement` | `contributionChecklists.items.properties.items.items.properties.statement` |
| Quality Gate | `statement`, `prompt` | `contributionQualityGates.items.properties.{statement,prompt}` |
| Review Gate | `statement`, `prompt` | `contributionReviewGates.items.properties.{statement,prompt}` |
| Obligation Definition | `statement`, `prompt` | `contributionObligationDefinitions.items.properties.{statement,prompt}` |

Checklist items have no `prompt` field (dropped by CR-060 — execution-side concerns live on the referencing gate, not the Checklist item itself), so 7 fields total, not 8.

## Built 2026-08-29

Migration [129](../../src/dblayer/migrations/129_markdown_format_marker.sql) — `x-format: "markdown"` added to the 7 fields above on the live Pack schema (max-version row, same `jsonb_set`-on-the-live-row convention as migration 120; not a new schema version). New `domain/sdk/markdownRender.ts` (`marked` + `sanitize-html`, allow-list excludes tables/images/raw HTML/scripts). `formGenerator.ts`: `x-format` on `JsonSchemaProperty`, `markdown` on `ReferentialListItemField`, threaded through `buildItemFields`'s existing `common` object — no top-level `GeneratedField` change, since no top-level (non-item) field needs this yet. New partial `_markdownEditorField.ejs` (toolbar + textarea, included only from the editable-cards branch of `_referentialListGroup.ejs`, which is always `canEdit`) used at both the top-level item-field textarea and Checklist's own nested item-field textarea. Read-mode rendering (`_referentialListGroup.ejs`'s plain-read table cell, and its Checklist-items-in-cell branch) calls `renderMarkdown` — threaded as a render local from `sdkAuthoring.ts`'s `renderAuthoringForm` through `authoring/edit.ejs` → `_generatedFieldGroups.ejs` → `_referentialListGroup.ejs`, the same explicit per-include threading every other shared local (`verifiableFieldHelp`, `checklistOptions`, …) already uses on this chain. New client script `public/js/markdownEditor.js`, loaded alongside `referentialListGroup.js` on `authoring/edit.ejs`. Added `@types/sanitize-html` (devDependency — `sanitize-html` ships no types of its own; `marked` ships its own).

Not touched: the pre-existing `full` name-check (still decides textarea-vs-input sizing, now redundant-but-harmless alongside `markdown` for these 7 fields — not retired, since collapsing it wasn't asked for and a future long-text field could plausibly want the wide textarea without markdown). No governing chapter (Ch.23/25/26/47) updated — this is a cross-cutting SDK/authoring-UI capability, not a change to any of those chapters' own domain model.
