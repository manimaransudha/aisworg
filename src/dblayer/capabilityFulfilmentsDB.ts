import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { CapabilityFulfilmentRow, DbResult, FulfilmentStrategy } from "./seuTypes.js";

export const capabilityFulfilmentsDB = {
  async create(input: {
    seuCapabilityId: string;
    participantId: string;
    fulfilmentStrategy?: FulfilmentStrategy;
    authorId: string;
    authorBadge: string;
  }): Promise<DbResult<CapabilityFulfilmentRow>> {
    try {
      const { rows } = await query<CapabilityFulfilmentRow>(
        `INSERT INTO capability_fulfilments (seu_capability_id, participant_id, fulfilment_strategy, author_id, author_badge)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [input.seuCapabilityId, input.participantId, input.fulfilmentStrategy ?? "AI", input.authorId, input.authorBadge]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[capabilityFulfilmentsDB] create error", err as Error);
      return { error: err as Error };
    }
  },

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

  async findActiveManyBySeuCapabilityId(seuCapabilityId: string): Promise<DbResult<CapabilityFulfilmentRow[]>> {
    try {
      const { rows } = await query<CapabilityFulfilmentRow>(
        "SELECT * FROM capability_fulfilments WHERE seu_capability_id = $1 AND revoked_at IS NULL ORDER BY established_at",
        [seuCapabilityId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[capabilityFulfilmentsDB] findActiveManyBySeuCapabilityId error", err as Error);
      return { error: err as Error };
    }
  },

  async findActiveByParticipantId(participantId: string): Promise<DbResult<CapabilityFulfilmentRow | null>> {
    try {
      const { rows } = await query<CapabilityFulfilmentRow>(
        "SELECT * FROM capability_fulfilments WHERE participant_id = $1 AND revoked_at IS NULL ORDER BY established_at DESC LIMIT 1",
        [participantId]
      );
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[capabilityFulfilmentsDB] findActiveByParticipantId error", err as Error);
      return { error: err as Error };
    }
  },

  async findReleasedParticipantMasterIds(seuCapabilityId: string): Promise<DbResult<string[]>> {
    try {
      const { rows } = await query<{ participant_id: string }>(
        `SELECT DISTINCT p.participant_id
           FROM capability_fulfilments cf
           JOIN participants p ON p.id = cf.participant_id
          WHERE cf.seu_capability_id = $1 AND cf.revoked_at IS NOT NULL AND p.participant_id IS NOT NULL`,
        [seuCapabilityId]
      );
      return { data: rows.map((r) => r.participant_id) };
    } catch (err) {
      logger.error("[capabilityFulfilmentsDB] findReleasedParticipantMasterIds error", err as Error);
      return { error: err as Error };
    }
  },

  async revoke(id: string): Promise<DbResult<CapabilityFulfilmentRow>> {
    try {
      const { rows } = await query<CapabilityFulfilmentRow>(
        "UPDATE capability_fulfilments SET revoked_at = NOW() WHERE id = $1 RETURNING *",
        [id]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[capabilityFulfilmentsDB] revoke error", err as Error);
      return { error: err as Error };
    }
  },
};
