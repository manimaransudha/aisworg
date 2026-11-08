// The Registry view pages for a Pack, a Policy Definition, a Profile and a Template, and the core views behind them
// (src/routes/seu/core/packView.ts, policyView.ts, profileView.ts, templateView.ts).
//
//   - Each page is fetched over HTTP from the real app, so the route_authority gate, the controller, the view model and the EJS
//     view run together with the core function.
//   - The rows shown are seeded Platform rows: for each kind, the visible row whose view carries the most references.
//   - A viewer with the participant role (the role the route's own route_authority row declares) sees a Platform row.
//     A viewer with no role is redirected. An id that does not exist redirects to the list with a "not found" message.
//   - buildDependencyGraphLayout is called directly: the Template authoring page uses it as well.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import app from "../src/app.js";
import { query } from "../src/utils/db.js";
import { userDB } from "../src/dblayer/userDB.js";
import { tenantsDB } from "../src/dblayer/tenantsDB.js";
import { packsDB } from "../src/dblayer/packsDB.js";
import { policyDefinitionsDB } from "../src/dblayer/policyDefinitionsDB.js";
import { profilesDB } from "../src/dblayer/profilesDB.js";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { lookupRouteAuthority } from "../src/domain/identity/routeAuthorityCache.js";
import { NO_EXPIRY_DATE } from "../src/dblayer/constants.js";
import { createParticipantMaster } from "../src/routes/seu/core/participantsMaster.js";
import { getPackView } from "../src/routes/seu/core/packView.js";
import { getPolicyView } from "../src/routes/seu/core/policyView.js";
import { getProfileView } from "../src/routes/seu/core/profileView.js";
import { getTemplateView, buildDependencyGraphLayout } from "../src/routes/seu/core/templateView.js";
import {
  PLATFORM_TENANT_ID, ROOT_ACTOR_ID, ROOT_ACTOR_BADGE, ROOT_USER_ID,
  setWebBaseUrl, newSession, getPage, getRedirect, assertPageMatches, type Session,
} from "./testFixtures.js";

const run = randomUUID().slice(0, 8);
const rootViewer = { isRoot: true, tenantId: null };
const createdEmails: string[] = [];
let tenantId: string;
let server: ReturnType<typeof app.listen>;
let participantViewer: Session;
let noRoleViewer: Session;
let rootSession: Session;

interface Kind {
  label: string;
  listPath: string;
  notFound: string;
  // The id of the seeded Platform row to show, and the name it is shown by.
  pick: () => Promise<{ id: string; name: string }>;
}

