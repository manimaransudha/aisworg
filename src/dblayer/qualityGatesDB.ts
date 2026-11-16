import { query, withTransaction } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, QualityGateRow, TransitionEntityType } from "./seuTypes.js";

function bumpVersion(version: string): string {
  const [major, minor] = version.split(".").map((n) => parseInt(n, 10) || 0);
  return `${major}.${minor + 1}`;
}

export const qualityGatesDB = {
  // A gate is identified by its code within its originating Pack (CR-145). A change to any other field replaces the active row with the next version.
  async upsert(input: {
    code: string;
    name: string;
    category: string;
    entityType: TransitionEntityType;
    fromState: string;
    toState: string;
    criteria: Record<string, unknown>;
    originatingPackId: string;
    qualityGateDefinitionId?: string | null;
    checklistIds?: string[];
    recommendedChecklistIds?: string[];
    applicabilityDeliverableNames?: string[];
    authorId: string;
    authorBadge: string;
  }): Promise<DbResult<QualityGateRow>> {
    try {
      return await withTransaction(async () => {
        const { code, category, criteria } = input;
        const checklistIds = input.checklistIds ?? [];
        const recommendedChecklistIds = input.recommendedChecklistIds ?? [];
        const applicabilityDeliverableNames = input.applicabilityDeliverableNames ?? [];
        const { rows: currentRows } = await query<QualityGateRow>(
          "SELECT * FROM quality_gates WHERE code = $1 AND originating_pack_id = $2 AND is_active = true",
          [code, input.originatingPackId]
        );
        const current = currentRows[0];
        const unchanged =
          current &&
          current.name === input.name &&
          current.category === category &&
          current.entity_type === input.entityType &&
          current.from_state === input.fromState &&
          current.to_state === input.toState &&
          current.quality_gate_definition_id === (input.qualityGateDefinitionId ?? null) &&
          JSON.stringify(current.criteria) === JSON.stringify(criteria) &&
          JSON.stringify([...current.checklist_ids].sort()) === JSON.stringify([...checklistIds].sort()) &&
          JSON.stringify([...current.recommended_checklist_ids].sort()) === JSON.stringify([...recommendedChecklistIds].sort()) &&
          JSON.stringify([...current.applicability_deliverable_names].sort()) === JSON.stringify([...applicabilityDeliverableNames].sort());
        if (unchanged) {
          return { data: current };
        }
        const nextVersion = current ? bumpVersion(current.version) : "1.0";
        if (current) {
          await query("UPDATE quality_gates SET is_active = false WHERE id = $1", [current.id]);
        }
        const { rows } = await query<QualityGateRow>(
          `INSERT INTO quality_gates (code, name, category, entity_type, from_state, to_state, criteria, originating_pack_id, version, is_active, checklist_ids, recommended_checklist_ids, applicability_deliverable_names, author_id, author_badge, quality_gate_definition_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, $11, $12, $13, $14, $15)
           RETURNING *`,
          [code, input.name, category, input.entityType, input.fromState, input.toState, JSON.stringify(criteria), input.originatingPackId, nextVersion, checklistIds, recommendedChecklistIds, applicabilityDeliverableNames, input.authorId, input.authorBadge, input.qualityGateDefinitionId ?? null]
        );
        return { data: rows[0] };
      });
    } catch (err) {
      logger.error("[qualityGatesDB] upsert error", err as Error);
      return { error: err as Error };
    }
  },

  async findAllActive(entityType: TransitionEntityType, fromState: string, toState: string): Promise<DbResult<QualityGateRow[]>> {
    try {
      const { rows } = await query<QualityGateRow>(
        "SELECT * FROM quality_gates WHERE entity_type = $1 AND from_state = $2 AND to_state = $3 AND is_active = true",
        [entityType, fromState, toState]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[qualityGatesDB] findAllActive error", err as Error);
      return { error: err as Error };
    }
  },

  async findByPackIds(packIds: string[]): Promise<DbResult<QualityGateRow[]>> {
    if (packIds.length === 0) return { data: [] };
    try {
      const { rows } = await query<QualityGateRow>(
        "SELECT * FROM quality_gates WHERE originating_pack_id = ANY($1::uuid[]) AND is_active = true",
        [packIds]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[qualityGatesDB] findByPackIds error", err as Error);
      return { error: err as Error };
    }
  },

  async findAll(): Promise<DbResult<QualityGateRow[]>> {
    try {
      const { rows } = await query<QualityGateRow>("SELECT * FROM quality_gates WHERE is_active = true ORDER BY name");
      return { data: rows };
    } catch (err) {
      logger.error("[qualityGatesDB] findAll error", err as Error);
      return { error: err as Error };
    }
  },

  async findByCode(code: string): Promise<DbResult<QualityGateRow | null>> {
    try {
      const { rows } = await query<QualityGateRow>("SELECT * FROM quality_gates WHERE code = $1 AND is_active = true", [code]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[qualityGatesDB] findByCode error", err as Error);
      return { error: err as Error };
    }
  },

  async findByIds(ids: string[]): Promise<DbResult<QualityGateRow[]>> {
    try {
      if (ids.length === 0) return { data: [] };
      const { rows } = await query<QualityGateRow>("SELECT * FROM quality_gates WHERE id = ANY($1::uuid[])", [ids]);
      return { data: rows };
    } catch (err) {
      logger.error("[qualityGatesDB] findByIds error", err as Error);
      return { error: err as Error };
    }
  },
};
