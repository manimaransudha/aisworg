import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, DependencyDefinitionOwnerType, DependencyDefinitionRow, DependencyRelationshipKind } from "./seuTypes.js";

export interface DependencyOwningScope {
  templateId: string;
  profileId: string;
  packIds: string[];
}

const OWNER_SCOPE_WHERE = `(
  (owning_entity_type = 'Template' AND owning_entity_id = $1)
  OR (owning_entity_type = 'Profile' AND owning_entity_id = $2)
  OR (owning_entity_type = 'Pack' AND owning_entity_id = ANY($3::uuid[]))
)`;

export const dependencyDefinitionsDB = {
  async create(input: {
    owningEntityType: DependencyDefinitionOwnerType;
    owningEntityId: string;
    fromEntityType: string;
    fromName?: string | null;
    fromState: string;
    toEntityType: string;
    toName: string;
    toState: string;
    relationshipKind?: DependencyRelationshipKind;
    authorId: string;
    authorBadge: string;
  }): Promise<DbResult<DependencyDefinitionRow | undefined>> {
    try {
      const { rows } = await query<DependencyDefinitionRow>(
        `INSERT INTO dependency_definitions (owning_entity_type, owning_entity_id, from_entity_type, from_name, from_state, to_entity_type, to_name, to_state, relationship_kind, author_id, author_badge)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT ON CONSTRAINT dependency_definitions_natural_key DO NOTHING
         RETURNING *`,
        [input.owningEntityType, input.owningEntityId, input.fromEntityType, input.fromName ?? null, input.fromState, input.toEntityType, input.toName, input.toState, input.relationshipKind ?? "dependency", input.authorId, input.authorBadge]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[dependencyDefinitionsDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  async findByOwner(owningEntityType: DependencyDefinitionOwnerType, owningEntityId: string): Promise<DbResult<DependencyDefinitionRow[]>> {
    try {
      const { rows } = await query<DependencyDefinitionRow>(
        "SELECT * FROM dependency_definitions WHERE owning_entity_type = $1 AND owning_entity_id = $2",
        [owningEntityType, owningEntityId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[dependencyDefinitionsDB] findByOwner error", err as Error);
      return { error: err as Error };
    }
  },

  async deleteByOwner(owningEntityType: DependencyDefinitionOwnerType, owningEntityId: string): Promise<DbResult<null>> {
    try {
      await query("DELETE FROM dependency_definitions WHERE owning_entity_type = $1 AND owning_entity_id = $2", [owningEntityType, owningEntityId]);
      return { data: null };
    } catch (err) {
      logger.error("[dependencyDefinitionsDB] deleteByOwner error", err as Error);
      return { error: err as Error };
    }
  },

  async findByTarget(scope: DependencyOwningScope, toEntityType: string, toName: string, toState: string): Promise<DbResult<DependencyDefinitionRow[]>> {
    try {
      const { rows } = await query<DependencyDefinitionRow>(
        `SELECT * FROM dependency_definitions
         WHERE ${OWNER_SCOPE_WHERE}
           AND to_entity_type = $4 AND to_name = $5 AND to_state = $6`,
        [scope.templateId, scope.profileId, scope.packIds, toEntityType, toName, toState]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[dependencyDefinitionsDB] findByTarget error", err as Error);
      return { error: err as Error };
    }
  },

  async findBySource(scope: DependencyOwningScope, fromEntityType: string, fromName: string | null, fromState: string): Promise<DbResult<DependencyDefinitionRow[]>> {
    try {
      const { rows } = await query<DependencyDefinitionRow>(
        `SELECT * FROM dependency_definitions
         WHERE ${OWNER_SCOPE_WHERE}
           AND from_entity_type = $4 AND from_state = $5
           AND (($6::text IS NULL AND from_name IS NULL) OR from_name = $6)`,
        [scope.templateId, scope.profileId, scope.packIds, fromEntityType, fromState, fromName]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[dependencyDefinitionsDB] findBySource error", err as Error);
      return { error: err as Error };
    }
  },

  async findByTargetName(scope: DependencyOwningScope, toEntityType: string, toName: string): Promise<DbResult<DependencyDefinitionRow[]>> {
    try {
      const { rows } = await query<DependencyDefinitionRow>(
        `SELECT * FROM dependency_definitions
         WHERE ${OWNER_SCOPE_WHERE}
           AND to_entity_type = $4 AND to_name = $5`,
        [scope.templateId, scope.profileId, scope.packIds, toEntityType, toName]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[dependencyDefinitionsDB] findByTargetName error", err as Error);
      return { error: err as Error };
    }
  },

  async findBySourceName(scope: DependencyOwningScope, fromEntityType: string, fromName: string): Promise<DbResult<DependencyDefinitionRow[]>> {
    try {
      const { rows } = await query<DependencyDefinitionRow>(
        `SELECT * FROM dependency_definitions
         WHERE ${OWNER_SCOPE_WHERE}
           AND from_entity_type = $4 AND from_name = $5`,
        [scope.templateId, scope.profileId, scope.packIds, fromEntityType, fromName]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[dependencyDefinitionsDB] findBySourceName error", err as Error);
      return { error: err as Error };
    }
  },
};
