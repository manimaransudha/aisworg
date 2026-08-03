import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, ServiceRow } from "./seuTypes.js";

export const servicesDB = {
  async upsertFromPack(input: {
    providingCapabilityId: string;
    name: string;
    contractDescription: string;
    serviceLevel?: Record<string, unknown>;
    originatingPackId: string;
  }): Promise<DbResult<ServiceRow>> {
    try {
      const { rows } = await query<ServiceRow>(
        `INSERT INTO services (providing_capability_id, name, contract_description, service_level, originating_pack_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          input.providingCapabilityId,
          input.name,
          input.contractDescription,
          JSON.stringify(input.serviceLevel ?? {}),
          input.originatingPackId,
        ]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[servicesDB] upsertFromPack error", err as Error);
      return { error: err as Error };
    }
  },

  async findByCapabilityId(capabilityId: string): Promise<DbResult<ServiceRow[]>> {
    try {
      const { rows } = await query<ServiceRow>("SELECT * FROM services WHERE providing_capability_id = $1", [capabilityId]);
      return { data: rows };
    } catch (err) {
      logger.error("[servicesDB] findByCapabilityId error", err as Error);
      return { error: err as Error };
    }
  },

  async findById(id: string): Promise<DbResult<ServiceRow | null>> {
    try {
      const { rows } = await query<ServiceRow>("SELECT * FROM services WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[servicesDB] findById error", err as Error);
      return { error: err as Error };
    }
  },
};
