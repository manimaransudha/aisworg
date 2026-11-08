// safeBack (src/middleware/safeBack.ts): the page to return to after a form post.
//
//   - It returns the Referer when the Referer is not the page being handled.
//   - It returns the fallback when there is no Referer, when the Referer is the current page, or when a URL cannot be parsed.
//   - The fallback defaults to /aisworg.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Request } from "express";

import { safeBack } from "../src/middleware/safeBack.js";

function fakeRequest(input: { referer?: string; originalUrl: string; host?: string; protocol?: string }): Request {
  return {
    headers: { referer: input.referer, host: input.host ?? "app.test" },
    protocol: input.protocol ?? "http",
    originalUrl: input.originalUrl,
  } as unknown as Request;
}

test("it returns the Referer when it differs from the current page", () => {
  const referer = "http://app.test/aisworg/seu/tenant-admin/users";
  assert.equal(safeBack(fakeRequest({ referer, originalUrl: "/aisworg/seu/tenant-admin/users/42/badges" })), referer);
});

test("it returns the default fallback when there is no Referer", () => {
  assert.equal(safeBack(fakeRequest({ originalUrl: "/aisworg/seu/tenant-admin/users/42/badges" })), "/aisworg");
});

test("it returns the given fallback when there is no Referer", () => {
  assert.equal(safeBack(fakeRequest({ originalUrl: "/x" }), "/aisworg/seu/tenant-admin/users"), "/aisworg/seu/tenant-admin/users");
});

test("it returns the fallback when the Referer is the current page", () => {
  const referer = "http://app.test/aisworg/seu/tenant-admin/users";
  assert.equal(safeBack(fakeRequest({ referer, originalUrl: "/aisworg/seu/tenant-admin/users" }), "/fallback"), "/fallback");
});

test("the current page is compared by path, so the query string does not make it differ", () => {
  const referer = "http://app.test/aisworg/seu/tenant-admin/users?page=2";
  assert.equal(safeBack(fakeRequest({ referer, originalUrl: "/aisworg/seu/tenant-admin/users?sort=name" }), "/fallback"), "/fallback");
});

test("a Referer on another page with a query string is returned unchanged", () => {
  const referer = "http://app.test/aisworg/seu/packs?page=2";
  assert.equal(safeBack(fakeRequest({ referer, originalUrl: "/aisworg/seu/tenant-admin/users/42/badges" })), referer);
});

test("a relative Referer is resolved against the request host", () => {
  assert.equal(safeBack(fakeRequest({ referer: "/aisworg/seu/packs", originalUrl: "/aisworg/seu/packs" }), "/fallback"), "/fallback");
  assert.equal(safeBack(fakeRequest({ referer: "/aisworg/seu/packs", originalUrl: "/aisworg/seu/objectives" })), "/aisworg/seu/packs");
});

test("it returns the fallback when a URL cannot be parsed", () => {
  const req = fakeRequest({ referer: "http://app.test/aisworg/seu/packs", originalUrl: "http://" });
  assert.equal(safeBack(req, "/fallback"), "/fallback");
});

test("it falls back to localhost as the host when the request has none", () => {
  const req = { headers: { referer: "/aisworg/seu/packs" }, protocol: "http", originalUrl: "/aisworg/seu/objectives" } as unknown as Request;
  assert.equal(safeBack(req), "/aisworg/seu/packs");
});
