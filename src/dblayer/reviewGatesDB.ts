import { query, withTransaction } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, ReviewGateRow, TransitionEntityType } from "./seuTypes.js";
import { getPlatformTenantId } from "./constants.js";

function bumpVersion(version: string): string {
  const [major, minor] = version.split(".").map((n) => parseInt(n, 10) || 0);
  return `${major}.${minor + 1}`;
}

export const reviewGatesDB = {
  async upsert(input: {
    code: string;
    name: string;
    entityType: TransitionEntityType;
    fromState: string;
    toState: string;
    originatingPackId: string;
    checklistIds?: string[];
    recommendedChecklistIds?: string[];
    authorId: string;
    authorBadge: string;
  }): Promise<DbResult<ReviewGateRow>> {
    try {
      return await withTransaction(async () => {
        const checklistIds = input.checklistIds ?? [];
        const recommendedChecklistIds = input.recommendedChecklistIds ?? [];
        const { rows: currentRows } = await query<ReviewGateRow>(
          "SELECT * FROM review_gates WHERE entity_type = $1 AND from_state = $2 AND to_state = $3 AND code = $4 AND is_active = true",
          [input.entityType, input.fromState, input.toState, input.code]
        );
        const current = currentRows[0];
        const unchanged =
          current &&
          current.name === input.name &&
          JSON.stringify([...current.checklist_ids].sort()) === JSON.stringify([...checklistIds].sort()) &&
          JSON.stringify([...current.recommended_checklist_ids].sort()) === JSON.stringify([...recommendedChecklistIds].sort());
        if (unchanged) {
          return { data: current };
        }
        const nextVersion = current ? bumpVersion(current.version) : "1.0";
        if (current) {
          await query("UPDATE review_gates SET is_active = false WHERE id = $1", [current.id]);
        }
        const { rows } = await query<ReviewGateRow>(
          `INSERT INTO review_gates (code, name, entity_type, from_state, to_state, originating_pack_id, version, is_active, checklist_ids, recommended_checklist_ids, author_id, author_badge)
           VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9, $10, $11)
           RETURNING *`,
          [input.code, input.name, input.entityType, input.fromState, input.toState, input.originatingPackId, nextVersion, checklistIds, recommendedChecklistIds, input.authorId, input.authorBadge]
        );
        return { data: rows[0] };
      });
    } catch (err) {
      logger.error("[reviewGatesDB] upsert error", err as Error);
      return { error: err as Error };
    }
  },

  async findById(id: string): Promise<DbResult<ReviewGateRow | null>> {
    try {
      const { rows } = await query<ReviewGateRow>("SELECT * FROM review_gates WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[reviewGatesDB] findById error", err as Error);
      return { error: err as Error };
    }
  },

  // The active review gates of Active Packs owned by the Platform or by the viewer's tenant. A null viewer tenant sees every Pack.
  async findActiveVisibleTo(viewerTenantId: string | null): Promise<DbResult<ReviewGateRow[]>> {
    try {
      const platformTenantId = await getPlatformTenantId();
      const { rows } = await query<ReviewGateRow>(
        `SELECT g.* FROM review_gates g JOIN packs p ON p.id = g.originating_pack_id
         WHERE g.is_active = true AND p.status = 'Active' AND ($1::uuid IS NULL OR p.tenant_id = $1 OR p.tenant_id = $2)
         ORDER BY g.code, (p.tenant_id = $1) DESC, g.created_at DESC`,
        [viewerTenantId, platformTenantId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[reviewGatesDB] findActiveVisibleTo error", err as Error);
      return { error: err as Error };
    }
  },

  async findAll(): Promise<DbResult<ReviewGateRow[]>> {
    try {
      const { rows } = await query<ReviewGateRow>("SELECT * FROM review_gates WHERE is_active = true ORDER BY name");
      return { data: rows };
    } catch (err) {
      logger.error("[reviewGatesDB] findAll error", err as Error);
      return { error: err as Error };
    }
  },
};