// EJS escapes & < > " ' in <%= %> output. The result is also made safe to use inside a RegExp.
function shownAs(text: string): string {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&#34;").replace(/'/g, "&#39;");
  return escaped.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Choosing a row reads up to 60 views, so each kind does it once.
const picked = new Map<string, Promise<{ id: string; name: string }>>();
function rowOf(kind: Kind): Promise<{ id: string; name: string }> {
  if (!picked.has(kind.label)) picked.set(kind.label, kind.pick());
  return picked.get(kind.label)!;
}

async function richest<T extends { id: string; name: string; tenant_id: string }>(rows: T[], score: (id: string) => Promise<number | null>): Promise<{ id: string; name: string }> {
  let best: { id: string; name: string; score: number } | null = null;
  for (const row of rows.filter((r) => r.tenant_id === PLATFORM_TENANT_ID).slice(0, 60)) {
    const s = await score(row.id);
    if (s !== null && (!best || s > best.score)) best = { id: row.id, name: row.name, score: s };
  }
  assert.ok(best, "the database holds no visible Platform row to show");
  return { id: best.id, name: best.name };
}

const refCount = (refs: Record<string, Record<string, unknown>>): number => Object.values(refs).reduce((n, group) => n + Object.keys(group).length, 0);

const KINDS: Kind[] = [
  {
    label: "Pack", listPath: "/seu/packs", notFound: "Pack not found.",
    pick: async () => richest((await packsDB.findAll()).data ?? [], async (id) => {
      const view = await getPackView(id, rootViewer);
      return view ? refCount(view.refs) + view.policies.length : null;
    }),
  },
  {
    label: "Policy Definition", listPath: "/seu/policy-definitions", notFound: "Policy Definition not found.",
    pick: async () => richest((await policyDefinitionsDB.findAll()).data ?? [], async (id) => {
      const view = await getPolicyView(id, rootViewer);
      return view ? Object.keys(view.labels).length : null;
    }),
  },
  {
    label: "Profile", listPath: "/seu/profiles", notFound: "Profile not found.",
    pick: async () => richest((await profilesDB.findAll()).data ?? [], async (id) => {
      const view = await getProfileView(id, rootViewer);
      return view ? refCount(view.refs) + Object.keys(view.parameterSources).length : null;
    }),
  },
  {
    label: "Template", listPath: "/seu/templates", notFound: "Template not found.",
    pick: async () => richest((await templatesDB.findAll()).data ?? [], async (id) => {
      const view = await getTemplateView(id, rootViewer);
      return view ? refCount(view.refs) + Object.keys(view.parameterSources).length + (view.graph ? 100 : 0) : null;
    }),
  },
];

async function makeViewer(label: string, roles: string[]): Promise<Session> {
  const email = `rv-${run}-${label}@test.local`;
  createdEmails.push(email);
  const user = await userDB.createLocalPending({ email, name: `Registry ${label} ${run}`, verification_token: randomUUID(), verification_expires: new Date(Date.now() + 60_000), type: "Tenant", tenant_id: tenantId });
  await userDB.setActive(email, true);
  await createParticipantMaster({
    tenantId, type: "Human", displayName: `Registry ${label} ${run}`, userId: user.id,
    authorisedRole: roles.map((role) => ({ role, effective_till: NO_EXPIRY_DATE, seu_ids: [] })),
  });
  return newSession(user.id);
}

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("failed to determine the ephemeral port the app bound to");
  setWebBaseUrl(`http://127.0.0.1:${address.port}/aisworg`);

  const { data: tenant, error } = await tenantsDB.create({ code: `rv-${run}`, name: `Registry views ${run}`, authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE, is_system: false });
  if (error || !tenant) throw error ?? new Error("tenant not created");
  tenantId = tenant.id;

  // The role the page's own route_authority row declares, not a role guessed here.
  const declared = lookupRouteAuthority("GET", "/aisworg/seu/packs/x")?.roles ?? [];
  assert.ok(declared.length > 0, "GET /aisworg/seu/packs/:id must declare a role in route_authority");
  participantViewer = await makeViewer("participant", [declared[0]!]);
  noRoleViewer = await makeViewer("no-role", []);
  rootSession = newSession(ROOT_USER_ID);
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((err: Error | undefined) => (err ? reject(err) : resolve())));
  await query("DELETE FROM participants_master WHERE user_id IN (SELECT id FROM users WHERE email = ANY($1::text[]))", [createdEmails]);
  await query("DELETE FROM users WHERE email = ANY($1::text[])", [createdEmails]);
  await query("DELETE FROM participants_master WHERE tenant_id = $1", [tenantId]);
  await query("DELETE FROM tenants WHERE id = $1", [tenantId]);
});

