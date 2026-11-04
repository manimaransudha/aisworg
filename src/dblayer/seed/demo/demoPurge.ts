import pool from "../../../utils/db.js";
import { logger } from "../../../utils/logger.js";
import { DEMO_PARTICIPANT_DISPLAY_NAME } from "./demoBadges.js";
import { DEMO_PURGE_PLAN, DEMO_PURGE_NULLED_REFERENCES, DEMO_CATALOGUE_TABLES, type DemoPurgeStep } from "../../constants.js";

// Rows the Demo purge must never delete: the tenant itself, identities and the
// tenant-level contract and alias rows (DECISIONS.md, Part 1).
const PROTECTED_TABLES = new Set(["tenants", "users", "participants_master", "tenant_contracts", "tenant_concept_aliases", ...DEMO_CATALOGUE_TABLES]);

const q = (identifier: string): string => `"${identifier.replace(/"/g, '""')}"`;

const planByTable = new Map(DEMO_PURGE_PLAN.map((step) => [step.table, step]));

// The rows of a table that belong to the Demo tenant. $1 is the Demo tenant id and $2 the Demo SEU ids.
function predicateFor(step: DemoPurgeStep): string {
  const t = q(step.table);
  switch (step.scope) {
    case "tenant": return `${t}.tenant_id::text = $1::text`;
    case "sponsoring": return `${t}.sponsoring_authority->>'tenant' = $1::text`;
    case "seu": return `${t}.seu_id::text = ANY($2::text[])`;
    case "seus": return `${t}.id::text = ANY($2::text[])`;
    case "via":
      return (step.via ?? [])
        .map((v) => {
          const parent = planByTable.get(v.parent);
          if (!parent) throw new Error(`[seed:demo] purge: ${step.table} references ${v.parent}, which is not in DEMO_PURGE_PLAN`);
          return `${t}.${q(v.column)}::text IN (SELECT ${q(v.parent)}.${q(v.parentColumn)}::text FROM ${q(v.parent)} WHERE ${predicateFor(parent)})`;
        })
        .join(" OR ");
  }
}

// Deletes Demo-tenant rows only, table by table in the order of DEMO_PURGE_PLAN. A table that carries
// a tenant, SEU or sponsoring column and is missing from the plan stops the purge before anything is deleted.
export async function purgeDemoTenant(demoTenantId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: scopedRows } = await client.query<{ table_name: string }>(
      `SELECT DISTINCT c.table_name
         FROM information_schema.columns c
         JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
        WHERE c.table_schema = 'public' AND c.column_name IN ('tenant_id', 'sponsoring_authority', 'seu_id')`
    );
    const missing = scopedRows.map((r) => r.table_name).filter((name) => !PROTECTED_TABLES.has(name) && !planByTable.has(name));
    if (missing.length > 0) throw new Error(`[seed:demo] purge: table(s) missing from DEMO_PURGE_PLAN: ${missing.join(", ")}`);

    const { rows: seuRows } = await client.query<{ id: string }>(
      `SELECT s.id FROM seus s
        WHERE s.tenant_id::text = $1::text
           OR s.objective_id::text IN (SELECT o.id::text FROM objectives o WHERE o.sponsoring_authority->>'tenant' = $1::text)`,
      [demoTenantId]
    );
    const demoSeuIds = seuRows.map((r) => r.id);
    const paramsFor = (sql: string): unknown[] => (sql.includes("$2") ? [demoTenantId, demoSeuIds] : [demoTenantId]);

    for (const ref of DEMO_PURGE_NULLED_REFERENCES) {
      const parent = planByTable.get(ref.parent);
      const owner = planByTable.get(ref.table);
      if (!parent || !owner) throw new Error(`[seed:demo] purge: ${ref.table}.${ref.column} is not covered by DEMO_PURGE_PLAN`);
      const sql = `UPDATE ${q(ref.table)} SET ${q(ref.column)} = NULL WHERE ${q(ref.table)}.${q(ref.column)}::text IN (SELECT ${q(ref.parent)}.${q(ref.parentColumn)}::text FROM ${q(ref.parent)} WHERE ${predicateFor(parent)}) AND $1::text IS NOT NULL`;
      await client.query(sql, paramsFor(sql));
    }

    let deleted = 0;
    for (const step of DEMO_PURGE_PLAN) {
      const sql = `DELETE FROM ${q(step.table)} WHERE ($1::text IS NOT NULL) AND (${predicateFor(step)})`;
      const result = await client.query(sql, paramsFor(sql));
      deleted += result.rowCount ?? 0;
    }

    // The Demo User participant stays; its badges are cleared and SEU references dropped from its roles.
    const cleared = await client.query(
      `UPDATE participants_master
          SET authorised_badges = '[]'::jsonb,
              authorised_role = COALESCE((SELECT jsonb_agg(jsonb_set(r, '{seu_ids}', '[]'::jsonb)) FROM jsonb_array_elements(authorised_role) AS r), '[]'::jsonb),
              updated_at = NOW()
        WHERE tenant_id::text = $1::text AND display_name = $2`,
      [demoTenantId, DEMO_PARTICIPANT_DISPLAY_NAME]
    );

    await client.query("COMMIT");
    logger.info(`[seed:demo] purge — cleared badges on ${cleared.rowCount} Demo User participant(s); deleted ${deleted} Demo-tenant rows.`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
