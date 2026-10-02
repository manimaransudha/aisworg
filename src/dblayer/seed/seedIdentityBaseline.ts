// Seed users
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createRequire } from "node:module";
import pool from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { tenantsDB } from "../tenantsDB.js";
import { PLATFORM_TENANT_NAME, DEMO_TENANT_NAME, ATHENS_TENANT_NAME, BABYLON_TENANT_NAME, CAMBODIA_TENANT_NAME} from "../constants.js";

const require = createRequire(import.meta.url);
const bcrypt = require("bcryptjs");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TENANTS = [PLATFORM_TENANT_NAME, DEMO_TENANT_NAME, ATHENS_TENANT_NAME, BABYLON_TENANT_NAME, CAMBODIA_TENANT_NAME];

// tests/acceptance.e2e.test.ts's own non-root, tenant-scoped journey actor —
// "a real, authorised identity instead of an implicit [root] bypass," holding
// every noun_verb badge the full commissioning journey might touch (not just
// objective_*, unlike TESTER_OBJECTIVE_ATHENS below). Derived from the same
// authorityVocabulary.json seedAuthorityVocabulary.ts itself reads, not
// hand-listed, so this fixture never drifts out of sync with the real
// noun_verb set as transitions are added.
function allNounVerbBadges(): Array<{ badge: string; effective_till: string; seu_ids: string[] }> {
  const raw = readFileSync(path.join(__dirname, "data", "authorityVocabulary.json"), "utf8");
  const vocab = JSON.parse(raw) as {
    transitions: Array<{ entityType: string; verb: string }>;
    authoringMappings?: Array<{ noun: string; verbs: string[] }>;
  };
  const pairs = new Set<string>();
  for (const t of vocab.transitions) pairs.add(`${t.entityType.toLowerCase()}_${t.verb}`);
  for (const m of vocab.authoringMappings ?? []) for (const v of m.verbs) pairs.add(`${m.noun.toLowerCase()}_${v}`);
  return [...pairs].sort().map((badge) => ({ badge, effective_till: "9999-12-31", seu_ids: [] }));
}

interface SeedUser {
  email: string;
  name: string | null;
  avatar_url: string | null;
  display_name: string;
  auth_provider: string;
  provider_id: string | null;
  is_active: boolean;
  is_protected: boolean;
  type: "Platform" | "Tenant";
  tenant_name: string;
  participant_type: string;
  capabilities: {};
  competency: {};
  behaviour_context: {};
  authorised_role: {};
  authorised_badges: {};
}

