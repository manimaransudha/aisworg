// Markdown rendering and the documentation tree of the SDK (src/domain/sdk/markdownRender.ts, docsTree.ts).
//
//   - The renderers are pure: the tests pass markdown and read the HTML. What the sanitiser removes (scripts, unsafe links, styles other than a colour) is
//     checked as well as what it keeps.
//   - listDocsDir reads a folder, so the test builds a temporary one with hidden entries, folders, Markdown files in both cases and a file of another kind.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { renderMarkdown, renderInlineMarkdown, renderDocMarkdown } from "../src/domain/sdk/markdownRender.js";
import { listDocsDir, listTopLevelDocFolders, DOCS_ROOT } from "../src/domain/sdk/docsTree.js";

const temporary: string[] = [];
after(() => {
  for (const dir of temporary) fs.rmSync(dir, { recursive: true, force: true });
});

test("renderMarkdown keeps formatting and links, opens links in a new tab, and removes scripts, unsafe link targets and every style except a text colour", () => {
  assert.equal(renderMarkdown(""), "");
  assert.match(renderMarkdown("**bold** and _em_"), /<strong>bold<\/strong> and <em>em<\/em>/);

  const link = renderMarkdown("[site](https://example.test/page)");
  assert.ok(link.includes('href="https://example.test/page"') && link.includes('rel="noopener noreferrer"') && link.includes('target="_blank"'), link);
  assert.ok(!renderMarkdown("[bad](javascript:alert(1))").includes("javascript"), "an unsafe scheme is dropped");

  assert.ok(!renderMarkdown("<script>alert(1)</script>text").includes("<script"), "a script is removed");
  assert.match(renderMarkdown('a <span style="color: red">x</span>'), /<span style="color:red">x<\/span>/);
  assert.match(renderMarkdown('a <span style="color: #1a2b3c">x</span>'), /<span style="color:#1a2b3c">x<\/span>/);
  assert.match(renderMarkdown('a <span style="color: rgb(1, 2, 3)">x</span>'), /<span style="color:rgb\(1, 2, 3\)">x<\/span>/);
  assert.match(renderMarkdown('a <span style="position: absolute">x</span>'), /<span>x<\/span>/, "any other style is dropped");
  assert.ok(!renderMarkdown("![pic](https://example.test/a.png)").includes("<img"), "an image is not allowed in short text");
});

test("renderInlineMarkdown drops the paragraph around one line, so the line sits inside a heading", () => {
  assert.equal(renderInlineMarkdown("a **b** c"), "a <strong>b</strong> c");
  assert.equal(renderInlineMarkdown(""), "");
});

test("renderDocMarkdown keeps tables, images, strikethrough and task lists, and still removes scripts and unsafe links", () => {
  assert.equal(renderDocMarkdown(""), "");
  const table = renderDocMarkdown("| a | b |\n|---|:-:|\n| 1 | 2 |");
  assert.ok(table.includes("<table>") && table.includes("<th>a</th>") && /<th align="center">b<\/th>/.test(table) && table.includes("<td>1</td>"), table);
  const image = renderDocMarkdown('![alt text](https://example.test/p.png "title")');
  assert.ok(image.includes('src="https://example.test/p.png"') && image.includes('alt="alt text"') && image.includes('title="title"'), image);
  assert.ok(renderDocMarkdown("~~gone~~").includes("<del>gone</del>"));
  const tasks = renderDocMarkdown("- [x] done\n- [ ] open");
  assert.ok(/<input[^>]*type="checkbox"/.test(tasks) && /checked/.test(tasks) && /disabled/.test(tasks), tasks);
  const link = renderDocMarkdown("[site](https://example.test)");
  assert.ok(link.includes('rel="noopener noreferrer"') && link.includes('target="_blank"'), link);
  assert.ok(!renderDocMarkdown("<script>alert(1)</script>").includes("<script"));
  assert.ok(!renderDocMarkdown("[bad](javascript:alert(1))").includes("javascript"));
});

test("listDocsDir lists the folders and the Markdown files of a folder, by name, without hidden entries and files of other kinds", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "docs-tree-"));
  temporary.push(dir);
  for (const folder of ["zeta", "alpha", ".git"]) fs.mkdirSync(path.join(dir, folder));
  for (const file of [".hidden.md", "B.MD", "a.md", "c.txt"]) fs.writeFileSync(path.join(dir, file), "x");

  assert.deepEqual(listDocsDir(dir, ""), {
    folders: [{ name: "alpha", path: "alpha" }, { name: "zeta", path: "zeta" }],
    files: [{ name: "a", path: "a.md" }, { name: "B", path: "B.MD" }],
  });
  assert.deepEqual(listDocsDir(dir, "guide/part").files.map((f) => f.path), ["guide/part/a.md", "guide/part/B.MD"], "paths are relative to the folder given");
});

test("the top level of the documentation tree is the folders of src/docs", () => {
  assert.ok(DOCS_ROOT.endsWith(path.join("src", "docs")));
  const folders = listTopLevelDocFolders();
  assert.ok(folders.length > 0);
  assert.ok(folders.some((f) => f.name === "implementation" && f.path === "implementation"));
});
