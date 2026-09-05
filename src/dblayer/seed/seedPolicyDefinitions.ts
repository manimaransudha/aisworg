// CR-089 — seed the 34 canonical Policy Definitions from
// design/fragments/policies.md, one JSON file per Policy (src/dblayer/seed/data/
// policy-*.json). Same "readFileSync + hardcoded file list" pattern
// seedCompliancePacks.ts already uses for its own 33 files. Unlike Packs
// (published through publishPack's own lifecycle machinery), these are
// written directly at status='Active' via policyDefinitionsDB — same
// convention 154_service_definitions_seed.sql used for the 60 Service
// Definitions: "a bulk import of an already-vetted catalog... Packs/
// Templates/Ontology concepts are never walked through their own authoring
// lifecycle one row at a time either."
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pool from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { PLATFORM_TENANT_ID } from "../constants.js";
import type { PolicyCondition } from "../seuTypes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");

interface PolicyDefinitionSeedFile {
  code: string;
  name: string;
  description: string;
  category: string;
  constraintType: "Policy" | "Standard";
  applicabilityDeliverableNames: string[];
  applicabilityEnvironments: string[];
  applicabilityDeliverableLifecycle: string[];
  conditions: PolicyCondition[];
  version: string;
}

function loadJson(fileName: string): PolicyDefinitionSeedFile {
  return JSON.parse(readFileSync(path.join(dataDir, fileName), "utf8")) as PolicyDefinitionSeedFile;
}

const POLICY_DEFINITION_FILES = [
  "policy-architecture-documentation-required.json",
  "policy-test-coverage-threshold.json",
  "policy-coding-standards.json",
  "policy-requirements-traceability-required.json",
  "policy-baseline-integrity.json",
  "policy-requirements-and-discovery-artifact-completeness.json",
  "policy-design-completeness-and-review.json",
  "policy-build-and-configuration-artifact-integrity.json",
  "policy-ai-embedded-and-data-specialisation-artifact-completeness.json",
  "policy-encryption-required.json",
  "policy-secrets-management.json",
  "policy-dependency-vulnerability-threshold.json",
  "policy-code-review-required.json",
  "policy-static-analysis-required.json",
  "policy-performance-validation.json",
  "policy-test-and-quality-evidence-completeness.json",
  "policy-deployment-approval-required.json",
  "policy-backup-validation.json",
  "policy-rollback-capability.json",
  "policy-change-approval-required.json",
  "policy-release-and-operations-artifact-completeness.json",
  "policy-adr-required.json",
  "policy-api-documentation-mandatory.json",
  "policy-operational-runbook-required.json",
  "policy-customer-sign-off-required.json",
  "policy-business-approval-required.json",
  "policy-release-notification.json",
  "policy-internal-review-process.json",
  "policy-engineering-standards.json",
  "policy-vendor-risk-assessment-required.json",
  "policy-governance-tier-alignment.json",
  "policy-change-and-decision-governance-artifact-completeness.json",
  "policy-vendor-and-compliance-evidence-completeness.json",
  "policy-organisational-knowledge-currency.json",
];

export async function seedPolicyDefinitions(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let count = 0;
    for (const file of POLICY_DEFINITION_FILES) {
      const seed = loadJson(file);
      await client.query(
        `INSERT INTO policy_definitions (code, name, description, category, constraint_type, applicability_deliverable_names, applicability_environments, applicability_deliverable_lifecycle, conditions, version, status, draft_content, tenant_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Active', $11, $12)
         ON CONFLICT (code, version, tenant_id) DO UPDATE SET
           name = EXCLUDED.name, description = EXCLUDED.description, category = EXCLUDED.category, constraint_type = EXCLUDED.constraint_type,
           applicability_deliverable_names = EXCLUDED.applicability_deliverable_names, applicability_environments = EXCLUDED.applicability_environments,
           applicability_deliverable_lifecycle = EXCLUDED.applicability_deliverable_lifecycle, conditions = EXCLUDED.conditions, draft_content = EXCLUDED.draft_content`,
        [
          seed.code, seed.name, seed.description, seed.category, seed.constraintType,
          seed.applicabilityDeliverableNames, seed.applicabilityEnvironments, seed.applicabilityDeliverableLifecycle,
          JSON.stringify(seed.conditions), seed.version, JSON.stringify(seed), PLATFORM_TENANT_ID,
        ]
      );
      count++;
    }
    await client.query("COMMIT");
    logger.info(`[seed:policy-definitions] ${count} Policy Definitions seeded (Active, Platform-owned).`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  seedPolicyDefinitions()
    .catch((err) => {
      logger.error("[seed:policy-definitions] failed", err as Error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
