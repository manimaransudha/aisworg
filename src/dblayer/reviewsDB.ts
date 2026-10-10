import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, ReviewOutcome, ReviewRow, TransitionEntityType } from "./seuTypes.js";

export const reviewsDB = {
  async create(input: {
    seuId: string;
    relatedObjectType: TransitionEntityType;
    relatedObjectId: string;
    category: string;
    name: string;
    criteria?: Record<string, unknown>;
    reviewer?: string | null;
    reviewGateId?: string | null;
    authorId: string;
    authorBadge: string;
  }): Promise<DbResult<ReviewRow>> {
    try {
      const { rows } = await query<ReviewRow>(
        `INSERT INTO reviews (seu_id, related_object_type, related_object_id, category, name, criteria, reviewer, review_gate_id, author_id, author_badge)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [input.seuId, input.relatedObjectType, input.relatedObjectId, input.category, input.name, JSON.stringify(input.criteria ?? {}), input.reviewer ?? null, input.reviewGateId ?? null, input.authorId, input.authorBadge]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[reviewsDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  async findById(id: string): Promise<DbResult<ReviewRow | null>> {
    try {
      const { rows } = await query<ReviewRow>("SELECT * FROM reviews WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[reviewsDB] findById error", err as Error);
      return { error: err as Error };
    }
  },

  async findBySeuId(seuId: string): Promise<DbResult<ReviewRow[]>> {
    try {
      const { rows } = await query<ReviewRow>("SELECT * FROM reviews WHERE seu_id = $1 ORDER BY created_at DESC", [seuId]);
      return { data: rows };
    } catch (err) {
      logger.error("[reviewsDB] findBySeuId error", err as Error);
      return { error: err as Error };
    }
  },

  async findByRelatedObject(relatedObjectType: TransitionEntityType, relatedObjectId: string): Promise<DbResult<ReviewRow[]>> {
    try {
      const { rows } = await query<ReviewRow>(
        "SELECT * FROM reviews WHERE related_object_type = $1 AND related_object_id = $2 ORDER BY created_at DESC",
        [relatedObjectType, relatedObjectId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[reviewsDB] findByRelatedObject error", err as Error);
      return { error: err as Error };
    }
  },

  async updateStatus(id: string, status: string): Promise<DbResult<ReviewRow>> {
    try {
      const { rows } = await query<ReviewRow>("UPDATE reviews SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *", [status, id]);
      return { data: rows[0] };
    } catch (err) {
      logger.error("[reviewsDB] updateStatus error", err as Error);
      return { error: err as Error };
    }
  },

  async completeWithOutcome(id: string, outcome: ReviewOutcome): Promise<DbResult<ReviewRow>> {
    try {
      const { rows } = await query<ReviewRow>(
        "UPDATE reviews SET outcome = $1, status = 'Completed', updated_at = NOW() WHERE id = $2 RETURNING *",
        [outcome, id]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[reviewsDB] completeWithOutcome error", err as Error);
      return { error: err as Error };
    }
  },
};
