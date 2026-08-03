import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, SeuCapabilityRow } from "./seuTypes.js";

export interface SeuCapabilityWithCode extends SeuCapabilityRow {
  capability_code: string;
  capability_name: string;
}

export const seuCapabilitiesDB = {
  async createMany(seuId: string, capabilityIds: string[]): Promise<DbResult<SeuCapabilityRow[]>> {
    try {
      const rows: SeuCapabilityRow[] = [];
      for (const capabilityId of capabilityIds) {
        const { rows: inserted } = await query<SeuCapabilityRow>(
          `INSERT INTO seu_capabilities (seu_id, capability_id)
           VALUES ($1, $2)
           ON CONFLICT (seu_id, capability_id) DO NOTHING
           RETURNING *`,
          [seuId, capabilityId]
        );
        if (inserted[0]) rows.push(inserted[0]);
      }
      return { data: rows };
    } catch (err) {
      logger.error("[seuCapabilitiesDB] createMany error", err as Error);
      return { error: err as Error };
    }
  },

  async findById(id: string): Promise<DbResult<SeuCapabilityRow | null>> {
    try {
      const { rows } = await query<SeuCapabilityRow>("SELECT * FROM seu_capabilities WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[seuCapabilitiesDB] findById error", err as Error);
      return { error: err as Error };
    }
  },

  async findBySeuId(seuId: string): Promise<DbResult<SeuCapabilityWithCode[]>> {
    try {
      const { rows } = await query<SeuCapabilityWithCode>(
        `SELECT sc.*, c.code AS capability_code, c.name AS capability_name
         FROM seu_capabilities sc
         JOIN capabilities c ON c.id = sc.capability_id
         WHERE sc.seu_id = $1
         ORDER BY c.code`,
        [seuId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[seuCapabilitiesDB] findBySeuId error", err as Error);
      return { error: err as Error };
    }
  },

  async markFulfilled(id: string): Promise<DbResult<SeuCapabilityRow>> {
    try {
      const { rows } = await query<SeuCapabilityRow>(
        "UPDATE seu_capabilities SET status = 'Fulfilled' WHERE id = $1 RETURNING *",
        [id]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[seuCapabilitiesDB] markFulfilled error", err as Error);
      return { error: err as Error };
    }
  },
};
