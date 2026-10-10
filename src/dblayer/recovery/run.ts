import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pool from "../../utils/db.js";
import { logger } from "../../utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ORDER = [
  "tenants_schema_recovery.sql",
  "users_schema_recovery.sql",
  "objectives_schema_recovery.sql",
  "participants_master_schema_recovery.sql",
  "schema_definitions_schema_recovery.sql",
  "templates_schema_recovery.sql",
  "profiles_schema_recovery.sql",
  "seus_schema_recovery.sql",
  "events_schema_recovery.sql",
  "participants_schema_recovery.sql",
  "attention_items_schema_recovery.sql",
  "packs_schema_recovery.sql",
  "capabilities_schema_recovery.sql",
  "deliverables_schema_recovery.sql",
  "seu_capabilities_schema_recovery.sql",
  "capability_fulfilment_pools_schema_recovery.sql",
  "authority_rules_schema_recovery.sql",
  "quality_gates_schema_recovery.sql",
  "governance_evaluation_outcomes_schema_recovery.sql",
  "commands_schema_recovery.sql",
  "work_items_schema_recovery.sql",
  "attestations_schema_recovery.sql",
  "authority_nouns_schema_recovery.sql",
  "authority_verbs_schema_recovery.sql",
  "authority_noun_verbs_schema_recovery.sql",
  "badge_types_schema_recovery.sql",
  "capability_definitions_schema_recovery.sql",
  "capability_fulfilments_schema_recovery.sql",
  "checklists_schema_recovery.sql",
  "compliance_evaluations_schema_recovery.sql",
  "compliance_frameworks_schema_recovery.sql",
  "compliance_requirements_schema_recovery.sql",
  "compliance_waivers_schema_recovery.sql",
  "evidence_schema_recovery.sql",
  "knowledge_items_schema_recovery.sql",
  "decisions_schema_recovery.sql",
  "deliverable_authoring_content_schema_recovery.sql",
  "deliverable_definitions_schema_recovery.sql",
  "deliverable_references_schema_recovery.sql",
  "dependency_definitions_schema_recovery.sql",
  "ebms_schema_recovery.sql",
  "event_registry_schema_recovery.sql",
  "event_subscriptions_schema_recovery.sql",
  "evidence_relationships_schema_recovery.sql",
  "execution_targets_schema_recovery.sql",
  "external_interactions_schema_recovery.sql",
  "obligations_schema_recovery.sql",
  "review_gates_schema_recovery.sql",
  "reviews_schema_recovery.sql",
  "findings_schema_recovery.sql",
  "knowledge_validation_notes_schema_recovery.sql",
  "metric_definitions_schema_recovery.sql",
  "objective_capabilities_schema_recovery.sql",
  "objective_comments_schema_recovery.sql",
  "objective_root_sequences_schema_recovery.sql",
  "ontology_concepts_schema_recovery.sql",
  "ontology_concept_comments_schema_recovery.sql",
  "pack_comments_schema_recovery.sql",
  "policies_schema_recovery.sql",
  "policy_definitions_schema_recovery.sql",
  "profile_packs_schema_recovery.sql",
  "quality_gate_evaluations_schema_recovery.sql",
  "quality_gate_waivers_schema_recovery.sql",
  "route_authority_schema_recovery.sql",
  "service_definitions_schema_recovery.sql",
  "services_schema_recovery.sql",
  "template_capabilities_schema_recovery.sql",
  "template_packs_schema_recovery.sql",
  "tenant_concept_aliases_schema_recovery.sql",
  "tenant_contracts_schema_recovery.sql",
  "transition_definitions_schema_recovery.sql",
];

async function run(): Promise<void> {
  try {
    for (const file of ORDER) {
      const sql = readFileSync(path.join(__dirname, file), "utf8");
      await pool.query(sql);
      logger.info(`[recovery] ${file} applied.`);
    }
  } catch (err) {
    logger.error("[recovery] recovery run failed", err as Error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
