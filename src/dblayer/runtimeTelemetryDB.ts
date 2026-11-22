import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, DispatchLatencyRow, WorkItemDurationRow } from "./seuTypes.js";

// WHERE clause limiting a seu_id column to one SEU and/or to the SEUs of one tenant.
function commandScope(seuColumn: string, seuId?: string, tenantId?: string): { where: string; args: unknown[] } {
  const conds: string[] = [];
  const args: unknown[] = [];
  if (seuId) { args.push(seuId); conds.push(`${seuColumn} = $${args.length}`); }
  if (tenantId) { args.push(tenantId); conds.push(`${seuColumn} IN (SELECT id FROM seus WHERE tenant_id = $${args.length})`); }
  return { where: conds.length ? "WHERE " + conds.join(" AND ") : "", args };
}

export const runtimeTelemetryDB = {
  async countCommandsGenerated(seuId?: string, tenantId?: string): Promise<DbResult<number>> {
    try {
      const { where, args } = commandScope("seu_id", seuId, tenantId);
      const { rows } = await query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM commands ${where}`,
        args
      );
      return { data: Number(rows[0]?.count ?? 0) };
    } catch (err) {
      logger.error("[runtimeTelemetryDB] countCommandsGenerated error", err as Error);
      return { error: err as Error };
    }
  },

  async findDispatchLatencies(seuId?: string, tenantId?: string): Promise<DbResult<DispatchLatencyRow[]>> {
    try {
      const { where, args } = commandScope("c.seu_id", seuId, tenantId);
      const { rows } = await query<DispatchLatencyRow>(
        `SELECT
           c.id AS command_id, c.seu_id, c.command_type,
           c.created_at AS generated_at,
           MIN(e.occurred_at) AS dispatched_at,
           EXTRACT(EPOCH FROM (MIN(e.occurred_at) - c.created_at)) AS latency_seconds
         FROM commands c
         JOIN events e ON e.correlation_id = c.correlation_id AND e.event_type = 'WorkItemDispatched'
         ${where}
         GROUP BY c.id, c.seu_id, c.command_type, c.created_at
         ORDER BY latency_seconds DESC`,
        args
      );
      return { data: rows };
    } catch (err) {
      logger.error("[runtimeTelemetryDB] findDispatchLatencies error", err as Error);
      return { error: err as Error };
    }
  },

  async findWorkItemDurations(seuId?: string, tenantId?: string): Promise<DbResult<WorkItemDurationRow[]>> {
    try {
      const { where, args } = commandScope("c.seu_id", seuId, tenantId);
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
         ${where}
         GROUP BY wi.id, c.seu_id
         ORDER BY duration_seconds DESC`,
        args
      );
      return { data: rows };
    } catch (err) {
      logger.error("[runtimeTelemetryDB] findWorkItemDurations error", err as Error);
      return { error: err as Error };
    }
  },
};
