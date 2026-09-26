// CR-114 — the widget-tree editor's own round-trip fidelity: editing an
// existing schema version through the new form and saving it again with no
// changes must reproduce the same grammar. Read-only against the DB (just
// schemaDefinitionsDB.findLatest) — no version is created, nothing is
// written, so this is safe to run anytime.
//
// Compares SEMANTICALLY, not byte-for-byte: `x-property-order` is a
// position-preserving hint (formGenerator.ts's own comment — Postgres JSONB
// does not preserve object key order), and the compiler always re-emits it
// from the tree's current row order (necessary so a reordered/edited field
// list actually persists its order) — a nested item shape that happened not
// to carry one in the original hand-authored migration is expected to gain
// one here. That is the round trip working correctly, not a fidelity bug, so
// the comparison strips it (and sorts order-independent arrays) before
// asserting equality. Everything else — every property, every `x-*`
// keyword, every required flag, every nested value — must match exactly.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";

import { schemaDefinitionsDB } from "../src/dblayer/schemaDefinitionsDB.js";
import { SCHEMA_KINDS, jsonSchemaToWidgetTree, widgetTreeToJsonSchema } from "../src/domain/sdk/schemaCompiler.js";
import type { SchemaDefinitionEntityKind } from "../src/dblayer/seuTypes.js";

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalize);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === "x-property-order") continue; // position hint, not content — see file header
      out[k] = normalize(v);
    }
    // `required`/`enum` are unordered sets semantically — sort so an
    // incidental reordering (e.g. required built by iterating the tree's own
    // row order rather than the original array's order) isn't a false fail.
    if (Array.isArray(out.required)) out.required = [...(out.required as string[])].sort();
    if (Array.isArray(out.enum)) out.enum = [...(out.enum as string[])].sort();
    return out;
  }
  return value;
}

for (const kind of SCHEMA_KINDS) {
  test(`Schema Registry widget tree: ${kind}'s current live schema round-trips losslessly`, async () => {
    const { data: schema } = await schemaDefinitionsDB.findLatest(kind as SchemaDefinitionEntityKind);
    assert.ok(schema, `expected ${kind} to already have a real, seeded schema version`);

    const doc = jsonSchemaToWidgetTree(schema!.schema);
    const roundTripped = widgetTreeToJsonSchema(doc);

    assert.deepEqual(normalize(roundTripped), normalize(schema!.schema));
  });
}
