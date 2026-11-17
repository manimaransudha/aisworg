import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, QualityGateWaiverControlRow, QualityGateWaiverRiskRow } from "./seuTypes.js";

export const qualityGateWaiverRisksDB = {
  async createRisk(input: { waiverId: string; seuId: string; risk: string }): Promise<DbResult<QualityGateWaiverRiskRow>> {
    try {
      const { rows } = await query<QualityGateWaiverRiskRow>(
        "INSERT INTO quality_gate_waiver_risks (waiver_id, seu_id, risk) VALUES ($1, $2, $3) RETURNING *",
        [input.waiverId, input.seuId, input.risk]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[qualityGateWaiverRisksDB] createRisk error", err as Error);
      return { error: err as Error };
    }
  },

  async createControl(input: { riskId: string; waiverId: string; seuId: string; controlType: string; obligationId: string | null }): Promise<DbResult<QualityGateWaiverControlRow>> {
    try {
      const { rows } = await query<QualityGateWaiverControlRow>(
        "INSERT INTO quality_gate_waiver_controls (risk_id, waiver_id, seu_id, control_type, obligation_id) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [input.riskId, input.waiverId, input.seuId, input.controlType, input.obligationId]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[qualityGateWaiverRisksDB] createControl error", err as Error);
      return { error: err as Error };
    }
  },

  async findRisksBySeuId(seuId: string): Promise<DbResult<QualityGateWaiverRiskRow[]>> {
    try {
      const { rows } = await query<QualityGateWaiverRiskRow>("SELECT * FROM quality_gate_waiver_risks WHERE seu_id = $1 ORDER BY created_at", [seuId]);
      return { data: rows };
    } catch (err) {
      logger.error("[qualityGateWaiverRisksDB] findRisksBySeuId error", err as Error);
      return { error: err as Error };
    }
  },

  async findControlsBySeuId(seuId: string): Promise<DbResult<QualityGateWaiverControlRow[]>> {
    try {
      const { rows } = await query<QualityGateWaiverControlRow>("SELECT * FROM quality_gate_waiver_controls WHERE seu_id = $1 ORDER BY created_at", [seuId]);
      return { data: rows };
    } catch (err) {
      logger.error("[qualityGateWaiverRisksDB] findControlsBySeuId error", err as Error);
      return { error: err as Error };
    }
  },
};
