import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, QualityGateWaiverRow } from "./seuTypes.js";

// CR-058 §13 — modeled on complianceDB's grantWaiver/findActiveWaivers
// shape, but badge-gated (authorityBadge is required here; Compliance's own
// waiver has no authority check at all — deliberately not mirrored).
export const qualityGateWaiversDB = {
  async grant(input: {
    qualityGateId: string;
    seuId: string;
    entityType: string;
    entityId: string;
    rationale: string;
    grantedBy: number | null;
    authorityBadge: string;
    expiresAt?: string | null;
  }): Promise<DbResult<QualityGateWaiverRow>> {
    try {
      const { rows } = await query<QualityGateWaiverRow>(
        `INSERT INTO quality_gate_waivers (quality_gate_id, seu_id, entity_type, entity_id, rationale, granted_by, authority_badge, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [input.qualityGateId, input.seuId, input.entityType, input.entityId, input.rationale, input.grantedBy, input.authorityBadge, input.expiresAt ?? null]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[qualityGateWaiversDB] grant error", err as Error);
      return { error: err as Error };
    }
  },

  // The one active, unexpired waiver (if any) for this exact gate + entity
  // instance — what qualityGateEngine.evaluateGate checks before blocking.
  async findActive(qualityGateId: string, entityType: string, entityId: string): Promise<DbResult<QualityGateWaiverRow | null>> {
    try {
      const { rows } = await query<QualityGateWaiverRow>(
        `SELECT * FROM quality_gate_waivers
         WHERE quality_gate_id = $1 AND entity_type = $2 AND entity_id = $3
           AND status = 'Active' AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY created_at DESC LIMIT 1`,
        [qualityGateId, entityType, entityId]
      );
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[qualityGateWaiversDB] findActive error", err as Error);
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
