// Phase 10 (badge model) — design/mvp-build-plan/Phase 10 - User Management
// and Dual Authority Design.md. Proves, at three levels:
//   1. badgeGrantsDB/badgeTypesDB's single writer functions enforce the
//      invariants a plain CHECK/FK can't reach (§9's Enforcement point).
//   2. badgeAuthorityEngine's root bypass and scope/Capability matching.
//   3. The wiring is real: transitionDeliverable is genuinely blocked
//      without the right acting badge, and unblocks with it — Creator does
//      Defined -> In Progress, Approver does In Progress -> Approved (§8.0).
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { query } from "../src/utils/db.js";
import { commissionFromForm } from "../src/routes/seu/core/commissioning.js";
import { fulfilCapability } from "../src/routes/seu/core/capabilities.js";
import { transitionDeliverableSync as transitionDeliverable } from "./testFixtures.js";
import { deliverablesDB } from "../src/dblayer/deliverablesDB.js";
import { badgeGrantsDB } from "../src/dblayer/badgeGrantsDB.js";
import { badgeTypesDB } from "../src/dblayer/badgeTypesDB.js";
import { tenantsDB } from "../src/dblayer/tenantsDB.js";
import { userDB } from "../src/dblayer/userDB.js";
import { badgeAuthorityEngine } from "../src/domain/engine/badgeAuthorityEngine.js";
import { ensureWebAppTemplateFixture } from "./testFixtures.js";

after(async () => {
  await pool.end();
});

async function createTestUser(label: string): Promise<string> {
  const email = `badge-test-${label}-${randomUUID()}@example.com`;
  const user = await userDB.create({ email, name: label, avatar_url: null, role: "general", auth_provider: "local", provider_id: null, is_active: true, type: "Platform", tenant_id: "11111111-1111-1111-1111-111111111111" });
  return String(user.id);
}

