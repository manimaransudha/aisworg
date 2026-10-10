import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pool from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { getPlatformTenantId} from "../constants.js";
import type { PolicyCondition, PolicyScope } from "../seuTypes.js";
import { userDB } from "../userDB.js";

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
  scope?: PolicyScope;
  governingCondition?: Record<string, unknown> | null;
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

const TEST_POLICY_DEFINITION_FILES = [
  "policy-cr104-demo-seu-commence-work.json",
  "policy-cr104-demo-background-check.json",
];

const ALL_POLICY_FILES = [
  ...POLICY_DEFINITION_FILES,
  ...(process.env.NODE_ENV !== "production" ? TEST_POLICY_DEFINITION_FILES : [])
];
export interface SeedActor {
  authoredBy: string;
  authorBadge: string;
}

const PLATFORM_TENANT_ID = await getPlatformTenantId();
  
export async function seedPolicyDefinitions(actor: SeedActor): Promise<void> {
  
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let count = 0;
    for (const file of ALL_POLICY_FILES) {
      const seed = loadJson(file);
      const applicabilityDeliverables = seed.applicabilityDeliverableNames.map((name) => ({
        name, transitions: seed.applicabilityDeliverableLifecycle, governingCondition: seed.governingCondition ?? null,
      }));
      const conditions: PolicyCondition[] = (seed.conditions ?? []).map((c) => ({
        ...c,
        applicabilityDeliverables: c.applicabilityDeliverables?.length
          ? c.applicabilityDeliverables.map((row) => ({ ...row, governingCondition: row.governingCondition ?? seed.governingCondition ?? null }))
          : applicabilityDeliverables,
      }));
      await client.query(
        `INSERT INTO policy_definitions (code, name, description, category, constraint_type, applicability_environments, conditions, scope, version, status, draft_content, tenant_id, authored_by, author_badge)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Active', $10, $11, $12, $13)
         ON CONFLICT (code, version, tenant_id) DO UPDATE SET
           name = EXCLUDED.name, description = EXCLUDED.description, category = EXCLUDED.category, constraint_type = EXCLUDED.constraint_type,
           applicability_environments = EXCLUDED.applicability_environments,
           conditions = EXCLUDED.conditions,
           scope = EXCLUDED.scope,
           draft_content = EXCLUDED.draft_content`,
        [
          seed.code, seed.name, seed.description, seed.category, seed.constraintType,
          seed.applicabilityEnvironments,
          JSON.stringify(conditions), seed.scope ?? "Transition",
          seed.version, JSON.stringify(seed), PLATFORM_TENANT_ID,
          actor.authoredBy, actor.authorBadge
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
  const { actorId, actorBadge } = await userDB.getSuperuserId();
  if (!actorId) throw new Error(`Provision a superuser before this operation.`);
  seedPolicyDefinitions({ authoredBy: actorId, authorBadge: actorBadge })
    .catch((err) => {
      logger.error("[seed:policy-definitions] failed", err as Error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
