// Database Clean Slate — Use only for non-prod environments
// Wipes demo/usage data and test-fixture pollution while leaving the
// platform in exactly the state it needs to be in for the SDK UI and every
// governed entity type to work immediately afterward. Run:
//   pnpm db:clean-slate
import "dotenv/config";
import pool from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { seedTenantsBaseline } from "./seedBaselineTenants.js";
import { seedIdentityBaseline } from "./seedIdentityBaseline.js";
import { seedEbookLibraryObjectives } from "./seedEbookLibraryObjectives.js";
import { seedParticipantsMaster } from "./seedParticipantsMaster.js";
// transition_definitions/authority_noun_verbs/event_registry/event_subscriptions
// are DATA_MIGRATION_TARGETS tables (core/dataMigrations.ts)
// should be safe to load from clean-slate. In prod, use data-migrations
// import { seedTransitionDefinitions } from "./seedTransitionDefinitions.js";
// import { seedAuthorityVocabulary } from "./seedAuthorityVocabulary.js";
// import { seedEventSubscriptions } from "./seedEventSubscriptions.js";
import { seedCapabilityPatternPacks, type SeedActor as PackSeedActor } from "./seedCapabilityPatternPacks.js";
// import { seedDomainTechnologyPacks } from "./seedDomainTechnologyPacks.js";
// import { seedCompliancePacks } from "./seedCompliancePacks.js";
// import { seedDomainPacks } from "./seedDomainPacks.js";
// import { seedIntegrationPacks } from "./seedIntegrationPacks.js";
// import { seedSdlcPhasePacks } from "./seedSdlcPhasePacks.js";
// import { seedLegacyKnowledgeRecoveryPack } from "./seedLegacyKnowledgeRecoveryPack.js";
// import { seedDomainSpecialisationPacks } from "./seedDomainSpecialisationPacks.js";
import { seedSdlcStandardTemplates } from "./seedSdlcStandardTemplates.js";
import { seedPolicyDefinitions } from "./seedPolicyDefinitions.js";
import { seedCr104Demo } from "./seedCr104Demo.js";
// import { seedAllTabsPackFixture } from "./seedAllTabsPackFixture.js";
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
 
// Get superuser information for running clean-slate
const { userId, actorId, actorBadge } = await userDB.getSuperuserId();
console.log('User id', userId, 'Actor Id', actorId, 'Actor badge', actorBadge);

// seedCapabilityPatternPacks publishes its whole Pack list concurrently
// (Promise.all, no ordering between them — see its own header comment), but
// technology-nodejs.pack.json declares a real `required` dependency on
// "development" (openup-development.pack.json), also in that same batch.
// When "development" hasn't finished publishing yet, technology-nodejs's own
// dependency-resolution check (packs.ts's validatePackSeed, "required
// dependency not resolved: Pack ... not found in the Registry") loses the
// race and the whole call rejects — even though every other Pack in the
// batch, including "development" itself if it won its own race, already
// committed for real. publishPack/createPackDraft are rerun-safe (same
// comment), so retrying the whole call is safe: a Pack already published
// is simply a no-op on the next attempt, and by then "development" is
// there for technology-nodejs to resolve against.
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
 
