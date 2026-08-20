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
  async findConcept(conceptType: string, code: string, viewer: OntologyViewer): Promise<DbResult<OntologyConceptRow | null>> {
    try {
      const tenantIds = visibleTenantIds(viewer);
      const { rows } = tenantIds
        ? await query<OntologyConceptRow>(
            "SELECT * FROM ontology_concepts WHERE concept_type = $1 AND code = $2 AND tenant_id = ANY($3::uuid[]) LIMIT 1",
            [conceptType, code, tenantIds]
          )
        : await query<OntologyConceptRow>("SELECT * FROM ontology_concepts WHERE concept_type = $1 AND code = $2 LIMIT 1", [conceptType, code]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[ontologyDB] findConcept error", err as Error);
      return { error: err as Error };
    }
  },

  // includeInactive: false (default) is the picker/validation view — same
  // "retired drops out of new-use lists" discipline as authorityVocabularyDB's
  // listActiveNouns; the Ontology Management admin list passes true to show
  // retired rows too (mirrors listNouns returning is_active for the UI to
  // render a badge + "Reactivate" action).
  async findConceptsByType(conceptType: string, viewer: OntologyViewer, opts?: { includeInactive?: boolean }): Promise<DbResult<OntologyConceptRow[]>> {
    try {
      const tenantIds = visibleTenantIds(viewer);
      const activeClause = opts?.includeInactive ? "" : " AND is_active";
      const { rows } = tenantIds
        ? await query<OntologyConceptRow>(
            `SELECT * FROM ontology_concepts WHERE concept_type = $1 AND tenant_id = ANY($2::uuid[])${activeClause} ORDER BY code`,
            [conceptType, tenantIds]
          )
        : await query<OntologyConceptRow>(`SELECT * FROM ontology_concepts WHERE concept_type = $1${activeClause} ORDER BY code`, [conceptType]);
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

  // Pack-contributed concept (step 5, deferred) / Ontology Management "Add"
  // action — additive registry entry, always landing on tenantId's OWN
  // vocabulary (core/ontology.ts decides what that is — the actor's own
  // tenant, or Platform's if the actor is root). Re-adding a retired code
  // reactivates it (same ON CONFLICT ... is_active = TRUE shape as
  // addNoun/addVerb).
  async upsertConcept(input: { conceptType: string; code: string; defaultLabel: string; tenantId: string; description?: string | null; contributedByPack?: string | null }): Promise<DbResult<OntologyConceptRow>> {
    try {
      const { rows } = await query<OntologyConceptRow>(
        `INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id, description, contributed_by_pack)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (concept_type, code, tenant_id) DO UPDATE SET default_label = EXCLUDED.default_label, description = EXCLUDED.description, contributed_by_pack = EXCLUDED.contributed_by_pack, is_active = TRUE
         RETURNING *`,
        [input.conceptType, input.code, input.defaultLabel, input.tenantId, input.description ?? null, input.contributedByPack ?? null]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[ontologyDB] upsertConcept error", err as Error);
      return { error: err as Error };
    }
  },

  // Soft-retire (never a hard delete) — same shape as retireNoun/retireVerb.
  // Scoped to a specific tenant_id: core/ontology.ts is what decides whether
  // the acting user is allowed to retire that tenant's row (root: any;
  // everyone else: only their own).
  async retireConcept(conceptType: string, code: string, tenantId: string): Promise<DbResult<{ code: string } | null>> {
    try {
      const { rows } = await query<{ code: string }>(
        "UPDATE ontology_concepts SET is_active = FALSE WHERE concept_type = $1 AND code = $2 AND tenant_id = $3 RETURNING code",
        [conceptType, code, tenantId]
      );
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[ontologyDB] retireConcept error", err as Error);
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
