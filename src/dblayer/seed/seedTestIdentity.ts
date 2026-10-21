import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createRequire } from "node:module";
import pool from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { tenantsDB } from "../tenantsDB.js";
import { ATHENS_TENANT_NAME, BABYLON_TENANT_NAME, NO_EXPIRY_DATE } from "../constants.js";

const require = createRequire(import.meta.url);
const bcrypt = require("bcryptjs");
const __dirname = path.dirname(fileURLToPath(import.meta.url));


function allNounVerbBadges(): Array<{ badge: string; effective_till: string; seu_ids: string[] }> {
  const raw = readFileSync(path.join(__dirname, "data", "authorityVocabulary.json"), "utf8");
  const vocab = JSON.parse(raw) as { authoringMappings?: Array<{ noun: string; verbs: string[] }> };
  const transitions = JSON.parse(readFileSync(path.join(__dirname, "data", "transitionDefinitions.json"), "utf8")) as Array<{ entityType: string; verb?: string }>;
  const pairs = new Set<string>();
  for (const t of transitions) if (t.verb) pairs.add(`${t.entityType.toLowerCase()}_${t.verb}`);
  for (const m of vocab.authoringMappings ?? []) for (const v of m.verbs) pairs.add(`${m.noun.toLowerCase()}_${v}`);
  return [...pairs].sort().map((badge) => ({ badge, effective_till: NO_EXPIRY_DATE, seu_ids: [] }));
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

// Test-fixture users and Participants of the Athens and Babylon tenants (tests/globalSetup.ts), never seeded by db:clean-slate.
const USERS: SeedUser[] = [
  {email: "superadmin@athens.com", name: "Super Admin Athens", avatar_url: null, display_name: "Athens admin", auth_provider: "local", provider_id: null, is_active: true, is_protected: false, type: "Platform", tenant_name: ATHENS_TENANT_NAME,participant_type: "Human", capabilities: [], competency: [], behaviour_context: [], authorised_role: [{"role":"superuser","effective_till":NO_EXPIRY_DATE,"seu_ids":[]}], authorised_badges: [{"badge":"root","effective_till":NO_EXPIRY_DATE,"seu_ids":[]}] },
  {email: "superadmin@babylon.com", name: "Super Admin Babylon", avatar_url: null, display_name: "Babylon admin", auth_provider: "local", provider_id: null, is_active: true, is_protected: false, type: "Tenant", tenant_name: BABYLON_TENANT_NAME,participant_type: "Human", capabilities: [], competency: [], behaviour_context: [], authorised_role: [{"role":"superuser","effective_till":NO_EXPIRY_DATE,"seu_ids":[]}], authorised_badges: [{"badge":"root","effective_till":NO_EXPIRY_DATE,"seu_ids":[]}] },
  {email: "tester-objective-athens@test.local", name: "Test — Objective Badges (Athens)", avatar_url: null, display_name: "Athens Test Objective Badges", auth_provider: "local", provider_id: null, is_active: true, is_protected: false, type: "Tenant", tenant_name: ATHENS_TENANT_NAME,participant_type: "Human", capabilities: [], competency: [], behaviour_context: [], authorised_role: [{"role":"general","effective_till":NO_EXPIRY_DATE,"seu_ids":[]}], authorised_badges: [
    {"badge":"objective_propose","effective_till":NO_EXPIRY_DATE,"seu_ids":[]},
    {"badge":"objective_activate","effective_till":NO_EXPIRY_DATE,"seu_ids":[]},
    {"badge":"objective_reject","effective_till":NO_EXPIRY_DATE,"seu_ids":[]},
    {"badge":"objective_achieve","effective_till":NO_EXPIRY_DATE,"seu_ids":[]},
    {"badge":"objective_supersede","effective_till":NO_EXPIRY_DATE,"seu_ids":[]},
    {"badge":"objective_retire","effective_till":NO_EXPIRY_DATE,"seu_ids":[]},
    {"badge":"objective_archive","effective_till":NO_EXPIRY_DATE,"seu_ids":[]},
    {"badge":"objective_all","effective_till":NO_EXPIRY_DATE,"seu_ids":[]}
  ] },
  {email: "tester-objective-babylon@test.local", name: "Test — Objective Badges (Babylon)", avatar_url: null, display_name: "Babylon Test Objective Badges", auth_provider: "local", provider_id: null, is_active: true, is_protected: false, type: "Tenant", tenant_name: BABYLON_TENANT_NAME,participant_type: "Human", capabilities: [], competency: [], behaviour_context: [], authorised_role: [{"role":"general","effective_till":NO_EXPIRY_DATE,"seu_ids":[]}], authorised_badges: [
    {"badge":"objective_propose","effective_till":NO_EXPIRY_DATE,"seu_ids":[]},
    {"badge":"objective_activate","effective_till":NO_EXPIRY_DATE,"seu_ids":[]},
    {"badge":"objective_reject","effective_till":NO_EXPIRY_DATE,"seu_ids":[]},
    {"badge":"objective_achieve","effective_till":NO_EXPIRY_DATE,"seu_ids":[]},
    {"badge":"objective_supersede","effective_till":NO_EXPIRY_DATE,"seu_ids":[]},
    {"badge":"objective_retire","effective_till":NO_EXPIRY_DATE,"seu_ids":[]},
    {"badge":"objective_archive","effective_till":NO_EXPIRY_DATE,"seu_ids":[]},
    {"badge":"objective_all","effective_till":NO_EXPIRY_DATE,"seu_ids":[]}
  ] },
  {email: "tester-objective-achieve-only@test.local", name: "Test — Objective Achieve Only (Athens)", avatar_url: null, display_name: "Athens Test Objective Achieve Only", auth_provider: "local", provider_id: null, is_active: true, is_protected: false, type: "Tenant", tenant_name: ATHENS_TENANT_NAME,participant_type: "Human", capabilities: [], competency: [], behaviour_context: [], authorised_role: [{"role":"general","effective_till":NO_EXPIRY_DATE,"seu_ids":[]}], authorised_badges: [
    {"badge":"objective_achieve","effective_till":NO_EXPIRY_DATE,"seu_ids":[]}
  ] },
  {email: "tester-acceptance-journey@test.local", name: "Test — Acceptance Journey (Athens)", avatar_url: null, display_name: "Athens Test Acceptance Journey", auth_provider: "local", provider_id: null, is_active: true, is_protected: false, type: "Tenant", tenant_name: ATHENS_TENANT_NAME, participant_type: "Human", capabilities: [], competency: [], behaviour_context: [], authorised_role: [{"role":"general","effective_till":NO_EXPIRY_DATE,"seu_ids":[]}], authorised_badges: allNounVerbBadges() },
];

export async function seedTestIdentity(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const u of USERS) {
      const tenantResult = await tenantsDB.findByName(u.tenant_name);
      if (tenantResult.error) {
        throw new Error("Error retrieving tenant details");
      }
      const tenantId = tenantResult.data?.id ?? null;

      if (!tenantId) {
        logger.error(`[seed:test-identity] tenant not provisioned`);
        continue;
      }

      // Runs on every test run, so a user already seeded (and its Participant) is left as is.
      const existing = await client.query("SELECT 1 FROM users WHERE lower(email) = lower($1)", [u.email]);
      if (existing.rows.length > 0) continue;

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
    logger.info(`[seed:test-identity] upserted ${USERS.length} users.`);
    await client.query("COMMIT");
    logger.info("[seed:test-identity] done.");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

