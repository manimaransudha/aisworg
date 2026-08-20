// SDLC Templates — Standard Platform Templates (owner, 2026-08-19): "There
// are template categories in Ontology. For each of these create a parent
// template with the appropriate packs." One Template per real
// `template-categories` Ontology concept (migration 053), each drawing its
// `mandatoryPackCodes` from the 16 SDLC-phase Packs (seedSdlcPhasePacks.ts)
// appropriate to that category, plus `platform-core-engineering`. Publishing
// through the real Pack/Template flow's own upsert — Platform-owned, so any
// tenant (including "demo") can commission an SEU from these once seeded;
// nothing here creates an SEU itself (owner: "just make it commissionable").
//
// Depends on seedSdlcPhasePacks.ts having already published the 16 phase
// Packs, and platform-core-engineering already existing (owner, 2026-08-20:
// seedSeu.ts itself is retired — "That is polluting the db" — so this is no
// longer a scripted prerequisite; platform-core-engineering/technology-nodejs
// are expected to already exist on a working database) — run standalone only
// after:
//   npx tsx src/dblayer/seed/seedSdlcPhasePacks.ts
//   npx tsx src/dblayer/seed/seedSdlcStandardTemplates.ts
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pool from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { templatesDB } from "../templatesDB.js";
import { profilesDB } from "../profilesDB.js";
import { capabilitiesDB } from "../capabilitiesDB.js";
import { packsDB } from "../packsDB.js";
import type { TemplateDeliverableSeed } from "../seuTypes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");

function loadJson<T>(fileName: string): T {
  return JSON.parse(readFileSync(path.join(dataDir, fileName), "utf8")) as T;
}

interface TemplateSeed {
  code: string;
  templateVersion?: string;
  name: string;
  requiredCapabilityCodes: string[];
  mandatoryPackCodes: string[];
  deliverableCatalogue: TemplateDeliverableSeed[];
}

interface ProfileSeed {
  code: string;
  name: string;
  baseTemplateCode: string;
  environment: string;
  configParameters: Record<string, unknown>;
  optionalPackCodes?: string[];
}

// One (Template, Profile) file pair per real template-categories concept.
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
];

async function seedOne(templateFile: string, profileFile: string): Promise<void> {
  const templateSeed = loadJson<TemplateSeed>(templateFile);
  const profileSeed = loadJson<ProfileSeed>(profileFile);

  const { data: template, error } = await templatesDB.upsert({
    code: templateSeed.code,
    templateVersion: templateSeed.templateVersion,
    name: templateSeed.name,
    deliverableCatalogue: templateSeed.deliverableCatalogue,
  });
  if (error || !template) throw error ?? new Error(`template upsert failed: ${templateSeed.code}`);

  const { data: capabilities } = await capabilitiesDB.findByCodes(templateSeed.requiredCapabilityCodes);
  const capabilityIdByCode = new Map((capabilities ?? []).map((c) => [c.code, c.id]));
  const requiredCapabilityIds = templateSeed.requiredCapabilityCodes.map((code) => {
    const id = capabilityIdByCode.get(code);
    if (!id) throw new Error(`template ${templateSeed.code} requires unknown capability ${code} — did seedSdlcPhasePacks run first, and does platform-core-engineering already exist?`);
    return id;
  });
  await templatesDB.setRequiredCapabilities(template.id, requiredCapabilityIds);

  for (const code of templateSeed.mandatoryPackCodes) {
    const { data: pack } = await packsDB.findByCode(code);
    if (!pack) throw new Error(`template ${templateSeed.code} requires unknown pack ${code} — did seedSdlcPhasePacks run first, and does platform-core-engineering already exist?`);
  }
  await templatesDB.setMandatoryPacks(template.id, templateSeed.mandatoryPackCodes);

  logger.info(`[seed:sdlc-standard-templates] template ${template.code}@${template.template_version} -> ${template.id}`);

  const { data: profile, error: profileErr } = await profilesDB.upsert({
    code: profileSeed.code,
    name: profileSeed.name,
    baseTemplateId: template.id,
    environment: profileSeed.environment,
    configParameters: profileSeed.configParameters,
  });
  if (profileErr || !profile) throw profileErr ?? new Error(`profile upsert failed: ${profileSeed.code}`);

  const optionalPackCodes = profileSeed.optionalPackCodes ?? [];
  for (const code of optionalPackCodes) {
    const { data: pack } = await packsDB.findByCode(code);
    if (!pack) throw new Error(`profile ${profileSeed.code} requires unknown optional pack ${code}`);
  }
  await profilesDB.setOptionalPacks(profile.id, optionalPackCodes);

  logger.info(`[seed:sdlc-standard-templates] profile ${profile.code} -> ${profile.id} (${optionalPackCodes.length} optional Pack(s))`);
}

export async function seedSdlcStandardTemplates(): Promise<void> {
  for (const { template, profile } of STANDARD_TEMPLATE_FILES) {
    await seedOne(template, profile);
  }
  logger.info(`[seed:sdlc-standard-templates] done — ${STANDARD_TEMPLATE_FILES.length} standard Templates seeded.`);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  seedSdlcStandardTemplates()
    .catch((err) => {
      logger.error("[seed:sdlc-standard-templates] failed", err as Error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
