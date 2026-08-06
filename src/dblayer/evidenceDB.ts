import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, EvidenceRow, TransitionEntityType } from "./seuTypes.js";

// Ch.17 EM-002/FR-17.5: Evidence is immutable after acceptance. Deliberately
// no "update content" function here at all — create + lifecycle transition
// only, so immutability holds architecturally rather than needing a runtime
// check on every field.
export const evidenceDB = {
  async create(input: {
    seuId: string;
    relatedObjectType: TransitionEntityType;
    relatedObjectId: string;
    category: string;
    title: string;
    description?: string | null;
    source?: string | null;
    confidenceLevel?: string;
  }): Promise<DbResult<EvidenceRow>> {
    try {
      const { rows } = await query<EvidenceRow>(
        `INSERT INTO evidence (seu_id, related_object_type, related_object_id, category, title, description, source, confidence_level)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [input.seuId, input.relatedObjectType, input.relatedObjectId, input.category, input.title, input.description ?? null, input.source ?? null, input.confidenceLevel ?? "Medium"]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[evidenceDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  async findById(id: string): Promise<DbResult<EvidenceRow | null>> {
    try {
      const { rows } = await query<EvidenceRow>("SELECT * FROM evidence WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[evidenceDB] findById error", err as Error);
      return { error: err as Error };
    }
  },

  async findByRelatedObject(relatedObjectType: TransitionEntityType, relatedObjectId: string): Promise<DbResult<EvidenceRow[]>> {
    try {
      const { rows } = await query<EvidenceRow>(
        "SELECT * FROM evidence WHERE related_object_type = $1 AND related_object_id = $2 ORDER BY created_at",
        [relatedObjectType, relatedObjectId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[evidenceDB] findByRelatedObject error", err as Error);
      return { error: err as Error };
    }
  },

  async findBySeuId(seuId: string): Promise<DbResult<EvidenceRow[]>> {
    try {
      const { rows } = await query<EvidenceRow>("SELECT * FROM evidence WHERE seu_id = $1 ORDER BY created_at", [seuId]);
      return { data: rows };
    } catch (err) {
      logger.error("[evidenceDB] findBySeuId error", err as Error);
      return { error: err as Error };
    }
  },

  async updateStatus(id: string, status: string): Promise<DbResult<EvidenceRow>> {
    try {
      const { rows } = await query<EvidenceRow>(
        "UPDATE evidence SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
        [status, id]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[evidenceDB] updateStatus error", err as Error);
      return { error: err as Error };
    }
  },

  // Engineering Telemetry — Plan, Build order step 4 — Knowledge Telemetry's
  // "Evidence generation."
  async count(seuId?: string): Promise<DbResult<number>> {
    try {
      const { rows } = await query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM evidence WHERE $1::uuid IS NULL OR seu_id = $1",
        [seuId ?? null]
      );
      return { data: Number(rows[0]?.count ?? 0) };
    } catch (err) {
      logger.error("[evidenceDB] count error", err as Error);
      return { error: err as Error };
    }
  },
};
