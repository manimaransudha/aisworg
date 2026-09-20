import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, DecisionAlternative, DecisionRelatedObjectGroup, DecisionRow, TransitionEntityType } from "./seuTypes.js";

export const decisionsDB = {
  async create(input: {
    seuId: string;
    originatingType?: string | null;
    originatingId?: string | null;
    relatedObjects: DecisionRelatedObjectGroup[];
    relatedSeu?: DecisionRelatedObjectGroup[];
    knowledgeIds?: string[];
    evidenceIds?: string[];
    category: string;
    title: string;
    engineeringQuestion?: string | null;
    alternatives?: DecisionAlternative[];
    participantId?: string | null;
    authorityBadge?: string | null;
  }): Promise<DbResult<DecisionRow>> {
    try {
      const { rows } = await query<DecisionRow>(
        `INSERT INTO decisions (seu_id, originating_type, originating_id, related_objects, related_seu, knowledge_ids, evidence_ids, category, title, engineering_question, alternatives, participant_id, authority_badge)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [
          input.seuId,
          input.originatingType ?? null,
          input.originatingId ?? null,
          JSON.stringify(input.relatedObjects ?? []),
          JSON.stringify(input.relatedSeu ?? []),
          input.knowledgeIds ?? [],
          input.evidenceIds ?? [],
          input.category,
          input.title,
          input.engineeringQuestion ?? null,
          JSON.stringify(input.alternatives ?? []),
          input.participantId ?? null,
          input.authorityBadge ?? null,
        ]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[decisionsDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  async findById(id: string): Promise<DbResult<DecisionRow | null>> {
    try {
      const { rows } = await query<DecisionRow>("SELECT * FROM decisions WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[decisionsDB] findById error", err as Error);
      return { error: err as Error };
    }
  },

  // related_objects is now a JSONB array of {related_object_type,
  // related_object_ids[]} groups (migration 231) — "any Decision with a
  // group whose type matches AND whose ids[] contains this id."
  async findByRelatedObject(relatedObjectType: TransitionEntityType, relatedObjectId: string): Promise<DbResult<DecisionRow[]>> {
    try {
      const { rows } = await query<DecisionRow>(
        `SELECT * FROM decisions
          WHERE EXISTS (
            SELECT 1 FROM jsonb_array_elements(related_objects) AS grp
             WHERE grp->>'related_object_type' = $1 AND grp->'related_object_ids' ? $2
          )
          ORDER BY created_at`,
        [relatedObjectType, relatedObjectId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[decisionsDB] findByRelatedObject error", err as Error);
      return { error: err as Error };
    }
  },

  async findBySeuId(seuId: string): Promise<DbResult<DecisionRow[]>> {
    try {
      const { rows } = await query<DecisionRow>("SELECT * FROM decisions WHERE seu_id = $1 ORDER BY created_at", [seuId]);
      return { data: rows };
    } catch (err) {
      logger.error("[decisionsDB] findBySeuId error", err as Error);
      return { error: err as Error };
    }
  },

  // participant_id/authority_badge: COALESCEd against the existing value so
  // a transition whose actor couldn't be resolved to a Participant/badge
  // doesn't blank out what an earlier hop already recorded.
  async updateStatus(id: string, status: string, actor?: { participantId?: string | null; authorityBadge?: string | null }): Promise<DbResult<DecisionRow>> {
    try {
      const { rows } = await query<DecisionRow>(
        `UPDATE decisions
            SET status = $1,
                participant_id = COALESCE($2, participant_id),
                authority_badge = COALESCE($3, authority_badge),
                updated_at = NOW()
          WHERE id = $4
          RETURNING *`,
        [status, actor?.participantId ?? null, actor?.authorityBadge ?? null, id]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[decisionsDB] updateStatus error", err as Error);
      return { error: err as Error };
    }
  },
};
