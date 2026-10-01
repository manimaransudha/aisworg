// route_authority recovery seed — restores the 247 baseline rows (extracted
// from src/dblayer/recovery/route_authority_data_recovery.sql, folding in
// its own per-migration INSERT/ON-CONFLICT/DELETE replays) as JSON in
// data/routeAuthority.json.
//
// Unlike capability_definitions/service_definitions, route_authority is a
// flat admin-config table, not a lifecycle-governed entity (no
// Defined/Published/Active states) -- routeAuthorityDB.ts's header is
// explicit: routeAuthorityDB is "the one real write path for the
// route_authority table", so this seed goes through routeAuthorityDB.create
// for every missing (method, path) row rather than a raw bulk INSERT (the
// parallel-mechanism gap CLAUDE.md rules out), same discipline as every
// other authored table's seed, just without the extra transition hops this
// table's rows don't have.
//
// NOT wired into cleanSlate.ts (route_authority is INSERT-only, populated by
// migrations today, same reasoning as capability_definitions/
// service_definitions). Runnable from the Data Migrations admin UI
// (DATA_MIGRATION_TARGETS, core/dataMigrations.ts), and standalone:
//   npx tsx src/dblayer/seed/seedRouteAuthority.ts
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { logger } from "../../utils/logger.js";
import { routeAuthorityDB } from "../routeAuthorityDB.js";
import { participantsMasterDB } from "../participantsMasterDB.js";
import { refreshRouteAuthorityCache } from "../../domain/identity/routeAuthorityCache.js";
import { userDB } from "../userDB.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface RouteAuthoritySeed {
  method: string;
  path: string;
  badges: string[];
  roles: string[];
  match_mode: "all" | "any";
}

function loadSeeds(): RouteAuthoritySeed[] {
  const raw = readFileSync(path.join(__dirname, "data", "routeAuthority.json"), "utf8");
  return JSON.parse(raw) as RouteAuthoritySeed[];
}

// authoredBy is a participants_master.id 
export interface SeedActor {
  authoredBy: string;
  authorBadge: string;
}

export async function seedRouteAuthority(actor: SeedActor): Promise<void> {
  const seeds = loadSeeds();

  const { data: existing, error: findAllError } = await routeAuthorityDB.findAll();
  if (findAllError) throw findAllError;
  const existingKeys = new Set((existing ?? []).map((r) => `${r.method}|${r.path}`));

  const missing = seeds.filter((s) => !existingKeys.has(`${s.method}|${s.path}`));
  if (missing.length === 0) {
    logger.info("[seedRouteAuthority] every baseline row already present, nothing to do");
    return;
  }
  logger.info(`[seedRouteAuthority] ${missing.length} of ${seeds.length} baseline rows missing -- creating now`);

  // author_id is participants_master-scoped and NOT NULL -- resolve once,
  // not a default.
  const { userId, actorId, actorBadge } = await userDB.getSuperuserId();
  if (!actorId) throw new Error(`No participants_master row for user_id ${actorId} -- log in as root first.`);
  
  let i = 0;
  for (const seed of missing) {
    i++;
    const { error } = await routeAuthorityDB.create({
      method: seed.method,
      path: seed.path,
      badges: seed.badges,
      roles: seed.roles,
      matchMode: seed.match_mode,
      description: null,
      authorId: actorId,
      authorBadge: actorBadge,
    });
    if (error) throw new Error(`[seedRouteAuthority] failed to create row for ${seed.method} ${seed.path}: ${error.message}`);
    // logger.info(`[seedRouteAuthority] (${i}/${missing.length}) ${seed.method} ${seed.path} -- created`);
  }

  await refreshRouteAuthorityCache();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { actorId, actorBadge } = await userDB.getSuperuserId(); 
    if (!actorId) throw new Error("No participants_master row for user_id 1 -- log in as root first.");
    seedRouteAuthority({ authoredBy : actorId, authorBadge: actorBadge })
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error("[seedRouteAuthority] failed", err as Error);
      process.exit(1);
    });
}
