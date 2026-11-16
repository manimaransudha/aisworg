// The Obligation named by `:obligationId` in an SEU route is scoped to the tenant of the viewer through its owning SEU
// (obligationTenantScope in src/middleware/seuTenantScope.ts). An Obligation has no tenant column of its own.
// The two routes under test are the transition and the revise routes of routes/seu/web/seus.ts. The viewer is the seeded
// Athens tester, and the other tenant is the seeded Babylon tester's tenant.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import app from "../src/app.js";
import { seusDB } from "../src/dblayer/seusDB.js";
import { objectivesDB } from "../src/dblayer/objectivesDB.js";
import { profilesDB } from "../src/dblayer/profilesDB.js";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { obligationsDB } from "../src/dblayer/obligationsDB.js";
import { participantsMasterDB } from "../src/dblayer/participantsMasterDB.js";
import { ensureSeuSystemParticipant } from "../src/dblayer/constants.js";
import {
  ensureWebAppTemplateFixture,
  createObligationAsRoot,
  ensureActorParticipant,
  grantRole,
  grantRouteBadges,
  newSession,
  getPage,
  postForm,
  extractCsrf,
  setWebBaseUrl,
  seuBirthState,
  ROOT_ACTOR_BADGE,
  TESTER_ALL_ID,
  TESTER_OBJECTIVE_ATHENS,
  TESTER_OBJECTIVE_BABYLON,
} from "./testFixtures.js";

let server: ReturnType<typeof app.listen>;

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("failed to determine the ephemeral port the app bound to");
  setWebBaseUrl(`http://127.0.0.1:${address.port}/aisworg`);
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((err: Error | undefined) => (err ? reject(err) : resolve())));
});

async function tenantOf(participantId: string): Promise<string> {
  const { data: master } = await participantsMasterDB.findById(participantId);
  if (!master) throw new Error(`no participants_master row ${participantId}`);
  return master.tenant_id;
}

// An SEU in the given tenant, with a fresh Active Objective of its own (an Objective holds at most one live SEU).
async function seuInTenant(tenantId: string): Promise<string> {
  await ensureWebAppTemplateFixture();
  const { data: template } = await templatesDB.findByCode("test-enterprise-web-application");
  const { data: profile } = await profilesDB.findByCode("test-profile-default-development");
  assert.ok(template && profile, "the web application Template and Profile fixture exist");
  const { data: objective } = await objectivesDB.create({
    statement: `obligation-tenant-scope-${randomUUID()}`,
    tier: "Strategic",
    status: "Active",
    requestedBy: TESTER_ALL_ID,
    authorId: TESTER_ALL_ID,
    authorBadge: "root",
  });
  assert.ok(objective, "an Objective is created");
  const { data: seu, error } = await seusDB.create({
    lifecycleState: await seuBirthState(),
    authorBadge: ROOT_ACTOR_BADGE,
    objectiveId: objective.id,
    templateId: template.id,
    profileId: profile.id,
    requestedBy: TESTER_ALL_ID,
    tenantId,
  });
  if (error || !seu) throw error ?? new Error("failed to create the SEU");
  await ensureSeuSystemParticipant(seu.id);
  return seu.id;
}

async function obligationIn(seuId: string, title: string): Promise<string> {
  const obligation = await createObligationAsRoot({
    relatedObjectType: "SEU",
    relatedObjectId: seuId,
    category: "Engineering",
    title: `${title} ${randomUUID()}`,
    description: "original description",
    severity: "Medium",
  });
  return obligation.id;
}

test("the Obligation named in an SEU route is scoped to the viewer's tenant through its owning SEU", async () => {
  const athensTenantId = await tenantOf(TESTER_OBJECTIVE_ATHENS.participantId);
  const babylonTenantId = await tenantOf(TESTER_OBJECTIVE_BABYLON.participantId);
  assert.notEqual(athensTenantId, babylonTenantId, "the two seeded testers sit in different tenants");

  const athensSeuId = await seuInTenant(athensTenantId);
  const babylonSeuId = await seuInTenant(babylonTenantId);
  const ownObligationId = await obligationIn(athensSeuId, "own tenant");
  const foreignObligationId = await obligationIn(babylonSeuId, "other tenant");
  await ensureActorParticipant(athensSeuId, TESTER_OBJECTIVE_ATHENS.participantId);

  const analysePath = (obligationId: string) => `/seu/seus/${athensSeuId}/obligations/${obligationId}/transition/analyse`;
  const revisePath = (obligationId: string) => `/seu/seus/${athensSeuId}/obligations/${obligationId}/revise`;

  // The transition route needs the badge of the hop. The shared tester's badges are put back afterwards.
  const { data: viewerMaster } = await participantsMasterDB.findById(TESTER_OBJECTIVE_ATHENS.participantId);
  assert.ok(viewerMaster);
  const originalBadges = viewerMaster.authorised_badges;
  const restoreRole = await grantRole(TESTER_OBJECTIVE_ATHENS.participantId, "demo");
  try {
    await grantRouteBadges(TESTER_OBJECTIVE_ATHENS.participantId, "POST", `/aisworg${analysePath(ownObligationId)}`);

    const viewer = newSession(TESTER_OBJECTIVE_ATHENS.userId);
    const csrf = extractCsrf((await getPage(viewer, "/seu/objectives")).html);

    // Positive control: an Obligation of the viewer's own tenant can be revised and transitioned.
    const ownRevise = await postForm(viewer, revisePath(ownObligationId), csrf, { description: "revised by its own tenant" });
    assert.equal(ownRevise.status, 302);
    const { data: ownRevised } = await obligationsDB.findById(ownObligationId);
    assert.equal(ownRevised!.description, "revised by its own tenant");

    const ownTransition = await postForm(viewer, analysePath(ownObligationId), csrf, {});
    assert.equal(ownTransition.status, 302);
    const { data: ownMoved } = await obligationsDB.findById(ownObligationId);
    assert.equal(ownMoved!.status, "Analysed", "the guard lets the viewer's own Obligation through");

    // The SEU in the path is the viewer's own, so only the Obligation's tenant can refuse these two requests.
    const foreignRevise = await postForm(viewer, revisePath(foreignObligationId), csrf, { description: "revised from another tenant" });
    assert.equal(foreignRevise.status, 302);
    const foreignTransition = await postForm(viewer, analysePath(foreignObligationId), csrf, {});
    assert.equal(foreignTransition.status, 302);
    const { data: foreign } = await obligationsDB.findById(foreignObligationId);
    assert.equal(foreign!.description, "original description", "the other tenant's Obligation is not revised");
    assert.deepEqual(foreign!.revision_history, [], "no revision is recorded on the other tenant's Obligation");
    assert.equal(foreign!.status, "Identified", "the other tenant's Obligation is not transitioned");

    // An Obligation id that does not exist gets the same refusal, so the viewer cannot tell the two apart.
    const missingRevise = await postForm(viewer, revisePath(randomUUID()), csrf, { description: "no such Obligation" });
    assert.equal(missingRevise.status, foreignRevise.status);
    assert.equal(missingRevise.location, foreignRevise.location);
  } finally {
    await restoreRole();
    const { error } = await participantsMasterDB.setAuthorisedBadges(TESTER_OBJECTIVE_ATHENS.participantId, originalBadges);
    if (error) throw error;
  }
});
