// The Registry view pages for a Pack, a Policy Definition, a Profile, a Template, a Capability Definition, a Deliverable Definition
// and a Service Definition, and the core views behind them (src/routes/seu/core/packView.ts, policyView.ts, profileView.ts,
// templateView.ts, capabilityDefinitions.ts, deliverableDefinitions.ts, serviceDefinitions.ts).
//
//   - Each page is fetched over HTTP from the real app, so the route_authority gate, the controller, the view model and the EJS
//     view run together with the core function.
//   - Every row shown is a maximal Active fixture of tests/schemaFixtures.ts, built in a tenant of their own.
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
import { lookupRouteAuthority } from "../src/domain/identity/routeAuthorityCache.js";
import { NO_EXPIRY_DATE } from "../src/dblayer/constants.js";
import { createParticipantMaster } from "../src/routes/seu/core/participantsMaster.js";
import { getPackView } from "../src/routes/seu/core/packView.js";
import { getPolicyView } from "../src/routes/seu/core/policyView.js";
import { getCapabilityDefinitionView } from "../src/routes/seu/core/capabilityDefinitions.js";
import { getDeliverableDefinitionView } from "../src/routes/seu/core/deliverableDefinitions.js";
import { getServiceDefinitionView } from "../src/routes/seu/core/serviceDefinitions.js";
import { getProfileView } from "../src/routes/seu/core/profileView.js";
import { getTemplateView, buildDependencyGraphLayout } from "../src/routes/seu/core/templateView.js";
import {
  ROOT_USER_ID,
  setWebBaseUrl, newSession, getPage, getRedirect, assertPageMatches, type Session,
} from "./testFixtures.js";
import { ensureFixtureTenant, buildStage4Fixtures, FIXTURE_CODES, type Stage4Fixtures } from "./schemaFixtures.js";

const run = randomUUID().slice(0, 8);
const rootViewer = { isRoot: true, tenantId: null };
const createdEmails: string[] = [];
let tenantId: string;
let stage1: Stage4Fixtures;
let server: ReturnType<typeof app.listen>;
let participantViewer: Session;
let noRoleViewer: Session;
let rootSession: Session;

