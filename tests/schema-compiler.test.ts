// Schema Compiler (src/domain/sdk/schemaCompiler.ts): an authored widget tree becomes a JSON schema and the other way round, a posted form becomes a
// widget tree, and two versions of a schema are compared for compatibility.
//
//   - The functions are pure, so the tests build the widgets, schemas and form bodies by hand.
//   - The widget tests cover each widget kind once at the top of a document and once inside a list or object, because a widget is written differently in
//     the two places.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  blankDocument, blankWidget, widgetTreeToJsonSchema, jsonSchemaToWidgetTree, parseAuthoredDocumentFromBody, diffSchemaVersions,
  type AuthoredWidget, type WidgetKind,
} from "../src/domain/sdk/schemaCompiler.js";
import type { JsonSchemaDocument, JsonSchemaProperty } from "../src/domain/sdk/formGenerator.js";

const widget = (kind: WidgetKind, fields: Partial<AuthoredWidget>): AuthoredWidget => ({ ...blankWidget(kind), ...fields });

test("a blank document has the metadata group and no widgets, and compiles to an empty object schema", () => {
  assert.deepEqual(blankDocument(), { groups: [{ key: "metadata", label: "Identity & Metadata" }], notes: [], widgets: [] });
  assert.deepEqual(widgetTreeToJsonSchema(blankDocument()), { type: "object", required: [], properties: {}, "x-groups": [{ key: "metadata", label: "Identity & Metadata" }] });
});

const topLevel: AuthoredWidget[] = [
  widget("text", {
    name: "title", required: true, help: " Help ", showWhen: "mode", showWhenValues: "a, b", group: "g1", configurable: true, readOnly: true,
    notes: [{ date: "2026-01-01", note: "n" }, { date: " ", note: " " }], pattern: "^x", minLength: "2", defaultValue: "d", markdown: true, ontology: true,
    referentialSource: "rs", ontologyComposable: true,
  }),
  widget("text", { name: "size", numeric: true, defaultValue: "5", minLength: "3" }),
  widget("textarea", { name: "body" }),
  widget("version", { name: "ver", pattern: "^1" }),
  widget("select", { name: "mode", enumValues: "a, b", defaultValue: " a " }),
  widget("referential", {
    name: "ref", drivenMode: "by-suffix", driverField: " kind ", driverSuffix: " -x ", referentialSource: "src", ontology: true, ontologyComposable: true, pattern: "p", minLength: "1",
  }),
  widget("referential-multi", {
    name: "refs", drivenMode: "by-value", driverField: " k ",
    variants: [
      { matchValue: " ", source: " d ", ontology: true, composable: true },
      { matchValue: "v1", source: "s1", ontology: false, composable: false },
      { matchValue: "v2", source: "s2", ontology: true, composable: true },
    ],
  }),
  widget("json", { name: "blob", jsonIsArray: true, rawItems: { type: "string" } }),
  widget("json", { name: "obj" }),
  widget("text", { name: "  " }),
];

test("each top-level widget compiles to the schema property of its kind, and the document adds its required list, order, groups and notes", () => {
  const schema = widgetTreeToJsonSchema({
    groups: [{ key: " g1 ", label: " Group One " }, { key: "g2", label: " " }, { key: " ", label: "dropped" }],
    notes: [{ date: "2026-01-01", note: "n" }, { date: " ", note: " " }],
    widgets: topLevel,
  });
  assert.deepEqual(schema.required, ["title"]);
  assert.deepEqual(schema["x-property-order"], ["title", "size", "body", "ver", "mode", "ref", "refs", "blob", "obj"]);
  assert.deepEqual(schema["x-groups"], [{ key: "g1", label: "Group One" }, { key: "g2", label: "g2" }]);
  assert.deepEqual(schema["x-schema-notes"], [{ date: "2026-01-01", note: "n" }]);

  const p = schema.properties!;
  assert.deepEqual(p.title, {
    type: "string", pattern: "^x", minLength: 2, default: "d", "x-format": "markdown", "x-ontology": true, "x-referential-source": "rs", "x-ontology-composable": true,
    "x-help": "Help", "x-show-when": "mode", "x-show-when-values": ["a", "b"], "x-group": "g1", "x-schema-notes": [{ date: "2026-01-01", note: "n" }],
    "x-configurable": true, "x-read-only": true,
  });
  assert.deepEqual(p.size, { type: "number", default: 5 }, "a number takes no minimum length");
  assert.deepEqual(p.body, { type: "string", "x-widget": "textarea" });
  assert.deepEqual(p.ver, { type: "string", "x-widget": "version", pattern: "^1" });
  assert.deepEqual(p.mode, { type: "string", enum: ["a", "b"], default: "a" });
  assert.deepEqual(p.ref, {
    type: "string", "x-widget": "referential-select", pattern: "p", minLength: 1, "x-ontology": true, "x-referential-source-by": "kind", "x-referential-source-suffix": "-x",
    "x-referential-source": "src", "x-ontology-composable": true,
  });
  assert.deepEqual(p.refs, {
    type: "array", items: { type: "string" }, "x-widget": "referential-multi-select",
    "x-referential-source-by-value": {
      field: "k", values: { v1: { source: "s1", ontology: false }, v2: { source: "s2", ontology: true, composable: true } }, default: { source: "d", ontology: true, composable: true },
    },
  });
  assert.deepEqual(p.blob, { type: "array", "x-widget": "json", items: { type: "string" } });
  assert.deepEqual(p.obj, { type: "object", "x-widget": "json" });
});

