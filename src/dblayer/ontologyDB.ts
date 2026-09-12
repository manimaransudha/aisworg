import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import { PLATFORM_TENANT_ID } from "./constants.js";
import type { DbResult, OntologyConceptRow, TenantConceptAliasRow } from "./seuTypes.js";

// Ontology Model — Plan (Phase 17, Ch.18). The canonical registry + per-tenant
// alias store. The core only ever reads/writes canonical codes; the alias is a
// read-time presentation lookup (§0.1).
//
// CR-022 (owner: "Include tenant_id as part of Ontology. So platform ones
// will be visible to all + their own vocabulary") — same shape Pack already
// has (packsDB.findAllVisibleTo): a Platform-tenant concept is canonical and
// visible to everyone; a tenant's own concept is theirs alone. Root sees
// every tenant's, same as everywhere else on this platform.
export interface OntologyViewer { isRoot: boolean; tenantId: string | null }

// null => no filter (root sees every tenant's concepts, unscoped).
function visibleTenantIds(viewer: OntologyViewer): string[] | null {
  if (viewer.isRoot) return null;
  const ids = new Set([PLATFORM_TENANT_ID]);
  if (viewer.tenantId) ids.add(viewer.tenantId);
  return [...ids];
}

export const ontologyDB = {
  // Bug fix (CR-091) — when a Platform row and a tenant's own shadow row both
  // exist for the same (concept_type, code), this used to have no ORDER BY
  // at all: which one "LIMIT 1" returned was whatever order Postgres
  // happened to produce, not reliably the tenant's own. That's silently
  // fine for every caller that only ever reads default_label/description
  // (Platform's and a tenant's rarely differ in practice) — but CR-091's own
  // tenant-overridable `is_mandatory` flag depends on the tenant's row
  // actually winning every time, the same explicit preference
  // policyDefinitionsDB.findActiveByCodeVisibleTo already has. Ordering by
  // "this row's tenant_id is the viewer's own" first fixes it for every
  // caller, not just the new one.
  // Migration 190 — "the concept" for validation/picker purposes is
  // specifically whichever row has status = 'Active' for this
  // (concept_type, code) among the visible tenants; a Deprecated/Retired/
  // Archived row is invisible here exactly the same way an is_active=FALSE
  // row was before (off-canonical, rejected by assertCanonicalCategory).
  async findConcept(conceptType: string, code: string, viewer: OntologyViewer): Promise<DbResult<OntologyConceptRow | null>> {
    try {
      const tenantIds = visibleTenantIds(viewer);
      const { rows } = tenantIds
        ? await query<OntologyConceptRow>(
            "SELECT * FROM ontology_concepts WHERE concept_type = $1 AND code = $2 AND status = 'Active' AND tenant_id = ANY($3::uuid[]) ORDER BY (tenant_id = $4) DESC LIMIT 1",
            [conceptType, code, tenantIds, viewer.tenantId ?? PLATFORM_TENANT_ID]
          )
        : await query<OntologyConceptRow>("SELECT * FROM ontology_concepts WHERE concept_type = $1 AND code = $2 AND status = 'Active' LIMIT 1", [conceptType, code]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[ontologyDB] findConcept error", err as Error);
      return { error: err as Error };
    }
  },

  // The exact-tenant Active row for a code — used for version-supersession
  // (createConceptVersion) and transition gating (deprecate/retire/archive),
  // where cross-tenant fallback (findConcept's own Platform-then-tenant
  // preference) would resolve to the WRONG row.
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

  // Highest existing version row for a code (any status) — the base
  // createConceptVersion bumps a patch from. Distinct from findActiveConcept:
  // needed when every row for a code is terminal (Deprecated/Retired/
  // Archived) and a new version is being published anyway (Template's own
  // "reactivation is versioning" case).
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

  // includeInactive: false (default) is the picker/validation view — only
  // each code's current Active version. The Ontology Management admin list
  // passes true to show every version of every code, all statuses, newest
  // version first per code (Ch.18 §12 "historical Ontologies shall remain
  // available" — a real read of that history, not just a hidden flag).
  async findConceptsByType(conceptType: string, viewer: OntologyViewer, opts?: { includeInactive?: boolean }): Promise<DbResult<OntologyConceptRow[]>> {
    try {
      const tenantIds = visibleTenantIds(viewer);
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

  // Every concept_type visible to this viewer — the Ontology Management admin
  // page's list of "tables" (owner: no separate concept_types governance
  // table, so this is derived from ontology_concepts itself, not a lookup).
  async listDistinctConceptTypes(viewer: OntologyViewer): Promise<DbResult<string[]>> {
    try {
      const tenantIds = visibleTenantIds(viewer);
      const { rows } = tenantIds
        ? await query<{ concept_type: string }>("SELECT DISTINCT concept_type FROM ontology_concepts WHERE tenant_id = ANY($1::uuid[]) ORDER BY concept_type", [tenantIds])
        : await query<{ concept_type: string }>("SELECT DISTINCT concept_type FROM ontology_concepts ORDER BY concept_type");
      return { data: rows.map((r) => r.concept_type) };
    } catch (err) {
      logger.error("[ontologyDB] listDistinctConceptTypes error", err as Error);
      return { error: err as Error };
    }
  },

  // Migration 191, redesigned same-day (owner: "The navbar in Ontology
  // should reflect ui grouping. When the ui grouping is selected, the
  // vertical tabs should be concept_types"). Grouping is concept_type-level,
  // one rule only: a concept_type belongs to a group whenever ITS OWN rows
  // carry a `ui_grouping` value; every concept_type sharing that same value
  // merges into one navbar entry, and each becomes a tab inside it. (The
  // original mechanism read a row's `code` as naming a CHILD concept_type —
  // correct only for profile-configuration's own parent-names-child shape;
  // it broke the moment `ui_grouping` was set directly on a target type's
  // own rows with several sibling types sharing one label — see CR-096's
  // own "Obligation"/"Packs"/"Checklists" follow-up.) DISTINCT collapses a
  // consistently-tagged type's many rows to one pair; a type whose rows
  // disagree on the label surfaces as more than one row here — a real data
  // inconsistency, not a bug, and exactly what the Metadata page's own
  // review table exists to catch.
  async findConceptTypeUiGroupings(viewer: OntologyViewer): Promise<DbResult<Array<{ concept_type: string; ui_grouping: string }>>> {
    try {
      const tenantIds = visibleTenantIds(viewer);
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

  // Owner: "the list should show all. otherwise how do I edit?" — the
  // Ontology Metadata page's own review list AND its "set metadata" picker
  // are the SAME data: every Active concept, every type/tenant, in one
  // place (not scoped to whichever category tab you happen to be viewing).
  // An ungrouped concept has ui_grouping: null, shown as "—" in the table —
  // still listed, still editable, not filtered out just because it has
  // nothing set yet.
  async findAllActiveConcepts(viewer: OntologyViewer): Promise<DbResult<Array<{ concept_type: string; code: string; default_label: string; text_type: "text" | "markdown"; ui_grouping: string | null; tenant_id: string }>>> {
    try {
      const tenantIds = visibleTenantIds(viewer);
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

  // Owner: "Ui grouping in the tab forms should be having a similar change"
  // — the same existing-groups datalist the Metadata page's own Add form
  // got, now also on the per-category Add-concept form. A dedicated, cheap
  // DISTINCT query rather than reusing findAllActiveConcepts's full 700+ row
  // fetch just to read off one column, since this now also runs on every
  // category tab's own page load, not just the Metadata page's.
  async findDistinctUiGroupings(viewer: OntologyViewer): Promise<DbResult<string[]>> {
    try {
      const tenantIds = visibleTenantIds(viewer);
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

  // Bare insert — the two version-numbering/supersession policy decisions
  // (what version number, whether to deprecate a previous Active row) live in
  // core/ontology.ts's createConceptVersion, which is the only real caller;
  // kept here as a raw writer the same way templatesDB.createDraft is a raw
  // writer under core/templates.ts's own reactivateAsNewVersion policy.
  async insertConceptVersion(input: {
    conceptType: string; code: string; defaultLabel: string; tenantId: string; version: string;
    description?: string | null; contributedByPack?: string | null;
    compositionStrategy?: "specialization" | "override" | null; compositionSources?: Array<{ conceptId: string; code: string }>;
    textType?: "text" | "markdown"; uiGrouping?: string | null;
  }): Promise<DbResult<OntologyConceptRow>> {
    try {
      const { rows } = await query<OntologyConceptRow>(
        `INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id, version, status, description, contributed_by_pack, composition_strategy, composition_sources, text_type, ui_grouping)
         VALUES ($1, $2, $3, $4, $5, 'Active', $6, $7, $8, $9::jsonb, $10, $11)
         RETURNING *`,
        [
          input.conceptType, input.code, input.defaultLabel, input.tenantId, input.version,
          input.description ?? null, input.contributedByPack ?? null,
          input.compositionStrategy ?? null, JSON.stringify(input.compositionSources ?? []),
          input.textType ?? "markdown", input.uiGrouping ?? null,
        ]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[ontologyDB] insertConceptVersion error", err as Error);
      return { error: err as Error };
    }
  },

  // Raw status setter — every transition (deprecate/retire/archive) and the
  // auto-supersede-previous-Active step on a new version both go through
  // this; the authority/event-publish decisions live in core/ontology.ts,
  // same split as templatesDB.updateStatus/transitionTemplate.
  async updateConceptStatus(id: string, status: OntologyConceptRow["status"]): Promise<DbResult<OntologyConceptRow | null>> {
    try {
      const { rows } = await query<OntologyConceptRow>("UPDATE ontology_concepts SET status = $1 WHERE id = $2 RETURNING *", [status, id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[ontologyDB] updateConceptStatus error", err as Error);
      return { error: err as Error };
    }
  },

  // Owner: "a CRUD to manually set the ui_grouping / text_type." Unlike
  // label/description, these are administrative/display metadata, not
  // semantic content (Ch.18 §12's own versioning target) — edited IN PLACE
  // on the current row, no new Version, no supersession. `uiGrouping: null`
  // explicitly clears it (this is a direct edit of the current value, not
  // createConceptVersion's own "undefined = inherit from prior Version").
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
      const { rows } = await query<TenantConceptAliasRow>(
        `INSERT INTO tenant_concept_aliases (tenant_id, concept_type, canonical_code, display_label)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (tenant_id, concept_type, canonical_code) DO UPDATE SET display_label = EXCLUDED.display_label, updated_at = NOW()
         RETURNING *`,
        [input.tenantId, input.conceptType, input.canonicalCode, input.displayLabel]
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
};
