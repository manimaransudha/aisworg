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
import { deliverableDefinitionsDB } from "../src/dblayer/deliverableDefinitionsDB.js";
import { ontologyDB } from "../src/dblayer/ontologyDB.js";
import { PLATFORM_TENANT_ID } from "../src/dblayer/constants.js";
import {
  createAuthoringDraft, saveAuthoringDraft, publishAuthoringDraft,
  listInheritableTemplates, inheritedTemplateContent,
  listInheritableProfiles, inheritedProfileContent,
} from "../src/routes/seu/core/sdkAuthoring.js";
import { listInheritableDeliverableDefinitions } from "../src/routes/seu/core/deliverableDefinitions.js";
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
// CR-026 — inheritance tests can't rely on a randomUUID()'d `code` the way
// every other test here does (an inherited Draft's code is FORCED to match
// its parent's — that's the whole point) — so a rerun against the same,
// never-reset dev database would collide with the previous run's own leftover
// row at the same (parent's code, "1.0.0", tenant). Tracked and deleted here,
// same discipline as the user/grant cleanup above.
const createdTemplateIds: string[] = [];
// Owner, 2026-08-19 — same discipline for Profile now that it has real
// (code, version, tenant) identity + inheritance too: an inheriting Draft's
// code is FORCED to match its parent's, so leftover rows from a prior run
// would collide the same way Template's own leftovers would.
const createdProfileIds: string[] = [];
// CR-046 (owner: "why are test scripts adding code that is not in the
// ontology??? ... Make sure the pack and profile view pages are also
// cleaned up and test data population does not corrupt the database") —
// Pack rows this file publishes were never tracked for cleanup at all before
// this fix, unlike Template/Profile above; every run left an Active Pack
// behind permanently.
const createdPackIds: string[] = [];
// CR-049 — same discipline: track every deliverable_definitions row (and the
// ontology_concepts row(s) they materialise/sync) so a rerun against this
// never-reset dev database doesn't collide or leave junk behind.
const createdDeliverableDefinitionIds: string[] = [];
const createdOntologyConceptCodes: string[] = [];

after(async () => {
  if (createdGrantIds.length) await pool.query("DELETE FROM badge_grants WHERE id = ANY($1::uuid[])", [createdGrantIds]);
  if (createdUserIds.length) await pool.query("DELETE FROM users WHERE id = ANY($1::bigint[])", [createdUserIds]);
  if (createdOntologyConceptCodes.length) {
    await pool.query("DELETE FROM ontology_concepts WHERE concept_type = 'deliverable-name' AND code = ANY($1::text[])", [createdOntologyConceptCodes]);
  }
  if (createdDeliverableDefinitionIds.length) {
    await pool.query("UPDATE deliverable_definitions SET parent_deliverable_definition_id = NULL WHERE id = ANY($1::uuid[])", [createdDeliverableDefinitionIds]);
    await pool.query("DELETE FROM events WHERE originating_object_type = 'DeliverableDefinition' AND originating_object_id = ANY($1::uuid[])", [createdDeliverableDefinitionIds]);
    await pool.query("DELETE FROM deliverable_definitions WHERE id = ANY($1::uuid[])", [createdDeliverableDefinitionIds]);
  }
  if (createdPackIds.length) {
    await pool.query("DELETE FROM events WHERE originating_object_type = 'Pack' AND originating_object_id = ANY($1::uuid[])", [createdPackIds]);
    await pool.query("DELETE FROM packs WHERE id = ANY($1::uuid[])", [createdPackIds]);
  }
  if (createdProfileIds.length) {
    // Profiles reference Templates via base_template_id — must be deleted
    // before createdTemplateIds' own cleanup below runs. Clear
    // parent_profile_id references first too — deleting a parent before its
    // child (inheritance) would otherwise violate the self-FK.
    await pool.query("UPDATE profiles SET parent_profile_id = NULL WHERE id = ANY($1::uuid[])", [createdProfileIds]);
    await pool.query("DELETE FROM profile_packs WHERE profile_id = ANY($1::uuid[])", [createdProfileIds]);
    await pool.query("DELETE FROM events WHERE originating_object_type = 'Profile' AND originating_object_id = ANY($1::uuid[])", [createdProfileIds]);
    await pool.query("DELETE FROM profiles WHERE id = ANY($1::uuid[])", [createdProfileIds]);
  }
  if (createdTemplateIds.length) {
    await pool.query("DELETE FROM template_packs WHERE template_id = ANY($1::uuid[])", [createdTemplateIds]);
    await pool.query("DELETE FROM template_capabilities WHERE template_id = ANY($1::uuid[])", [createdTemplateIds]);
    await pool.query("DELETE FROM events WHERE originating_object_type = 'Template' AND originating_object_id = ANY($1::uuid[])", [createdTemplateIds]);
    await pool.query("DELETE FROM templates WHERE id = ANY($1::uuid[])", [createdTemplateIds]);
  }
  await pool.end();
});

