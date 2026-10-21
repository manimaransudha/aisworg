import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, SchemaDefinitionEntityKind, SchemaDefinitionRow } from "./seuTypes.js";

export const schemaDefinitionsDB = {
  async create(input: {
    entityKind: SchemaDefinitionEntityKind;
    version: number;
    schema: Record<string, unknown>;
    compatibleVersions?: number[];
    incompatibleVersions?: number[];
    lifecycleState: SchemaDefinitionRow["lifecycle_state"];
    authorId: string;
    authorBadge: string;
  }): Promise<DbResult<SchemaDefinitionRow>> {
    try {
      const { rows } = await query<SchemaDefinitionRow>(
        `INSERT INTO schema_definitions (entity_kind, version, schema, compatible_versions, incompatible_versions, lifecycle_state, author_id, author_badge) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [input.entityKind, input.version, JSON.stringify(input.schema), input.compatibleVersions ?? [], input.incompatibleVersions ?? [], input.lifecycleState, input.authorId, input.authorBadge]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[schemaDefinitionsDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  async advanceLifecycle(id: string, toState: SchemaDefinitionRow["lifecycle_state"], authorityBadge: string, authorId: string): Promise<DbResult<SchemaDefinitionRow>> {
    try {
      const { rows } = await query<SchemaDefinitionRow>(
        `UPDATE schema_definitions SET lifecycle_state = $2, author_badge = $3, author_id = $4 WHERE id = $1 RETURNING *`,
        [id, toState, authorityBadge, authorId]
      );
      if (!rows[0]) return { error: new Error(`no schema_definitions row ${id}`) };
      return { data: rows[0] };
    } catch (err) {
      logger.error("[schemaDefinitionsDB] advanceLifecycle error", err as Error);
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

  async instancesCompatible(schemaDefinitionIdA: string, schemaDefinitionIdB: string): Promise<DbResult<boolean>> {
    try {
      if (schemaDefinitionIdA === schemaDefinitionIdB) return { data: true };
      const [{ data: a }, { data: b }] = await Promise.all([
        this.findById(schemaDefinitionIdA),
        this.findById(schemaDefinitionIdB),
      ]);
      if (!a || !b || a.entity_kind !== b.entity_kind) return { data: false };
      return { data: a.compatible_versions.includes(b.version) || b.compatible_versions.includes(a.version) };
    } catch (err) {
      logger.error("[schemaDefinitionsDB] instancesCompatible error", err as Error);
      return { error: err as Error };
    }
  },
};
