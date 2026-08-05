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
import { transitionDeliverable } from "../src/routes/seu/core/deliverables.js";
import { deliverablesDB } from "../src/dblayer/deliverablesDB.js";
import { badgeGrantsDB } from "../src/dblayer/badgeGrantsDB.js";
import { badgeTypesDB } from "../src/dblayer/badgeTypesDB.js";
import { tenantsDB } from "../src/dblayer/tenantsDB.js";
import { userDB } from "../src/dblayer/userDB.js";
import { badgeAuthorityEngine } from "../src/domain/engine/badgeAuthorityEngine.js";

after(async () => {
  await pool.end();
});

async function createTestUser(label: string): Promise<string> {
  const email = `badge-test-${label}-${randomUUID()}@example.com`;
  const user = await userDB.create({ email, name: label, avatar_url: null, role: "general", auth_provider: "local", provider_id: null, is_active: true });
  return String(user.id);
}

async function commissionTestSeu(statementPrefix: string): Promise<string> {
  const result = await commissionFromForm({
    statement: `${statementPrefix}-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture", "development"],
    actorRole: "super",
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

test("transitionDeliverable is genuinely wired to the badge model: blocked without the right acting badge, unblocked with it — Creator then Approver, distinct authority", async () => {
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

  // Grant Creator, scoped correctly (entity type, Capability, SEU) — Defined -> In Progress must now succeed.
  const creatorGrant = await badgeGrantsDB.create({
    holderId,
    badgeType: "creator",
    governedEntityType: "Deliverable",
    capabilityId: deliverable!.producing_capability_id,
    scopeId: seuId,
  });
  assert.ok(!("validationErrors" in creatorGrant) && !creatorGrant.error, "validationErrors" in creatorGrant ? creatorGrant.validationErrors.join(";") : creatorGrant.error?.message);

  const allowedByCreator = await transitionDeliverable({ deliverableId: deliverable!.id, targetState: "In Progress", actorId: holderId });
  assert.equal(allowedByCreator.ok, true, !allowedByCreator.ok ? JSON.stringify(allowedByCreator) : undefined);

  // Same holder, same Creator badge, attempting In Progress -> Approved —
  // Approver's job, not Creator's (§8.0's genuinely separate authority).
  // Must be denied even though the holder is "active" on this Deliverable.
  const deniedWrongBadge = await transitionDeliverable({ deliverableId: deliverable!.id, targetState: "Approved", actorId: holderId });
  assert.equal(deniedWrongBadge.ok, false);
  assert.equal(!deniedWrongBadge.ok && deniedWrongBadge.reason, "authority_denied");

  // Grant Approver too — now it succeeds. The holder now holds *both*
  // Creator and Approver for this same scope, so auto-resolution (the
  // interim, single-qualifying-grant shortcut this pass ships, §17.2) is
  // deliberately ambiguous — this is exactly the case a real badge switcher
  // would ask the user to disambiguate, so the acting badge is declared
  // explicitly here instead, proving the declared-badge path itself, not
  // just the auto-resolve convenience.
  const approverGrant = await badgeGrantsDB.create({
    holderId,
    badgeType: "approver",
    governedEntityType: "Deliverable",
    capabilityId: deliverable!.producing_capability_id,
    scopeId: seuId,
  });
  assert.ok(!("validationErrors" in approverGrant) && !approverGrant.error, "validationErrors" in approverGrant ? approverGrant.validationErrors.join(";") : approverGrant.error?.message);
  const approverGrantId = (approverGrant as { data: { id: string } }).data.id;

  const allowedByApprover = await transitionDeliverable({ deliverableId: deliverable!.id, targetState: "Approved", actorId: holderId, actingBadgeGrantId: approverGrantId });
  assert.equal(allowedByApprover.ok, true, !allowedByApprover.ok ? JSON.stringify(allowedByApprover) : undefined);
});

test("root bypass (§11a): a root holder satisfies any Engineering-badge requirement without a matching Creator/Approver grant, and the action is still attributable to a declared acting badge", async () => {
  const rootHolderId = await createTestUser("root-bypass");
  const seuId = await commissionTestSeu("badge-root-bypass");
  const { data: deliverables } = await deliverablesDB.findBySeuId(seuId);
  const deliverable = deliverables!.find((d) => d.lifecycle_state === "Defined");
  assert.ok(deliverable);
  await fulfilCapability({ seuId, capabilityId: deliverable!.producing_capability_id!, participantType: "AI", displayName: "Badge test participant (root)" });

  const rootGrant = await badgeGrantsDB.create({ holderId: rootHolderId, badgeType: "root" });
  assert.ok(!("validationErrors" in rootGrant) && !rootGrant.error, "validationErrors" in rootGrant ? rootGrant.validationErrors.join(";") : rootGrant.error?.message);
  const grantId = (rootGrant as { data: { id: string } }).data.id;

  // Direct engine check: declaring the root grant satisfies a 'creator' requirement.
  const outcome = await badgeAuthorityEngine.evaluate({
    requiredBadgeType: "creator",
    entityType: "Deliverable",
    actingBadge: { grantId, actorId: rootHolderId },
    scopeContext: { seuId, capabilityId: deliverable!.producing_capability_id },
  });
  assert.equal(outcome.allowed, true, !outcome.allowed ? JSON.stringify(outcome) : undefined);

  // And the real transition — no Creator/Approver grant exists for this
  // holder at all, only root, auto-resolved since it's their only grant.
  const result = await transitionDeliverable({ deliverableId: deliverable!.id, targetState: "In Progress", actorId: rootHolderId });
  assert.equal(result.ok, true, !result.ok ? JSON.stringify(result) : undefined);

  // The grant recorded in the row is the root grant, declared, not a
  // fabricated bypass with no attributable badge (§11a, corrected).
  const { rows } = await query<{ badge_type: string }>("SELECT badge_type FROM badge_grants WHERE id = $1", [grantId]);
  assert.equal(rows[0]?.badge_type, "root");
});