const ROOT_ACTOR_ID = "1";

// CR-026 — real, seeded tenants (seedIdentityBaseline.ts's "Demo" and
// "Athens" tenants), used only to prove Template Inheritance/ownership
// against genuine, distinct tenants, not made-up UUIDs. Two distinct tenants
// are needed across the tests below: each inheriting Draft's identity is
// (parent's code, "1.0.0", tenant) — two Drafts inheriting the SAME parent
// under the SAME tenant would collide on that first free version, the same
// way two Drafts of anything else would (assertTemplateCodeVersionFree).
const DEMO_TENANT_ID = "22222222-2222-2222-2222-222222222222";
const ATHENS_TENANT_ID = "adfbc3d0-d00e-440b-a115-6b7988ca2865";

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
async function advanceToActive(kind: "Pack" | "Template" | "Profile" | "Deliverable", id: string, actorId: string, actorRole: string): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  for (let i = 0; i < 10; i++) {
    const result = await publishAuthoringDraft({ kind, id, actorId, actorRole });
    if (!result.ok) return result;
    if (result.status === "Active") return { ok: true };
  }
  return { ok: false, errors: ["did not reach Active within 10 hops"] };
}

// CR-046 (owner: "the test script should use a code present in the
// ontology") — Pack.code (capability-name) and Template.code
// (template-categories) are now server-side Ontology-validated at publish
// time (validatePackSeed/validateTemplateSeed's own assertCanonicalCategory
// check — see the fix that added it), so a hand-typed random string no
// longer survives Publish here. Identity across repeated runs against this
// file's own, never-reset dev database instead comes from a fresh
// packVersion/templateVersion each call — free text, no Ontology
// constraint — not from code, which now stays a small set of real, fixed
// concepts.
function uniqueVersion(): string {
  return `0.0.${Date.now()}${Math.floor(Math.random() * 1000)}`;
}
const REAL_PACK_CODE = "development"; // real, seeded capability-name concept
const REAL_TEMPLATE_CODE = "mobile-application"; // real, seeded template-categories concept

function validPackContent(code: string, packVersion: string): Record<string, unknown> {
  return { code, name: "SDK Test Pack", category: "Engineering", packVersion, installationClassification: "Optional", dependencies: [] };
}

