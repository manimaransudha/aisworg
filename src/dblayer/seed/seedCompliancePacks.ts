// 33 real, standalone Compliance Packs (category Compliance) — owner: "I
// added compliance packs. Wipe and seed them in clean-slate." None of the
// 33 declares any `dependencies` (confirmed directly), so — unlike
// seedDomainTechnologyPacks.ts's own 12, all of which depend on
// `development` — these can all publish concurrently with no ordering
// requirement on any other seed step. Capability codes are each unique to
// their own Pack (confirmed directly, no cross-Pack collision the way
// technology-nodejs/technologyc/technologycpp's bare "code-review" once
// had — see seedDomainTechnologyPacks.ts's own header for that history).
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

const COMPLIANCE_PACK_FILES = [
  "compliance-accessibility-ada-508.pack.json",
  "compliance-aml-kyc.pack.json",
  "compliance-automotive-wp29.pack.json",
  "compliance-bipa.pack.json",
  "compliance-coppa.pack.json",
  "compliance-data-residency-localization.pack.json",
  "compliance-do178c-aviation.pack.json",
  "compliance-e-commerce-consumer-protection.pack.json",
  "compliance-eu-ai-act.pack.json",
  "compliance-eu-dora-nis2.pack.json",
  "compliance-eu-dsa-dma.pack.json",
  "compliance-eu-financial-reporting.pack.json",
  "compliance-eu-mdr.pack.json",
  "compliance-fcpa.pack.json",
  "compliance-fda-21cfr11.pack.json",
  "compliance-fedramp.pack.json",
  "compliance-fisma.pack.json",
  "compliance-gdpr.pack.json",
  "compliance-glba.pack.json",
  "compliance-hipaa.pack.json",
  "compliance-india-dpdp.pack.json",
  "compliance-india-rbi-pmla.pack.json",
  "compliance-iso-27001.pack.json",
  "compliance-itar-ear.pack.json",
  "compliance-nist-800-53.pack.json",
  "compliance-nydfs.pack.json",
  "compliance-pci-dss.pack.json",
  "compliance-psd2-psd3.pack.json",
  "compliance-sebi-companies.pack.json",
  "compliance-soc2.pack.json",
  "compliance-sox.pack.json",
  "compliance-uk-gdpr-dpa.pack.json",
  "compliance-us-state-privacy.pack.json",
];

export async function seedCompliancePacks(): Promise<void> {
  const results = await Promise.allSettled(
    COMPLIANCE_PACK_FILES.map(async (file) => {
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
    throw new Error(`[seed:compliance-packs] ${failures.length} of ${COMPLIANCE_PACK_FILES.length} Packs failed: ${failures.join(" | ")}`);
  }

  const alreadyCount = results.filter((r) => r.status === "fulfilled" && r.value).length;
  const publishedCount = results.length - alreadyCount;
  logger.info(`[seed:compliance-packs] ${publishedCount} published, ${alreadyCount} already present — ${COMPLIANCE_PACK_FILES.length} Compliance Packs total.`);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  seedCompliancePacks()
    .catch((err) => {
      logger.error("[seed:compliance-packs] failed", err as Error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
