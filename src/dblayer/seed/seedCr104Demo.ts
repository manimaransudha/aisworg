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
  const mandatoryResult = await publishPack({ seed: mandatorySeed, actorRole: actor.authorBadge, actorId: actor.authoredBy, activate: true });
  if (!mandatoryResult.ok) throw new Error(`[seed:cr104-demo] failed to publish "${mandatorySeed.code}": ${(mandatoryResult.errors ?? []).join("; ")}`);

  const policyPackSeed = loadJson<PackSeedInput>("cr104-demo-seu-eligibility-policies.pack.json");
  const policyPackResult = await publishPack({ seed: policyPackSeed, actorRole: actor.authorBadge, actorId: actor.authoredBy, activate: true });
  if (!policyPackResult.ok) throw new Error(`[seed:cr104-demo] failed to publish "${policyPackSeed.code}": ${(policyPackResult.errors ?? []).join("; ")}`);

  const minimalTemplateSeed = loadJson<MinimalTemplateSeed>("cr104-demo-minimal.template.json");
  const templateResult = await publishTemplate({
    seed: {
      code: minimalTemplateSeed.code,
      name: minimalTemplateSeed.name,
      templateVersion: minimalTemplateSeed.templateVersion ?? "1.0.0",
      engineeringPackCodes: minimalTemplateSeed.mandatoryPackCodes,
      deliverableCatalogue: minimalTemplateSeed.deliverableCatalogue,
      dependencyGraph: minimalTemplateSeed.dependencyGraph,
      purpose: minimalTemplateSeed.purpose,
    },
    actorRole: actor.authorBadge, actorId: actor.authoredBy
  });
  if (!templateResult.ok) throw new Error(`[seed:cr104-demo] failed to publish template "${minimalTemplateSeed.code}": ${templateResult.errors.join("; ")}`);

  const profileSeed = loadJson<ProfileSeedInput>("cr104-demo-development.profile.json");
  const profileResult = await publishProfile({ seed: profileSeed, actorRole: actor.authorBadge, actorId: actor.authoredBy });
  if (!profileResult.ok) throw new Error(`[seed:cr104-demo] failed to publish profile "${profileSeed.code}": ${profileResult.errors.join("; ")}`);

  logger.info(`[seed:cr104-demo] done — Pack "${mandatorySeed.code}" (Mandatory), Pack "${policyPackSeed.code}" (adopts 2 real Policy Definitions), Template "${minimalTemplateSeed.code}" -> ${templateResult.templateId}, Profile "${profileSeed.code}" -> ${profileResult.profileId}.`);
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