test("Pack authoring (entity-direct): root creates a Draft, authors, and publishes — a real Active Pack comes out, with the real actor + noun_verb badge on the event", async () => {
  const code = REAL_PACK_CODE;
  const packVersion = uniqueVersion();

  const created = await createAuthoringDraft({ kind: "Pack", actorId: ROOT_ACTOR_ID, content: validPackContent(code, packVersion) });
  assert.equal(created.ok, true, !created.ok ? created.errors.join("; ") : undefined);
  if (!created.ok) return;
  createdPackIds.push(created.draftId);

  // The Draft is a real Pack row, in Draft, authored_by the real actor — no
  // bootstrap SEU / Deliverable anywhere.
  const { data: draftPack } = await packsDB.findById(created.draftId);
  assert.equal(draftPack!.status, "Draft");
  assert.equal(draftPack!.authored_by, Number(ROOT_ACTOR_ID));

  const saved = await saveAuthoringDraft({ kind: "Pack", id: created.draftId, content: validPackContent(code, packVersion) });
  assert.equal(saved.ok, true, !saved.ok ? saved.errors.join("; ") : undefined);

  const published = await advanceToActive("Pack", created.draftId, ROOT_ACTOR_ID, "general");
  assert.equal(published.ok, true, !published.ok ? published.errors.join("; ") : undefined);

  const { data: activePack } = await packsDB.findByCodeAndVersion(code, packVersion);
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

  const okVersion = uniqueVersion();
  const okDraft = await createAuthoringDraft({ kind: "Pack", actorId: publisherId, content: validPackContent(REAL_PACK_CODE, okVersion) });
  assert.equal(okDraft.ok, true, !okDraft.ok ? okDraft.errors.join("; ") : undefined);
  if (!okDraft.ok) return;
  createdPackIds.push(okDraft.draftId);
  const okPublish = await advanceToActive("Pack", okDraft.draftId, publisherId, "general");
  assert.equal(okPublish.ok, true, !okPublish.ok ? okPublish.errors.join("; ") : undefined);
  const { data: activeOk } = await packsDB.findByCodeAndVersion(REAL_PACK_CODE, okVersion);
  assert.ok(activeOk, "publisher with the Pack lifecycle badges should produce an Active Pack");

  // A holder with NO Pack authority is denied at the governed transition.
  const outsiderId = await createTestUser("pack-outsider");
  const denyDraft = await createAuthoringDraft({ kind: "Pack", actorId: outsiderId, content: validPackContent(REAL_PACK_CODE, uniqueVersion()) });
  assert.equal(denyDraft.ok, true);
  if (!denyDraft.ok) return;
  createdPackIds.push(denyDraft.draftId);
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

  const packVersion = uniqueVersion();
  const created = await createAuthoringDraft({ kind: "Pack", actorId: author, content: validPackContent(REAL_PACK_CODE, packVersion) });
  assert.equal(created.ok, true, !created.ok ? created.errors.join("; ") : undefined);
  if (!created.ok) return;
  createdPackIds.push(created.draftId);
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

  const { data: activePack } = await packsDB.findByCodeAndVersion(REAL_PACK_CODE, packVersion);
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
  const packVersion = uniqueVersion();
  const created = await createAuthoringDraft({ kind: "Pack", actorId: ROOT_ACTOR_ID, content: validPackContent(REAL_PACK_CODE, packVersion) });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  createdPackIds.push(created.draftId);

  // A dependency on a Pack that doesn't exist — fails validatePackSeed at publish.
  await saveAuthoringDraft({ kind: "Pack", id: created.draftId, content: { ...validPackContent(REAL_PACK_CODE, packVersion), dependencies: [{ packCode: "this-pack-does-not-exist", version: "1.0.0", type: "required" }] } });

  const published = await publishAuthoringDraft({ kind: "Pack", id: created.draftId, actorId: ROOT_ACTOR_ID, actorRole: "general" });
  assert.equal(published.ok, false);
  assert.ok(!published.ok && published.errors.length > 0);

  const { data: stillDraft } = await packsDB.findById(created.draftId);
  assert.equal(stillDraft!.status, "Draft");
});

// CR-038 — requiredCapabilityCodes/mandatoryPackCodes replaced by
// engineeringPackCodes: platform-core-engineering (a real, base, Active Pack
// — category Engineering) contributes requirements-analysis among its
// capabilities, so requiredCapabilityCodes is derived from this selection,
// not hand-typed.
function validTemplateContent(code: string, templateVersion: string): Record<string, unknown> {
  return {
    code,
    templateVersion,
    name: "SDK Test Template",
    engineeringPackCodes: [{ packCode: "platform-core-engineering" }],
    deliverableCatalogue: [
      { code: "requirements-spec", name: "Requirements Specification", category: "Documentation", producingCapabilityCode: "requirements-analysis" },
    ],
  };
}

test("Template authoring (entity-direct): the same pipeline as Pack produces a real Active Template row", async () => {
  const templateVersion = uniqueVersion();
  const created = await createAuthoringDraft({ kind: "Template", actorId: ROOT_ACTOR_ID, content: validTemplateContent(REAL_TEMPLATE_CODE, templateVersion) });
  assert.equal(created.ok, true, !created.ok ? created.errors.join("; ") : undefined);
  if (!created.ok) return;
  createdTemplateIds.push(created.draftId);

  await saveAuthoringDraft({ kind: "Template", id: created.draftId, content: validTemplateContent(REAL_TEMPLATE_CODE, templateVersion) });

  // Bug fix (owner, 2026-08-18): Template now has the same six-hop lifecycle
  // Pack does (transitionDefinitions.json / authorityVocabulary.json seed
  // change) — one publishAuthoringDraft call only advances one hop, same as
  // Pack; root holds every verb, so advanceToActive drives it straight
  // through, same as the Pack test above.
  const published = await advanceToActive("Template", created.draftId, ROOT_ACTOR_ID, "general");
  assert.equal(published.ok, true, !published.ok ? published.errors.join("; ") : undefined);

  const { data: template } = await templatesDB.findByCodeAndVersion(REAL_TEMPLATE_CODE, templateVersion);
  assert.ok(template, "expected the authored Template to be registered");
  assert.equal(template!.status, "Active");
  const { data: requiredCapabilities } = await templatesDB.getRequiredCapabilities(template!.id);
  assert.ok((requiredCapabilities ?? []).some((c) => c.code === "requirements-analysis"));
});

