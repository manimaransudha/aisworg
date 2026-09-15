// CR-104 validation fixtures (owner: "Create seed data similar to the test
// data you created for testing CR-104. Load them as part of clean-slate so I
// can use that as the base for my further validation") — real, seeded
// (not test-only) demonstrations of all three CR-104 mechanisms:
//   1. installation_classification "Mandatory" composing into every
//      Template automatically (cr104-demo-mandatory.pack.json, Platform-
//      scoped, contributes nothing so it's safe to leave Mandatory forever).
//   2. An SEU-scoped Policy ("SEU|Activated|Operational") blocking the SEU's
//      own commence-work transition.
//   3. A scope:"Eligibility" Policy governing Capability Fulfilment,
//      resolved live off Template/Profile composition, never through the EBM.
//
// Items 2/3 are carried by a second Pack (cr104-demo-seu-eligibility-
// policies.pack.json), adopted only by cr104-demo-development.profile.json
// (baseTemplateCode "saas-product", a real seeded Template/Profile) — never
// Mandatory, so this never affects any other Profile's own commissioning.
//
// Owner correction, 2026-09-13: "we are not here to develop parallel
// mechanism and break the platform construct" — the first version of this
// file called policiesDB.upsert directly, bypassing Policy Definitions and
// the Policy Registry entirely. Fixed for real instead: two real Policy
// Definitions (policy-cr104-demo-seu-commence-work.json, policy-cr104-demo-
// background-check.json, seeded by seedPolicyDefinitions.ts, same file/list
// every real Definition uses) are adopted by cr104-demo-seu-eligibility-
// policies.pack.json's own contributions.policies — publishPack's own
// adoption logic (packs.ts) now forwards each Definition's own scope/
// governedTransition/governingCondition instead of always deriving a
// Deliverable-lifecycle transition and hardcoding condition to always_true
// (207_policy_definitions_scope_and_governing_condition.sql). This script no
// longer touches policiesDB at all.
//
// Must run after step 9 (seedPolicyDefinitions — the two Definitions above
// must already be Active) and after step 8 (seedSdlcStandardTemplates —
// needs the real "saas-product" Template/Profile to already exist), and
// after steps 4/5 (transition_definitions + backfilled verb, every real Pack
// publish needs this to resolve Draft -> Validated -> Published -> Active).
// Rerun-safe: publishPack no-ops on an already-published (code, version);
// publishProfile is upsert semantics too.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pool from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { publishPack, type PackSeedInput } from "../../routes/seu/core/packs.js";
import { publishProfile, type ProfileSeedInput } from "../../routes/seu/core/profiles.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");

function loadJson<T>(fileName: string): T {
  return JSON.parse(readFileSync(path.join(dataDir, fileName), "utf8")) as T;
}

export async function seedCr104Demo(): Promise<void> {
  const mandatorySeed = loadJson<PackSeedInput>("cr104-demo-mandatory.pack.json");
  const mandatoryResult = await publishPack({ seed: mandatorySeed, actorRole: "super", actorId: "1", activate: true });
  if (!mandatoryResult.ok) throw new Error(`[seed:cr104-demo] failed to publish "${mandatorySeed.code}": ${(mandatoryResult.errors ?? []).join("; ")}`);

  const policyPackSeed = loadJson<PackSeedInput>("cr104-demo-seu-eligibility-policies.pack.json");
  const policyPackResult = await publishPack({ seed: policyPackSeed, actorRole: "super", actorId: "1", activate: true });
  if (!policyPackResult.ok) throw new Error(`[seed:cr104-demo] failed to publish "${policyPackSeed.code}": ${(policyPackResult.errors ?? []).join("; ")}`);

  const profileSeed = loadJson<ProfileSeedInput>("cr104-demo-development.profile.json");
  const profileResult = await publishProfile({ seed: profileSeed, actorRole: "super", actorId: "1" });
  if (!profileResult.ok) throw new Error(`[seed:cr104-demo] failed to publish profile "${profileSeed.code}": ${profileResult.errors.join("; ")}`);

  logger.info(`[seed:cr104-demo] done — Pack "${mandatorySeed.code}" (Mandatory), Pack "${policyPackSeed.code}" (adopts 2 real Policy Definitions), Profile "${profileSeed.code}" -> ${profileResult.profileId}.`);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  seedCr104Demo()
    .catch((err) => {
      logger.error("[seed:cr104-demo] failed", err as Error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
