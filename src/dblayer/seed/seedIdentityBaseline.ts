// Identity baseline seed — the desired `tenants` + `users` state to restore
// after a wipe. Captured from a live dump (2026-08-12) and turned into an
// idempotent, repeatable seed so `db:clean-slate` lands on a known identity
// baseline instead of an empty auth table.
//
// Runs as step 4 of cleanSlate.ts (after the SDK-authoring bootstrap), and
// standalone:  npx tsx src/dblayer/seed/seedIdentityBaseline.ts
//
// Idempotent: upsert by primary key (ON CONFLICT (id) DO UPDATE). Explicit ids
// are preserved so badge_grants.holder_id references (plain text user ids) stay
// stable; the users serial is advanced past the max seeded id at the end, so a
// user later created through the UI won't collide. Tenant UUIDs are preserved
// too (the seeded `default` matches the migration-seeded row; the rest are
// re-created after clean-slate's step 2d removes them).
//
// ⚠ PII NOTE: the Google account below carries a real email, avatar URL, and
// OAuth provider_id (subject id). It is the SUPERUSER_EMAIL identity and it
// re-creates itself on the next Google login (passportConfig + badgeBootstrap),
// so it can safely be removed from this list if you'd rather not commit those
// identifiers — the platform will re-provision it. Left in to match the dump.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createRequire } from "node:module";
import pool from "../../utils/db.js";
import { logger } from "../../utils/logger.js";

const require = createRequire(import.meta.url);
const bcrypt = require("bcryptjs");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// CR-006 — fixture test users that HOLD noun_verb badge grants, so regression
// can act as a non-root, badge-holding actor (root still bypasses via holder
// "1"). Added to this baseline (owner, 2026-08-13) so a single `db:clean-slate`
// lands a known set of granted testers. Ids sit in a reserved high range.
const TESTER_ALL_ID = 1001; // holds every active noun_verb (any authorised transition)
const TESTER_CREATOR_ID = 1002; // holds only *_create (can create, cannot approve)
const TESTER_APPROVER_ID = 1003; // holds only *_approve (separation-of-duties)

// CR-004: fixed ids for the reserved tenants, matching migration 033 so the
// user seed can reference them deterministically.
const PLATFORM_TENANT_ID = "11111111-1111-1111-1111-111111111111";
const DEMO_TENANT_ID = "22222222-2222-2222-2222-222222222222";
const DEFAULT_TENANT_ID = "17db886a-3c7a-4b17-8863-5783dc40e1ea";
const ATHENS_TENANT_ID = "adfbc3d0-d00e-440b-a115-6b7988ca2865";
const BABYLON_TENANT_ID = "28ced917-2d8a-446b-9bf2-531ab157e1fc";
const CAMBODIA_TENANT_ID = "1cabe17c-c048-45f2-b89f-c815cd235ba3";

interface SeedTenant {
  id: string;
  code: string;
  name: string;
  status: string;
  is_system: boolean;
  created_at: string;
}

interface SeedUser {
  id: number;
  email: string;
  name: string | null;
  avatar_url: string | null;
  role: string;
  auth_provider: string;
  provider_id: string | null;
  is_active: boolean;
  is_protected: boolean;
  type: "Platform" | "Tenant";
  tenant_id: string;
  created_at: string;
}

const TENANTS: SeedTenant[] = [
  { id: PLATFORM_TENANT_ID, code: "platform", name: "Platform", status: "Operational", is_system: true, created_at: "2026-08-05T12:52:00.000Z" },
  { id: DEMO_TENANT_ID, code: "demo", name: "Demo", status: "Operational", is_system: false, created_at: "2026-08-05T12:52:00.100Z" },
  { id: DEFAULT_TENANT_ID, code: "default", name: "Default Tenant", status: "Operational", is_system: false, created_at: "2026-08-05T12:52:00.661Z" },
  { id: ATHENS_TENANT_ID, code: "Athens", name: "Athens AI-Native", status: "Operational", is_system: false, created_at: "2026-08-12T10:46:48.952Z" },
  { id: BABYLON_TENANT_ID, code: "Babylon", name: "Babylon AI-Native", status: "Operational", is_system: false, created_at: "2026-08-12T10:47:33.630Z" },
  { id: CAMBODIA_TENANT_ID, code: "Cambodia", name: "Cambodia AI-Native", status: "Operational", is_system: false, created_at: "2026-08-12T10:53:16.495Z" },
];