test("Profile authoring (entity-direct): produces a real Active Profile row referencing a real Template by code", async () => {
  await ensureWebAppTemplateFixture();
  const code = `sdk-test-profile-${randomUUID()}`;
  const content: Record<string, unknown> = { code, name: "SDK Test Profile", baseTemplateCode: "enterprise-web-application", environment: "development", category: "startup", configParameters: {}, optionalPackCodes: [] };

  const created = await createAuthoringDraft({ kind: "Profile", actorId: ROOT_ACTOR_ID, content });
  assert.equal(created.ok, true, !created.ok ? created.errors.join("; ") : undefined);
  if (!created.ok) return;

  await saveAuthoringDraft({ kind: "Profile", id: created.draftId, content });

  // Bug fix (owner, 2026-08-18): same six-hop lifecycle change as Template above.
  const published = await advanceToActive("Profile", created.draftId, ROOT_ACTOR_ID, "general");
  assert.equal(published.ok, true, !published.ok ? published.errors.join("; ") : undefined);

  const { data: profile } = await profilesDB.findByCode(code);
  assert.ok(profile, "expected the authored Profile to be registered");
  assert.equal(profile!.status, "Active");
  const { data: baseTemplate } = await templatesDB.findByCode("enterprise-web-application");
  assert.equal(profile!.base_template_id, baseTemplate!.id);
});

test("Template authoring: referential validation rejects a mandatoryPackCode that doesn't resolve to a real Pack (blocks publish)", async () => {
  const templateVersion = uniqueVersion();
  const created = await createAuthoringDraft({ kind: "Template", actorId: ROOT_ACTOR_ID, content: validTemplateContent(REAL_TEMPLATE_CODE, templateVersion) });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  createdTemplateIds.push(created.draftId);
  await saveAuthoringDraft({ kind: "Template", id: created.draftId, content: { ...validTemplateContent(REAL_TEMPLATE_CODE, templateVersion), engineeringPackCodes: [{ packCode: "this-pack-code-does-not-exist" }] } });

  const published = await publishAuthoringDraft({ kind: "Template", id: created.draftId, actorId: ROOT_ACTOR_ID, actorRole: "general" });
  assert.equal(published.ok, false);
  assert.match((!published.ok && published.errors.join(";")) || "", /this-pack-code-does-not-exist/);
});

// CR-026 — Template Inheritance (Ch.6 §9). Option A, per explicit owner
// agreement: a Derived Template keeps its parent's own `code`, disambiguated
// by the child's own `tenant_id` (templates_code_version_tenant_key, migration
// 062) — not a new identity per generation. `enterprise-web-application`
// (ensureWebAppTemplateFixture) is a real, Active, Platform-owned Template
// with a real mandatory Pack (`platform-core-engineering`), used as the
// parent throughout.
test("CR-026: a tenant author inheriting an Active Platform Template gets a Draft locked to the parent's code, owned by their own tenant, with parent_template_id recorded", async () => {
  const { template: parent } = await ensureWebAppTemplateFixture();

  const inheritable = await listInheritableTemplates(DEMO_TENANT_ID);
  assert.ok(inheritable.some((t) => t.id === parent.id), "the Active Platform Template must be offered to a tenant viewer's Inherit dropdown");

  const inherited = await inheritedTemplateContent(parent.id, DEMO_TENANT_ID);
  assert.equal(inherited.ok, true, !inherited.ok ? inherited.error : undefined);
  if (!inherited.ok) return;
  assert.equal(inherited.content.code, parent.code, "the pre-filled content's code matches the parent's");

  // A tampered/stale submission tries to pick a different code — the server
  // must ignore it and lock to the parent's own, not just the UI.
  const created = await createAuthoringDraft({
    kind: "Template",
    actorId: ROOT_ACTOR_ID,
    tenantId: DEMO_TENANT_ID,
    parentTemplateId: parent.id,
    content: { ...inherited.content, name: "Tenant's inherited Web Application", code: "attempted-override" },
  });
  assert.equal(created.ok, true, !created.ok ? created.errors.join("; ") : undefined);
  if (!created.ok) return;
  createdTemplateIds.push(created.draftId);

  const { data: draft } = await templatesDB.findById(created.draftId);
  assert.equal(draft?.code, parent.code, "code is FORCED to the parent's code, ignoring the tampered submission");
  assert.equal(draft?.tenant_id, DEMO_TENANT_ID, "the new Draft is owned by the inheriting tenant, not Platform");
  assert.equal(draft?.parent_template_id, parent.id, "lineage recorded");
  assert.equal(draft?.template_version, "1.0.0", "the tenant's own version starts fresh, independent of the parent's");

  // Same code, different tenant — legal now (templates_code_version_tenant_key).
  const { data: parentStillFine } = await templatesDB.findById(parent.id);
  assert.equal(parentStillFine?.status, "Active", "the parent Template is untouched by a tenant inheriting from it");
});

