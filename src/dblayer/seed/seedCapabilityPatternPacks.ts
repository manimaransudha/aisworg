import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pool from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { publishPack, type PackSeedInput } from "../../routes/seu/core/packs.js";
import { userDB } from "../userDB.js";
import { getPlatformTenantId } from "../constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");

function loadJson<T>(fileName: string): T {
  return JSON.parse(readFileSync(path.join(dataDir, fileName), "utf8")) as T;
}
export interface SeedActor {
  authoredBy: string;
  authorBadge: string;
}

const CAPABILITY_PATTERN_PACK_FILES = [
  "openup-requirements.pack.json",
  "openup-architecture.pack.json",
  "openup-development.pack.json",
  "openup-test.pack.json",
  "openup-project-management.pack.json",
  "openup-configuration-and-change-management.pack.json",
];
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
const SDLC_PHASE_PACK_FILES = [
  "sdlc-phase-00-vision-opportunity.pack.json",
  "sdlc-phase-01-product-discovery.pack.json",
  "sdlc-phase-02-experience-design.pack.json",
  "sdlc-phase-03-technical-discovery-architecture.pack.json",
  "sdlc-phase-04-security-privacy-compliance.pack.json",
  "sdlc-phase-05-platform-developer-experience.pack.json",
  "sdlc-phase-06-backlog-release-planning.pack.json",
  "sdlc-phase-07-implementation.pack.json",
  "sdlc-phase-08-quality-engineering-hardening.pack.json",
  "sdlc-phase-09-scale-performance-optimization.pack.json",
  "sdlc-phase-10-beta-early-access.pack.json",
  "sdlc-phase-11-launch.pack.json",
  "sdlc-phase-12-hypercare-stabilization.pack.json",
  "sdlc-phase-13-growth-optimization.pack.json",
  "sdlc-phase-14-internationalization-localization.pack.json",
  "sdlc-phase-15-ongoing-operations-governance.pack.json",
];
const LEGACY_MODERN_PACK_FILES = [
"legacy-knowledge-recovery.pack.json"];
const DOMAIN_SPECIALISATION_PACK_FILES = [
  "ai-model-engineering.pack.json",
  "embedded-firmware-engineering.pack.json",
  "data-pipeline-engineering.pack.json",
];
const DOMAIN_TECHNOLOGY_PACK_FILES = [
  "domain-ebook-library.pack.json",
  "technology-nodejs.pack.json",
  "technologyc.pack.json",
  "technologycpp.pack.json",
  "technology-sass.pack.json",
  "technology-react.pack.json",
  "technology-react-native.pack.json",
  "technology-php.pack.json",
  "technology-js.pack.json",
  "technology-html.pack.json",
  "technology-git.pack.json",
  "technology-css.pack.json",
  "technology-rust.pack.json",
  "technology-rails.pack.json",
  "technology-oracle.pack.json",
  "technology-db2.pack.json",
  "technology-cobol.pack.json",
  "technology-python.pack.json",
  "technology-java.pack.json",
  "technology-go.pack.json",
  "technology-csharp.pack.json",
  "technology-swift.pack.json",
  "technology-kotlin.pack.json",
  "technology-docker.pack.json",
  "technology-kubernetes.pack.json",
  "technology-sql.pack.json",
];
const TEST_PACKS = [
  "cr104-demo-seu-eligibility-policies.pack.json",
  "cr104-demo-mandatory.pack.json"
];
const ALL_PACK_FILES = [
  ...CAPABILITY_PATTERN_PACK_FILES,
  ...COMPLIANCE_PACK_FILES,
  ...DOMAIN_PACK_FILES,
  ...INTEGRATION_PACK_FILES,
  ...SDLC_PHASE_PACK_FILES,
  ...LEGACY_MODERN_PACK_FILES,
  ...DOMAIN_SPECIALISATION_PACK_FILES,
  ...DOMAIN_TECHNOLOGY_PACK_FILES,
  ...(process.env.NODE_ENV !== "production" ? TEST_PACKS: [])
];
export async function seedCapabilityPatternPacks(actor: SeedActor): Promise<void> {

  const PLATFORM_TENANT_ID = await getPlatformTenantId();
  const settled = await Promise.allSettled(
    ALL_PACK_FILES.map(async (file) => {
      const seed = loadJson<PackSeedInput>(file);
      seed.tenantId = PLATFORM_TENANT_ID;
      const result = await publishPack({ seed, actorRole: actor.authorBadge, actorId: actor.authoredBy, activate: true });
      if (!result.ok) {
        throw new Error(`failed to publish "${seed.code}": ${(result.errors ?? []).join("; ")}`);
      }
      return result.alreadyPublished;
    })
  );

  const failures = settled.filter((s): s is PromiseRejectedResult => s.status === "rejected");
  if (failures.length > 0) {
    throw new Error(failures.map((f) => (f.reason instanceof Error ? f.reason.message : String(f.reason))).join("; "));
  }

  const results = (settled as PromiseFulfilledResult<boolean>[]).map((s) => s.value);
  const alreadyCount = results.filter(Boolean).length;
  const publishedCount = results.length - alreadyCount;
  logger.info(`[seed:capability-pattern-packs] ${publishedCount} published, ${alreadyCount} already present — ${ALL_PACK_FILES.length} Packs total.`);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const { actorId, actorBadge } = await userDB.getSuperuserId();
      if (!actorId) throw new Error(`No participants_master row for user_id ${actorId} -- log in as root first.`);
    
  seedCapabilityPatternPacks({ authoredBy: actorId, authorBadge: actorBadge })
    .catch((err) => {
      logger.error("[seed:capability-pattern-packs] failed", err as Error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
