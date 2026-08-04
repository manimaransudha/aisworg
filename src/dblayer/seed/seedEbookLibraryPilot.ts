// Standalone dry-run addition — NOT part of the regular `pnpm seed:seu`
// pipeline, does not modify seedSeu.ts. Seeds the Template + Profile for the
// e-book library pilot scenario, using the same templatesDB/profilesDB calls
// seedSeu.ts's own seedTemplate/seedProfile use. Run once with:
//   npx tsx src/dblayer/seed/seedEbookLibraryPilot.ts
// Assumes domain-ebook-library and technology-nodejs Packs are already
// published (domain-ebook-library via `pnpm pack:publish ... --activate`,
// technology-nodejs already part of the base seed).
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

async function run(): Promise<void> {
  try {
    const templateSeed = loadJson<TemplateSeed>("ebook-library.template.json");
    const profileSeed = loadJson<ProfileSeed>("ebook-library-development.profile.json");

    const { data: template, error: templateErr } = await templatesDB.upsert({
      code: templateSeed.code,
      name: templateSeed.name,
      deliverableCatalogue: templateSeed.deliverableCatalogue,
    });
    if (templateErr || !template) throw templateErr ?? new Error(`template upsert failed: ${templateSeed.code}`);

    const { data: capabilities } = await capabilitiesDB.findByCodes(templateSeed.requiredCapabilityCodes);
    const capabilityIdByCode = new Map((capabilities ?? []).map((c) => [c.code, c.id]));
    const requiredCapabilityIds = templateSeed.requiredCapabilityCodes.map((code) => {
      const id = capabilityIdByCode.get(code);
      if (!id) throw new Error(`template ${templateSeed.code} requires unknown capability ${code} — is its contributing Pack published?`);
      return id;
    });
    await templatesDB.setRequiredCapabilities(template.id, requiredCapabilityIds);

    // Real finding during this pilot (2026-08-04): platform-core-engineering
    // is currently status='Archived' in this shared dev DB (see Ebook
    // Library Dry Run.md), so findActiveByCode('platform-core-engineering')
    // returns null even though the platform composes it fine everywhere
    // else — compositionEngine never filters by status. Resolving by known
    // code+version instead of requiring Active, matching what composition
    // actually needs (a valid Pack row id).
    const mandatoryPackIds: string[] = [];
    for (const code of templateSeed.mandatoryPackCodes) {
      const { data: active } = await packsDB.findActiveByCode(code);
      const pack = active ?? (await packsDB.findByCodeAndVersion(code, "1.0.0")).data;
      if (!pack) throw new Error(`template ${templateSeed.code} requires unknown pack ${code}`);
      mandatoryPackIds.push(pack.id);
    }
    await templatesDB.setMandatoryPacks(template.id, mandatoryPackIds);

    logger.info(`[seed:ebook-library-pilot] template ${template.code} -> ${template.id}`);

    const { data: profile, error: profileErr } = await profilesDB.upsert({
      code: profileSeed.code,
      name: profileSeed.name,
      baseTemplateId: template.id,
      environment: profileSeed.environment,
      configParameters: profileSeed.configParameters,
    });
    if (profileErr || !profile) throw profileErr ?? new Error(`profile upsert failed: ${profileSeed.code}`);

    const optionalPackIds: string[] = [];
    for (const code of profileSeed.optionalPackCodes ?? []) {
      const { data: active } = await packsDB.findActiveByCode(code);
      const pack = active ?? (await packsDB.findByCodeAndVersion(code, "1.0.0")).data;
      if (!pack) throw new Error(`profile ${profileSeed.code} requires unknown pack ${code}`);
      optionalPackIds.push(pack.id);
    }
    await profilesDB.setOptionalPacks(profile.id, optionalPackIds);

    logger.info(`[seed:ebook-library-pilot] profile ${profile.code} -> ${profile.id} (${optionalPackIds.length} optional Pack(s))`);
    logger.info("[seed:ebook-library-pilot] done.");
  } catch (err) {
    logger.error("[seed:ebook-library-pilot] failed", err as Error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
