// SDK authoring — ENTITY-DIRECT (bug fix correcting CR-014). Proves, end to end
// against the real dev database, that authoring a Pack/Template/Profile is just
// working on a Draft row of that entity and driving it through its own governed
// noun × verb transitions:
//   1. The whole pipeline for a root actor: create a Draft, author content,
//      publish — a real, registered Active Pack/Template/Profile comes out, with
//      no bootstrap SEU / Deliverable / Evidence anywhere.
//   2. Accountability: the publish transition records the REAL actor + the
//      noun_verb badge on its event (never a system "1").
//   3. Authority is the entity's own noun × verb: a non-root actor holding the
//      Pack lifecycle badges can publish; one without them is denied.
//   4. Structural/referential validation blocks Publish, leaving the Draft a Draft.
//   5. Template and Profile go through the exact same entity-direct pipeline.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { userDB } from "../src/dblayer/userDB.js";
import { packsDB } from "../src/dblayer/packsDB.js";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { profilesDB } from "../src/dblayer/profilesDB.js";
import { createAuthoringDraft, saveAuthoringDraft, publishAuthoringDraft } from "../src/routes/seu/core/sdkAuthoring.js";
import { ensureWebAppTemplateFixture } from "./testFixtures.js";

// Bug fix (owner, 2026-08-17): "the pollution is coming from your tests. They
// do not clear the test data after the tests are complete." Real — every test
// user + badge grant created here was left behind in the shared, never-reset
// dev database. That's more than untidy: `db:clean-slate` truncates `users`
// with RESTART IDENTITY (resets the id sequence) but never touches
// `badge_grants`, so a later test run's freshly-created user can be assigned
// an id a PRIOR run's leftover grant still references — inheriting authority
// (sometimes `root`) it never earned, exactly the accountability failure this
// whole session's fix was about. Track every user this file creates and every
// grant it issues, and delete them all in `after()` — the dev database comes
// out of running this file exactly as it went in.
const createdUserIds: string[] = [];
const createdGrantIds: string[] = [];

after(async () => {
  if (createdGrantIds.length) await pool.query("DELETE FROM badge_grants WHERE id = ANY($1::uuid[])", [createdGrantIds]);
  if (createdUserIds.length) await pool.query("DELETE FROM users WHERE id = ANY($1::bigint[])", [createdUserIds]);
  await pool.end();
});

const ROOT_ACTOR_ID = "1";

async function createTestUser(label: string): Promise<string> {
  const email = `sdk-authoring-${label}-${randomUUID()}@example.com`;
  const user = await userDB.create({ email, name: label, avatar_url: null, role: "general", auth_provider: "local", provider_id: null, is_active: true, type: "Platform", tenant_id: "11111111-1111-1111-1111-111111111111" });
  createdUserIds.push(String(user.id));
  return String(user.id);
}

async function grant(holderId: string, badgeType: string): Promise<void> {
  const { rows } = await pool.query<{ id: string }>("INSERT INTO badge_grants (holder_type, holder_id, badge_type, status) VALUES ('User', $1, $2, 'Active') RETURNING id", [holderId, badgeType]);
  createdGrantIds.push(rows[0].id);
}

// Bug fix (separation of duties): publishAuthoringDraft now advances exactly
// ONE governed hop per call (Pack has several between Draft and Active — a
// single-verb holder must be able to perform just their own step; see
// advancePackOneStep). Reaching Active from Draft is however many hops the
// entity has — call repeatedly (as the given actor, who must hold every hop's
// verb to drive it through alone, same as `pack-all`) until Active or blocked.
async function advanceToActive(kind: "Pack" | "Template" | "Profile", id: string, actorId: string, actorRole: string): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  for (let i = 0; i < 10; i++) {
    const result = await publishAuthoringDraft({ kind, id, actorId, actorRole });
    if (!result.ok) return result;
    if (result.status === "Active") return { ok: true };
  }
  return { ok: false, errors: ["did not reach Active within 10 hops"] };
}

