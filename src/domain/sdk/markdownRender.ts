import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = ["p", "br", "strong", "em", "ul", "ol", "li", "blockquote", "code", "pre", "a", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "span"];

export function renderMarkdown(raw: string): string {
  if (!raw) return "";
  const html = marked.parse(raw, { async: false });
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { a: ["href", "rel", "target"], span: ["style"] },
    // A span may only set a text colour: a name, #hex or rgb().
    allowedStyles: { span: { color: [/^[a-z]+$/i, /^#[0-9a-f]{3,8}$/i, /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\)$/i] } },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: { a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }) },
  });
}

// One line of markdown for a heading or title: the surrounding paragraph is dropped so it sits inline.
export function renderInlineMarkdown(raw: string): string {
  return renderMarkdown(raw).trim().replace(/^<p>([\s\S]*)<\/p>$/, "$1");
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
      a: ["href", "rel", "target"],
      img: ["src", "alt", "title"],
      th: ["align"],
      td: ["align"],
      input: ["type", "checked", "disabled"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: { a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }) },
  });
}
