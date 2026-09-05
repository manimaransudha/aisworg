// CR-087 — Packs for the 3 new capabilities (migration 046) surfaced by
// reviewing whether AI Platform/Embedded Software/Data Platform had any
// genuine existing-capability fit (none did — confirmed by checking all 60
// original capabilities against each Template's real purpose first, per the
// owner's own "analyse thoroughly before you create one" instruction). Each
// Pack contributes exactly one of the 3, tying to its own real, 1:1 Service
// Definition (migration 161) — not a dummy placeholder: each has its own
// policy/checklist/review-gate content specific to what actually
// distinguishes that discipline's own quality bar. Not SDLC-phase Packs
// (don't correspond to any of the 16 NoteShare Pro phases) and not EPF/
// OpenUP disciplines — own family, same reasoning
// seedLegacyKnowledgeRecoveryPack.ts already used.
//
// Runs as a step of cleanSlate.ts only (no separate pnpm script, per this
// repo's own convention), after the identity baseline and schema/authority-
// vocab reseed, same ordering requirement every other Pack-publishing seed
// step has.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pool from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { publishPack, type PackSeedInput } from "../../routes/seu/core/packs.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");

function loadJson<T>(fileName: string): T {
  return JSON.parse(readFileSync(path.join(dataDir, fileName), "utf8")) as T;
}

const DOMAIN_SPECIALISATION_PACK_FILES = [
  "ai-model-engineering.pack.json",
  "embedded-firmware-engineering.pack.json",
  "data-pipeline-engineering.pack.json",
];

export async function seedDomainSpecialisationPacks(): Promise<void> {
  // Published concurrently — none reference each other or any Pack outside
  // themselves, same reasoning seedCapabilityPatternPacks.ts's own concurrent
  // publish already established.
  const results = await Promise.allSettled(
    DOMAIN_SPECIALISATION_PACK_FILES.map(async (file) => {
      const seed = loadJson<PackSeedInput>(file);
      const result = await publishPack({ seed, actorRole: "super", actorId: "1", activate: true });
      if (!result.ok) {
        throw new Error(`failed to publish "${seed.code}": ${(result.errors ?? []).join("; ")}`);
      }
      return result.alreadyPublished;
    })
  );

  const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected").map((r) => (r.reason as Error).message);
  if (failures.length > 0) {
    throw new Error(`[seed:domain-specialisation-packs] ${failures.length} of ${DOMAIN_SPECIALISATION_PACK_FILES.length} Packs failed: ${failures.join(" | ")}`);
  }

  const alreadyCount = results.filter((r) => r.status === "fulfilled" && r.value).length;
  const publishedCount = results.length - alreadyCount;
  logger.info(`[seed:domain-specialisation-packs] ${publishedCount} published, ${alreadyCount} already present — ${DOMAIN_SPECIALISATION_PACK_FILES.length} domain-specialisation Packs total.`);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  seedDomainSpecialisationPacks()
    .catch((err) => {
      logger.error("[seed:domain-specialisation-packs] failed", err as Error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
