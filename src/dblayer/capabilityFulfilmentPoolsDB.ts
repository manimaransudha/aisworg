import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { CapabilityFulfilmentPoolRow, DbResult } from "./seuTypes.js";

export const capabilityFulfilmentPoolsDB = {
  async create(input: {
    seuId: string;
    seuCapabilityId: string | null;
    capabilityId: string | null;
    participantIds: string[];
    authorId: string;
    authorBadge: string;
  }): Promise<DbResult<CapabilityFulfilmentPoolRow>> {
    try {
      const { rows } = await query<CapabilityFulfilmentPoolRow>(
        `INSERT INTO capability_fulfilment_pools (seu_id, seu_capability_id, capability_id, participant_ids, author_id, author_badge)
         VALUES ($1, $2, $3, $4::uuid[], $5, $6)
         RETURNING *`,
        [input.seuId, input.seuCapabilityId, input.capabilityId, input.participantIds, input.authorId, input.authorBadge]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[capabilityFulfilmentPoolsDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  async findById(id: string): Promise<DbResult<CapabilityFulfilmentPoolRow | null>> {
    try {
      const { rows } = await query<CapabilityFulfilmentPoolRow>("SELECT * FROM capability_fulfilment_pools WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[capabilityFulfilmentPoolsDB] findById error", err as Error);
      return { error: err as Error };
    }
  },
};
