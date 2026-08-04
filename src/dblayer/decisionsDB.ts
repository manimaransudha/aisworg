import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, DecisionRow, TransitionEntityType } from "./seuTypes.js";

export const decisionsDB = {
  async create(input: {
    seuId: string;
    relatedObjectType: TransitionEntityType;
    relatedObjectId: string;
    knowledgeId?: string | null;
    evidenceId?: string | null;
    category: string;
    title: string;
    engineeringQuestion?: string | null;
    selectedAlternative?: string | null;
    rationale?: string | null;
  }): Promise<DbResult<DecisionRow>> {
    try {
      const { rows } = await query<DecisionRow>(
        `INSERT INTO decisions (seu_id, related_object_type, related_object_id, knowledge_id, evidence_id, category, title, engineering_question, selected_alternative, rationale)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          input.seuId,
          input.relatedObjectType,
          input.relatedObjectId,
          input.knowledgeId ?? null,
          input.evidenceId ?? null,
          input.category,
          input.title,
          input.engineeringQuestion ?? null,
          input.selectedAlternative ?? null,
          input.rationale ?? null,
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

  async findByRelatedObject(relatedObjectType: TransitionEntityType, relatedObjectId: string): Promise<DbResult<DecisionRow[]>> {
    try {
      const { rows } = await query<DecisionRow>(
        "SELECT * FROM decisions WHERE related_object_type = $1 AND related_object_id = $2 ORDER BY created_at",
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

  async updateStatus(id: string, status: string): Promise<DbResult<DecisionRow>> {
    try {
      const { rows } = await query<DecisionRow>(
        "UPDATE decisions SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
        [status, id]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[decisionsDB] updateStatus error", err as Error);
      return { error: err as Error };
    }
  },
};
