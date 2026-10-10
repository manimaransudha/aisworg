import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, VersionEventRow } from "./seuTypes.js";

const SORT_COLUMNS: Record<string, string> = {
  occurredAt: "occurred_at",
  entityType: "entity_type",
  versionEvent: "version_event",
};

export const versionEventsDB = {
  async insert(input: {
    eventId: string;
    tenantId: string;
    entityType: string;
    entityId: string;
    fromState: string | null;
    toState: string | null;
    versionEvent: string;
    occurredAt: string;
    actorId: string;
    authorityBadge: string | null;
  }): Promise<DbResult<VersionEventRow>> {
    try {
      const { rows } = await query<VersionEventRow>(
        `INSERT INTO version_events (event_id, tenant_id, entity_type, entity_id, from_state, to_state, version_event, occurred_at, actor_id, authority_badge)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          input.eventId,
          input.tenantId,
          input.entityType,
          input.entityId,
          input.fromState,
          input.toState,
          input.versionEvent,
          input.occurredAt,
          input.actorId,
          input.authorityBadge,
        ]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[versionEventsDB] insert error", err as Error);
      return { error: err as Error };
    }
  },

  async findByEntity(entityType: string, entityId: string): Promise<DbResult<VersionEventRow[]>> {
    try {
      const { rows } = await query<VersionEventRow>(
        "SELECT * FROM version_events WHERE entity_type = $1 AND entity_id = $2 ORDER BY occurred_at",
        [entityType, entityId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[versionEventsDB] findByEntity error", err as Error);
      return { error: err as Error };
    }
  },

  async findPage(opts: {
    limit: number;
    offset: number;
    tenantId?: string;
    entityType?: string;
    entityId?: string;
    versionEvent?: string;
    sort?: string;
    dir?: "asc" | "desc";
  }): Promise<DbResult<{ items: VersionEventRow[]; total: number }>> {
    try {
      const conditions: string[] = [];
      const params: unknown[] = [];
      if (opts.tenantId) {
        params.push(opts.tenantId);
        conditions.push(`tenant_id = $${params.length}`);
      }
      if (opts.entityType) {
        params.push(opts.entityType);
        conditions.push(`entity_type = $${params.length}`);
      }
      if (opts.entityId) {
        params.push(opts.entityId);
        conditions.push(`entity_id = $${params.length}`);
      }
      if (opts.versionEvent) {
        params.push(opts.versionEvent);
        conditions.push(`version_event = $${params.length}`);
      }
      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
      const orderColumn = SORT_COLUMNS[opts.sort ?? ""] ?? "occurred_at";
      const orderDir = opts.dir === "asc" ? "ASC" : "DESC";

      const countRes = await query<{ n: number }>(`SELECT count(*)::int AS n FROM version_events ${where}`, params);
      const { rows } = await query<VersionEventRow>(
        `SELECT * FROM version_events ${where} ORDER BY ${orderColumn} ${orderDir} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, opts.limit, opts.offset]
      );
      return { data: { items: rows, total: countRes.rows[0]?.n ?? 0 } };
    } catch (err) {
      logger.error("[versionEventsDB] findPage error", err as Error);
      return { error: err as Error };
    }
  },
};
