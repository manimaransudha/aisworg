import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { bulkInsert } from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import type { PolicyCondition, PolicyScope } from "../seuTypes.js";
import { getTestPlatformTenantId } from "./seedTestIdentity.js";

// Test copies of the Platform Policy Definitions: the files test-fixtures/test-policy-*.json, each with a "test-" code, seeded Active into the
// test-platform tenant. Tests use these and never the Platform Policy Definitions.

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "data", "test-fixtures");

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

export interface SeedActor {
  authoredBy: string;
  authorBadge: string;
}

export async function seedTestPolicyDefinitions(actor: SeedActor): Promise<void> {
  const tenantId = await getTestPlatformTenantId();
  const seeds = readdirSync(dataDir)
    .filter((file) => file.startsWith("test-policy-") && file.endsWith(".json"))
    .map((file) => JSON.parse(readFileSync(path.join(dataDir, file), "utf8")) as PolicyDefinitionSeedFile);
  const rows = seeds.map((seed) => {
    const applicabilityDeliverables = seed.applicabilityDeliverableNames.map((name) => ({
      name, transitions: seed.applicabilityDeliverableLifecycle, governingCondition: seed.governingCondition ?? null,
    }));
    const conditions: PolicyCondition[] = (seed.conditions ?? []).map((c) => ({
      ...c,
      applicabilityDeliverables: c.applicabilityDeliverables?.length
        ? c.applicabilityDeliverables.map((row) => ({ ...row, governingCondition: row.governingCondition ?? seed.governingCondition ?? null }))
        : applicabilityDeliverables,
    }));
    return [
      seed.code, seed.name, seed.description, seed.category, seed.constraintType, seed.applicabilityEnvironments,
      JSON.stringify(conditions), seed.scope ?? "Transition", seed.version, "Active", JSON.stringify(seed), tenantId, actor.authoredBy, actor.authorBadge,
    ];
  });
  await bulkInsert(
    "policy_definitions",
    ["code", "name", "description", "category", "constraint_type", "applicability_environments", "conditions", "scope", "version", "status", "draft_content", "tenant_id", "authored_by", "author_badge"],
    rows,
    { onConflict: "ON CONFLICT (code, version, tenant_id) DO NOTHING" }
  );
  logger.info(`[seed:test-policy-definitions] ${rows.length} test Policy Definitions seeded (Active, test-platform).`);
}