const rowChildren: AuthoredWidget[] = [
  widget("text", { name: "name", required: true, label: " Name ", help: "h", group: "ignored in a row" }),
  widget("select", { name: "pick", enumValues: "a,b" }),
  widget("boolean", { name: "flag", defaultValue: "true" }),
  widget("boolean", { name: "off", defaultValue: "false" }),
  widget("boolean", { name: "plain", defaultValue: "" }),
  widget("generated", { name: "id" }),
  widget("referential", { name: "derivedRef", referentialSource: "derived:abc" }),
  widget("referential-multi", { name: "multiRef", referentialSource: "plain", ontology: true, ontologyComposable: true }),
  widget("referential", { name: "bare" }),
  widget("referential-dynamic", { name: "dyn", driverField: " kind ", driverSuffix: " -s ", ontology: true }),
  widget("referential-dynamic", { name: "dynBare" }),
  widget("referential-by-scope", {
    name: "scoped", driverField: "f",
    variants: [{ matchValue: "", source: "d", ontology: false, composable: false }, { matchValue: "x", source: "sx", ontology: true, composable: false }],
  }),
  widget("json", { name: "blob", jsonIsArray: true }),
  widget("list", { name: "inner", listWidgetMarker: true, children: [widget("text", { name: "leaf" })] }),
  widget("list", { name: "innerPlain", listWidgetMarker: false, children: [widget("text", { name: "leaf" })] }),
  widget("object", { name: "obj", children: [widget("text", { name: "a", required: true }), widget("text", { name: "b" }), widget("text", { name: " " })] }),
];

function compileRows(): JsonSchemaProperty {
  const schema = widgetTreeToJsonSchema({ groups: [], notes: [], widgets: [widget("list", { name: "rows", referentialSource: "rows-src", children: [...rowChildren, widget("text", { name: "" })] })] });
  return schema.properties!.rows;
}

test("the widgets of a list compile to item properties of their kind, without a group, and the list adds its required fields and order", () => {
  const rows = compileRows();
  assert.deepEqual([rows.type, rows["x-widget"], rows["x-referential-source"]], ["array", "referential-list", "rows-src"]);
  assert.deepEqual(rows.items!.required, ["name"]);
  assert.deepEqual(rows.items!["x-property-order"], rowChildren.map((c) => c.name));

  const p = rows.items!.properties!;
  assert.deepEqual(p.name, { type: "string", "x-label": "Name", "x-help": "h" });
  assert.deepEqual(p.pick, { type: "string", enum: ["a", "b"] });
  assert.deepEqual([p.flag, p.off, p.plain], [{ type: "boolean", default: true }, { type: "boolean", default: false }, { type: "boolean" }]);
  assert.deepEqual(p.id, { type: "string", "x-generated": true });
  assert.deepEqual(p.derivedRef, { type: "string", "x-referential-source-derived-by": "abc" });
  assert.deepEqual(p.multiRef, { type: "array", "x-referential": "plain", "x-multi": true, "x-ontology": true, "x-ontology-composable": true });
  assert.deepEqual(p.bare, { type: "string" });
  assert.deepEqual(p.dyn, { type: "string", "x-referential-source-by": "kind", "x-referential-source-suffix": "-s", "x-ontology": true });
  assert.deepEqual(p.dynBare, { type: "string", "x-referential-source-suffix": "" });
  assert.deepEqual(p.scoped, { type: "string", "x-referential-source-by-value": { field: "f", values: { x: { source: "sx", ontology: true } }, default: { source: "d", ontology: false } } });
  assert.deepEqual(p.blob, { type: "array", "x-widget": "json" });
  assert.deepEqual(p.inner, { type: "array", items: { type: "object", properties: { leaf: { type: "string" } }, "x-property-order": ["leaf"] }, "x-widget": "referential-list" });
  assert.equal(p.innerPlain["x-widget"], undefined, "a nested list is a plain array unless it carries the list marker");
  assert.deepEqual(p.obj, { type: "object", properties: { a: { type: "string" }, b: { type: "string" } }, required: ["a"], "x-property-order": ["a", "b"] });
});

