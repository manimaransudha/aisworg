// 24 real, standalone Domain Packs (category Domain) — owner: "I added
// domain packs. These have to be seeded using cleanSlate." Kept separate
// from seedDomainTechnologyPacks.ts (which already carries
// domain-ebook-library.pack.json, untouched here) — same reasoning
// seedCompliancePacks.ts got its own file: a distinct, growing category of
// Packs deserves its own loader rather than an ever-growing mixed list.
// None of the 24 declares any `dependencies`, `capabilities`, or `services`
// (confirmed directly), so they publish concurrently with no ordering
// requirement on any other seed step.
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

const DOMAIN_PACK_FILES = [
  "domain-accounting-finance.pack.json",
  "domain-banking-payments-markets.pack.json",
  "domain-customer-service.pack.json",
  "domain-energy-utilities-mining.pack.json",
  "domain-enterprise-workflows.pack.json",
  "domain-facilities-itsm.pack.json",
  "domain-government-public-services.pack.json",
  "domain-healthcare-pharma.pack.json",
  "domain-hospitality-travel-aviation.pack.json",
  "domain-hr-payroll.pack.json",
  "domain-insurance-claims.pack.json",
  "domain-legal-compliance-risk.pack.json",
  "domain-manufacturing-quality.pack.json",
  "domain-marketing-advertising.pack.json",
  "domain-order-management.pack.json",
  "domain-procurement-sourcing.pack.json",
  "domain-product-management.pack.json",
  "domain-project-portfolio.pack.json",
  "domain-real-estate-construction.pack.json",
  "domain-research-lifesciences.pack.json",
  "domain-retail-ecommerce.pack.json",
  "domain-sales-crm.pack.json",
  "domain-supply-chain-wms.pack.json",
  "domain-telecom-media-publishing.pack.json",
];

export async function seedDomainPacks(): Promise<void> {
  const results = await Promise.allSettled(
    DOMAIN_PACK_FILES.map(async (file) => {
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
    throw new Error(`[seed:domain-packs] ${failures.length} of ${DOMAIN_PACK_FILES.length} Packs failed: ${failures.join(" | ")}`);
  }

  const alreadyCount = results.filter((r) => r.status === "fulfilled" && r.value).length;
  const publishedCount = results.length - alreadyCount;
  logger.info(`[seed:domain-packs] ${publishedCount} published, ${alreadyCount} already present — ${DOMAIN_PACK_FILES.length} Domain Packs total.`);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  seedDomainPacks()
    .catch((err) => {
      logger.error("[seed:domain-packs] failed", err as Error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
