// Form Generator (src/domain/sdk/formGenerator.ts): the field of each widget kind, the Ontology and driver lookups a schema declares, the display groups,
// the validation of content against a schema, and the reading of a posted form. tests/formGenerator.test.ts covers the generator's main cases; this file
// covers the widget kinds, branches and helpers it does not reach.
//
//   - The functions are pure, so the tests build the schemas, content and form bodies by hand.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  generateFields, ontologyConceptTypesIn, dynamicReferentialSourceFieldsIn, dynamicReferentialSourceItemFieldsIn, groupFieldsForDisplay, rowHasContent, toSchemaRows,
  validateAgainstSchema, parseFormBody, type JsonSchemaDocument, type GeneratedField, type ReferentialListItemField,
} from "../src/domain/sdk/formGenerator.js";

const schemaOf = (value: unknown) => value as JsonSchemaDocument;

const rowsSchema = {
  type: "array", "x-widget": "referential-list",
  items: {
    type: "object", required: ["name"],
    "x-property-order": ["name", "id", "inner", "obj", "blob", "scoped", "dyn", "derived", "multi", "one", "pick", "flag", "text"],
    properties: {
      text: { type: "string", "x-label": "Free text", "x-format": "markdown", "x-help": "hh", "x-show-when": "flag", "x-show-when-values": ["true"], default: "dflt" },
      name: { type: "string" },
      id: { type: "string", "x-generated": true },
      inner: { type: "array", items: { type: "object", required: ["a"], "x-property-order": ["b", "a"], properties: { a: { type: "string" }, b: { type: "string" } } } },
      obj: { type: "object", required: ["x"], "x-property-order": ["y", "x"], properties: { x: { type: "string" }, y: { type: "string" } } },
      blob: { type: "object", "x-widget": "json" },
      scoped: { type: "string", "x-referential-source-by-value": { field: "name", values: { v: { source: "sv", ontology: true } }, default: { source: "sd", ontology: false } } },
      dyn: { type: "string", "x-referential-source-by": "name", "x-referential-source-suffix": "-s" },
      derived: { type: "string", "x-referential-source-derived-by": "scope" },
      multi: { type: "array", "x-referential": "things", "x-multi": true, "x-ontology": true },
      one: { type: "string", "x-referential": "thing" },
      pick: { type: "string", enum: ["p", "q"] },
      flag: { type: "boolean" },
    },
  },
};

const schema = schemaOf({
  type: "object", required: ["title"], "x-property-order": ["title", "blob", "rows"],
  properties: {
    hidden: { type: "string", "x-read-only": true },
    title: { type: "string", "x-help": "Help", "x-show-when": "mode", "x-group": "g" },
    mode: { type: "string", enum: ["a", "b"], default: "b" },
    notes: { type: "string", "x-widget": "textarea" },
    ver: { type: "string", "x-widget": "version" },
    blob: { type: "array", "x-widget": "json" },
    obj: { type: "object", "x-widget": "json" },
    pick: { type: "string", "x-widget": "db-select", "x-referential-source": "db-src", "x-help": "from the database" },
    kind: { type: "string", "x-widget": "referential-select", "x-referential-source": "kinds", "x-ontology": true, "x-ontology-composable": true },
    sub: { type: "string", "x-widget": "referential-select", "x-referential-source-by": "kind", "x-referential-source-suffix": "-sub", "x-ontology": true, "x-ontology-composable": true },
    multi: { type: "array", "x-widget": "referential-multi-select", "x-referential-source": "ms", "x-ontology": true, "x-ontology-composable": true },
    scoped: {
      type: "array", "x-widget": "referential-multi-select",
      "x-referential-source-by-value": { field: "mode", values: { a: { source: "sa", ontology: true, composable: true } }, default: { source: "sd", ontology: false } },
    },
    rows: rowsSchema,
  },
});

const field = (fields: GeneratedField[], name: string): GeneratedField => {
  const found = fields.find((f) => f.name === name);
  assert.ok(found, `the form has a field "${name}"`);
  return found;
};

