// CR-006 — wipe + reseed the transition_definitions graph fresh from
// transitionDefinitions.json. Kept SEPARATE and atomic (owner's request) so
// db:clean-slate can rebuild the graph instead of preserving it: the live
// table accumulates hundreds of test-fixture rows (StdFrom-*/PolFrom-*/
// policy-waiver-from-* etc.), and a reset should land on exactly the seeded
// set. Runs as a step of cleanSlate.ts, and standalone:
//   pnpm seed:transition-definitions   (npx tsx src/dblayer/seed/seedTransitionDefinitions.ts)
//
// Atomic wipe+reseed in ONE transaction — transition_definitions is app-
// critical (an empty graph blocks every transition), so it is never left
// empty between a wipe and the reseed.
//
// 2026-08-25 (owner) — dev/test seed data, not production: an unresolvable
// requiredAuthorityRuleCode/requiredPolicyCodes entry no longer fails the
// whole seed. The only Pack that ever created most of these codes
// (core-engineering.pack.json) predates 69 CRs of real design work and
// isn't the source of truth anymore. Left null/[] instead, and self-heals:
// core/packs.ts's seedContributions calls backfillAuthorityRuleCode/
// backfillPolicyCode right after upserting each real Authority Rule/Policy
// during any Pack publish — if that Pack's own code happens to be one this
// file wanted, the transition_definitions row gets wired up then, whichever
// Pack it comes from.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pool, { query } from "../../utils/db.js";
import { logger } from "../../utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface TransitionDefinitionSeed {
  entityType: string;
  fromState: string;
  toState: string;
  requiredAuthorityRuleCode: string | null;
  requiredPolicyCodes?: string[];
  // CR-072 — trigger defaults to "manual" (the DB column's own default,
  // accurate for every row unless stated otherwise here); submitVerb stays
  // undefined/null except on the one row that actually has a real Submit
  // step defined (badge = entityType + '_' + submitVerb).
  trigger?: "manual" | "governed";
  submitVerb?: string;
}

let cachedSeeds: TransitionDefinitionSeed[] | null = null;
function loadSeeds(): TransitionDefinitionSeed[] {
  if (!cachedSeeds) {
    const raw = readFileSync(path.join(__dirname, "data", "transitionDefinitions.json"), "utf8");
    cachedSeeds = JSON.parse(raw) as TransitionDefinitionSeed[];
  }
  return cachedSeeds;
}

// Self-healing backfill — called from core/packs.ts's seedContributions
// right after a real Authority Rule/Policy is upserted during any Pack
// publish. Wires the newly-real id onto whichever transition_definitions
// row(s) transitionDefinitions.json originally wanted that code for, no
// matter which Pack ends up being the one that actually declares it.
export async function backfillAuthorityRuleCode(code: string, authorityRuleId: string): Promise<void> {
  const wanting = loadSeeds().filter((s) => s.requiredAuthorityRuleCode === code);
  for (const seed of wanting) {
    await query(
      `UPDATE transition_definitions SET required_authority_rule_id = $4
       WHERE entity_type = $1 AND from_state = $2 AND to_state = $3`,
      [seed.entityType, seed.fromState, seed.toState, authorityRuleId]
    );
  }
}

export async function backfillPolicyCode(code: string, policyId: string): Promise<void> {
  const wanting = loadSeeds().filter((s) => (s.requiredPolicyCodes ?? []).includes(code));
  for (const seed of wanting) {
    await query(
      `UPDATE transition_definitions
          SET required_policy_ids = CASE WHEN $4::uuid = ANY(required_policy_ids) THEN required_policy_ids ELSE array_append(required_policy_ids, $4::uuid) END
        WHERE entity_type = $1 AND from_state = $2 AND to_state = $3`,
      [seed.entityType, seed.fromState, seed.toState, policyId]
    );
  }
}

export async function seedTransitionDefinitions(): Promise<void> {
  const seeds = loadSeeds();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const wiped = await client.query("DELETE FROM transition_definitions");

    for (const seed of seeds) {
      let ruleId: string | null = null;
      if (seed.requiredAuthorityRuleCode) {
        const { rows } = await client.query("SELECT id FROM authority_rules WHERE code = $1", [seed.requiredAuthorityRuleCode]);
        if (rows[0]) ruleId = rows[0].id as string;
      }

      const policyIds: string[] = [];
      for (const code of seed.requiredPolicyCodes ?? []) {
        const { rows } = await client.query("SELECT id FROM policies WHERE code = $1", [code]);
        if (rows[0]) policyIds.push(rows[0].id as string);
      }

      await client.query(
        `INSERT INTO transition_definitions (entity_type, from_state, to_state, required_authority_rule_id, required_policy_ids, trigger, submit_verb)
         VALUES ($1, $2, $3, $4, $5::uuid[], $6, $7)
         ON CONFLICT (entity_type, from_state, to_state)
         DO UPDATE SET required_authority_rule_id = EXCLUDED.required_authority_rule_id,
                       required_policy_ids = EXCLUDED.required_policy_ids,
                       trigger = EXCLUDED.trigger,
                       submit_verb = EXCLUDED.submit_verb`,
        [seed.entityType, seed.fromState, seed.toState, ruleId, policyIds, seed.trigger ?? "manual", seed.submitVerb ?? null]
      );
    }

    await client.query("COMMIT");
    logger.info(`[seed:transition-definitions] wiped ${wiped.rowCount} rows, seeded ${seeds.length} fresh transition definitions.`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  seedTransitionDefinitions()
    .catch((err) => {
      logger.error("[seed:transition-definitions] failed", err as Error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
