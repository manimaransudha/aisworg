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
  description?: string | null;
}

function loadSeeds(): RouteAuthoritySeed[] {
  const raw = readFileSync(path.join(__dirname, "data", "routeAuthority.json"), "utf8");
  return JSON.parse(raw) as RouteAuthoritySeed[];
}

export interface SeedActor {
  authoredBy: string;
  authorBadge: string;
}

export async function seedRouteAuthority(actor: SeedActor): Promise<void> {
  const seeds = loadSeeds();

  const seen = new Set<string>();
  const duplicates = seeds.filter((s) => {
    const key = `${s.method}|${s.path}`;
    const repeated = seen.has(key);
    seen.add(key);
    return repeated;
  });
  if (duplicates.length) throw new Error(`[seedRouteAuthority] routeAuthority.json has duplicate entries (method|path): ${duplicates.map((d) => `${d.method} ${d.path}`).join(", ")}`);

  const { actorId, actorBadge } = await userDB.getSuperuserId();
  if (!actorId) throw new Error(`No participants_master row for user_id ${actorId} -- log in as root first.`);

  const { error } = await routeAuthorityDB.bulkUpsert(
    seeds.map((seed) => ({
      method: seed.method,
      path: seed.path,
      badges: seed.badges,
      roles: seed.roles,
      matchMode: seed.match_mode,
      description: seed.description ?? null,
      authorId: actorId,
      authorBadge: actorBadge,
    }))
  );
  if (error) throw new Error(`[seedRouteAuthority] bulk upsert failed: ${error.message}`);
  logger.info(`[seedRouteAuthority] upserted ${seeds.length} baseline rows`);

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
