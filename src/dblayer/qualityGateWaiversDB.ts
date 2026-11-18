import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, QualityGateWaiverRow } from "./seuTypes.js";
import { WAIVER_SCOPE_GATE } from "./constants.js";

export const qualityGateWaiversDB = {
  async grant(input: {
    scope?: string;
    qualityGateId?: string | null;
    policyCode?: string | null;
    obligationCategory?: string | null;
    obligationTitle?: string | null;
    deliverableCodes?: string[];
    sharedProfileId?: string | null;
    seuId: string;
    entityType: string;
    entityId: string;
    rationale: string;
    grantedBy: string | null;
    authorityBadge: string;
    expiresAt?: string | null;
    supportingRecords?: Record<string, string[]>;
  }): Promise<DbResult<QualityGateWaiverRow>> {
    try {
      const { rows } = await query<QualityGateWaiverRow>(
        `INSERT INTO quality_gate_waivers (scope, quality_gate_id, policy_code, obligation_category, obligation_title, deliverable_codes, shared_profile_id, seu_id, entity_type, entity_id, rationale, granted_by, authority_badge, expires_at, supporting_records)
         VALUES ($9, $1, $10, $11, $12, $13, $14, $2, $3, $4, $5, $6, $7, $8, $15)
         RETURNING *`,
        [input.qualityGateId ?? null, input.seuId, input.entityType, input.entityId, input.rationale, input.grantedBy, input.authorityBadge, input.expiresAt ?? null, input.scope ?? WAIVER_SCOPE_GATE, input.policyCode ?? null, input.obligationCategory ?? null, input.obligationTitle ?? null, input.deliverableCodes ?? [], input.sharedProfileId ?? null, JSON.stringify(input.supportingRecords ?? {})]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[qualityGateWaiversDB] grant error", err as Error);
      return { error: err as Error };
    }
  },

  // The Active waivers of the SEU whose expiry time has passed.
  async findDueForExpiry(seuId: string): Promise<DbResult<QualityGateWaiverRow[]>> {
    try {
      const { rows } = await query<QualityGateWaiverRow>(
        "SELECT * FROM quality_gate_waivers WHERE seu_id = $1 AND status = 'Active' AND expires_at IS NOT NULL AND expires_at <= NOW() ORDER BY expires_at",
        [seuId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[qualityGateWaiversDB] findDueForExpiry error", err as Error);
      return { error: err as Error };
    }
  },

  // Moves a waiver from one status to another. It returns null when the waiver is no longer in the `from` status.
  async transition(id: string, from: QualityGateWaiverRow["status"], to: QualityGateWaiverRow["status"]): Promise<DbResult<QualityGateWaiverRow | null>> {
    try {
      const { rows } = await query<QualityGateWaiverRow>("UPDATE quality_gate_waivers SET status = $3 WHERE id = $1 AND status = $2 RETURNING *", [id, from, to]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[qualityGateWaiversDB] transition error", err as Error);
      return { error: err as Error };
    }
  },

  // Every Active waiver, whose expiry time has not passed, that applies in the SEU: the ones granted in it and the ones shared with the Profile it uses.
  async findActiveBySeu(seuId: string): Promise<DbResult<QualityGateWaiverRow[]>> {
    try {
      const { rows } = await query<QualityGateWaiverRow>(
        `SELECT w.* FROM quality_gate_waivers w
         WHERE w.status = 'Active' AND (w.expires_at IS NULL OR w.expires_at > NOW())
           AND (w.seu_id = $1 OR w.shared_profile_id = (SELECT profile_id FROM seus WHERE id = $1))
         ORDER BY w.created_at DESC`,
        [seuId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[qualityGateWaiversDB] findActiveBySeu error", err as Error);
      return { error: err as Error };
    }
  },

  async findByIds(ids: string[]): Promise<DbResult<QualityGateWaiverRow[]>> {
    try {
      const { rows } = await query<QualityGateWaiverRow>("SELECT * FROM quality_gate_waivers WHERE id = ANY($1::uuid[])", [ids]);
      return { data: rows };
    } catch (err) {
      logger.error("[qualityGateWaiversDB] findByIds error", err as Error);
      return { error: err as Error };
    }
  },

  async findBySeuId(seuId: string): Promise<DbResult<QualityGateWaiverRow[]>> {
    try {
      const { rows } = await query<QualityGateWaiverRow>("SELECT * FROM quality_gate_waivers WHERE seu_id = $1 ORDER BY created_at DESC", [seuId]);
      return { data: rows };
    } catch (err) {
      logger.error("[qualityGateWaiversDB] findBySeuId error", err as Error);
      return { error: err as Error };
    }
  },
};
