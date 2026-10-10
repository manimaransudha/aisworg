import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { AcquisitionScope, DbResult, EngineeringCapitalRow, KnowledgeItemRow, KnowledgeRelationshipReferences, KnowledgeSelfReferences, KnowledgeValidationNoteRow } from "./seuTypes.js";

export const knowledgeItemsDB = {
  async create(input: {
    seuId: string;
    deliverableId: string;
    category: string;
    title: string;
    description?: string | null;
    acquisitionScope: AcquisitionScope;
    deliverableReferences?: KnowledgeRelationshipReferences;
    evidenceReferences?: KnowledgeRelationshipReferences;
    decisionReferences?: KnowledgeRelationshipReferences;
    knowledgeReferences?: KnowledgeSelfReferences;
    confidenceLevel?: string | null;
    authorId?: string | null;
  }): Promise<DbResult<KnowledgeItemRow>> {
    try {
      const { rows } = await query<KnowledgeItemRow>(
        `INSERT INTO knowledge_items (seu_id, deliverable_id, category, title, description, acquisition_scope, deliverable_references, evidence_references, decision_references, knowledge_references, confidence_level, author_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11, $12)
         RETURNING *`,
        [
          input.seuId, input.deliverableId, input.category, input.title, input.description ?? null, input.acquisitionScope,
          JSON.stringify(input.deliverableReferences ?? {}), JSON.stringify(input.evidenceReferences ?? {}),
          JSON.stringify(input.decisionReferences ?? {}), JSON.stringify(input.knowledgeReferences ?? {}),
          input.confidenceLevel ?? null, input.authorId ?? null,
        ]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[knowledgeItemsDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  async findById(id: string): Promise<DbResult<KnowledgeItemRow | null>> {
    try {
      const { rows } = await query<KnowledgeItemRow>("SELECT * FROM knowledge_items WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[knowledgeItemsDB] findById error", err as Error);
      return { error: err as Error };
    }
  },

  async findByDeliverableId(deliverableId: string): Promise<DbResult<KnowledgeItemRow[]>> {
    try {
      const { rows } = await query<KnowledgeItemRow>("SELECT * FROM knowledge_items WHERE deliverable_id = $1 ORDER BY created_at", [deliverableId]);
      return { data: rows };
    } catch (err) {
      logger.error("[knowledgeItemsDB] findByDeliverableId error", err as Error);
      return { error: err as Error };
    }
  },

  async findBySeuId(seuId: string): Promise<DbResult<KnowledgeItemRow[]>> {
    try {
      const { rows } = await query<KnowledgeItemRow>("SELECT * FROM knowledge_items WHERE seu_id = $1 ORDER BY created_at", [seuId]);
      return { data: rows };
    } catch (err) {
      logger.error("[knowledgeItemsDB] findBySeuId error", err as Error);
      return { error: err as Error };
    }
  },

  async updateStatus(id: string, status: string, authorId?: string | null, authorityBadge?: string | null): Promise<DbResult<KnowledgeItemRow>> {
    try {
      const { rows } = await query<KnowledgeItemRow>(
        `UPDATE knowledge_items
            SET status = $1, updated_at = NOW(),
                author_id = COALESCE($3, author_id), authority_badge = COALESCE($4, authority_badge)
          WHERE id = $2 RETURNING *`,
        [status, id, authorId ?? null, authorityBadge ?? null]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[knowledgeItemsDB] updateStatus error", err as Error);
      return { error: err as Error };
    }
  },

  async updateAcquisitionScope(id: string, acquisitionScope: AcquisitionScope, authorId?: string | null, authorityBadge?: string | null): Promise<DbResult<KnowledgeItemRow>> {
    try {
      const { rows } = await query<KnowledgeItemRow>(
        `UPDATE knowledge_items
            SET acquisition_scope = $1, updated_at = NOW(),
                author_id = COALESCE($3, author_id), authority_badge = COALESCE($4, authority_badge)
          WHERE id = $2 RETURNING *`,
        [acquisitionScope, id, authorId ?? null, authorityBadge ?? null]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[knowledgeItemsDB] updateAcquisitionScope error", err as Error);
      return { error: err as Error };
    }
  },

  async updateKnowledgeReferences(id: string, knowledgeReferences: KnowledgeSelfReferences): Promise<DbResult<KnowledgeItemRow>> {
    try {
      const { rows } = await query<KnowledgeItemRow>(
        "UPDATE knowledge_items SET knowledge_references = $1::jsonb, updated_at = NOW() WHERE id = $2 RETURNING *",
        [JSON.stringify(knowledgeReferences), id]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[knowledgeItemsDB] updateKnowledgeReferences error", err as Error);
      return { error: err as Error };
    }
  },

  async addValidationNote(input: { knowledgeItemId: string; noteText: string; actorId?: string | null }): Promise<DbResult<KnowledgeValidationNoteRow>> {
    try {
      const { rows } = await query<KnowledgeValidationNoteRow>(
        `INSERT INTO knowledge_validation_notes (knowledge_item_id, note_text, actor_id)
         VALUES ($1, $2, $3) RETURNING *`,
        [input.knowledgeItemId, input.noteText, input.actorId ?? null]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[knowledgeItemsDB] addValidationNote error", err as Error);
      return { error: err as Error };
    }
  },

  async listValidationNotes(knowledgeItemId: string): Promise<DbResult<KnowledgeValidationNoteRow[]>> {
    try {
      const { rows } = await query<KnowledgeValidationNoteRow>(
        "SELECT * FROM knowledge_validation_notes WHERE knowledge_item_id = $1 ORDER BY created_at",
        [knowledgeItemId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[knowledgeItemsDB] listValidationNotes error", err as Error);
      return { error: err as Error };
    }
  },

  async findEngineeringCapital(): Promise<DbResult<EngineeringCapitalRow[]>> {
    try {
      const { rows } = await query<EngineeringCapitalRow>(
        `SELECT k.*, d.name AS deliverable_name, c.code AS capability_code, c.name AS capability_name, o.statement AS objective_statement
         FROM knowledge_items k
         JOIN deliverables d ON d.id = k.deliverable_id
         JOIN seus s ON s.id = k.seu_id
         JOIN objectives o ON o.id = s.objective_id
         LEFT JOIN capabilities c ON c.id = d.producing_capability_id
         WHERE k.acquisition_scope != 'SEU'
         ORDER BY
           CASE k.acquisition_scope WHEN 'Platform' THEN 1 WHEN 'Enterprise' THEN 2 WHEN 'Capability' THEN 3 END,
           c.name NULLS LAST,
           k.created_at DESC`
      );
      return { data: rows };
    } catch (err) {
      logger.error("[knowledgeItemsDB] findEngineeringCapital error", err as Error);
      return { error: err as Error };
    }
  },

  async countByAcquisitionScope(seuId?: string): Promise<DbResult<Record<AcquisitionScope, number>>> {
    try {
      const { rows } = await query<{ acquisition_scope: AcquisitionScope; count: string }>(
        `SELECT acquisition_scope, COUNT(*)::text AS count
         FROM knowledge_items
         WHERE $1::uuid IS NULL OR seu_id = $1
         GROUP BY acquisition_scope`,
        [seuId ?? null]
      );
      const byScope: Record<AcquisitionScope, number> = { SEU: 0, Capability: 0, Enterprise: 0, Platform: 0 };
      for (const row of rows) byScope[row.acquisition_scope] = Number(row.count);
      return { data: byScope };
    } catch (err) {
      logger.error("[knowledgeItemsDB] countByAcquisitionScope error", err as Error);
      return { error: err as Error };
    }
  },
};