const USERS: SeedUser[] = [
  {email: "superadmin@athens.com", name: "Super Admin Athens", avatar_url: null, display_name: "Athens admin", auth_provider: "local", provider_id: null, is_active: true, is_protected: false, type: "Platform", tenant_name: ATHENS_TENANT_NAME,participant_type: "Human", capabilities: [], competency: [], behaviour_context: [], authorised_role: [{"role":"superuser","effective_till":"9999-12-31","seu_ids":[]}], authorised_badges: [{"badge":"root","effective_till":"9999-12-31","seu_ids":[]}] },
  {email: "superadmin@babylon.com", name: "Super Admin Babylon", avatar_url: null, display_name: "Babylon admin", auth_provider: "local", provider_id: null, is_active: true, is_protected: false, type: "Tenant", tenant_name: BABYLON_TENANT_NAME,participant_type: "Human", capabilities: [], competency: [], behaviour_context: [], authorised_role: [{"role":"superuser","effective_till":"9999-12-31","seu_ids":[]}], authorised_badges: [{"badge":"root","effective_till":"9999-12-31","seu_ids":[]}] },
  {email: "superadmin@cambodia.com", name: "Super Admin Cambodia", avatar_url: null, display_name: "Cambodia admin", auth_provider: "local", provider_id: null, is_active: false, is_protected: false, type: "Tenant", tenant_name: CAMBODIA_TENANT_NAME ,participant_type: "Human", capabilities: [], competency: [], behaviour_context: [], authorised_role: [{"role":"superuser","effective_till":"9999-12-31","seu_ids":[]}], authorised_badges: [{"badge":"root","effective_till":"9999-12-31","seu_ids":[]}] },
  {email: "tester-all@test.local", name: "Test — All Badges", avatar_url: null, display_name: "Platform Test All", auth_provider: "local", provider_id: null, is_active: true, is_protected: false, type: "Platform", tenant_name: DEMO_TENANT_NAME,participant_type: "Human", capabilities: [], competency: [], behaviour_context: [], authorised_role: [{"role":"superuser","effective_till":"9999-12-31","seu_ids":[]}], authorised_badges: [{"badge":"root","effective_till":"9999-12-31","seu_ids":[]}] },
  {email: "tester-creator@test.local", name: "Test — Creator", avatar_url: null, display_name: "Platform Test Creator", auth_provider: "local", provider_id: null, is_active: true, is_protected: false, type: "Platform", tenant_name: DEMO_TENANT_NAME,participant_type: "Human", capabilities: [], competency: [], behaviour_context: [], authorised_role: [{"role":"superuser","effective_till":"9999-12-31","seu_ids":[]}], authorised_badges: [{"badge":"root","effective_till":"9999-12-31","seu_ids":[]}] },
  {email: "tester-approver@test.local", name: "Test — Approver", avatar_url: null, display_name: "Platform Test Approver", auth_provider: "local", provider_id: null, is_active: true, is_protected: false, type: "Platform", tenant_name: DEMO_TENANT_NAME,participant_type: "Human", capabilities: [], competency: [], behaviour_context: [], authorised_role: [{"role":"superuser","effective_till":"9999-12-31","seu_ids":[]}], authorised_badges: [{"badge":"root","effective_till":"9999-12-31","seu_ids":[]}] },
  // tests/web-flow.e2e.test.ts's own cross-tenant Objective fixtures
  // (TESTER_OBJECTIVE_ATHENS/TESTER_OBJECTIVE_BABYLON, testFixtures.ts) —
  // genuinely scoped, non-root identities (every real objective_* noun_verb
  // badge: propose/activate/reject/achieve/supersede/retire/archive, plus
  // objective_all, NOT root) in two different real tenants, so those tests
  // exercise the actual badge + tenant-reach gates instead of bypassing them.
  {email: "tester-objective-athens@test.local", name: "Test — Objective Badges (Athens)", avatar_url: null, display_name: "Athens Test Objective Badges", auth_provider: "local", provider_id: null, is_active: true, is_protected: false, type: "Tenant", tenant_name: ATHENS_TENANT_NAME,participant_type: "Human", capabilities: [], competency: [], behaviour_context: [], authorised_role: [{"role":"general","effective_till":"9999-12-31","seu_ids":[]}], authorised_badges: [
    {"badge":"objective_propose","effective_till":"9999-12-31","seu_ids":[]},
    {"badge":"objective_activate","effective_till":"9999-12-31","seu_ids":[]},
    {"badge":"objective_reject","effective_till":"9999-12-31","seu_ids":[]},
    {"badge":"objective_achieve","effective_till":"9999-12-31","seu_ids":[]},
    {"badge":"objective_supersede","effective_till":"9999-12-31","seu_ids":[]},
    {"badge":"objective_retire","effective_till":"9999-12-31","seu_ids":[]},
    {"badge":"objective_archive","effective_till":"9999-12-31","seu_ids":[]},
    {"badge":"objective_all","effective_till":"9999-12-31","seu_ids":[]}
  ] },
  {email: "tester-objective-babylon@test.local", name: "Test — Objective Badges (Babylon)", avatar_url: null, display_name: "Babylon Test Objective Badges", auth_provider: "local", provider_id: null, is_active: true, is_protected: false, type: "Tenant", tenant_name: BABYLON_TENANT_NAME,participant_type: "Human", capabilities: [], competency: [], behaviour_context: [], authorised_role: [{"role":"general","effective_till":"9999-12-31","seu_ids":[]}], authorised_badges: [
    {"badge":"objective_propose","effective_till":"9999-12-31","seu_ids":[]},
    {"badge":"objective_activate","effective_till":"9999-12-31","seu_ids":[]},
    {"badge":"objective_reject","effective_till":"9999-12-31","seu_ids":[]},
    {"badge":"objective_achieve","effective_till":"9999-12-31","seu_ids":[]},
    {"badge":"objective_supersede","effective_till":"9999-12-31","seu_ids":[]},
    {"badge":"objective_retire","effective_till":"9999-12-31","seu_ids":[]},
    {"badge":"objective_archive","effective_till":"9999-12-31","seu_ids":[]},
    {"badge":"objective_all","effective_till":"9999-12-31","seu_ids":[]}
  ] },
  // tests/web-flow.e2e.test.ts's own ATHENS_NO_PROPOSE fixture — holds
  // objective_achieve only, deliberately NOT objective_propose, to prove the
  // real create/edit denial for a badge-less-for-that-verb viewer.
  {email: "tester-objective-achieve-only@test.local", name: "Test — Objective Achieve Only (Athens)", avatar_url: null, display_name: "Athens Test Objective Achieve Only", auth_provider: "local", provider_id: null, is_active: true, is_protected: false, type: "Tenant", tenant_name: ATHENS_TENANT_NAME,participant_type: "Human", capabilities: [], competency: [], behaviour_context: [], authorised_role: [{"role":"general","effective_till":"9999-12-31","seu_ids":[]}], authorised_badges: [
    {"badge":"objective_achieve","effective_till":"9999-12-31","seu_ids":[]}
  ] },
  // tests/acceptance.e2e.test.ts's own full-journey actor — non-root,
  // tenant-scoped, holds every real noun_verb badge (allNounVerbBadges()
  // above), so the M5 acceptance journey runs as a real authorised identity
  // instead of root's implicit bypass.
  {email: "tester-acceptance-journey@test.local", name: "Test — Acceptance Journey (Athens)", avatar_url: null, display_name: "Athens Test Acceptance Journey", auth_provider: "local", provider_id: null, is_active: true, is_protected: false, type: "Tenant", tenant_name: ATHENS_TENANT_NAME, participant_type: "Human", capabilities: [], competency: [], behaviour_context: [], authorised_role: [{"role":"general","effective_till":"9999-12-31","seu_ids":[]}], authorised_badges: allNounVerbBadges() },
];

