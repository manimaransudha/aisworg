// routeAuthorityGate (src/middleware/routeAuthorityGate.ts): the global gate that decides route access from route_authority.
//
//   - PUBLIC and OPEN: a public path and a row with no badges and no roles pass without a session.
//   - NO ROW: a request with no matching row is denied, except for a root session outside production.
//   - SELF-CRUD: the route-authority and data-migrations pages need a session that holds the root badge.
//   - BADGES and ROLES: a row with both needs the badge check and the role check to pass. match_mode applies inside each list.
//   - BYPASS: root passes outside production only, and a superuser role passes the role check.
//   - DENIAL: a page request is redirected with the flash message and an api request answers 401 or 403 JSON.
//
// The test writes its own route_authority rows under a random path and its own Participants, and removes them afterwards.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

import { routeAuthorityGate } from "../src/middleware/routeAuthorityGate.js";
import { routeAuthorityDB } from "../src/dblayer/routeAuthorityDB.js";
import { participantsMasterDB } from "../src/dblayer/participantsMasterDB.js";
import { refreshRouteAuthorityCache } from "../src/domain/identity/routeAuthorityCache.js";
import { PLATFORM_TENANT_ID, ROOT_ACTOR_ID, ROOT_ACTOR_BADGE, deactivateParticipants } from "./testFixtures.js";

const DENY_MESSAGE = "You are not authorised for this action.";
const SESSION_EXPIRED_MESSAGE = "Session expired — please log in again.";

const run = randomUUID().slice(0, 8);
const BADGE_A = `test_gate_a_${run}`;
const BADGE_B = `test_gate_b_${run}`;
const ROLE_A = `test_gate_role_a_${run}`;
const ROLE_B = `test_gate_role_b_${run}`;

const webBase = `/aisworg/test-gate-${run}`;
const apiBase = `/aisworg/api/test-gate-${run}`;
const PATHS = {
  open: `${webBase}/open`,
  badgesAny: `${webBase}/badges-any`,
  badgesAll: `${webBase}/badges-all`,
  rolesAny: `${webBase}/roles-any`,
  rolesAll: `${webBase}/roles-all`,
  both: `${webBase}/both`,
  apiBadge: `${apiBase}/badge`,
  noRow: `${webBase}/no-row`,
  apiNoRow: `${apiBase}/no-row`,
};

const rowIds: string[] = [];
const participantIds: string[] = [];

async function createActor(label: string, grants: { badges?: string[]; roles?: string[] }): Promise<string> {
  const { data, error } = await participantsMasterDB.create({
    tenantId: PLATFORM_TENANT_ID,
    type: "Human",
    displayName: `Gate test ${label} ${run}`,
    authorisedBadges: (grants.badges ?? []).map((badge) => ({ badge, effective_till: "9999-12-31", seu_ids: [] })),
    authorisedRole: (grants.roles ?? []).map((role) => ({ role, effective_till: "9999-12-31", seu_ids: [] })),
    userId: null,
  });
  if (error || !data) throw error ?? new Error(`could not create actor ${label}`);
  participantIds.push(data.id);
  return data.id;
}

async function createRow(method: string, path: string, badges: string[], roles: string[], matchMode: "all" | "any"): Promise<void> {
  const { data, error } = await routeAuthorityDB.create({ method, path, badges, roles, matchMode, description: "route-authority-gate test row", authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE });
  if (error || !data) throw error ?? new Error(`could not create route_authority row ${method} ${path}`);
  rowIds.push(data.id);
}

let nobody: string;
let holdsA: string;
let holdsAB: string;
let holdsRoleA: string;
let holdsRoleAB: string;
let holdsAAndRoleA: string;
let holdsRoot: string;
let holdsSuperuser: string;

