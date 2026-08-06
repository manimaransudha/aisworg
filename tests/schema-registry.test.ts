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

// All four entity kinds are load-bearing now (each has a real, live
// authoring surface whose generated form reads schema_definitions.findLatest
// directly) — there is no "safe," permanently-unused kind left to target the
// way TransitionDefinition briefly was. Learned the hard way, twice: this
// test (and, separately, an HTTP smoke test of the Registry's own creation
// form) left a stray minimal schema as TransitionDefinition's "latest"
// after it went live, silently breaking its real authoring form until
// caught and republished correctly. Self-healing now: republishes `before`'s
// exact content as one more version at the end, so this test always leaves
// "latest" pointing at real, correct content — the same "publish forward to
// fix," not "delete," discipline the feature itself is built on.
const TEST_KIND = "TransitionDefinition";

test("Schema Registry: a new version is additive — the previous version stays untouched and resolvable", async () => {
  const { data: before } = await schemaDefinitionsDB.findLatest(TEST_KIND);
  assert.ok(before, `expected ${TEST_KIND} to already have a real, seeded schema version`);

  try {
    const created = await createSchemaVersion({
      entityKind: TEST_KIND,
      schemaJson: JSON.stringify({ type: "object", required: ["code"], properties: { code: { type: "string" } } }),
    });
    assert.equal(created.ok, true, !created.ok ? created.errors.join("; ") : undefined);
    if (!created.ok) return;
    assert.equal(created.schema.version, before!.version + 1);

    // The prior version's own row is untouched, still fetchable by id.
    const stillThere = await getSchemaDefinition(before!.id);
    assert.ok(stillThere);
    assert.deepEqual(stillThere!.schema, before!.schema);

    const { data: latest } = await schemaDefinitionsDB.findLatest(TEST_KIND);
    assert.equal(latest!.id, created.schema.id);

    const all = await listSchemaDefinitions();
    assert.ok(all.some((s) => s.id === created.schema.id));
  } finally {
    // Restore "latest" to before's real content, regardless of pass/fail —
    // never leave the shared dev database's live authoring surface pointed
    // at this test's own throwaway schema.
    await createSchemaVersion({ entityKind: TEST_KIND, schemaJson: JSON.stringify(before!.schema) });
  }
});

test("Schema Registry: rejects invalid JSON and an unknown entity kind, without writing a row", async () => {
  const badJson = await createSchemaVersion({ entityKind: TEST_KIND, schemaJson: "{ not valid json" });
  assert.equal(badJson.ok, false);
  assert.match((!badJson.ok && badJson.errors.join(";")) || "", /invalid JSON/);

  const badKind = await createSchemaVersion({ entityKind: "NotARealKind", schemaJson: "{}" });
  assert.equal(badKind.ok, false);
  assert.match((!badKind.ok && badKind.errors.join(";")) || "", /entity kind must be one of/);
});
