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
};
