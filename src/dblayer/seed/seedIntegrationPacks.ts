// 20 real, standalone Integration Packs (category Integration) — owner:
// "added new integration-* packs. Both of these sets have to be included to
// the seed data in cleanSlate." First real Integration-category Packs this
// platform has ever seeded — CR-079's own migration 132 comment predicted
// this day: "no integration-name rows yet — no real Integration-category
// Pack exists." Own file, same reasoning seedCompliancePacks.ts/
// seedDomainPacks.ts already got theirs. None of the 20 declares any
// `dependencies` (confirmed directly); every one of their declared
// Capabilities is already a real, registered capability-name concept
// (confirmed directly — all 22 distinct codes shared across the batch,
// e.g. code-review/security-engineering/monitoring-observability-sre,
// already seeded by the SDLC-phase Packs), so no Ontology gap on that side.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pool from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { publishPack, type PackSeedInput } from "../../routes/seu/core/packs.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");

function loadJson<T>(fileName: string): T {
  return JSON.parse(readFileSync(path.join(dataDir, fileName), "utf8")) as T;
}

const INTEGRATION_PACK_FILES = [
  "integration-aws.pack.json",
  "integration-azure-devops.pack.json",
  "integration-azure.pack.json",
  "integration-bitbucket.pack.json",
  "integration-confluence.pack.json",
  "integration-datadog.pack.json",
  "integration-gcp.pack.json",
  "integration-github.pack.json",
  "integration-gitlab.pack.json",
  "integration-jenkins.pack.json",
  "integration-jira.pack.json",
  "integration-kubernetes.pack.json",
  "integration-pagerduty.pack.json",
  "integration-prometheus-grafana.pack.json",
  "integration-sentry.pack.json",
  "integration-servicenow.pack.json",
  "integration-slack.pack.json",
  "integration-snyk.pack.json",
  "integration-sonarqube.pack.json",
  "integration-terraform.pack.json",
];

export async function seedIntegrationPacks(): Promise<void> {
  const results = await Promise.allSettled(
    INTEGRATION_PACK_FILES.map(async (file) => {
      const seed = loadJson<PackSeedInput>(file);
      const result = await publishPack({ seed, actorRole: "super", actorId: "1", activate: true });
      if (!result.ok) {
        throw new Error(`failed to publish "${seed.code}": ${(result.errors ?? []).join("; ")}`);
      }
      return result.alreadyPublished;
    })
  );

  const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected").map((r) => (r.reason as Error).message);
  if (failures.length > 0) {
    throw new Error(`[seed:integration-packs] ${failures.length} of ${INTEGRATION_PACK_FILES.length} Packs failed: ${failures.join(" | ")}`);
  }

  const alreadyCount = results.filter((r) => r.status === "fulfilled" && r.value).length;
  const publishedCount = results.length - alreadyCount;
  logger.info(`[seed:integration-packs] ${publishedCount} published, ${alreadyCount} already present — ${INTEGRATION_PACK_FILES.length} Integration Packs total.`);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  seedIntegrationPacks()
    .catch((err) => {
      logger.error("[seed:integration-packs] failed", err as Error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
