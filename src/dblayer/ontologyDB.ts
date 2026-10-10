import { query, bulkInsert } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import { getPlatformTenantId, PLATFORM_TENANT_NAME } from "./constants.js";
import { userDB } from "./userDB.js";
import type { DbResult, OntologyConceptRow, OntologyConceptCommentRow, TenantConceptAliasRow } from "./seuTypes.js";
import { tenantsDB } from "./tenantsDB.js"

export interface OntologyViewer { isRoot: boolean; tenantId: string | null }

async function visibleTenantIds(viewer: OntologyViewer): Promise<string[] | null> {
  if (viewer.isRoot) return null;
  const PLATFORM_TENANT_ID = await getPlatformTenantId();
  const ids = new Set([PLATFORM_TENANT_ID]);
  if (viewer.tenantId) ids.add(viewer.tenantId);
  return [...ids];
}

export const ontologyDB = {
  async findConcept(conceptType: string, code: string, viewer: OntologyViewer): Promise<DbResult<OntologyConceptRow | null>> {
    try {
      const tenantIds = await visibleTenantIds(viewer);
      const { rows } = tenantIds
        ? await query<OntologyConceptRow>(
            "SELECT * FROM ontology_concepts WHERE concept_type = $1 AND code = $2 AND status = 'Active' AND tenant_id = ANY($3::uuid[]) ORDER BY (tenant_id = $4) DESC LIMIT 1",
            [conceptType, code, tenantIds, viewer.tenantId ?? tenantIds[0]]
          )
        : await query<OntologyConceptRow>("SELECT * FROM ontology_concepts WHERE concept_type = $1 AND code = $2 AND status = 'Active' LIMIT 1", [conceptType, code]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[ontologyDB] findConcept error", err as Error);
      return { error: err as Error };
    }
  },

  async findActiveConcept(conceptType: string, code: string, tenantId: string): Promise<DbResult<OntologyConceptRow | null>> {
    try {
      const { rows } = await query<OntologyConceptRow>(
        "SELECT * FROM ontology_concepts WHERE concept_type = $1 AND code = $2 AND tenant_id = $3 AND status = 'Active' LIMIT 1",
        [conceptType, code, tenantId]
      );
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[ontologyDB] findActiveConcept error", err as Error);
      return { error: err as Error };
    }
  },

  async findConceptById(id: string): Promise<DbResult<OntologyConceptRow | null>> {
    try {
      const { rows } = await query<OntologyConceptRow>("SELECT * FROM ontology_concepts WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[ontologyDB] findConceptById error", err as Error);
      return { error: err as Error };
    }
  },

  async findLatestVersion(conceptType: string, code: string, tenantId: string): Promise<DbResult<OntologyConceptRow | null>> {
    try {
      const { rows } = await query<OntologyConceptRow>(
        "SELECT * FROM ontology_concepts WHERE concept_type = $1 AND code = $2 AND tenant_id = $3 ORDER BY created_at DESC LIMIT 1",
        [conceptType, code, tenantId]
      );
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[ontologyDB] findLatestVersion error", err as Error);
      return { error: err as Error };
    }
  },

  async findConceptByCodeAndVersion(conceptType: string, code: string, tenantId: string, version: string): Promise<DbResult<OntologyConceptRow | null>> {
    try {
      const { rows } = await query<OntologyConceptRow>(
        "SELECT * FROM ontology_concepts WHERE concept_type = $1 AND code = $2 AND tenant_id = $3 AND version = $4 LIMIT 1",
        [conceptType, code, tenantId, version]
      );
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[ontologyDB] findConceptByCodeAndVersion error", err as Error);
      return { error: err as Error };
    }
  },

  async findConceptsByType(conceptType: string, viewer: OntologyViewer, opts?: { includeInactive?: boolean }): Promise<DbResult<OntologyConceptRow[]>> {
    try {
      const tenantIds = await visibleTenantIds(viewer);
      const activeClause = opts?.includeInactive ? "" : " AND status = 'Active'";
      const order = opts?.includeInactive ? "ORDER BY code, version DESC" : "ORDER BY code";
      const { rows } = tenantIds
        ? await query<OntologyConceptRow>(
            `SELECT * FROM ontology_concepts WHERE concept_type = $1 AND tenant_id = ANY($2::uuid[])${activeClause} ${order}`,
            [conceptType, tenantIds]
          )
        : await query<OntologyConceptRow>(`SELECT * FROM ontology_concepts WHERE concept_type = $1${activeClause} ${order}`, [conceptType]);
      return { data: rows };
    } catch (err) {
      logger.error("[ontologyDB] findConceptsByType error", err as Error);
      return { error: err as Error };
    }
  },

  async listDistinctConceptTypes(viewer: OntologyViewer): Promise<DbResult<string[]>> {
    try {
      const tenantIds = await visibleTenantIds(viewer);
      const { rows } = tenantIds
        ? await query<{ concept_type: string }>("SELECT DISTINCT concept_type FROM ontology_concepts WHERE tenant_id = ANY($1::uuid[]) ORDER BY concept_type", [tenantIds])
        : await query<{ concept_type: string }>("SELECT DISTINCT concept_type FROM ontology_concepts ORDER BY concept_type");
      return { data: rows.map((r) => r.concept_type) };
    } catch (err) {
      logger.error("[ontologyDB] listDistinctConceptTypes error", err as Error);
      return { error: err as Error };
    }
  },

  async findConceptTypeUiGroupings(viewer: OntologyViewer): Promise<DbResult<Array<{ concept_type: string; ui_grouping: string }>>> {
    try {
      const tenantIds = await visibleTenantIds(viewer);
      const { rows } = tenantIds
        ? await query<{ concept_type: string; ui_grouping: string }>(
            `SELECT DISTINCT concept_type, ui_grouping FROM ontology_concepts
             WHERE ui_grouping IS NOT NULL AND status = 'Active' AND tenant_id = ANY($1::uuid[]) ORDER BY concept_type, ui_grouping`,
            [tenantIds]
          )
        : await query<{ concept_type: string; ui_grouping: string }>(
            `SELECT DISTINCT concept_type, ui_grouping FROM ontology_concepts
             WHERE ui_grouping IS NOT NULL AND status = 'Active' ORDER BY concept_type, ui_grouping`
          );
      return { data: rows };
    } catch (err) {
      logger.error("[ontologyDB] findConceptTypeUiGroupings error", err as Error);
      return { error: err as Error };
    }
  },

  async findAllActiveConcepts(viewer: OntologyViewer): Promise<DbResult<Array<{ concept_type: string; code: string; default_label: string; text_type: "text" | "markdown"; ui_grouping: string | null; tenant_id: string }>>> {
    try {
      const tenantIds = await visibleTenantIds(viewer);
      const { rows } = tenantIds
        ? await query<{ concept_type: string; code: string; default_label: string; text_type: "text" | "markdown"; ui_grouping: string | null; tenant_id: string }>(
            `SELECT concept_type, code, default_label, text_type, ui_grouping, tenant_id FROM ontology_concepts WHERE status = 'Active' AND tenant_id = ANY($1::uuid[])
             ORDER BY concept_type, code`,
            [tenantIds]
          )
        : await query<{ concept_type: string; code: string; default_label: string; text_type: "text" | "markdown"; ui_grouping: string | null; tenant_id: string }>(
            `SELECT concept_type, code, default_label, text_type, ui_grouping, tenant_id FROM ontology_concepts WHERE status = 'Active' ORDER BY concept_type, code`
          );
      return { data: rows };
    } catch (err) {
      logger.error("[ontologyDB] findAllActiveConcepts error", err as Error);
      return { error: err as Error };
    }
  },

  async findDistinctUiGroupings(viewer: OntologyViewer): Promise<DbResult<string[]>> {
    try {
      const tenantIds = await visibleTenantIds(viewer);
      const { rows } = tenantIds
        ? await query<{ ui_grouping: string }>(
            "SELECT DISTINCT ui_grouping FROM ontology_concepts WHERE ui_grouping IS NOT NULL AND status = 'Active' AND tenant_id = ANY($1::uuid[]) ORDER BY ui_grouping",
            [tenantIds]
          )
        : await query<{ ui_grouping: string }>(
            "SELECT DISTINCT ui_grouping FROM ontology_concepts WHERE ui_grouping IS NOT NULL AND status = 'Active' ORDER BY ui_grouping"
          );
      return { data: rows.map((r) => r.ui_grouping) };
    } catch (err) {
      logger.error("[ontologyDB] findDistinctUiGroupings error", err as Error);
      return { error: err as Error };
    }
  },

  async insertConceptVersion(input: {
    conceptType: string; code: string; defaultLabel: string; tenantId: string; version: string;
    description?: string | null; contributedByPack?: string | null;
    compositionStrategy?: "specialization" | "override" | null; compositionSources?: Array<{ conceptId: string; code: string }>;
    textType?: "text" | "markdown"; uiGrouping?: string | null;
    status?: OntologyConceptRow["status"];
    authorId: string; authorBadge: string;
  }): Promise<DbResult<OntologyConceptRow>> {
    try {
      const { rows } = await query<OntologyConceptRow>(
        `INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id, version, status, description, contributed_by_pack, composition_strategy, composition_sources, text_type, ui_grouping, author_id, author_badge)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13, $14)
         RETURNING *`,
        [
          input.conceptType, input.code, input.defaultLabel, input.tenantId, input.version, input.status ?? "Active",
          input.description ?? null, input.contributedByPack ?? null,
          input.compositionStrategy ?? null, JSON.stringify(input.compositionSources ?? []),
          input.textType ?? "markdown", input.uiGrouping ?? null,
          input.authorId, input.authorBadge,
        ]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[ontologyDB] insertConceptVersion error", err as Error);
      return { error: err as Error };
    }
  },

  async bulkInsertConceptVersions(
    rows: Array<{
      conceptType: string; code: string; defaultLabel: string; description: string | null; tenantId: string;
      isMandatory: boolean | null; textType: "text" | "markdown"; uiGrouping: string | null;
      authorId: string; authorBadge: string;
    }>
  ): Promise<DbResult<OntologyConceptRow[]>> {
    try {
      const { rows: inserted } = await bulkInsert<OntologyConceptRow>(
        "ontology_concepts",
        ["concept_type", "code", "default_label", "description", "tenant_id", "is_mandatory", "text_type", "ui_grouping", "version", "status", "author_id", "author_badge"],
        rows.map((r) => [
          r.conceptType, r.code, r.defaultLabel, r.description, r.tenantId, r.isMandatory, r.textType, r.uiGrouping,
          "1.0.0", "Active", r.authorId, r.authorBadge,
        ])
      );
      return { data: inserted };
    } catch (err) {
      logger.error("[ontologyDB] bulkInsertConceptVersions error", err as Error);
      return { error: err as Error };
    }
  },

  async updateConceptStatus(id: string, status: OntologyConceptRow["status"]): Promise<DbResult<OntologyConceptRow | null>> {
    try {
      const { rows } = await query<OntologyConceptRow>("UPDATE ontology_concepts SET status = $1 WHERE id = $2 RETURNING *", [status, id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[ontologyDB] updateConceptStatus error", err as Error);
      return { error: err as Error };
    }
  },

  async updateConceptMeta(id: string, updates: { textType?: "text" | "markdown"; uiGrouping?: string | null }): Promise<DbResult<OntologyConceptRow | null>> {
    try {
      const sets: string[] = [];
      const values: unknown[] = [];
      if (updates.textType !== undefined) { values.push(updates.textType); sets.push(`text_type = $${values.length}`); }
      if (updates.uiGrouping !== undefined) { values.push(updates.uiGrouping); sets.push(`ui_grouping = $${values.length}`); }
      if (!sets.length) {
        const { rows } = await query<OntologyConceptRow>("SELECT * FROM ontology_concepts WHERE id = $1", [id]);
        return { data: rows[0] ?? null };
      }
      values.push(id);
      const { rows } = await query<OntologyConceptRow>(`UPDATE ontology_concepts SET ${sets.join(", ")} WHERE id = $${values.length} RETURNING *`, values);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[ontologyDB] updateConceptMeta error", err as Error);
      return { error: err as Error };
    }
  },

  async upsertAlias(input: { tenantId: string; conceptType: string; canonicalCode: string; displayLabel: string }): Promise<DbResult<TenantConceptAliasRow>> {
    try {
      const { actorId, actorBadge } = await userDB.getSuperuserId();
      const { rows } = await query<TenantConceptAliasRow>(
        `INSERT INTO tenant_concept_aliases (tenant_id, concept_type, canonical_code, display_label, author_id, author_badge)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (tenant_id, concept_type, canonical_code) DO UPDATE SET display_label = EXCLUDED.display_label, updated_at = NOW()
         RETURNING *`,
        [input.tenantId, input.conceptType, input.canonicalCode, input.displayLabel, actorId, actorBadge]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[ontologyDB] upsertAlias error", err as Error);
      return { error: err as Error };
    }
  },

  async deleteAlias(tenantId: string, conceptType: string, canonicalCode: string): Promise<DbResult<null>> {
    try {
      await query("DELETE FROM tenant_concept_aliases WHERE tenant_id = $1 AND concept_type = $2 AND canonical_code = $3", [tenantId, conceptType, canonicalCode]);
      return { data: null };
    } catch (err) {
      logger.error("[ontologyDB] deleteAlias error", err as Error);
      return { error: err as Error };
    }
  },

  async findAliasesByTenant(tenantId: string): Promise<DbResult<TenantConceptAliasRow[]>> {
    try {
      const { rows } = await query<TenantConceptAliasRow>("SELECT * FROM tenant_concept_aliases WHERE tenant_id = $1 ORDER BY concept_type, canonical_code", [tenantId]);
      return { data: rows };
    } catch (err) {
      logger.error("[ontologyDB] findAliasesByTenant error", err as Error);
      return { error: err as Error };
    }
  },

  async findDraftConcepts(viewer: OntologyViewer): Promise<DbResult<OntologyConceptRow[]>> {
    try {
      const tenantIds = await visibleTenantIds(viewer);
      const { rows } = tenantIds
        ? await query<OntologyConceptRow>(
            "SELECT * FROM ontology_concepts WHERE status = 'Draft' AND tenant_id = ANY($1::uuid[]) ORDER BY created_at",
            [tenantIds]
          )
        : await query<OntologyConceptRow>("SELECT * FROM ontology_concepts WHERE status = 'Draft' ORDER BY created_at");
      return { data: rows };
    } catch (err) {
      logger.error("[ontologyDB] findDraftConcepts error", err as Error);
      return { error: err as Error };
    }
  },

  async addConceptComment(conceptId: string, actorId: string, commentText: string): Promise<DbResult<OntologyConceptCommentRow>> {
    try {
      const { rows } = await query<OntologyConceptCommentRow>(
        `INSERT INTO ontology_concept_comments (concept_id, actor_id, comment_text)
         VALUES ($1, $2, $3) RETURNING *`,
        [conceptId, actorId, commentText]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[ontologyDB] addConceptComment error", err as Error);
      return { error: err as Error };
    }
  },

  async getConceptComments(conceptId: string): Promise<DbResult<OntologyConceptCommentRow[]>> {
    try {
      const { rows } = await query<OntologyConceptCommentRow>(
        "SELECT * FROM ontology_concept_comments WHERE concept_id = $1 ORDER BY created_at",
        [conceptId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[ontologyDB] getConceptComments error", err as Error);
      return { error: err as Error };
    }
  },
};