export async function seedIdentityBaseline(): Promise<void> {
  const client = await pool.connect();
  const superuserEmail = (process.env.SUPERUSER_EMAIL || "").toLowerCase();
  if (superuserEmail) {
    const result = await client.query(
      `SELECT * from users
         WHERE lower(email) = $1`,
      [superuserEmail]
    );
    if (result.rows.length === 0) {
      logger.error(`[seed:identity-baseline] superuser not provisioned; aborting seed.`);
      client.release();
      return;
    }
  }
    
  try {
    await client.query("BEGIN");
    for (const u of USERS) {
      const tenantResult = await tenantsDB.findByName(u.tenant_name);
      if (tenantResult.error) {
        throw new Error("Error retrieving tenant details");
      }
      const tenantId = tenantResult.data?.id ?? null;

      if (!tenantId) {
        logger.error(`[seed:identity-baseline] tenant not provisioned`);
        continue;
      }

      let result = await client.query(
        `INSERT INTO users (email, name, avatar_url, auth_provider, provider_id, is_active, is_protected, type, tenant_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           email = EXCLUDED.email, name = EXCLUDED.name, avatar_url = EXCLUDED.avatar_url, auth_provider = EXCLUDED.auth_provider, provider_id = EXCLUDED.provider_id,
           is_active = EXCLUDED.is_active, is_protected = EXCLUDED.is_protected,
           type = EXCLUDED.type, tenant_id = EXCLUDED.tenant_id
         RETURNING id`,
        [u.email, u.name, u.avatar_url, u.auth_provider, u.provider_id, u.is_active, u.is_protected, u.type, tenantId]
      );
      // the insert returns an id. this id has to be populated in the participants_master as the user_id.
       await client.query(
  `INSERT INTO participants_master
   (tenant_id, type, display_name, capabilities, competency, behaviour_context,
    authorised_role, authorised_badges, is_active, user_id)
   SELECT $1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb,
          $7::jsonb, $8::jsonb, TRUE, $9`,
    [ 
    tenantId,
    u.participant_type,
    u.display_name,
    JSON.stringify(u.capabilities),
    JSON.stringify(u.competency),
    JSON.stringify(u.behaviour_context),
    JSON.stringify(u.authorised_role),
    JSON.stringify(u.authorised_badges),
    result.rows[0].id
    ]
  );

    }
    logger.info(`[seed:identity-baseline] upserted ${USERS.length} users.`);
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