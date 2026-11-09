import { query, bulkInsert } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import { getPlatformTenantId, PLATFORM_TENANT_NAME, INITIAL_VERSION, ONTOLOGY_CACHE_TTL_MS } from "./constants.js";
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

// One entry per tenant that has logged in: every ontology_concepts row of Platform plus that tenant, all statuses. The finders read it first and
// go to the database when the viewer is root or the tenant has no entry. A write reloads the entries that hold the written tenant.
const ontologyCache = new Map<string, { rows: OntologyConceptRow[]; loaded_at: number }>();

const reloading = new Map<string, Promise<void>>();

// The rows of a tenant's entry, or undefined when the tenant has none. An entry older than ONTOLOGY_CACHE_TTL_MS is loaded again first, once
// when several reads find it expired together; if that load fails the read goes to the database.
async function liveEntry(tenantId: string): Promise<OntologyConceptRow[] | undefined> {
  const entry = ontologyCache.get(tenantId);
  if (!entry) return undefined;
  if (Date.now() - entry.loaded_at < ONTOLOGY_CACHE_TTL_MS) return entry.rows;
  let pending = reloading.get(tenantId);
  if (!pending) {
    pending = loadOntologyCache(tenantId).finally(() => reloading.delete(tenantId));
    reloading.set(tenantId, pending);
  }
  await pending;
  const fresh = ontologyCache.get(tenantId);
  return fresh && Date.now() - fresh.loaded_at < ONTOLOGY_CACHE_TTL_MS ? fresh.rows : undefined;
}

export async function loadOntologyCache(tenantId: string): Promise<void> {
  try {
    const platformTenantId = await getPlatformTenantId();
    const tenantIds = [...new Set([platformTenantId, tenantId])];
    const { rows } = await query<OntologyConceptRow>("SELECT * FROM ontology_concepts WHERE tenant_id = ANY($1::uuid[])", [tenantIds]);
    ontologyCache.set(tenantId, { rows, loaded_at: Date.now() });
    logger.info(`[ontologyCache] loaded ${rows.length} ontology_concepts rows for tenant ${tenantId}.`);
  } catch (err) {
    logger.error(`[ontologyCache] failed to load tenant ${tenantId} -- reads for it go to the database`, err as Error);
  }
}

async function refreshOntologyCacheFor(writtenTenantId: string): Promise<void> {
  const platformTenantId = await getPlatformTenantId();
  const loaded = [...ontologyCache.keys()];
  const affected = writtenTenantId === platformTenantId ? loaded : loaded.filter((tenantId) => tenantId === writtenTenantId);
  for (const tenantId of affected) await loadOntologyCache(tenantId);
}

async function cachedRows(viewer: OntologyViewer): Promise<OntologyConceptRow[] | null> {
  if (viewer.isRoot || !viewer.tenantId) return null;
  return (await liveEntry(viewer.tenantId)) ?? null;
}

