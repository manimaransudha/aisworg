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
// empty between a wipe and the reseed. Authority rules + policies referenced
// here are NOT reseeded (they survive clean-slate, base-pack-attributed or
// migration-seeded); a genuinely unresolvable code fails loudly, matching
// seedSeu's own seedTransitionDefinitions. The verb column is back-filled
// afterwards by seedAuthorityVocabulary (run next in clean-slate).
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pool from "../../utils/db.js";
import { logger } from "../../utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface TransitionDefinitionSeed {
  entityType: string;
  fromState: string;
  toState: string;
  requiredAuthorityRuleCode: string | null;
  requiredPolicyCodes?: string[];
}

function loadSeeds(): TransitionDefinitionSeed[] {
  const raw = readFileSync(path.join(__dirname, "data", "transitionDefinitions.json"), "utf8");
  return JSON.parse(raw) as TransitionDefinitionSeed[];
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
        if (!rows[0]) throw new Error(`transition definition references unknown authority rule "${seed.requiredAuthorityRuleCode}"`);
        ruleId = rows[0].id as string;
      }

      const policyIds: string[] = [];
      for (const code of seed.requiredPolicyCodes ?? []) {
        const { rows } = await client.query("SELECT id FROM policies WHERE code = $1", [code]);
        if (!rows[0]) throw new Error(`transition definition references unknown policy "${code}"`);
        policyIds.push(rows[0].id as string);
      }

      await client.query(
        `INSERT INTO transition_definitions (entity_type, from_state, to_state, required_authority_rule_id, required_policy_ids)
         VALUES ($1, $2, $3, $4, $5::uuid[])
         ON CONFLICT (entity_type, from_state, to_state)
         DO UPDATE SET required_authority_rule_id = EXCLUDED.required_authority_rule_id,
                       required_policy_ids = EXCLUDED.required_policy_ids`,
        [seed.entityType, seed.fromState, seed.toState, ruleId, policyIds]
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
