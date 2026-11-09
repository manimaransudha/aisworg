// Tenant visibility of the Registry views (src/routes/seu/core/packView.ts, policyView.ts, profileView.ts, templateView.ts).
//
//   - A view returns null for a row the viewer may not see: a non-root viewer sees a Platform row and a row of its own tenant only.
//   - The test creates one bare Draft per kind in its own tenant, with the same fixtures and test-only Ontology codes the lifecycle tests use, and calls the
//     core view functions directly. Rows are not deleted, as in the other tests that create tenant rows.
//   - The page itself is covered by registry-views.test.ts.
import { getPlatformTenantId } from "../src/dblayer/constants.js";
import "dotenv/config";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { tenantsDB } from "../src/dblayer/tenantsDB.js";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { profilesDB } from "../src/dblayer/profilesDB.js";
import { policyDefinitionsDB } from "../src/dblayer/policyDefinitionsDB.js";
import { packsDB } from "../src/dblayer/packsDB.js";
import { schemaDefinitionsDB } from "../src/dblayer/schemaDefinitionsDB.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import type { TransitionEntityType } from "../src/dblayer/seuTypes.js";
import { createPackDraft } from "../src/routes/seu/core/packs.js";
import { getPackView } from "../src/routes/seu/core/packView.js";
import { getPolicyView } from "../src/routes/seu/core/policyView.js";
import { getProfileView } from "../src/routes/seu/core/profileView.js";
import { getTemplateView } from "../src/routes/seu/core/templateView.js";
import { ROOT_ACTOR_ID, ROOT_ACTOR_BADGE, uniqueTestPackVersion } from "./testFixtures.js";

type Viewer = { isRoot: boolean; tenantId: string | null };

const run = randomUUID().slice(0, 8);
let tenantA: string;
let tenantB: string;
const ownRowId: Record<"Pack" | "Policy Definition" | "Profile" | "Template", string> = { Pack: "", "Policy Definition": "", Profile: "", Template: "" };

async function makeTenant(label: string): Promise<string> {
  const { data, error } = await tenantsDB.create({ code: `rvt-${label}-${run}`, name: `Registry tenant ${label} ${run}`, authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE, is_system: false });
  if (error || !data) throw error ?? new Error("tenant not created");
  return data.id;
}

async function birthState(entityType: TransitionEntityType): Promise<string> {
  const { data: birth } = await transitionDefinitionsDB.findBirth(entityType);
  if (!birth) throw new Error(`no birth Transition Definition for ${entityType}`);
  return birth.to_state;
}

async function schemaIdFor(kind: "Pack" | "Policy" | "Profile" | "Template"): Promise<string> {
  const { data } = await schemaDefinitionsDB.findLatest(kind);
  if (!data) throw new Error(`no schema_definitions grammar for ${kind}`);
  return data.id;
}

before(async () => {
  tenantA = await makeTenant("a");
  tenantB = await makeTenant("b");

  const pack = await createPackDraft(
    // A Pack's code is validated against the Ontology of its category, so this is the test-only concept the lifecycle tests use. The version is unique.
    { code: "test-pack", name: `Registry tenant Pack ${run}`, category: "Engineering", packVersion: uniqueTestPackVersion(), installationClassification: "Optional", contributions: { capabilities: [{ code: "software-construction" }] }, tenantId: tenantA },
    ROOT_ACTOR_ID
  );
  assert.equal(pack.ok, true, pack.ok ? "" : pack.errors.join("; "));
  if (!pack.ok) throw new Error("unreachable");
  ownRowId.Pack = pack.pack.id;

  const { data: policy, error: policyError } = await policyDefinitionsDB.createDraft({
    tenantId: tenantA, code: `rvt-policy-${run}`, name: `Registry tenant Policy ${run}`, category: "Engineering", version: "1.0.0",
    status: (await birthState("Policy")) as never, authoredBy: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE, schemaDefinitionId: await schemaIdFor("Policy"),
  });
  if (policyError || !policy) throw policyError ?? new Error("Policy Definition draft not created");
  ownRowId["Policy Definition"] = policy.id;

  const { data: template, error: templateError } = await templatesDB.createDraft({
    status: (await birthState("Template")) as "Draft", tenantId: tenantA, code: "test-template-lifecycle-template", name: `Registry tenant Template ${run}`,
    templateVersion: uniqueTestPackVersion(), authoredBy: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE,
    draftContent: { purpose: "Tenant visibility fixture." }, schemaDefinitionId: await schemaIdFor("Template"),
  });
  if (templateError || !template) throw templateError ?? new Error("Template draft not created");
  ownRowId.Template = template.id;

  // A Profile needs a real, Active base Template.
  const baseCode = `rvt-base-template-${run}`;
  const { data: base, error: baseError } = await templatesDB.upsert({ status: "Active", tenantId: tenantA, code: baseCode, name: `Registry tenant base Template ${run}`, deliverableCatalogue: [] });
  if (baseError || !base) throw baseError ?? new Error("base Template not created");
  const { data: profile, error: profileError } = await profilesDB.createDraft({
    status: (await birthState("Profile")) as "Draft", tenantId: tenantA, code: `rvt-profile-${run}`, name: `Registry tenant Profile ${run}`,
    baseTemplateId: base.id, authoredBy: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE, profileVersion: uniqueTestPackVersion(),
    draftContent: { baseTemplateCode: baseCode }, schemaDefinitionId: await schemaIdFor("Profile"),
  });
  if (profileError || !profile) throw profileError ?? new Error("Profile draft not created");
  ownRowId.Profile = profile.id;
});

