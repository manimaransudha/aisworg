import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { CapabilityRow, DbResult } from "./seuTypes.js";

export const capabilitiesDB = {
  // CR-065 — (originating_pack_id, code) is the real identity now, not a
  // bare global-unique code (owner: "This is already implemented in pack
  // model" — same mechanical fix Checklist/Policy/Service already got; no
  // FK references `code` directly, so this touches nothing else). `version`
  // is a copy of the owning Pack's own pack_version, not independently
  // incremented (owner: "capabilities.version just copies over the pack's
  // version") — the caller passes it through from the real PackRow.
  async upsertFromPack(input: {
    code: string;
    name: string;
    description?: string | null;
    version: string;
    originatingPackId: string;
  }): Promise<DbResult<CapabilityRow>> {
    try {
      const { rows } = await query<CapabilityRow>(
        `INSERT INTO capabilities (code, name, description, version, originating_pack_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (originating_pack_id, code) DO UPDATE
           SET name = EXCLUDED.name, description = EXCLUDED.description, version = EXCLUDED.version
         RETURNING *`,
        [input.code, input.name, input.description ?? null, input.version, input.originatingPackId]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[capabilitiesDB] upsertFromPack error", err as Error);
      return { error: err as Error };
    }
  },

  async findByCodes(codes: string[]): Promise<DbResult<CapabilityRow[]>> {
    try {
      const { rows } = await query<CapabilityRow>("SELECT * FROM capabilities WHERE code = ANY($1::text[])", [codes]);
      return { data: rows };
    } catch (err) {
      logger.error("[capabilitiesDB] findByCodes error", err as Error);
      return { error: err as Error };
    }
  },

  async findById(id: string): Promise<DbResult<CapabilityRow | null>> {
    try {
      const { rows } = await query<CapabilityRow>("SELECT * FROM capabilities WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[capabilitiesDB] findById error", err as Error);
      return { error: err as Error };
    }
  },

  // CR-038 — "Required Capability codes... derived from the [Pack]
  // selections the user makes." Given the Active Pack rows a Template's
  // selected codes resolve to, every Capability those Packs contributed
  // (originating_pack_id) is the derived requiredCapabilityCodes set.
  async findByOriginatingPackIds(packIds: string[]): Promise<DbResult<CapabilityRow[]>> {
    try {
      const { rows } = await query<CapabilityRow>("SELECT * FROM capabilities WHERE originating_pack_id = ANY($1::uuid[])", [packIds]);
      return { data: rows };
    } catch (err) {
      logger.error("[capabilitiesDB] findByOriginatingPackIds error", err as Error);
      return { error: err as Error };
    }
  },

  async findAll(): Promise<DbResult<CapabilityRow[]>> {
    try {
      const { rows } = await query<CapabilityRow>("SELECT * FROM capabilities ORDER BY code");
      return { data: rows };
    } catch (err) {
      logger.error("[capabilitiesDB] findAll error", err as Error);
      return { error: err as Error };
    }
  },
};
