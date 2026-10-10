import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, SeuCapabilityRow } from "./seuTypes.js";

export interface SeuCapabilityWithCode extends SeuCapabilityRow {
  capability_code: string;
  capability_name: string;
}

export const seuCapabilitiesDB = {
  async createMany(seuId: string, capabilityIds: string[], authorId: string, authorBadge: string): Promise<DbResult<SeuCapabilityRow[]>> {
    try {
      const rows: SeuCapabilityRow[] = [];
      for (const capabilityId of capabilityIds) {
        const { rows: inserted } = await query<SeuCapabilityRow>(
          `INSERT INTO seu_capabilities (seu_id, capability_id, author_id, author_badge)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (seu_id, capability_id) DO NOTHING
           RETURNING *`,
          [seuId, capabilityId, authorId, authorBadge]
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

  async findBySeuIdAndCapabilityId(seuId: string, capabilityId: string): Promise<DbResult<SeuCapabilityRow | null>> {
    try {
      const { rows } = await query<SeuCapabilityRow>(
        "SELECT * FROM seu_capabilities WHERE seu_id = $1 AND capability_id = $2",
        [seuId, capabilityId]
      );
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[seuCapabilitiesDB] findBySeuIdAndCapabilityId error", err as Error);
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

  async markUnfulfilled(id: string): Promise<DbResult<SeuCapabilityRow>> {
    try {
      const { rows } = await query<SeuCapabilityRow>(
        "UPDATE seu_capabilities SET status = 'Unfulfilled' WHERE id = $1 RETURNING *",
        [id]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[seuCapabilitiesDB] markUnfulfilled error", err as Error);
      return { error: err as Error };
    }
  },

  async findUnfulfilledByCapability(): Promise<DbResult<Array<{ capability_id: string; capability_code: string; capability_name: string; seu_ids: string[] }>>> {
    try {
      const { rows } = await query<{ capability_id: string; capability_code: string; capability_name: string; seu_ids: string[] }>(
        `SELECT c.id AS capability_id, c.code AS capability_code, c.name AS capability_name,
                ARRAY_AGG(sc.seu_id ORDER BY s.created_at DESC) AS seu_ids
         FROM seu_capabilities sc
         JOIN capabilities c ON c.id = sc.capability_id
         JOIN seus s ON s.id = sc.seu_id
         WHERE sc.status = 'Unfulfilled'
         GROUP BY c.id, c.code, c.name`
      );
      return { data: rows };
    } catch (err) {
      logger.error("[seuCapabilitiesDB] findUnfulfilledByCapability error", err as Error);
      return { error: err as Error };
    }
  },
};