test("CR-026: publishing a Derived Template is rejected if it drops one of its parent's mandatory Packs, and succeeds once the full set is restored", async () => {
  const { template: parent } = await ensureWebAppTemplateFixture();
  const { data: parentMandatory } = await templatesDB.getMandatoryPackCodes(parent.id);
  assert.ok((parentMandatory ?? []).length > 0, "the fixture parent must have at least one mandatory Pack for this test to mean anything");

  // A different tenant than the previous test's — same parent, same starting
  // version ("1.0.0"), would otherwise collide with that test's own leftover
  // Draft under templates_code_version_tenant_key.
  const inherited = await inheritedTemplateContent(parent.id, ATHENS_TENANT_ID);
  assert.equal(inherited.ok, true);
  if (!inherited.ok) return;

  const created = await createAuthoringDraft({ kind: "Template", actorId: ROOT_ACTOR_ID, tenantId: ATHENS_TENANT_ID, parentTemplateId: parent.id, content: inherited.content });
  assert.equal(created.ok, true, !created.ok ? created.errors.join("; ") : undefined);
  if (!created.ok) return;
  createdTemplateIds.push(created.draftId);

  // templateVersion must round-trip on Save, the same way the real form's
  // readonly field always does (CR-024) — inheritedTemplateContent doesn't
  // carry it (it isn't part of a Template's authored content).
  // CR-038 — platform-core-engineering (the fixture's own real mandatory
  // Pack, per the comment above) is category Engineering, so dropping it
  // means blanking engineeringPackCodes specifically now, not a flat list.
  const strippedContent = { ...inherited.content, templateVersion: "1.0.0", engineeringPackCodes: [] };
  const savedStripped = await saveAuthoringDraft({ kind: "Template", id: created.draftId, content: strippedContent });
  assert.equal(savedStripped.ok, true, "WIP is allowed to be incomplete — Save itself must not block this");

  const rejectedPublish = await publishAuthoringDraft({ kind: "Template", id: created.draftId, actorId: ROOT_ACTOR_ID, actorRole: "general" });
  assert.equal(rejectedPublish.ok, false, "an inherited Template must keep every one of its parent's mandatory Packs");
  assert.match((!rejectedPublish.ok && rejectedPublish.errors.join(";")) || "", new RegExp(parentMandatory![0]!));
  const { data: stillDraft } = await templatesDB.findById(created.draftId);
  assert.equal(stillDraft?.status, "Draft", "a rejected publish leaves the Draft a Draft");

  const restored = await saveAuthoringDraft({ kind: "Template", id: created.draftId, content: { ...inherited.content, templateVersion: "1.0.0" } });
  assert.equal(restored.ok, true);

  const acceptedPublish = await advanceToActive("Template", created.draftId, ROOT_ACTOR_ID, "general");
  assert.equal(acceptedPublish.ok, true, !acceptedPublish.ok ? acceptedPublish.errors.join("; ") : undefined);
  const { data: active } = await templatesDB.findById(created.draftId);
  assert.equal(active?.status, "Active");
});

