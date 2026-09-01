// domain-ebook-library.pack.json / technology-nodejs.pack.json / technologyc.pack.json /
// technologycpp.pack.json — 4 real, standalone Domain/Technology Packs
// (category Domain / Technology) that were never actually wired into any
// active publish pipeline. Found 2026-08-25: tests/commission-profile-choice.test.ts
// deliberately uses `technology-nodejs` as its own "directly observable"
// optionalPackCode, and it could never resolve — no script anywhere ever
// called publishPack for any of the 4. technologyc/technologycpp were found
// the same way while auditing this file's own list (2026-08-28) — same bug,
// just never noticed since nothing hardcoded their codes. core-engineering.pack.json
// is deliberately NOT seeded here or anywhere else (owner, 2026-08-28: "Do not
// load the pack") — its own code collides with openup-development.pack.json's
// (both "development"), and its 3 capabilities
// (requirements-analysis/architecture/development) duplicate what the real
// OpenUP packs already provide.
//
// Every one of these 4 packs' own `dependencies` declares a real dependency
// on `development` (openup-development.pack.json) — publishPack requires a
// declared dependency to already be Active in the Registry, so this must run
// AFTER seedCapabilityPatternPacks() (cleanSlate.ts step 6) has published it.
// Same rerun-safe (publishPack no-ops on an already-published (code,
// version)) convention every other seed script here uses.
//
// 2026-08-28 — technology-nodejs/technologyc/technologycpp each independently
// declared a capability code "code-review" (unprefixed, unlike their own
// nodejs-development/c-development/cpp-development) — capabilitiesDB.findByCodes
// has no Pack scoping, so seeding all 3 together would have silently
// triple-counted "code-review" the same way the OpenUP test twins once
// duplicated requirements-analysis/architecture/development. Renamed to
// nodejs-code-review/c-code-review/cpp-code-review in all 3 files.
// 2026-08-31 - Added more technology packs to load
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

const DOMAIN_TECHNOLOGY_PACK_FILES = [
  "domain-ebook-library.pack.json",
  "technology-nodejs.pack.json",
  "technologyc.pack.json",
  "technologycpp.pack.json",
  "technology-sass.pack.json",
  "technology-react.pack.json",
  "technology-react-native.pack.json",
  "technology-php.pack.json",
  "technology-js.pack.json",
  "technology-html.pack.json",
  "technology-git.pack.json",
  "technology-css.pack.json",
];

export async function seedDomainTechnologyPacks(): Promise<void> {
  // Published concurrently — all 4 depend only on `development` (already
  // Active by the time this step runs, see the file header), never on each
  // other, and their own capability codes were already de-collided (2026-08-28
  // fix, above) precisely so they can coexist. No shared mutable state between
  // them, only network round-trip time to overlap.
  const results = await Promise.allSettled(
    DOMAIN_TECHNOLOGY_PACK_FILES.map(async (file) => {
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
    throw new Error(`[seed:domain-technology-packs] ${failures.length} of ${DOMAIN_TECHNOLOGY_PACK_FILES.length} Packs failed: ${failures.join(" | ")}`);
  }

  const alreadyCount = results.filter((r) => r.status === "fulfilled" && r.value).length;
  const publishedCount = results.length - alreadyCount;
  logger.info(`[seed:domain-technology-packs] ${publishedCount} published, ${alreadyCount} already present — ${DOMAIN_TECHNOLOGY_PACK_FILES.length} Domain/Technology Packs total.`);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  seedDomainTechnologyPacks()
    .catch((err) => {
      logger.error("[seed:domain-technology-packs] failed", err as Error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
