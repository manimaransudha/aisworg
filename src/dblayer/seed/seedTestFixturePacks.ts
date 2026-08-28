// Test-only Pack twins — mirrors of every real seed Pack (all 24
// src/dblayer/seed/data/*.pack.json files except the confirmed-dead
// core-engineering.pack.json), each republished under a `test-` prefixed
// code (data/test-fixtures/, migration 119 registers their capability-name
// Ontology concepts). Exists so tests that need "a real, Ontology-valid Pack
// code" to author throwaway Pack-lifecycle fixtures against (e.g.
// tests/sdk-authoring.test.ts, previously reusing the literal code
// "development") never again collide with — and silently deprecate, since
// only one Pack version per code can be Active — the real, production-seeded
// Pack of the same name.
//
// Called both from cleanSlate.ts (step 7b, owner's own call — every test
// twin is part of the guaranteed post-reset baseline, same as the real
// Packs) and lazily/idempotently from tests via testFixtures.ts's
// ensureTestFixturePacks, for a DB that hasn't had a fresh clean-slate run
// recently. publishPack no-ops safely either way.
//
// data/test-fixtures/*.pack.json strip `contributions.reviewGates` (and,
// since nothing then needs them, `checklists`) from the real files they
// mirror — real bug found 2026-08-25: review_gates_active_scope_key
// (migration 097) is UNIQUE on (entity_type, from_state, to_state, code)
// PLATFORM-WIDE, not Pack-scoped ("one active Review Gate per deliverable
// type per transition," by design — unlike capabilities/services/policies,
// which are all Pack-scoped, CR-065/112/106). A twin that copied the same
// reviewGates contribution verbatim always collided with the real Pack's own
// gate for that transition the moment both were Active — not a naming issue,
// a genuine structural conflict, so the fix is omission, not renaming.
//
// test-openup-development/test-openup-requirements/test-openup-architecture
// (test-development/test-requirements-analysis/test-architecture-solution-
// design) are deliberately EXCLUDED from TEST_FIXTURE_PACK_FILES below, even
// though their JSON files exist under data/test-fixtures/ like every other
// twin's. Second real bug found 2026-08-25, same day: their capability CODES
// (development/requirements-analysis/architecture) are the exact 3 codes
// ~30 test files hardcode as requiredCapabilityCodes for every commissioned
// SEU. capabilitiesDB.findByCodes (used by createObjective wherever that's
// passed) has no Pack scoping — it matches ANY row sharing a code, platform-
// wide — so publishing these 3 twins alongside the real Packs of the same
// capability codes silently doubled every commissioned Objective's resolved
// capabilities (6 rows instead of 3) for the ENTIRE suite, not just tests
// that touch the twins directly. Every other twin's capability codes are
// unique to it (nothing else hardcodes them), so they don't have this
// problem. Consumers that just need "a real, resolvable Engineering-category
// Pack" (pack-sdk.test.ts, dependency-graph-relationship-kind.test.ts) use
// test-testing-qa instead — safe, since "testing-qa" isn't hardcoded
// anywhere as a requiredCapabilityCode.
//

// Not a standalone package.json script (owner: all seed data population
// belongs in db:clean-slate) — run via `pnpm db:clean-slate` (step 7b), or
// call seedAllTestFixturePacks() directly (testFixtures.ts does this, not a
// subprocess). `tsx src/dblayer/seed/seedTestFixturePacks.ts` still works
// standalone if ever needed.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pool from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { publishPack, type PackSeedInput } from "../../routes/seu/core/packs.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data", "test-fixtures");

function loadJson<T>(fileName: string): T {
  return JSON.parse(readFileSync(path.join(dataDir, fileName), "utf8")) as T;
}

// 21 of the 24 real seed Packs (test-openup-development/-requirements/
// -architecture excluded — see the header comment above). test-domain-
// ebook-library and test-technology-nodejs both declare a real dependency on
// test-testing-qa (see their own dependencies[]) — publishPack requires a
// declared dependency to already be Active in the Registry, not just
// published later in the same batch, so test-openup-test.pack.json (which
// provides test-testing-qa) must run before either. Listed last, same
// ordering discipline the real domain-ebook-library/technology-nodejs
// pipeline (seedDomainTechnologyPacks.ts) already follows for its own
// dependency.
const TEST_FIXTURE_PACK_FILES = [
  "test-openup-configuration-and-change-management.pack.json",
  "test-openup-project-management.pack.json",
  "test-openup-test.pack.json",
  "test-sdlc-phase-00-vision-opportunity.pack.json",
  "test-sdlc-phase-01-product-discovery.pack.json",
  "test-sdlc-phase-02-experience-design.pack.json",
  "test-sdlc-phase-03-technical-discovery-architecture.pack.json",
  "test-sdlc-phase-04-security-privacy-compliance.pack.json",
  "test-sdlc-phase-05-platform-developer-experience.pack.json",
  "test-sdlc-phase-06-backlog-release-planning.pack.json",
  "test-sdlc-phase-07-implementation.pack.json",
  "test-sdlc-phase-08-quality-engineering-hardening.pack.json",
  "test-sdlc-phase-09-scale-performance-optimization.pack.json",
  "test-sdlc-phase-10-beta-early-access.pack.json",
  "test-sdlc-phase-11-launch.pack.json",
  "test-sdlc-phase-12-hypercare-stabilization.pack.json",
  "test-sdlc-phase-13-growth-optimization.pack.json",
  "test-sdlc-phase-14-internationalization-localization.pack.json",
  "test-sdlc-phase-15-ongoing-operations-governance.pack.json",
  "test-domain-ebook-library.pack.json",
  "test-technology-nodejs.pack.json",
];

export async function seedAllTestFixturePacks(): Promise<void> {
  let publishedCount = 0;
  let alreadyCount = 0;
  for (const file of TEST_FIXTURE_PACK_FILES) {
    const seed = loadJson<PackSeedInput>(file);
    // Same convention every other seed script uses (root holder "1" bypasses
    // noun×verb authority — CR-006) — publishPack/createPackDraft are
    // rerun-safe (VM-002), so this is safe on every test process start.
    const result = await publishPack({ seed, actorRole: "super", actorId: "1", activate: true });
    if (!result.ok) {
      throw new Error(`[seed:test-fixture-packs] failed to publish "${seed.code}": ${(result.errors ?? []).join("; ")}`);
    }
    if (result.alreadyPublished) alreadyCount++;
    else publishedCount++;
  }
  logger.info(`[seed:test-fixture-packs] ${publishedCount} published, ${alreadyCount} already present — ${TEST_FIXTURE_PACK_FILES.length} test-fixture Packs total.`);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  seedAllTestFixturePacks()
    .catch((err) => {
      logger.error("[seed:test-fixture-packs] failed", err as Error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
