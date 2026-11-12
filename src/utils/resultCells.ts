import type { ResultLink } from "../routes/seu/web/conflictResultLinks.js";

// Helpers for a table of "what the SEU takes": a value that is an object or a list shows its first characters and a "…" that opens the whole value in place,
// and a cell that names entities shows each code as a link to its entity.
const SHORT_LENGTH = 24;

export function esc(value: unknown): string {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function jsonHtml(value: unknown): string {
  if (value === null || value === undefined) return "<code>—</code>";
  if (typeof value !== "object") return `<code>${esc(value)}</code>`;
  const full = JSON.stringify(value);
  if (full.length <= SHORT_LENGTH) return `<code>${esc(full)}</code>`;
  return `<span class="json-cell"><code class="json-short">${esc(full.slice(0, SHORT_LENGTH))}</code><a href="#" class="json-more ms-1 small" title="Show the whole value">…</a><code class="json-full d-none text-break">${esc(full)}</code></span>`;
}

export function cellHtml(value: unknown, column: string, links: ResultLink[] | undefined): string {
  const mine = (links ?? []).filter((l) => l.column === column);
  const texts = Array.isArray(value) ? value : [value];
  if (mine.length === 0 || !texts.every((t) => typeof t === "string")) return jsonHtml(value);
  return texts.map((t) => {
    const link = mine.find((l) => l.match === t);
    return link ? `<a href="${esc(link.href)}" target="_blank" rel="noopener">${esc(t)}</a>` : esc(t);
  }).join(", ");
}

export function linksHtml(links: ResultLink[] | undefined): string {
  return (links ?? []).map((l) => `<a class="d-block small" href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join("");
}

// The columns of a table: the fixed order first, for the columns the rows have, then any other column.
export function orderedColumns(rows: Array<Record<string, unknown>>, order: string[]): string[] {
  const present: string[] = [];
  for (const row of rows) for (const key of Object.keys(row)) if (!present.includes(key)) present.push(key);
  return [...order.filter((key) => present.includes(key)), ...present.filter((key) => !order.includes(key))];
}

// The helpers as one object, for a route to hand to a view.
export const resultCells = { esc, jsonHtml, cellHtml, linksHtml, orderedColumns };
