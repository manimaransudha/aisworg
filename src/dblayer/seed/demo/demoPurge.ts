import pool from "../../../utils/db.js";
import { logger } from "../../../utils/logger.js";
import { DEMO_PARTICIPANT_DISPLAY_NAME } from "./demoBadges.js";

// Rows the Demo purge must never delete: the tenant itself, identities and the
// tenant-level contract and alias rows (DECISIONS.md, Part 1).
const PROTECTED_TABLES = new Set(["tenants", "users", "participants_master", "tenant_contracts", "tenant_concept_aliases"]);

interface ForeignKey {
  child: string;
  childColumn: string;
  parent: string;
  parentColumn: string;
  nullable: boolean;
}

const q = (identifier: string): string => `"${identifier.replace(/"/g, '""')}"`;

// Deletes Demo-tenant rows only, in this order:
//   1. every row that references an SEU commissioned against a Demo Objective, then those SEUs;
//   2. the Demo Profiles, Templates and Packs;
//   3. every other Demo-tenant table;
//   4. the Demo Objectives, last.
// Dependants of each row set are found from the live foreign keys and deleted before it.
// A seu_id column with no foreign key is treated as a reference to seus. A reference that
// loops back to a row set already being deleted is nulled instead of deleted.
export async function purgeDemoTenant(demoTenantId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: columnRows } = await client.query<{ table_name: string; column_name: string }>(
      `SELECT c.table_name, c.column_name
         FROM information_schema.columns c
         JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
        WHERE c.table_schema = 'public' AND c.column_name IN ('tenant_id', 'sponsoring_authority', 'seu_id')`
    );
    const tenantPredicate = new Map<string, string>();
    const seuIdTables: string[] = [];
    for (const { table_name, column_name } of columnRows) {
      if (PROTECTED_TABLES.has(table_name)) continue;
      if (column_name === "seu_id") seuIdTables.push(table_name);
      else if (column_name === "tenant_id") tenantPredicate.set(table_name, `${q(table_name)}.tenant_id::text = $1::text`);
      else if (!tenantPredicate.has(table_name)) tenantPredicate.set(table_name, `${q(table_name)}.sponsoring_authority->>'tenant' = $1::text`);
    }

    const { rows: fkRows } = await client.query<{ child: string; child_column: string; parent: string; parent_column: string; nullable: boolean }>(
      `SELECT cl.relname AS child, cc.attname AS child_column, pl.relname AS parent, pc.attname AS parent_column, NOT cc.attnotnull AS nullable
         FROM pg_constraint con
         JOIN pg_class cl ON cl.oid = con.conrelid
         JOIN pg_class pl ON pl.oid = con.confrelid
         JOIN pg_namespace n ON n.oid = cl.relnamespace
         JOIN pg_attribute cc ON cc.attrelid = cl.oid AND cc.attnum = con.conkey[1]
         JOIN pg_attribute pc ON pc.attrelid = pl.oid AND pc.attnum = con.confkey[1]
        WHERE con.contype = 'f' AND n.nspname = 'public' AND array_length(con.conkey, 1) = 1`
    );
    const fks: ForeignKey[] = fkRows.map((r) => ({ child: r.child, childColumn: r.child_column, parent: r.parent, parentColumn: r.parent_column, nullable: r.nullable }));
    for (const table of seuIdTables) {
      if (table !== "seus" && !fks.some((f) => f.child === table && f.childColumn === "seu_id")) {
        fks.push({ child: table, childColumn: "seu_id", parent: "seus", parentColumn: "id", nullable: false });
      }
    }

    // Foreign-key cycles between tables are broken once, up front, on a nullable column.
    // A broken reference is nulled for the rows about to be deleted instead of being followed.
    const broken = new Set<ForeignKey>();
    const liveEdges = (): ForeignKey[] => fks.filter((f) => f.child !== f.parent && !PROTECTED_TABLES.has(f.child) && !PROTECTED_TABLES.has(f.parent) && !broken.has(f));
    const findCycle = (): ForeignKey[] | null => {
      const edges = liveEdges();
      const state = new Map<string, "visiting" | "done">();
      const stack: ForeignKey[] = [];
      const visit = (table: string): ForeignKey[] | null => {
        state.set(table, "visiting");
        for (const edge of edges.filter((e) => e.parent === table)) {
          if (state.get(edge.child) === "visiting") {
            const start = stack.findIndex((e) => e.parent === edge.child);
            return [...stack.slice(start < 0 ? 0 : start), edge];
          }
          if (state.get(edge.child) === "done") continue;
          stack.push(edge);
          const found = visit(edge.child);
          if (found) return found;
          stack.pop();
        }
        state.set(table, "done");
        return null;
      };
      for (const table of new Set(edges.flatMap((e) => [e.child, e.parent]))) {
        if (!state.has(table)) {
          const found = visit(table);
          if (found) return found;
        }
      }
      return null;
    };
    for (let cycle = findCycle(); cycle; cycle = findCycle()) {
      const edge = cycle.find((e) => e.nullable);
      if (!edge) throw new Error(`[seed:demo] purge: foreign-key cycle with no nullable column: ${cycle.map((e) => `${e.child}.${e.childColumn}`).join(" -> ")}`);
      broken.add(edge);
    }

    let deleted = 0;
    const handled = new Set<string>();

    // Deletes the rows of `table` matching `predicate`, after their dependants.
    const deleteRows = async (table: string, predicate: string): Promise<void> => {
      for (const fk of fks.filter((f) => f.parent === table && f.child !== table && !PROTECTED_TABLES.has(f.child))) {
        const reference = `${q(fk.child)}.${q(fk.childColumn)}::text IN (SELECT ${q(table)}.${q(fk.parentColumn)}::text FROM ${q(table)} WHERE ${predicate})`;
        if (broken.has(fk)) {
          await client.query(`UPDATE ${q(fk.child)} SET ${q(fk.childColumn)} = NULL WHERE ${reference}`, paramsFor(predicate));
        } else {
          await deleteRows(fk.child, reference);
        }
      }
      const result = await client.query(`DELETE FROM ${q(table)} WHERE ${predicate}`, paramsFor(predicate));
      deleted += result.rowCount ?? 0;
    };

    // Statements use $1 (Demo tenant id) and, for the SEU step, $2 (Demo SEU ids).
    let demoSeuIds: string[] = [];
    const paramsFor = (predicate: string): unknown[] => (predicate.includes("$2") ? [demoTenantId, demoSeuIds] : [demoTenantId]);

    const { rows: seuRows } = await client.query<{ id: string }>(
      `SELECT s.id FROM seus s
        WHERE s.tenant_id::text = $1::text
           OR s.objective_id::text IN (SELECT o.id::text FROM objectives o WHERE ${tenantPredicate.get("objectives")?.replace('"objectives"', "o") ?? "FALSE"})`,
      [demoTenantId]
    );
    demoSeuIds = seuRows.map((r) => r.id);

    if (demoSeuIds.length > 0) await deleteRows("seus", `$1::text IS NOT NULL AND ${q("seus")}.id::text = ANY($2::text[])`);
    for (const table of ["profiles", "templates", "packs"]) {
      const predicate = tenantPredicate.get(table);
      if (predicate) {
        await deleteRows(table, predicate);
        handled.add(table);
      }
    }
    for (const [table, predicate] of tenantPredicate) {
      if (table === "objectives" || handled.has(table)) continue;
      await deleteRows(table, predicate);
      handled.add(table);
    }
    const objectivePredicate = tenantPredicate.get("objectives");
    if (objectivePredicate) await deleteRows("objectives", objectivePredicate);

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
