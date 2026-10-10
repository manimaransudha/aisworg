import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pool from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { templatesDB } from "../templatesDB.js";
import { profilesDB } from "../profilesDB.js";
import { participantsMasterDB } from "../participantsMasterDB.js";
import { capabilitiesDB } from "../capabilitiesDB.js";
import { packsDB } from "../packsDB.js";
import { materialiseDependencyGraph } from "../../domain/engine/materialiseDependencyGraph.js";
import type { TemplateDeliverableSeed, TemplateDependencyGraphEntry } from "../seuTypes.js";
import { userDB } from "../userDB.js";

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
  dependencyGraph?: TemplateDependencyGraphEntry[];
}

interface ProfileSeed {
  code: string;
  name: string;
  baseTemplateCode: string;
  environment: string;
  optionalPackCodes?: string[];
}
export interface SeedActor {
  authoredBy: string;
  authorBadge: string;
}
async function run(actor: SeedActor): Promise<void> {

  try {
    const templateSeed = loadJson<TemplateSeed>("ebook-library.template.json");
    const profileSeed = loadJson<ProfileSeed>("ebook-library-development.profile.json");

    const { data: template, error: templateErr } = await templatesDB.upsert({
      code: templateSeed.code,
      templateVersion: templateSeed.templateVersion,
      name: templateSeed.name,
      deliverableCatalogue: templateSeed.deliverableCatalogue,
    });
    if (templateErr || !template) throw templateErr ?? new Error(`template upsert failed: ${templateSeed.code}`);
    
    await materialiseDependencyGraph({
      owningEntityType: "Template",
      owningEntityId: template.id,
      deliverableCatalogue: templateSeed.deliverableCatalogue,
      dependencyGraph: templateSeed.dependencyGraph ?? [],
      tenantId: template.tenant_id,
      authorId: actor.authoredBy,
      authorBadge: actor.authorBadge,
    });

    const { data: capabilities } = await capabilitiesDB.findByCodes(templateSeed.requiredCapabilityCodes);
    const capabilityIdByCode = new Map((capabilities ?? []).map((c) => [c.code, c.id]));
    const requiredCapabilityIds = templateSeed.requiredCapabilityCodes.map((code) => {
      const id = capabilityIdByCode.get(code);
      if (!id) throw new Error(`template ${templateSeed.code} requires unknown capability ${code} — is its contributing Pack published?`);
      return id;
    });
    await templatesDB.setRequiredCapabilities(template.id, requiredCapabilityIds, actor.authoredBy, actor.authorBadge);

    for (const code of templateSeed.mandatoryPackCodes) {
      const { data: pack } = await packsDB.findByCode(code);
      if (!pack) throw new Error(`template ${templateSeed.code} requires unknown pack ${code}`);
    }
    await templatesDB.setMandatoryPacks(template.id, templateSeed.mandatoryPackCodes, actor.authoredBy, actor.authorBadge,);

    logger.info(`[seed:ebook-library-pilot] template ${template.code} -> ${template.id}`);

    const { data: profile, error: profileErr } = await profilesDB.upsert({
      code: profileSeed.code,
      name: profileSeed.name,
      baseTemplateId: template.id,
      authoredBy: actor.authoredBy,
      authorBadge:actor.authorBadge,
      environment: profileSeed.environment,
    });
    if (profileErr || !profile) throw profileErr ?? new Error(`profile upsert failed: ${profileSeed.code}`);

    const optionalPackCodes = profileSeed.optionalPackCodes ?? [];
    for (const code of optionalPackCodes) {
      const { data: pack } = await packsDB.findByCode(code);
      if (!pack) throw new Error(`profile ${profileSeed.code} requires unknown pack ${code}`);
    }
    await profilesDB.setOptionalPacks(profile.id, optionalPackCodes, actor.authoredBy, actor.authorBadge);

    logger.info(`[seed:ebook-library-pilot] profile ${profile.code} -> ${profile.id} (${optionalPackCodes.length} optional Pack(s))`);
    logger.info("[seed:ebook-library-pilot] done.");
  } catch (err) {
    logger.error("[seed:ebook-library-pilot] failed", err as Error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
const { actorId, actorBadge } = await userDB.getSuperuserId();
if (!actorId) throw new Error(`Provision a superuser before this operation.`);
  
run({ authoredBy: actorId, authorBadge: actorBadge });
