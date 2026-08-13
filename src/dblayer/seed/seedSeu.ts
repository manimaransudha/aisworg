// Loads hand-authored Pack/Template/Profile/TransitionDefinition JSON into the
// SEU platform tables, publishing every Pack through the real Pack SDK
// (core/packs.ts) rather than a direct DB upsert (Post-MVP Phase 9 — Ch.39).
// Usage: pnpm seed:seu
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pool from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { templatesDB } from "../templatesDB.js";
import { profilesDB } from "../profilesDB.js";
import { transitionDefinitionsDB } from "../transitionDefinitionsDB.js";
import { capabilitiesDB } from "../capabilitiesDB.js";
import { authorityRulesDB } from "../authorityRulesDB.js";
import { policiesDB } from "../policiesDB.js";
import { createPackDraft, advancePackLifecycle, publishPack, type PackSeedInput } from "../../routes/seu/core/packs.js";
import { AUTHORING_CAPABILITY_CODE, AUTHORING_CATEGORY, BOOTSTRAP_TEMPLATE_CODE, bootstrapProfileCode } from "../../routes/seu/core/sdkAuthoring.js";
import type { PackRow, TemplateDeliverableSeed, TransitionEntityType, SchemaDefinitionEntityKind } from "../seuTypes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");

function loadJson<T>(fileName: string): T {
  return JSON.parse(readFileSync(path.join(dataDir, fileName), "utf8")) as T;
}

interface TemplateSeed {
  code: string;
  name: string;
  requiredCapabilityCodes: string[];
  mandatoryPackCodes: string[];
  deliverableCatalogue: TemplateDeliverableSeed[];
}

interface ProfileSeed {
  code: string;
  name: string;
  baseTemplateCode: string;
  environment: string;
  configParameters: Record<string, unknown>;
  optionalPackCodes?: string[];
}

interface TransitionDefinitionSeed {
  entityType: TransitionEntityType;
  fromState: string;
  toState: string;
  requiredAuthorityRuleCode: string | null;
  requiredPolicyCodes: string[];
}

async function seedTemplate(seed: TemplateSeed, capabilityIdByCode: Map<string, string>, knownPackCodes: Set<string>): Promise<string> {
  const { data: template, error } = await templatesDB.upsert({
    code: seed.code,
    name: seed.name,
    deliverableCatalogue: seed.deliverableCatalogue,
  });
  if (error || !template) throw error ?? new Error(`template upsert failed: ${seed.code}`);

  const requiredCapabilityIds = seed.requiredCapabilityCodes.map((code) => {
    const id = capabilityIdByCode.get(code);
    if (!id) throw new Error(`template ${seed.code} requires unknown capability ${code}`);
    return id;
  });
  await templatesDB.setRequiredCapabilities(template.id, requiredCapabilityIds);

  // Stores codes directly (bug fix, 013_template_profile_pack_by_code.sql) —
  // which Version each code resolves to is decided at commissioning time,
  // not here. Still validated against known codes so a typo fails loudly at
  // seed time, not silently at first commissioning.
  for (const code of seed.mandatoryPackCodes) {
    if (!knownPackCodes.has(code)) throw new Error(`template ${seed.code} requires unknown pack ${code}`);
  }
  await templatesDB.setMandatoryPacks(template.id, seed.mandatoryPackCodes);

  logger.info(`[seed:seu] template ${template.code} -> ${template.id}`);
  return template.id;
}

async function seedProfile(seed: ProfileSeed, templateId: string, knownPackCodes: Set<string>): Promise<string> {
  const { data: profile, error } = await profilesDB.upsert({
    code: seed.code,
    name: seed.name,
    baseTemplateId: templateId,
    environment: seed.environment,
    configParameters: seed.configParameters,
  });
  if (error || !profile) throw error ?? new Error(`profile upsert failed: ${seed.code}`);

  const optionalPackCodes = seed.optionalPackCodes ?? [];
  for (const code of optionalPackCodes) {
    if (!knownPackCodes.has(code)) throw new Error(`profile ${seed.code} requires unknown optional pack ${code}`);
  }
  await profilesDB.setOptionalPacks(profile.id, optionalPackCodes);

  logger.info(`[seed:seu] profile ${profile.code} -> ${profile.id} (${optionalPackCodes.length} optional Pack(s))`);
  return profile.id;
}

