import "dotenv/config";
import pool from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { ATHENS_TENANT_NAME, BABYLON_TENANT_NAME, TEST_PLATFORM_TENANT_NAME, TEST_PLATFORM_USER_EMAIL, TEST_ALL_EMAIL, TEST_CREATOR_EMAIL, TEST_APPROVER_EMAIL, RESERVED_TENANT_CODES } from "../constants.js";

// Removes the records the test suite leaves in the database.
//
// A test tenant is a tenant authored by the test-platform participant (every tenant a test creates), or one of the seeded test tenants
// (Athens, Babylon, test-platform), which are found by name. Everything those tenants hold is deleted: rows with a tenant_id of their own,
// rows reached through an SEU of those tenants, and rows reached through a Pack, Template, Profile or Objective of those tenants.
// The test-platform tenant, its user and its participant, and the tester-* users and their participants, stay, because tests author as that participant and db:clean-slate seeds it.
//
// Global tables (authority verbs, nouns and noun-verbs, schema definitions) have no tenant; the rows a test participant authored in them are deleted last.
//
// Usage: pnpm exec tsx src/dblayer/seed/cleanTestData.ts [--dry-run]
// Everything runs in one transaction. A dry run rolls it back after reporting the row counts, and so does any failure.

// Temporary id sets, taken once before the first delete so that deleting a parent does not hide its children.
const TEMP_TABLES: Array<[string, string]> = [
  ["ts", "SELECT id FROM seus WHERE tenant_id IN (SELECT id FROM tt)"],
  ["tp", "SELECT id FROM packs WHERE tenant_id IN (SELECT id FROM tt)"],
  ["tpl", "SELECT id FROM templates WHERE tenant_id IN (SELECT id FROM tt)"],
  ["tpr", "SELECT id FROM profiles WHERE tenant_id IN (SELECT id FROM tt)"],
  ["tob", "SELECT id FROM objectives WHERE sponsoring_authority->>'tenant' IN (SELECT id::text FROM tt)"],
  ["tcd", "SELECT id FROM capability_definitions WHERE tenant_id IN (SELECT id FROM tt)"],
  ["tdel", "SELECT id FROM deliverables WHERE seu_id IN (SELECT id FROM ts)"],
  ["tev", "SELECT id FROM events WHERE tenant_id IN (SELECT id FROM tt) OR seu_id IN (SELECT id FROM ts)"],
  ["tpm", "SELECT id FROM participants_master WHERE tenant_id IN (SELECT id FROM tt) AND id NOT IN (SELECT id FROM keep_pms)"],
  ["tau", "SELECT id FROM participants_master WHERE tenant_id IN (SELECT id FROM tt)"],
];

