import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { AttestationRow, DbResult } from "./seuTypes.js";

export const attestationsDB = {
  async create(input: {
    seuId: string;
    deliverableId: string;
    workItemId: string;
    participantId: string | null;
    fromState: string;
    toState: string;
    reference: string | null;
    actingBadgeType: string | null;
    requestedBy: string | null;
  }): Promise<DbResult<AttestationRow>> {
    try {
      const { rows } = await query<AttestationRow>(
        `INSERT INTO attestations (seu_id, deliverable_id, work_item_id, participant_id, from_state, to_state, reference, acting_badge_type, requested_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [input.seuId, input.deliverableId, input.workItemId, input.participantId, input.fromState, input.toState, input.reference, input.actingBadgeType, input.requestedBy]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[attestationsDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  async findByDeliverableId(deliverableId: string): Promise<DbResult<AttestationRow[]>> {
    try {
      const { rows } = await query<AttestationRow>(
        "SELECT * FROM attestations WHERE deliverable_id = $1 ORDER BY created_at DESC",
        [deliverableId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[attestationsDB] findByDeliverableId error", err as Error);
      return { error: err as Error };
    }
  },
};
