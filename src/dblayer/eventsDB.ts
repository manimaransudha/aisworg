import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, EventConsumptionEntry, EventRow, EventSubscriptionRow } from "./seuTypes.js";

export const eventsDB = {
  // seuId is required (not optional): forces every caller to consciously
  // decide it, verified by typecheck — null is a deliberate, correct answer
  // for entities with no single owning SEU (Objective, Pack, Template,
  // Profile, DeliverableDefinition), not an oversight.
  async append(input: {
    eventType: string;
    originatingObjectType: string;
    originatingObjectId: string;
    seuId: string | null;
    correlationId: string;
    causationId?: string | null;
    payload?: Record<string, unknown>;
    // Accountability record — real acting user + resolved noun_verb badge.
    actorId?: string | null;
    authorityBadge?: string | null;
    // Ch.30 Event Bus redesign — initial per-handler state, from the same
    // subscription lookup that determines who to notify. {} when nobody
    // subscribes to this event_type.
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
          input.actorId ?? null,
          input.authorityBadge ?? null,
          JSON.stringify(input.consumptionState ?? {}),
        ]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[eventsDB] append error", err as Error);
      return { error: err as Error };
    }
  },

  // Ch.30 Event Bus redesign — a targeted update of just one handler's own
  // consumption_state entry, leaving every other handler's entry untouched
  // (Ch.30 §9: "consumption by one subscriber shall not affect other
  // subscribers").
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

  // Ch.30 Event Bus redesign — the Event Subscriptions table, loaded into
  // memory once at boot by eventBus.loadSubscriptions(). Never queried on
  // the publish hot path.
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
  // real seu_id are counted — a StandardPolicyDeviation published for an
  // entity type transitionDeliverable-style callers haven't migrated to
  // pass entityId/seuId into transitionEngine.evaluate for yet is invisible
  // here, not double-counted or mis-attributed.
  //
  // Ch.30 Event Bus redesign — reads the real events.seu_id column now,
  // not the payload->>'seuId' workaround this query used before that
  // column existed.
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
