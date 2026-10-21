
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pool, { query } from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { publishPack, type PackSeedInput } from "../../routes/seu/core/packs.js";
import { userDB } from "../userDB.js";
import { packsDB } from "../packsDB.js";
import { getPlatformTenantId } from "../constants.js";
import { seedTestOntology } from "./seedTestOntology.js";
import { loadServiceDefinitionIdByCode, stampServiceDefinitionIds } from "./serviceDefinitionIds.js";
import { seedCr104Demo } from "./seedCr104Demo.js";

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

async function publishBatch(files: string[], actorId: string, serviceDefinitionIdByCode: Map<string, string>): Promise<PromiseSettledResult<void>[]> {
  return Promise.allSettled(
    files.map(async (file) => {
      const seed = stampServiceDefinitionIds(loadJson<PackSeedInput>(file), serviceDefinitionIdByCode);
      if ((await packsDB.findActiveByCode(seed.code, seed.tenantId ?? (await getPlatformTenantId()))).data) return;
      const result = await publishPack({ seed, actorId, activate: true });
      if (!result.ok) {
        throw new Error(`failed to publish "${seed.code}": ${(result.errors ?? []).join("; ")}`);
      }
    })
  );
}

// A failed earlier run leaves a fixture Pack part-way through its lifecycle, with the content it was created with. Those rows
// are removed with everything that names them, so the Pack is published again from the current JSON. Active Packs and the
// Packs other tests create are left alone.
async function purgeUnfinishedFixturePacks(): Promise<void> {
  const codes = TEST_FIXTURE_PACK_FILES.map((file) => loadJson<PackSeedInput>(file).code);
  const { rows: packs } = await query<{ id: string }>("SELECT id FROM packs WHERE code = ANY($1::text[]) AND status IN ('Draft', 'Validated', 'Published')", [codes]);
  if (packs.length === 0) return;
  const ids = packs.map((p) => p.id);
  const { rows: owned } = await query<{ table_name: string; column_name: string }>(
    "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name IN ('originating_pack_id', 'pack_id') AND table_name <> 'packs'"
  );
  for (const { table_name, column_name } of owned) await query(`DELETE FROM "${table_name}" WHERE "${column_name}" = ANY($1::uuid[])`, [ids]);
  await query("DELETE FROM packs WHERE id = ANY($1::uuid[])", [ids]);
  logger.info(`[seed:test-fixture-packs] removed ${ids.length} unfinished fixture Pack(s) from an earlier run.`);
}

export async function seedAllTestFixturePacks(): Promise<void> {
  const { actorId, actorBadge } = await userDB.getSuperuserId();
  await seedTestOntology({ authoredBy: actorId, authorBadge: actorBadge });
  await purgeUnfinishedFixturePacks();
  const serviceDefinitionIdByCode = await loadServiceDefinitionIdByCode(await getPlatformTenantId());
  const independentResults = await publishBatch(INDEPENDENT_TEST_FIXTURE_PACK_FILES, actorId, serviceDefinitionIdByCode);
  const independentFailures = independentResults.filter((r): r is PromiseRejectedResult => r.status === "rejected").map((r) => (r.reason as Error).message);
  if (independentFailures.length > 0) {
    throw new Error(`[seed:test-fixture-packs] ${independentFailures.length} of ${TEST_FIXTURE_PACK_FILES.length} Packs failed: ${independentFailures.join(" | ")}`);
  }

  const dependentResults = await publishBatch(DEPENDENT_TEST_FIXTURE_PACK_FILES, actorId, serviceDefinitionIdByCode);
  const dependentFailures = dependentResults.filter((r): r is PromiseRejectedResult => r.status === "rejected").map((r) => (r.reason as Error).message);
  if (dependentFailures.length > 0) {
    throw new Error(`[seed:test-fixture-packs] ${dependentFailures.length} of ${TEST_FIXTURE_PACK_FILES.length} Packs failed: ${dependentFailures.join(" | ")}`);
  }

  await seedCr104Demo({ authoredBy: actorId, authorBadge: actorBadge });

  logger.info(`[seed:test-fixture-packs] ${independentResults.length + dependentResults.length} published — ${TEST_FIXTURE_PACK_FILES.length} test-fixture Packs total.`);
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