// Every table hanging off seus/deliverables/objectives/participants, in one
// multi-table TRUNCATE ... CASCADE — Postgres resolves the full dependency
// closure across every table named in a single statement regardless of
// individual FK delete_rule or the order listed here, and CASCADE only
// pulls in tables that reference these — verified against the full FK dump
// that nothing outside this set does.
const USAGE_DATA_TABLES = [
  "quality_gate_evaluations",
  "work_items",
  "commands",
  "events",
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

    // Step 1 — usage/instance data + every full, unconditional table wipe
    // (profiles/templates/checklists/compliance_requirements/
    // compliance_frameworks/pack_comments folded in — single TRUNCATE ...
    // CASCADE resolves the full FK dependency closure across every table
    // named together regardless of listing order).
    await client.query(`TRUNCATE TABLE ${USAGE_DATA_TABLES.join(", ")} CASCADE`);
    logger.info(`[db:clean-slate] step 1 — truncated ${USAGE_DATA_TABLES.length} usage-data tables`);
 
    // Step 2 — users. clean-slate is a dev/test-only reset (never run in
    // production), so every account goes: real usage data, not a fixture.
    // Must run BEFORE step 3 (tenants): users.tenant_id FKs into tenants, so
    // a non-reserved tenant can't be deleted while a non-superuser user row
    // still references it ("users_tenant_id_fkey" violation).
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

    // Step 3 - reserved tenants survive
    const { rows: reservedRows } = await client.query("SELECT id FROM tenants WHERE code = ANY($1::text[])", [RESERVED_TENANT_CODES]);
    const reservedIds = reservedRows.map((r) => r.id as string);
    if (!reservedIds.length) {
      throw new Error("no reserved tenant found — migrations seed 'platform'/'demo'; refusing to wipe the tenants table without a survivor. Rolling back.");
    }
    await client.query("DELETE FROM tenant_contracts WHERE tenant_id <> ALL($1::uuid[])", [reservedIds]);
    // await client.query("DELETE FROM execution_targets WHERE tenant_id IS NOT NULL AND tenant_id <> ALL($1::uuid[])", [reservedIds]);
    await client.query("DELETE FROM tenant_concept_aliases WHERE tenant_id <> ALL($1::uuid[])", [reservedIds]);
    // Tenant-added badge variants/tiers (Layer-2/3) reference a tenant; the
    // Platform-recommended defaults (tenant_id IS NULL) are vocabulary and stay.
    // await client.query("DELETE FROM badge_tiers WHERE tenant_id IS NOT NULL AND tenant_id <> ALL($1::uuid[])", [reservedIds]);
    // await client.query("DELETE FROM badge_types WHERE tenant_id IS NOT NULL AND tenant_id <> ALL($1::uuid[])", [reservedIds]);
    const tenantsDeleted = await client.query("DELETE FROM tenants WHERE id <> ALL($1::uuid[])", [reservedIds]);
    logger.info(`[db:clean-slate] step 3 — deleted ${tenantsDeleted.rowCount} non-reserved tenants (+ their contracts and aliases).`);

    // The schema registry (schema_definitions) is a DATA_MIGRATION_TARGETS
    // table (core/dataMigrations.ts) — no longer trimmed/seeded through
    // clean-slate; run the "Schema definitions" Data Migration from the
    // admin UI instead.
    // const schemaVersionsDeleted = await client.query("DELETE FROM schema_definitions WHERE version > 1");
    // logger.info(`[db:clean-slate] trimmed ${schemaVersionsDeleted.rowCount} authored schema_definitions versions (kept version 1 per kind).`);
    // NOTE (CR-006): transition_definitions and the authority vocabulary
    // (nouns/verbs/mapping) are NOT wiped here in the main transaction — the
    // reseed steps below own them, each rebuilding fresh with an atomic
    // wipe+reseed of its own (so the app-critical transition graph is never
    // left empty between a wipe and its reseed).

    await client.query("COMMIT");
    logger.info("[db:clean-slate] committed.");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  // Seed baseline tenants
  await seedTenantsBaseline();
  
  // Seed baseline users
  await seedIdentityBaseline();
  
  // Upload the DATAMIGRATION tables
  // These need platform superuser ; Do every time you recover the schema. Not otherwise 
  await seedOntologyConcepts({ authoredBy: actorId, authorBadge: actorBadge });
  await seedRouteAuthority({ authoredBy: actorId, authorBadge: actorBadge});
  await seedEventSubscriptions({ authoredBy: actorId, authorBadge: actorBadge}); //
  await seedTransitionDefinitions({ authoredBy: actorId, authorBadge: actorBadge });
  await seedAuthorityVocabulary({ authoredBy: actorId, authorBadge: actorBadge});
  await seedSchemaDefinitions({ authoredBy: actorId, authorBadge: actorBadge });
  await seedCapabilityDefinitions({ authoredBy: actorId, authorBadge: actorBadge });
  await seedServiceDefinitions({ authoredBy: actorId, authorBadge: actorBadge });
  await seedMetricDefinitions({ authoredBy: actorId, authorBadge: actorBadge });
  // Create default profiles. 

  // Seed participants master
  // This should use Demo tenant; retain on root for now
  await seedParticipantsMaster();
  
  await seedPolicyDefinitions({ authoredBy: actorId, authorBadge: actorBadge });
  await seedCapabilityPatternPacksWithRetry({ authoredBy: actorId, authorBadge: actorBadge });
  await seedSdlcStandardTemplates({ authoredBy: actorId, authorBadge: actorBadge });
  await seedEbookLibraryObjectives(); // this needs an upgrade
  await seedCr104Demo({ authoredBy: actorId, authorBadge: actorBadge });
  
  
  logger.info("[db:clean-slate] done. Sanity-check next: hit /aisworg/seu/sdk/pack-authoring (Create starts a fresh Draft directly — no bootstrap Template needed) and /aisworg/seu/telemetry (zero Deliverables measured) as a real user.");
}

run()
  .catch((err) => {
    logger.error("[db:clean-slate] failed", err as Error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
