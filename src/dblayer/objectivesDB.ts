import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { CapabilityRow, DbResult, ObjectiveRow, ObjectiveTier } from "./seuTypes.js";

// Also owns the objective_capabilities join table (Ch.1 §10 — MVP declares
// required Capabilities explicitly rather than deriving them).
export const objectivesDB = {
  async create(input: { statement: string; tier?: ObjectiveTier; requestedBy?: number | null }): Promise<DbResult<ObjectiveRow>> {
    try {
      const { rows } = await query<ObjectiveRow>(
        `INSERT INTO objectives (statement, tier, requested_by)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [input.statement, input.tier ?? "Engineering", input.requestedBy ?? null]
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