// authorityRuleIdByCode only covers codes contributed by the bootstrap Pack's
// own JSON — a code seeded directly by a migration instead (Phase 10's
// authority-deliverable-creator/-approver, 012_badge_model.sql) needs a live
// DB lookup as fallback. Previously this silently fell back to `null` on any
// miss — the bug that let a re-run of this seed script quietly clobber
// migration 012's badge-model repoint of Deliverable's own transitions back
// to legacy role-based authority (found while re-running this script to add
// the SDK UI Layer Plan's bootstrap Templates). Failing loudly on a genuinely
// unresolvable code, instead of silently nulling required_authority_rule_id,
// matches every other lookup in this file (seedTemplate/seedProfile already
// throw on an unknown code rather than seeding a broken row).
async function resolveAuthorityRuleId(code: string, authorityRuleIdByCode: Map<string, string>): Promise<string> {
  const fromPack = authorityRuleIdByCode.get(code);
  if (fromPack) return fromPack;
  const { data: rule } = await authorityRulesDB.findByCode(code);
  if (!rule) throw new Error(`transition definition references unknown authority rule ${code}`);
  return rule.id;
}

async function seedTransitionDefinitions(
  seeds: TransitionDefinitionSeed[],
  authorityRuleIdByCode: Map<string, string>,
  policyIdByCode: Map<string, string>
): Promise<void> {
  for (const seed of seeds) {
    const requiredAuthorityRuleId = seed.requiredAuthorityRuleCode ? await resolveAuthorityRuleId(seed.requiredAuthorityRuleCode, authorityRuleIdByCode) : null;
    const requiredPolicyIds = seed.requiredPolicyCodes.map((code) => {
      const id = policyIdByCode.get(code);
      if (!id) throw new Error(`transition definition references unknown policy ${code}`);
      return id;
    });
    const { error } = await transitionDefinitionsDB.upsert({
      entityType: seed.entityType,
      fromState: seed.fromState,
      toState: seed.toState,
      requiredAuthorityRuleId,
      requiredPolicyIds,
    });
    if (error) throw error;
    logger.info(`[seed:seu] transition ${seed.entityType} ${seed.fromState} -> ${seed.toState}`);
  }
}

// SDK UI Layer Plan's Core Principle — each of Pack/Template/Profile/
// Transition Definition is authored via its own small bootstrap Template
// producing exactly one Deliverable.
const SDK_AUTHORING_KINDS: SchemaDefinitionEntityKind[] = ["Pack", "Template", "Profile", "TransitionDefinition"];

async function seedSdkAuthoringBootstrap(knownPackCodes: Set<string>): Promise<void> {
  for (const kind of SDK_AUTHORING_KINDS) {
    const capabilityCode = AUTHORING_CAPABILITY_CODE[kind];
    const { data: capabilities } = await capabilitiesDB.findByCodes([capabilityCode]);
    const capability = capabilities?.[0];
    if (!capability) throw new Error(`seedSdkAuthoringBootstrap: unknown capability ${capabilityCode} — did migration 014 run?`);

    const templateCode = BOOTSTRAP_TEMPLATE_CODE[kind];
    const { data: template, error } = await templatesDB.upsert({
      code: templateCode,
      name: `${kind} Authoring (bootstrap)`,
      deliverableCatalogue: [
        {
          code: `${kind.toLowerCase()}-definition`,
          name: `${kind} Definition`,
          category: AUTHORING_CATEGORY[kind],
          producingCapabilityCode: capabilityCode,
        },
      ],
    });
    if (error || !template) throw error ?? new Error(`bootstrap template upsert failed: ${templateCode}`);
    await templatesDB.setRequiredCapabilities(template.id, [capability.id]);
    await templatesDB.setMandatoryPacks(template.id, []);
    logger.info(`[seed:seu] sdk-authoring template ${template.code} -> ${template.id}`);

    const { data: profile, error: profileErr } = await profilesDB.upsert({
      code: bootstrapProfileCode(kind),
      name: `${kind} Authoring (bootstrap profile)`,
      baseTemplateId: template.id,
      environment: "platform",
      configParameters: {},
    });
    if (profileErr || !profile) throw profileErr ?? new Error(`bootstrap profile upsert failed for ${kind}`);
    await profilesDB.setOptionalPacks(profile.id, []);
    logger.info(`[seed:seu] sdk-authoring profile ${profile.code} -> ${profile.id}`);
  }
  // knownPackCodes unused today (bootstrap Templates carry no mandatory
  // Packs) — kept as a parameter so a future kind that does can validate
  // against it the same way seedTemplate does.
  void knownPackCodes;
}

