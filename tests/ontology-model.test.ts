// Ontology Model (Alias Vocabulary) — Plan (Phase 17, Ch.18). A canonical,
// platform-owned vocabulary enforced on the write path, with a per-tenant
// rename-only alias layer resolved at read time. Storage is always the canonical
// code; the label is presentation. Run against the real dev database.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { commissionFromForm } from "../src/routes/seu/core/commissioning.js";
import { getSeuDetailView } from "../src/routes/seu/core/seus.js";
import { createEvidence } from "../src/routes/seu/core/evidence.js";
import { setAlias, clearAlias, resolveLabels, resolveLabel } from "../src/routes/seu/core/ontology.js";
import { evidenceDB } from "../src/dblayer/evidenceDB.js";
import { tenantsDB } from "../src/dblayer/tenantsDB.js";
import { ensureWebAppTemplateFixture } from "./testFixtures.js";

after(async () => {
  await pool.end();
});

async function commissionSeu(prefix: string) {
  await ensureWebAppTemplateFixture();
  const result = await commissionFromForm({ statement: `${prefix}-${randomUUID()}`, requiredCapabilityCodes: ["requirements-analysis", "architecture", "development"], actorRole: "super", actorId: "1001", requestedBy: 1001 });
  assert.equal(result.ok, true, !result.ok ? `commissioning failed: ${result.reason}` : undefined);
  if (!result.ok) throw new Error("unreachable");
  const detail = await getSeuDetailView(result.seu.id);
  const deliverable = detail?.deliverables.find((d) => d.name === "Requirements Specification");
  assert.ok(deliverable);
  return { seuId: result.seu.id, deliverableId: deliverable.id };
}

test("write-path enforcement: an off-canonical category is rejected; a canonical one is accepted and stored verbatim", async () => {
  const { seuId, deliverableId } = await commissionSeu("ontology-enforce");

  await assert.rejects(
    () => createEvidence({ seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverableId, category: "Totally Made Up Category XYZ", title: "bad" }),
    /not a canonical category:evidence concept/,
    "an off-list category must be rejected on the write path"
  );

  const ok = await createEvidence({ seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverableId, category: "Validation Evidence", title: "good" });
  assert.equal(ok.category, "Validation Evidence", "the canonical code is stored verbatim");
});

test("tenant rename: two tenants see different labels for the SAME canonical code, but storage stays canonical (cross-tenant joinable)", async () => {
  const run = randomUUID().slice(0, 8);
  const { data: atlas } = await tenantsDB.create({ code: `atlas-onto-${run}`, name: "Atlas" });
  const { data: babylon } = await tenantsDB.create({ code: `babylon-onto-${run}`, name: "Babylon" });
  assert.ok(atlas && babylon);

  // Same canonical concept, two tenant labels.
  await setAlias({ tenantId: atlas.id, conceptType: "category:evidence", canonicalCode: "Validation Evidence", displayLabel: "VALEV" });
  await setAlias({ tenantId: babylon.id, conceptType: "category:evidence", canonicalCode: "Validation Evidence", displayLabel: "Sign-off Proof" });

  assert.equal(await resolveLabel(atlas.id, "category:evidence", "Validation Evidence"), "VALEV");
  assert.equal(await resolveLabel(babylon.id, "category:evidence", "Validation Evidence"), "Sign-off Proof");

  // A tenant with no alias for a code falls back to the platform default label.
  assert.equal(await resolveLabel(atlas.id, "category:evidence", "Analytical Evidence"), "Analytical Evidence");
  // No tenant at all -> platform defaults.
  assert.equal(await resolveLabel(null, "category:evidence", "Validation Evidence"), "Validation Evidence");

  // The stored value on an actual row is the canonical code, regardless of any tenant's label —
  // so two tenants' data still joins on the shared identity.
  const { seuId, deliverableId } = await commissionSeu("ontology-storage");
  const ev = await createEvidence({ seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverableId, category: "Validation Evidence", title: "canonical storage" });
  const { data: stored } = await evidenceDB.findById(ev.id);
  assert.equal(stored?.category, "Validation Evidence", "storage is canonical, never a tenant label");
});

test("clearing an alias reverts to the platform default", async () => {
  const run = randomUUID().slice(0, 8);
  const { data: tenant } = await tenantsDB.create({ code: `clear-onto-${run}`, name: "Clear" });
  assert.ok(tenant);
  await setAlias({ tenantId: tenant.id, conceptType: "category:obligation", canonicalCode: "Security", displayLabel: "SEC-CTRL" });
  assert.equal(await resolveLabel(tenant.id, "category:obligation", "Security"), "SEC-CTRL");
  await clearAlias(tenant.id, "category:obligation", "Security");
  assert.equal(await resolveLabel(tenant.id, "category:obligation", "Security"), "Security", "cleared alias reverts to the platform default");
});

test("aliasing an unknown concept is refused (tenants rename, never mint)", async () => {
  const run = randomUUID().slice(0, 8);
  const { data: tenant } = await tenantsDB.create({ code: `mint-onto-${run}`, name: "Mint" });
  assert.ok(tenant);
  await assert.rejects(
    () => setAlias({ tenantId: tenant.id, conceptType: "category:evidence", canonicalCode: "Not A Real Concept", displayLabel: "X" }),
    /cannot alias unknown concept/,
    "a tenant cannot alias (and thereby imply) a concept that does not exist"
  );
});
