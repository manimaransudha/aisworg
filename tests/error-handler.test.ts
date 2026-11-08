// errorHandler (src/middleware/errorHandler.ts): the last middleware in app.ts, reached through next(err) from every page route.
//
//   - A CSRF failure redirects to login.
//   - Any other error responds with err.statusCode, or 500, and a JSON body.
//   - The stack is in the body in development only.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";

import { errorHandler } from "../src/middleware/errorHandler.js";

interface Captured {
  redirectedTo?: string;
  status?: number;
  body?: { error: { message: string; stack?: string } };
}

function run(err: Error & { code?: string; status?: number; statusCode?: number }): Captured {
  const captured: Captured = {};
  const req = { method: "POST", path: "/aisworg/seu/anything" } as Request;
  const res = {
    redirect(to: string) {
      captured.redirectedTo = to;
    },
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: Captured["body"]) {
      captured.body = body;
    },
  } as unknown as Response;
  errorHandler(err, req, res, () => undefined);
  return captured;
}

test("a CSRF error code redirects to login", () => {
  const out = run(Object.assign(new Error("anything"), { code: "EBADCSRFTOKEN" }));
  assert.equal(out.redirectedTo, "/aisworg/auth/login");
  assert.equal(out.status, undefined);
  assert.equal(out.body, undefined);
});

test("a 403 with the invalid csrf token message redirects to login", () => {
  const out = run(Object.assign(new Error("invalid csrf token"), { status: 403 }));
  assert.equal(out.redirectedTo, "/aisworg/auth/login");
  assert.equal(out.body, undefined);
});

test("a 403 with another message is not treated as a CSRF failure", () => {
  const out = run(Object.assign(new Error("forbidden"), { status: 403 }));
  assert.equal(out.redirectedTo, undefined);
  assert.equal(out.status, 500);
  assert.equal(out.body?.error.message, "forbidden");
});

test("an error with a statusCode responds with that status and its message", () => {
  const out = run(Object.assign(new Error("Not found"), { statusCode: 404 }));
  assert.equal(out.status, 404);
  assert.equal(out.body?.error.message, "Not found");
  assert.equal(out.redirectedTo, undefined);
});

test("an error with no statusCode responds 500", () => {
  const out = run(new Error("boom"));
  assert.equal(out.status, 500);
  assert.equal(out.body?.error.message, "boom");
});

test("an error with an empty message responds with the generic message", () => {
  const out = run(new Error(""));
  assert.equal(out.status, 500);
  assert.equal(out.body?.error.message, "Internal Server Error");
});

test("the stack is in the body in development and absent otherwise", () => {
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "development";
    const dev = run(new Error("boom"));
    assert.equal(typeof dev.body?.error.stack, "string");

    process.env.NODE_ENV = "production";
    const prod = run(new Error("boom"));
    assert.equal(prod.body?.error.stack, undefined);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});
