import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { AcquisitionScope, DbResult, DeliverableCycleTimeRow, DeliverableRow } from "./seuTypes.js";

export const deliverablesDB = {
  async create(input: {
    seuId: string;
    name: string;
    category?: string | null;
    acquisitionScope?: AcquisitionScope;
    producingCapabilityId?: string | null;
    code?: string | null;
    state: string;
    authorId: string;
    authorBadge: string;
  }): Promise<DbResult<DeliverableRow>> {
    try {
      const { rows } = await query<DeliverableRow>(
        `INSERT INTO deliverables (seu_id, name, category, acquisition_scope, producing_capability_id, code, lifecycle_state, author_id, author_badge)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [input.seuId, input.name, input.category ?? null, input.acquisitionScope ?? "SEU", input.producingCapabilityId ?? null, input.code ?? null, input.state, input.authorId, input.authorBadge]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[deliverablesDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  async findById(id: string): Promise<DbResult<DeliverableRow | null>> {
    try {
      const { rows } = await query<DeliverableRow>("SELECT * FROM deliverables WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[deliverablesDB] findById error", err as Error);
      return { error: err as Error };
    }
  },

  async findBySeuId(seuId: string): Promise<DbResult<DeliverableRow[]>> {
    try {
      const { rows } = await query<DeliverableRow>("SELECT * FROM deliverables WHERE seu_id = $1 ORDER BY created_at", [seuId]);
      return { data: rows };
    } catch (err) {
      logger.error("[deliverablesDB] findBySeuId error", err as Error);
      return { error: err as Error };
    }
  },

  // The Deliverables of the SEU that depend on the named Deliverable at the given state: the targets of every dependency row, among the given rows, whose source it is.
  async findSuccessors(seuId: string, dependencyDefinitionIds: string[], entityType: string, fromName: string, fromState: string): Promise<DbResult<DeliverableRow[]>> {
    try {
      const { rows } = await query<DeliverableRow>(
        `SELECT DISTINCT d.* FROM dependency_definitions dd
         JOIN deliverables d ON d.seu_id = $1 AND d.name = dd.to_name
         WHERE dd.id = ANY($2::uuid[])
           AND dd.from_entity_type = $3 AND dd.to_entity_type = $3
           AND dd.from_name = $4 AND dd.from_state = $5
         ORDER BY d.created_at`,
        [seuId, dependencyDefinitionIds, entityType, fromName, fromState]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[deliverablesDB] findSuccessors error", err as Error);
      return { error: err as Error };
    }
  },

  async findByCategory(category: string): Promise<DbResult<DeliverableRow[]>> {
    try {
      const { rows } = await query<DeliverableRow>("SELECT * FROM deliverables WHERE category = $1 ORDER BY created_at DESC", [category]);
      return { data: rows };
    } catch (err) {
      logger.error("[deliverablesDB] findByCategory error", err as Error);
      return { error: err as Error };
    }
  },

  async findCycleTimes(seuId?: string): Promise<DbResult<DeliverableCycleTimeRow[]>> {
    try {
      const { rows } = await query<DeliverableCycleTimeRow>(
        `SELECT
           d.id, d.name, d.seu_id, d.lifecycle_state, d.created_at,
           MAX(e.occurred_at) AS last_transition_at,
           EXTRACT(EPOCH FROM (MAX(e.occurred_at) - d.created_at)) AS cycle_time_seconds
         FROM deliverables d
         JOIN events e ON e.originating_object_type = 'Deliverable' AND e.originating_object_id = d.id AND e.event_type = 'DeliverableTransitioned'
         ${seuId ? "WHERE d.seu_id = $1" : ""}
         GROUP BY d.id
         ORDER BY cycle_time_seconds DESC`,
        seuId ? [seuId] : []
      );
      return { data: rows };
    } catch (err) {
      logger.error("[deliverablesDB] findCycleTimes error", err as Error);
      return { error: err as Error };
    }
  },

  async findLifecycleStateDistribution(seuId?: string): Promise<DbResult<Record<string, number>>> {
    try {
      const { rows } = await query<{ lifecycle_state: string; count: string }>(
        `SELECT lifecycle_state, COUNT(*)::text AS count FROM deliverables ${seuId ? "WHERE seu_id = $1" : ""} GROUP BY lifecycle_state`,
        seuId ? [seuId] : []
      );
      const byState: Record<string, number> = {};
      for (const row of rows) byState[row.lifecycle_state] = Number(row.count);
      return { data: byState };
    } catch (err) {
      logger.error("[deliverablesDB] findLifecycleStateDistribution error", err as Error);
      return { error: err as Error };
    }
  },

  async updateLifecycleState(id: string, state: string): Promise<DbResult<DeliverableRow>> {
    try {
      const { rows } = await query<DeliverableRow>(
        "UPDATE deliverables SET lifecycle_state = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
        [state, id]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[deliverablesDB] updateLifecycleState error", err as Error);
      return { error: err as Error };
    }
  },
};
