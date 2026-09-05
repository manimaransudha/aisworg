// CR-087 — a standalone Pack for the `legacy-modernisation` capability
// (Ontology, migration 046), which no seeded Pack contributed until now
// (CR-087's own template review found Legacy Modernisation's Template had no
// real producer for legacy-specific knowledge recovery — only the generic
// SDLC set every other Template shares). Not an SDLC-phase Pack (doesn't
// correspond to any of the 16 phases in
// design/fragments/sdlc-templates-main) and not an EPF/OpenUP discipline
// pack — its own small family, same reason each of those got its own file:
// self-contained, no dependency on any other Pack.
//
// Runs as a step of cleanSlate.ts only (no separate pnpm script, per this
// repo's own convention — all seed data population goes through
// db:clean-slate), after the identity baseline and schema/authority-vocab
// reseed, same ordering requirement every other Pack-publishing seed step has.
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

export async function seedLegacyKnowledgeRecoveryPack(): Promise<void> {
  const seed = loadJson<PackSeedInput>("legacy-knowledge-recovery.pack.json");
  // System context (seed script): runs as root holder "1", same convention
  // every other Pack-publishing seed step uses.
  const result = await publishPack({ seed, actorRole: "super", actorId: "1", activate: true });
  if (!result.ok) {
    throw new Error(`[seed:legacy-knowledge-recovery-pack] failed to publish "${seed.code}": ${(result.errors ?? []).join("; ")}`);
  }
  logger.info(`[seed:legacy-knowledge-recovery-pack] ${result.alreadyPublished ? "already present" : "published"} — legacy-knowledge-recovery.`);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  seedLegacyKnowledgeRecoveryPack()
    .catch((err) => {
      logger.error("[seed:legacy-knowledge-recovery-pack] failed", err as Error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
