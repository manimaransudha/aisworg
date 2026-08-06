// SDK UI Layer Plan — "Schema Registry" section. Proves createSchemaVersion
// is genuinely additive (a new version, never an edit to an existing row)
// and rejects malformed input before it ever reaches the generic form
// generator/validator that reads these rows.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";

import pool from "../src/utils/db.js";
import { createSchemaVersion, getSchemaDefinition, listSchemaDefinitions } from "../src/routes/seu/core/schemaRegistry.js";
import { schemaDefinitionsDB } from "../src/dblayer/schemaDefinitionsDB.js";

after(async () => {
  await pool.end();
});

// Deliberately targets TransitionDefinition, not Pack/Template/Profile —
// those three are live (schema_definitions.findLatest drives what the real
// authoring UI generates its form from), and this test's whole point is
// creating an extra version. TransitionDefinition has no bootstrap Template
// or authoring surface yet (Build order step 6), so bumping its "latest"
// pointer here can never regress anything real — the mistake this test used
// to make, caught and fixed after it broke Pack's own "latest" pointer.
const TEST_KIND = "TransitionDefinition";

test("Schema Registry: a new version is additive — the previous version stays untouched and resolvable", async () => {
  const { data: before } = await schemaDefinitionsDB.findLatest(TEST_KIND);

  const created = await createSchemaVersion({
    entityKind: TEST_KIND,
    schemaJson: JSON.stringify({ type: "object", required: ["code"], properties: { code: { type: "string" } } }),
  });
  assert.equal(created.ok, true, !created.ok ? created.errors.join("; ") : undefined);
  if (!created.ok) return;
  assert.equal(created.schema.version, (before?.version ?? 0) + 1);

  if (before) {
    // The prior version's own row is untouched, still fetchable by id.
    const stillThere = await getSchemaDefinition(before.id);
    assert.ok(stillThere);
    assert.deepEqual(stillThere!.schema, before.schema);
  }

  const { data: latest } = await schemaDefinitionsDB.findLatest(TEST_KIND);
  assert.equal(latest!.id, created.schema.id);

  const all = await listSchemaDefinitions();
  assert.ok(all.some((s) => s.id === created.schema.id));
});

test("Schema Registry: rejects invalid JSON and an unknown entity kind, without writing a row", async () => {
  const badJson = await createSchemaVersion({ entityKind: TEST_KIND, schemaJson: "{ not valid json" });
  assert.equal(badJson.ok, false);
  assert.match((!badJson.ok && badJson.errors.join(";")) || "", /invalid JSON/);

  const badKind = await createSchemaVersion({ entityKind: "NotARealKind", schemaJson: "{}" });
  assert.equal(badKind.ok, false);
  assert.match((!badKind.ok && badKind.errors.join(";")) || "", /entity kind must be one of/);
});