before(async () => {
  nobody = await createActor("nobody", {});
  holdsA = await createActor("badge-a", { badges: [BADGE_A] });
  holdsAB = await createActor("badge-a-b", { badges: [BADGE_A, BADGE_B] });
  holdsRoleA = await createActor("role-a", { roles: [ROLE_A] });
  holdsRoleAB = await createActor("role-a-b", { roles: [ROLE_A, ROLE_B] });
  holdsAAndRoleA = await createActor("badge-a-role-a", { badges: [BADGE_A], roles: [ROLE_A] });
  holdsRoot = await createActor("root", { badges: ["root"] });
  holdsSuperuser = await createActor("superuser", { roles: ["superuser"] });

  await createRow("GET", PATHS.open, [], [], "any");
  await createRow("GET", PATHS.badgesAny, [BADGE_A, BADGE_B], [], "any");
  await createRow("GET", PATHS.badgesAll, [BADGE_A, BADGE_B], [], "all");
  await createRow("GET", PATHS.rolesAny, [], [ROLE_A, ROLE_B], "any");
  await createRow("GET", PATHS.rolesAll, [], [ROLE_A, ROLE_B], "all");
  await createRow("GET", PATHS.both, [BADGE_A], [ROLE_A], "any");
  await createRow("GET", PATHS.apiBadge, [BADGE_A], [], "any");
  await refreshRouteAuthorityCache();
});

after(async () => {
  for (const id of rowIds) await routeAuthorityDB.delete(id);
  await refreshRouteAuthorityCache();
  await deactivateParticipants(participantIds);
});

interface Outcome {
  nextCalled: boolean;
  redirectedTo?: string;
  status?: number;
  body?: { success?: boolean; message?: string };
  flashMessage?: string;
}

async function call(input: { method?: string; path: string; actor?: string | null; platformBadges?: string[] }): Promise<Outcome> {
  const outcome: Outcome = { nextCalled: false };
  const session: { user?: Record<string, unknown>; flash?: { type: string; message: string } } = {};
  if (input.actor) {
    session.user = { id: input.actor, email: `gate-test-${run}@test.local`, tenant_id: PLATFORM_TENANT_ID, platformBadges: input.platformBadges ?? [], is_active: true };
  }
  const req = {
    method: input.method ?? "GET",
    path: input.path,
    originalUrl: input.path,
    session,
    get: () => undefined,
  } as unknown as Request;
  const res = {
    redirect(to: string) {
      outcome.redirectedTo = to;
    },
    status(code: number) {
      outcome.status = code;
      return this;
    },
    json(body: Outcome["body"]) {
      outcome.body = body;
    },
  } as unknown as Response;
  await routeAuthorityGate()(req, res, (() => {
    outcome.nextCalled = true;
  }) as NextFunction);
  outcome.flashMessage = session.flash?.message;
  return outcome;
}

async function inProduction<T>(fn: () => Promise<T>): Promise<T> {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    return await fn();
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
}

function assertPasses(out: Outcome): void {
  assert.equal(out.nextCalled, true, JSON.stringify(out));
  assert.equal(out.redirectedTo, undefined);
  assert.equal(out.status, undefined);
}

function assertPageDenied(out: Outcome): void {
  assert.equal(out.nextCalled, false);
  assert.ok(out.redirectedTo, "expected a redirect");
  assert.equal(out.flashMessage, DENY_MESSAGE);
}

test("a public path passes without a session", async () => {
  assertPasses(await call({ path: "/aisworg/auth/login" }));
  assertPasses(await call({ path: "/css/site.css" }));
});

test("a row with no badges and no roles passes without a session", async () => {
  assertPasses(await call({ path: PATHS.open }));
});

test("a request with no row is denied, as a redirect for a page and 403 for an api", async () => {
  assertPageDenied(await call({ path: PATHS.noRow, actor: nobody }));

  const api = await call({ path: PATHS.apiNoRow, actor: nobody });
  assert.equal(api.nextCalled, false);
  assert.equal(api.status, 403);
  assert.equal(api.body?.success, false);
  assert.equal(api.body?.message, DENY_MESSAGE);
});

test("a request with no row and no session is denied", async () => {
  assertPageDenied(await call({ path: PATHS.noRow }));
});

test("a root session passes a request with no row outside production and is denied in production", async () => {
  assertPasses(await call({ path: PATHS.noRow, actor: holdsRoot, platformBadges: ["root"] }));
  assertPageDenied(await inProduction(() => call({ path: PATHS.noRow, actor: holdsRoot, platformBadges: ["root"] })));
});

