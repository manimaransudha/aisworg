# CR-078 — Markdown live preview (deferred)

**Raised:** 2026-08-29 · **Origin:** split out of CR-077 (Markdown-formatted `statement`/`prompt` fields) — owner: "Save to see for now. Open a CR for live preview and defer it." · **Status:** 🔵 **Deferred — not built, no target.**

## The gap

CR-077 gives `statement`/`prompt` fields a markdown-formatting toolbar in edit mode, but no way to see the rendered result without saving the Draft and reopening it in view mode. For a short claim ("No hardcoded passwords") that round trip is fine; for a longer statement with a fenced code block it's a real gap — an author can't tell whether the fence, indentation, or escaping came out right until after saving.

## Open question (not resolved)

Two ways to get a live preview, neither designed yet:

- **Server round trip** — a small endpoint that runs the textarea's current content through the same `renderMarkdown` (`domain/sdk/markdownRender.ts`, CR-077) pipeline used for view mode, called on a "Preview" toggle or on-type (debounced). Consistent output with the saved view (one parser, one allow-list), at the cost of a request per preview.
- **Client-side render** — ship a markdown parser to the browser and render in-page with no round trip. Faster, but a second parser (and a second sanitization pass, or the same "trust the server render only" caveat) to keep in sync with the server's own `marked`+`sanitize-html` behaviour, and a new client-side dependency this codebase doesn't currently ship (no bundler/build step for client JS today — `public/js/*.js` is loaded as plain script tags).

Neither is chosen. This CR exists to hold the gap until it's picked up.

## Not in scope

Building either option. This CR exists to hold the gap, split out of CR-077 to keep that CR's scope to the toolbar + save-to-see round trip.