test("a form has a field for each property in the order the schema names, with the unnamed ones after, and none for a read-only property", () => {
  const fields = generateFields(schema, {});
  assert.deepEqual(fields.map((f) => f.name), ["title", "blob", "rows", "mode", "notes", "ver", "obj", "pick", "kind", "sub", "multi", "scoped"]);
  assert.deepEqual(fields.map((f) => f.kind), ["string", "json", "referential-list", "select", "textarea", "version", "json", "db-select", "referential-select", "referential-select", "referential-multi-select", "referential-multi-select"]);
  const title = field(fields, "title");
  assert.deepEqual([title.required, (title as { help?: string }).help, title.showWhen, title.group, (title as { value: string }).value], [true, "Help", "mode", "g", ""]);
});

test("a plain field takes its value from the content, then from the default of its schema", () => {
  assert.equal((field(generateFields(schema, {}), "mode") as { value: string }).value, "b");
  assert.equal((field(generateFields(schema, { mode: "a" }), "mode") as { value: string }).value, "a");
  assert.deepEqual((field(generateFields(schema, {}), "mode") as { options: string[] }).options, ["a", "b"]);
  assert.equal((field(generateFields(schema, { notes: "n", ver: "1.0.0" }), "notes") as { value: string }).value, "n");
  assert.equal((field(generateFields(schema, { ver: "1.0.0" }), "ver") as { value: string }).value, "1.0.0");
});

test("a JSON field shows the content formatted, or an empty array or object", () => {
  assert.equal((field(generateFields(schema, {}), "blob") as { value: string }).value, "[]");
  assert.equal((field(generateFields(schema, {}), "obj") as { value: string }).value, "{}");
  assert.equal((field(generateFields(schema, { blob: [1] }), "blob") as { value: string }).value, "[\n  1\n]");
});

test("a database select field names its source", () => {
  const pick = field(generateFields(schema, { pick: "chosen" }), "pick");
  assert.deepEqual([pick.kind, (pick as { dbSource: string }).dbSource, (pick as { value: string }).value, (pick as { help?: string }).help], ["db-select", "db-src", "chosen", "from the database"]);
  assert.equal((field(generateFields(schema, {}), "pick") as { value: string }).value, "");
});

test("a select field of the Ontology names a fixed source, or one built from the value of the field that drives it", () => {
  const fixed = field(generateFields(schema, {}), "kind") as Extract<GeneratedField, { kind: "referential-select" }>;
  assert.deepEqual([fixed.referentialSource, fixed.ontology, fixed.composable, fixed.dynamicSourceField], ["kinds", true, true, undefined]);

  const driven = field(generateFields(schema, { kind: "Alpha" }), "sub") as Extract<GeneratedField, { kind: "referential-select" }>;
  assert.deepEqual(
    [driven.referentialSource, driven.composable, driven.dynamicSourceField, driven.dynamicSourceSuffix, driven.dynamicSourceDriverConceptType],
    ["alpha-sub", false, "kind", "-sub", "kinds"]
  );
  assert.equal((field(generateFields(schema, {}), "sub") as { referentialSource: string }).referentialSource, "", "with no value to drive it there is no source");
});

test("a multi select keeps the text values of the content, and takes its source from the field it is driven by, or the default", () => {
  const plain = field(generateFields(schema, { multi: ["x", 1, "y"] }), "multi") as Extract<GeneratedField, { kind: "referential-multi-select" }>;
  assert.deepEqual([plain.value, plain.referentialSource, plain.ontology, plain.composable, plain.driverField, plain.variants], [["x", "y"], "ms", true, true, undefined, undefined]);

  const scoped = field(generateFields(schema, { mode: "a" }), "scoped") as Extract<GeneratedField, { kind: "referential-multi-select" }>;
  assert.deepEqual([scoped.referentialSource, scoped.ontology, scoped.composable, scoped.driverField], ["sa", true, true, "mode"]);
  assert.deepEqual(scoped.variants, [
    { matchValue: null, referentialSource: "sd", ontology: false, composable: false },
    { matchValue: "a", referentialSource: "sa", ontology: true, composable: true },
  ]);
  const fallback = field(generateFields(schema, { mode: "other" }), "scoped") as Extract<GeneratedField, { kind: "referential-multi-select" }>;
  assert.deepEqual([fallback.referentialSource, fallback.ontology, fallback.composable, fallback.value], ["sd", false, false, []]);
});

