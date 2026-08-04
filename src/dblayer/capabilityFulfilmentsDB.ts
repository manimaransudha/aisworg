import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { CapabilityFulfilmentRow, DbResult, FulfilmentStrategy } from "./seuTypes.js";

export const capabilityFulfilmentsDB = {
  async create(input: {
    seuCapabilityId: string;
    participantId: string;
    fulfilmentStrategy?: FulfilmentStrategy;
  }): Promise<DbResult<CapabilityFulfilmentRow>> {
    try {
      const { rows } = await query<CapabilityFulfilmentRow>(
        `INSERT INTO capability_fulfilments (seu_capability_id, participant_id, fulfilment_strategy)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [input.seuCapabilityId, input.participantId, input.fulfilmentStrategy ?? "AI"]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[capabilityFulfilmentsDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  // Ch.33 §7's dispatch input: the eligible-Participant pool for a Capability,
  // narrowed to whichever fulfilment is currently active. Today Capability
  // Fulfilment is 1:1 per SEU Capability, so this is the entire pool.
  async findActiveBySeuCapabilityId(seuCapabilityId: string): Promise<DbResult<CapabilityFulfilmentRow | null>> {
    try {
      const { rows } = await query<CapabilityFulfilmentRow>(
        "SELECT * FROM capability_fulfilments WHERE seu_capability_id = $1 AND revoked_at IS NULL ORDER BY established_at DESC LIMIT 1",
        [seuCapabilityId]
      );
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[capabilityFulfilmentsDB] findActiveBySeuCapabilityId error", err as Error);
      return { error: err as Error };
    }
  },
};
