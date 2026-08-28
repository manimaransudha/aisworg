// Eclipse Process Framework (EPF/OpenUP) capability patterns, modelled as
// Packs — owner's request (2026-08-17). Each of OpenUP's six disciplines
// (Requirements, Architecture, Development, Test, Project Management,
// Configuration & Change Management) is a reusable EPF "Capability Pattern":
// a named Role, its work products, and the tasks that produce/review them.
// This seed publishes one Pack per pattern, mapping EPF vocabulary onto the
// existing Pack contribution model (no new mechanism, no Pack-specific code —
// same discipline as every other Pack):
//   - Role            -> Capability (the ability the pattern's practitioner brings)
//   - Work Product     -> Service (contractDescription = what the work product is)
//   - Task (execution)  -> Checklist item (§20 verifiable-item fields)
//   - Task (review/verification) -> Review Gate item
// Each pattern declares its OWN capability code. Requirements/Architecture/
// Development were originally given distinct codes (requirements-management,
// architecture-design, solution-development) specifically to avoid
// colliding with platform-core-engineering's own requirements-analysis/
// architecture/development — capabilities.code was globally unique at the
// time, so redeclaring an existing code would have silently reassigned its
// originating_pack_id away from core-engineering (breaking PM-005
// traceability). 2026-08-25 — renamed back to requirements-analysis/
// architecture/development: CR-065 made capabilities.code Pack-scoped
// (originating_pack_id, code), not globally unique, and
// core-engineering.pack.json is now confirmed permanently unpublishable (no
// working bootstrap path, superseded by 69 CRs of real design work) — so
// the collision this avoided can no longer happen, and 28+ test files plus
// every real Template's own dependencyGraph (fromCapabilityCode) already
// hardcoded these exact codes rather than the ones this file used to
// generate. No dependency on any other
// Pack: self-contained, so this seed has no ordering requirement.
//
// Content recalled from EPF/OpenUP's published process content (Eclipse
// Process Framework Composer + the OpenUP practice library) — a faithful
// paraphrase of the standard discipline/role/task/work-product structure, not
// a verbatim EPF Composer export. Treat exact task/work-product wording as
// this platform's own restatement of the pattern, not a quoted EPF source.
//
// Usage: pnpm seed:capability-pattern-packs — also runs as a step of
// cleanSlate.ts, after the identity baseline (the actor these publish as,
// root holder "1", needs to exist first) and the schema/authority-vocab
// reseed (Pack's own transition_definitions must be in place for
// transitionEngine to drive Draft -> Validated -> Published -> Active).
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

// One file per EPF/OpenUP capability pattern (discipline).
const CAPABILITY_PATTERN_PACK_FILES = [
  "openup-requirements.pack.json",
  "openup-architecture.pack.json",
  "openup-development.pack.json",
  "openup-test.pack.json",
  "openup-project-management.pack.json",
  "openup-configuration-and-change-management.pack.json",
];

export async function seedCapabilityPatternPacks(): Promise<void> {
  let publishedCount = 0;
  let alreadyCount = 0;
  for (const file of CAPABILITY_PATTERN_PACK_FILES) {
    const seed = loadJson<PackSeedInput>(file);
    // System context (seed script): runs as root holder "1", same convention
    // seedSeu.ts uses for the bootstrap Pack (CR-006 — root bypasses noun×verb
    // authority; there is no human author for a platform-seeded capability
    // pattern). publishPack/createPackDraft are rerun-safe: publishing the
    // exact same (code, packVersion) again is a no-op returning the existing
    // immutable row (VM-002), so this is safe to run on every clean-slate.
    const result = await publishPack({ seed, actorRole: "super", actorId: "1", activate: true });
    if (!result.ok) {
      throw new Error(`[seed:capability-pattern-packs] failed to publish "${seed.code}": ${(result.errors ?? []).join("; ")}`);
    }
    if (result.alreadyPublished) alreadyCount++;
    else publishedCount++;
  }
  logger.info(`[seed:capability-pattern-packs] ${publishedCount} published, ${alreadyCount} already present — ${CAPABILITY_PATTERN_PACK_FILES.length} EPF/OpenUP capability-pattern Packs total.`);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  seedCapabilityPatternPacks()
    .catch((err) => {
      logger.error("[seed:capability-pattern-packs] failed", err as Error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
