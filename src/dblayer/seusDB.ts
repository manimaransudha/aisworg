import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import { runPaginatedQuery, type ListParams } from "../utils/listQuery.js";
import type { CommissioningReport, DbResult, SeuLifecycleState, SeuRow } from "./seuTypes.js";

export interface SeuWithObjectiveStatement extends SeuRow {
  objective_statement: string;
}

export const seusDB = {
  async create(input: {
    objectiveId: string;
    templateId: string;
    profileId: string;
    requestedBy?: number | null;
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

  // CR-003: the set of Objective ids that already have an SEU — lets the
  // Objectives list mark which are commissioned (and hide the Commission action).
  async commissionedObjectiveIds(): Promise<DbResult<string[]>> {
    try {
      const { rows } = await query<{ objective_id: string }>("SELECT DISTINCT objective_id FROM seus");
      return { data: rows.map((r) => r.objective_id) };
    } catch (err) {
      logger.error("[seusDB] commissionedObjectiveIds error", err as Error);
      return { error: err as Error };
    }
  },

  // CR-002: the SEU (if any) commissioned against a given Objective. With the
  // UNIQUE index on objective_id there is at most one; commissioning uses this
  // for a friendly "already assigned" rejection ahead of the DB constraint.
  async findByObjectiveId(objectiveId: string): Promise<DbResult<SeuRow | null>> {
    try {
      const { rows } = await query<SeuRow>("SELECT * FROM seus WHERE objective_id = $1 LIMIT 1", [objectiveId]);
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

  // SDK UI Layer Plan ("SEU Registry visibility") — a viewer sees a SEU if
  // they requested it or are a Participant on it, not every SEU. Platform/
  // Tenant Admin badge holders bypass the filter (viewerId undefined),
  // same exception pattern as Identity Management.
  // Paginated / searchable / sortable variant for the SEUs list view (List UI
  // Requirements). Same viewer scoping as listWithObjectiveStatement.
  async listWithObjectiveStatementPaginated(params: ListParams, viewerId?: number): Promise<{ items: SeuWithObjectiveStatement[]; total: number }> {
    return runPaginatedQuery<SeuWithObjectiveStatement>(
      {
        select: "s.*, o.statement AS objective_statement",
        from: "seus s JOIN objectives o ON o.id = s.objective_id",
        searchColumns: ["o.statement", "s.lifecycle_state", "s.id::text"],
        sortMap: { objective: "o.statement", state: "s.lifecycle_state", created: "s.created_at" },
        baseWhere: "$1::int IS NULL OR s.requested_by = $1 OR EXISTS (SELECT 1 FROM participants p WHERE p.seu_id = s.id AND p.user_id = $1)",
        baseParams: [viewerId ?? null],
      },
      params
    );
  },

  async listWithObjectiveStatement(viewerId?: number): Promise<DbResult<SeuWithObjectiveStatement[]>> {
    try {
      const { rows } = await query<SeuWithObjectiveStatement>(
        `SELECT s.*, o.statement AS objective_statement
         FROM seus s
         JOIN objectives o ON o.id = s.objective_id
         WHERE $1::int IS NULL
            OR s.requested_by = $1
            OR EXISTS (SELECT 1 FROM participants p WHERE p.seu_id = s.id AND p.user_id = $1)
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
