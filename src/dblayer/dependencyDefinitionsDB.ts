import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, DependencyDefinitionOwnerType, DependencyDefinitionRow } from "./seuTypes.js";

// CR-043 — the full set of scopes one SEU's rules can be authored under: its
// own Template, every Pack actually composed into its active EBM, and its
// Profile. Evaluation gathers from all three; authoring (create/findByOwner/
// deleteByOwner below) always targets exactly one.
export interface DependencyOwningScope {
  templateId: string;
  profileId: string;
  packIds: string[];
}

// $1 = templateId, $2 = profileId, $3 = packIds — every scope-gathering
// query below binds these three first, then its own filter params after.
const OWNER_SCOPE_WHERE = `(
  (owning_entity_type = 'Template' AND owning_entity_id = $1)
  OR (owning_entity_type = 'Profile' AND owning_entity_id = $2)
  OR (owning_entity_type = 'Pack' AND owning_entity_id = ANY($3::uuid[]))
)`;

export const dependencyDefinitionsDB = {
  // ON CONFLICT DO NOTHING against the natural-key constraint (migration 075)
  // — deriveDependencyDefinitionsFromCatalogue's delete-then-insert isn't
  // atomic against another process doing the same thing concurrently for
  // the same owner (found running the test suite: 16+ files each derive via
  // their own node --test process against the shared dev database, and two
  // DELETEs can both see "nothing to remove" before either INSERT commits).
  // A conflict here means the row already exists — data is undefined, not
  // an error; callers that collect created rows for a return value simply
  // don't get this one back, which is correct since it already exists.
  async create(input: {
    owningEntityType: DependencyDefinitionOwnerType;
    owningEntityId: string;
    fromEntityType: string;
    fromName?: string | null;
    fromState: string;
    toEntityType: string;
    toName: string;
    toState: string;
  }): Promise<DbResult<DependencyDefinitionRow | undefined>> {
    try {
      const { rows } = await query<DependencyDefinitionRow>(
        `INSERT INTO dependency_definitions (owning_entity_type, owning_entity_id, from_entity_type, from_name, from_state, to_entity_type, to_name, to_state)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT ON CONSTRAINT dependency_definitions_natural_key DO NOTHING
         RETURNING *`,
        [input.owningEntityType, input.owningEntityId, input.fromEntityType, input.fromName ?? null, input.fromState, input.toEntityType, input.toName, input.toState]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[dependencyDefinitionsDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  // Authoring shape — everything owned by exactly one scope (a Template's own
  // bridge-derived rows today; a Pack's or Profile's own rows once something
  // authors them).
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

  // "What does reaching (to_entity_type, to_name, to_state) require?" — the
  // gating-check shape, gathered across every scope relevant to one SEU (its
  // Template, every composed Pack, its Profile) — not one owner alone.
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

  // "This (entity_type, name?, state) was just reached — what might it
  // unlock?" — the push-evaluation shape. name is nullable: a null-name row
  // means this from_entity_type is unnamed everywhere (Decision/Obligation/
  // Evidence/Knowledge/ExternalInteraction dependencies never carry a name),
  // so lookups for those types pass name: null and match on IS NULL.
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

  // "Everything that gates this name, in any target state" — the display
  // shape (SEU detail page), which shows a Deliverable's dependencies
  // regardless of which specific transition they gate.
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

  // "Everything this name is a prerequisite for, in any state" — the
  // traceability shape (forward navigation / impact analysis): unlike
  // findBySource, not scoped to one specific fromState, since impact
  // analysis asks "what depends on this Deliverable at all," not "what does
  // this exact state transition unlock."
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
