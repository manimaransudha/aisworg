import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
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
  }): Promise<DbResult<SeuRow>> {
    try {
      const { rows } = await query<SeuRow>(
        `INSERT INTO seus (objective_id, template_id, profile_id, requested_by)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [input.objectiveId, input.templateId, input.profileId, input.requestedBy ?? null]
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

  async listWithObjectiveStatement(): Promise<DbResult<SeuWithObjectiveStatement[]>> {
    try {
      const { rows } = await query<SeuWithObjectiveStatement>(
        `SELECT s.*, o.statement AS objective_statement
         FROM seus s
         JOIN objectives o ON o.id = s.objective_id
         ORDER BY s.created_at DESC`
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
