import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { AcquisitionScope, DbResult, EngineeringCapitalRow, KnowledgeItemRow } from "./seuTypes.js";

export const knowledgeItemsDB = {
  async create(input: {
    seuId: string;
    deliverableId: string;
    evidenceId?: string | null;
    category: string;
    title: string;
    description?: string | null;
    acquisitionScope: AcquisitionScope;
  }): Promise<DbResult<KnowledgeItemRow>> {
    try {
      const { rows } = await query<KnowledgeItemRow>(
        `INSERT INTO knowledge_items (seu_id, deliverable_id, evidence_id, category, title, description, acquisition_scope)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [input.seuId, input.deliverableId, input.evidenceId ?? null, input.category, input.title, input.description ?? null, input.acquisitionScope]
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

  async updateStatus(id: string, status: string): Promise<DbResult<KnowledgeItemRow>> {
    try {
      const { rows } = await query<KnowledgeItemRow>(
        "UPDATE knowledge_items SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
        [status, id]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[knowledgeItemsDB] updateStatus error", err as Error);
      return { error: err as Error };
    }
  },

  async updateAcquisitionScope(id: string, acquisitionScope: AcquisitionScope): Promise<DbResult<KnowledgeItemRow>> {
    try {
      const { rows } = await query<KnowledgeItemRow>(
        "UPDATE knowledge_items SET acquisition_scope = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
        [acquisitionScope, id]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[knowledgeItemsDB] updateAcquisitionScope error", err as Error);
      return { error: err as Error };
    }
  },

  // Ch.16 §13 / Book 1 Ch.21 §21.6: Engineering Capital is precisely the
  // Knowledge Items whose Acquisition Scope has outlived their originating
  // SEU (i.e. anything not still SEU-scoped), "groupable by contributing
  // Capability and by Tenant" — no Tenant model yet (Build Plan §5), so this
  // groups by contributing Capability only, platform-wide.
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

  // Engineering Telemetry — Plan, Build order step 4 — Knowledge Telemetry's
  // "growth": distinct from findEngineeringCapital above (which deliberately
  // excludes SEU-scoped items — Capital is about reusability). Growth counts
  // every Knowledge Item, broken down by acquisition_scope, so it also
  // surfaces how much is staying SEU-local vs. being promoted.
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
