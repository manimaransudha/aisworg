import pool, { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, ServiceRow, ServiceLevelExpectation } from "./seuTypes.js";

// CR-064 — real, definition-side versioning, same "major.minor" bump-on-
// change mechanism as Quality Gate (qualityGatesDB.ts's own bumpVersion) —
// not an author-typed field. Real identity is (originating_pack_id, code);
// version starts at "1.0" and bumps the minor component on every real
// content change.
function bumpVersion(version: string): string {
  const [major, minor] = version.split(".").map((n) => parseInt(n, 10) || 0);
  return `${major}.${minor + 1}`;
}

export const servicesDB = {
  // Transactional: reads the current active row for this exact slot
  // (originating_pack_id, code), decides whether anything actually changed,
  // and either no-ops, inserts the first version, or deactivates the old row
  // + inserts the next version — all in one commit (same discipline
  // qualityGatesDB.upsert established). The partial unique index
  // services_active_pack_code_key (migration 112) is what makes this lookup
  // unambiguous: at most one active row can ever exist per slot.
  async upsertFromPack(input: {
    code: string;
    providingCapabilityId: string;
    name: string;
    contractDescription: string;
    serviceLevel?: ServiceLevelExpectation[];
    originatingPackId: string;
  }): Promise<DbResult<ServiceRow>> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const serviceLevel = input.serviceLevel ?? [];
      const { rows: currentRows } = await client.query<ServiceRow>(
        "SELECT * FROM services WHERE originating_pack_id = $1 AND code = $2 AND is_active = true",
        [input.originatingPackId, input.code]
      );
      const current = currentRows[0];
      const unchanged =
        current &&
        current.providing_capability_id === input.providingCapabilityId &&
        current.name === input.name &&
        current.contract_description === input.contractDescription &&
        JSON.stringify(current.service_level) === JSON.stringify(serviceLevel);
      if (unchanged) {
        await client.query("COMMIT");
        return { data: current };
      }
      const nextVersion = current ? bumpVersion(current.version) : "1.0";
      if (current) {
        await client.query("UPDATE services SET is_active = false WHERE id = $1", [current.id]);
      }
      const { rows } = await client.query<ServiceRow>(
        `INSERT INTO services (code, providing_capability_id, name, contract_description, service_level, originating_pack_id, version, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)
         RETURNING *`,
        [
          input.code,
          input.providingCapabilityId,
          input.name,
          input.contractDescription,
          JSON.stringify(serviceLevel),
          input.originatingPackId,
          nextVersion,
        ]
      );
      await client.query("COMMIT");
      return { data: rows[0] };
    } catch (err) {
      await client.query("ROLLBACK");
      logger.error("[servicesDB] upsertFromPack error", err as Error);
      return { error: err as Error };
    } finally {
      client.release();
    }
  },

  async findByCapabilityId(capabilityId: string): Promise<DbResult<ServiceRow[]>> {
    try {
      const { rows } = await query<ServiceRow>("SELECT * FROM services WHERE providing_capability_id = $1 AND is_active = true", [capabilityId]);
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

  async findAll(): Promise<DbResult<ServiceRow[]>> {
    try {
      const { rows } = await query<ServiceRow>("SELECT * FROM services WHERE is_active = true ORDER BY name");
      return { data: rows };
    } catch (err) {
      logger.error("[servicesDB] findAll error", err as Error);
      return { error: err as Error };
    }
  },
};
