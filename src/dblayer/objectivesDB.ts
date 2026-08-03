import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { CapabilityRow, DbResult, ObjectiveRow, ObjectiveStatus, ObjectiveTier } from "./seuTypes.js";

// Also owns the objective_capabilities join table (Ch.1 §10 — MVP declares
// required Capabilities explicitly rather than deriving them from a
// "Capability Pack", a Book 3 concept Ch.5's own taxonomy never defines).
export const objectivesDB = {
  async create(input: {
    statement: string;
    tier?: ObjectiveTier;
    status?: ObjectiveStatus;
    parentObjectiveId?: string | null;
    requestedBy?: number | null;
  }): Promise<DbResult<ObjectiveRow>> {
    try {
      const { rows } = await query<ObjectiveRow>(
        `INSERT INTO objectives (statement, tier, status, parent_objective_id, requested_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [input.statement, input.tier ?? "Engineering", input.status ?? "Active", input.parentObjectiveId ?? null, input.requestedBy ?? null]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[objectivesDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  async findById(id: string): Promise<DbResult<ObjectiveRow | null>> {
    try {
      const { rows } = await query<ObjectiveRow>("SELECT * FROM objectives WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[objectivesDB] findById error", err as Error);
      return { error: err as Error };
    }
  },

  async findAll(): Promise<DbResult<ObjectiveRow[]>> {
    try {
      const { rows } = await query<ObjectiveRow>("SELECT * FROM objectives ORDER BY created_at DESC");
      return { data: rows };
    } catch (err) {
      logger.error("[objectivesDB] findAll error", err as Error);
      return { error: err as Error };
    }
  },

  async findByStatuses(statuses: ObjectiveStatus[]): Promise<DbResult<ObjectiveRow[]>> {
    try {
      const { rows } = await query<ObjectiveRow>(
        "SELECT * FROM objectives WHERE status = ANY($1::text[]) ORDER BY created_at DESC",
        [statuses]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[objectivesDB] findByStatuses error", err as Error);
      return { error: err as Error };
    }
  },

  async findChildren(parentObjectiveId: string): Promise<DbResult<ObjectiveRow[]>> {
    try {
      const { rows } = await query<ObjectiveRow>(
        "SELECT * FROM objectives WHERE parent_objective_id = $1 ORDER BY created_at",
        [parentObjectiveId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[objectivesDB] findChildren error", err as Error);
      return { error: err as Error };
    }
  },

  async update(id: string, input: { statement?: string; tier?: ObjectiveTier }): Promise<DbResult<ObjectiveRow>> {
    try {
      const { rows } = await query<ObjectiveRow>(
        `UPDATE objectives
         SET statement = COALESCE($1, statement),
             tier = COALESCE($2, tier),
             version = version + 1,
             updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [input.statement ?? null, input.tier ?? null, id]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[objectivesDB] update error", err as Error);
      return { error: err as Error };
    }
  },

  async updateStatus(id: string, status: ObjectiveStatus): Promise<DbResult<ObjectiveRow>> {
    try {
      const { rows } = await query<ObjectiveRow>(
        "UPDATE objectives SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
        [status, id]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[objectivesDB] updateStatus error", err as Error);
      return { error: err as Error };
    }
  },

  async addCapabilities(objectiveId: string, capabilityIds: string[]): Promise<DbResult<void>> {
    try {
      for (const capabilityId of capabilityIds) {
        await query(
          `INSERT INTO objective_capabilities (objective_id, capability_id)
           VALUES ($1, $2)
           ON CONFLICT (objective_id, capability_id) DO NOTHING`,
          [objectiveId, capabilityId]
        );
      }
      return { data: undefined };
    } catch (err) {
      logger.error("[objectivesDB] addCapabilities error", err as Error);
      return { error: err as Error };
    }
  },

  async getRequiredCapabilities(objectiveId: string): Promise<DbResult<CapabilityRow[]>> {
    try {
      const { rows } = await query<CapabilityRow>(
        `SELECT c.* FROM capabilities c
         JOIN objective_capabilities oc ON oc.capability_id = c.id
         WHERE oc.objective_id = $1
         ORDER BY c.code`,
        [objectiveId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[objectivesDB] getRequiredCapabilities error", err as Error);
      return { error: err as Error };
    }
  },
};