test("a row with a requirement and no session redirects to login for a page and answers 401 for an api", async () => {
  const page = await call({ path: PATHS.badgesAny });
  assert.equal(page.nextCalled, false);
  assert.equal(page.redirectedTo, "/aisworg/login");
  assert.equal(page.flashMessage, SESSION_EXPIRED_MESSAGE);

  const api = await call({ path: PATHS.apiBadge });
  assert.equal(api.nextCalled, false);
  assert.equal(api.status, 401);
  assert.equal(api.body?.message, SESSION_EXPIRED_MESSAGE);
});

test("a badge row with match_mode any passes with one of the badges and is denied with none", async () => {
  assertPasses(await call({ path: PATHS.badgesAny, actor: holdsA }));
  assertPageDenied(await call({ path: PATHS.badgesAny, actor: nobody }));
});

test("a badge row with match_mode all needs every badge", async () => {
  assertPasses(await call({ path: PATHS.badgesAll, actor: holdsAB }));
  assertPageDenied(await call({ path: PATHS.badgesAll, actor: holdsA }));
});

test("a role row with match_mode any passes with one of the roles and is denied with none", async () => {
  assertPasses(await call({ path: PATHS.rolesAny, actor: holdsRoleA }));
  assertPageDenied(await call({ path: PATHS.rolesAny, actor: nobody }));
});

test("a role row with match_mode all needs every role", async () => {
  assertPasses(await call({ path: PATHS.rolesAll, actor: holdsRoleAB }));
  assertPageDenied(await call({ path: PATHS.rolesAll, actor: holdsRoleA }));
});

test("a row with both badges and roles needs the badge check and the role check to pass", async () => {
  assertPasses(await call({ path: PATHS.both, actor: holdsAAndRoleA }));
  assertPageDenied(await call({ path: PATHS.both, actor: holdsA }));
  assertPageDenied(await call({ path: PATHS.both, actor: holdsRoleA }));
});

test("an api request denied for a missing badge answers 403 JSON", async () => {
  const out = await call({ path: PATHS.apiBadge, actor: nobody });
  assert.equal(out.nextCalled, false);
  assert.equal(out.status, 403);
  assert.equal(out.body?.success, false);
  assert.equal(out.body?.message, DENY_MESSAGE);
});

test("outside production, a holder of the root badge passes a badge row, and a root session passes badge and role checks", async () => {
  assertPasses(await call({ path: PATHS.badgesAll, actor: holdsRoot }));
  assertPasses(await call({ path: PATHS.both, actor: nobody, platformBadges: ["root"] }));
});

test("in production the root badge no longer bypasses a row", async () => {
  assertPageDenied(await inProduction(() => call({ path: PATHS.both, actor: nobody, platformBadges: ["root"] })));
});

test("a superuser role passes the role check", async () => {
  assertPasses(await call({ path: PATHS.rolesAll, actor: holdsSuperuser }));
});

test("the self-CRUD pages pass for a holder of the root badge", async () => {
  assertPasses(await call({ path: "/aisworg/seu/route-authority", actor: ROOT_ACTOR_ID }));
  assertPasses(await call({ method: "POST", path: "/aisworg/seu/route-authority/some-id/delete", actor: ROOT_ACTOR_ID }));
  assertPasses(await call({ path: "/aisworg/seu/data-migrations", actor: ROOT_ACTOR_ID }));
  assertPasses(await call({ method: "POST", path: "/aisworg/seu/data-migrations/run", actor: ROOT_ACTOR_ID }));
});

test("the self-CRUD pages are denied for a session without the root badge", async () => {
  assertPageDenied(await call({ path: "/aisworg/seu/route-authority", actor: nobody }));
  assertPageDenied(await call({ method: "POST", path: "/aisworg/seu/data-migrations/run", actor: holdsAB }));
});

test("the self-CRUD pages redirect to login without a session", async () => {
  const out = await call({ path: "/aisworg/seu/route-authority" });
  assert.equal(out.nextCalled, false);
  assert.equal(out.redirectedTo, "/aisworg/login");
  assert.equal(out.flashMessage, SESSION_EXPIRED_MESSAGE);
});
