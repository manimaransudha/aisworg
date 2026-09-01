// Owner: "Create atleast one pack seed json which has all the tabs
// populated. And modify clean-slate to load it." A single, dedicated fixture
// — test-pack-all-tabs.pack.json — deliberately populates every generated-
// form tab (Identity & Metadata, Compatibility, Dependencies, and every
// Contribution type: Capabilities, Services, Checklists, Review Gates,
// Quality Gates, Policies, Obligation Definitions, Authority Rules,
// Engineering Capital (CR-082), Compliance), so authoring-UI and validation
// changes have one realistic
// Pack to exercise all of them against at once — unlike the openup-*/sdlc-*
// families, which each populate only the handful of tabs their own real
// content actually needs.
//
// Its own file (not folded into seedCapabilityPatternPacks.ts or
// seedTestFixturePacks.ts) because it isn't an EPF/OpenUP capability pattern
// and isn't a `test-` twin of an existing real Pack — a distinct purpose
// deserves its own small file, not a shoehorned entry in either existing
// list. Migration 140 registers its own stable engineering-name concept
// (test-pack-all-tabs), same discipline as 134-139.
//
// Not a standalone package.json script (owner: all seed data population
// belongs in db:clean-slate) — run via `pnpm db:clean-slate`, or call
// seedAllTabsPackFixture() directly. `tsx src/dblayer/seed/seedAllTabsPackFixture.ts`
// still works standalone if ever needed.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pool from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { publishPack, type PackSeedInput } from "../../routes/seu/core/packs.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");

export async function seedAllTabsPackFixture(): Promise<void> {
  const seed = JSON.parse(readFileSync(path.join(dataDir, "test-pack-all-tabs.pack.json"), "utf8")) as PackSeedInput;
  // Same convention every other seed script uses (root holder "1" bypasses
  // noun×verb authority — CR-006) — publishPack/createPackDraft are
  // rerun-safe (VM-002), so this is safe on every test process start.
  const result = await publishPack({ seed, actorRole: "super", actorId: "1", activate: true });
  if (!result.ok) {
    throw new Error(`[seed:all-tabs-pack-fixture] failed to publish "${seed.code}": ${(result.errors ?? []).join("; ")}`);
  }
  logger.info(`[seed:all-tabs-pack-fixture] ${result.alreadyPublished ? "already present" : "published"} — test-pack-all-tabs.`);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  seedAllTabsPackFixture()
    .catch((err) => {
      logger.error("[seed:all-tabs-pack-fixture] failed", err as Error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
