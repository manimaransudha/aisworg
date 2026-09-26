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
  }): Promise<DbResult<SchemaDefinitionRow>> {
    try {
      const { rows } = await query<SchemaDefinitionRow>(
        `INSERT INTO schema_definitions (entity_kind, version, schema, compatible_versions, incompatible_versions) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [input.entityKind, input.version, JSON.stringify(input.schema), input.compatibleVersions ?? [], input.incompatibleVersions ?? []]
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

  // CR-114 follow-on — two instances of the same kind (Pack P1 authored
  // against schema S1, Pack P2 against S2) are compatible/incompatible
  // exactly per S1/S2's own compatible_versions/incompatible_versions (the
  // compatibility feature above) — a read-time derivation off each row's
  // own schema_definition_id, never new storage. Same version or either
  // schema missing counts as compatible/incompatible-undecidable
  // respectively; a cross-kind comparison is never compatible.
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
