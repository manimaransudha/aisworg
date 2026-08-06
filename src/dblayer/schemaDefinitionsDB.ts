import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, SchemaDefinitionEntityKind, SchemaDefinitionRow } from "./seuTypes.js";

export const schemaDefinitionsDB = {
  async create(input: { entityKind: SchemaDefinitionEntityKind; version: number; schema: Record<string, unknown> }): Promise<DbResult<SchemaDefinitionRow>> {
    try {
      const { rows } = await query<SchemaDefinitionRow>(
        `INSERT INTO schema_definitions (entity_kind, version, schema) VALUES ($1, $2, $3) RETURNING *`,
        [input.entityKind, input.version, JSON.stringify(input.schema)]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[schemaDefinitionsDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  async findById(id: string): Promise<DbResult<SchemaDefinitionRow | null>> {
    try {
      const { rows } = await query<SchemaDefinitionRow>("SELECT * FROM schema_definitions WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[schemaDefinitionsDB] findById error", err as Error);
      return { error: err as Error };
    }
  },

  // The version an authoring session should start against — "picked from
  // DB," per the plan's "Where authored content lives" section.
  async findLatest(entityKind: SchemaDefinitionEntityKind): Promise<DbResult<SchemaDefinitionRow | null>> {
    try {
      const { rows } = await query<SchemaDefinitionRow>(
        "SELECT * FROM schema_definitions WHERE entity_kind = $1 ORDER BY version DESC LIMIT 1",
        [entityKind]
      );
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[schemaDefinitionsDB] findLatest error", err as Error);
      return { error: err as Error };
    }
  },

  async findAllVersions(entityKind: SchemaDefinitionEntityKind): Promise<DbResult<SchemaDefinitionRow[]>> {
    try {
      const { rows } = await query<SchemaDefinitionRow>(
        "SELECT * FROM schema_definitions WHERE entity_kind = $1 ORDER BY version DESC",
        [entityKind]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[schemaDefinitionsDB] findAllVersions error", err as Error);
      return { error: err as Error };
    }
  },

  async findAll(): Promise<DbResult<SchemaDefinitionRow[]>> {
    try {
      const { rows } = await query<SchemaDefinitionRow>("SELECT * FROM schema_definitions ORDER BY entity_kind, version DESC");
      return { data: rows };
    } catch (err) {
      logger.error("[schemaDefinitionsDB] findAll error", err as Error);
      return { error: err as Error };
    }
  },
};
