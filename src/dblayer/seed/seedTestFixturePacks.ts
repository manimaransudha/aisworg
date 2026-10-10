
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pool from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { publishPack, type PackSeedInput } from "../../routes/seu/core/packs.js";
import { userDB } from "../userDB.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data", "test-fixtures");

function loadJson<T>(fileName: string): T {
  return JSON.parse(readFileSync(path.join(dataDir, fileName), "utf8")) as T;
}

const INDEPENDENT_TEST_FIXTURE_PACK_FILES = [
  "test-openup-configuration-and-change-management.pack.json",
  "test-openup-project-management.pack.json",
  "test-openup-test.pack.json",
  "test-sdlc-phase-00-vision-opportunity.pack.json",
  "test-sdlc-phase-01-product-discovery.pack.json",
  "test-sdlc-phase-02-experience-design.pack.json",
  "test-sdlc-phase-03-technical-discovery-architecture.pack.json",
  "test-sdlc-phase-04-security-privacy-compliance.pack.json",
  "test-sdlc-phase-05-platform-developer-experience.pack.json",
  "test-sdlc-phase-06-backlog-release-planning.pack.json",
  "test-sdlc-phase-07-implementation.pack.json",
  "test-sdlc-phase-08-quality-engineering-hardening.pack.json",
  "test-sdlc-phase-09-scale-performance-optimization.pack.json",
  "test-sdlc-phase-10-beta-early-access.pack.json",
  "test-sdlc-phase-11-launch.pack.json",
  "test-sdlc-phase-12-hypercare-stabilization.pack.json",
  "test-sdlc-phase-13-growth-optimization.pack.json",
  "test-sdlc-phase-14-internationalization-localization.pack.json",
  "test-sdlc-phase-15-ongoing-operations-governance.pack.json",
  "test-compliance-accessibility-ada-508.pack.json",
  "test-compliance-aml-kyc.pack.json",
  "test-compliance-automotive-wp29.pack.json",
  "test-compliance-bipa.pack.json",
  "test-compliance-coppa.pack.json",
  "test-compliance-data-residency-localization.pack.json",
  "test-compliance-do178c-aviation.pack.json",
  "test-compliance-e-commerce-consumer-protection.pack.json",
  "test-compliance-eu-ai-act.pack.json",
  "test-compliance-eu-dora-nis2.pack.json",
  "test-compliance-eu-dsa-dma.pack.json",
  "test-compliance-eu-financial-reporting.pack.json",
  "test-compliance-eu-mdr.pack.json",
  "test-compliance-fcpa.pack.json",
  "test-compliance-fda-21cfr11.pack.json",
  "test-compliance-fedramp.pack.json",
  "test-compliance-fisma.pack.json",
  "test-compliance-gdpr.pack.json",
  "test-compliance-glba.pack.json",
  "test-compliance-hipaa.pack.json",
  "test-compliance-india-dpdp.pack.json",
  "test-compliance-india-rbi-pmla.pack.json",
  "test-compliance-iso-27001.pack.json",
  "test-compliance-itar-ear.pack.json",
  "test-compliance-nist-800-53.pack.json",
  "test-compliance-nydfs.pack.json",
  "test-compliance-pci-dss.pack.json",
  "test-compliance-psd2-psd3.pack.json",
  "test-compliance-sebi-companies.pack.json",
  "test-compliance-soc2.pack.json",
  "test-compliance-sox.pack.json",
  "test-compliance-uk-gdpr-dpa.pack.json",
  "test-compliance-us-state-privacy.pack.json",
  "test-technology-cobol.pack.json",
  "test-technology-csharp.pack.json",
  "test-technology-css.pack.json",
  "test-technology-db2.pack.json",
  "test-technology-docker.pack.json",
  "test-technology-git.pack.json",
  "test-technology-go.pack.json",
  "test-technology-html.pack.json",
  "test-technology-java.pack.json",
  "test-technology-js.pack.json",
  "test-technology-kotlin.pack.json",
  "test-technology-kubernetes.pack.json",
  "test-technology-oracle.pack.json",
  "test-technology-php.pack.json",
  "test-technology-python.pack.json",
  "test-technology-rails.pack.json",
  "test-technology-react-native.pack.json",
  "test-technology-react.pack.json",
  "test-technology-rust.pack.json",
  "test-technology-sass.pack.json",
  "test-technology-sql.pack.json",
  "test-technology-swift.pack.json",
  "test-technologyc.pack.json",
  "test-technologycpp.pack.json",
];
const DEPENDENT_TEST_FIXTURE_PACK_FILES = ["test-domain-ebook-library.pack.json", "test-technology-nodejs.pack.json"];
const TEST_FIXTURE_PACK_FILES = [...INDEPENDENT_TEST_FIXTURE_PACK_FILES, ...DEPENDENT_TEST_FIXTURE_PACK_FILES];

async function publishBatch(files: string[], actorId: string): Promise<PromiseSettledResult<boolean | undefined>[]> {
  return Promise.allSettled(
    files.map(async (file) => {
      const seed = loadJson<PackSeedInput>(file);
      const result = await publishPack({ seed, actorRole: "super", actorId, activate: true });
      if (!result.ok) {
        throw new Error(`failed to publish "${seed.code}": ${(result.errors ?? []).join("; ")}`);
      }
      return result.alreadyPublished;
    })
  );
}

export async function seedAllTestFixturePacks(): Promise<void> {
  const { actorId } = await userDB.getSuperuserId();
  const independentResults = await publishBatch(INDEPENDENT_TEST_FIXTURE_PACK_FILES, actorId);
  const independentFailures = independentResults.filter((r): r is PromiseRejectedResult => r.status === "rejected").map((r) => (r.reason as Error).message);
  if (independentFailures.length > 0) {
    throw new Error(`[seed:test-fixture-packs] ${independentFailures.length} of ${TEST_FIXTURE_PACK_FILES.length} Packs failed: ${independentFailures.join(" | ")}`);
  }

  const dependentResults = await publishBatch(DEPENDENT_TEST_FIXTURE_PACK_FILES, actorId);
  const dependentFailures = dependentResults.filter((r): r is PromiseRejectedResult => r.status === "rejected").map((r) => (r.reason as Error).message);
  if (dependentFailures.length > 0) {
    throw new Error(`[seed:test-fixture-packs] ${dependentFailures.length} of ${TEST_FIXTURE_PACK_FILES.length} Packs failed: ${dependentFailures.join(" | ")}`);
  }

  const allResults = [...independentResults, ...dependentResults];
  const alreadyCount = allResults.filter((r) => r.status === "fulfilled" && r.value).length;
  const publishedCount = allResults.length - alreadyCount;
  logger.info(`[seed:test-fixture-packs] ${publishedCount} published, ${alreadyCount} already present — ${TEST_FIXTURE_PACK_FILES.length} test-fixture Packs total.`);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  seedAllTestFixturePacks()
    .catch((err) => {
      logger.error("[seed:test-fixture-packs] failed", err as Error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
