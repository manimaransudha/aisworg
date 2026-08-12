import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { ComplianceEvaluationRow, ComplianceFrameworkRow, ComplianceRequirementRow, ComplianceStatus, ComplianceWaiverRow, DbResult } from "./seuTypes.js";

// Compliance Model — Plan (Phase 15, Ch.27). Frameworks + requirements are
// Pack-contributed (upsert by code); waivers and evaluation snapshots are
// per-SEU. Evaluation snapshots are append-only (immutable history, FR-27.6).
export const complianceDB = {
  async upsertFramework(input: { code: string; name: string; description?: string | null; originatingPackId?: string | null }): Promise<DbResult<ComplianceFrameworkRow>> {
    try {
      const { rows } = await query<ComplianceFrameworkRow>(
        `INSERT INTO compliance_frameworks (code, name, description, originating_pack_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, originating_pack_id = EXCLUDED.originating_pack_id
         RETURNING *`,
        [input.code, input.name, input.description ?? null, input.originatingPackId ?? null]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[complianceDB] upsertFramework error", err as Error);
      return { error: err as Error };
    }
  },

  async upsertRequirement(input: {
    code: string;
    frameworkCode: string;
    name: string;
    description?: string | null;
    criteria: Record<string, unknown>;
    severity?: string;
    conflictsWith?: string[];
    originatingPackId?: string | null;
  }): Promise<DbResult<ComplianceRequirementRow>> {
    try {
      const { rows } = await query<ComplianceRequirementRow>(
        `INSERT INTO compliance_requirements (code, framework_code, name, description, criteria, severity, conflicts_with, originating_pack_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (code) DO UPDATE
           SET framework_code = EXCLUDED.framework_code, name = EXCLUDED.name, description = EXCLUDED.description,
               criteria = EXCLUDED.criteria, severity = EXCLUDED.severity, conflicts_with = EXCLUDED.conflicts_with, originating_pack_id = EXCLUDED.originating_pack_id
         RETURNING *`,
        [input.code, input.frameworkCode, input.name, input.description ?? null, JSON.stringify(input.criteria), input.severity ?? "Medium", input.conflictsWith ?? [], input.originatingPackId ?? null]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[complianceDB] upsertRequirement error", err as Error);
      return { error: err as Error };
    }
  },

  async findAllFrameworks(): Promise<DbResult<ComplianceFrameworkRow[]>> {
    try {
      const { rows } = await query<ComplianceFrameworkRow>("SELECT * FROM compliance_frameworks ORDER BY code");
      return { data: rows };
    } catch (err) {
      logger.error("[complianceDB] findAllFrameworks error", err as Error);
      return { error: err as Error };
    }
  },

  // Frameworks whose originating Pack is in the given set (FR-27.2 applicability
  // by the SEU's composed Packs). A framework with no originating pack applies
  // platform-wide.
  async findApplicableFrameworks(packIds: string[]): Promise<DbResult<ComplianceFrameworkRow[]>> {
    try {
      const { rows } = await query<ComplianceFrameworkRow>(
        "SELECT * FROM compliance_frameworks WHERE originating_pack_id IS NULL OR originating_pack_id = ANY($1::uuid[]) ORDER BY code",
        [packIds]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[complianceDB] findApplicableFrameworks error", err as Error);
      return { error: err as Error };
    }
  },

  async findRequirementsByFrameworkCodes(frameworkCodes: string[]): Promise<DbResult<ComplianceRequirementRow[]>> {
    if (frameworkCodes.length === 0) return { data: [] };
    try {
      const { rows } = await query<ComplianceRequirementRow>("SELECT * FROM compliance_requirements WHERE framework_code = ANY($1) ORDER BY code", [frameworkCodes]);
      return { data: rows };
    } catch (err) {
      logger.error("[complianceDB] findRequirementsByFrameworkCodes error", err as Error);
      return { error: err as Error };
    }
  },

  async findRequirementByCode(code: string): Promise<DbResult<ComplianceRequirementRow | null>> {
    try {
      const { rows } = await query<ComplianceRequirementRow>("SELECT * FROM compliance_requirements WHERE code = $1", [code]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[complianceDB] findRequirementByCode error", err as Error);
      return { error: err as Error };
    }
  },

  async grantWaiver(input: { seuId: string; requirementCode: string; rationale: string; grantedBy?: number | null; expiresAt?: string | null }): Promise<DbResult<ComplianceWaiverRow>> {
    try {
      const { rows } = await query<ComplianceWaiverRow>(
        `INSERT INTO compliance_waivers (seu_id, requirement_code, rationale, granted_by, expires_at)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [input.seuId, input.requirementCode, input.rationale, input.grantedBy ?? null, input.expiresAt ?? null]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[complianceDB] grantWaiver error", err as Error);
      return { error: err as Error };
    }
  },

  async findActiveWaivers(seuId: string): Promise<DbResult<ComplianceWaiverRow[]>> {
    try {
      const { rows } = await query<ComplianceWaiverRow>(
        "SELECT * FROM compliance_waivers WHERE seu_id = $1 AND status = 'Active' AND (expires_at IS NULL OR expires_at > NOW())",
        [seuId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[complianceDB] findActiveWaivers error", err as Error);
      return { error: err as Error };
    }
  },

  async recordEvaluation(input: { seuId: string; status: ComplianceStatus; rationale: Record<string, unknown>; results: unknown[] }): Promise<DbResult<ComplianceEvaluationRow>> {
    try {
      const { rows } = await query<ComplianceEvaluationRow>(
        "INSERT INTO compliance_evaluations (seu_id, status, rationale, results) VALUES ($1, $2, $3, $4) RETURNING *",
        [input.seuId, input.status, JSON.stringify(input.rationale), JSON.stringify(input.results)]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[complianceDB] recordEvaluation error", err as Error);
      return { error: err as Error };
    }
  },

  async findLatestEvaluation(seuId: string): Promise<DbResult<ComplianceEvaluationRow | null>> {
    try {
      const { rows } = await query<ComplianceEvaluationRow>("SELECT * FROM compliance_evaluations WHERE seu_id = $1 ORDER BY created_at DESC LIMIT 1", [seuId]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[complianceDB] findLatestEvaluation error", err as Error);
      return { error: err as Error };
    }
  },

  async findEvaluationHistory(seuId: string): Promise<DbResult<ComplianceEvaluationRow[]>> {
    try {
      const { rows } = await query<ComplianceEvaluationRow>("SELECT * FROM compliance_evaluations WHERE seu_id = $1 ORDER BY created_at DESC", [seuId]);
      return { data: rows };
    } catch (err) {
      logger.error("[complianceDB] findEvaluationHistory error", err as Error);
      return { error: err as Error };
    }
  },
};
