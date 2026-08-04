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
import type { PackRow, TemplateDeliverableSeed, TransitionEntityType } from "../seuTypes.js";

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

async function seedTemplate(seed: TemplateSeed, capabilityIdByCode: Map<string, string>, packIdByCode: Map<string, string>): Promise<string> {
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

  const mandatoryPackIds = seed.mandatoryPackCodes.map((code) => {
    const id = packIdByCode.get(code);
    if (!id) throw new Error(`template ${seed.code} requires unknown pack ${code}`);
    return id;
  });
  await templatesDB.setMandatoryPacks(template.id, mandatoryPackIds);

  logger.info(`[seed:seu] template ${template.code} -> ${template.id}`);
  return template.id;
}

async function seedProfile(seed: ProfileSeed, templateId: string, packIdByCode: Map<string, string>): Promise<string> {
  const { data: profile, error } = await profilesDB.upsert({
    code: seed.code,
    name: seed.name,
    baseTemplateId: templateId,
    environment: seed.environment,
    configParameters: seed.configParameters,
  });
  if (error || !profile) throw error ?? new Error(`profile upsert failed: ${seed.code}`);

  const optionalPackIds = (seed.optionalPackCodes ?? []).map((code) => {
    const id = packIdByCode.get(code);
    if (!id) throw new Error(`profile ${seed.code} requires unknown optional pack ${code}`);
    return id;
  });
  await profilesDB.setOptionalPacks(profile.id, optionalPackIds);

  logger.info(`[seed:seu] profile ${profile.code} -> ${profile.id} (${optionalPackIds.length} optional Pack(s))`);
  return profile.id;
}

async function seedTransitionDefinitions(
  seeds: TransitionDefinitionSeed[],
  authorityRuleIdByCode: Map<string, string>,
  policyIdByCode: Map<string, string>
): Promise<void> {
  for (const seed of seeds) {
    const requiredAuthorityRuleId = seed.requiredAuthorityRuleCode ? authorityRuleIdByCode.get(seed.requiredAuthorityRuleCode) ?? null : null;
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

    const coreAdvanced = await advancePackLifecycle(coreDraft.pack, "super", { activate: true });
    if (!coreAdvanced.ok || !coreAdvanced.pack) throw new Error(`core-engineering pack publish failed: ${coreAdvanced.errors?.join("; ")}`);
    logger.info(`[seed:seu] pack ${coreAdvanced.pack.code}@${coreAdvanced.pack.pack_version} -> ${coreAdvanced.pack.status}`);

    // Every Pack published from here on has no bootstrap ordering problem —
    // Pack transition_definitions already exist — so the normal, combined
    // Pack SDK entrypoint applies directly.
    const nodejsResult = await publishPack({ seed: nodejsPackSeed, actorRole: "super", activate: true });
    if (!nodejsResult.ok || !nodejsResult.pack) throw new Error(`technology-nodejs pack publish failed: ${nodejsResult.errors?.join("; ")}`);
    logger.info(`[seed:seu] pack ${nodejsResult.pack.code}@${nodejsResult.pack.pack_version} -> ${nodejsResult.pack.status}`);

    const packIdByCode = new Map<string, string>([
      [coreAdvanced.pack.code, coreAdvanced.pack.id],
      [nodejsResult.pack.code, nodejsResult.pack.id],
    ]);

    const templateId = await seedTemplate(templateSeed, capabilityIdByCode, packIdByCode);
    await seedProfile(profileSeed, templateId, packIdByCode);

    logger.info("[seed:seu] done.");
  } catch (err) {
    logger.error("[seed:seu] failed", err as Error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