const USERS: SeedUser[] = [
  // Bug fix (owner: "the root is a platform user"): this is the row
  // migration 012's own idempotent grant makes holder_id '1' -> 'root' —
  // captured from a live dump that happened to have it as an Athens Tenant
  // account, but root is Platform authority, not any one tenant's. type/
  // tenant_id corrected to match; email/name left as-is (just an identifier).
  { id: 1, email: "superadmin@athens.com", name: "Super Admin Athens", avatar_url: null, role: "super", auth_provider: "local", provider_id: null, is_active: true, is_protected: false, type: "Platform", tenant_id: PLATFORM_TENANT_ID, created_at: "2026-08-12T10:41:58.157Z" },
  { id: 2, email: "admin@babylon.com", name: "Super Admin Babylon", avatar_url: null, role: "super", auth_provider: "local", provider_id: null, is_active: true, is_protected: false, type: "Tenant", tenant_id: BABYLON_TENANT_ID, created_at: "2026-08-12T10:42:48.956Z" },
  { id: 3, email: "manimaransudha@gmail.com", name: "Sudha Manimaran", avatar_url: "https://lh3.googleusercontent.com/a/ACg8ocLc3inaHZWLhqyO7fQsg8BH-kIPu1U0LZlo1qoOhpFtkwbtUlAr=s96-c", role: "general", auth_provider: "google", provider_id: "115716324960384875593", is_active: true, is_protected: false, type: "Platform", tenant_id: PLATFORM_TENANT_ID, created_at: "2026-08-12T10:51:38.843Z" },
  { id: 4, email: "admin@cambodia.com", name: "Super Admin Cambodia", avatar_url: null, role: "super", auth_provider: "local", provider_id: null, is_active: false, is_protected: false, type: "Tenant", tenant_id: CAMBODIA_TENANT_ID, created_at: "2026-08-12T10:52:37.106Z" },
  // CR-006 fixture testers — non-root, hold noun_verb grants (below). role
  // "general" so no role bypass; tenant = default.
  { id: TESTER_ALL_ID, email: "tester-all@test.local", name: "Test — All Badges", avatar_url: null, role: "general", auth_provider: "local", provider_id: null, is_active: true, is_protected: false, type: "Tenant", tenant_id: DEFAULT_TENANT_ID, created_at: "2026-08-13T00:00:00.000Z" },
  { id: TESTER_CREATOR_ID, email: "tester-creator@test.local", name: "Test — Creator", avatar_url: null, role: "general", auth_provider: "local", provider_id: null, is_active: true, is_protected: false, type: "Tenant", tenant_id: DEFAULT_TENANT_ID, created_at: "2026-08-13T00:00:00.100Z" },
  { id: TESTER_APPROVER_ID, email: "tester-approver@test.local", name: "Test — Approver", avatar_url: null, role: "general", auth_provider: "local", provider_id: null, is_active: true, is_protected: false, type: "Tenant", tenant_id: DEFAULT_TENANT_ID, created_at: "2026-08-13T00:00:00.200Z" },
];

// Derive the noun_verb badge codes from the same source the vocabulary seed
// uses, so this stays correct regardless of clean-slate step order (identity
// baseline runs before the mapping is seeded).
interface VocabTransition { entityType: string; verb: string }
function nounVerbBadges(filter?: (verb: string) => boolean): string[] {
  const raw = readFileSync(path.join(__dirname, "data", "authorityVocabulary.json"), "utf8");
  const transitions = (JSON.parse(raw) as { transitions: VocabTransition[] }).transitions;
  const set = new Set<string>();
  for (const t of transitions) {
    if (filter && !filter(t.verb)) continue;
    set.add(`${t.entityType.toLowerCase()}_${t.verb}`);
  }
  return [...set].sort();
}

// The distinct Objective verbs (activate/achieve/supersede/retire/archive),
// derived from the vocabulary so this stays correct if the graph changes.
function objectiveVerbs(): string[] {
  const raw = readFileSync(path.join(__dirname, "data", "authorityVocabulary.json"), "utf8");
  const transitions = (JSON.parse(raw) as { transitions: VocabTransition[] }).transitions;
  const set = new Set<string>();
  for (const t of transitions) if (t.entityType === "Objective") set.add(t.verb);
  return [...set].sort();
}

// Generic form of objectiveVerbs()/packVerbs() below — the distinct lifecycle
// verbs for any entityType, derived from the vocabulary. Added 2026-08-18
// alongside Template/Profile's six-hop lifecycle seed change, so their
// authoring-fixture users (below) stop being pinned to a hardcoded
// ["define","publish"] that stale the moment the seeded graph grows past it —
// the same bug packVerbs()/objectiveVerbs() were already written to avoid.
function entityLifecycleVerbs(entityType: string): string[] {
  const raw = readFileSync(path.join(__dirname, "data", "authorityVocabulary.json"), "utf8");
  const transitions = (JSON.parse(raw) as { transitions: VocabTransition[] }).transitions;
  const set = new Set<string>();
  for (const t of transitions) if (t.entityType === entityType) set.add(t.verb);
  return [...set].sort();
}