interface Kind {
  label: string;
  listPath: string;
  notFound: string;
  // The id of the row to show, and the name the page shows it by.
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

const KINDS: Kind[] = [
  {
    label: "Pack", listPath: "/seu/packs", notFound: "Pack not found.",
    pick: async () => ({ id: stage1.pack.id, name: stage1.pack.shownName }),
  },
  {
    label: "Policy Definition", listPath: "/seu/policy-definitions", notFound: "Policy Definition not found.",
    pick: async () => ({ id: stage1.policy.id, name: stage1.policy.shownName }),
  },
  {
    label: "Capability Definition", listPath: "/seu/capability-definitions", notFound: "Capability Definition not found.",
    pick: async () => ({ id: stage1.capability.id, name: stage1.capability.shownName }),
  },
  {
    label: "Deliverable Definition", listPath: "/seu/deliverable-definitions", notFound: "Deliverable Definition not found.",
    pick: async () => ({ id: stage1.inputDeliverable.id, name: stage1.inputDeliverable.shownName }),
  },
  {
    label: "Service Definition", listPath: "/seu/service-definitions", notFound: "Service Definition not found.",
    pick: async () => ({ id: stage1.service.id, name: stage1.service.shownName }),
  },
  {
    label: "Profile", listPath: "/seu/profiles", notFound: "Profile not found.",
    pick: async () => ({ id: stage1.profile.id, name: stage1.profile.shownName }),
  },
  {
    label: "Template", listPath: "/seu/templates", notFound: "Template not found.",
    pick: async () => ({ id: stage1.template.id, name: stage1.template.shownName }),
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

  // The fixture rows and the two viewers live in this tenant. The tenant stays, with the rows, as in the other tests that create tenant rows.
  tenantId = await ensureFixtureTenant("views");
  stage1 = await buildStage4Fixtures(tenantId);

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

test("the Service view finds its Capability and its Deliverables Active in the viewer's own tenant, and labels its consumers", async () => {
  const view = await getServiceDefinitionView(stage1.service.id, { isRoot: false, tenantId });
  assert.ok(view);
  assert.equal(view.serviceDefinition.id, stage1.service.id);
  assert.equal(view.capability.id, stage1.capability.id);
  assert.equal(view.capability.displayName, stage1.capability.content.defaultLabel);
  assert.equal(view.deliverableIds[stage1.inputDeliverable.code], stage1.inputDeliverable.id);
  assert.equal(view.deliverableIds[stage1.outputDeliverable.code], stage1.outputDeliverable.id);
  for (const code of stage1.service.content.consumers as string[]) assert.equal(typeof view.labels.capabilities[code], "string", `consumer ${code} has an Ontology label`);
});

test("the Capability view labels its category, roles and worktypes and names the Active Service aligned to it", async () => {
  const view = await getCapabilityDefinitionView(stage1.capability.id, { isRoot: false, tenantId });
  assert.ok(view);
  assert.equal(view.capabilityDefinition.id, stage1.capability.id);
  assert.equal(view.activeServiceId, stage1.service.id);
  assert.equal(typeof view.labels.category[stage1.capability.content.category as string], "string");
  for (const role of stage1.capability.content.roles as Array<{ name: string; worktypes: string[] }>) {
    assert.equal(typeof view.labels.roles[role.name], "string", `role ${role.name} has an Ontology label`);
    for (const worktype of role.worktypes) assert.equal(typeof view.labels.worktypes[worktype], "string", `worktype ${worktype} has an Ontology label`);
  }
});

test("the Deliverable Definition view shows the code with its hyphens as spaces", async () => {
  const view = await getDeliverableDefinitionView(stage1.inputDeliverable.id, { isRoot: false, tenantId });
  assert.ok(view);
  assert.equal(view.displayName, stage1.inputDeliverable.code.replace(/-/g, " "));
  assert.equal(view.deliverableDefinition.id, stage1.inputDeliverable.id);
});

test("the Policy view carries the condition and the Ontology labels of its category and environments", async () => {
  const view = await getPolicyView(stage1.policy.id, { isRoot: false, tenantId });
  assert.ok(view);
  assert.equal(view.policy.id, stage1.policy.id);
  assert.ok(Array.isArray(view.content.conditions) && view.content.conditions.length === 1, "the one condition is shown");
  assert.equal(typeof view.labels["category:policy"]?.[stage1.policy.content.category as string], "string");
  for (const environment of stage1.policy.content.applicabilityEnvironments as string[]) assert.equal(typeof view.labels["category:environment"]?.[environment], "string");
});

test("the Pack view resolves its Service, Capabilities, Policy and Packs, and lists the Policy it adopts", async () => {
  const view = await getPackView(stage1.pack.id, { isRoot: false, tenantId });
  assert.ok(view);
  assert.equal(view.pack.id, stage1.pack.id);
  assert.equal(view.refs["service-definition"][stage1.service.code]?.id, stage1.service.id);
  assert.equal(view.refs["capability-name"][FIXTURE_CODES.capability.code]?.id, stage1.capability.id);
  assert.equal(view.refs["capability-name"][FIXTURE_CODES.capabilityB.code]?.id, stage1.capabilityB.id);
  assert.equal(view.refs.policy[stage1.policy.code]?.name, stage1.policy.shownName);
  assert.equal(view.refs["pack-code"][stage1.basePack.code]?.name, stage1.basePack.shownName);
  assert.equal(view.policies.length, 2, "the Policy and the Standard the Pack adopts");
  const adopted = view.policies.find((p) => p.name === stage1.policy.shownName)!;
  assert.ok(adopted);
  assert.equal(adopted.scope, "Transition");
  assert.equal(adopted.conditions.length, 1);
  assert.equal(adopted.environments.length, 2);
});

test("the Template view resolves the Packs of every category and the catalogue Deliverables, and draws the dependency graph", async () => {
  const view = await getTemplateView(stage1.template.id, { isRoot: false, tenantId });
  assert.ok(view);
  assert.equal(view.template.id, stage1.template.id);

  const packs = [stage1.pack, stage1.basePack, stage1.engineeringPack, stage1.compliancePack, stage1.domainPack, stage1.organisationPack, stage1.integrationPack];
  for (const pack of packs) assert.equal(view.refs["pack-code"][pack.code]?.id, pack.id, `Pack ${pack.code} is resolved`);
  assert.ok(packs.every((pack) => view.refs["pack-code"][pack.code]?.mandatory === false), "no fixture Pack is Mandatory");

  assert.equal(view.refs["deliverable-name"][FIXTURE_CODES.input.code]?.id, stage1.inputDeliverable.id);
  assert.equal(view.refs["deliverable-name"][FIXTURE_CODES.output.code]?.id, stage1.outputDeliverable.id);
  assert.equal(view.refs["deliverable-name"][FIXTURE_CODES.review.code], undefined, "a catalogue Deliverable with no Definition has no reference");
  assert.equal(view.refs["deliverable-name"][FIXTURE_CODES.extra.code], undefined);

  assert.equal(view.parameterSources[`service::${stage1.service.code}`], stage1.service.shownName);

  assert.ok(view.graph, "the dependency graph is drawn");
  const catalogue = [FIXTURE_CODES.input.code, FIXTURE_CODES.output.code, FIXTURE_CODES.review.code, FIXTURE_CODES.extra.code];
  assert.deepEqual(view.graph.nodes.map((n) => n.code).sort(), [...catalogue].sort());
  assert.equal(view.graph.edges.length, 4, "the four Deliverable edges are drawn");
  const linked = view.graph.nodes.filter((n) => n.href !== null).map((n) => n.code).sort();
  assert.deepEqual(linked, [FIXTURE_CODES.input.code, FIXTURE_CODES.output.code].sort(), "a node links to its Deliverable Definition when it has one");
});

test("the Profile view resolves its Template and Packs, names the Service behind each override, and labels its Ontology values", async () => {
  const view = await getProfileView(stage1.profile.id, { isRoot: false, tenantId });
  assert.ok(view);
  assert.equal(view.profile.id, stage1.profile.id);
  assert.equal(view.refs["template-code"][stage1.template.code]?.id, stage1.template.id);

  const selected = [stage1.pack, stage1.basePack, stage1.engineeringPack, stage1.compliancePack, stage1.domainPack, stage1.organisationPack, stage1.integrationPack];
  for (const pack of selected) assert.equal(view.refs["pack-code"][pack.code]?.id, pack.id, `Pack ${pack.code} is resolved`);

  const overrides = stage1.profile.content.exposedParameterOverrides as Array<{ sourceType: string; sourceCode: string }>;
  const services = overrides.filter((row) => row.sourceType === "service");
  assert.ok(services.length > 0, "the Profile overrides at least one Service parameter");
  for (const row of services) assert.equal(view.parameterSources[`service::${row.sourceCode}`], stage1.service.shownName);

  assert.equal(typeof view.labels["category:environment"]?.[stage1.profile.content.environment as string], "string");
  assert.equal(view.content.knowledgeLocations && (view.content.knowledgeLocations as unknown[]).length, 1);
});

test("a tenant other than the owner sees none of the fixture rows", async () => {
  const other = await ensureFixtureTenant("views-other");
  assert.equal(await getProfileView(stage1.profile.id, { isRoot: false, tenantId: other }), null);
  assert.equal(await getTemplateView(stage1.template.id, { isRoot: false, tenantId: other }), null);
  assert.equal(await getPackView(stage1.pack.id, { isRoot: false, tenantId: other }), null);
  assert.equal(await getServiceDefinitionView(stage1.service.id, { isRoot: false, tenantId: other }), null);
  assert.equal(await getCapabilityDefinitionView(stage1.capability.id, { isRoot: false, tenantId: other }), null);
  assert.equal(await getDeliverableDefinitionView(stage1.inputDeliverable.id, { isRoot: false, tenantId: other }), null);
  assert.equal(await getPolicyView(stage1.policy.id, { isRoot: false, tenantId: other }), null);
});

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

test("the Template view names the Capability of each Service behind an exposed parameter", async () => {
  const view = await getTemplateView(stage1.template.id, { isRoot: false, tenantId });
  assert.ok(view);
  assert.ok(view.parameterCapabilities[`service::${stage1.service.code}`], "the Service's Capability is named");
});
