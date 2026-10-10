import "dotenv/config";
import pool from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { seedTenantsBaseline } from "./seedBaselineTenants.js";
import { seedIdentityBaseline } from "./seedIdentityBaseline.js";
import { seedEbookLibraryObjectives } from "./seedEbookLibraryObjectives.js";
import { seedParticipantsMaster } from "./seedParticipantsMaster.js";
import { seedCapabilityPatternPacks, type SeedActor as PackSeedActor } from "./seedCapabilityPatternPacks.js";
import { seedSdlcStandardTemplates } from "./seedSdlcStandardTemplates.js";
import { seedPolicyDefinitions } from "./seedPolicyDefinitions.js";
import { seedCr104Demo } from "./seedCr104Demo.js";
import { seedRouteAuthority } from "./seedRouteAuthority.js";
import { seedOntologyConcepts } from "./seedOntologyConcepts.js";
import { userDB } from "../userDB.js";
import { RESERVED_TENANT_CODES } from "../constants.js";
import { seedTransitionDefinitions } from "./seedTransitionDefinitions.js";
import { seedAuthorityVocabulary } from "./seedAuthorityVocabulary.js";
import { seedEventSubscriptions } from "./seedEventSubscriptions.js";
import { seedCapabilityDefinitions } from "./seedCapabilityDefinitions.js";
import { seedSchemaDefinitions } from "./seedSchemaDefinitions.js";
import { seedServiceDefinitions } from "./seedServiceDefinitions.js";
import { seedMetricDefinitions } from "./seedMetricDefinitions.js";
 
const { userId, actorId, actorBadge } = await userDB.getSuperuserId();
console.log('User id', userId, 'Actor Id', actorId, 'Actor badge', actorBadge);

async function seedCapabilityPatternPacksWithRetry(actor: PackSeedActor, attempts = 3): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await seedCapabilityPatternPacks(actor);
      return;
    } catch (err) {
      const isDependencyRace = err instanceof Error && /required dependency not resolved/.test(err.message);
      if (!isDependencyRace || attempt === attempts) throw err;
      logger.info(`[db:clean-slate] seedCapabilityPatternPacks attempt ${attempt}/${attempts} lost a Pack-dependency publish race (${(err as Error).message}) — retrying.`);
    }
  }
}
 
const USAGE_DATA_TABLES = [
  "quality_gate_evaluations",
  "work_items",
  "commands",
  "events",
  "version_events",
  "external_interactions",
  "attention_items",
  "decisions",
  "knowledge_items",
  "evidence",
  "obligations",
  "capability_fulfilments",
  "seu_capabilities",
  "participants",
  "deliverable_authoring_content",
  "deliverables",
  "ebms",
  "objective_capabilities",
  "objectives",
  "objective_root_sequences",
  "seus",
  "profiles",
  "templates",
  "checklists",
  "compliance_requirements",
  "compliance_frameworks",
  "pack_comments",
  "packs",
  "dependency_definitions",
  "metric_definitions",
  "quality_gates",
  "review_gates",
  "policies",
  "services",
  "capabilities",
  "authority_rules",
  "capability_definitions",
  "ontology_concepts",
];

async function run(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`TRUNCATE TABLE ${USAGE_DATA_TABLES.join(", ")} CASCADE`);
    logger.info(`[db:clean-slate] step 1 — truncated ${USAGE_DATA_TABLES.length} usage-data tables`);
 
    const superuserEmail = (process.env.SUPERUSER_EMAIL || "").toLowerCase();
    await client.query(
    `DELETE FROM participants_master
    WHERE user_id IS DISTINCT FROM $1`,
    [userId]
    );
    await client.query(
    `DELETE FROM users
     WHERE lower(email) <> $1`,
    [superuserEmail]
    );
    logger.info("[db:clean-slate] step 2 — truncated users");

    const { rows: reservedRows } = await client.query("SELECT id FROM tenants WHERE code = ANY($1::text[])", [RESERVED_TENANT_CODES]);
    const reservedIds = reservedRows.map((r) => r.id as string);
    if (!reservedIds.length) {
      throw new Error("no reserved tenant found — migrations seed 'platform'/'demo'; refusing to wipe the tenants table without a survivor. Rolling back.");
    }
    await client.query("DELETE FROM tenant_contracts WHERE tenant_id <> ALL($1::uuid[])", [reservedIds]);
    await client.query("DELETE FROM tenant_concept_aliases WHERE tenant_id <> ALL($1::uuid[])", [reservedIds]);
    const tenantsDeleted = await client.query("DELETE FROM tenants WHERE id <> ALL($1::uuid[])", [reservedIds]);
    logger.info(`[db:clean-slate] step 3 — deleted ${tenantsDeleted.rowCount} non-reserved tenants (+ their contracts and aliases).`);

    await client.query("COMMIT");
    logger.info("[db:clean-slate] committed.");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  await seedTenantsBaseline();
  
  await seedIdentityBaseline();
  
  await seedOntologyConcepts({ authoredBy: actorId, authorBadge: actorBadge });
  await seedRouteAuthority({ authoredBy: actorId, authorBadge: actorBadge});
  await seedEventSubscriptions({ authoredBy: actorId, authorBadge: actorBadge});
  await seedTransitionDefinitions({ authoredBy: actorId, authorBadge: actorBadge });
  await seedAuthorityVocabulary({ authoredBy: actorId, authorBadge: actorBadge});
  await seedSchemaDefinitions({ authoredBy: actorId, authorBadge: actorBadge });
  await seedCapabilityDefinitions({ authoredBy: actorId, authorBadge: actorBadge });
  await seedServiceDefinitions({ authoredBy: actorId, authorBadge: actorBadge });
  await seedMetricDefinitions({ authoredBy: actorId, authorBadge: actorBadge });

  await seedParticipantsMaster();
  
  await seedPolicyDefinitions({ authoredBy: actorId, authorBadge: actorBadge });
  await seedCapabilityPatternPacksWithRetry({ authoredBy: actorId, authorBadge: actorBadge });
  await seedSdlcStandardTemplates({ authoredBy: actorId, authorBadge: actorBadge });
  await seedEbookLibraryObjectives();
  await seedCr104Demo({ authoredBy: actorId, authorBadge: actorBadge });
  
  
  logger.info("[db:clean-slate] done. Sanity-check next: hit /aisworg/seu/sdk/pack-authoring (Create starts a fresh Draft directly — no bootstrap Template needed) and /aisworg/seu/telemetry (zero Deliverables measured) as a real user.");
}

run()
  .catch((err) => {
    logger.error("[db:clean-slate] failed", err as Error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