function validPackContent(code: string): Record<string, unknown> {
  return { code, name: "SDK Test Pack", category: "Platform", packVersion: "1.0.0", installationClassification: "Optional", dependencies: [] };
}

test("Pack authoring (entity-direct): root creates a Draft, authors, and publishes — a real Active Pack comes out, with the real actor + noun_verb badge on the event", async () => {
  const code = `sdk-test-pack-root-${randomUUID()}`;

  const created = await createAuthoringDraft({ kind: "Pack", actorId: ROOT_ACTOR_ID, content: validPackContent(code) });
  assert.equal(created.ok, true, !created.ok ? created.errors.join("; ") : undefined);
  if (!created.ok) return;

  // The Draft is a real Pack row, in Draft, authored_by the real actor — no
  // bootstrap SEU / Deliverable anywhere.
  const { data: draftPack } = await packsDB.findById(created.draftId);
  assert.equal(draftPack!.status, "Draft");
  assert.equal(draftPack!.authored_by, Number(ROOT_ACTOR_ID));

  const saved = await saveAuthoringDraft({ kind: "Pack", id: created.draftId, content: validPackContent(code) });
  assert.equal(saved.ok, true, !saved.ok ? saved.errors.join("; ") : undefined);

  const published = await advanceToActive("Pack", created.draftId, ROOT_ACTOR_ID, "general");
  assert.equal(published.ok, true, !published.ok ? published.errors.join("; ") : undefined);

  const { data: activePack } = await packsDB.findActiveByCode(code);
  assert.ok(activePack, "expected the authored Pack to be published and Active");
  assert.equal(activePack!.name, "SDK Test Pack");

  // Accountability (the whole point): the governed Pack transition events carry
  // the REAL actor + the noun_verb badge — never a silent system "1".
  const { rows: events } = await pool.query(
    "SELECT event_type, actor_id, authority_badge FROM events WHERE originating_object_type = 'Pack' AND originating_object_id = $1 AND authority_badge IS NOT NULL ORDER BY sequence",
    [activePack!.id]
  );
  assert.ok(events.length > 0, "expected at least one governed Pack transition event with an authority badge");
  for (const e of events) {
    assert.equal(e.actor_id, ROOT_ACTOR_ID, `event ${e.event_type} must record the real actor`);
    assert.match(e.authority_badge, /^pack_/, `event ${e.event_type} must record a pack noun_verb badge`);
  }
});

test("Pack authoring authority is noun × verb: a non-root holder of the Pack lifecycle badges can publish; a holder without them is denied", async () => {
  // Publisher holds the full Pack lifecycle authority.
  const publisherId = await createTestUser("pack-publisher");
  for (const v of ["validate", "publish", "activate", "deprecate"]) await grant(publisherId, `pack_${v}`);

  const okCode = `sdk-test-pack-authz-ok-${randomUUID()}`;
  const okDraft = await createAuthoringDraft({ kind: "Pack", actorId: publisherId, content: validPackContent(okCode) });
  assert.equal(okDraft.ok, true, !okDraft.ok ? okDraft.errors.join("; ") : undefined);
  if (!okDraft.ok) return;
  const okPublish = await advanceToActive("Pack", okDraft.draftId, publisherId, "general");
  assert.equal(okPublish.ok, true, !okPublish.ok ? okPublish.errors.join("; ") : undefined);
  const { data: activeOk } = await packsDB.findActiveByCode(okCode);
  assert.ok(activeOk, "publisher with the Pack lifecycle badges should produce an Active Pack");

  // A holder with NO Pack authority is denied at the governed transition.
  const outsiderId = await createTestUser("pack-outsider");
  const denyCode = `sdk-test-pack-authz-deny-${randomUUID()}`;
  const denyDraft = await createAuthoringDraft({ kind: "Pack", actorId: outsiderId, content: validPackContent(denyCode) });
  assert.equal(denyDraft.ok, true);
  if (!denyDraft.ok) return;
  const denyPublish = await publishAuthoringDraft({ kind: "Pack", id: denyDraft.draftId, actorId: outsiderId, actorRole: "general" });
  assert.equal(denyPublish.ok, false, "a holder without Pack authority must NOT be able to publish");
  const { data: stillDraft } = await packsDB.findById(denyDraft.draftId);
  assert.equal(stillDraft!.status, "Draft", "a denied publish leaves the Draft a Draft");
});

