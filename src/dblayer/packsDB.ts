import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, PackCategory, PackClassification, PackContributions, PackRow } from "./seuTypes.js";

export const packsDB = {
  async upsert(input: {
    code: string;
    name: string;
    category: PackCategory;
    packVersion: string;
    installationClassification?: PackClassification;
    contributions: PackContributions;
    dependencies?: Array<{ packCode: string; version: string; type: "required" }>;
  }): Promise<DbResult<PackRow>> {
    try {
      const { rows } = await query<PackRow>(
        `INSERT INTO packs (code, name, category, pack_version, installation_classification, contributions, dependencies)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (code) DO UPDATE
           SET name = EXCLUDED.name, category = EXCLUDED.category, pack_version = EXCLUDED.pack_version,
               installation_classification = EXCLUDED.installation_classification,
               contributions = EXCLUDED.contributions, dependencies = EXCLUDED.dependencies
         RETURNING *`,
        [
          input.code,
          input.name,
          input.category,
          input.packVersion,
          input.installationClassification ?? "Mandatory",
          JSON.stringify(input.contributions),
          JSON.stringify(input.dependencies ?? []),
        ]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[packsDB] upsert error", err as Error);
      return { error: err as Error };
    }
  },

  async findByCode(code: string): Promise<DbResult<PackRow | null>> {
    try {
      const { rows } = await query<PackRow>("SELECT * FROM packs WHERE code = $1", [code]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[packsDB] findByCode error", err as Error);
      return { error: err as Error };
    }
  },

  async findById(id: string): Promise<DbResult<PackRow | null>> {
    try {
      const { rows } = await query<PackRow>("SELECT * FROM packs WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[packsDB] findById error", err as Error);
      return { error: err as Error };
    }
  },

  async findByIds(ids: string[]): Promise<DbResult<PackRow[]>> {
    try {
      const { rows } = await query<PackRow>("SELECT * FROM packs WHERE id = ANY($1::uuid[])", [ids]);
      return { data: rows };
    } catch (err) {
      logger.error("[packsDB] findByIds error", err as Error);
      return { error: err as Error };
    }
  },

  async findAll(): Promise<DbResult<PackRow[]>> {
    try {
      const { rows } = await query<PackRow>("SELECT * FROM packs ORDER BY category, code");
      return { data: rows };
    } catch (err) {
      logger.error("[packsDB] findAll error", err as Error);
      return { error: err as Error };
    }
  },

  async count(): Promise<DbResult<number>> {
    try {
      const { rows } = await query<{ count: string }>("SELECT COUNT(*)::text AS count FROM packs");
      return { data: Number(rows[0]?.count ?? 0) };
    } catch (err) {
      logger.error("[packsDB] count error", err as Error);
      return { error: err as Error };
    }
  },
};
