// CR-077 — renders a Pack contribution's markdown-formatted field (Checklist/
// Quality Gate/Review Gate/Obligation Definition's own statement/prompt —
// x-format:"markdown" on the schema, see formGenerator.ts) to safe HTML for
// view mode. Two-step, always both steps: marked parses markdown to HTML,
// sanitize-html strips it to an allow-list before it ever reaches a browser.
// Sanitization is not optional — a Pack is authored by any actor holding the
// relevant pack_* badge and viewed by every other viewer, so unsanitized
// markdown-to-HTML here is a stored-XSS surface across tenants.
//
// Tables and images are deliberately not in the allow-list (owner: keep them
// out of scope) — markdown table/image syntax renders as inert text, not a
// supported feature. Live preview while typing is CR-078, deferred; this
// function is only ever called on saved content (render-on-read).
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = ["p", "br", "strong", "em", "ul", "ol", "li", "blockquote", "code", "pre", "a", "h1", "h2", "h3", "h4", "h5", "h6", "hr"];

export function renderMarkdown(raw: string): string {
  if (!raw) return "";
  const html = marked.parse(raw, { async: false });
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { a: ["href"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: { a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }) },
  });
}