// Owner, 2026-08-19: "19.2 and 19.3 has to be fixed similar to pack and
// template" — Profile Inheritance (Ch.7 §9), mirroring the Template
// Inheritance tests above exactly. `enterprise-web-application`
// (ensureWebAppTemplateFixture) is a real, Active, Platform-owned Template —
// used as the base Template for a fresh, real, Active Platform Profile,
// which is then the parent for the inheritance assertions.
test("Profile Inheritance: a tenant author inheriting an Active Platform Profile gets a Draft locked to the parent's code, owned by their own tenant, with parent_profile_id recorded", async () => {
  await ensureWebAppTemplateFixture();
  const code = `sdk-test-profile-parent-${randomUUID()}`;
  const created = await createAuthoringDraft({
    kind: "Profile",
    actorId: ROOT_ACTOR_ID,
    tenantId: PLATFORM_TENANT_ID,
    content: { code, name: "SDK Test Parent Profile", baseTemplateCode: "enterprise-web-application", environment: "development", category: "startup", optionalPackCodes: [] },
  });
  assert.equal(created.ok, true, !created.ok ? created.errors.join("; ") : undefined);
  if (!created.ok) return;
  createdProfileIds.push(created.draftId);
  const parentPublish = await advanceToActive("Profile", created.draftId, ROOT_ACTOR_ID, "general");
  assert.equal(parentPublish.ok, true, !parentPublish.ok ? parentPublish.errors.join("; ") : undefined);
  const { data: parent } = await profilesDB.findById(created.draftId);
  assert.equal(parent?.status, "Active");

  const inheritable = await listInheritableProfiles(DEMO_TENANT_ID);
  assert.ok(inheritable.some((p) => p.id === parent!.id), "the Active Platform Profile must be offered to a tenant viewer's Inherit dropdown");

  const inherited = await inheritedProfileContent(parent!.id, DEMO_TENANT_ID);
  assert.equal(inherited.ok, true, !inherited.ok ? inherited.error : undefined);
  if (!inherited.ok) return;
  assert.equal(inherited.content.code, parent!.code, "the pre-filled content's code matches the parent's");

  // A tampered/stale submission tries to pick a different code — the server
  // must ignore it and lock to the parent's own, not just the UI.
  const inheritedDraft = await createAuthoringDraft({
    kind: "Profile",
    actorId: ROOT_ACTOR_ID,
    tenantId: DEMO_TENANT_ID,
    parentProfileId: parent!.id,
    content: { ...inherited.content, name: "Tenant's inherited Profile", code: "attempted-override" },
  });
  assert.equal(inheritedDraft.ok, true, !inheritedDraft.ok ? inheritedDraft.errors.join("; ") : undefined);
  if (!inheritedDraft.ok) return;
  createdProfileIds.push(inheritedDraft.draftId);

  const { data: draft } = await profilesDB.findById(inheritedDraft.draftId);
  assert.equal(draft?.code, parent!.code, "code is FORCED to the parent's code, ignoring the tampered submission");
  assert.equal(draft?.tenant_id, DEMO_TENANT_ID, "the new Draft is owned by the inheriting tenant, not Platform");
  assert.equal(draft?.parent_profile_id, parent!.id, "lineage recorded");
  assert.equal(draft?.profile_version, "1.0.0", "the tenant's own version starts fresh, independent of the parent's");

  const { data: parentStillFine } = await profilesDB.findById(parent!.id);
  assert.equal(parentStillFine?.status, "Active", "the parent Profile is untouched by a tenant inheriting from it");
});

// CR-049 Phase 1 — Deliverable Definition, the same entity-direct authoring
// pipeline as Pack/Template/Profile, applied a 4th time, plus the one thing
// unique to it: syncing the `deliverable-name` Ontology concept CR-038's
// Template `deliverableCatalogue` picker reads — only at the moment of
// genuinely becoming (or ceasing to be) Active.
function validDeliverableDefinitionContent(code: string, definitionVersion: string): Record<string, unknown> {
  return { code, description: "What this kind of Deliverable is for.", definitionVersion };
}