interface Kind {
  label: keyof typeof ownRowId;
  view: (id: string, viewer: Viewer) => Promise<object | null>;
  // The id of the row inside the view result.
  idOf: (view: object) => string;
  // The id of a seeded Platform row the view can show.
  platformRow: () => Promise<string>;
}

async function firstVisiblePlatformId(rows: Array<{ id: string; tenant_id: string }>, view: Kind["view"]): Promise<string> {
  const platformTenantId = await getPlatformTenantId();
  for (const row of rows.filter((r) => r.tenant_id === platformTenantId).slice(0, 60)) {
    if (await view(row.id, { isRoot: true, tenantId: null })) return row.id;
  }
  throw new Error("the database holds no Platform row the view can show");
}

const KINDS: Kind[] = [
  { label: "Pack", view: getPackView, idOf: (v) => (v as { pack: { id: string } }).pack.id, platformRow: async () => firstVisiblePlatformId((await packsDB.findAll()).data ?? [], getPackView) },
  { label: "Policy Definition", view: getPolicyView, idOf: (v) => (v as { policy: { id: string } }).policy.id, platformRow: async () => firstVisiblePlatformId((await policyDefinitionsDB.findAll()).data ?? [], getPolicyView) },
  { label: "Profile", view: getProfileView, idOf: (v) => (v as { profile: { id: string } }).profile.id, platformRow: async () => firstVisiblePlatformId((await profilesDB.findAll()).data ?? [], getProfileView) },
  { label: "Template", view: getTemplateView, idOf: (v) => (v as { template: { id: string } }).template.id, platformRow: async () => firstVisiblePlatformId((await templatesDB.findAll()).data ?? [], getTemplateView) },
];

for (const kind of KINDS) {
  test(`${kind.label} view: the owning tenant and root see a tenant row, and another tenant or a viewer with no tenant does not`, async () => {
    const id = ownRowId[kind.label];

    const own = await kind.view(id, { isRoot: false, tenantId: tenantA });
    assert.ok(own, "the owning tenant sees its own row");
    assert.equal(kind.idOf(own), id);

    const root = await kind.view(id, { isRoot: true, tenantId: null });
    assert.ok(root, "root sees every row");
    assert.equal(kind.idOf(root), id);

    assert.equal(await kind.view(id, { isRoot: false, tenantId: tenantB }), null, "another tenant does not see the row");
    assert.equal(await kind.view(id, { isRoot: false, tenantId: null }), null, "a non-root viewer with no tenant does not see the row");
  });

  test(`${kind.label} view: every tenant sees a Platform row, and an id that does not exist is null`, async () => {
    const platformId = await kind.platformRow();
    for (const viewer of [{ isRoot: false, tenantId: tenantB }, { isRoot: false, tenantId: null }]) {
      const view = await kind.view(platformId, viewer);
      assert.ok(view, `a Platform row is visible to ${JSON.stringify(viewer)}`);
      assert.equal(kind.idOf(view), platformId);
    }
    assert.equal(await kind.view(randomUUID(), { isRoot: true, tenantId: null }), null);
  });
}
