import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { AcquisitionScope, DbResult, DeliverableCycleTimeRow, DeliverableRow } from "./seuTypes.js";

export const deliverablesDB = {
  async create(input: {
    seuId: string;
    name: string;
    // CR-087 follow-up — optional now (migration 163 dropped the column's
    // NOT NULL): Template-commissioned Deliverables no longer supply one
    // (core/commissioning.ts); the separate manual "add a Deliverable to a
    // live SEU" path (core/deliverables.ts) still always passes a real value.
    category?: string | null;
    acquisitionScope?: AcquisitionScope;
    producingCapabilityId?: string | null;
  }): Promise<DbResult<DeliverableRow>> {
    try {
      const { rows } = await query<DeliverableRow>(
        `INSERT INTO deliverables (seu_id, name, category, acquisition_scope, producing_capability_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [input.seuId, input.name, input.category ?? null, input.acquisitionScope ?? "SEU", input.producingCapabilityId ?? null]
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

  // SDK UI Layer Plan — lists authoring sessions for one of the four kinds
  // (category is set from the bootstrap Template's own Deliverable Catalogue
  // entry, e.g. "Pack Definition"), newest first.
  async findByCategory(category: string): Promise<DbResult<DeliverableRow[]>> {
    try {
      const { rows } = await query<DeliverableRow>("SELECT * FROM deliverables WHERE category = $1 ORDER BY created_at DESC", [category]);
      return { data: rows };
    } catch (err) {
      logger.error("[deliverablesDB] findByCategory error", err as Error);
      return { error: err as Error };
    }
  },

  // Ch.35 §7 Flow Telemetry — "Deliverable cycle time": how long each
  // Deliverable has taken to reach its current state, measured from creation
  // to its most recent recorded transition. Platform-wide, same scoping
  // choice as Engineering Capital (Phase 6). Deliverables with no transition
  // yet (still Defined) have nothing to measure and are excluded.
  // Engineering Telemetry — Plan, Build order step 2 — seuId is optional:
  // omitted keeps the original platform-wide pooling, passed narrows to one
  // SEU. seu_id was already selected in every row; this is a filter, not new
  // data collection.
  async findCycleTimes(seuId?: string): Promise<DbResult<DeliverableCycleTimeRow[]>> {
    try {
      const { rows } = await query<DeliverableCycleTimeRow>(
        `SELECT
           d.id, d.name, d.seu_id, d.lifecycle_state, d.created_at,
           MAX(e.occurred_at) AS last_transition_at,
           EXTRACT(EPOCH FROM (MAX(e.occurred_at) - d.created_at)) AS cycle_time_seconds
         FROM deliverables d
         JOIN events e ON e.originating_object_type = 'Deliverable' AND e.originating_object_id = d.id AND e.event_type = 'DeliverableTransitioned'
         WHERE $1::uuid IS NULL OR d.seu_id = $1
         GROUP BY d.id
         ORDER BY cycle_time_seconds DESC`,
        [seuId ?? null]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[deliverablesDB] findCycleTimes error", err as Error);
      return { error: err as Error };
    }
  },

  // Engineering Telemetry — Plan, Build order step 6 — Quality Telemetry's
  // "Deliverable acceptance rate." lifecycle_state isn't a fixed union (Build
  // Plan §2.3 — validated by transitionEngine, not the DB), so this returns
  // whatever states actually appear rather than a hardcoded list — Deliverable
  // has no Archived/rejected terminal state today (only Defined/In
  // Progress/Approved/Baselined), unlike the doc's own "vs. stuck/Archived"
  // phrasing; acceptance rate is computed against the full distribution.
  async findLifecycleStateDistribution(seuId?: string): Promise<DbResult<Record<string, number>>> {
    try {
      const { rows } = await query<{ lifecycle_state: string; count: string }>(
        "SELECT lifecycle_state, COUNT(*)::text AS count FROM deliverables WHERE $1::uuid IS NULL OR seu_id = $1 GROUP BY lifecycle_state",
        [seuId ?? null]
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