test("a list field has a row for each row of the content and one blank row, and a field for each kind of item property, in the order the schema names", () => {
  const content = { rows: [{ name: "n1", inner: [{ a: "A1", b: "B1" }], obj: { x: "X" }, blob: { k: 1 }, multi: ["m1", 2], flag: true, pick: "p" }] };
  const list = field(generateFields(schema, content), "rows") as Extract<GeneratedField, { kind: "referential-list" }>;
  assert.deepEqual(list.itemFields.map((f) => [f.name, f.kind]), [
    ["name", "string"], ["id", "generated"], ["inner", "nested-list"], ["obj", "nested-object"], ["blob", "json"], ["scoped", "referential-by-scope"], ["dyn", "referential-dynamic"],
    ["derived", "referential"], ["multi", "referential-multi"], ["one", "referential"], ["pick", "enum"], ["flag", "boolean"], ["text", "string"],
  ]);
  const item = (name: string) => list.itemFields.find((f) => f.name === name)!;
  assert.deepEqual([item("name").required, item("derived").label], [true, "Derived"]);
  assert.deepEqual([item("text").label, item("text").markdown, item("text").help, item("text").showWhen, item("text").showWhenValues], ["Free text", true, "hh", "flag", ["true"]]);
  assert.deepEqual(item("inner").nestedItemFields!.map((f) => [f.name, f.required]), [["b", false], ["a", true]], "the nested list is in the order it names");
  assert.deepEqual(item("obj").nestedItemFields!.map((f) => [f.name, f.required]), [["y", false], ["x", true]]);
  assert.deepEqual([item("dyn").driverField, item("dyn").driverSuffix, item("dyn").ontology], ["name", "-s", true]);
  assert.deepEqual([item("derived").referentialSource, item("derived").ontology], ["derived:scope", false]);
  assert.deepEqual([item("multi").referentialSource, item("multi").ontology, item("one").ontology], ["things", true, false]);
  assert.deepEqual([item("scoped").driverField, item("scoped").scopeVariants], ["name", [
    { matchValue: null, referentialSource: "sd", ontology: false },
    { matchValue: "v", referentialSource: "sv", ontology: true },
  ]]);
  assert.deepEqual(item("pick").options, ["p", "q"]);

  assert.equal(list.existingCount, 1);
  assert.equal(list.rows.length, 2);
  const [first, blank] = list.rows;
  assert.deepEqual(first, {
    name: "n1", id: "", inner: [{ b: "B1", a: "A1" }, { b: "", a: "" }], obj: { y: "", x: "X" }, blob: JSON.stringify({ k: 1 }, null, 2), scoped: "", dyn: "", derived: "",
    multi: ["m1", "2"], one: "", pick: "p", flag: "true", text: "dflt",
  });
  assert.deepEqual(blank, {
    name: "", id: "", inner: [{ b: "", a: "" }], obj: { y: "", x: "" }, blob: "{}", scoped: "", dyn: "", derived: "", multi: [], one: "", pick: "", flag: "", text: "dflt",
  });
});

test("the Ontology concept types a schema uses are those of its Ontology select fields and of the Ontology references inside its lists, at any depth", () => {
  const found = ontologyConceptTypesIn(schemaOf({
    properties: {
      a: { "x-widget": "referential-select", "x-ontology": true, "x-referential-source": " t1 " },
      b: { "x-widget": "referential-multi-select", "x-ontology": true, "x-referential-source": "t2" },
      c: { "x-widget": "referential-select", "x-ontology": false, "x-referential-source": "skipped" },
      d: { "x-widget": "referential-select", "x-ontology": true, "x-referential-source": "  " },
      e: {
        "x-widget": "referential-list",
        items: { properties: { x: { "x-referential": " t3 ", "x-ontology": true }, y: { type: "array", items: { properties: { z: { "x-referential": "t4", "x-ontology": true }, w: { "x-referential": "t5" } } } } } },
      },
      f: { "x-widget": "referential-list" },
    },
  }));
  assert.deepEqual(found, ["t1", "t2", "t3", "t4"]);
  assert.deepEqual(ontologyConceptTypesIn(schemaOf({})), []);
});

