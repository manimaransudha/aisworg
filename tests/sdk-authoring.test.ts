// SDK UI Layer Plan (design/mvp-build-plan/SDK UI Layer Plan.md) — the
// authoring surfaces' shared pipeline (Build order steps 1-5). Proves, end
// to end and against the real dev database (same discipline as every other
// engine-layer test in this project):
//   1. The whole pipeline for a root actor: commission the bootstrap SEU,
//      author content against the generated grammar, review, publish — a
//      real, registered Pack/Template/Profile comes out the other end.
//   2. The access-control resolution actually works for a non-root actor:
//      a flat sdk_creator/sdk_approver badge holder gets a correctly-scoped
//      Engineering-badge grant auto-provisioned the first time they act
//      (014_sdk_authoring.sql's header comment), not just root's bypass.
//   3. Structural (grammar) validation blocks Review on an invalid document,
//      without transitioning the Deliverable.
//   4. Template and Profile go through the exact same generic pipeline as
//      Pack (Build order step 4's whole point — "this is where the
//      generator actually pays for itself"), not a separate one.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { userDB } from "../src/dblayer/userDB.js";
import { deliverablesDB } from "../src/dblayer/deliverablesDB.js";
import { badgeGrantsDB } from "../src/dblayer/badgeGrantsDB.js";
import { packsDB } from "../src/dblayer/packsDB.js";
import { deliverableAuthoringContentDB } from "../src/dblayer/deliverableAuthoringContentDB.js";
import { startAuthoring, saveAuthoringContent, submitForReview, publishAuthoredContent } from "../src/routes/seu/core/sdkAuthoring.js";
import { createEvidence, transitionEvidence } from "../src/routes/seu/core/evidence.js";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { profilesDB } from "../src/dblayer/profilesDB.js";
import type { PackSeedInput } from "../src/routes/seu/core/packs.js";
import type { TemplateSeedInput } from "../src/routes/seu/core/templates.js";
import type { ProfileSeedInput } from "../src/routes/seu/core/profiles.js";

after(async () => {
  await pool.end();
});

const ROOT_ACTOR_ID = "1";

async function createTestUser(label: string): Promise<string> {
  const email = `sdk-authoring-${label}-${randomUUID()}@example.com`;
  const user = await userDB.create({ email, name: label, avatar_url: null, role: "general", auth_provider: "local", provider_id: null, is_active: true });
  return String(user.id);
}

// Deliverable's In Progress -> Approved is gated by a Quality Gate requiring
// accepted Evidence or an approved Decision, same as any Deliverable (the
// SDK UI Layer Plan's own decision: Quality Gates apply uniformly, not
// forked by category) — attaching it is the reviewer's job via the
// underlying SEU's own detail page in the real UI; this mirrors that here.
async function acceptReviewEvidence(seuId: string, deliverableId: string): Promise<void> {
  const evidence = await createEvidence({
    seuId,
    relatedObjectType: "Deliverable",
    relatedObjectId: deliverableId,
    category: "Review",
    title: "Reviewer confirms the authored document is complete and correct",
  });
  const validated = await transitionEvidence({ evidenceId: evidence.id, targetState: "Validated", actorRole: "general" });
  assert.equal(validated.ok, true);
  const accepted = await transitionEvidence({ evidenceId: evidence.id, targetState: "Accepted", actorRole: "general" });
  assert.equal(accepted.ok, true);
}

function validPackSeed(code: string): PackSeedInput {
  return {
    code,
    name: "SDK Test Pack",
    category: "Platform",
    packVersion: "1.0.0",
    installationClassification: "Optional",
    dependencies: [],
    contributions: {},
  };
}

