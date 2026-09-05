// SDLC Templates — Standard Platform Templates (owner, 2026-08-19): "There
// are template categories in Ontology. For each of these create a parent
// template with the appropriate packs." One Template per real
// `template-categories` Ontology concept (migration 053), each drawing its
// `mandatoryPackCodes` from the 16 SDLC-phase Packs (seedSdlcPhasePacks.ts)
// appropriate to that category, plus `development` (the real OpenUP
// capability-pattern Pack, seedCapabilityPatternPacks.ts). Publishing
// through the real, validated publishTemplate/publishProfile entry points
// (templates.ts/profiles.ts — the same ones the interactive SDK authoring
// flow uses, previously dead code with no real caller) rather than a raw
// upsert — Platform-owned, so any tenant (including "demo") can commission an
// SEU from these once seeded; nothing here creates an SEU itself (owner:
// "just make it commissionable").
//
// Depends on seedSdlcPhasePacks.ts/seedCapabilityPatternPacks.ts having
// already published their real Packs — run standalone only after:
//   npx tsx src/dblayer/seed/seedCapabilityPatternPacks.ts
//   npx tsx src/dblayer/seed/seedSdlcPhasePacks.ts
//   npx tsx src/dblayer/seed/seedSdlcStandardTemplates.ts
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");

function loadJson<T>(fileName: string): T {
  return JSON.parse(readFileSync(path.join(dataDir, fileName), "utf8")) as T;
}

interface TemplateSeed {
  code: string;
  templateVersion?: string;
  name: string;
  mandatoryPackCodes: string[];
  deliverableCatalogue: TemplateDeliverableSeed[];
  dependencyGraph?: TemplateDependencyGraphEntry[];
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
  // CR-087 — re-enabled (owner, 2026-09-04): the diagnostic disable (see
  // Step 2a) confirmed what broke; "enterprise-web-application" being also
  // ebook-library.template.json's own code (CR-087 finding 4) stays a latent,
  // not live, collision — ebook-library.template.json is still only loaded by
  // the standalone, unwired seedEbookLibraryPilot.ts, never this array.
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

  // publishTemplate's own TemplateSeedInput (CR-038) buckets mandatory Packs
  // into six category-scoped fields, not one flat list — bucket the JSON
  // file's own unchanged mandatoryPackCodes by each Pack's real category. A
  // pure derivation at seed time, not a change to the authored file shape.
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

  // publishTemplate (templates.ts) — the same validated, event-firing entry
  // point the interactive SDK authoring flow uses (validateTemplateSeed,
  // materialisePackSelectionsAndCapabilities, materialiseDependencyGraph) —
  // replaces the old raw templatesDB.upsert + manual setMandatoryPacks/
  // setRequiredCapabilities/materialiseDependencyGraph calls. None of the 9
  // *.template.json files set templateVersion today — first version for all.
  const templateResult = await publishTemplate({
    code: templateSeed.code,
    name: templateSeed.name,
    templateVersion: templateSeed.templateVersion ?? "1.0.0",
    deliverableCatalogue: templateSeed.deliverableCatalogue,
    dependencyGraph: templateSeed.dependencyGraph,
    ...packSelections,
  });
  if (!templateResult.ok) throw new Error(`[seed:sdlc-standard-templates] failed to publish template "${templateSeed.code}": ${templateResult.errors.join("; ")}`);
  logger.info(`[seed:sdlc-standard-templates] template ${templateSeed.code} -> ${templateResult.templateId}`);

  // publishProfile (profiles.ts) — same treatment. category is Ontology-backed
  // (profile-categories, migration 065); none of the 9 *.profile.json files
  // set it today — "startup" ("Minimal governance, rapid delivery, default
  // Platform Packs") fits a generic default-development Profile best.
  const profileResult = await publishProfile({
    code: profileSeed.code,
    name: profileSeed.name,
    baseTemplateCode: profileSeed.baseTemplateCode,
    environment: profileSeed.environment,
    configParameters: profileSeed.configParameters,
    optionalPackCodes: profileSeed.optionalPackCodes ?? [],
    profileVersion: "1.0.0",
    category: "startup",
  });
  if (!profileResult.ok) throw new Error(`[seed:sdlc-standard-templates] failed to publish profile "${profileSeed.code}": ${profileResult.errors.join("; ")}`);
  logger.info(`[seed:sdlc-standard-templates] profile ${profileSeed.code} -> ${profileResult.profileId}`);
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
