import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult } from "./seuTypes.js";

export interface DemoScenarioRow {
  id: string;
  tenant_id: string;
  code: string;
  area: string;
  title: string;
  playbook: string[];
  progress: number;
  enabled: boolean;
  sort_order: number;
  author_id: string;
  author_badge: string;
  created_at: string;
  updated_at: string;
}

export const demoScenariosDB = {
  async upsert(input: {
    tenantId: string;
    code: string;
    area: string;
    title: string;
    playbook: string[];
    enabled?: boolean;
    sortOrder: number;
    authorId: string;
    authorBadge: string;
  }): Promise<DbResult<DemoScenarioRow>> {
    try {
      const { rows } = await query<DemoScenarioRow>(
        `INSERT INTO demo_scenarios (tenant_id, code, area, title, playbook, enabled, sort_order, author_id, author_badge)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (code, tenant_id) DO UPDATE
           SET area = EXCLUDED.area, title = EXCLUDED.title, playbook = EXCLUDED.playbook, enabled = EXCLUDED.enabled, sort_order = EXCLUDED.sort_order, updated_at = NOW()
         RETURNING *`,
        [input.tenantId, input.code, input.area, input.title, JSON.stringify(input.playbook), input.enabled ?? true, input.sortOrder, input.authorId, input.authorBadge]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[demoScenariosDB] upsert error", err as Error);
      return { error: err as Error };
    }
  },

  async insertMany(rows: Array<{ tenantId: string; code: string; area: string; title: string; playbook: string[]; enabled?: boolean; sortOrder: number; authorId: string; authorBadge: string }>): Promise<DbResult<DemoScenarioRow[]>> {
    if (rows.length === 0) return { data: [] };
    try {
      const values: unknown[] = [];
      const tuples = rows.map((r, i) => {
        values.push(r.tenantId, r.code, r.area, r.title, JSON.stringify(r.playbook), r.enabled ?? true, r.sortOrder, r.authorId, r.authorBadge);
        const o = i * 9;
        return `(${Array.from({ length: 9 }, (_, j) => `$${o + j + 1}`).join(", ")})`;
      });
      const { rows: inserted } = await query<DemoScenarioRow>(
        `INSERT INTO demo_scenarios (tenant_id, code, area, title, playbook, enabled, sort_order, author_id, author_badge) VALUES ${tuples.join(", ")} RETURNING *`,
        values
      );
      return { data: inserted };
    } catch (err) {
      logger.error("[demoScenariosDB] insertMany error", err as Error);
      return { error: err as Error };
    }
  },

  async findByTenant(tenantId: string, opts: { enabledOnly?: boolean } = {}): Promise<DbResult<DemoScenarioRow[]>> {
    try {
      const { rows } = await query<DemoScenarioRow>(
        `SELECT * FROM demo_scenarios WHERE tenant_id = $1 ${opts.enabledOnly ? "AND enabled = TRUE" : ""} ORDER BY sort_order, code`,
        [tenantId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[demoScenariosDB] findByTenant error", err as Error);
      return { error: err as Error };
    }
  },

  async findByCode(tenantId: string, code: string): Promise<DbResult<DemoScenarioRow | null>> {
    try {
      const { rows } = await query<DemoScenarioRow>("SELECT * FROM demo_scenarios WHERE tenant_id = $1 AND code = $2", [tenantId, code]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[demoScenariosDB] findByCode error", err as Error);
      return { error: err as Error };
    }
  },

  async setProgress(tenantId: string, code: string, progress: number): Promise<DbResult<DemoScenarioRow | null>> {
    try {
      const { rows } = await query<DemoScenarioRow>(
        "UPDATE demo_scenarios SET progress = $3, updated_at = NOW() WHERE tenant_id = $1 AND code = $2 RETURNING *",
        [tenantId, code, progress]
      );
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[demoScenariosDB] setProgress error", err as Error);
      return { error: err as Error };
    }
  },

  async insert(input: { tenantId: string; code: string; area: string; title: string; playbook: string[]; sortOrder: number; authorId: string; authorBadge: string }): Promise<DbResult<DemoScenarioRow>> {
    try {
      const { rows } = await query<DemoScenarioRow>(
        `INSERT INTO demo_scenarios (tenant_id, code, area, title, playbook, sort_order, author_id, author_badge)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [input.tenantId, input.code, input.area, input.title, JSON.stringify(input.playbook), input.sortOrder, input.authorId, input.authorBadge]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[demoScenariosDB] insert error", err as Error);
      return { error: err as Error };
    }
  },

  async update(tenantId: string, code: string, input: { title: string; playbook: string[]; sortOrder: number }): Promise<DbResult<DemoScenarioRow | null>> {
    try {
      const { rows } = await query<DemoScenarioRow>(
        `UPDATE demo_scenarios SET title = $3, playbook = $4, sort_order = $5, updated_at = NOW()
         WHERE tenant_id = $1 AND code = $2 RETURNING *`,
        [tenantId, code, input.title, JSON.stringify(input.playbook), input.sortOrder]
      );
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[demoScenariosDB] update error", err as Error);
      return { error: err as Error };
    }
  },

  async setEnabled(tenantId: string, code: string, enabled: boolean): Promise<DbResult<DemoScenarioRow | null>> {
    try {
      const { rows } = await query<DemoScenarioRow>(
        "UPDATE demo_scenarios SET enabled = $3, updated_at = NOW() WHERE tenant_id = $1 AND code = $2 RETURNING *",
        [tenantId, code, enabled]
      );
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[demoScenariosDB] setEnabled error", err as Error);
      return { error: err as Error };
    }
  },

  async resetProgress(tenantId: string): Promise<DbResult<number>> {
    try {
      const result = await query("UPDATE demo_scenarios SET progress = 0, updated_at = NOW() WHERE tenant_id = $1 AND progress <> 0", [tenantId]);
      return { data: result.rowCount ?? 0 };
    } catch (err) {
      logger.error("[demoScenariosDB] resetProgress error", err as Error);
      return { error: err as Error };
    }
  },
};
