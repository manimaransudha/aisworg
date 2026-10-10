import pool, { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, QualityGateRow, TransitionEntityType } from "./seuTypes.js";

function bumpVersion(version: string): string {
  const [major, minor] = version.split(".").map((n) => parseInt(n, 10) || 0);
  return `${major}.${minor + 1}`;
}

export const qualityGatesDB = {
  async upsert(input: {
    name: string;
    category?: string;
    entityType: TransitionEntityType;
    fromState: string;
    toState: string;
    criteria?: Record<string, unknown>;
    originatingPackId: string;
    checklistIds?: string[];
    recommendedChecklistIds?: string[];
    applicabilityDeliverableNames?: string[];
    authorId: string;
    authorBadge: string;
  }): Promise<DbResult<QualityGateRow>> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const category = input.category ?? "Exit";
      const code = category;
      const criteria = input.criteria ?? { type: "no_unresolved_obligations" };
      const checklistIds = input.checklistIds ?? [];
      const recommendedChecklistIds = input.recommendedChecklistIds ?? [];
      const applicabilityDeliverableNames = input.applicabilityDeliverableNames ?? [];
      const { rows: currentRows } = await client.query<QualityGateRow>(
        "SELECT * FROM quality_gates WHERE entity_type = $1 AND from_state = $2 AND to_state = $3 AND category = $4 AND originating_pack_id = $5 AND is_active = true",
        [input.entityType, input.fromState, input.toState, category, input.originatingPackId]
      );
      const current = currentRows[0];
      const unchanged =
        current &&
        current.name === input.name &&
        JSON.stringify(current.criteria) === JSON.stringify(criteria) &&
        JSON.stringify([...current.checklist_ids].sort()) === JSON.stringify([...checklistIds].sort()) &&
        JSON.stringify([...current.recommended_checklist_ids].sort()) === JSON.stringify([...recommendedChecklistIds].sort()) &&
        JSON.stringify([...current.applicability_deliverable_names].sort()) === JSON.stringify([...applicabilityDeliverableNames].sort());
      if (unchanged) {
        await client.query("COMMIT");
        return { data: current };
      }
      const nextVersion = current ? bumpVersion(current.version) : "1.0";
      if (current) {
        await client.query("UPDATE quality_gates SET is_active = false WHERE id = $1", [current.id]);
      }
      const { rows } = await client.query<QualityGateRow>(
        `INSERT INTO quality_gates (code, name, category, entity_type, from_state, to_state, criteria, originating_pack_id, version, is_active, checklist_ids, recommended_checklist_ids, applicability_deliverable_names, author_id, author_badge)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, $11, $12, $13, $14)
         RETURNING *`,
        [code, input.name, category, input.entityType, input.fromState, input.toState, JSON.stringify(criteria), input.originatingPackId, nextVersion, checklistIds, recommendedChecklistIds, applicabilityDeliverableNames, input.authorId, input.authorBadge]
      );
      await client.query("COMMIT");
      return { data: rows[0] };
    } catch (err) {
      await client.query("ROLLBACK");
      logger.error("[qualityGatesDB] upsert error", err as Error);
      return { error: err as Error };
    } finally {
      client.release();
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
