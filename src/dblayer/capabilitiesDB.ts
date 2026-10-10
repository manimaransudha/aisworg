import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { CapabilityRow, DbResult } from "./seuTypes.js";

export const capabilitiesDB = {
  async upsertFromPack(input: {
    code: string;
    name: string;
    description?: string | null;
    version: string;
    originatingPackId: string;
    authorId: string;
    authorBadge: string;
  }): Promise<DbResult<CapabilityRow>> {
    try {
      const { rows } = await query<CapabilityRow>(
        `INSERT INTO capabilities (code, name, description, version, originating_pack_id, author_id, author_badge)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (originating_pack_id, code) DO UPDATE
           SET name = EXCLUDED.name, description = EXCLUDED.description, version = EXCLUDED.version,
               author_id = EXCLUDED.author_id, author_badge = EXCLUDED.author_badge
         RETURNING *`,
        [input.code, input.name, input.description ?? null, input.version, input.originatingPackId, input.authorId, input.authorBadge]
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
