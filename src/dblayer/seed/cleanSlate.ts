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
import { seedCapabilityPatternPacks } from "./seedCapabilityPatternPacks.js";
import { seedDomainTechnologyPacks } from "./seedDomainTechnologyPacks.js";
import { seedCompliancePacks } from "./seedCompliancePacks.js";
import { seedDomainPacks } from "./seedDomainPacks.js";
import { seedIntegrationPacks } from "./seedIntegrationPacks.js";
import { seedSdlcPhasePacks } from "./seedSdlcPhasePacks.js";
import { seedLegacyKnowledgeRecoveryPack } from "./seedLegacyKnowledgeRecoveryPack.js";
import { seedDomainSpecialisationPacks } from "./seedDomainSpecialisationPacks.js";
import { seedSdlcStandardTemplates } from "./seedSdlcStandardTemplates.js";
import { seedPolicyDefinitions } from "./seedPolicyDefinitions.js";
import { seedCr104Demo } from "./seedCr104Demo.js";
import { seedAllTabsPackFixture } from "./seedAllTabsPackFixture.js";
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
 
// Get superuser information for running clean-slate
const { userId, actorId, actorBadge } = await userDB.getSuperuserId();
console.log('User id', userId, 'Actor Id', actorId, 'Actor badge', actorBadge);
 
const REAL_METRIC_IDENTIFIERS = [
  "deliverable-cycle-time",
  "quality-gate-latency",
  "command-generation-rate",
  "dispatch-latency",
  "work-item-duration",
  "knowledge-growth",
  "evidence-generation",
  "rework-rate",
  "deliverable-acceptance-rate",
];

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
  // "participants_master",
  "deliverable_authoring_content",
  "deliverables",
  "ebms",
  "objective_capabilities",
  "objectives",
  "objective_root_sequences",
  "seus",
];

