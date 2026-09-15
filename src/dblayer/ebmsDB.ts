import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, EbmCompositionReport, EbmComposedPack, EbmRow, EbmStatus } from "./seuTypes.js";

export const ebmsDB = {
  async create(input: {
    seuId: string;
    templateId: string;
    profileId: string;
    composedPacks: EbmComposedPack[];
    compositionReport: EbmCompositionReport;
    // migration 182 — the real resolved behavioural content (Chapter 3 §7),
    // not just which Packs composed. Optional so every existing caller that
    // doesn't yet have it to pass stays valid; null in that case, not an
    // empty object standing in for "resolved nothing."
    behaviors?: Record<string, unknown> | null;
    // CR-104 — materialised, per-EBM governance: exactly which Quality Gate/
    // Policy rows this EBM's own composed Packs actually contribute
    // (originating_pack_id ∈ composed Pack ids), computed once here rather
    // than re-derived by a bare (entity_type, from_state, to_state) match on
    // every transition attempt (qualityGateEngine's old findAllActive path,
    // which matched every SEU platform-wide regardless of composition).
    applicableQualityGateIds?: string[];
    applicablePolicyIds?: string[];
    // CR-104 — a distinct subset of applicablePolicyIds: Policies governing
    // the SEU's own lifecycle transition (governed_transition entity type
    // 'SEU'), not any owned entity's. commissioning.ts reads this one
    // directly for its own transitions; it's never consulted by
    // policyEngine's entity-scoped check.
    seuScopedPolicyIds?: string[];
  }): Promise<DbResult<EbmRow>> {
    try {
      // FR-3.3/3.10: versioned per SEU — 1 for the first EBM, prior+1 on a
      // recomposition that supersedes an earlier one for the same SEU.
      // Status starts 'Composed', not 'Active' (migration 178) — the EBM
      // Composer (design/mvp-build-plan/SEU Composition.md) creates this row
      // off CommissionValidated, before "Validate Engineering Model" has
      // happened; only the separate, later Activate transition (updateStatus
      // below) ever sets 'Active'.
      const { rows } = await query<EbmRow>(
        `INSERT INTO ebms (seu_id, template_id, profile_id, composed_packs, composition_report, behaviors, applicable_quality_gate_ids, applicable_policy_ids, seu_scoped_policy_ids, status, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Composed', (SELECT COALESCE(MAX(version), 0) + 1 FROM ebms WHERE seu_id = $1))
         RETURNING *`,
        [
          input.seuId,
          input.templateId,
          input.profileId,
          JSON.stringify(input.composedPacks),
          JSON.stringify(input.compositionReport),
          input.behaviors ? JSON.stringify(input.behaviors) : null,
          input.applicableQualityGateIds ?? [],
          input.applicablePolicyIds ?? [],
          input.seuScopedPolicyIds ?? [],
        ]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[ebmsDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  async findById(id: string): Promise<DbResult<EbmRow | null>> {
    try {
      const { rows } = await query<EbmRow>("SELECT * FROM ebms WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[ebmsDB] findById error", err as Error);
      return { error: err as Error };
    }
  },

  // Composed -> Validated -> Active, and Superseded when a later version
  // takes over — two separate, independently human-triggered transitions
  // (design/mvp-build-plan/SEU Composition.md, "Validate and Activate are 2
  // separate events"), never inferred, always an explicit status write.
  async updateStatus(id: string, status: EbmStatus): Promise<DbResult<EbmRow>> {
    try {
      const { rows } = await query<EbmRow>("UPDATE ebms SET status = $2 WHERE id = $1 RETURNING *", [id, status]);
      return { data: rows[0] };
    } catch (err) {
      logger.error("[ebmsDB] updateStatus error", err as Error);
      return { error: err as Error };
    }
  },
};