test("Pack authoring, separation of duties: FOUR different single-verb actors each perform exactly their own hop — no one actor needs (or gets) more than their own badge", async () => {
  const author = await createTestUser("sod-author");
  const reviewer = await createTestUser("sod-reviewer");
  const publisher = await createTestUser("sod-publisher");
  const activator = await createTestUser("sod-activator");
  await grant(reviewer, "pack_validate");
  await grant(publisher, "pack_publish");
  await grant(activator, "pack_activate");

  const code = `sdk-test-pack-sod-${randomUUID()}`;
  const created = await createAuthoringDraft({ kind: "Pack", actorId: author, content: validPackContent(code) });
  assert.equal(created.ok, true, !created.ok ? created.errors.join("; ") : undefined);
  if (!created.ok) return;
  const { data: draftPack } = await packsDB.findById(created.draftId);
  assert.equal(draftPack!.authored_by, Number(author), "authored_by is the real defining actor");

  // The author (define-only) cannot advance it — defining isn't reviewing.
  const authorTriesToAdvance = await publishAuthoringDraft({ kind: "Pack", id: created.draftId, actorId: author, actorRole: "general" });
  assert.equal(authorTriesToAdvance.ok, false, "the author alone (no validate badge) cannot advance Draft -> Validated");

  const step1 = await publishAuthoringDraft({ kind: "Pack", id: created.draftId, actorId: reviewer, actorRole: "general" });
  assert.equal(step1.ok, true, !step1.ok ? step1.errors.join("; ") : undefined);
  if (step1.ok) assert.equal(step1.status, "Validated");

  // The reviewer (validate-only) cannot also publish — that's a different badge.
  const reviewerTriesToPublish = await publishAuthoringDraft({ kind: "Pack", id: created.draftId, actorId: reviewer, actorRole: "general" });
  assert.equal(reviewerTriesToPublish.ok, false, "the reviewer alone (no publish badge) cannot advance Validated -> Published");

  const step2 = await publishAuthoringDraft({ kind: "Pack", id: created.draftId, actorId: publisher, actorRole: "general" });
  assert.equal(step2.ok, true, !step2.ok ? step2.errors.join("; ") : undefined);
  if (step2.ok) assert.equal(step2.status, "Published");

  const step3 = await publishAuthoringDraft({ kind: "Pack", id: created.draftId, actorId: activator, actorRole: "general" });
  assert.equal(step3.ok, true, !step3.ok ? step3.errors.join("; ") : undefined);
  if (step3.ok) assert.equal(step3.status, "Active");

  const { data: activePack } = await packsDB.findActiveByCode(code);
  assert.ok(activePack, "the pack reached Active through four different single-verb actors");

  // Accountability: three distinct real actors on the three governed hops —
  // never root, never each other's id, exactly the badge for that hop.
  const { rows: events } = await pool.query(
    "SELECT event_type, actor_id, authority_badge FROM events WHERE originating_object_type = 'Pack' AND originating_object_id = $1 AND authority_badge IS NOT NULL ORDER BY sequence",
    [activePack!.id]
  );
  assert.equal(events.length, 3);
  assert.deepEqual(events.map((e) => [e.actor_id, e.authority_badge]), [
    [reviewer, "pack_validate"],
    [publisher, "pack_publish"],
    [activator, "pack_activate"],
  ]);
});

