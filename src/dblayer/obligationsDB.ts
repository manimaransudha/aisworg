import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, ObligationRow, TransitionEntityType } from "./seuTypes.js";

export const obligationsDB = {
  async create(input: {
    seuId: string;
    relatedObjectType: TransitionEntityType;
    relatedObjectId: string;
    category: string;
    title: string;
    description?: string | null;
    severity?: string;
  }): Promise<DbResult<ObligationRow>> {
    try {
      const { rows } = await query<ObligationRow>(
        `INSERT INTO obligations (seu_id, related_object_type, related_object_id, category, title, description, severity)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [input.seuId, input.relatedObjectType, input.relatedObjectId, input.category, input.title, input.description ?? null, input.severity ?? "Medium"]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[obligationsDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  async findById(id: string): Promise<DbResult<ObligationRow | null>> {
    try {
      const { rows } = await query<ObligationRow>("SELECT * FROM obligations WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[obligationsDB] findById error", err as Error);
      return { error: err as Error };
    }
  },

  async findByRelatedObject(relatedObjectType: TransitionEntityType, relatedObjectId: string): Promise<DbResult<ObligationRow[]>> {
    try {
      const { rows } = await query<ObligationRow>(
        "SELECT * FROM obligations WHERE related_object_type = $1 AND related_object_id = $2 ORDER BY created_at",
        [relatedObjectType, relatedObjectId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[obligationsDB] findByRelatedObject error", err as Error);
      return { error: err as Error };
    }
  },

  async findBySeuId(seuId: string): Promise<DbResult<ObligationRow[]>> {
    try {
      const { rows } = await query<ObligationRow>("SELECT * FROM obligations WHERE seu_id = $1 ORDER BY created_at", [seuId]);
      return { data: rows };
    } catch (err) {
      logger.error("[obligationsDB] findBySeuId error", err as Error);
      return { error: err as Error };
    }
  },

  async updateStatus(id: string, status: string): Promise<DbResult<ObligationRow>> {
    try {
      const { rows } = await query<ObligationRow>(
        "UPDATE obligations SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
        [status, id]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[obligationsDB] updateStatus error", err as Error);
      return { error: err as Error };
    }
  },
};
