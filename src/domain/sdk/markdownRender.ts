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

const DOC_ALLOWED_TAGS = [...ALLOWED_TAGS, "table", "thead", "tbody", "tr", "th", "td", "img", "del", "input"];

// Full-document rendering (chapter/spec files under src/docs) needs tables and
// images that the inline-text renderMarkdown() above deliberately excludes.
export function renderDocMarkdown(raw: string): string {
  if (!raw) return "";
  const html = marked.parse(raw, { async: false, gfm: true });
  return sanitizeHtml(html, {
    allowedTags: DOC_ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href"],
      img: ["src", "alt", "title"],
      th: ["align"],
      td: ["align"],
      input: ["type", "checked", "disabled"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: { a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }) },
  });
}
