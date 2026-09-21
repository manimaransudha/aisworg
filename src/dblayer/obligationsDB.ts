import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, ObligationRow, TransitionEntityType } from "./seuTypes.js";

export const obligationsDB = {
  async create(input: {
    seuId: string;
    relatedObjectType: TransitionEntityType;
    relatedObjectId: string;
    category: string;
    title: string;
    description?: string | null;
    severity?: string;
    origin?: string | null;
    priority?: string | null;
    completionCriteria?: string | null;
    blockedFromState?: string | null;
    blockedToState?: string | null;
    originatingEntityType?: string | null;
    originatingEntityId?: string | null;
    assignedEntityType?: string | null;
    assignedEntityId?: string | null;
  }): Promise<DbResult<ObligationRow>> {
    try {
      const { rows } = await query<ObligationRow>(
        `INSERT INTO obligations (seu_id, related_object_type, related_object_id, category, title, description, severity, origin, priority, completion_criteria, blocked_from_state, blocked_to_state, originating_entity_type, originating_entity_id, assigned_entity_type, assigned_entity_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         RETURNING *`,
        [
          input.seuId, input.relatedObjectType, input.relatedObjectId, input.category, input.title, input.description ?? null, input.severity ?? "Medium",
          input.origin ?? null, input.priority ?? null, input.completionCriteria ?? null, input.blockedFromState ?? null, input.blockedToState ?? null,
          input.originatingEntityType ?? null, input.originatingEntityId ?? null, input.assignedEntityType ?? null, input.assignedEntityId ?? null,
        ]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[obligationsDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  async findById(id: string): Promise<DbResult<ObligationRow | null>> {
    try {
      const { rows } = await query<ObligationRow>("SELECT * FROM obligations WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[obligationsDB] findById error", err as Error);
      return { error: err as Error };
    }
  },

  async findByRelatedObject(relatedObjectType: TransitionEntityType, relatedObjectId: string): Promise<DbResult<ObligationRow[]>> {
    try {
      const { rows } = await query<ObligationRow>(
        "SELECT * FROM obligations WHERE related_object_type = $1 AND related_object_id = $2 ORDER BY created_at",
        [relatedObjectType, relatedObjectId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[obligationsDB] findByRelatedObject error", err as Error);
      return { error: err as Error };
    }
  },

  async findBySeuId(seuId: string): Promise<DbResult<ObligationRow[]>> {
    try {
      const { rows } = await query<ObligationRow>("SELECT * FROM obligations WHERE seu_id = $1 ORDER BY created_at", [seuId]);
      return { data: rows };
    } catch (err) {
      logger.error("[obligationsDB] findBySeuId error", err as Error);
      return { error: err as Error };
    }
  },

  // Platform-wide, not SEU-scoped — for dedup checks against a genuinely
  // cross-SEU pattern (Ch.35 §11 capability shortage), where no single SEU
  // id is stable enough to search by. See telemetry.ts's
  // raiseSustainedPatternObligation dedupScope: "platform".
  async findByCategory(category: string): Promise<DbResult<ObligationRow[]>> {
    try {
      const { rows } = await query<ObligationRow>("SELECT * FROM obligations WHERE category = $1 ORDER BY created_at", [category]);
      return { data: rows };
    } catch (err) {
      logger.error("[obligationsDB] findByCategory error", err as Error);
      return { error: err as Error };
    }
  },

  async updateStatus(id: string, status: string): Promise<DbResult<ObligationRow>> {
    try {
      const { rows } = await query<ObligationRow>(
        "UPDATE obligations SET status = $1, version = version + 1, updated_at = NOW() WHERE id = $2 RETURNING *",
        [status, id]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[obligationsDB] updateStatus error", err as Error);
      return { error: err as Error };
    }
  },

  // Migration 252 (owner: "any number of revisions can happen on the
  // record" unless a transition is made explicitly; "the save will only
  // append the history column"). A pure Revision — never touches `status` or
  // the version-significant `version` counter (those only move via
  // updateStatus, on a real governed transition), and publishes no event
  // (core/obligations.ts's reviseObligation, not this function, would be
  // where an event could be added, and it deliberately adds none). The
  // caller (core/obligations.ts) has already diffed old vs new and built
  // `historyEntry`; this is the one atomic write of both the new field
  // values and the appended history row.
  async update(id: string, fields: Partial<Pick<ObligationRow, "title" | "description" | "category" | "severity" | "priority" | "completion_criteria" | "assigned_entity_type" | "assigned_entity_id">>, historyEntry: Record<string, unknown>): Promise<DbResult<ObligationRow>> {
    try {
      const columns = Object.keys(fields);
      const setClauses = columns.map((col, i) => `${col} = $${i + 2}`);
      const { rows } = await query<ObligationRow>(
        `UPDATE obligations SET ${setClauses.length ? setClauses.join(", ") + ", " : ""}revision_history = revision_history || $1::jsonb, updated_at = NOW() WHERE id = $${columns.length + 2} RETURNING *`,
        [JSON.stringify([historyEntry]), ...columns.map((c) => (fields as Record<string, unknown>)[c]), id]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[obligationsDB] update error", err as Error);
      return { error: err as Error };
    }
  },
};
