import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { query, bulkInsert } from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { transitionDefinitionsDB } from "../transitionDefinitionsDB.js";
import { SCHEMA_DEFINITION_ENTITY_TYPE } from "../constants.js";
import { seedSchemaDefinitionBirthTransition } from "./seedTransitionDefinitions.js";
import type { SchemaDefinitionEntityKind, SchemaDefinitionRow } from "../seuTypes.js";
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

// Deletes every schema_definitions row and reloads the baseline from schemaDefinitions.json.
export async function seedSchemaDefinitions(actor: SeedActor): Promise<void> {
  const seeds = loadSeeds();

  // This seed runs first. It empties transition_definitions and loads the SchemaDefinition birth row it needs; seedTransitionDefinitions loads the rest later.
  await seedSchemaDefinitionBirthTransition(actor);
  const { data: birth, error: birthError } = await transitionDefinitionsDB.findBirth(SCHEMA_DEFINITION_ENTITY_TYPE);
  if (birthError) throw birthError;
  if (!birth) throw new Error("[seedSchemaDefinitions] no birth Transition Definition for SchemaDefinition after seedSchemaDefinitionBirthTransition");

  await query("DELETE FROM schema_definitions");
  const { rows } = await bulkInsert(
    "schema_definitions",
    ["entity_kind", "version", "schema", "compatible_versions", "incompatible_versions", "lifecycle_state", "author_id", "author_badge"],
    seeds.map((seed) => [
      seed.entity_kind, seed.version, JSON.stringify(seed.schema), seed.compatible_versions ?? [], seed.incompatible_versions ?? [],
      birth.to_state as SchemaDefinitionRow["lifecycle_state"], actor.authoredBy, actor.authorBadge,
    ])
  );
  logger.info(`[seedSchemaDefinitions] ${rows.length} schema definitions reloaded`);
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