test("a compiled schema reads back as widgets of the same kinds, with the fields each kind keeps", () => {
  const schema = widgetTreeToJsonSchema({ groups: [{ key: "g1", label: "G" }], notes: [{ date: "d", note: "n" }], widgets: [...topLevel, widget("list", { name: "rows", referentialSource: "rows-src", children: rowChildren })] });
  const tree = jsonSchemaToWidgetTree(schema);
  assert.deepEqual(tree.groups, [{ key: "g1", label: "G" }]);
  assert.deepEqual(tree.notes, [{ date: "d", note: "n" }]);
  const top = new Map(tree.widgets.map((w) => [w.name, w]));
  assert.deepEqual(tree.widgets.map((w) => w.name), ["title", "size", "body", "ver", "mode", "ref", "refs", "blob", "obj", "rows"], "the order the schema names");

  const title = top.get("title")!;
  assert.deepEqual([title.kind, title.required, title.help, title.group, title.pattern, title.minLength, title.defaultValue, title.markdown, title.ontology, title.ontologyComposable, title.referentialSource, title.configurable, title.readOnly],
    ["text", true, "Help", "g1", "^x", "2", "d", true, true, true, "rs", true, true]);
  assert.deepEqual([top.get("size")!.kind, top.get("size")!.numeric, top.get("size")!.defaultValue], ["text", true, "5"]);
  assert.equal(top.get("body")!.kind, "textarea");
  assert.deepEqual([top.get("ver")!.kind, top.get("ver")!.pattern], ["version", "^1"]);
  assert.deepEqual([top.get("mode")!.kind, top.get("mode")!.enumValues, top.get("mode")!.defaultValue], ["select", "a, b", "a"]);
  const ref = top.get("ref")!;
  assert.deepEqual([ref.kind, ref.drivenMode, ref.driverField, ref.driverSuffix, ref.referentialSource, ref.ontology, ref.ontologyComposable, ref.pattern, ref.minLength], ["referential", "by-suffix", "kind", "-x", "src", true, true, "p", "1"]);
  const refs = top.get("refs")!;
  assert.deepEqual([refs.kind, refs.drivenMode, refs.driverField], ["referential-multi", "by-value", "k"]);
  assert.deepEqual(refs.variants, [
    { matchValue: "", source: "d", ontology: true, composable: true },
    { matchValue: "v1", source: "s1", ontology: false, composable: false },
    { matchValue: "v2", source: "s2", ontology: true, composable: true },
  ]);
  assert.deepEqual([top.get("blob")!.kind, top.get("blob")!.jsonIsArray, top.get("blob")!.rawItems], ["json", true, { type: "string" }]);
  assert.deepEqual([top.get("obj")!.kind, top.get("obj")!.jsonIsArray], ["json", false]);

  const rows = top.get("rows")!;
  assert.deepEqual([rows.kind, rows.listWidgetMarker, rows.referentialSource], ["list", true, "rows-src"]);
  const child = new Map(rows.children.map((c) => [c.name, c]));
  assert.deepEqual(rows.children.map((c) => c.name), rowChildren.map((c) => c.name), "the order the list names");
  assert.deepEqual([child.get("name")!.kind, child.get("name")!.label, child.get("name")!.required], ["text", "Name", true]);
  assert.deepEqual([child.get("pick")!.kind, child.get("pick")!.enumValues], ["select", "a, b"]);
  assert.deepEqual([child.get("flag")!.defaultValue, child.get("off")!.defaultValue, child.get("plain")!.defaultValue], ["true", "false", ""]);
  assert.equal(child.get("flag")!.kind, "boolean");
  assert.equal(child.get("id")!.kind, "generated");
  assert.deepEqual([child.get("derivedRef")!.kind, child.get("derivedRef")!.referentialSource], ["referential", "derived:abc"]);
  const multiRef = child.get("multiRef")!;
  assert.deepEqual([multiRef.kind, multiRef.referentialSource, multiRef.ontology, multiRef.ontologyComposable], ["referential-multi", "plain", true, true]);
  const dyn = child.get("dyn")!;
  assert.deepEqual([dyn.kind, dyn.driverField, dyn.driverSuffix, dyn.ontology], ["referential-dynamic", "kind", "-s", true]);
  const scoped = child.get("scoped")!;
  assert.deepEqual([scoped.kind, scoped.driverField, scoped.variants.map((v) => v.matchValue)], ["referential-by-scope", "f", ["", "x"]]);
  assert.deepEqual([child.get("blob")!.kind, child.get("blob")!.jsonIsArray], ["json", true]);
  assert.deepEqual([child.get("inner")!.kind, child.get("inner")!.listWidgetMarker, child.get("inner")!.children.map((c) => c.name)], ["list", true, ["leaf"]]);
  assert.deepEqual([child.get("innerPlain")!.kind, child.get("innerPlain")!.listWidgetMarker], ["list", false]);
  assert.deepEqual([child.get("obj")!.kind, child.get("obj")!.children.map((c) => [c.name, c.required])], ["object", [["a", true], ["b", false]]]);
});

