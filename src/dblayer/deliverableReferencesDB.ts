import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, DeliverableReferenceRow } from "./seuTypes.js";

export const deliverableReferencesDB = {
  async record(input: {
    seuId: string;
    deliverableId: string;
    workItemId: string;
    participantId: string | null;
    fromState: string;
    toState: string;
    reference: string | null;
    authorId: string;
    authorBadge: string;
  }): Promise<DbResult<DeliverableReferenceRow>> {
    try {
      const { rows } = await query<DeliverableReferenceRow>(
        `INSERT INTO deliverable_references (seu_id, deliverable_id, work_item_id, participant_id, from_state, to_state, reference, author_id, author_badge)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [input.seuId, input.deliverableId, input.workItemId, input.participantId, input.fromState, input.toState, input.reference, input.authorId, input.authorBadge]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[deliverableReferencesDB] record error", err as Error);
      return { error: err as Error };
    }
  },

  async findLatestWithReference(deliverableId: string, toState: string): Promise<DbResult<DeliverableReferenceRow | null>> {
    try {
      const { rows } = await query<DeliverableReferenceRow>(
        `SELECT * FROM deliverable_references
         WHERE deliverable_id = $1 AND to_state = $2 AND reference IS NOT NULL AND reference <> ''
         ORDER BY created_at DESC
         LIMIT 1`,
        [deliverableId, toState]
      );
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[deliverableReferencesDB] findLatestWithReference error", err as Error);
      return { error: err as Error };
    }
  },

  async findByDeliverableId(deliverableId: string): Promise<DbResult<DeliverableReferenceRow[]>> {
    try {
      const { rows } = await query<DeliverableReferenceRow>(
        "SELECT * FROM deliverable_references WHERE deliverable_id = $1 ORDER BY created_at DESC",
        [deliverableId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[deliverableReferencesDB] findByDeliverableId error", err as Error);
      return { error: err as Error };
    }
  },
};
