import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pool, { query } from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { userDB } from "../userDB.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface SeedActor {
  authoredBy: string;
  authorBadge: string;
}

interface TransitionDefinitionSeed {
  entityType: string;
  fromState: string;
  toState: string;
  requiredAuthorityRuleCode: string | null;
  requiredPolicyCodes?: string[];
  trigger?: "manual" | "governed";
  submitVerb?: string;
  eventType?: string;
  versionEvent?: string;
  submitVersionEvent?: string;
}

let cachedSeeds: TransitionDefinitionSeed[] | null = null;
function loadSeeds(): TransitionDefinitionSeed[] {
  if (!cachedSeeds) {
    const raw = readFileSync(path.join(__dirname, "data", "transitionDefinitions.json"), "utf8");
    cachedSeeds = JSON.parse(raw) as TransitionDefinitionSeed[];
  }
  return cachedSeeds;
}

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

export async function seedTransitionDefinitions(actor: SeedActor): Promise<void> {
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
        `INSERT INTO transition_definitions (entity_type, from_state, to_state, required_authority_rule_id, required_policy_ids, trigger, submit_verb, event_type, version_event, submit_version_event, author_id, author_badge)
         VALUES ($1, $2, $3, $4, $5::uuid[], $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (entity_type, from_state, to_state)
         DO UPDATE SET required_authority_rule_id = EXCLUDED.required_authority_rule_id,
                       required_policy_ids = EXCLUDED.required_policy_ids,
                       trigger = EXCLUDED.trigger,
                       submit_verb = EXCLUDED.submit_verb,
                       event_type = EXCLUDED.event_type,
                       version_event = EXCLUDED.version_event,
                       submit_version_event = EXCLUDED.submit_version_event`,
        [
          seed.entityType, seed.fromState, seed.toState, ruleId, policyIds, seed.trigger ?? "manual", seed.submitVerb ?? null,
          seed.eventType ?? null, seed.versionEvent ?? null, seed.submitVersionEvent ?? null, actor.authoredBy, actor.authorBadge,
        ]
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

if (import.meta.url === `file://${process.argv[1]}`) {
  const { actorId, actorBadge } = await userDB.getSuperuserId();
  if (!actorId) throw new Error("No participants_master row for user_id 1 -- log in as root first.");
  seedTransitionDefinitions({ authoredBy: actorId, authorBadge: actorBadge })
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error("[seedTransitionDefinitions] failed", err as Error);
      process.exit(1);
    });
}