// Children first: the order of the foreign keys of the live database.
const DELETES: Array<[string, string]> = [
  ["attention_items", "seu_id IN (SELECT id FROM ts)"],
  ["attestations", "seu_id IN (SELECT id FROM ts)"],
  ["work_items", "command_id IN (SELECT id FROM commands WHERE seu_id IN (SELECT id FROM ts))"],
  ["deliverable_references", "seu_id IN (SELECT id FROM ts)"],
  ["commands", "seu_id IN (SELECT id FROM ts)"],
  ["governance_evaluation_outcomes", "seu_id IN (SELECT id FROM ts) OR originating_pack_id IN (SELECT id FROM tp)"],
  ["authority_rules", "originating_pack_id IN (SELECT id FROM tp)"],
  ["template_capabilities", "template_id IN (SELECT id FROM tpl) OR capability_id IN (SELECT id FROM capabilities WHERE originating_pack_id IN (SELECT id FROM tp))"],
  ["capabilities", "originating_pack_id IN (SELECT id FROM tp)"],
  ["evidence_relationships", "evidence_id IN (SELECT id FROM evidence WHERE deliverable_id IN (SELECT id FROM tdel) OR author_id IN (SELECT id FROM participants WHERE seu_id IN (SELECT id FROM ts)))"],
  ["evidence", "deliverable_id IN (SELECT id FROM tdel) OR author_id IN (SELECT id FROM participants WHERE seu_id IN (SELECT id FROM ts))"],
  ["knowledge_validation_notes", "knowledge_item_id IN (SELECT id FROM knowledge_items WHERE seu_id IN (SELECT id FROM ts) OR deliverable_id IN (SELECT id FROM tdel))"],
  ["knowledge_items", "seu_id IN (SELECT id FROM ts) OR deliverable_id IN (SELECT id FROM tdel)"],
  ["deliverable_authoring_content", "deliverable_id IN (SELECT id FROM tdel)"],
  ["external_interactions", "seu_id IN (SELECT id FROM ts) OR deliverable_id IN (SELECT id FROM tdel)"],
  ["deliverables", "seu_id IN (SELECT id FROM ts)"],
  ["capability_fulfilment_pools", "seu_id IN (SELECT id FROM ts)"],
  ["capability_fulfilments", "seu_capability_id IN (SELECT id FROM seu_capabilities WHERE seu_id IN (SELECT id FROM ts))"],
  ["seu_capabilities", "seu_id IN (SELECT id FROM ts)"],
  ["execution_targets", "tenant_id IN (SELECT id FROM tt)"],
  ["services", "originating_pack_id IN (SELECT id FROM tp) OR providing_capability_id IN (SELECT id FROM tcd)"],
  ["capability_definitions", "tenant_id IN (SELECT id FROM tt)"],
  ["checklists", "originating_pack_id IN (SELECT id FROM tp)"],
  ["compliance_evaluations", "seu_id IN (SELECT id FROM ts)"],
  ["compliance_waivers", "seu_id IN (SELECT id FROM ts) OR requirement_code IN (SELECT code FROM compliance_requirements WHERE originating_pack_id IN (SELECT id FROM tp))"],
  ["compliance_requirements", "originating_pack_id IN (SELECT id FROM tp)"],
  ["compliance_frameworks", "originating_pack_id IN (SELECT id FROM tp)"],
  ["decisions", "seu_id IN (SELECT id FROM ts)"],
  ["deliverable_definitions", "tenant_id IN (SELECT id FROM tt)"],
  ["dependency_definitions", "(owning_entity_type = 'Template' AND owning_entity_id IN (SELECT id FROM tpl)) OR (owning_entity_type = 'Pack' AND owning_entity_id IN (SELECT id FROM tp)) OR (owning_entity_type = 'Profile' AND owning_entity_id IN (SELECT id FROM tpr))"],
  ["version_events", "tenant_id IN (SELECT id FROM tt) OR event_id IN (SELECT id FROM tev)"],
  ["events", "id IN (SELECT id FROM tev)"],
  ["findings", "seu_id IN (SELECT id FROM ts)"],
  ["obligations", "seu_id IN (SELECT id FROM ts)"],
  ["reviews", "seu_id IN (SELECT id FROM ts)"],
  ["quality_gate_evaluations", "seu_id IN (SELECT id FROM ts)"],
  ["participants", "seu_id IN (SELECT id FROM ts) OR participant_id IN (SELECT id FROM tpm)"],
  ["quality_gate_waivers", "seu_id IN (SELECT id FROM ts) OR quality_gate_id IN (SELECT id FROM quality_gates WHERE originating_pack_id IN (SELECT id FROM tp))"],
  ["seus", "tenant_id IN (SELECT id FROM tt)"],
  ["ebms", "seu_id IN (SELECT id FROM ts) OR template_id IN (SELECT id FROM tpl) OR profile_id IN (SELECT id FROM tpr)"],
  ["metric_definitions", "originating_pack_id IN (SELECT id FROM tp)"],
  ["objective_comments", "objective_id IN (SELECT id FROM tob)"],
  ["objective_capabilities", "objective_id IN (SELECT id FROM tob)"],
  ["objective_root_sequences", "tenant_id IN (SELECT id FROM tt)"],
  ["objectives", "id IN (SELECT id FROM tob)"],
  ["ontology_concept_comments", "concept_id IN (SELECT id FROM ontology_concepts WHERE tenant_id IN (SELECT id FROM tt))"],
  ["ontology_concepts", "tenant_id IN (SELECT id FROM tt)"],
  ["pack_comments", "pack_id IN (SELECT id FROM tp)"],
  ["quality_gates", "originating_pack_id IN (SELECT id FROM tp)"],
  ["review_gates", "originating_pack_id IN (SELECT id FROM tp)"],
  ["policies", "originating_pack_id IN (SELECT id FROM tp)"],
  ["packs", "id IN (SELECT id FROM tp)"],
  ["service_definitions", "tenant_id IN (SELECT id FROM tt)"],
  ["profile_packs", "profile_id IN (SELECT id FROM tpr)"],
  ["profiles", "id IN (SELECT id FROM tpr)"],
  ["template_packs", "template_id IN (SELECT id FROM tpl)"],
  ["templates", "id IN (SELECT id FROM tpl)"],
  ["policy_definitions", "tenant_id IN (SELECT id FROM tt)"],
  ["badge_types", "tenant_id IN (SELECT id FROM tt)"],
  ["tenant_concept_aliases", "tenant_id IN (SELECT id FROM tt)"],
  ["tenant_contracts", "tenant_id IN (SELECT id FROM tt)"],
  ["participants_master", "id IN (SELECT id FROM tpm)"],
  ["users", "tenant_id IN (SELECT id FROM tt) AND id NOT IN (SELECT id FROM keep_users)"],
  ["tenants", "id IN (SELECT id FROM tt) AND id <> (SELECT tenant_id FROM keep_participant)"],
];

