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
};
