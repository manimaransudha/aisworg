import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pool from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { publishPack, type PackSeedInput } from "../../routes/seu/core/packs.js";
import { publishTemplate } from "../../routes/seu/core/templates.js";
import { publishProfile, type ProfileSeedInput } from "../../routes/seu/core/profiles.js";
import type { TemplateDeliverableSeed, TemplateDependencyGraphEntry } from "../seuTypes.js";
import { userDB } from "../userDB.js";
import { INITIAL_VERSION, getPlatformTenantId } from "../constants.js";
import { packsDB } from "../packsDB.js";
import { templatesDB } from "../templatesDB.js";
import { profilesDB } from "../profilesDB.js";
export interface SeedActor {
  authoredBy: string;
  authorBadge: string;
}
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");

function loadJson<T>(fileName: string): T {
  return JSON.parse(readFileSync(path.join(dataDir, fileName), "utf8")) as T;
}

interface MinimalTemplateSeed {
  code: string;
  name: string;
  templateVersion?: string;
  mandatoryPackCodes: string[];
  deliverableCatalogue: TemplateDeliverableSeed[];
  dependencyGraph?: TemplateDependencyGraphEntry[];
  purpose: string;
}

export async function seedCr104Demo(actor: SeedActor): Promise<void> {
  const mandatorySeed = loadJson<PackSeedInput>("cr104-demo-mandatory.pack.json");
  const platformTenantId = await getPlatformTenantId();
  if (!(await packsDB.findActiveByCode(mandatorySeed.code, platformTenantId)).data) {
    const mandatoryResult = await publishPack({ seed: mandatorySeed, actorId: actor.authoredBy, activate: true });
    if (!mandatoryResult.ok) throw new Error(`[seed:cr104-demo] failed to publish "${mandatorySeed.code}": ${(mandatoryResult.errors ?? []).join("; ")}`);
  }

  const policyPackSeed = loadJson<PackSeedInput>("cr104-demo-seu-eligibility-policies.pack.json");
  if (!(await packsDB.findActiveByCode(policyPackSeed.code, platformTenantId)).data) {
    const policyPackResult = await publishPack({ seed: policyPackSeed, actorId: actor.authoredBy, activate: true });
    if (!policyPackResult.ok) throw new Error(`[seed:cr104-demo] failed to publish "${policyPackSeed.code}": ${(policyPackResult.errors ?? []).join("; ")}`);
  }

  const minimalTemplateSeed = loadJson<MinimalTemplateSeed>("cr104-demo-minimal.template.json");
  let templateId = (await templatesDB.findActiveByCode(minimalTemplateSeed.code, platformTenantId)).data?.id;
  if (!templateId) {
    const templateResult = await publishTemplate({
    seed: {
      code: minimalTemplateSeed.code,
      name: minimalTemplateSeed.name,
      templateVersion: minimalTemplateSeed.templateVersion ?? INITIAL_VERSION,
      engineeringPackCodes: minimalTemplateSeed.mandatoryPackCodes,
      deliverableCatalogue: minimalTemplateSeed.deliverableCatalogue,
      dependencyGraph: minimalTemplateSeed.dependencyGraph,
      purpose: minimalTemplateSeed.purpose,
    },
    actorId: actor.authoredBy
    });
    if (!templateResult.ok) throw new Error(`[seed:cr104-demo] failed to publish template "${minimalTemplateSeed.code}": ${templateResult.errors.join("; ")}`);
    templateId = templateResult.templateId;
  }

  const profileSeed = loadJson<ProfileSeedInput>("cr104-demo-development.profile.json");
  let profileId = (await profilesDB.findActiveByCode(profileSeed.code, platformTenantId)).data?.id;
  if (!profileId) {
    const profileResult = await publishProfile({ seed: profileSeed, actorId: actor.authoredBy });
    if (!profileResult.ok) throw new Error(`[seed:cr104-demo] failed to publish profile "${profileSeed.code}": ${profileResult.errors.join("; ")}`);
    profileId = profileResult.profileId;
  }

  logger.info(`[seed:cr104-demo] done — Pack "${mandatorySeed.code}" (Mandatory), Pack "${policyPackSeed.code}" (adopts 2 real Policy Definitions), Template "${minimalTemplateSeed.code}" -> ${templateId}, Profile "${profileSeed.code}" -> ${profileId}.`);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const { actorId, actorBadge } = await userDB.getSuperuserId();
    if (!actorId) throw new Error(`Provision a superuser before this operation.`);
    
  seedCr104Demo({ authoredBy: actorId, authorBadge: actorBadge })
    .catch((err) => {
      logger.error("[seed:cr104-demo] failed", err as Error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