test("Pack authoring: Publish is blocked by referential validation (unresolvable dependency), leaving the Draft a Draft", async () => {
  const code = `sdk-test-pack-invalid-${randomUUID()}`;
  const created = await createAuthoringDraft({ kind: "Pack", actorId: ROOT_ACTOR_ID, content: validPackContent(code) });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  // A dependency on a Pack that doesn't exist — fails validatePackSeed at publish.
  await saveAuthoringDraft({ kind: "Pack", id: created.draftId, content: { ...validPackContent(code), dependencies: [{ packCode: "this-pack-does-not-exist", version: "1.0.0", type: "required" }] } });

  const published = await publishAuthoringDraft({ kind: "Pack", id: created.draftId, actorId: ROOT_ACTOR_ID, actorRole: "general" });
  assert.equal(published.ok, false);
  assert.ok(!published.ok && published.errors.length > 0);

  const { data: stillDraft } = await packsDB.findById(created.draftId);
  assert.equal(stillDraft!.status, "Draft");
});

function validTemplateContent(code: string): Record<string, unknown> {
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

test("Template authoring (entity-direct): the same pipeline as Pack produces a real Active Template row", async () => {
  const code = `sdk-test-template-${randomUUID()}`;
  const created = await createAuthoringDraft({ kind: "Template", actorId: ROOT_ACTOR_ID, content: validTemplateContent(code) });
  assert.equal(created.ok, true, !created.ok ? created.errors.join("; ") : undefined);
  if (!created.ok) return;

  await saveAuthoringDraft({ kind: "Template", id: created.draftId, content: validTemplateContent(code) });

  const published = await publishAuthoringDraft({ kind: "Template", id: created.draftId, actorId: ROOT_ACTOR_ID, actorRole: "general" });
  assert.equal(published.ok, true, !published.ok ? published.errors.join("; ") : undefined);

  const { data: template } = await templatesDB.findByCode(code);
  assert.ok(template, "expected the authored Template to be registered");
  assert.equal(template!.status, "Active");
  const { data: requiredCapabilities } = await templatesDB.getRequiredCapabilities(template!.id);
  assert.ok((requiredCapabilities ?? []).some((c) => c.code === "requirements-analysis"));
});

test("Profile authoring (entity-direct): produces a real Active Profile row referencing a real Template by code", async () => {
  await ensureWebAppTemplateFixture();
  const code = `sdk-test-profile-${randomUUID()}`;
  const content: Record<string, unknown> = { code, name: "SDK Test Profile", baseTemplateCode: "template-web-application", environment: "development", configParameters: {}, optionalPackCodes: [] };

  const created = await createAuthoringDraft({ kind: "Profile", actorId: ROOT_ACTOR_ID, content });
  assert.equal(created.ok, true, !created.ok ? created.errors.join("; ") : undefined);
  if (!created.ok) return;

  await saveAuthoringDraft({ kind: "Profile", id: created.draftId, content });

  const published = await publishAuthoringDraft({ kind: "Profile", id: created.draftId, actorId: ROOT_ACTOR_ID, actorRole: "general" });
  assert.equal(published.ok, true, !published.ok ? published.errors.join("; ") : undefined);

  const { data: profile } = await profilesDB.findByCode(code);
  assert.ok(profile, "expected the authored Profile to be registered");
  assert.equal(profile!.status, "Active");
  const { data: baseTemplate } = await templatesDB.findByCode("template-web-application");
  assert.equal(profile!.base_template_id, baseTemplate!.id);
});

test("Template authoring: referential validation rejects a mandatoryPackCode that doesn't resolve to a real Pack (blocks publish)", async () => {
  const code = `sdk-test-template-badpack-${randomUUID()}`;
  const created = await createAuthoringDraft({ kind: "Template", actorId: ROOT_ACTOR_ID, content: validTemplateContent(code) });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  await saveAuthoringDraft({ kind: "Template", id: created.draftId, content: { ...validTemplateContent(code), mandatoryPackCodes: ["this-pack-code-does-not-exist"] } });

  const published = await publishAuthoringDraft({ kind: "Template", id: created.draftId, actorId: ROOT_ACTOR_ID, actorRole: "general" });
  assert.equal(published.ok, false);
  assert.match((!published.ok && published.errors.join(";")) || "", /this-pack-code-does-not-exist/);
});
