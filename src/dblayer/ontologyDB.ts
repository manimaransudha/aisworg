import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, OntologyConceptRow, TenantConceptAliasRow } from "./seuTypes.js";

// Ontology Model — Plan (Phase 17, Ch.18). The canonical registry + per-tenant
// alias store. The core only ever reads/writes canonical codes; the alias is a
// read-time presentation lookup (§0.1).
export const ontologyDB = {
  async findConcept(conceptType: string, code: string): Promise<DbResult<OntologyConceptRow | null>> {
    try {
      const { rows } = await query<OntologyConceptRow>("SELECT * FROM ontology_concepts WHERE concept_type = $1 AND code = $2", [conceptType, code]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[ontologyDB] findConcept error", err as Error);
      return { error: err as Error };
    }
  },

  async findConceptsByType(conceptType: string): Promise<DbResult<OntologyConceptRow[]>> {
    try {
      const { rows } = await query<OntologyConceptRow>("SELECT * FROM ontology_concepts WHERE concept_type = $1 ORDER BY code", [conceptType]);
      return { data: rows };
    } catch (err) {
      logger.error("[ontologyDB] findConceptsByType error", err as Error);
      return { error: err as Error };
    }
  },

  // Pack-contributed concept (step 5, deferred) — additive registry entry.
  async upsertConcept(input: { conceptType: string; code: string; defaultLabel: string; contributedByPack?: string | null }): Promise<DbResult<OntologyConceptRow>> {
    try {
      const { rows } = await query<OntologyConceptRow>(
        `INSERT INTO ontology_concepts (concept_type, code, default_label, contributed_by_pack)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (concept_type, code) DO UPDATE SET default_label = EXCLUDED.default_label, contributed_by_pack = EXCLUDED.contributed_by_pack
         RETURNING *`,
        [input.conceptType, input.code, input.defaultLabel, input.contributedByPack ?? null]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[ontologyDB] upsertConcept error", err as Error);
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
