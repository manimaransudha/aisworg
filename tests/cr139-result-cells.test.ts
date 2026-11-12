// CR-139: the helpers that draw "What the SEU takes" on the Resolve Conflicts and View EBM pages, the column and link maps, and the links built for a row.
// Nothing is read from the database: the rows used name entities by id, or name no code at all.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";

import { resultCells } from "../src/utils/resultCells.js";
import { resolveResultLinks } from "../src/routes/seu/web/conflictResultLinks.js";
import { CONFLICT_ENTITY_PAGES, CONFLICT_RESULT_COLUMNS, CONFLICT_RESULT_LINK_COLUMNS, CONFLICT_TABLE_LABELS, CONFLICT_KINDS_SHOWN_AS_COMPARISON, CONFLICT_ACTION_BY_KIND, CONFLICT_TABLES_SHOWN_AS_TABLE } from "../src/dblayer/constants.js";

const { esc, jsonHtml, cellHtml, linksHtml, orderedColumns } = resultCells;

test("a short value is shown whole, and a long object or list shows its first characters and a \"…\" that holds the whole value", () => {
  assert.equal(jsonHtml({}), "<code>{}</code>");
  assert.equal(jsonHtml("x"), "<code>x</code>");
  assert.equal(jsonHtml(null), "<code>—</code>");
  const long = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 };
  const html = jsonHtml(long);
  assert.ok(html.includes('class="json-more'), "the \"…\" is there");
  assert.ok(html.includes(esc(JSON.stringify(long))), "the whole value is held, hidden");
  assert.ok(!html.includes(esc(JSON.stringify(long).slice(0, 25)) + "</code><a"), "the short part has no more than 24 characters");
});

test("the values are escaped", () => {
  assert.equal(esc('<a href="x">&</a>'), "&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
  assert.ok(!jsonHtml({ k: "<script>alert(1)</script>", more: "x".repeat(40) }).includes("<script>"));
});

test("a cell that names entities shows each code as its own link, and a code with no link as text", () => {
  const links = [{ label: "Pack p1", href: "/p/1", column: "packs", match: "p1" }, { label: "Pack p2", href: "/p/2", column: "packs", match: "p2" }];
  assert.equal(cellHtml(["p1", "p2"], "packs", links), '<a href="/p/1" target="_blank" rel="noopener">p1</a>, <a href="/p/2" target="_blank" rel="noopener">p2</a>');
  assert.equal(cellHtml(["p1", "p3"], "packs", links), '<a href="/p/1" target="_blank" rel="noopener">p1</a>, p3');
  assert.equal(cellHtml("x", "other", links), "<code>x</code>", "a column with no link is drawn as a value");
  assert.equal(cellHtml({ a: 1 }, "packs", links), jsonHtml({ a: 1 }), "an object is drawn as JSON");
});

test("the links of a row are listed one under the other, each opening in a new tab", () => {
  const html = linksHtml([{ label: "Pack p1", href: "/p/1", column: "packs", match: "p1" }, { label: "Service s", href: "/s/2", column: "service", match: "s" }]);
  assert.equal((html.match(/target="_blank"/g) ?? []).length, 2);
  assert.equal(linksHtml(undefined), "");
});

test("the columns follow the fixed order, whatever order the rows hold them in, and a column that is not in the order comes last", () => {
  const rows = [{ levels: {}, service: "s", name: "n", deliverable: "d", extra: 1 }];
  assert.deepEqual(orderedColumns(rows, CONFLICT_RESULT_COLUMNS.services), ["deliverable", "name", "service", "levels", "extra"]);
  assert.deepEqual(orderedColumns([{ name: "n" }], CONFLICT_RESULT_COLUMNS.services), ["name"], "a column no row has is not shown");
});

test("every table of the screen has its columns, and every linked column is one of them", () => {
  for (const table of Object.keys(CONFLICT_TABLE_LABELS)) assert.ok(CONFLICT_RESULT_COLUMNS[table], `no columns for ${table}`);
  for (const [table, columns] of Object.entries(CONFLICT_RESULT_LINK_COLUMNS)) {
    for (const [column, entity] of Object.entries(columns)) {
      assert.ok(CONFLICT_RESULT_COLUMNS[table]?.includes(column), `${table}.${column} is not a column`);
      if (!["packId", "definitionPacks", "sourceLabels"].includes(entity)) assert.ok(CONFLICT_ENTITY_PAGES[entity], `no page for ${entity}`);
    }
  }
});

test("the kinds shown as a comparison and the tables shown as rows are known", () => {
  for (const kind of CONFLICT_KINDS_SHOWN_AS_COMPARISON) assert.ok(kind in CONFLICT_ACTION_BY_KIND, kind);
  for (const table of CONFLICT_TABLES_SHOWN_AS_TABLE) assert.ok(table in CONFLICT_TABLE_LABELS, table);
});

test("a row's links: a Pack named by id, and the Packs behind each Obligation definition, one link each", async () => {
  const [dependency] = await resolveResultLinks("dependencies", [{ id: "id-a", code: "a", version: "1", direct: true }], "tenant");
  assert.deepEqual(dependency, [{ label: "Pack a", href: `${CONFLICT_ENTITY_PAGES.pack.path}/id-a`, column: "id", match: "id-a" }]);

  const [obligation] = await resolveResultLinks("obligationDefinitions", [{ deliverable: "", step: "s", definitions: [{ fields: {}, packs: [{ id: "id-a", code: "a" }, { id: "id-b", code: "b" }] }, { fields: {}, packs: [{ id: "id-a", code: "a" }] }] }], "tenant");
  assert.deepEqual(obligation.map((l) => l.label), ["Pack a", "Pack b"], "a Pack named twice is one link");
});

test("a row that names nothing has no links, and a competency source with an unknown first word has none", async () => {
  assert.deepEqual(await resolveResultLinks("authorityRules", [{ step: "s", roles: ["lead"], packs: [] }], "tenant"), [[]]);
  assert.deepEqual(await resolveResultLinks("competencies", [{ dimension: "Role", value: "x", sources: ["Somewhere y"] }], "tenant"), [[]]);
});