async function run(): Promise<void> {
  try {
    const corePackSeed = loadJson<PackSeedInput>("core-engineering.pack.json");
    const nodejsPackSeed = loadJson<PackSeedInput>("technology-nodejs.pack.json");
    const templateSeed = loadJson<TemplateSeed>("web-application.template.json");
    const profileSeed = loadJson<ProfileSeed>("default-development.profile.json");
    const transitionSeeds = loadJson<TransitionDefinitionSeed[]>("transitionDefinitions.json");

    // Bootstrap ordering (see core/packs.ts's doc comment): the first Pack's
    // own contributed Authority Rules/Policies must be seeded and resolved
    // into transition_definitions BEFORE that same Pack's own Draft ->
    // Published -> Active lifecycle can be driven through transitionEngine,
    // since Pack-entity transition_definitions rows aren't part of any
    // Pack's own contributions.
    const coreDraft = await createPackDraft(corePackSeed);
    if (!coreDraft.ok) throw new Error(`core-engineering pack validation/create failed: ${coreDraft.errors.join("; ")}`);
    logger.info(`[seed:seu] pack ${coreDraft.pack.code}@${coreDraft.pack.pack_version} -> ${coreDraft.pack.id} (Draft)`);

    const capabilityIdByCode = new Map<string, string>();
    for (const cap of corePackSeed.contributions.capabilities ?? []) {
      const { data } = await capabilitiesDB.findByCodes([cap.code]);
      if (data?.[0]) capabilityIdByCode.set(cap.code, data[0].id);
    }
    const authorityRuleIdByCode = new Map<string, string>();
    for (const rule of corePackSeed.contributions.authorityRules ?? []) {
      const { data } = await authorityRulesDB.upsert({ code: rule.code, governedTransition: rule.governedTransition, authorisedRole: rule.authorisedRole, originatingPackId: coreDraft.pack.id });
      if (data) authorityRuleIdByCode.set(rule.code, data.id);
    }
    const policyIdByCode = new Map<string, string>();
    for (const policy of corePackSeed.contributions.policies ?? []) {
      const { data } = await policiesDB.upsert({ code: policy.code, name: policy.name, category: policy.category, constraintType: policy.constraintType, governedTransition: policy.governedTransition, condition: policy.condition, severity: policy.severity, originatingPackId: coreDraft.pack.id });
      if (data) policyIdByCode.set(policy.code, data.id);
    }

    await seedTransitionDefinitions(transitionSeeds, authorityRuleIdByCode, policyIdByCode);

    const coreAdvanced = await advancePackLifecycle(coreDraft.pack, "super", "1", { activate: true }); // CR-006: seed runs as root holder (id 1) — bypass
    if (!coreAdvanced.ok || !coreAdvanced.pack) throw new Error(`core-engineering pack publish failed: ${coreAdvanced.errors?.join("; ")}`);
    logger.info(`[seed:seu] pack ${coreAdvanced.pack.code}@${coreAdvanced.pack.pack_version} -> ${coreAdvanced.pack.status}`);

    // Every Pack published from here on has no bootstrap ordering problem —
    // Pack transition_definitions already exist — so the normal, combined
    // Pack SDK entrypoint applies directly.
    const nodejsResult = await publishPack({ seed: nodejsPackSeed, actorRole: "super", actorId: "1", activate: true });
    if (!nodejsResult.ok || !nodejsResult.pack) throw new Error(`technology-nodejs pack publish failed: ${nodejsResult.errors?.join("; ")}`);
    logger.info(`[seed:seu] pack ${nodejsResult.pack.code}@${nodejsResult.pack.pack_version} -> ${nodejsResult.pack.status}`);

    const knownPackCodes = new Set<string>([coreAdvanced.pack.code, nodejsResult.pack.code]);

    const templateId = await seedTemplate(templateSeed, capabilityIdByCode, knownPackCodes);
    await seedProfile(profileSeed, templateId, knownPackCodes);

    await seedSdkAuthoringBootstrap(knownPackCodes);

    logger.info("[seed:seu] done.");
  } catch (err) {
    logger.error("[seed:seu] failed", err as Error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
