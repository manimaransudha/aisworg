import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, EventConsumptionEntry, EventRow, EventSubscriptionRow } from "./seuTypes.js";

const SORT_COLUMNS: Record<string, string> = {
  sequence: "sequence",
  eventType: "event_type",
  entityType: "originating_object_type",
  seuId: "seu_id",
  actor: "actor_id",
  occurredAt: "occurred_at",
};

export const eventsDB = {
  async append(input: {
    eventType: string;
    originatingObjectType: string;
    originatingObjectId: string;
    seuId: string | null;
    correlationId: string;
    causationId?: string | null;
    payload?: Record<string, unknown>;
    actorId: string;
    authorityBadge: string;
    consumptionState?: Record<string, EventConsumptionEntry>;
  }): Promise<DbResult<EventRow>> {
    try {
      const { rows } = await query<EventRow>(
        `INSERT INTO events (event_type, originating_object_type, originating_object_id, seu_id, correlation_id, causation_id, payload, actor_id, authority_badge, consumption_state)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          input.eventType,
          input.originatingObjectType,
          input.originatingObjectId,
          input.seuId,
          input.correlationId,
          input.causationId ?? null,
          JSON.stringify(input.payload ?? {}),
          input.actorId,
          input.authorityBadge,
          JSON.stringify(input.consumptionState ?? {}),
        ]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[eventsDB] append error", err as Error);
      return { error: err as Error };
    }
  },

  async updateConsumptionState(eventId: string, handlerName: string, status: "consumed" | "failed", error?: string): Promise<DbResult<void>> {
    try {
      const entry: EventConsumptionEntry =
        status === "consumed" ? { status, consumedAt: new Date().toISOString() } : { status, consumedAt: null, error };
      await query(
        `UPDATE events SET consumption_state = jsonb_set(consumption_state, ARRAY[$2]::text[], $3::jsonb) WHERE id = $1`,
        [eventId, handlerName, JSON.stringify(entry)]
      );
      return { data: undefined };
    } catch (err) {
      logger.error("[eventsDB] updateConsumptionState error", err as Error);
      return { error: err as Error };
    }
  },

  async findAllSubscriptions(): Promise<DbResult<EventSubscriptionRow[]>> {
    try {
      const { rows } = await query<EventSubscriptionRow>("SELECT event_type, handler_name FROM event_subscriptions");
      return { data: rows };
    } catch (err) {
      logger.error("[eventsDB] findAllSubscriptions error", err as Error);
      return { error: err as Error };
    }
  },

  async findByOriginatingObject(objectType: string, objectId: string): Promise<DbResult<EventRow[]>> {
    try {
      const { rows } = await query<EventRow>(
        "SELECT * FROM events WHERE originating_object_type = $1 AND originating_object_id = $2 ORDER BY sequence",
        [objectType, objectId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[eventsDB] findByOriginatingObject error", err as Error);
      return { error: err as Error };
    }
  },

  async findByOriginatingObjects(objectType: string, objectIds: string[]): Promise<DbResult<EventRow[]>> {
    try {
      if (objectIds.length === 0) return { data: [] };
      const { rows } = await query<EventRow>(
        "SELECT * FROM events WHERE originating_object_type = $1 AND originating_object_id = ANY($2::uuid[]) ORDER BY sequence",
        [objectType, objectIds]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[eventsDB] findByOriginatingObjects error", err as Error);
      return { error: err as Error };
    }
  },

  async findByCorrelationId(correlationId: string): Promise<DbResult<EventRow[]>> {
    try {
      const { rows } = await query<EventRow>("SELECT * FROM events WHERE correlation_id = $1 ORDER BY sequence", [correlationId]);
      return { data: rows };
    } catch (err) {
      logger.error("[eventsDB] findByCorrelationId error", err as Error);
      return { error: err as Error };
    }
  },

  async findRecent(limit: number): Promise<DbResult<EventRow[]>> {
    try {
      const { rows } = await query<EventRow>("SELECT * FROM events ORDER BY sequence DESC LIMIT $1", [limit]);
      return { data: rows };
    } catch (err) {
      logger.error("[eventsDB] findRecent error", err as Error);
      return { error: err as Error };
    }
  },

  async findPage(opts: {
    limit: number;
    offset: number;
    seuId?: string;
    eventType?: string;
    entityType?: string;
    name?: string;
    sort?: string;
    dir?: "asc" | "desc";
  }): Promise<DbResult<{ items: EventRow[]; total: number }>> {
    try {
      const conditions: string[] = [];
      const params: unknown[] = [];
      if (opts.seuId) {
        params.push(opts.seuId);
        conditions.push(`seu_id = $${params.length}`);
      }
      if (opts.eventType) {
        params.push(opts.eventType);
        conditions.push(`event_type = $${params.length}`);
      }
      if (opts.entityType) {
        params.push(opts.entityType);
        conditions.push(`originating_object_type = $${params.length}`);
      }
      if (opts.name) {
        params.push(`%${opts.name}%`);
        conditions.push(`(payload->>'code' ILIKE $${params.length} OR payload->>'name' ILIKE $${params.length})`);
      }
      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
      const orderColumn = SORT_COLUMNS[opts.sort ?? ""] ?? "sequence";
      const orderDir = opts.dir === "asc" ? "ASC" : "DESC";

      const countRes = await query<{ n: number }>(`SELECT count(*)::int AS n FROM events ${where}`, params);
      const { rows } = await query<EventRow>(
        `SELECT * FROM events ${where} ORDER BY ${orderColumn} ${orderDir} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, opts.limit, opts.offset]
      );
      return { data: { items: rows, total: countRes.rows[0]?.n ?? 0 } };
    } catch (err) {
      logger.error("[eventsDB] findPage error", err as Error);
      return { error: err as Error };
    }
  },

  async count(): Promise<DbResult<number>> {
    try {
      const { rows } = await query<{ count: string }>("SELECT COUNT(*)::text AS count FROM events");
      return { data: Number(rows[0]?.count ?? 0) };
    } catch (err) {
      logger.error("[eventsDB] count error", err as Error);
      return { error: err as Error };
    }
  },

  async countStandardPolicyDeviations(): Promise<DbResult<Array<{ policy_id: string; policy_code: string; policy_name: string; seu_id: string; count: number }>>> {
    try {
      const { rows } = await query<{ policy_id: string; policy_code: string; policy_name: string; seu_id: string; count: string }>(
        `SELECT p.id AS policy_id, p.code AS policy_code, p.name AS policy_name, e.seu_id AS seu_id, COUNT(*)::text AS count
         FROM events e
         JOIN policies p ON p.code = e.payload->>'policyCode'
         WHERE e.event_type = 'StandardPolicyDeviation' AND e.seu_id IS NOT NULL
         GROUP BY p.id, p.code, p.name, e.seu_id`
      );
      return { data: rows.map((r) => ({ ...r, count: Number(r.count) })) };
    } catch (err) {
      logger.error("[eventsDB] countStandardPolicyDeviations error", err as Error);
      return { error: err as Error };
    }
  },
};
