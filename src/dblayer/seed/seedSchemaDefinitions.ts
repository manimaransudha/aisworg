import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { query } from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { schemaDefinitionsDB } from "../schemaDefinitionsDB.js";
import type { SchemaDefinitionEntityKind } from "../seuTypes.js";
import { userDB } from "../userDB.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface SeedActor {
  authoredBy: string;
  authorBadge: string;
}

interface SchemaDefinitionSeed {
  entity_kind: SchemaDefinitionEntityKind;
  version: number;
  schema: Record<string, unknown>;
  compatible_versions?: number[];
  incompatible_versions?: number[];
}

function loadSeeds(): SchemaDefinitionSeed[] {
  const raw = readFileSync(path.join(__dirname, "data", "schemaDefinitions.json"), "utf8");
  return JSON.parse(raw) as SchemaDefinitionSeed[];
}

export async function seedSchemaDefinitions(actor: SeedActor): Promise<void> {
  const seeds = loadSeeds();

  const { rows: existing } = await query<{ entity_kind: string; version: number }>(
    "SELECT entity_kind, version FROM schema_definitions"
  );
  const existingKeys = new Set(existing.map((r) => `${r.entity_kind}|${r.version}`));

  const missing = seeds.filter((s) => !existingKeys.has(`${s.entity_kind}|${s.version}`));
  if (missing.length === 0) {
    logger.info("[seedSchemaDefinitions] every baseline row already present, nothing to do");
    return;
  }

  for (const seed of missing) {
    const { error } = await schemaDefinitionsDB.create({
      entityKind: seed.entity_kind,
      version: seed.version,
      schema: seed.schema,
      compatibleVersions: seed.compatible_versions ?? [],
      incompatibleVersions: seed.incompatible_versions ?? [],
      authorId: actor.authoredBy,
      authorBadge: actor.authorBadge,
    });
    if (error) throw new Error(`[seedSchemaDefinitions] failed to create ${seed.entity_kind} v${seed.version}: ${error.message}`);
    logger.info(`[seedSchemaDefinitions] created ${seed.entity_kind} v${seed.version}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { actorId, actorBadge } = await userDB.getSuperuserId();
  if (!actorId) throw new Error("No participants_master row for user_id 1 -- log in as root first.");
  seedSchemaDefinitions({ authoredBy: actorId, authorBadge: actorBadge })
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error("[seedSchemaDefinitions] failed", err as Error);
      process.exit(1);
    });
}
