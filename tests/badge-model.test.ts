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

// Bug fix (owner, 2026-08-17): "are you cleaning up the test data after the
// tests are done?" — this file wasn't. Every createTestUser() call left a
// real row in the shared, never-reset dev database, along with whatever
// badge_grants it accumulated — the same gap fixed in sdk-authoring.test.ts,
// found here by the same owner question. Track every user this file creates
// and delete it (and anything it holds) in after() — see
// [[every-transition-real-actor-and-badge]] for why leftover grants matter:
// `db:clean-slate` resets the `users` id sequence but not `badge_grants`, so
// a later run's freshly-created user can inherit a stale leftover grant's
// authority (occasionally `root`) purely by id collision.
const createdUserIds: string[] = [];
// Bug fix (owner: "anything that is legacy has to be removed" — migration 043
// retired the product's own SEU_or_Pack badges, creator/reviewer/approver,
// since nothing has enforced them since CR-006 shipped): §8.1's Tenant-
// customization rules and the entity-type-narrowing CHECK still need SOME
// live SEU_or_Pack-scoped Platform-recommended badge to exercise against —
// this file now seeds its own throwaway one instead of assuming a specific
// product badge still exists. Tracked and deleted in after() (this is also
// what the pre-existing "senior-approver-<random>" rows littering badge_types
// turned out to be — this same test, never cleaning up after itself).
const createdBadgeTypeCodes: string[] = [];

after(async () => {
  if (createdUserIds.length) {
    // The "deliverable-wiring" test dispatches a real Deliverable transition,
    // which records CR-006's attribution (commands.acting_badge_grant_id —
    // "which grant certified the action") pointing at one of these test
    // grants. That FK blocks a plain DELETE; null it out first (test/usage
    // data, same rows db:clean-slate's own step 1 truncates wholesale) rather
    // than leaving the grant behind because it's referenced.
    await pool.query(
      "UPDATE commands SET acting_badge_grant_id = NULL WHERE acting_badge_grant_id IN (SELECT id FROM badge_grants WHERE holder_id = ANY($1::text[]))",
      [createdUserIds]
    );
    await pool.query("DELETE FROM badge_grants WHERE holder_id = ANY($1::text[])", [createdUserIds]);
    await pool.query("DELETE FROM users WHERE id = ANY($1::bigint[])", [createdUserIds]);
  }
  if (createdBadgeTypeCodes.length) {
    await pool.query("DELETE FROM badge_grants WHERE badge_type = ANY($1::text[])", [createdBadgeTypeCodes]);
    await pool.query("DELETE FROM badge_types WHERE code = ANY($1::text[])", [createdBadgeTypeCodes]);
  }
  await pool.end();
});

async function createTestUser(label: string): Promise<string> {
  const email = `badge-test-${label}-${randomUUID()}@example.com`;
  const user = await userDB.create({ email, name: label, avatar_url: null, role: "general", auth_provider: "local", provider_id: null, is_active: true, type: "Platform", tenant_id: "11111111-1111-1111-1111-111111111111" });
  createdUserIds.push(String(user.id));
  return String(user.id);
}

// A throwaway Platform-recommended (tenant_id NULL), SEU_or_Pack-scoped badge
// — the shape §8.1's derivation rules and the entity-type-narrowing CHECK are
// actually about, now that the product's own examples of it are retired.
async function createTestParentBadgeType(label: string): Promise<string> {
  const code = `test-parent-${label}-${randomUUID().slice(0, 8)}`;
  const result = await badgeTypesDB.create({ tenantId: null, code, name: `Test Parent (${label})`, scopeKind: "SEU_or_Pack" });
  assert.ok(!("validationErrors" in result) && !result.error, "validationErrors" in result ? result.validationErrors.join(";") : result.error?.message);
  createdBadgeTypeCodes.push(code);
  return code;
}

async function commissionTestSeu(statementPrefix: string): Promise<string> {
  await ensureWebAppTemplateFixture();
  const result = await commissionFromForm({
    statement: `${statementPrefix}-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture-solution-design", "development"],
    actorRole: "super", actorId: "1001", requestedBy: 1001,
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
  const badgeType = await createTestParentBadgeType("capability-narrowing");

  // governed_entity_type = 'Deliverable' with no capability_id must be
  // rejected — this is a same-row DB CHECK constraint (012_badge_model.sql),
  // not the writer function, so the failure surfaces as a raw DB error.
  const missingCapability = await badgeGrantsDB.create({
    holderId,
    badgeType,
    governedEntityType: "Deliverable",
    scopeId: seuId,
  });
  assert.ok("error" in missingCapability && missingCapability.error, "expected the DB CHECK to reject a Deliverable grant with no capability_id");

  const withCapability = await badgeGrantsDB.create({
    holderId,
    badgeType,
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
  const parentCode = await createTestParentBadgeType("boundaries");

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
  const wrongScope = await badgeTypesDB.create({ tenantId: defaultTenant!.id, code: `t4-${suffix}`, name: "Wrong scope", scopeKind: "Tenant", derivedFrom: parentCode });
  assert.ok("validationErrors" in wrongScope);
  if ("validationErrors" in wrongScope) assert.match(wrongScope.validationErrors.join(";"), /inherits its parent's scope boundary/);

  // A correct derivation succeeds.
  const validCode = `t5-${suffix}`;
  const valid = await badgeTypesDB.create({ tenantId: defaultTenant!.id, code: validCode, name: "Valid derivation", scopeKind: "SEU_or_Pack", derivedFrom: parentCode });
  assert.ok(!("validationErrors" in valid) && !valid.error, "validationErrors" in valid ? valid.validationErrors.join(";") : valid.error?.message);
  createdBadgeTypeCodes.push(validCode);
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
