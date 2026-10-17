import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pool from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { packsDB } from "../packsDB.js";
import { publishTemplate, PACK_SELECTION_SLOTS } from "../../routes/seu/core/templates.js";
import { publishProfile } from "../../routes/seu/core/profiles.js";
import type { TemplateDeliverableSeed, TemplateDependencyGraphEntry } from "../seuTypes.js";
import type { ExposedParameter } from "../../routes/seu/core/templates.js";
import { getPlatformTenantId, INITIAL_VERSION } from "../constants.js";
import { userDB } from "../userDB.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");

function loadJson<T>(fileName: string): T {
  return JSON.parse(readFileSync(path.join(dataDir, fileName), "utf8")) as T;
}
export interface SeedActor {
  authoredBy: string;
  authorBadge: string;
}
interface TemplateSeed {
  code: string;
  templateVersion?: string;
  name: string;
  mandatoryPackCodes: string[];
  deliverableCatalogue: TemplateDeliverableSeed[];
  dependencyGraph?: TemplateDependencyGraphEntry[];
  exposedParameters?: ExposedParameter[];
  purpose: string;
}

interface ProfileSeed {
  code: string;
  name: string;
  baseTemplateCode: string;
  environment: string;
  optionalPackCodes?: string[];
  technologyPackCodes?: string[];
  domainPackCodes?: string[];
  compliancePackCodes?: string[];
  integrationPackCodes?: string[];
  engineeringPackCodes?: string[];
  organisationPackCodes?: string[];
  description?: string;
  developmentMethodology?: string;
  primaryProgrammingLanguage?: string;
  sourceControlProvider?: string;
  targetCloudProvider?: string;
  deploymentStrategy?: string;
  aiProviderPreference?: string;
  defaultRepositoryStructure?: string;
  documentationLevel?: string;
  exposedParameterOverrides?: Array<{ sourceType: "service" | "policy" | "checklist" | "dependency"; sourceCode: string; parameterName: string; value: string }>;
}

const STANDARD_TEMPLATE_FILES: Array<{ template: string; profile: string }> = [
  { template: "saas-product.template.json", profile: "saas-product-development.profile.json" },
  { template: "enterprise-web-application-parent.template.json", profile: "enterprise-web-application-parent-development.profile.json" },
  { template: "api-platform.template.json", profile: "api-platform-development.profile.json" },
  { template: "data-platform.template.json", profile: "data-platform-development.profile.json" },
  { template: "ai-platform.template.json", profile: "ai-platform-development.profile.json" },
  { template: "embedded-software.template.json", profile: "embedded-software-development.profile.json" },
  { template: "legacy-modernisation.template.json", profile: "legacy-modernisation-development.profile.json" },
  { template: "mobile-application.template.json", profile: "mobile-application-development.profile.json" },
  { template: "package-implementation.template.json", profile: "package-implementation-development.profile.json" },
  { template: "devops-platform.template.json", profile: "devops-platform-development.profile.json" },
  { template: "maintenance-and-sustainment.template.json", profile: "maintenance-and-sustainment-development.profile.json" },
  { template: "secure-and-compliant-system.template.json", profile: "secure-and-compliant-system-development.profile.json" },
  { template: "safety-critical-system.template.json", profile: "safety-critical-system-development.profile.json" },
  { template: "game-development.template.json", profile: "game-development-development.profile.json" },
  { template: "mlops-ai-assurance.template.json", profile: "mlops-ai-assurance-development.profile.json" },
  { template: "prototype-and-spike.template.json", profile: "prototype-and-spike-development.profile.json" },
  { template: "test-engineering-engagement.template.json", profile: "test-engineering-engagement-development.profile.json" },
  { template: "continuous-assurance.template.json", profile: "continuous-assurance-development.profile.json" },
];