async function commissionTestSeu(statementPrefix: string): Promise<string> {
  await ensureWebAppTemplateFixture();
  const result = await commissionFromForm({
    statement: `${statementPrefix}-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture", "development"],
    actorRole: "super", actorId: "1001",
  });
  assert.equal(result.ok, true, !result.ok ? `commissioning failed: ${result.reason}` : undefined);
  if (!result.ok) throw new Error("unreachable");
  return result.seu.id;
}

test("badgeGrantsDB single writer function enforces the scope_id/scope_kind invariant", async () => {
  const holderId = await createTestUser("scope-invariant");

  // tenant_admin's scope_kind is 'Tenant' — scope_id is required.
  const missingScope = await badgeGrantsDB.create({ holderId, badgeType: "tenant_admin" });
  assert.ok("validationErrors" in missingScope, "expected validation to reject a missing scope_id");
  if ("validationErrors" in missingScope) assert.match(missingScope.validationErrors.join(";"), /requires a non-NULL scope_id/);

  // A scope_id that doesn't resolve to a real tenant must also be rejected.
  const badScope = await badgeGrantsDB.create({ holderId, badgeType: "tenant_admin", scopeId: randomUUID() });
  assert.ok("validationErrors" in badScope, "expected validation to reject a scope_id that doesn't resolve to a real tenant");

  // A real tenant_id succeeds.
  const { data: defaultTenant } = await tenantsDB.findByCode("default");
  assert.ok(defaultTenant);
  const ok = await badgeGrantsDB.create({ holderId, badgeType: "tenant_admin", scopeId: defaultTenant!.id });
  assert.ok(!("validationErrors" in ok) && !ok.error, "validationErrors" in ok ? ok.validationErrors.join(";") : ok.error?.message);
});

test("badge_grants DB-level CHECK enforces mandatory Capability-narrowing for Deliverable grants", async () => {
  const holderId = await createTestUser("capability-narrowing");
  const seuId = await commissionTestSeu("badge-capability-check");
  const { data: deliverables } = await deliverablesDB.findBySeuId(seuId);
  assert.ok(deliverables && deliverables.length > 0);
  const deliverable = deliverables![0];

  // governed_entity_type = 'Deliverable' with no capability_id must be
  // rejected — this is a same-row DB CHECK constraint (012_badge_model.sql),
  // not the writer function, so the failure surfaces as a raw DB error.
  const missingCapability = await badgeGrantsDB.create({
    holderId,
    badgeType: "creator",
    governedEntityType: "Deliverable",
    scopeId: seuId,
  });
  assert.ok("error" in missingCapability && missingCapability.error, "expected the DB CHECK to reject a Deliverable grant with no capability_id");

  const withCapability = await badgeGrantsDB.create({
    holderId,
    badgeType: "creator",
    governedEntityType: "Deliverable",
    capabilityId: deliverable.producing_capability_id,
    scopeId: seuId,
  });
  assert.ok(!("validationErrors" in withCapability) && !withCapability.error, "validationErrors" in withCapability ? withCapability.validationErrors.join(";") : withCapability.error?.message);
});

test("badgeTypesDB single writer function enforces §8.1's Tenant-customization boundaries", async () => {
  const { data: defaultTenant } = await tenantsDB.findByCode("default");
  assert.ok(defaultTenant);
  const suffix = randomUUID().slice(0, 8);

  // derived_from is required for a Tenant-scoped badge.
  const noParent = await badgeTypesDB.create({ tenantId: defaultTenant!.id, code: `t1-${suffix}`, name: "No parent", scopeKind: "SEU_or_Pack" });
  assert.ok("validationErrors" in noParent);
  if ("validationErrors" in noParent) assert.match(noParent.validationErrors.join(";"), /must declare derived_from/);

  // derived_from must resolve to a genuine Platform-recommended row.
  const badParent = await badgeTypesDB.create({ tenantId: defaultTenant!.id, code: `t2-${suffix}`, name: "Bad parent", scopeKind: "SEU_or_Pack", derivedFrom: "not-a-real-badge" });
  assert.ok("validationErrors" in badParent);

  // Layer 1 (unscoped) badges are excluded from Tenant customization (§8.1's correction).
  const rootDerived = await badgeTypesDB.create({ tenantId: defaultTenant!.id, code: `t3-${suffix}`, name: "Root variant", scopeKind: "None", derivedFrom: "root" });
  assert.ok("validationErrors" in rootDerived);
  if ("validationErrors" in rootDerived) assert.match(rootDerived.validationErrors.join(";"), /excluded from Tenant customization/);

  // A derived badge's scope_kind must match its parent's.
  const wrongScope = await badgeTypesDB.create({ tenantId: defaultTenant!.id, code: `t4-${suffix}`, name: "Wrong scope", scopeKind: "Tenant", derivedFrom: "approver" });
  assert.ok("validationErrors" in wrongScope);
  if ("validationErrors" in wrongScope) assert.match(wrongScope.validationErrors.join(";"), /inherits its parent's scope boundary/);

  // A correct derivation succeeds.
  const valid = await badgeTypesDB.create({ tenantId: defaultTenant!.id, code: `senior-approver-${suffix}`, name: "Senior Approver", scopeKind: "SEU_or_Pack", derivedFrom: "approver" });
  assert.ok(!("validationErrors" in valid) && !valid.error, "validationErrors" in valid ? valid.validationErrors.join(";") : valid.error?.message);
});

test("transitionDeliverable authorises on noun_verb: denied without the badge, deliverable_create allows create, deliverable_approve required to approve (distinct authority), root bypasses", async () => {
  const holderId = await createTestUser("deliverable-wiring");
  const seuId = await commissionTestSeu("badge-deliverable-wiring");
  const { data: deliverables } = await deliverablesDB.findBySeuId(seuId);
  assert.ok(deliverables && deliverables.length > 0);
  const deliverable = deliverables!.find((d) => d.lifecycle_state === "Defined");
  assert.ok(deliverable, "expected at least one Deliverable still in Defined state right after commissioning");
  // Dispatch (Ch.31-33) needs a Participant fulfilling the producing
  // Capability before a transition can actually complete — unrelated to the
  // badge/authority check itself, which runs before dispatch and is what
  // this test is actually about.
  await fulfilCapability({ seuId, capabilityId: deliverable!.producing_capability_id!, participantType: "AI", displayName: "Badge test participant" });

  // No acting badge declared, and the holder has none — must be denied, not silently allowed.
  const deniedNoBadge = await transitionDeliverable({ deliverableId: deliverable!.id, targetState: "In Progress", actorId: holderId });
  assert.equal(deniedNoBadge.ok, false);
  assert.equal(!deniedNoBadge.ok && deniedNoBadge.reason, "authority_denied");

  // CR-006: authority is the noun_verb badge. deliverable_create → Defined -> In Progress allowed.
  await query("INSERT INTO badge_grants (holder_type, holder_id, badge_type, status) VALUES ('User', $1, 'deliverable_create', 'Active')", [holderId]);

  const allowedByCreator = await transitionDeliverable({ deliverableId: deliverable!.id, targetState: "In Progress", actorId: holderId });
  assert.equal(allowedByCreator.ok, true, !allowedByCreator.ok ? JSON.stringify(allowedByCreator) : undefined);

  // Same holder, same Creator badge, attempting In Progress -> Approved —
  // Approver's job, not Creator's (§8.0's genuinely separate authority).
  // Must be denied even though the holder is "active" on this Deliverable.
  const deniedWrongBadge = await transitionDeliverable({ deliverableId: deliverable!.id, targetState: "Approved", actorId: holderId });
  assert.equal(deniedWrongBadge.ok, false);
  assert.equal(!deniedWrongBadge.ok && deniedWrongBadge.reason, "authority_denied");

  // deliverable_approve is a DISTINCT badge (separate authority, §8.0) → In Progress -> Approved now allowed.
  await query("INSERT INTO badge_grants (holder_type, holder_id, badge_type, status) VALUES ('User', $1, 'deliverable_approve', 'Active')", [holderId]);

  const allowedByApprover = await transitionDeliverable({ deliverableId: deliverable!.id, targetState: "Approved", actorId: holderId });
  assert.equal(allowedByApprover.ok, true, !allowedByApprover.ok ? JSON.stringify(allowedByApprover) : undefined);

  // Root bypass (§11a, unchanged): a holder with only `root` — no noun_verb grant — may still transition.
  const rootHolderId = await createTestUser("root-bypass");
  const seu2 = await commissionTestSeu("badge-root-bypass");
  const { data: d2 } = await deliverablesDB.findBySeuId(seu2);
  const deliverable2 = d2!.find((d) => d.lifecycle_state === "Defined");
  assert.ok(deliverable2);
  await fulfilCapability({ seuId: seu2, capabilityId: deliverable2!.producing_capability_id!, participantType: "AI", displayName: "Badge test participant (root)" });
  await query("INSERT INTO badge_grants (holder_type, holder_id, badge_type, status) VALUES ('User', $1, 'root', 'Active')", [rootHolderId]);
  const rootAllowed = await transitionDeliverable({ deliverableId: deliverable2!.id, targetState: "In Progress", actorId: rootHolderId });
  assert.equal(rootAllowed.ok, true, !rootAllowed.ok ? JSON.stringify(rootAllowed) : undefined);
});
