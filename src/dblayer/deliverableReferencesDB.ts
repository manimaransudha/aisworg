import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, DeliverableReferenceRow } from "./seuTypes.js";

// Participant Integration & Attestation — Plan step 2 (Resolution 3). The
// durable, append-only home for the raw VCS reference a Participant returns at
// each completion, keyed by the Deliverable and the state its Work Item drove
// toward. Read by the empty-centre presence check (a reference must exist
// before an approval can be dispatched) and, later, by the Ch.20 traceability
// query.
export const deliverableReferencesDB = {
  async record(input: {
    seuId: string;
    deliverableId: string;
    workItemId: string;
    participantId: string | null;
    fromState: string;
    toState: string;
    reference: string | null;
  }): Promise<DbResult<DeliverableReferenceRow>> {
    try {
      const { rows } = await query<DeliverableReferenceRow>(
        `INSERT INTO deliverable_references (seu_id, deliverable_id, work_item_id, participant_id, from_state, to_state, reference)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [input.seuId, input.deliverableId, input.workItemId, input.participantId, input.fromState, input.toState, input.reference]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[deliverableReferencesDB] record error", err as Error);
      return { error: err as Error };
    }
  },

  // The presence check: does this Deliverable already hold a real (non-empty)
  // reference produced toward a given state? "You cannot approve nothing."
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