test("the properties of a schema that names an order are read in that order, and the others follow in their own order", () => {
  const schema = { type: "object", properties: { b: { type: "string" }, a: { type: "string" }, c: { type: "string" } }, "x-property-order": ["c"] } as JsonSchemaDocument;
  assert.deepEqual(jsonSchemaToWidgetTree(schema).widgets.map((w) => w.name), ["c", "b", "a"]);
  assert.deepEqual(jsonSchemaToWidgetTree({ type: "object" }), { groups: [], notes: [], widgets: [] });

  const list = { type: "object", properties: { rows: { type: "array", "x-widget": "referential-list", items: { type: "object", properties: { b: { type: "string" }, a: { type: "string" }, c: { type: "string" } }, "x-property-order": ["c"] } } } } as JsonSchemaDocument;
  assert.deepEqual(jsonSchemaToWidgetTree(list).widgets[0].children.map((w) => w.name), ["c", "b", "a"]);
  const object = { type: "object", properties: { rows: { type: "array", "x-widget": "referential-list", items: { type: "object", properties: { o: { type: "object", properties: { y: { type: "string" }, x: { type: "string" } }, "x-property-order": ["x"] } } } } } } as JsonSchemaDocument;
  assert.deepEqual(jsonSchemaToWidgetTree(object).widgets[0].children[0].children.map((w) => w.name), ["x", "y"]);
});

test("a posted form becomes a widget tree: lists may be arrays or numbered objects, a kind it does not know is text, and the blanks and unnamed widgets are dropped", () => {
  const doc = parseAuthoredDocumentFromBody({
    groups: { 0: { key: " a ", label: " A " }, 1: { key: " ", label: "dropped" }, x: { key: "ignored" } },
    notes: [{ date: "d", note: "" }, { date: " ", note: " " }],
    widgets: {
      0: {
        kind: "referential-multi", name: " nm ", required: "on", configurable: "true", readOnly: true, help: "h", numeric: "on", drivenMode: "by-value", driverField: "k",
        rawItemsJson: '{"type":"string"}', rawType: "array", listWidgetMarker: "1", markdown: "on", ontology: "on", ontologyComposable: "on",
        notes: { 0: { date: "d1", note: "n1" }, 1: { date: "", note: "" } },
        variants: [{ matchValue: "v", source: "s", ontology: "on", composable: "" }],
        children: [{ kind: "text", name: "child" }, { kind: "text", name: " " }],
      },
      1: { kind: "no-such-kind", name: "unknown", drivenMode: "other", rawItemsJson: "{not json" },
      2: { kind: "select", name: "pick", defaultValue: "ignored", selectDefault: "chosen" },
      3: { kind: "boolean", name: "flag", defaultValue: "ignored", booleanDefault: "true" },
      4: { kind: "text", name: " " },
    },
  });
  assert.deepEqual(doc.groups, [{ key: "a", label: "A" }]);
  assert.deepEqual(doc.notes, [{ date: "d", note: "" }]);
  assert.deepEqual(doc.widgets.map((w) => w.name), ["nm", "unknown", "pick", "flag"]);

  const [first, unknown, pick, flag] = doc.widgets;
  assert.deepEqual([first.kind, first.required, first.configurable, first.readOnly, first.numeric, first.drivenMode, first.rawItems, first.rawType, first.listWidgetMarker, first.markdown, first.ontology, first.ontologyComposable],
    ["referential-multi", true, true, true, true, "by-value", { type: "string" }, "array", true, true, true, true]);
  assert.deepEqual(first.notes, [{ date: "d1", note: "n1" }]);
  assert.deepEqual(first.variants, [{ matchValue: "v", source: "s", ontology: true, composable: false }]);
  assert.deepEqual(first.children.map((c) => c.name), ["child"]);
  assert.deepEqual([unknown.kind, unknown.drivenMode, unknown.rawItems], ["text", "", undefined], "a body that is not JSON leaves no items");
  assert.equal(pick.defaultValue, "chosen");
  assert.equal(flag.defaultValue, "true");

  assert.deepEqual(parseAuthoredDocumentFromBody({}), { groups: [], notes: [], widgets: [] }, "a body with none of the lists");
  assert.deepEqual(parseAuthoredDocumentFromBody({ groups: "not a list" }).groups, []);
});