async function run(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Step 1 — usage/instance data. Must run before step 2: ebms (just
    // wiped) FKs into templates/profiles, and deleting a Template/Profile
    // while a stale ebms row still referenced it would otherwise fail.
    await client.query(`TRUNCATE TABLE ${USAGE_DATA_TABLES.join(", ")} CASCADE`);
    logger.info(`[db:clean-slate] step 1 — truncated ${USAGE_DATA_TABLES.length} usage-data tables`);

    // Step 2 — users. clean-slate is a dev/test-only reset (never run in
    // production), so every account goes: real usage data, not a fixture. 
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

    // Step 3 — delete dependency definitions for templates and profiles
    const dependencyDefsForTemplatesProfilesDeleted = await client.query(
      "DELETE FROM dependency_definitions WHERE owning_entity_type IN ('Template', 'Profile', 'Pack')"
    );
    logger.info(
      `[db:clean-slate] step 3 — deleted ${dependencyDefsForTemplatesProfilesDeleted.rowCount} Template/Profile/Pack owned dependency_definitions.`
    );

    // Step 4 — delete  profiles
    const profilesDeleted = await client.query("DELETE FROM profiles");
    logger.info(
      `[db:clean-slate] step 4 — deleted ${profilesDeleted.rowCount} Profiles.`
    );

    // Step 5 — delete templates
    const templatesDeleted = await client.query("DELETE FROM templates");
    logger.info(
      `[db:clean-slate] step 5 — deleted ${templatesDeleted.rowCount} templates.`
    );

    // Step 6 — delete quality gates
    const qgDeleted = await client.query("DELETE FROM quality_gates WHERE originating_pack_id IS NOT NULL");
    logger.info(
      `[db:clean-slate] step 6 — deleted ${qgDeleted.rowCount} quality gates.`
    );

    // Step 7 — delete review gates
    const rgDeleted = await client.query("DELETE FROM review_gates WHERE originating_pack_id IS NOT NULL");
    logger.info(
      `[db:clean-slate] step 7 — deleted ${rgDeleted.rowCount} review gates.`
    );

    // Step 8 — delete checklists
    const clDeleted = await client.query("DELETE FROM checklists");
    logger.info(
      `[db:clean-slate] step 8 — deleted ${clDeleted.rowCount} checklists.`
    );

    // Step 9 — delete policies
    const policiesDeleted = await client.query("DELETE FROM policies WHERE originating_pack_id IS NOT NULL");
    logger.info(
      `[db:clean-slate] step 9 — deleted ${policiesDeleted.rowCount} policies.`
    );

    // Step 10 — delete authority rules
    // const authorityRulesDeleted = await client.query("DELETE FROM authority_rules WHERE originating_pack_id IS NOT NULL");
    // logger.info(
    //   `[db:clean-slate] step 10 — deleted ${authorityRulesDeleted.rowCount} authority rules.`
    // );

    // Step 11 — delete services rules
    const servicesDeleted = await client.query("DELETE FROM services WHERE originating_pack_id IS NOT NULL");
    logger.info(
      `[db:clean-slate] step 11 — deleted ${servicesDeleted.rowCount} services.`
    );

    // Step 12 — delete execution targets
    const executionTargetsDeleted = await client.query(
      "DELETE FROM execution_targets WHERE capability_id IN (SELECT id FROM capabilities WHERE originating_pack_id IS NOT NULL)"
    );
    logger.info(
      `[db:clean-slate] step 12 — deleted ${executionTargetsDeleted.rowCount} execution targets.`
    );
    
    // Step 13 — delete execution targets
    const capabilitiesDeleted = await client.query("DELETE FROM capabilities WHERE originating_pack_id IS NOT NULL");
    logger.info(
      `[db:clean-slate] step 13 — deleted ${capabilitiesDeleted.rowCount} capabilities.`
    );

    // Step 14 — delete metrics
    const metricsDeleted = await client.query("DELETE FROM metric_definitions WHERE identifier != ALL($1::text[])", [REAL_METRIC_IDENTIFIERS]);
    logger.info(
      `[db:clean-slate] step 14 — deleted ${metricsDeleted.rowCount} metrics definitions.`
    );

    // Step 15 — delete compliance requests
    const complianceReqDeleted = await client.query("DELETE FROM compliance_requirements");
    logger.info(
      `[db:clean-slate] step 15 — deleted ${complianceReqDeleted.rowCount} compliance requirements.`
    );

    // Step 16 — delete compliance requests
    const complianceFwDeleted = await client.query("DELETE FROM compliance_frameworks");
    logger.info(
      `[db:clean-slate] step 16 — deleted ${complianceFwDeleted.rowCount} compliance_frameworks.`
    );
    
    // Step 17 — delete pack comments
    const packCommentsDeleted = await client.query("DELETE FROM pack_comments");
    logger.info(
      `[db:clean-slate] step 17 — deleted ${packCommentsDeleted.rowCount} pack comments.`
    );
    
    // Step 18 — delete packs
    // const packsDeleted = await client.query("DELETE FROM packs");
    // logger.info(
    //   `[db:clean-slate] step 18 — deleted ${packsDeleted.rowCount} packs.`
    // );
    
    // Step 19 - reserved tenants survive
    const { rows: reservedRows } = await client.query("SELECT id FROM tenants WHERE code = ANY($1::text[])", [RESERVED_TENANT_CODES]);
    const reservedIds = reservedRows.map((r) => r.id as string);
    if (!reservedIds.length) {
      throw new Error("no reserved tenant found — migrations seed 'default'/'platform'/'demo'; refusing to wipe the tenants table without a survivor. Rolling back.");
    }
    await client.query("DELETE FROM tenant_contracts WHERE tenant_id <> ALL($1::uuid[])", [reservedIds]);
    // await client.query("DELETE FROM execution_targets WHERE tenant_id IS NOT NULL AND tenant_id <> ALL($1::uuid[])", [reservedIds]);
    await client.query("DELETE FROM tenant_concept_aliases WHERE tenant_id <> ALL($1::uuid[])", [reservedIds]);
    // Tenant-added badge variants/tiers (Layer-2/3) reference a tenant; the
    // Platform-recommended defaults (tenant_id IS NULL) are vocabulary and stay.
    // await client.query("DELETE FROM badge_tiers WHERE tenant_id IS NOT NULL AND tenant_id <> ALL($1::uuid[])", [reservedIds]);
    // await client.query("DELETE FROM badge_types WHERE tenant_id IS NOT NULL AND tenant_id <> ALL($1::uuid[])", [reservedIds]);
    const tenantsDeleted = await client.query("DELETE FROM tenants WHERE id <> ALL($1::uuid[])", [reservedIds]);
    logger.info(`[db:clean-slate] step 19 — deleted ${tenantsDeleted.rowCount} non-reserved tenants (+ their contracts and aliases).`);

    // Step 2e — the schema registry (schema_definitions). 
    // schema_definitions is a DATA_MIGRATION_TARGETS table (core/dataMigrations.ts)
    // — no longer trimmed/seeded through clean-slate; run the "Schema
    // definitions" Data Migration from the admin UI instead.
    // const schemaVersionsDeleted = await client.query("DELETE FROM schema_definitions WHERE version > 1");
    // logger.info(`[db:clean-slate] step 2e — trimmed ${schemaVersionsDeleted.rowCount} authored schema_definitions versions (kept version 1 per kind).`);
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
  await seedAuthorityVocabulary({ authoredBy: actorId, authorBadge: actorBadge});
  await seedEventSubscriptions({ authoredBy: actorId, authorBadge: actorBadge}); //
  await seedTransitionDefinitions({ authoredBy: actorId, authorBadge: actorBadge });
  await seedSchemaDefinitions({ authoredBy: actorId, authorBadge: actorBadge });
  await seedCapabilityDefinitions({ authoredBy: actorId, authorBadge: actorBadge });
  await seedServiceDefinitions({ authoredBy: actorId, authorBadge: actorBadge });
  // Create default profiles. 

  // Seed participants master
  // This should use Demo tenant; retain on root for now
  await seedParticipantsMaster();
  
  await seedPolicyDefinitions({ authoredBy: actorId, authorBadge: actorBadge });
  await seedCapabilityPatternPacks({ authoredBy: actorId, authorBadge: actorBadge });
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
