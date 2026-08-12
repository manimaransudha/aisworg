import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, FindingRow, TransitionEntityType } from "./seuTypes.js";

// Review Model — Plan (Phase 14, Ch.25 §12). Findings are independent, traceable
// observations from a Review. Same governed-entity shape as the rest.
export const findingsDB = {
  async create(input: {
    reviewId: string;
    seuId: string;
    relatedObjectType: TransitionEntityType;
    relatedObjectId: string;
    severity: string;
    title: string;
    description?: string | null;
  }): Promise<DbResult<FindingRow>> {
    try {
      const { rows } = await query<FindingRow>(
        `INSERT INTO findings (review_id, seu_id, related_object_type, related_object_id, severity, title, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [input.reviewId, input.seuId, input.relatedObjectType, input.relatedObjectId, input.severity, input.title, input.description ?? null]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[findingsDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  async findById(id: string): Promise<DbResult<FindingRow | null>> {
    try {
      const { rows } = await query<FindingRow>("SELECT * FROM findings WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[findingsDB] findById error", err as Error);
      return { error: err as Error };
    }
  },

  async findByReviewId(reviewId: string): Promise<DbResult<FindingRow[]>> {
    try {
      const { rows } = await query<FindingRow>("SELECT * FROM findings WHERE review_id = $1 ORDER BY created_at DESC", [reviewId]);
      return { data: rows };
    } catch (err) {
      logger.error("[findingsDB] findByReviewId error", err as Error);
      return { error: err as Error };
    }
  },

  async findByRelatedObject(relatedObjectType: TransitionEntityType, relatedObjectId: string): Promise<DbResult<FindingRow[]>> {
    try {
      const { rows } = await query<FindingRow>(
        "SELECT * FROM findings WHERE related_object_type = $1 AND related_object_id = $2 ORDER BY created_at DESC",
        [relatedObjectType, relatedObjectId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[findingsDB] findByRelatedObject error", err as Error);
      return { error: err as Error };
    }
  },

  async updateStatus(id: string, status: string): Promise<DbResult<FindingRow>> {
    try {
      const { rows } = await query<FindingRow>("UPDATE findings SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *", [status, id]);
      return { data: rows[0] };
    } catch (err) {
      logger.error("[findingsDB] updateStatus error", err as Error);
      return { error: err as Error };
    }
  },

  async setObligationId(id: string, obligationId: string): Promise<DbResult<FindingRow>> {
    try {
      const { rows } = await query<FindingRow>("UPDATE findings SET obligation_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *", [obligationId, id]);
      return { data: rows[0] };
    } catch (err) {
      logger.error("[findingsDB] setObligationId error", err as Error);
      return { error: err as Error };
    }
  },
};
