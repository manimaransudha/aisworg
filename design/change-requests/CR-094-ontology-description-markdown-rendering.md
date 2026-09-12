# CR-094 — Markdown rendering for Ontology concept `description`

**Raised:** 2026-09-11 · **Origin:** owner: "there is a capability-name ontology. there is a description column in the Ontology table which is a text. I want the UI rendering to be markdown. I believe checklists statement already has this implementation." · **Status:** ✅ **Built 2026-09-11.**

## The gap

`ontology_concepts.description` ([056_ontology_concepts_description.sql](../../src/dblayer/migrations/056_ontology_concepts_description.sql)) is free-text guidance ("when to use this concept") shown wherever a concept is picked. In the Ontology Management page ([ontology/index.ejs:48](../../src/views/seu/sdk/ontology/index.ejs#L48)) it's authored in a plain `<textarea>` and rendered in view mode as escaped plain text ([ontology/index.ejs:77](../../src/views/seu/sdk/ontology/index.ejs#L77)):

```ejs
<% if (c.description) { %><div class="text-muted small fst-italic mt-1" ...><%= c.description %></div><% } %>
```

CR-077 already solved this exact problem for Checklist/Quality Gate/Review Gate/Obligation Definition's `statement`/`prompt` fields: a markdown-editing toolbar in edit mode, `marked` → `sanitize-html` render-on-read in view mode (`domain/sdk/markdownRender.ts`'s `renderMarkdown`). Owner confirmed that's the intended precedent to follow, not a fresh design.

## Why CR-077's mechanism doesn't just extend as-is

CR-077's `x-format: "markdown"` is a JSON Schema marker consumed by `formGenerator.ts`'s schema-driven Pack-contribution form generator (`_referentialListGroup.ejs`, `_markdownEditorField.ejs`). Ontology concepts aren't a Pack contribution and don't go through that generator — `ontology/index.ejs` is a hand-written page with its own route (`routes/seu/web/ontology.ts`) and its own add-concept form. There is no schema to attach `x-format` to here.

What *does* carry over directly, because both are plain module functions with no dependency on the schema generator:
- `renderMarkdown` (`domain/sdk/markdownRender.ts`) — generic markdown-to-sanitized-HTML, not specific to any contribution kind despite its file header's CR-077 framing.
- The toolbar behaviour in `public/js/markdownEditor.js` — inserts markdown syntax around a textarea selection; delegated, not tied to `_referentialListGroup.ejs`'s DOM structure.

So this CR wires the *same two building blocks* directly into `ontology/index.ejs`, rather than routing description through the Pack-contribution schema machinery.

## Design

**Editing.** Add-concept form's `description` textarea ([ontology/index.ejs:48](../../src/views/seu/sdk/ontology/index.ejs#L48)) gets the same toolbar as `_markdownEditorField.ejs` (Bold / Italic / Inline code / Code block / List / Link), either by including that partial directly or by attaching `markdownEditor.js`'s existing delegated behaviour to this textarea (needs a matching `data-` hook or class — check what `markdownEditor.js` keys off of before choosing). No retire-time editing of `description` exists today, so this is the only textarea in scope.

**Rendering.** View-mode cell ([ontology/index.ejs:77](../../src/views/seu/sdk/ontology/index.ejs#L77)) runs `c.description` through `renderMarkdown` and switches from `<%=` (escaped) to `<%-` (raw) — safe only because `renderMarkdown`'s `sanitize-html` allow-list is mandatory and unconditional, same guarantee CR-077 relies on. Render in the route (`routes/seu/web/ontology.ts`, alongside where `description: c.description` is already mapped at line 83) or in the view — match whichever CR-077 pattern the current codebase favors after re-checking (`sdkAuthoring.ts` renders as a threaded local passed down to the view, not in the view itself).

**No schema/DB change.** Storage stays raw markdown text in `ontology_concepts.description`, same render-on-read discipline as CR-077 — no rendered-HTML column, nothing to keep in sync.

**Same out-of-scope calls as CR-077**, inherited, not re-litigated: no tables/images (allow-list doesn't include them), no live preview (that's CR-078, still deferred, and applies here too if/when it's picked up).

## Scope

`ontology_concepts.description`, both:
- Add-concept form textarea ([ontology/index.ejs:48](../../src/views/seu/sdk/ontology/index.ejs#L48)) — gets the toolbar.
- Concept list view-mode cell ([ontology/index.ejs:77](../../src/views/seu/sdk/ontology/index.ejs#L77)) — renders through `renderMarkdown`.

Not in scope: any other free-text field outside the Ontology page (already covered by CR-077's own scope table, or not yet raised).

## Built 2026-09-11

`_markdownEditorField.ejs`'s toolbar/textarea markup and `public/js/markdownEditor.js`'s delegated behaviour are both name/DOM-generic already (keyed off `.md-editor-field`/`.md-editor-textarea`/`.md-toolbar` classes, not any Pack-contribution-specific structure), so both were reused directly with no changes to their mechanism:

- `ontology/index.ejs`'s add-concept `description` textarea now includes `_markdownEditorField` instead of a plain `<textarea>`. Added an optional `placeholder` local to that partial (defaults to none via `locals.placeholder ?? ''`) so Ontology's example hint text ("e.g. Template for creating software...") survived the swap — the three pre-existing callers (`_referentialListGroup.ejs`) pass none and are unaffected.
- `routes/seu/web/ontology.ts`'s `GET /sdk/ontology` handler imports `renderMarkdown` (`domain/sdk/markdownRender.ts`) and threads it as `req.vm.opt.renderMarkdown`, same convention as `sdkAuthoring.ts`'s own threading of the same function.
- `ontology/index.ejs`'s view-mode description cell calls `renderMarkdown(c.description)` via `<%-` (raw) instead of `<%=` (escaped) — safe because `renderMarkdown`'s `sanitize-html` allow-list runs unconditionally on every call.
- `ontology/index.ejs` loads `public/js/markdownEditor.js` at the bottom of the page (same script tag as `authoring/edit.ejs`) — the delegated `document`-level click handler needed no per-page registration.

No schema/DB change, confirming the CR's own prediction — `description` was already a plain TEXT column (migration 056) with render-on-read the only thing that changed. `npx tsc --noEmit` clean after the route change.

## Follow-up 2026-09-11 — View button + modal

Owner: the rendered description sitting inline in the Label column "will become cumbersome when more markdown text is added." Replaced the inline `<div>` under the label with a small "View" link-button (only rendered when `c.description` is set); clicking it opens a single shared Bootstrap modal (`#descriptionModal`, `ontology/index.ejs`) refilled per row via Bootstrap's `relatedTarget`/`show.bs.modal` pattern — no per-row modal markup, one instance reused for every row. The button carries the already-rendered, already-sanitized `renderMarkdown(c.description)` output in a `data-description` attribute (EJS's default `<%=` escaping makes this safe to embed in a double-quoted attribute — `"`/`'`/`<`/`>`/`&` all get entity-encoded, and the browser decodes them back on `getAttribute`, same string `sanitize-html` produced). A small inline script on the page (not a new `public/js/*.js` file — single-page, page-specific wiring) reads `data-code`/`data-label`/`data-description` off `event.relatedTarget` and sets the modal's title/body on open. No change to `renderMarkdown` or the editor toolbar.
