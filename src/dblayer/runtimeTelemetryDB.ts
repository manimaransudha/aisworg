import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, DispatchLatencyRow, WorkItemDurationRow } from "./seuTypes.js";

// Engineering Telemetry — Plan, Build order step 3 — Runtime Telemetry.
// Every query here takes an optional seuId (Build order step 2's pattern),
// omitted = platform-wide.
export const runtimeTelemetryDB = {
  // Ch.35 §7 "Command generation rate" — a total count, not yet a real
  // time-bucketed rate (per-day/per-hour): there's no established
  // time-series bucketing pattern anywhere in this codebase yet, and
  // building one is Trend Telemetry (§12) territory, explicitly held.
  // Volume today, same honesty as ET-005's own "no snapshot mechanism" note.
  async countCommandsGenerated(seuId?: string): Promise<DbResult<number>> {
    try {
      const { rows } = await query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM commands WHERE $1::uuid IS NULL OR seu_id = $1",
        [seuId ?? null]
      );
      return { data: Number(rows[0]?.count ?? 0) };
    } catch (err) {
      logger.error("[runtimeTelemetryDB] countCommandsGenerated error", err as Error);
      return { error: err as Error };
    }
  },

  // CommandGenerated -> WorkItemDispatched, correlated by the correlationId
  // executionEngine.execute threads through both. A Command whose dispatch
  // was deferred (no eligible Participant) has no WorkItemDispatched event,
  // so the join naturally excludes it — same "only count what actually
  // completed the step" discipline qualityGateEvaluationsDB.findLatencies
  // already uses (its own HAVING clause). commands.created_at stands in for
  // CommandGenerated's own occurred_at (published immediately after the
  // row is inserted) — same shortcut deliverablesDB.findCycleTimes already
  // takes for its own start timestamp.
  async findDispatchLatencies(seuId?: string): Promise<DbResult<DispatchLatencyRow[]>> {
    try {
      const { rows } = await query<DispatchLatencyRow>(
        `SELECT
           c.id AS command_id, c.seu_id, c.command_type,
           c.created_at AS generated_at,
           MIN(e.occurred_at) AS dispatched_at,
           EXTRACT(EPOCH FROM (MIN(e.occurred_at) - c.created_at)) AS latency_seconds
         FROM commands c
         JOIN events e ON e.correlation_id = c.correlation_id AND e.event_type = 'WorkItemDispatched'
         WHERE $1::uuid IS NULL OR c.seu_id = $1
         GROUP BY c.id, c.seu_id, c.command_type, c.created_at
         ORDER BY latency_seconds DESC`,
        [seuId ?? null]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[runtimeTelemetryDB] findDispatchLatencies error", err as Error);
      return { error: err as Error };
    }
  },

  // WorkItemStarted -> WorkItemCompleted, per Work Item. No autonomous
  // Participant runtime exists yet (dispatchEngine.ts's own comment):
  // execution is simulated synchronously in the same call as dispatch, so
  // every duration today is a handful of milliseconds, not a meaningful
  // spread — the mechanism is real and correct, the values are just
  // currently near-zero, the same "computed correctly off data that doesn't
  // vary yet" situation Governance latency was in before any gate had ever
  // blocked anything.
  async findWorkItemDurations(seuId?: string): Promise<DbResult<WorkItemDurationRow[]>> {
    try {
      const { rows } = await query<WorkItemDurationRow>(
        `SELECT
           wi.id AS work_item_id, c.seu_id,
           MIN(e_start.occurred_at) AS started_at,
           MIN(e_complete.occurred_at) AS completed_at,
           EXTRACT(EPOCH FROM (MIN(e_complete.occurred_at) - MIN(e_start.occurred_at))) AS duration_seconds
         FROM work_items wi
         JOIN commands c ON c.id = wi.command_id
         JOIN events e_start ON e_start.originating_object_type = 'WorkItem' AND e_start.originating_object_id = wi.id AND e_start.event_type = 'WorkItemStarted'
         JOIN events e_complete ON e_complete.originating_object_type = 'WorkItem' AND e_complete.originating_object_id = wi.id AND e_complete.event_type = 'WorkItemCompleted'
         WHERE $1::uuid IS NULL OR c.seu_id = $1
         GROUP BY wi.id, c.seu_id
         ORDER BY duration_seconds DESC`,
        [seuId ?? null]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[runtimeTelemetryDB] findWorkItemDurations error", err as Error);
      return { error: err as Error };
    }
  },
};