test("the fields driven by another field are those of Ontology selects, and of the items of lists whose driver is an Ontology reference", () => {
  assert.deepEqual(dynamicReferentialSourceFieldsIn(schemaOf({
    properties: {
      a: { "x-widget": "referential-select", "x-ontology": true, "x-referential-source-by": "kind", "x-referential-source-suffix": "-s" },
      b: { "x-widget": "referential-select", "x-ontology": true, "x-referential-source-by": "kind" },
      c: { "x-widget": "referential-select", "x-referential-source-by": "kind" },
      d: { "x-widget": "referential-select", "x-ontology": true },
    },
  })), [{ driverField: "kind", suffix: "-s" }, { driverField: "kind", suffix: "" }]);
  assert.deepEqual(dynamicReferentialSourceFieldsIn(schemaOf({})), []);

  assert.deepEqual(dynamicReferentialSourceItemFieldsIn(schemaOf({
    properties: {
      rows: {
        "x-widget": "referential-list",
        items: { properties: {
          driver: { "x-referential": "concepts" },
          dyn: { "x-referential-source-by": "driver", "x-referential-source-suffix": "-d" },
          orphan: { "x-referential-source-by": "missing" },
          inner: { type: "array", items: { properties: { driver2: { "x-referential": "other" }, dyn2: { "x-referential-source-by": "driver2" } } } },
        } },
      },
      plain: { type: "string" },
      emptyList: { "x-widget": "referential-list" },
    },
  })), [{ driverConceptType: "concepts", suffix: "-d" }, { driverConceptType: "other", suffix: "" }]);
});

const stringField = (name: string, group?: string): GeneratedField => ({ kind: "string", name, label: name, required: false, value: "", group });

test("fields are grouped for display: the named ones first, then the Pack sections, the parameters and the rest, which join the first group or make one", () => {
  const fields = [
    stringField("dependencies"), stringField("contributionPolicies"), stringField("contributionsServices"), stringField("contribution"), stringField("environmentConfiguration"),
    stringField("exposedParameters"), stringField("exposedParameterOverrides"), stringField("inGroup", "g2"), stringField("noGroup"), stringField("unknownGroup", "gone"),
  ];
  const grouped = groupFieldsForDisplay(schemaOf({ "x-groups": [{ key: "g1", label: "One" }, { key: "g2", label: "Two" }] }), fields);
  assert.equal(grouped.dependencies?.name, "dependencies");
  assert.deepEqual(grouped.contributions.map((c) => [c.key, c.label]), [["contributionPolicies", "Policies"], ["contributionsServices", "Services"]]);
  assert.deepEqual(grouped.configurationParameters.map((f) => f.name), ["environmentConfiguration"]);
  assert.deepEqual(grouped.exposableParameters.map((f) => f.name), ["exposedParameters"]);
  assert.deepEqual(grouped.parameterOverrides.map((f) => f.name), ["exposedParameterOverrides"]);
  assert.deepEqual(grouped.groups.map((g) => [g.key, g.fields.map((f) => f.name)]), [["g1", ["contribution", "noGroup", "unknownGroup"]], ["g2", ["inGroup"]]], "the rest join the first group");

  const undeclared = groupFieldsForDisplay(schemaOf({}), [stringField("a"), stringField("b", "gone")]);
  assert.deepEqual(undeclared.groups.map((g) => [g.key, g.label, g.fields.map((f) => f.name)]), [["other", "Other", ["a", "b"]]]);
  assert.deepEqual(groupFieldsForDisplay(schemaOf({}), []).groups, []);
  assert.equal(groupFieldsForDisplay(schemaOf({}), []).dependencies, null);
});

