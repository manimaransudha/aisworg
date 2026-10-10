import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import { runPaginatedQuery, type ListParams } from "../utils/listQuery.js";
import type { CommissioningReport, DbResult, SeuLifecycleState, SeuRow } from "./seuTypes.js";

export interface SeuWithObjectiveStatement extends SeuRow {
  objective_statement: string;
}

const ACTIVE_LIFECYCLE_STATES: SeuLifecycleState[] = ["Pending", "Commissioned", "Configured", "Activated", "Operational", "Suspended"];

export const seusDB = {
  async create(input: {
    objectiveId: string;
    templateId: string;
    profileId: string;
    requestedBy: string;
    tenantId?: string | null;
  }): Promise<DbResult<SeuRow>> {
    try {
      const { rows } = await query<SeuRow>(
        `INSERT INTO seus (objective_id, template_id, profile_id, requested_by, tenant_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [input.objectiveId, input.templateId, input.profileId, input.requestedBy ?? null, input.tenantId ?? null]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[seusDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  async findById(id: string): Promise<DbResult<SeuRow | null>> {
    try {
      const { rows } = await query<SeuRow>("SELECT * FROM seus WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[seusDB] findById error", err as Error);
      return { error: err as Error };
    }
  },

  async commissionedObjectiveSeuIds(): Promise<DbResult<Array<{ objectiveId: string; seuId: string }>>> {
    try {
      const { rows } = await query<{ objective_id: string; id: string }>(
        "SELECT objective_id, id FROM seus WHERE lifecycle_state = ANY($1::text[])",
        [ACTIVE_LIFECYCLE_STATES]
      );
      return { data: rows.map((r) => ({ objectiveId: r.objective_id, seuId: r.id })) };
    } catch (err) {
      logger.error("[seusDB] commissionedObjectiveSeuIds error", err as Error);
      return { error: err as Error };
    }
  },

  async findByObjectiveId(objectiveId: string): Promise<DbResult<SeuRow | null>> {
    try {
      const { rows } = await query<SeuRow>(
        "SELECT * FROM seus WHERE objective_id = $1 AND lifecycle_state = ANY($2::text[]) LIMIT 1",
        [objectiveId, ACTIVE_LIFECYCLE_STATES]
      );
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[seusDB] findByObjectiveId error", err as Error);
      return { error: err as Error };
    }
  },

  async setActiveEbm(seuId: string, ebmId: string): Promise<DbResult<SeuRow>> {
    try {
      const { rows } = await query<SeuRow>(
        "UPDATE seus SET active_ebm_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
        [ebmId, seuId]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[seusDB] setActiveEbm error", err as Error);
      return { error: err as Error };
    }
  },

  async setCompositionReport(seuId: string, report: Record<string, unknown>): Promise<DbResult<SeuRow>> {
    try {
      const { rows } = await query<SeuRow>(
        "UPDATE seus SET composition_report = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
        [JSON.stringify(report), seuId]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[seusDB] setCompositionReport error", err as Error);
      return { error: err as Error };
    }
  },

  async updateLifecycleState(seuId: string, state: SeuLifecycleState): Promise<DbResult<SeuRow>> {
    try {
      const { rows } = await query<SeuRow>(
        "UPDATE seus SET lifecycle_state = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
        [state, seuId]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[seusDB] updateLifecycleState error", err as Error);
      return { error: err as Error };
    }
  },

  async setCommissioningReport(seuId: string, report: CommissioningReport): Promise<DbResult<SeuRow>> {
    try {
      const { rows } = await query<SeuRow>(
        "UPDATE seus SET commissioning_report = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
        [JSON.stringify(report), seuId]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[seusDB] setCommissioningReport error", err as Error);
      return { error: err as Error };
    }
  },

  async listWithObjectiveStatementPaginated(params: ListParams, viewerId?: string): Promise<{ items: SeuWithObjectiveStatement[]; total: number }> {
    return runPaginatedQuery<SeuWithObjectiveStatement>(
      {
        select: "s.*, o.statement AS objective_statement",
        from: "seus s JOIN objectives o ON o.id = s.objective_id",
        searchColumns: ["o.statement", "s.lifecycle_state", "s.id::text"],
        sortMap: { objective: "o.statement", state: "s.lifecycle_state", created: "s.created_at" },
        baseWhere: "$1::uuid IS NULL OR EXISTS (SELECT 1 FROM participants p JOIN participants_master pm ON pm.id = p.participant_id WHERE p.seu_id = s.id AND pm.user_id = $1)",
        baseParams: [viewerId ?? null],
      },
      params
    );
  },

  async listWithObjectiveStatement(viewerId?: string): Promise<DbResult<SeuWithObjectiveStatement[]>> {
    try {
      const { rows } = await query<SeuWithObjectiveStatement>(
        `SELECT s.*, o.statement AS objective_statement
         FROM seus s
         JOIN objectives o ON o.id = s.objective_id
         WHERE $1::uuid IS NULL
            OR EXISTS (SELECT 1 FROM participants p JOIN participants_master pm ON pm.id = p.participant_id WHERE p.seu_id = s.id AND pm.user_id = $1)
         ORDER BY s.created_at DESC`,
        [viewerId ?? null]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[seusDB] listWithObjectiveStatement error", err as Error);
      return { error: err as Error };
    }
  },

  async count(): Promise<DbResult<number>> {
    try {
      const { rows } = await query<{ count: string }>("SELECT COUNT(*)::text AS count FROM seus");
      return { data: Number(rows[0]?.count ?? 0) };
    } catch (err) {
      logger.error("[seusDB] count error", err as Error);
      return { error: err as Error };
    }
  },
};
