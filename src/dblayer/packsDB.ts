import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import { schemaDefinitionsDB } from "./schemaDefinitionsDB.js";
import { validatePackWriteAgainstSchema } from "../routes/seu/core/packWriteValidator.js";
import type { DbResult, PackCategory, PackClassification, PackCommentRow, PackContributions, PackRow, PackStatus } from "./seuTypes.js";
import { getPlatformTenantId } from "./constants.js";
 
export const packsDB = {
  async create(input: {
    code: string;
    name: string;
    category: PackCategory;
    packVersion: string;
    installationClassification?: PackClassification;
    contributions: PackContributions;
    dependencies?: Array<{ packCode: string; version: string; type: "required" | "optional" | "conditional" | "incompatible" }>;
    compositionSources?: Array<{ packCode: string }>;
    metadata?: Record<string, unknown>;
    authoredBy: string;
    authorBadge: string;
    tenantId: string;
    schemaDefinitionId: string;
  }): Promise<DbResult<PackRow>> {
    try {
      const installationClassification = input.installationClassification || "Mandatory";

      const errors = await validatePackWriteAgainstSchema({
        code: input.code,
        name: input.name,
        category: input.category,
        packVersion: input.packVersion,
        installationClassification,
        contributions: input.contributions,
        compositionStrategy: (input.metadata as Record<string, unknown> | undefined)?.compositionStrategy as string | undefined,
        tenantId: input.tenantId,
        schemaDefinitionId: input.schemaDefinitionId,
      });
      if (errors.length > 0) return { error: new Error(errors.join("; ")) };

      const { data: schemaRow } = await schemaDefinitionsDB.findById(input.schemaDefinitionId);
      if (!schemaRow) return { error: new Error(`schema_definitions row "${input.schemaDefinitionId}" not found`) };

      const { rows } = await query<PackRow>(
        `INSERT INTO packs (code, name, category, pack_version, status, installation_classification, contributions, dependencies, composition_sources, metadata, authored_by, author_badge, tenant_id, schema_definition_id)
         VALUES ($1, $2, $3, $4, 'Draft', $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [
          input.code,
          input.name,
          input.category,
          input.packVersion,
          installationClassification,
          JSON.stringify(input.contributions),
          JSON.stringify(input.dependencies ?? []),
          JSON.stringify(input.compositionSources ?? []),
          JSON.stringify(input.metadata ?? {}),
          input.authoredBy,
          input.authorBadge,
          input.tenantId,
          schemaRow?.id ?? null,
        ]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[packsDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  async updateDraftContent(id: string, input: {
    code: string;
    name: string;
    category: PackCategory;
    packVersion: string;
    installationClassification?: PackClassification;
    contributions: PackContributions;
    dependencies?: Array<{ packCode: string; version: string; type: "required" | "optional" | "conditional" | "incompatible" }>;
    compositionSources?: Array<{ packCode: string }>;
    metadata?: Record<string, unknown>;
  }): Promise<DbResult<PackRow>> {
    try {
      const { rows: existingRows } = await query<{ schema_definition_id: string | null; tenant_id: string }>(
        "SELECT schema_definition_id, tenant_id FROM packs WHERE id = $1", [id]
      );

      const installationClassification = input.installationClassification || "Mandatory";

      const errors = await validatePackWriteAgainstSchema({
        id,
        code: input.code,
        name: input.name,
        category: input.category,
        packVersion: input.packVersion,
        installationClassification,
        contributions: input.contributions,
        compositionStrategy: (input.metadata as Record<string, unknown> | undefined)?.compositionStrategy as string | undefined,
        tenantId: existingRows[0]?.tenant_id,
        schemaDefinitionId: existingRows[0]?.schema_definition_id ?? null,
      });
      if (errors.length > 0) return { error: new Error(errors.join("; ")) };

      const { rows } = await query<PackRow>(
        `UPDATE packs SET code = $10, name = $2, category = $3, pack_version = $4, installation_classification = $5, contributions = $6, dependencies = $7, composition_sources = $8, metadata = $9
         WHERE id = $1 AND status = 'Draft'
         RETURNING *`,
        [
          id,
          input.name,
          input.category,
          input.packVersion,
          installationClassification,
          JSON.stringify(input.contributions),
          JSON.stringify(input.dependencies ?? []),
          JSON.stringify(input.compositionSources ?? []),
          JSON.stringify(input.metadata ?? {}),
          input.code,
        ]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[packsDB] updateDraftContent error", err as Error);
      return { error: err as Error };
    }
  },

  async findByStatusActedBy(status: PackStatus, authorityBadge: string, actorId: number | null): Promise<DbResult<PackRow[]>> {
    try {
      const { rows } = actorId == null
        ? await query<PackRow>(
            `SELECT DISTINCT p.* FROM packs p
             JOIN events e ON e.originating_object_type = 'Pack' AND e.originating_object_id = p.id
             WHERE p.status = $1 AND e.authority_badge = $2
             ORDER BY p.created_at DESC`,
            [status, authorityBadge]
          )
        : await query<PackRow>(
            `SELECT DISTINCT p.* FROM packs p
             JOIN events e ON e.originating_object_type = 'Pack' AND e.originating_object_id = p.id
             WHERE p.status = $1 AND e.authority_badge = $2 AND e.actor_id = $3
             ORDER BY p.created_at DESC`,
            [status, authorityBadge, String(actorId)]
          );
      return { data: rows };
    } catch (err) {
      logger.error("[packsDB] findByStatusActedBy error", err as Error);
      return { error: err as Error };
    }
  },

  async findByStatus(status: PackStatus, viewerTenantId: string | null): Promise<DbResult<PackRow[]>> {
    const PLATFORM_TENANT_ID = await getPlatformTenantId();
    try {
      const { rows } = viewerTenantId == null
        ? await query<PackRow>("SELECT * FROM packs WHERE status = $1 ORDER BY created_at DESC", [status])
        : await query<PackRow>(
            "SELECT * FROM packs WHERE status = $1 AND (tenant_id = $2 OR tenant_id = $3) ORDER BY created_at DESC",
            [status, PLATFORM_TENANT_ID, viewerTenantId]
          );
      return { data: rows };
    } catch (err) {
      logger.error("[packsDB] findByStatus error", err as Error);
      return { error: err as Error };
    }
  },

  async findDrafts(authoredBy?: number | null): Promise<DbResult<PackRow[]>> {
    try {
      const { rows } = authoredBy == null
        ? await query<PackRow>("SELECT * FROM packs WHERE status IN ('Draft', 'Validated') ORDER BY created_at DESC")
        : await query<PackRow>("SELECT * FROM packs WHERE status IN ('Draft', 'Validated') AND authored_by = $1 ORDER BY created_at DESC", [authoredBy]);
      return { data: rows };
    } catch (err) {
      logger.error("[packsDB] findDrafts error", err as Error);
      return { error: err as Error };
    }
  },

  async findByCodeAndVersion(code: string, packVersion: string, tenantId?: string): Promise<DbResult<PackRow | null>> {
    try {
      const { rows } = tenantId == null
        ? await query<PackRow>("SELECT * FROM packs WHERE code = $1 AND pack_version = $2", [code, packVersion])
        : await query<PackRow>("SELECT * FROM packs WHERE code = $1 AND pack_version = $2 AND tenant_id = $3", [code, packVersion, tenantId]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[packsDB] findByCodeAndVersion error", err as Error);
      return { error: err as Error };
    }
  },

  async findByCode(code: string): Promise<DbResult<PackRow | null>> {
    try {
      const { rows } = await query<PackRow>("SELECT * FROM packs WHERE code = $1 ORDER BY created_at DESC LIMIT 1", [code]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[packsDB] findByCode error", err as Error);
      return { error: err as Error };
    }
  },

  async findActiveByCode(code: string, tenantId?: string): Promise<DbResult<PackRow | null>> {
    try {
      const { rows } = tenantId == null
        ? await query<PackRow>("SELECT * FROM packs WHERE code = $1 AND status = 'Active' ORDER BY created_at DESC LIMIT 1", [code])
        : await query<PackRow>("SELECT * FROM packs WHERE code = $1 AND status = 'Active' AND tenant_id = $2 ORDER BY created_at DESC LIMIT 1", [code, tenantId]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[packsDB] findActiveByCode error", err as Error);
      return { error: err as Error };
    }
  },

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

  async findAll(): Promise<DbResult<PackRow[]>> {
    try {
      const { rows } = await query<PackRow>("SELECT * FROM packs ORDER BY category, code, created_at DESC");
      return { data: rows };
    } catch (err) {
      logger.error("[packsDB] findAll error", err as Error);
      return { error: err as Error };
    }
  },

  async findAllVisibleTo(viewerTenantId: string): Promise<DbResult<PackRow[]>> {
    const PLATFORM_TENANT_ID = await getPlatformTenantId();
    try {
      const { rows } = await query<PackRow>(
        "SELECT * FROM packs WHERE tenant_id = $1 OR tenant_id = $2 ORDER BY category, code, created_at DESC",
        [PLATFORM_TENANT_ID, viewerTenantId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[packsDB] findAllVisibleTo error", err as Error);
      return { error: err as Error };
    }
  },

  async findAllForTenant(tenantId: string): Promise<DbResult<PackRow[]>> {
    try {
      const { rows } = await query<PackRow>("SELECT * FROM packs WHERE tenant_id = $1 ORDER BY code, created_at DESC", [tenantId]);
      return { data: rows };
    } catch (err) {
      logger.error("[packsDB] findAllForTenant error", err as Error);
      return { error: err as Error };
    }
  },

  async findActiveVisibleTo(viewerTenantId: string): Promise<DbResult<PackRow[]>> {
    const PLATFORM_TENANT_ID = await getPlatformTenantId();
    try {
      const { rows } = await query<PackRow>(
        "SELECT * FROM packs WHERE status = 'Active' AND (tenant_id = $1 OR tenant_id = $2) ORDER BY code",
        [PLATFORM_TENANT_ID, viewerTenantId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[packsDB] findActiveVisibleTo error", err as Error);
      return { error: err as Error };
    }
  },

  async findActiveMandatoryVisibleTo(viewerTenantId: string): Promise<DbResult<PackRow[]>> {
    const PLATFORM_TENANT_ID = await getPlatformTenantId();
    try {
      const { rows } = await query<PackRow>(
        "SELECT * FROM packs WHERE status = 'Active' AND installation_classification = 'Mandatory' AND (tenant_id = $1 OR tenant_id = $2) ORDER BY code",
        [PLATFORM_TENANT_ID, viewerTenantId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[packsDB] findActiveMandatoryVisibleTo error", err as Error);
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

  async addComment(packId: string, actorId: string, commentText: string): Promise<DbResult<PackCommentRow>> {
    try {
      const { rows } = await query<PackCommentRow>(
        `INSERT INTO pack_comments (pack_id, actor_id, comment_text)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [packId, actorId, commentText]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[packsDB] addComment error", err as Error);
      return { error: err as Error };
    }
  },

  async getComments(packId: string): Promise<DbResult<PackCommentRow[]>> {
    try {
      const { rows } = await query<PackCommentRow>(
        "SELECT * FROM pack_comments WHERE pack_id = $1 ORDER BY created_at",
        [packId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[packsDB] getComments error", err as Error);
      return { error: err as Error };
    }
  },
};
