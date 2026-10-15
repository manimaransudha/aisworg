import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult } from "./seuTypes.js";

export interface DemoPlaybookRow {
  id: string;
  tenant_id: string;
  code: string;
  title: string;
  steps: string[];
  enabled: boolean;
  author_id: string;
  author_badge: string;
  created_at: string;
  updated_at: string;
}

export const demoPlaybooksDB = {
  async upsert(input: {
    tenantId: string;
    code: string;
    title: string;
    steps: string[];
    enabled?: boolean;
    authorId: string;
    authorBadge: string;
  }): Promise<DbResult<DemoPlaybookRow>> {
    try {
      const { rows } = await query<DemoPlaybookRow>(
        `INSERT INTO demo_playbooks (tenant_id, code, title, steps, enabled, author_id, author_badge)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (code, tenant_id) DO UPDATE
           SET title = EXCLUDED.title, steps = EXCLUDED.steps, enabled = EXCLUDED.enabled, updated_at = NOW()
         RETURNING *`,
        [input.tenantId, input.code, input.title, JSON.stringify(input.steps), input.enabled ?? true, input.authorId, input.authorBadge]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[demoPlaybooksDB] upsert error", err as Error);
      return { error: err as Error };
    }
  },

  async insertMany(rows: Array<{ tenantId: string; code: string; title: string; steps: string[]; enabled?: boolean; authorId: string; authorBadge: string }>): Promise<DbResult<DemoPlaybookRow[]>> {
    if (rows.length === 0) return { data: [] };
    try {
      const values: unknown[] = [];
      const tuples = rows.map((r, i) => {
        values.push(r.tenantId, r.code, r.title, JSON.stringify(r.steps), r.enabled ?? true, r.authorId, r.authorBadge);
        const o = i * 7;
        return `(${Array.from({ length: 7 }, (_, j) => `$${o + j + 1}`).join(", ")})`;
      });
      const { rows: inserted } = await query<DemoPlaybookRow>(
        `INSERT INTO demo_playbooks (tenant_id, code, title, steps, enabled, author_id, author_badge) VALUES ${tuples.join(", ")} RETURNING *`,
        values
      );
      return { data: inserted };
    } catch (err) {
      logger.error("[demoPlaybooksDB] insertMany error", err as Error);
      return { error: err as Error };
    }
  },

  async findByTenant(tenantId: string, opts: { enabledOnly?: boolean } = {}): Promise<DbResult<DemoPlaybookRow[]>> {
    try {
      const { rows } = await query<DemoPlaybookRow>(
        `SELECT * FROM demo_playbooks WHERE tenant_id = $1 ${opts.enabledOnly ? "AND enabled = TRUE" : ""} ORDER BY code`,
        [tenantId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[demoPlaybooksDB] findByTenant error", err as Error);
      return { error: err as Error };
    }
  },

  async findByCode(tenantId: string, code: string): Promise<DbResult<DemoPlaybookRow | null>> {
    try {
      const { rows } = await query<DemoPlaybookRow>("SELECT * FROM demo_playbooks WHERE tenant_id = $1 AND code = $2", [tenantId, code]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[demoPlaybooksDB] findByCode error", err as Error);
      return { error: err as Error };
    }
  },
};