// Global tables have no tenant. A row in them is a test row when a participant of a test tenant (the kept test-platform participant included) authored it.
// Run after DELETES, children first. Rows with an originating Pack are test rows only when the Pack is (deleted above), so the tables that carry
// a Pack take only the rows that have none.
const GLOBAL_DELETES: Array<[string, string]> = [
  ["authority_noun_verbs", "author_id IN (SELECT id FROM tau)"],
  ["authority_verbs", "author_id IN (SELECT id FROM tau)"],
  ["authority_nouns", "author_id IN (SELECT id FROM tau)"],
  ["schema_definitions", "author_id IN (SELECT id FROM tau)"],
  ["authority_rules", "originating_pack_id IS NULL AND author_id IN (SELECT id FROM tau)"],
  ["compliance_requirements", "originating_pack_id IS NULL AND author_id IN (SELECT id FROM tau)"],
  ["compliance_frameworks", "originating_pack_id IS NULL AND author_id IN (SELECT id FROM tau)"],
  ["metric_definitions", "originating_pack_id IS NULL AND author_id IN (SELECT id FROM tau)"],
];

async function run(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // The test-platform participant, its user and its tenant are kept.
    const actor = await client.query<{ participant_id: string; user_id: string; tenant_id: string }>(
      `SELECT pm.id AS participant_id, u.id AS user_id, pm.tenant_id
       FROM participants_master pm JOIN users u ON u.id = pm.user_id
       WHERE lower(u.email) = lower($1)`,
      [TEST_PLATFORM_USER_EMAIL]
    );
    if (actor.rows.length === 0) throw new Error(`cleanTestData: ${TEST_PLATFORM_USER_EMAIL} is not provisioned -- run db:clean-slate first.`);
    const keep = actor.rows[0];

    const tenants = await client.query<{ id: string; code: string }>(
      "SELECT id, code FROM tenants WHERE author_id = $1 OR name = ANY($2::text[])",
      [keep.participant_id, [ATHENS_TENANT_NAME, BABYLON_TENANT_NAME, TEST_PLATFORM_TENANT_NAME]]
    );
    const reserved = tenants.rows.filter((t) => RESERVED_TENANT_CODES.includes(t.code));
    if (reserved.length) throw new Error(`cleanTestData: refusing to clean reserved tenant(s): ${reserved.map((t) => t.code).join(", ")}`);
    logger.info(`[clean-test-data] ${tenants.rows.length} test tenants: ${tenants.rows.map((t) => t.code).join(", ")}`);

    await client.query("CREATE TEMP TABLE tt (id uuid) ON COMMIT DROP");
    await client.query("INSERT INTO tt SELECT unnest($1::uuid[])", [tenants.rows.map((t) => t.id)]);
    await client.query("CREATE TEMP TABLE keep_participant (id uuid, tenant_id uuid) ON COMMIT DROP");
    await client.query("INSERT INTO keep_participant VALUES ($1, $2)", [keep.participant_id, keep.tenant_id]);
    await client.query("CREATE TEMP TABLE keep_user (id uuid) ON COMMIT DROP");
    await client.query("INSERT INTO keep_user VALUES ($1)", [keep.user_id]);
    // db:clean-slate also seeds the tester-* users and their participants in the test-platform tenant, and tests resolve them by email, so they stay too.
    await client.query("CREATE TEMP TABLE keep_users (id uuid) ON COMMIT DROP");
    await client.query("INSERT INTO keep_users SELECT id FROM users WHERE lower(email) = ANY($1::text[])", [[TEST_PLATFORM_USER_EMAIL, TEST_ALL_EMAIL, TEST_CREATOR_EMAIL, TEST_APPROVER_EMAIL].map((e) => e.toLowerCase())]);
    await client.query("CREATE TEMP TABLE keep_pms (id uuid) ON COMMIT DROP");
    await client.query("INSERT INTO keep_pms SELECT id FROM participants_master WHERE user_id IN (SELECT id FROM keep_users)");
    for (const [name, select] of TEMP_TABLES) {
      await client.query(`CREATE TEMP TABLE ${name} (id uuid) ON COMMIT DROP`);
      await client.query(`INSERT INTO ${name} ${select}`);
    }

    let total = 0;
    for (const [table, where] of [...DELETES, ...GLOBAL_DELETES]) {
      const result = await client.query(`DELETE FROM ${table} WHERE ${where}`);
      total += result.rowCount ?? 0;
      if (result.rowCount) logger.info(`[clean-test-data] ${table}: ${result.rowCount}`);
    }
    logger.info(`[clean-test-data] ${total} rows ${dryRun ? "would be deleted (dry run, rolled back)" : "deleted"}.`);

    await client.query(dryRun ? "ROLLBACK" : "COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

run()
  .catch((err) => {
    logger.error("[clean-test-data] failed", err as Error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
