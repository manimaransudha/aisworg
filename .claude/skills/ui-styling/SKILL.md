---
name: ui-styling
description: CR-083 styling and list-control rules for views and CSS in this repo — section cards, badges, border tokens, form controls, tables, and the parseListParams/paginateList/listControls/sortLink list convention. Use whenever a view under src/views or public/css/style.css is created or edited, including an unrelated edit to an existing page.
---

# UI styling

Source: `public/css/style.css`, section "Cards & Elevation Architecture" (line 152 onward). Read the classes there before writing markup.

## CR-083 styling

- A new page uses the full CR-083 styling, not only the card class.
- An edit to an existing page checks that page against CR-083 in the same pass and fixes stale Bootstrap-only styling (`card`, `border-0`, ad-hoc headers, default `.form-control` or `.table` borders). This fix is in scope and needs no separate confirmation.
- Containers: `.section-card` with `.section-header`, or `.hub-card` and `.card-tile` for tile grids.
- Pills: `.state-badge`, `.priority-badge`, `.status-pill`, `.outcome-badge`, `.scope-badge` and the others listed at `style.css:259`.
- Tokens: `--border` (`#cbd5e1`), `--border-dark` (`#94a3b8`), `--header-bg` (`#f1f5f9`).
- Form controls (`.form-control`, `.form-select`, `.form-check-input`) take the `--border-dark` border from `style.css`.
- Tables use `.table` (`style.css:624`), which sets the header background and borders.
- When a file already uses a convention, reuse that exact pattern.

## Lists

- Any list or table on the UI uses `parseListParams` and `paginateList` (`utils/listQuery.ts`) on the server, and renders with the `listControls` and `sortLink` partials. Match `ontology/index.ejs`.
- A fixed list of two to four items is not a list for this rule.
