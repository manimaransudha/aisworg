import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, PackCategory, PackClassification, PackContributions, PackRow, PackStatus } from "./seuTypes.js";

export const packsDB = {
  // Ch.41 VM-002 "Versions are immutable" — a plain INSERT, no ON CONFLICT
  // DO UPDATE. (code, pack_version) is the unique identity (010_pack_lifecycle.sql);
  // publishing a new version of an existing code creates a new row rather
  // than mutating the old one. Callers that need rerun-safety (the seed
  // script, the SDK CLI) check findByCodeAndVersion first and treat an
  // existing exact-version row as a no-op, not an error — see core/packs.ts's
  // publishPack.
  async create(input: {
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
        `INSERT INTO packs (code, name, category, pack_version, status, installation_classification, contributions, dependencies)
         VALUES ($1, $2, $3, $4, 'Draft', $5, $6, $7)
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
      logger.error("[packsDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  async findByCodeAndVersion(code: string, packVersion: string): Promise<DbResult<PackRow | null>> {
    try {
      const { rows } = await query<PackRow>("SELECT * FROM packs WHERE code = $1 AND pack_version = $2", [code, packVersion]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[packsDB] findByCodeAndVersion error", err as Error);
      return { error: err as Error };
    }
  },

  // Latest-published-row-for-this-code lookup — used where the MVP only
  // ever cares about "the" pack (dependency resolution, dashboard counts,
  // the couple of existing tests written before multi-version Packs existed).
  // "Latest" is by created_at, not a semver comparison — this MVP publishes
  // versions in order and doesn't need out-of-order backfill.
  async findByCode(code: string): Promise<DbResult<PackRow | null>> {
    try {
      const { rows } = await query<PackRow>("SELECT * FROM packs WHERE code = $1 ORDER BY created_at DESC LIMIT 1", [code]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[packsDB] findByCode error", err as Error);
      return { error: err as Error };
    }
  },

  // The one row (if any) currently Active for a code — publishPack's
  // supersede step uses this to find what a newly-activated version replaces.
  async findActiveByCode(code: string): Promise<DbResult<PackRow | null>> {
    try {
      const { rows } = await query<PackRow>("SELECT * FROM packs WHERE code = $1 AND status = 'Active' ORDER BY created_at DESC LIMIT 1", [code]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[packsDB] findActiveByCode error", err as Error);
      return { error: err as Error };
    }
  },

  // Full immutable version history for a code — the Pack Registry screen's
  // version-history display (Ch.38 §10 "version lookup").
  async findVersionsByCode(code: string): Promise<DbResult<PackRow[]>> {
    try {
      const { rows } = await query<PackRow>("SELECT * FROM packs WHERE code = $1 ORDER BY created_at DESC", [code]);
      return { data: rows };
    } catch (err) {
      logger.error("[packsDB] findVersionsByCode error", err as Error);
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

  // Registry listing (Ch.38 §10) — every Version of every Pack, newest first
  // within each code so the web page can group version history per code.
  async findAll(): Promise<DbResult<PackRow[]>> {
    try {
      const { rows } = await query<PackRow>("SELECT * FROM packs ORDER BY category, code, created_at DESC");
      return { data: rows };
    } catch (err) {
      logger.error("[packsDB] findAll error", err as Error);
      return { error: err as Error };
    }
  },

  async updateStatus(id: string, status: PackStatus): Promise<DbResult<PackRow>> {
    try {
      const { rows } = await query<PackRow>("UPDATE packs SET status = $1 WHERE id = $2 RETURNING *", [status, id]);
      return { data: rows[0] };
    } catch (err) {
      logger.error("[packsDB] updateStatus error", err as Error);
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