async function seedOne(templateFile: string, profileFile: string, actor: SeedActor): Promise<void> {
  const templateSeed = loadJson<TemplateSeed>(templateFile);
  const profileSeed = loadJson<ProfileSeed>(profileFile);
  const PLATFORM_TENANT_ID = await getPlatformTenantId();  
    
  type PackSelectionField = "compliancePackCodes" | "domainPackCodes" | "engineeringPackCodes" | "integrationPackCodes" | "organisationPackCodes" | "technologyPackCodes";
  const packSelections: Partial<Record<PackSelectionField, string[]>> = {};
  for (const code of templateSeed.mandatoryPackCodes) {
    const { data: pack } = await packsDB.findByCode(code);
    if (!pack) throw new Error(`template ${templateSeed.code} requires unknown pack ${code} — did seedSdlcPhasePacks/seedCapabilityPatternPacks run first?`);
    const slot = PACK_SELECTION_SLOTS.find((s) => s.packCategory === pack.category);
    if (!slot) throw new Error(`template ${templateSeed.code}'s mandatory pack "${code}" has category "${pack.category}", which has no matching Template pack-selection slot`);
    const field = slot.field as PackSelectionField;
    (packSelections[field] ??= []).push(code);
  }

  const templateResult = await publishTemplate({
    seed: {
      code: templateSeed.code,
      name: templateSeed.name,
      templateVersion: templateSeed.templateVersion ?? INITIAL_VERSION,
      deliverableCatalogue: templateSeed.deliverableCatalogue,
      dependencyGraph: templateSeed.dependencyGraph,
      exposedParameters: templateSeed.exposedParameters,
      purpose: templateSeed.purpose,
      tenantId: PLATFORM_TENANT_ID,
      ...packSelections,
    },
    actorId: actor.authoredBy
  });
  if (!templateResult.ok) throw new Error(`[seed:sdlc-standard-templates] failed to publish template "${templateSeed.code}": ${templateResult.errors.join("; ")}`);
  logger.info(`[seed:sdlc-standard-templates] template ${templateSeed.code} -> ${templateResult.templateId}`);

  const profileResult = await publishProfile({
    seed: {
      code: profileSeed.code,
      name: profileSeed.name,
      baseTemplateCode: profileSeed.baseTemplateCode,
      environment: profileSeed.environment,
      tenantId: PLATFORM_TENANT_ID,
      optionalPackCodes: profileSeed.optionalPackCodes ?? [],
      technologyPackCodes: profileSeed.technologyPackCodes ?? [],
      domainPackCodes: profileSeed.domainPackCodes ?? [],
      compliancePackCodes: profileSeed.compliancePackCodes ?? [],
      integrationPackCodes: profileSeed.integrationPackCodes ?? [],
      engineeringPackCodes: profileSeed.engineeringPackCodes ?? [],
      organisationPackCodes: profileSeed.organisationPackCodes ?? [],
      profileVersion: INITIAL_VERSION,
      description: profileSeed.description,
      developmentMethodology: profileSeed.developmentMethodology,
      primaryProgrammingLanguage: profileSeed.primaryProgrammingLanguage,
      sourceControlProvider: profileSeed.sourceControlProvider,
      targetCloudProvider: profileSeed.targetCloudProvider,
      deploymentStrategy: profileSeed.deploymentStrategy,
      aiProviderPreference: profileSeed.aiProviderPreference,
      defaultRepositoryStructure: profileSeed.defaultRepositoryStructure,
      documentationLevel: profileSeed.documentationLevel,
      exposedParameterOverrides: profileSeed.exposedParameterOverrides,
    },
    actorId: actor.authoredBy
  });
  if (!profileResult.ok) throw new Error(`[seed:sdlc-standard-templates] failed to publish profile "${profileSeed.code}": ${profileResult.errors.join("; ")}`);
  logger.info(`[seed:sdlc-standard-templates] profile ${profileSeed.code} -> ${profileResult.profileId}`);
}

export async function seedSdlcStandardTemplates(actor: SeedActor): Promise<void> {
  for (const { template, profile } of STANDARD_TEMPLATE_FILES) {
    await seedOne(template, profile, actor);
  }
  logger.info(`[seed:sdlc-standard-templates] done — ${STANDARD_TEMPLATE_FILES.length} standard Templates seeded.`);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const { actorId, actorBadge } = await userDB.getSuperuserId();
  if (!actorId) throw new Error(`No participants_master row for user_id ${actorId} -- log in as root first.`);
      
  seedSdlcStandardTemplates({ authoredBy: actorId, authorBadge: actorBadge })
    .catch((err) => {
      logger.error("[seed:sdlc-standard-templates] failed", err as Error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
