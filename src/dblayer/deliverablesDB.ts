import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { AcquisitionScope, DbResult, DeliverableCycleTimeRow, DeliverableRow } from "./seuTypes.js";

export const deliverablesDB = {
  async create(input: {
    seuId: string;
    name: string;
    category: string;
    acquisitionScope?: AcquisitionScope;
    producingCapabilityId?: string | null;
  }): Promise<DbResult<DeliverableRow>> {
    try {
      const { rows } = await query<DeliverableRow>(
        `INSERT INTO deliverables (seu_id, name, category, acquisition_scope, producing_capability_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [input.seuId, input.name, input.category, input.acquisitionScope ?? "SEU", input.producingCapabilityId ?? null]
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

  // Ch.35 §7 Flow Telemetry — "Deliverable cycle time": how long each
  // Deliverable has taken to reach its current state, measured from creation
  // to its most recent recorded transition. Platform-wide, same scoping
  // choice as Engineering Capital (Phase 6). Deliverables with no transition
  // yet (still Defined) have nothing to measure and are excluded.
  async findCycleTimes(): Promise<DbResult<DeliverableCycleTimeRow[]>> {
    try {
      const { rows } = await query<DeliverableCycleTimeRow>(
        `SELECT
           d.id, d.name, d.seu_id, d.lifecycle_state, d.created_at,
           MAX(e.occurred_at) AS last_transition_at,
           EXTRACT(EPOCH FROM (MAX(e.occurred_at) - d.created_at)) AS cycle_time_seconds
         FROM deliverables d
         JOIN events e ON e.originating_object_type = 'Deliverable' AND e.originating_object_id = d.id AND e.event_type = 'DeliverableTransitioned'
         GROUP BY d.id
         ORDER BY cycle_time_seconds DESC`
      );
      return { data: rows };
    } catch (err) {
      logger.error("[deliverablesDB] findCycleTimes error", err as Error);
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