test("Deliverable Definition authoring (entity-direct): produces a real Active row, and syncs the deliverable-name Ontology concept ONLY once Active — never earlier", async () => {
  const code = `sdk-test-deliverable-${randomUUID()}`;
  const definitionVersion = uniqueVersion();
  createdOntologyConceptCodes.push(code);

  const created = await createAuthoringDraft({ kind: "Deliverable", actorId: ROOT_ACTOR_ID, content: validDeliverableDefinitionContent(code, definitionVersion) });
  assert.equal(created.ok, true, !created.ok ? created.errors.join("; ") : undefined);
  if (!created.ok) return;
  createdDeliverableDefinitionIds.push(created.draftId);

  const { data: draftRow } = await deliverableDefinitionsDB.findById(created.draftId);
  assert.equal(draftRow!.status, "Draft");
  assert.equal(draftRow!.authored_by, Number(ROOT_ACTOR_ID));

  // Not yet Active — must stay invisible to the exact picker CR-038's
  // Template deliverableCatalogue field reads (findConceptsByType with
  // includeInactive: false).
  const { data: notYetVisible } = await ontologyDB.findConceptsByType("deliverable-name", { isRoot: true, tenantId: null }, { includeInactive: false });
  assert.ok(!(notYetVisible ?? []).some((c) => c.code === code), "a Draft Deliverable Definition must not be selectable in the Ontology picker yet");

  const saved = await saveAuthoringDraft({ kind: "Deliverable", id: created.draftId, content: validDeliverableDefinitionContent(code, definitionVersion) });
  assert.equal(saved.ok, true, !saved.ok ? saved.errors.join("; ") : undefined);

  const published = await advanceToActive("Deliverable", created.draftId, ROOT_ACTOR_ID, "general");
  assert.equal(published.ok, true, !published.ok ? published.errors.join("; ") : undefined);

  const { data: activeRow } = await deliverableDefinitionsDB.findByCodeAndVersion(code, definitionVersion, PLATFORM_TENANT_ID);
  assert.ok(activeRow, "expected the authored Deliverable Definition to be Active");
  assert.equal(activeRow!.status, "Active");

  const { data: visibleNow } = await ontologyDB.findConceptsByType("deliverable-name", { isRoot: true, tenantId: null }, { includeInactive: false });
  const concept = (visibleNow ?? []).find((c) => c.code === code);
  assert.ok(concept, "once Active, the Deliverable Definition must be selectable in CR-038's own Ontology picker");
  assert.equal(concept!.default_label, code);
  assert.equal(concept!.description, "What this kind of Deliverable is for.");
});

test("Deliverable Definition authoring: validation rejects an empty code, a non-semver version, and a duplicate code+version+tenant", async () => {
  const emptyCode = await createAuthoringDraft({ kind: "Deliverable", actorId: ROOT_ACTOR_ID, content: validDeliverableDefinitionContent("", uniqueVersion()) });
  assert.equal(emptyCode.ok, false);
  assert.match((!emptyCode.ok && emptyCode.errors.join(";")) || "", /code is required/);

  const code = `sdk-test-deliverable-badver-${randomUUID()}`;
  const badVersion = await createAuthoringDraft({ kind: "Deliverable", actorId: ROOT_ACTOR_ID, content: validDeliverableDefinitionContent(code, "not-a-version") });
  assert.equal(badVersion.ok, false);
  assert.match((!badVersion.ok && badVersion.errors.join(";")) || "", /semver/);

  const dupeCode = `sdk-test-deliverable-dupe-${randomUUID()}`;
  const dupeVersion = uniqueVersion();
  createdOntologyConceptCodes.push(dupeCode);
  const first = await createAuthoringDraft({ kind: "Deliverable", actorId: ROOT_ACTOR_ID, content: validDeliverableDefinitionContent(dupeCode, dupeVersion) });
  assert.equal(first.ok, true, !first.ok ? first.errors.join("; ") : undefined);
  if (!first.ok) return;
  createdDeliverableDefinitionIds.push(first.draftId);

  const second = await createAuthoringDraft({ kind: "Deliverable", actorId: ROOT_ACTOR_ID, content: validDeliverableDefinitionContent(dupeCode, dupeVersion) });
  assert.equal(second.ok, false);
  assert.match((!second.ok && second.errors.join(";")) || "", /already exists at version/);
});

