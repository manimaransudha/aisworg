import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, EventRow } from "./seuTypes.js";

export const eventsDB = {
  async append(input: {
    eventType: string;
    originatingObjectType: string;
    originatingObjectId: string;
    correlationId: string;
    causationId?: string | null;
    payload?: Record<string, unknown>;
  }): Promise<DbResult<EventRow>> {
    try {
      const { rows } = await query<EventRow>(
        `INSERT INTO events (event_type, originating_object_type, originating_object_id, correlation_id, causation_id, payload)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          input.eventType,
          input.originatingObjectType,
          input.originatingObjectId,
          input.correlationId,
          input.causationId ?? null,
          JSON.stringify(input.payload ?? {}),
        ]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[eventsDB] append error", err as Error);
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

  async count(): Promise<DbResult<number>> {
    try {
      const { rows } = await query<{ count: string }>("SELECT COUNT(*)::text AS count FROM events");
      return { data: Number(rows[0]?.count ?? 0) };
    } catch (err) {
      logger.error("[eventsDB] count error", err as Error);
      return { error: err as Error };
    }
  },

  // Engineering Telemetry — Plan, Build order step 5 — sustained-pattern
  // detection input for Policy waiver (c). Platform-wide (not seuId-scoped
  // like the Metric Registry's own queries): the sustained-check needs to
  // scan every (policy, SEU) pair to know which ones have crossed the
  // threshold, not display one pair's number. Only events that recorded a
  // real seuId are counted — a StandardPolicyDeviation published for an
  // entity type transitionDeliverable-style callers haven't migrated to
  // pass entityId/seuId into transitionEngine.evaluate for yet is invisible
  // here, not double-counted or mis-attributed.
  async countStandardPolicyDeviations(): Promise<DbResult<Array<{ policy_id: string; policy_code: string; policy_name: string; seu_id: string; count: number }>>> {
    try {
      const { rows } = await query<{ policy_id: string; policy_code: string; policy_name: string; seu_id: string; count: string }>(
        `SELECT p.id AS policy_id, p.code AS policy_code, p.name AS policy_name, e.payload->>'seuId' AS seu_id, COUNT(*)::text AS count
         FROM events e
         JOIN policies p ON p.code = e.payload->>'policyCode'
         WHERE e.event_type = 'StandardPolicyDeviation' AND e.payload->>'seuId' IS NOT NULL
         GROUP BY p.id, p.code, p.name, e.payload->>'seuId'`
      );
      return { data: rows.map((r) => ({ ...r, count: Number(r.count) })) };
    } catch (err) {
      logger.error("[eventsDB] countStandardPolicyDeviations error", err as Error);
      return { error: err as Error };
    }
  },
};
