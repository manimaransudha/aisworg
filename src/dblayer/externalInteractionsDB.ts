import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, ExternalInteractionRow, InteractionDirection } from "./seuTypes.js";

export const externalInteractionsDB = {
  async create(input: {
    seuId: string;
    deliverableId?: string | null;
    interactionType: string;
    direction: InteractionDirection;
    targetSystem: string;
    purpose?: string | null;
  }): Promise<DbResult<ExternalInteractionRow>> {
    try {
      const { rows } = await query<ExternalInteractionRow>(
        `INSERT INTO external_interactions (seu_id, deliverable_id, interaction_type, direction, target_system, purpose)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [input.seuId, input.deliverableId ?? null, input.interactionType, input.direction, input.targetSystem, input.purpose ?? null]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[externalInteractionsDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  async findById(id: string): Promise<DbResult<ExternalInteractionRow | null>> {
    try {
      const { rows } = await query<ExternalInteractionRow>("SELECT * FROM external_interactions WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[externalInteractionsDB] findById error", err as Error);
      return { error: err as Error };
    }
  },

  async findBySeuId(seuId: string): Promise<DbResult<ExternalInteractionRow[]>> {
    try {
      const { rows } = await query<ExternalInteractionRow>("SELECT * FROM external_interactions WHERE seu_id = $1 ORDER BY created_at DESC", [seuId]);
      return { data: rows };
    } catch (err) {
      logger.error("[externalInteractionsDB] findBySeuId error", err as Error);
      return { error: err as Error };
    }
  },

  async updateStatus(id: string, status: string): Promise<DbResult<ExternalInteractionRow>> {
    try {
      const { rows } = await query<ExternalInteractionRow>(
        "UPDATE external_interactions SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
        [status, id]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[externalInteractionsDB] updateStatus error", err as Error);
      return { error: err as Error };
    }
  },
};
