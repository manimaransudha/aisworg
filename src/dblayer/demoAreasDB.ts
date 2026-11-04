import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult } from "./seuTypes.js";

export interface DemoAreaRow {
  id: string;
  tenant_id: string;
  area: string;
  stage_title: string;
  how_to_lead: string;
  how_to_steps: Array<{ text: string }>;
  author_id: string;
  author_badge: string;
  created_at: string;
  updated_at: string;
}

export const demoAreasDB = {
  async insertMany(rows: Array<{ tenantId: string; area: string; stageTitle: string; howToLead: string; howToSteps: Array<{ text: string }>; authorId: string; authorBadge: string }>): Promise<DbResult<DemoAreaRow[]>> {
    if (rows.length === 0) return { data: [] };
    try {
      const values: unknown[] = [];
      const tuples = rows.map((r, i) => {
        values.push(r.tenantId, r.area, r.stageTitle, r.howToLead, JSON.stringify(r.howToSteps), r.authorId, r.authorBadge);
        const o = i * 7;
        return `(${Array.from({ length: 7 }, (_, j) => `$${o + j + 1}`).join(", ")})`;
      });
      const { rows: inserted } = await query<DemoAreaRow>(
        `INSERT INTO demo_areas (tenant_id, area, stage_title, how_to_lead, how_to_steps, author_id, author_badge) VALUES ${tuples.join(", ")} RETURNING *`,
        values
      );
      return { data: inserted };
    } catch (err) {
      logger.error("[demoAreasDB] insertMany error", err as Error);
      return { error: err as Error };
    }
  },

  async findByTenant(tenantId: string): Promise<DbResult<DemoAreaRow[]>> {
    try {
      const { rows } = await query<DemoAreaRow>("SELECT * FROM demo_areas WHERE tenant_id = $1", [tenantId]);
      return { data: rows };
    } catch (err) {
      logger.error("[demoAreasDB] findByTenant error", err as Error);
      return { error: err as Error };
    }
  },

  async update(tenantId: string, area: string, input: { stageTitle: string; howToLead: string; howToSteps: Array<{ text: string }> }): Promise<DbResult<DemoAreaRow | null>> {
    try {
      const { rows } = await query<DemoAreaRow>(
        `UPDATE demo_areas SET stage_title = $3, how_to_lead = $4, how_to_steps = $5, updated_at = NOW()
         WHERE tenant_id = $1 AND area = $2 RETURNING *`,
        [tenantId, area, input.stageTitle, input.howToLead, JSON.stringify(input.howToSteps)]
      );
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[demoAreasDB] update error", err as Error);
      return { error: err as Error };
    }
  },
};