for (const kind of KINDS) {
  test(`${kind.label} page: a viewer holding the declared role sees a seeded Platform row, titled by its name`, async () => {
    const row = await rowOf(kind);
    const page = await getPage(participantViewer, `${kind.listPath}/${row.id}`);
    assert.equal(page.status, 200);
    assertPageMatches(page.html, new RegExp(`<title>${kind.label}: ${shownAs(row.name)}</title>`));
    assertPageMatches(page.html, new RegExp(`${kind.label}: ${shownAs(row.name)}</h2>`));
  });

  test(`${kind.label} page: root sees the same row`, async () => {
    const row = await rowOf(kind);
    const page = await getPage(rootSession, `${kind.listPath}/${row.id}`);
    assert.equal(page.status, 200);
    assertPageMatches(page.html, new RegExp(`${kind.label}: `));
  });

  test(`${kind.label} page: a viewer with no role is redirected and the row is not shown`, async () => {
    const row = await rowOf(kind);
    const denied = await getRedirect(noRoleViewer, `${kind.listPath}/${row.id}`);
    assert.equal(denied.status, 302);
    assert.ok(denied.location, "a denied page load redirects");
    assert.ok(!denied.location.includes(row.id), `the redirect must not return to the denied page: ${denied.location}`);
  });

  test(`${kind.label} page: an id that does not exist redirects to the list with a not-found message`, async () => {
    const missing = await getRedirect(rootSession, `${kind.listPath}/${randomUUID()}`);
    assert.equal(missing.status, 302);
    assert.ok(missing.location?.endsWith(`/aisworg${kind.listPath}`), `expected a redirect to the list, got ${missing.location}`);

    const list = await getPage(rootSession, kind.listPath);
    assert.equal(list.status, 200);
    assertPageMatches(list.html, new RegExp(kind.notFound.replace(".", "\\.")));
  });
}

test("buildDependencyGraphLayout lays a prerequisite to the left of what it gates and returns null for no nodes", async () => {
  assert.equal(await buildDependencyGraphLayout({}, rootViewer), null);

  const layout = await buildDependencyGraphLayout(
    {
      deliverableCatalogue: [{ code: "rv-a" }, { code: "rv-b" }, { code: "rv-c" }, { code: "   " }],
      dependencyGraph: [
        { fromType: "Deliverable", fromCode: "rv-a", toCode: "rv-b" },
        { fromType: "Capability", fromCapabilityCode: "rv-cap", toCode: "rv-a" },
        { fromType: "Deliverable", fromCode: "rv-d", toCode: "" },
        { fromType: "Deliverable", fromCode: "", toCode: "rv-b" },
      ],
    },
    rootViewer
  );
  assert.ok(layout);

  const byId = new Map(layout.nodes.map((n) => [n.id, n]));
  assert.deepEqual([...byId.keys()].sort(), ["Capability:rv-cap", "Deliverable:rv-a", "Deliverable:rv-b", "Deliverable:rv-c", "Deliverable:rv-d"]);
  assert.equal(byId.get("Capability:rv-cap")!.kind, "Capability");
  assert.equal(byId.get("Deliverable:rv-a")!.kind, "Deliverable");
  assert.equal(layout.edges.length, 2, "an entry with no source code or no target code draws no edge");

  const x = (id: string): number => byId.get(id)!.x;
  assert.ok(x("Capability:rv-cap") < x("Deliverable:rv-a"), "the Capability gates rv-a, so it sits to its left");
  assert.ok(x("Deliverable:rv-a") < x("Deliverable:rv-b"), "rv-a gates rv-b, so it sits to its left");
  assert.equal(x("Deliverable:rv-c"), 0, "a Deliverable with no edge sits in the first column");
  assert.equal(layout.width, 3 * 220 + 2 * 110, "three columns of 220 with a 110 gap");
  assert.ok(layout.nodes.every((n) => n.href === null), "a node of the authoring graph carries no link");
  assert.ok(layout.edges.every((e) => e.path.startsWith("M ")));
});

test("buildDependencyGraphLayout clips a long label and falls back to the code when the Ontology has no label", async () => {
  const code = `rv-${run}-a-deliverable-code-that-is-far-too-long`;
  const layout = await buildDependencyGraphLayout({ deliverableCatalogue: [{ code }] }, rootViewer);
  assert.ok(layout);
  assert.equal(layout.nodes.length, 1);
  assert.equal(layout.nodes[0]!.label, `${code.slice(0, 27)}…`);
  assert.equal(layout.nodes[0]!.code, code);
  assert.equal(layout.edges.length, 0);
  assert.equal(layout.width, 220);
});