// The distinct Pack lifecycle verbs (validate/publish/activate/deprecate/
// retire/archive), derived from the vocabulary so this stays correct if the
// graph changes.
function packVerbs(): string[] {
  const raw = readFileSync(path.join(__dirname, "data", "authorityVocabulary.json"), "utf8");
  const transitions = (JSON.parse(raw) as { transitions: VocabTransition[] }).transitions;
  const set = new Set<string>();
  for (const t of transitions) if (t.entityType === "Pack") set.add(t.verb);
  return [...set].sort();
}

// CR-006 — Objective-authority test users are seeded for these two tenants:
// one user per objective verb (holds a single objective_<verb> badge) + one
// "objective_all" user (holds every objective_<verb>). Local login, password
// "password". Ids sit in a reserved range per tenant.
const OBJECTIVE_USER_TENANTS = [
  { label: "Athens", tenantId: ATHENS_TENANT_ID, baseId: 2001, domain: "athens.com" },
  { label: "Babylon", tenantId: BABYLON_TENANT_ID, baseId: 2011, domain: "babylon.com" },
];

// Pack-authority test users — Athens only (owner, 2026-08-13): one user per
// pack lifecycle verb (holds a single pack_<verb> badge) + one "pack_all".
// Reserved id range 2101+ (clear of the Objective users' 2001–2017).
const PACK_USER_TENANTS = [
  { label: "Athens", tenantId: ATHENS_TENANT_ID, baseId: 2101, domain: "athens.com" },
];

// Owner (2026-08-17): a PLATFORM (not Tenant) pack_all holder — same badge set
// as pack-all@athens.com, but a Platform-type identity, so pack authority can
// be exercised/tested from the Platform tenant too, not just Athens. Reserved
// id 2301 (clear of the Objective/Pack/Authoring ranges above, 2001–2230ish).
const PLATFORM_PACK_ALL_ID = 2301;
const PLATFORM_PACK_ALL_EMAIL = "pack_all@platform.com";