test("Pack authoring: root actor drives Create -> author -> Review -> Publish and a real Active Pack comes out", async () => {
  const code = `sdk-test-pack-root-${randomUUID()}`;

  const started = await startAuthoring({ kind: "Pack", actorId: ROOT_ACTOR_ID, actorName: "Root", actorRole: "general" });
  assert.equal(started.deliverable.lifecycle_state, "In Progress");
  assert.equal(started.deliverable.category, "Pack Definition");

  await saveAuthoringContent(started.deliverable.id, validPackSeed(code) as unknown as Record<string, unknown>);
  await acceptReviewEvidence(started.seu.id, started.deliverable.id);

  const reviewed = await submitForReview({ deliverableId: started.deliverable.id, kind: "Pack", actorId: ROOT_ACTOR_ID, actorRole: "general" });
  assert.equal(reviewed.ok, true, reviewed.errors?.join("; "));
  assert.equal(reviewed.deliverable?.lifecycle_state, "Approved");

  const published = await publishAuthoredContent({ deliverableId: started.deliverable.id, kind: "Pack", actorId: ROOT_ACTOR_ID, actorRole: "general" });
  assert.equal(published.ok, true, published.errors?.join("; "));
  assert.equal(published.deliverable?.lifecycle_state, "Baselined");

  const { data: activePack } = await packsDB.findActiveByCode(code);
  assert.ok(activePack, "expected the authored Pack to be published and Active");
  assert.equal(activePack!.name, "SDK Test Pack");
});

test("Pack authoring: a flat sdk_creator/sdk_approver badge holder (not root) gets the right scoped grant auto-provisioned, not just root's bypass", async () => {
  const creatorId = await createTestUser("creator");
  const approverId = await createTestUser("approver");

  // Flat, Platform-scoped grants — what a person actually holds after
  // Identity Management grants them "may author Packs"/"may approve Packs".
  const creatorFlat = await badgeGrantsDB.create({ holderId: creatorId, badgeType: "sdk_creator" });
  assert.ok(!("validationErrors" in creatorFlat) && !creatorFlat.error);
  const approverFlat = await badgeGrantsDB.create({ holderId: approverId, badgeType: "sdk_approver" });
  assert.ok(!("validationErrors" in approverFlat) && !approverFlat.error);

  const code = `sdk-test-pack-flatbadge-${randomUUID()}`;
  const started = await startAuthoring({ kind: "Pack", actorId: creatorId, actorName: "Creator", actorRole: "general" });
  assert.equal(started.deliverable.lifecycle_state, "In Progress");

  await saveAuthoringContent(started.deliverable.id, validPackSeed(code) as unknown as Record<string, unknown>);
  await acceptReviewEvidence(started.seu.id, started.deliverable.id);

  // A different actor — the approver — performs Review, proving the acting
  // badge is resolved per-actor, not just whoever created the session.
  const reviewed = await submitForReview({ deliverableId: started.deliverable.id, kind: "Pack", actorId: approverId, actorRole: "general" });
  assert.equal(reviewed.ok, true, reviewed.errors?.join("; "));

  const published = await publishAuthoredContent({ deliverableId: started.deliverable.id, kind: "Pack", actorId: approverId, actorRole: "general" });
  assert.equal(published.ok, true, published.errors?.join("; "));

  const { data: activePack } = await packsDB.findActiveByCode(code);
  assert.ok(activePack, "expected the flat-badge-authored Pack to be published and Active");

  // The scoped Engineering-badge grant was auto-provisioned, not pre-existing.
  const { data: creatorGrants } = await badgeGrantsDB.findActiveByHolderAndType(creatorId, "creator");
  assert.ok((creatorGrants ?? []).some((g) => g.governed_entity_type === "Deliverable" && g.scope_id === "sdk-authoring-scope"));
});

test("Pack authoring: Review is blocked by structural validation on an incomplete document, and the Deliverable stays In Progress", async () => {
  const started = await startAuthoring({ kind: "Pack", actorId: ROOT_ACTOR_ID, actorName: "Root", actorRole: "general" });

  // Missing required fields (name, category, packVersion, installationClassification).
  await saveAuthoringContent(started.deliverable.id, { code: `sdk-test-pack-invalid-${randomUUID()}` });

  const reviewed = await submitForReview({ deliverableId: started.deliverable.id, kind: "Pack", actorId: ROOT_ACTOR_ID, actorRole: "general" });
  assert.equal(reviewed.ok, false);
  assert.ok((reviewed.errors ?? []).length > 0);

  const { data: content } = await deliverableAuthoringContentDB.findByDeliverableId(started.deliverable.id);
  assert.ok(content);

  const { data: stillInProgress } = await deliverablesDB.findById(started.deliverable.id);
  assert.equal(stillInProgress?.lifecycle_state, "In Progress");
});