const compare = (oldProps: Record<string, JsonSchemaProperty>, newProps: Record<string, JsonSchemaProperty>, oldRequired: string[] = [], newRequired: string[] = []) =>
  diffSchemaVersions({ properties: oldProps, required: oldRequired }, { properties: newProps, required: newRequired });

test("two versions of a schema are compared property by property, and only a removed property, a changed type or a newly required property without a default is breaking", () => {
  const same = compare({ a: { type: "string" } }, { a: { type: "string" } });
  assert.deepEqual(same, { compatible: true, differences: [] });
  assert.deepEqual(diffSchemaVersions({}, {}), { compatible: true, differences: [] });

  const result = compare(
    { gone: { type: "string" }, t: { type: "string" }, r1: { type: "string" }, r2: { type: "string" }, o1: { type: "string" }, e: { type: "string", enum: ["x", "y"] }, p: { type: "string", pattern: "a" }, d: { type: "string", default: "1" }, sameEnum: { type: "string", enum: ["x", "y"] } },
    { added: { type: "string" }, t: { type: "number" }, r1: { type: "string" }, r2: { type: "string", default: "d" }, o1: { type: "string" }, e: { type: "string", enum: ["x", "z"] }, p: { type: "string", pattern: "b" }, d: { type: "string", default: "2" }, sameEnum: { type: "string", enum: ["y", "x"] }, addedRequired: { type: "string" }, addedDefault: { type: "string", default: "d" } },
    ["o1"],
    ["r1", "r2", "addedRequired", "addedDefault"]
  );
  const kinds = Object.fromEntries(result.differences.map((d) => [`${d.path}:${d.kind}`, d.breaking]));
  assert.deepEqual(kinds, {
    "gone:removed": true,
    "added:added": false,
    "t:type-changed": true,
    "r1:newly-required": true,
    "r2:default-changed": false,
    "o1:now-optional": false,
    "e:enum-changed": false,
    "p:pattern-changed": false,
    "d:default-changed": false,
    "addedRequired:added": true,
    "addedDefault:added": false,
  });
  assert.equal(result.compatible, false);

  const harmless = compare({ o: { type: "string" }, e: { type: "string", enum: ["x"] } }, { o: { type: "string" }, e: { type: "string", enum: ["x", "y"] }, extra: { type: "string" } }, ["o"], []);
  assert.equal(harmless.compatible, true, "an added choice, an optional property and a property that is no longer required keep the schema compatible");
});

test("the properties inside an object and inside the items of a list are compared with their own required lists, under a path that names them", () => {
  const result = compare(
    { obj: { type: "object", properties: { keep: { type: "string" }, gone: { type: "string" } } }, list: { type: "array", items: { properties: { field: { type: "string" } }, required: [] } } },
    { obj: { type: "object", properties: { keep: { type: "string" } } }, list: { type: "array", items: { properties: { field: { type: "string" }, extra: { type: "string" } }, required: ["extra"] } } }
  );
  const kinds = Object.fromEntries(result.differences.map((d) => [`${d.path}:${d.kind}`, d.breaking]));
  assert.deepEqual(kinds, { "obj.gone:removed": true, "list[].extra:added": true });
  assert.equal(result.compatible, false);
});
