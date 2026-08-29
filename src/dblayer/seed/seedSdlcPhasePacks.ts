// SDLC Templates — Standard Platform Packs (owner, 2026-08-19): "design/
// fragments/sdlc-templates-main has the current software engineering
// methodology. Map this into pack and user it to create standard platform
// templates." Modelled on the fictional NoteShare Pro SaaS reference library
// (design/fragments/sdlc-templates-main/README.md), one Pack per SDLC phase
// (0-15) — mirroring seedCapabilityPatternPacks.ts's own OpenUP mapping, but
// a deliberately separate, independently-owned Pack family (distinct
// capability-name codes, migration 071 — not meant to collide/merge with the
// OpenUP EPF disciplines, even where a phase's theme overlaps one, e.g.
// Phase 3 vs the OpenUP Architecture pattern).
//   Deliverable (per phase) -> Service (contractDescription = the README's
//   own one-line description).
// Content recalled from design/fragments/sdlc-templates-main's own README —
// a faithful paraphrase of its phase/deliverable structure, not a verbatim
// copy of the individual markdown files' full bodies.
//
// Usage: pnpm seed:sdlc-phase-packs — also runs as a step of cleanSlate.ts,
// after the identity baseline (the actor these publish as, root holder "1",
// needs to exist first) and the schema/authority-vocab reseed (Pack's own
// transition_definitions must be in place for transitionEngine to drive
// Draft -> Validated -> Published -> Active).
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

// One file per SDLC phase (0-15), in phase order.
const SDLC_PHASE_PACK_FILES = [
  "sdlc-phase-00-vision-opportunity.pack.json",
  "sdlc-phase-01-product-discovery.pack.json",
  "sdlc-phase-02-experience-design.pack.json",
  "sdlc-phase-03-technical-discovery-architecture.pack.json",
  "sdlc-phase-04-security-privacy-compliance.pack.json",
  "sdlc-phase-05-platform-developer-experience.pack.json",
  "sdlc-phase-06-backlog-release-planning.pack.json",
  "sdlc-phase-07-implementation.pack.json",
  "sdlc-phase-08-quality-engineering-hardening.pack.json",
  "sdlc-phase-09-scale-performance-optimization.pack.json",
  "sdlc-phase-10-beta-early-access.pack.json",
  "sdlc-phase-11-launch.pack.json",
  "sdlc-phase-12-hypercare-stabilization.pack.json",
  "sdlc-phase-13-growth-optimization.pack.json",
  "sdlc-phase-14-internationalization-localization.pack.json",
  "sdlc-phase-15-ongoing-operations-governance.pack.json",
];

export async function seedSdlcPhasePacks(): Promise<void> {
  // Published concurrently — none of the 16 phase Packs declare a dependency
  // on another (confirmed against every file's own `dependencies`), each
  // publishes through its own row-scoped transitionPack/eventBus calls, and
  // publishPack/createPackDraft are rerun-safe, so there's no shared mutable
  // state or ordering constraint between them, only network round-trip time
  // to overlap.
  const results = await Promise.allSettled(
    SDLC_PHASE_PACK_FILES.map(async (file) => {
      const seed = loadJson<PackSeedInput>(file);
      // System context (seed script): runs as root holder "1", same convention
      // seedSeu.ts/seedCapabilityPatternPacks.ts use — no human author for a
      // platform-seeded phase Pack.
      const result = await publishPack({ seed, actorRole: "super", actorId: "1", activate: true });
      if (!result.ok) {
        throw new Error(`failed to publish "${seed.code}": ${(result.errors ?? []).join("; ")}`);
      }
      return result.alreadyPublished;
    })
  );

  const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected").map((r) => (r.reason as Error).message);
  if (failures.length > 0) {
    throw new Error(`[seed:sdlc-phase-packs] ${failures.length} of ${SDLC_PHASE_PACK_FILES.length} Packs failed: ${failures.join(" | ")}`);
  }

  const alreadyCount = results.filter((r) => r.status === "fulfilled" && r.value).length;
  const publishedCount = results.length - alreadyCount;
  logger.info(`[seed:sdlc-phase-packs] ${publishedCount} published, ${alreadyCount} already present — ${SDLC_PHASE_PACK_FILES.length} SDLC-phase Packs total.`);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  seedSdlcPhasePacks()
    .catch((err) => {
      logger.error("[seed:sdlc-phase-packs] failed", err as Error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
