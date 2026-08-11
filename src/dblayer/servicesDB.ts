import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, ServiceRow } from "./seuTypes.js";

export const servicesDB = {
  async upsertFromPack(input: {
    code: string;
    providingCapabilityId: string;
    name: string;
    contractDescription: string;
    serviceLevel?: Record<string, unknown>;
    originatingPackId: string;
  }): Promise<DbResult<ServiceRow>> {
    try {
      const { rows } = await query<ServiceRow>(
        `INSERT INTO services (code, providing_capability_id, name, contract_description, service_level, originating_pack_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (code) DO UPDATE
           SET providing_capability_id = EXCLUDED.providing_capability_id,
               name = EXCLUDED.name,
               contract_description = EXCLUDED.contract_description,
               service_level = EXCLUDED.service_level,
               originating_pack_id = EXCLUDED.originating_pack_id
         RETURNING *`,
        [
          input.code,
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

  // Participant Integration & Attestation — Plan step 4 (Resolution 9): the
  // per-Capability SLA rides on the Service Level's net-new `turnaround_time`.
  // Set the whole service_level JSONB (Ch.11 §8: turnaround_time, quality_bar,
  // availability, exceptions). Step 6's deployment-time contract config will
  // drive this per tenant; for now it lets an SLA be declared/updated directly.
  async setServiceLevel(id: string, serviceLevel: Record<string, unknown>): Promise<DbResult<ServiceRow>> {
    try {
      const { rows } = await query<ServiceRow>(
        "UPDATE services SET service_level = $1 WHERE id = $2 RETURNING *",
        [JSON.stringify(serviceLevel), id]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[servicesDB] setServiceLevel error", err as Error);
      return { error: err as Error };
    }
  },

  async findAll(): Promise<DbResult<ServiceRow[]>> {
    try {
      const { rows } = await query<ServiceRow>("SELECT * FROM services ORDER BY name");
      return { data: rows };
    } catch (err) {
      logger.error("[servicesDB] findAll error", err as Error);
      return { error: err as Error };
    }
  },
};
