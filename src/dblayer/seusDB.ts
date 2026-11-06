import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import { runPaginatedQuery, type ListParams } from "../utils/listQuery.js";
import type { CommissioningReport, DbResult, SeuLifecycleState, SeuRow } from "./seuTypes.js";

export interface SeuWithObjectiveStatement extends Pick<SeuRow, "id" | "objective_id" | "active_ebm_id" | "lifecycle_state" | "created_at"> {
  objective_statement: string;
}

const ACTIVE_LIFECYCLE_STATES: SeuLifecycleState[] = ["Initiated", "Validated", "Commissioned", "Configured", "Activated", "Operational", "Suspended"];

export const seusDB = {
  async create(input: {
    objectiveId: string;
    templateId: string;
    profileId: string;
    requestedBy: string;
    authorBadge: string;
    lifecycleState: SeuLifecycleState;
    tenantId?: string | null;
  }): Promise<DbResult<SeuRow>> {
    try {
      const { rows } = await query<SeuRow>(
        `INSERT INTO seus (objective_id, template_id, profile_id, requested_by, author_badge, lifecycle_state, tenant_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [input.objectiveId, input.templateId, input.profileId, input.requestedBy, input.authorBadge, input.lifecycleState, input.tenantId ?? null]
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

  async listWithObjectiveStatementPaginated(params: ListParams, viewerId?: string, tenantId?: string, lifecycleState?: string): Promise<{ items: SeuWithObjectiveStatement[]; total: number }> {
    const conds: string[] = [];
    const baseParams: unknown[] = [];
    if (viewerId) { baseParams.push(viewerId); conds.push(`EXISTS (SELECT 1 FROM participants p WHERE p.seu_id = s.id AND p.participant_id = $${baseParams.length})`); }
    if (tenantId) { baseParams.push(tenantId); conds.push(`s.tenant_id = $${baseParams.length}`); }
    if (lifecycleState) { baseParams.push(lifecycleState); conds.push(`s.lifecycle_state = $${baseParams.length}`); }
    return runPaginatedQuery<SeuWithObjectiveStatement>(
      {
        select: "s.id, s.objective_id, s.active_ebm_id, s.lifecycle_state, s.created_at, o.statement AS objective_statement",
        from: "seus s JOIN objectives o ON o.id = s.objective_id",
        searchColumns: ["o.statement", "s.lifecycle_state"],
        sortMap: { objective: "o.statement", state: "s.lifecycle_state", created: "s.created_at" },
        // viewerId is the session id, a participants_master id (the sign-in user's id for most users, the shared Demo User's for the Demo tenant).
        // A null tenantId (a root viewer) lists every tenant. Each filter is added only when set so the planner can use the indexes.
        baseWhere: conds.join(" AND ") || undefined,
        baseParams: baseParams,
      },
      params
    );
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