// The rows a tenant owns, from its own entry, or null when the tenant has no entry.
async function cachedOwnRows(tenantId: string): Promise<OntologyConceptRow[] | null> {
  const entry = await liveEntry(tenantId);
  return entry ? entry.filter((r) => r.tenant_id === tenantId) : null;
}

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export const ontologyDB = {
  async findConcept(conceptType: string, code: string, viewer: OntologyViewer): Promise<DbResult<OntologyConceptRow | null>> {
    try {
      const cached = await cachedRows(viewer);
      if (cached) {
        const matches = cached.filter((r) => r.concept_type === conceptType && r.code === code && r.status === "Active");
        return { data: matches.find((r) => r.tenant_id === viewer.tenantId) ?? matches[0] ?? null };
      }
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
      const own = await cachedOwnRows(tenantId);
      if (own) return { data: own.find((r) => r.concept_type === conceptType && r.code === code && r.status === "Active") ?? null };
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
      for (const tenantId of [...ontologyCache.keys()]) {
        const hit = (await liveEntry(tenantId))?.find((r) => r.id === id);
        if (hit) return { data: hit };
      }
      const { rows } = await query<OntologyConceptRow>("SELECT * FROM ontology_concepts WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[ontologyDB] findConceptById error", err as Error);
      return { error: err as Error };
    }
  },

  async findLatestVersion(conceptType: string, code: string, tenantId: string): Promise<DbResult<OntologyConceptRow | null>> {
    try {
      const own = await cachedOwnRows(tenantId);
      if (own) return { data: own.filter((r) => r.concept_type === conceptType && r.code === code).sort((a, b) => byText(b.created_at, a.created_at))[0] ?? null };
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
      const own = await cachedOwnRows(tenantId);
      if (own) return { data: own.find((r) => r.concept_type === conceptType && r.code === code && r.version === version) ?? null };
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
      const cached = await cachedRows(viewer);
      if (cached) {
        const matches = cached.filter((r) => r.concept_type === conceptType && (opts?.includeInactive || r.status === "Active"));
        return { data: matches.sort((a, b) => byText(a.code, b.code) || (opts?.includeInactive ? byText(b.version, a.version) : 0)) };
      }
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
      const cached = await cachedRows(viewer);
      if (cached) return { data: [...new Set(cached.map((r) => r.concept_type))].sort(byText) };
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
      const cached = await cachedRows(viewer);
      if (cached) {
        const pairs = new Map<string, { concept_type: string; ui_grouping: string }>();
        for (const r of cached) if (r.ui_grouping !== null && r.status === "Active") pairs.set(`${r.concept_type}\u0000${r.ui_grouping}`, { concept_type: r.concept_type, ui_grouping: r.ui_grouping });
        return { data: [...pairs.values()].sort((a, b) => byText(a.concept_type, b.concept_type) || byText(a.ui_grouping, b.ui_grouping)) };
      }
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
      const cached = await cachedRows(viewer);
      if (cached) {
        const active = cached.filter((r) => r.status === "Active").sort((a, b) => byText(a.concept_type, b.concept_type) || byText(a.code, b.code));
        return { data: active.map((r) => ({ concept_type: r.concept_type, code: r.code, default_label: r.default_label, text_type: r.text_type, ui_grouping: r.ui_grouping, tenant_id: r.tenant_id })) };
      }
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
      const cached = await cachedRows(viewer);
      if (cached) return { data: [...new Set(cached.filter((r) => r.ui_grouping !== null && r.status === "Active").map((r) => r.ui_grouping as string))].sort(byText) };
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
    status: OntologyConceptRow["status"];
    authorId: string; authorBadge: string;
  }): Promise<DbResult<OntologyConceptRow>> {
    try {
      const { rows } = await query<OntologyConceptRow>(
        `INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id, version, status, description, contributed_by_pack, composition_strategy, composition_sources, text_type, ui_grouping, author_id, author_badge)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13, $14)
         RETURNING *`,
        [
          input.conceptType, input.code, input.defaultLabel, input.tenantId, input.version, input.status,
          input.description ?? null, input.contributedByPack ?? null,
          input.compositionStrategy ?? null, JSON.stringify(input.compositionSources ?? []),
          input.textType ?? "markdown", input.uiGrouping ?? null,
          input.authorId, input.authorBadge,
        ]
      );
      await refreshOntologyCacheFor(input.tenantId);
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
      contributedByPack?: string | null; version?: string; status?: OntologyConceptRow["status"];
      compositionStrategy?: OntologyConceptRow["composition_strategy"]; compositionSources?: OntologyConceptRow["composition_sources"];
      authorId: string; authorBadge: string;
    }>
  ): Promise<DbResult<OntologyConceptRow[]>> {
    try {
      const { rows: inserted } = await bulkInsert<OntologyConceptRow>(
        "ontology_concepts",
        ["concept_type", "code", "default_label", "description", "tenant_id", "is_mandatory", "text_type", "ui_grouping", "contributed_by_pack", "version", "status", "composition_strategy", "composition_sources", "author_id", "author_badge"],
        rows.map((r) => [
          r.conceptType, r.code, r.defaultLabel, r.description, r.tenantId, r.isMandatory, r.textType, r.uiGrouping,
          r.contributedByPack ?? null, r.version ?? INITIAL_VERSION, r.status ?? "Active", r.compositionStrategy ?? null, JSON.stringify(r.compositionSources ?? []), r.authorId, r.authorBadge,
        ]),
        {
          onConflict: `ON CONFLICT (concept_type, code, tenant_id, version) DO UPDATE SET
            default_label = EXCLUDED.default_label, description = EXCLUDED.description, is_mandatory = EXCLUDED.is_mandatory,
            text_type = EXCLUDED.text_type, ui_grouping = EXCLUDED.ui_grouping, contributed_by_pack = EXCLUDED.contributed_by_pack, status = EXCLUDED.status,
            composition_strategy = EXCLUDED.composition_strategy, composition_sources = EXCLUDED.composition_sources,
            author_id = EXCLUDED.author_id, author_badge = EXCLUDED.author_badge`,
        }
      );
      for (const tenantId of new Set(rows.map((r) => r.tenantId))) await refreshOntologyCacheFor(tenantId);
      return { data: inserted };
    } catch (err) {
      logger.error("[ontologyDB] bulkInsertConceptVersions error", err as Error);
      return { error: err as Error };
    }
  },

  async updateConceptStatus(id: string, status: OntologyConceptRow["status"]): Promise<DbResult<OntologyConceptRow | null>> {
    try {
      const { rows } = await query<OntologyConceptRow>("UPDATE ontology_concepts SET status = $1 WHERE id = $2 RETURNING *", [status, id]);
      if (rows[0]) await refreshOntologyCacheFor(rows[0].tenant_id);
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
      if (rows[0]) await refreshOntologyCacheFor(rows[0].tenant_id);
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
      const cached = await cachedRows(viewer);
      if (cached) return { data: cached.filter((r) => r.status === "Draft").sort((a, b) => byText(a.created_at, b.created_at)) };
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

  async addConceptComment(conceptId: string, actorId: string, authorityBadge: string, commentText: string): Promise<DbResult<OntologyConceptCommentRow>> {
    try {
      const { rows } = await query<OntologyConceptCommentRow>(
        `INSERT INTO ontology_concept_comments (concept_id, actor_id, authority_badge, comment_text)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [conceptId, actorId, authorityBadge, commentText]
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
