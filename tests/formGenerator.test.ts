// parseFormBody (src/domain/sdk/formGenerator.ts) had NO test coverage
// anywhere in this suite before this file — every Pack/Template/Profile/
// Deliverable form submission goes through it, but nothing exercised it
// directly. That gap is exactly why a real regression (below) shipped
// unnoticed: sdk-authoring.test.ts's own "branch from an existing code" test
// calls createAuthoringDraft with an already-clean, hand-built JS object —
// that path (createAuthoringDraft -> toPackSeedInput) never calls
// parseFormBody at all, so it structurally cannot catch a bug that only
// exists in HOW A REAL HTML FORM SUBMISSION gets parsed. This file is a pure
// unit test against a minimal synthetic schema (no DB, no app) — fast, and
// scoped to exactly the function that broke.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFormBody, type JsonSchemaDocument } from "../src/domain/sdk/formGenerator.js";

// Mirrors the real shapes that broke: `category` is an x-referential
// IDENTIFYING field (like Quality Gate's own); `refIds` is a FLAT x-multi
// array of raw id strings with NO `.items.properties` (like checklistIds/
// requiredPolicyCodes — a <select multiple>'s own raw value, not a nested
// row shape); `subItems` is a genuinely NESTED array of objects (like
// Checklist's own `items[].statement`).
const SCHEMA: JsonSchemaDocument = {
  properties: {
    contributionGates: {
      type: "array",
      "x-widget": "referential-list",
      items: {
        type: "object",
        properties: {
          category: { type: "string", "x-referential": "category:evidence" },
          name: { type: "string" },
          refIds: { type: "array", "x-referential": "checklist", "x-multi": true },
          subItems: {
            type: "array",
            items: { type: "object", properties: { statement: { type: "string" } } },
          },
        },
      },
    },
  },
};

test("parseFormBody drops an untouched blank referential-list row whose only identifying field is a flat x-multi array left unselected", () => {
  // Bug fix (owner: Validate threw '\"\" is not a canonical category:evidence
  // concept... quality gate \"\" has an invalid governedTransition... review
  // gate is missing a code' on a Draft branched from a Pack with no Quality/
  // Review Gates at all) — the blank "New item" row generateFields always
  // offers for convenience submits no `refIds` key at all (an unselected
  // <select multiple> submits nothing), so `raw` is undefined here — exactly
  // this shape.
  const body = { contributionGates: [{ category: "", name: "", subItems: [{ statement: "" }] }] };
  const parsed = parseFormBody(SCHEMA, body);
  assert.deepEqual(parsed.contributionGates, [], "an entirely untouched row must be dropped, not saved as a phantom with empty fields");
});

test("parseFormBody keeps a row with real content, and preserves a flat x-multi array's real id strings without corrupting them into empty objects", () => {
  const body = {
    contributionGates: [
      { category: "Analytical Evidence", name: "Real Gate", refIds: ["checklist-uuid-1", "checklist-uuid-2"], subItems: [{ statement: "" }] },
    ],
  };
  const parsed = parseFormBody(SCHEMA, body);
  assert.deepEqual(parsed.contributionGates, [
    { category: "Analytical Evidence", name: "Real Gate", refIds: ["checklist-uuid-1", "checklist-uuid-2"], subItems: [] },
  ]);
});

// Checklist's own real shape, precisely: NO field carries x-referential at
// all (name/description/asset/items are plain), so blank-ness falls back to
// "every own field empty" rather than an identifying-field check — a row
// with real nested content must survive even with every OTHER field blank,
// since the missing name is a real validation error to surface (the earlier
// "checklist has no items"/"is missing a name" behavior), not something to
// silently discard.
const CHECKLIST_LIKE_SCHEMA: JsonSchemaDocument = {
  properties: {
    contributionChecklists: {
      type: "array",
      "x-widget": "referential-list",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          items: {
            type: "array",
            items: { type: "object", properties: { statement: { type: "string" }, group: { type: "string" } } },
          },
        },
      },
    },
  },
};

test("parseFormBody recurses into a genuinely nested item field (one with its own .items.properties) instead of stringifying it, and a row with real nested content survives even with its own other fields blank", () => {
  // Bug fix (owner: flash error \"cl.items.forEach is not a function\" on
  // Validate) — before parseReferentialListField existed, ANY array-typed
  // item field (nested-object row-list or flat value-list alike) fell
  // through to `String(raw ?? ...)`, silently stringifying a real nested
  // array into something like \"[object Object]\" — cl.items.forEach then had
  // no array to call forEach on at all.
  const body = { contributionChecklists: [{ name: "", items: [{ statement: "Do the thing", group: "" }, { statement: "", group: "" }] }] };
  const parsed = parseFormBody(CHECKLIST_LIKE_SCHEMA, body);
  assert.deepEqual(parsed.contributionChecklists, [
    { name: "", items: [{ statement: "Do the thing", group: "" }] },
  ], "real nested items keep the row (blank name becomes a real validation error elsewhere, not a silent drop); the nested list drops its OWN blank sub-row (the 2nd item) the same way");
});