test("a row has content when a field that identifies it is filled", () => {
  const itemFields: ReferentialListItemField[] = [{ name: "pack", kind: "referential" }, { name: "note", kind: "string" }];
  assert.equal(rowHasContent({ pack: "p" }, itemFields), true, "a referential field identifies a row");
  assert.equal(rowHasContent({ pack: "", name: " x " }, itemFields), true, "so does a name");
  assert.equal(rowHasContent({ checklist: ["c"] }, itemFields), true, "or a list in a field that identifies");
  assert.equal(rowHasContent({ statement: "s" }, []), true);
  assert.equal(rowHasContent({ pack: "", checklist: [], note: "filled but identifies nothing" }, itemFields), false);
  assert.equal(rowHasContent({}, itemFields), false);
});

test("plain strings in a one-field list are wrapped in their rows, and nothing else changes", () => {
  const content = { single: ["a", { code: "b" }], double: ["x"], notAList: "text", missing: undefined };
  const wrapped = toSchemaRows(schemaOf({
    properties: {
      single: { "x-widget": "referential-list", items: { properties: { code: {} } } },
      double: { "x-widget": "referential-list", items: { properties: { code: {}, other: {} } } },
      notAList: { "x-widget": "referential-list", items: { properties: { code: {} } } },
      plain: { type: "array", items: { properties: { code: {} } } },
    },
  }), content);
  assert.deepEqual(wrapped, { single: [{ code: "a" }, { code: "b" }], double: ["x"], notAList: "text", missing: undefined });
  assert.deepEqual(content.single, ["a", { code: "b" }], "the content given is not changed");
});

const validationSchema = schemaOf({
  required: ["name", "opt"],
  properties: {
    name: { type: "string" },
    opt: { type: "string" },
    mode: { type: "string", enum: ["a", "b"] },
    code: { type: "string", pattern: "^[a-z]+$" },
    short: { type: "string", minLength: 3 },
    rows: {
      type: "array", "x-widget": "referential-list",
      items: {
        type: "object", required: ["code", "label"],
        properties: {
          code: { type: "string", "x-referential": "codes" }, label: { type: "string" }, kind: { type: "string", enum: ["k1"] }, flag: { type: "boolean" },
          inner: { type: "array", items: { properties: { r: { type: "string", enum: ["z"] }, s: { type: "string" } }, required: ["s"] } },
          obj: { type: "object", properties: { o: { type: "string" } }, required: ["o"] },
        },
      },
    },
  },
});

test("content is checked against its schema: required fields, choices, patterns, minimum lengths, and the rows of a list", () => {
  assert.deepEqual(validateAgainstSchema(validationSchema, { name: "n", opt: "o" }), []);

  const errors = validateAgainstSchema(validationSchema, {
    name: "", mode: "zzz", code: "ABC", short: "ab",
    rows: [
      { code: "", label: "", kind: "", flag: false },
      { code: "c1", label: "" },
      { code: "c2", label: "L", kind: "bad" },
      { code: "c3", label: "L", inner: [{ r: "" }, { r: "q" }, {}], obj: { o: "" } },
      { code: "c4", label: "L", inner: [{ r: "z", s: "ok" }], obj: { o: "ok" } },
    ],
    opt: null,
  });
  assert.deepEqual(errors, [
    '"name" is required',
    '"opt" is required',
    '"mode" must be one of a, b, got: "zzz"',
    '"code" does not match the required pattern (^[a-z]+$)',
    '"short" must be at least 3 character(s)',
    '"rows" row 2: "label" is required',
    '"rows" row 3: "kind" must be one of k1, got: "bad"',
    '"rows" row 4 "inner" row 2: "s" is required',
    '"rows" row 4 "inner" row 2: "r" must be one of z, got: "q"',
    '"rows" row 4 "obj": "o" is required',
  ]);
});

test("a row with nothing that identifies it is not required to be complete, and a pattern is not applied to an empty value", () => {
  assert.deepEqual(validateAgainstSchema(validationSchema, { name: "n", opt: "o", code: "", rows: [{ code: "", label: "", kind: "" }] }), []);
});

