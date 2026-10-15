import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult } from "./seuTypes.js";

export interface DemoScenarioRow {
  id: string;
  tenant_id: string;
  code: string;
  kind: string;
  title: string;
  description: string | null;
  category: string | null;
  severity: string | null;
  priority: string | null;
  target: Record<string, unknown>;
  payload: Record<string, unknown>;
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
    kind: string;
    title: string;
    description?: string | null;
    category?: string | null;
    severity?: string | null;
    priority?: string | null;
    target?: Record<string, unknown>;
    payload?: Record<string, unknown>;
    enabled?: boolean;
    sortOrder?: number;
    authorId: string;
    authorBadge: string;
  }): Promise<DbResult<DemoScenarioRow>> {
    try {
      const { rows } = await query<DemoScenarioRow>(
        `INSERT INTO demo_scenarios (tenant_id, code, kind, title, description, category, severity, priority, target, payload, enabled, sort_order, author_id, author_badge)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (code, tenant_id) DO UPDATE
           SET kind = EXCLUDED.kind, title = EXCLUDED.title, description = EXCLUDED.description,
               category = EXCLUDED.category, severity = EXCLUDED.severity, priority = EXCLUDED.priority,
               target = EXCLUDED.target, payload = EXCLUDED.payload, enabled = EXCLUDED.enabled,
               sort_order = EXCLUDED.sort_order, updated_at = NOW()
         RETURNING *`,
        [
          input.tenantId, input.code, input.kind, input.title, input.description ?? null,
          input.category ?? null, input.severity ?? null, input.priority ?? null,
          JSON.stringify(input.target ?? {}), JSON.stringify(input.payload ?? {}),
          input.enabled ?? true, input.sortOrder ?? 0, input.authorId, input.authorBadge,
        ]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[demoScenariosDB] upsert error", err as Error);
      return { error: err as Error };
    }
  },

  async insertMany(rows: Array<{
    tenantId: string;
    code: string;
    kind: string;
    title: string;
    description?: string | null;
    category?: string | null;
    severity?: string | null;
    priority?: string | null;
    target?: Record<string, unknown>;
    payload?: Record<string, unknown>;
    enabled?: boolean;
    sortOrder?: number;
    authorId: string;
    authorBadge: string;
  }>): Promise<DbResult<DemoScenarioRow[]>> {
    if (rows.length === 0) return { data: [] };
    try {
      const values: unknown[] = [];
      const tuples = rows.map((r, i) => {
        values.push(r.tenantId, r.code, r.kind, r.title, r.description ?? null, r.category ?? null, r.severity ?? null, r.priority ?? null,
          JSON.stringify(r.target ?? {}), JSON.stringify(r.payload ?? {}), r.enabled ?? true, r.sortOrder ?? 0, r.authorId, r.authorBadge);
        const o = i * 14;
        return `(${Array.from({ length: 14 }, (_, j) => `$${o + j + 1}`).join(", ")})`;
      });
      const { rows: inserted } = await query<DemoScenarioRow>(
        `INSERT INTO demo_scenarios (tenant_id, code, kind, title, description, category, severity, priority, target, payload, enabled, sort_order, author_id, author_badge)
         VALUES ${tuples.join(", ")} RETURNING *`,
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
};
