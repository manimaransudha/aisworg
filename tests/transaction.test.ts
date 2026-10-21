// CR-128: withTransaction runs the queries of one unit of work on one connection, commits when it returns and rolls back
// when it throws. A call made inside a running transaction joins it.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";

import { query, withTransaction } from "../src/utils/db.js";

const transactionId = async () => (await query<{ id: string }>("SELECT txid_current()::text AS id")).rows[0].id;

test("every query inside withTransaction runs in the same transaction, and queries outside run in their own", async () => {
  const [a, b] = await withTransaction(async () => [await transactionId(), await transactionId()]);
  assert.equal(a, b, "both queries must share one transaction");
  assert.notEqual(await transactionId(), await transactionId(), "separate queries outside a transaction each get their own");
});

test("a nested withTransaction joins the running transaction", async () => {
  const [outer, inner] = await withTransaction(async () => [await transactionId(), await withTransaction(async () => transactionId())]);
  assert.equal(outer, inner);
});

test("withTransaction returns the value of its work and rethrows the original error, leaving the pool usable", async () => {
  assert.equal(await withTransaction(async () => 42), 42);
  await assert.rejects(() => withTransaction(async () => { await transactionId(); throw new Error("work failed"); }), /work failed/);
  assert.ok(await transactionId());
});

test("a statement that fails inside the transaction rolls the whole unit back", async () => {
  await assert.rejects(() => withTransaction(async () => { await transactionId(); await query("SELECT * FROM table_that_does_not_exist"); }), /table_that_does_not_exist/);
  assert.ok(await transactionId());
});