const bodySchema = schemaOf({
  properties: {
    j1: { type: "array", "x-widget": "json" },
    j2: { type: "object", "x-widget": "json" },
    plain: { type: "string" },
    other: { type: "string" },
    rows: {
      type: "array", "x-widget": "referential-list",
      items: {
        type: "object", required: ["code"],
        properties: {
          code: { type: "string", "x-referential": "codes" },
          tags: { type: "array", items: { type: "string" } },
          inner: { type: "array", items: { properties: { x: { type: "string" } } } },
          obj: {
            type: "object",
            properties: {
              j: { "x-widget": "json" }, arr: { type: "array" }, lst: { type: "array", items: { properties: { q: { type: "string" } } } },
              ob: { type: "object", properties: { z: { type: "string" } } }, bo: { type: "boolean" }, s: { type: "string", default: "ds" },
            },
          },
          flag: { type: "boolean" },
          blob: { type: "object", "x-widget": "json" },
          note: { type: "string", default: "d" },
        },
      },
    },
  },
});

test("a posted form is read: JSON fields are parsed, anything else passes through, and a field that was not posted is left out", () => {
  const read = (body: Record<string, unknown>) => parseFormBody(bodySchema, body);
  assert.deepEqual(read({ j1: "[1,2]", j2: '{"a":1}', plain: "p" }), { j1: [1, 2], j2: { a: 1 }, plain: "p", rows: [] });
  assert.deepEqual(read({ j1: '{"a":1}', j2: "not json" }).j1, [], "an object where a list is expected");
  assert.deepEqual(read({ j1: '{"a":1}', j2: "not json" }).j2, {}, "text that is not JSON");
  assert.deepEqual([read({ j1: "", j2: "   " }).j1, read({ j1: "", j2: "   " }).j2], [[], {}]);
  assert.deepEqual([read({}).j1, read({}).j2], [[], {}], "a JSON field that was not posted is empty");
  assert.equal("plain" in read({}), false);
  assert.deepEqual(read({ j2: "[1]" }).j2, [1], "an object field takes any JSON it is given");
});

test("the rows of a posted list are read field by field, nested lists and objects included, and a row that identifies nothing is dropped", () => {
  const body = {
    rows: [
      { code: "c1", tags: ["a", "", "b"], inner: [{ x: "1" }, { x: "" }], obj: { j: '{"a":1}', arr: "one", lst: [{ q: "1" }], ob: { z: "zz" }, bo: "true" }, flag: "on", blob: '{"k":1}' },
      { code: "", tags: ["ignored"] },
      { code: "c2", tags: "single", flag: "no", blob: "", inner: undefined, obj: undefined },
    ],
  };
  const rows = parseFormBody(bodySchema, body).rows as Array<Record<string, unknown>>;
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    code: "c1", tags: ["a", "b"], inner: [{ x: "1" }],
    obj: { j: { a: 1 }, arr: ["one"], lst: [{ q: "1" }], ob: { z: "zz" }, bo: true, s: "ds" },
    flag: true, blob: { k: 1 }, note: "d",
  });
  assert.deepEqual(rows[1], { code: "c2", tags: ["single"], inner: [], obj: { j: {}, arr: [], lst: [], ob: { z: "" }, bo: false, s: "ds" }, flag: false, blob: {}, note: "d" });

  const single = parseFormBody(bodySchema, { rows: { code: "only" } }).rows as Array<Record<string, unknown>>;
  assert.deepEqual(single.map((r) => r.code), ["only"], "one posted row that is not in a list is still a row");
  assert.deepEqual(parseFormBody(bodySchema, { rows: undefined }).rows, []);
});

test("a list row is identified by a derived reference when no referential field is required, and JSON that is not posted is empty", () => {
  const nested = schemaOf({
    properties: { rows: { type: "array", "x-widget": "referential-list", items: { type: "object", properties: { derived: { type: "string", "x-referential-source-derived-by": "scope" }, note: { type: "string" }, bad: { "x-widget": "json" } } } } },
  });
  const rows = parseFormBody(nested, { rows: [{ derived: "d", note: "" }, { derived: "", note: "kept?" }, { derived: "", note: "", bad: "nope" }] }).rows as Array<Record<string, unknown>>;
  assert.deepEqual(rows.map((r) => r.derived), ["d"], "a derived reference identifies a row when no referential field is required");
  assert.deepEqual(rows[0].bad, {}, "JSON that does not parse is empty");
});