export async function seedIdentityBaseline(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const t of TENANTS) {
      await client.query(
        `INSERT INTO tenants (id, code, name, status, is_system, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name, status = EXCLUDED.status, is_system = EXCLUDED.is_system`,
        [t.id, t.code, t.name, t.status, t.is_system, t.created_at]
      );
    }
    logger.info(`[seed:identity-baseline] upserted ${TENANTS.length} tenants.`);

    for (const u of USERS) {
      await client.query(
        `INSERT INTO users (id, email, name, avatar_url, role, auth_provider, provider_id, is_active, is_protected, type, tenant_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO UPDATE SET
           email = EXCLUDED.email, name = EXCLUDED.name, avatar_url = EXCLUDED.avatar_url,
           role = EXCLUDED.role, auth_provider = EXCLUDED.auth_provider, provider_id = EXCLUDED.provider_id,
           is_active = EXCLUDED.is_active, is_protected = EXCLUDED.is_protected,
           type = EXCLUDED.type, tenant_id = EXCLUDED.tenant_id`,
        [u.id, u.email, u.name, u.avatar_url, u.role, u.auth_provider, u.provider_id, u.is_active, u.is_protected, u.type, u.tenant_id, u.created_at]
      );
    }
    logger.info(`[seed:identity-baseline] upserted ${USERS.length} users.`);

    // CR-006 — Objective-authority users for Athens & Babylon: one per objective
    // verb (single objective_<verb> badge) + one "objective_all" (all of them).
    // Local login, password "password"; role general (authority comes from the
    // badge, not the role).
    // The 5 Objective transition verbs (activate/achieve/supersede/retire/
    // archive) plus `propose` — the creation act. Objective is created directly
    // into Proposed with no fan-in edge (Ch.1 §18.10), so `propose` has no
    // transition_definition; obj-propose still holds objective_propose. Making
    // objective_propose a *governed* badge (vocab + mapping + createObjective
    // enforcement) is a separate follow-up.
    const objVerbs = [...objectiveVerbs(), "propose"];
    const passwordHash = await bcrypt.hash("password", 12);
    const objectiveUsers: Array<{ id: number; email: string; name: string; tenantId: string; badges: string[] }> = [];
    for (const t of OBJECTIVE_USER_TENANTS) {
      objVerbs.forEach((verb, i) => {
        objectiveUsers.push({ id: t.baseId + i, email: `obj-${verb}@${t.domain}`, name: `${t.label} — objective_${verb}`, tenantId: t.tenantId, badges: [`objective_${verb}`] });
      });
      objectiveUsers.push({ id: t.baseId + objVerbs.length, email: `obj-all@${t.domain}`, name: `${t.label} — objective_all`, tenantId: t.tenantId, badges: objVerbs.map((v) => `objective_${v}`) });
    }
    // CR-006 — Pack-authority users for Athens: one per pack lifecycle verb
    // (single pack_<verb> badge) + one "pack_all". Same shape/rationale as the
    // Objective users above; local login, password "password", role general.
    // The 6 Pack transition verbs (validate/publish/activate/deprecate/retire/
    // archive) plus `define` — the creation act (birth into Draft). Exactly like
    // Objective's `propose`: creation is NOT a transition (a birth has no
    // fromState, and from_state is NOT NULL), so `define` has no
    // transition_definition and is NOT in the noun→verb mapping — authority is
    // decoupled from the initial-state transition. pack-define simply holds the
    // pack_define badge. Making it a *governed* create (vocab + mapping +
    // createPackDraft enforcement) is the same separate follow-up noted for
    // objective_propose.
    const pkVerbs = [...packVerbs(), "define"];
    const packUsers: Array<{ id: number; email: string; name: string; tenantId: string; badges: string[] }> = [];
    for (const t of PACK_USER_TENANTS) {
      pkVerbs.forEach((verb, i) => {
        packUsers.push({ id: t.baseId + i, email: `pack-${verb}@${t.domain}`, name: `${t.label} — pack_${verb}`, tenantId: t.tenantId, badges: [`pack_${verb}`] });
      });
      packUsers.push({ id: t.baseId + pkVerbs.length, email: `pack-all@${t.domain}`, name: `${t.label} — pack_all`, tenantId: t.tenantId, badges: pkVerbs.map((v) => `pack_${v}`) });
    }

    // CR-014 — SDK authoring authority users for the other three authorable
    // nouns (Template/Profile/TransitionDefinition), so every authoring surface
    // is testable now that sdk_creator/sdk_approver are retired. `{noun}_define`
    // = author, one per verb + one "{noun}_all". Athens only, reserved id
    // ranges (clear of pack 2101–2108, objective 2001–2017) — each range is
    // 10 ids wide, enough for Template/Profile's now-7 verbs (define + the six
    // lifecycle verbs, same shape as pkVerbs above) plus the "-all" user.
    //
    // Bug fix (owner, 2026-08-18): `verbs` used to be one hardcoded
    // `["define", "publish"]` shared by all three nouns — correct back when
    // Template/Profile genuinely only had that one lifecycle hop, but it
    // silently stayed frozen there after the seed change gave them Pack's full
    // six-hop lifecycle (transitionDefinitions.json / authorityVocabulary.json),
    // so template-all@/profile-all@ etc. kept holding only 2 of their now 7
    // badges. Template/Profile derive their verb list the same way Pack's own
    // pkVerbs does (entityLifecycleVerbs, mirroring packVerbs); TransitionDefinition
    // is authored through its own noun × verb form instead (CR-019, not this
    // pipeline) and genuinely still only has define/publish, so it stays explicit.
    const AUTHORING_NOUNS: Array<{ noun: string; slug: string; baseId: number; verbs: string[] }> = [
      { noun: "template", slug: "template", baseId: 2201, verbs: [...entityLifecycleVerbs("Template"), "define"] },
      { noun: "profile", slug: "profile", baseId: 2211, verbs: [...entityLifecycleVerbs("Profile"), "define"] },
      { noun: "transitiondefinition", slug: "transdef", baseId: 2221, verbs: ["define", "publish"] },
      // CR-022 — ontology_define gates add/retire on a tenant's OWN Ontology
      // vocabulary (never Platform's, which stays root-only regardless of
      // this badge). Single-verb noun, same shape TransitionDefinition's own
      // authority-vocabulary management already has (one badge covers the
      // whole CRUD surface — no separate "retire" verb).
      { noun: "ontology", slug: "ontology", baseId: 2231, verbs: ["define"] },
    ];
    const authoringUsers: Array<{ id: number; email: string; name: string; tenantId: string; badges: string[] }> = [];
    for (const n of AUTHORING_NOUNS) {
      n.verbs.forEach((verb, i) => {
        authoringUsers.push({ id: n.baseId + i, email: `${n.slug}-${verb}@athens.com`, name: `Athens — ${n.noun}_${verb}`, tenantId: ATHENS_TENANT_ID, badges: [`${n.noun}_${verb}`] });
      });
      authoringUsers.push({ id: n.baseId + n.verbs.length, email: `${n.slug}-all@athens.com`, name: `Athens — ${n.noun}_all`, tenantId: ATHENS_TENANT_ID, badges: n.verbs.map((v) => `${n.noun}_${v}`) });
    }

    // Owner (2026-08-17): a Platform-type pack_all holder — same 7-badge set as
    // pack-all@athens.com (validate/publish/activate/deprecate/retire/archive/
    // define), but type "Platform" with tenant_id the reserved Platform tenant,
    // not a Tenant identity. Reuses the shared authority-user insert + grant
    // path below (which needed generalising from a hardcoded 'Tenant' literal
    // to a real per-user `type` to allow this).
    const platformPackAllUser = { id: PLATFORM_PACK_ALL_ID, email: PLATFORM_PACK_ALL_EMAIL, name: "Platform — pack_all", tenantId: PLATFORM_TENANT_ID, badges: pkVerbs.map((v) => `pack_${v}`), type: "Platform" as const };

    // All authority-user sets share one insert + grant path. Tenant-scoped by
    // default; platformPackAllUser is the one Platform-type exception.
    const authorityUsers = [
      ...objectiveUsers.map((u) => ({ ...u, type: "Tenant" as const })),
      ...packUsers.map((u) => ({ ...u, type: "Tenant" as const })),
      ...authoringUsers.map((u) => ({ ...u, type: "Tenant" as const })),
      platformPackAllUser,
    ];
    for (const u of authorityUsers) {
      await client.query(
        `INSERT INTO users (id, email, name, avatar_url, role, auth_provider, provider_id, is_active, is_protected, type, tenant_id, password_hash, created_at)
         VALUES ($1, $2, $3, NULL, 'general', 'local', NULL, TRUE, FALSE, $4, $5, $6, NOW())
         ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name, role = EXCLUDED.role,
           type = EXCLUDED.type, tenant_id = EXCLUDED.tenant_id, password_hash = EXCLUDED.password_hash, is_active = TRUE`,
        [u.id, u.email, u.name, u.type, u.tenantId, passwordHash]
      );
    }
    logger.info(`[seed:identity-baseline] upserted ${objectiveUsers.length} Objective-authority + ${packUsers.length} Pack-authority (Tenant) + 1 Pack-authority (Platform) users (password "password").`);

    // CR-006 — fixture noun_verb grants for the test users. badge_grants.badge_type
    // is free TEXT (no FK), so a grant of "deliverable_approve" needs no badge_types
    // row; authorise() matches the string. governed_entity_type/scope stay NULL
    // (retired). Idempotent: clear these holders' grants, then re-insert (clean-slate
    // truncates users but not badge_grants).
    const fixtureGrants: Array<{ holderId: number; badges: string[] }> = [
      { holderId: TESTER_ALL_ID, badges: nounVerbBadges() },
      { holderId: TESTER_CREATOR_ID, badges: nounVerbBadges((v) => v === "create") },
      { holderId: TESTER_APPROVER_ID, badges: nounVerbBadges((v) => v === "approve") },
      ...authorityUsers.map((u) => ({ holderId: u.id, badges: u.badges })),
    ];
    const fixtureHolderIds = fixtureGrants.map((g) => String(g.holderId));
    await client.query("DELETE FROM badge_grants WHERE holder_id = ANY($1::text[])", [fixtureHolderIds]);
    let grantCount = 0;
    for (const { holderId, badges } of fixtureGrants) {
      for (const badge of badges) {
        await client.query(
          "INSERT INTO badge_grants (holder_type, holder_id, badge_type, status) VALUES ('User', $1, $2, 'Active')",
          [String(holderId), badge]
        );
        grantCount++;
      }
    }
    logger.info(`[seed:identity-baseline] seeded ${grantCount} fixture noun_verb grants across ${fixtureGrants.length} test users.`);

    // Advance the serial past the highest seeded id so the next UI-created user
    // doesn't collide with a seeded id (clean-slate's RESTART IDENTITY leaves
    // the sequence at 1). Requires users_id_seq to be owned by this role — the
    // same ownership clean-slate's RESTART IDENTITY needs.
    await client.query("SELECT setval('users_id_seq', (SELECT COALESCE(MAX(id), 1) FROM users), true)");

    await client.query("COMMIT");
    logger.info("[seed:identity-baseline] done.");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  seedIdentityBaseline()
    .catch((err) => {
      logger.error("[seed:identity-baseline] failed", err as Error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
