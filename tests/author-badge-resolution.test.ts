// CR-127 — actor and author-badge resolution. Proves the shared helpers
// (heldBadges.ts and badgeAuthorityEngine.resolveAuthorBadge) never fall
// back silently: a missing session user, or an actor holding neither "root"
// nor the required badge, throws.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Request } from "express";

import pool from "../src/utils/db.js";
import { userDB } from "../src/dblayer/userDB.js";
import { getPlatformTenantId } from "../src/dblayer/constants.js";
import { badgeAuthorityEngine } from "../src/domain/engine/badgeAuthorityEngine.js";
import { requireActorId, resolveAuthorBadge, type HeldBadges } from "../src/domain/identity/heldBadges.js";
import { grantQualityGateWaiver } from "../src/routes/seu/core/qualityGateWaivers.js";
import { ROOT_ACTOR_ID } from "./testFixtures.js";

const PLATFORM_TENANT_ID = await getPlatformTenantId();
const createdUserIds: string[] = [];
const createdParticipantMasterIds: string[] = [];

async function createActor(badges: string[]): Promise<string> {
  const email = `author-badge-${randomUUID()}@example.com`;
  const user = await userDB.create({ email, name: "author-badge", avatar_url: null, auth_provider: "local", provider_id: null, is_active: true, type: "Platform", tenant_id: PLATFORM_TENANT_ID });
  createdUserIds.push(String(user.id));
  const entries = badges.map((badge) => ({ badge, effective_till: "9999-12-31", seu_ids: [] as string[] }));
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO participants_master (tenant_id, type, display_name, capabilities, competency, behaviour_context, authorised_badges, is_active, user_id)
     VALUES ($1, 'Human', 'Author Badge Test Fixture', '[]'::jsonb, '{}'::jsonb, '[]'::jsonb, $2::jsonb, TRUE, $3)
     RETURNING id`,
    [PLATFORM_TENANT_ID, JSON.stringify(entries), user.id]
  );
  createdParticipantMasterIds.push(rows[0].id);
  return rows[0].id;
}

after(async () => {
  if (createdParticipantMasterIds.length) await pool.query("DELETE FROM participants_master WHERE id = ANY($1::uuid[])", [createdParticipantMasterIds]);
  if (createdUserIds.length) await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [createdUserIds]);
  await pool.end();
});

function held(isRoot: boolean, badges: string[]): HeldBadges {
  const badgeTypes = new Set(badges);
  return { isRoot, badgeTypes, has: (b) => isRoot || badgeTypes.has(b) };
}

test("requireActorId returns the session user id as a string and throws when it is missing", () => {
  assert.equal(requireActorId({ session: { user: { id: 42 } } } as unknown as Request), "42");
  assert.throws(() => requireActorId({ session: {} } as unknown as Request), /No authenticated user/);
  assert.throws(() => requireActorId({} as unknown as Request), /No authenticated user/);
  assert.throws(() => requireActorId({ session: { user: { id: null } } } as unknown as Request), /No authenticated user/);
});

test("resolveAuthorBadge(authRow, held): a holder records the matching badge, root records root, anyone else throws, a row with no badge records system", () => {
  const authRow = { badges: ["pack_define", "pack_publish"], roles: [], matchMode: "any" } as never;
  assert.equal(resolveAuthorBadge(authRow, held(true, [])), "root");
  assert.equal(resolveAuthorBadge({ badges: [], roles: [], matchMode: "any" } as never, held(true, [])), "root");
  assert.equal(resolveAuthorBadge({ badges: [], roles: [], matchMode: "any" } as never, held(false, [])), "system");
  assert.equal(resolveAuthorBadge(undefined, held(false, [])), "system");
  assert.equal(resolveAuthorBadge(authRow, held(false, ["pack_publish"])), "pack_publish");
  assert.throws(() => resolveAuthorBadge(authRow, held(false, ["template_define"])), /No held badge authorises/);
});

test("badgeAuthorityEngine.resolveAuthorBadge: root holder -> root, badge holder -> that badge, otherwise throws", async () => {
  assert.equal(await badgeAuthorityEngine.resolveAuthorBadge(ROOT_ACTOR_ID, "pack_define"), "root");

  const holder = await createActor(["pack_define"]);
  assert.equal(await badgeAuthorityEngine.resolveAuthorBadge(holder, "pack_define"), "pack_define");

  const outsider = await createActor(["template_define"]);
  await assert.rejects(() => badgeAuthorityEngine.resolveAuthorBadge(outsider, "pack_define"), /does not hold pack_define/);
});

test("grantQualityGateWaiver throws for an actor that does not hold qualitygate_waive", async () => {
  const outsider = await createActor([]);
  await assert.rejects(
    () => grantQualityGateWaiver({ qualityGateId: randomUUID(), seuId: randomUUID(), entityType: "Deliverable", entityId: randomUUID(), rationale: "test", actorId: outsider }),
    /does not hold qualitygate_waive/
  );
});