// Ch.15 §12 (CR-049) — inheritance, mirroring the Template/Profile tests
// above, with the one deliberate difference: code is NOT locked to the
// parent's own (a specialisation is expected to have its own genuinely new
// name — CR-049's own "Claims Adjudication Rules Document" derives from
// "Business Rules" example).
test("CR-049: inheriting from an Active Platform Deliverable Definition offers an editable starting point — code is NOT locked, unlike Template", async () => {
  const parentCode = `sdk-test-deliverable-parent-${randomUUID()}`;
  const parentVersion = uniqueVersion();
  createdOntologyConceptCodes.push(parentCode);
  const parentCreated = await createAuthoringDraft({ kind: "Deliverable", actorId: ROOT_ACTOR_ID, content: validDeliverableDefinitionContent(parentCode, parentVersion) });
  assert.equal(parentCreated.ok, true, !parentCreated.ok ? parentCreated.errors.join("; ") : undefined);
  if (!parentCreated.ok) return;
  createdDeliverableDefinitionIds.push(parentCreated.draftId);
  const parentPublished = await advanceToActive("Deliverable", parentCreated.draftId, ROOT_ACTOR_ID, "general");
  assert.equal(parentPublished.ok, true, !parentPublished.ok ? parentPublished.errors.join("; ") : undefined);
  const { data: parent } = await deliverableDefinitionsDB.findByCodeAndVersion(parentCode, parentVersion, PLATFORM_TENANT_ID);

  const inheritable = await listInheritableDeliverableDefinitions();
  assert.ok(inheritable.some((d) => d.id === parent!.id), "the Active Platform Deliverable Definition must be offered to the Inherit dropdown");

  const childCode = `sdk-test-deliverable-child-${randomUUID()}`;
  createdOntologyConceptCodes.push(childCode);
  const child = await createAuthoringDraft({
    kind: "Deliverable",
    actorId: ROOT_ACTOR_ID,
    tenantId: DEMO_TENANT_ID,
    parentDeliverableDefinitionId: parent!.id,
    content: { code: childCode, description: "A tenant specialisation", definitionVersion: "1.0.0" },
  });
  assert.equal(child.ok, true, !child.ok ? child.errors.join("; ") : undefined);
  if (!child.ok) return;
  createdDeliverableDefinitionIds.push(child.draftId);

  const { data: childDraft } = await deliverableDefinitionsDB.findById(child.draftId);
  assert.equal(childDraft?.code, childCode, "unlike Template Inheritance, the child keeps its OWN code, not the parent's");
  assert.equal(childDraft?.tenant_id, DEMO_TENANT_ID);
  assert.equal(childDraft?.parent_deliverable_definition_id, parent!.id, "lineage recorded");

  const { data: parentStillFine } = await deliverableDefinitionsDB.findById(parent!.id);
  assert.equal(parentStillFine?.status, "Active", "the parent Deliverable Definition is untouched by a tenant inheriting from it");
});

// The one genuinely tricky piece of core/deliverableDefinitions.ts: a second
// Version of the SAME code reaching Active must (a) demote the first Version
// to Deprecated, and (b) leave the materialised Ontology row reflecting the
// NEW Version's content — NOT retire it, even though "a Version left Active"
// also just happened to the OLD row moments earlier. Wrong ordering here
// would wrongly hide an otherwise-perfectly-Active Deliverable Definition
// from CR-038's own picker.
test("Deliverable Definition: a second Version of the same code superseding the first leaves the Ontology row reflecting the NEW content, not retired", async () => {
  const code = `sdk-test-deliverable-supersede-${randomUUID()}`;
  createdOntologyConceptCodes.push(code);

  const v1 = await createAuthoringDraft({ kind: "Deliverable", actorId: ROOT_ACTOR_ID, content: validDeliverableDefinitionContent(code, "1.0.0") });
  assert.equal(v1.ok, true, !v1.ok ? v1.errors.join("; ") : undefined);
  if (!v1.ok) return;
  createdDeliverableDefinitionIds.push(v1.draftId);
  const v1Published = await advanceToActive("Deliverable", v1.draftId, ROOT_ACTOR_ID, "general");
  assert.equal(v1Published.ok, true, !v1Published.ok ? v1Published.errors.join("; ") : undefined);

  const v2 = await createAuthoringDraft({ kind: "Deliverable", actorId: ROOT_ACTOR_ID, content: { code, description: "Updated description for v2", definitionVersion: "1.0.1" } });
  assert.equal(v2.ok, true, !v2.ok ? v2.errors.join("; ") : undefined);
  if (!v2.ok) return;
  createdDeliverableDefinitionIds.push(v2.draftId);
  const v2Published = await advanceToActive("Deliverable", v2.draftId, ROOT_ACTOR_ID, "general");
  assert.equal(v2Published.ok, true, !v2Published.ok ? v2Published.errors.join("; ") : undefined);

  const { data: v1After } = await deliverableDefinitionsDB.findById(v1.draftId);
  assert.equal(v1After!.status, "Deprecated", "v1 must be superseded once v2 reaches Active");
  const { data: v2After } = await deliverableDefinitionsDB.findById(v2.draftId);
  assert.equal(v2After!.status, "Active");

  const { data: visible } = await ontologyDB.findConceptsByType("deliverable-name", { isRoot: true, tenantId: null }, { includeInactive: false });
  const concept = (visible ?? []).find((c) => c.code === code);
  assert.ok(concept, "the code must STILL be selectable — v2 is Active, even though v1 was just deprecated");
  assert.equal(concept!.description, "Updated description for v2", "the Ontology row must reflect v2's content, not be stuck on v1's or retired");
});
