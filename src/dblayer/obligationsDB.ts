import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, ObligationRow } from "./seuTypes.js";

export const obligationsDB = {
  async create(input: {
    seuId: string;
    deliverableId: string;
    category: string;
    title: string;
    description?: string | null;
    severity?: string;
  }): Promise<DbResult<ObligationRow>> {
    try {
      const { rows } = await query<ObligationRow>(
        `INSERT INTO obligations (seu_id, deliverable_id, category, title, description, severity)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [input.seuId, input.deliverableId, input.category, input.title, input.description ?? null, input.severity ?? "Medium"]
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

  async findByDeliverableId(deliverableId: string): Promise<DbResult<ObligationRow[]>> {
    try {
      const { rows } = await query<ObligationRow>("SELECT * FROM obligations WHERE deliverable_id = $1 ORDER BY created_at", [deliverableId]);
      return { data: rows };
    } catch (err) {
      logger.error("[obligationsDB] findByDeliverableId error", err as Error);
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