function validTemplateSeed(code: string): TemplateSeedInput {
  return {
    code,
    name: "SDK Test Template",
    requiredCapabilityCodes: ["requirements-analysis"],
    mandatoryPackCodes: [],
    deliverableCatalogue: [
      { code: "requirements-spec", name: "Requirements Specification", category: "Documentation", producingCapabilityCode: "requirements-analysis" },
    ],
  };
}

test("Template authoring: the same generic pipeline as Pack produces a real Template row", async () => {
  const code = `sdk-test-template-${randomUUID()}`;

  const started = await startAuthoring({ kind: "Template", actorId: ROOT_ACTOR_ID, actorName: "Root", actorRole: "general" });
  assert.equal(started.deliverable.category, "Template Definition");

  await saveAuthoringContent(started.deliverable.id, validTemplateSeed(code) as unknown as Record<string, unknown>);
  await acceptReviewEvidence(started.seu.id, started.deliverable.id);

  const reviewed = await submitForReview({ deliverableId: started.deliverable.id, kind: "Template", actorId: ROOT_ACTOR_ID, actorRole: "general" });
  assert.equal(reviewed.ok, true, reviewed.errors?.join("; "));

  const published = await publishAuthoredContent({ deliverableId: started.deliverable.id, kind: "Template", actorId: ROOT_ACTOR_ID, actorRole: "general" });
  assert.equal(published.ok, true, published.errors?.join("; "));

  const { data: template } = await templatesDB.findByCode(code);
  assert.ok(template, "expected the authored Template to be registered");
  const { data: requiredCapabilities } = await templatesDB.getRequiredCapabilities(template!.id);
  assert.ok((requiredCapabilities ?? []).some((c) => c.code === "requirements-analysis"));
});

test("Profile authoring: the same generic pipeline as Pack produces a real Profile row, referencing a real Template by code", async () => {
  const code = `sdk-test-profile-${randomUUID()}`;
  const seed: ProfileSeedInput = {
    code,
    name: "SDK Test Profile",
    baseTemplateCode: "template-web-application",
    environment: "development",
    configParameters: {},
    optionalPackCodes: [],
  };

  const started = await startAuthoring({ kind: "Profile", actorId: ROOT_ACTOR_ID, actorName: "Root", actorRole: "general" });
  assert.equal(started.deliverable.category, "Profile Definition");

  await saveAuthoringContent(started.deliverable.id, seed as unknown as Record<string, unknown>);
  await acceptReviewEvidence(started.seu.id, started.deliverable.id);

  const reviewed = await submitForReview({ deliverableId: started.deliverable.id, kind: "Profile", actorId: ROOT_ACTOR_ID, actorRole: "general" });
  assert.equal(reviewed.ok, true, reviewed.errors?.join("; "));

  const published = await publishAuthoredContent({ deliverableId: started.deliverable.id, kind: "Profile", actorId: ROOT_ACTOR_ID, actorRole: "general" });
  assert.equal(published.ok, true, published.errors?.join("; "));

  const { data: profile } = await profilesDB.findByCode(code);
  assert.ok(profile, "expected the authored Profile to be registered");
  const { data: baseTemplate } = await templatesDB.findByCode("template-web-application");
  assert.equal(profile!.base_template_id, baseTemplate!.id);
});

test("Template authoring: referential validation rejects a mandatoryPackCode that doesn't resolve to a real Pack", async () => {
  const started = await startAuthoring({ kind: "Template", actorId: ROOT_ACTOR_ID, actorName: "Root", actorRole: "general" });
  const seed = validTemplateSeed(`sdk-test-template-badpack-${randomUUID()}`);
  seed.mandatoryPackCodes = ["this-pack-code-does-not-exist"];
  await saveAuthoringContent(started.deliverable.id, seed as unknown as Record<string, unknown>);

  const reviewed = await submitForReview({ deliverableId: started.deliverable.id, kind: "Template", actorId: ROOT_ACTOR_ID, actorRole: "general" });
  assert.equal(reviewed.ok, false);
  assert.match((reviewed.errors ?? []).join(";"), /this-pack-code-does-not-exist/);
});
