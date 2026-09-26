// CR-114 Compatibility feature (design/change-requests/CR-114-schema-
// metadata.md, "Compatibility semantics (agreed)") — pure unit coverage for
// diffSchemaVersions, no DB involved. B (newSchema) is compatible with A
// (oldSchema) iff every document valid under A stays valid under B.
import { test } from "node:test";
import assert from "node:assert/strict";

import { diffSchemaVersions } from "../src/domain/sdk/schemaCompiler.js";
import type { JsonSchemaDocument } from "../src/domain/sdk/formGenerator.js";

function doc(properties: JsonSchemaDocument["properties"], required: string[] = []): JsonSchemaDocument {
  return { type: "object", properties, required };
}

test("diffSchemaVersions: identical schemas are compatible with no differences", () => {
  const a = doc({ code: { type: "string" } }, ["code"]);
  const { compatible, differences } = diffSchemaVersions(a, doc({ code: { type: "string" } }, ["code"]));
  assert.equal(compatible, true);
  assert.deepEqual(differences, []);
});

test("diffSchemaVersions: adding an optional property is compatible", () => {
  const a = doc({ code: { type: "string" } }, ["code"]);
  const b = doc({ code: { type: "string" }, note: { type: "string" } }, ["code"]);
  const { compatible, differences } = diffSchemaVersions(a, b);
  assert.equal(compatible, true);
  assert.deepEqual(differences, [{ path: "note", kind: "added", breaking: false }]);
});

test("diffSchemaVersions: adding a bare-required property (no default) is breaking", () => {
  const a = doc({ code: { type: "string" } }, ["code"]);
  const b = doc({ code: { type: "string" }, note: { type: "string" } }, ["code", "note"]);
  const { compatible, differences } = diffSchemaVersions(a, b);
  assert.equal(compatible, false);
  assert.deepEqual(differences, [{ path: "note", kind: "added", breaking: true }]);
});

test("diffSchemaVersions: adding a required property that carries a default is not breaking", () => {
  const a = doc({ code: { type: "string" } }, ["code"]);
  const b = doc({ code: { type: "string" }, note: { type: "string", default: "" } }, ["code", "note"]);
  const { compatible, differences } = diffSchemaVersions(a, b);
  assert.equal(compatible, true);
  assert.deepEqual(differences, [{ path: "note", kind: "added", breaking: false }]);
});

test("diffSchemaVersions: removing a property is breaking", () => {
  const a = doc({ code: { type: "string" }, note: { type: "string" } });
  const b = doc({ code: { type: "string" } });
  const { compatible, differences } = diffSchemaVersions(a, b);
  assert.equal(compatible, false);
  assert.deepEqual(differences, [{ path: "note", kind: "removed", breaking: true }]);
});

test("diffSchemaVersions: changing an existing property's type is breaking", () => {
  const a = doc({ code: { type: "string" } });
  const b = doc({ code: { type: "array" } });
  const { compatible, differences } = diffSchemaVersions(a, b);
  assert.equal(compatible, false);
  assert.deepEqual(differences, [{ path: "code", kind: "type-changed", breaking: true }]);
});

test("diffSchemaVersions: making an existing optional property required (no default) is breaking", () => {
  const a = doc({ code: { type: "string" }, note: { type: "string" } });
  const b = doc({ code: { type: "string" }, note: { type: "string" } }, ["note"]);
  const { compatible, differences } = diffSchemaVersions(a, b);
  assert.equal(compatible, false);
  assert.deepEqual(differences, [{ path: "note", kind: "newly-required", breaking: true }]);
});

test("diffSchemaVersions: relaxing a required property to optional is compatible", () => {
  const a = doc({ code: { type: "string" } }, ["code"]);
  const b = doc({ code: { type: "string" } });
  const { compatible, differences } = diffSchemaVersions(a, b);
  assert.equal(compatible, true);
  assert.deepEqual(differences, [{ path: "code", kind: "now-optional", breaking: false }]);
});

test("diffSchemaVersions: recurses into a nested fixed sub-object's own properties", () => {
  const a = doc({ requiredEvidence: { type: "object", properties: { title: { type: "string" } }, required: ["title"] } });
  const b = doc({ requiredEvidence: { type: "object", properties: {}, required: [] } });
  const { compatible, differences } = diffSchemaVersions(a, b);
  assert.equal(compatible, false);
  assert.deepEqual(differences, [{ path: "requiredEvidence.title", kind: "removed", breaking: true }]);
});

test("diffSchemaVersions: recurses into a repeatable list's item shape", () => {
  const a: JsonSchemaDocument = doc({
    items: { type: "array", items: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
  });
  const b: JsonSchemaDocument = doc({
    items: { type: "array", items: { type: "object", properties: {}, required: [] } },
  });
  const { compatible, differences } = diffSchemaVersions(a, b);
  assert.equal(compatible, false);
  assert.deepEqual(differences, [{ path: "items[].name", kind: "removed", breaking: true }]);
});
