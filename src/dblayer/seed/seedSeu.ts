// Loads hand-authored Pack/Template/Profile/TransitionDefinition JSON into the
// SEU platform tables. Pack SDK is deferred for MVP (Build Plan §5 item 12) —
// this script is the entire "tooling" a Pack gets right now.
// Usage: pnpm seed:seu
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pool from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { packsDB } from "../packsDB.js";
import { capabilitiesDB } from "../capabilitiesDB.js";
import { servicesDB } from "../servicesDB.js";
import { authorityRulesDB } from "../authorityRulesDB.js";
import { policiesDB } from "../policiesDB.js";
import { qualityGatesDB } from "../qualityGatesDB.js";
import { templatesDB } from "../templatesDB.js";
import { profilesDB } from "../profilesDB.js";
import { transitionDefinitionsDB } from "../transitionDefinitionsDB.js";
import type { PackContributions, PackRow, TemplateDeliverableSeed, TransitionEntityType } from "../seuTypes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");

function loadJson<T>(fileName: string): T {
  return JSON.parse(readFileSync(path.join(dataDir, fileName), "utf8")) as T;
}

interface PackSeed {
  code: string;
  name: string;
  category: PackRow["category"];
  packVersion: string;
  installationClassification: PackRow["installation_classification"];
  contributions: PackContributions;
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
}

interface TransitionDefinitionSeed {
  entityType: TransitionEntityType;
  fromState: string;
  toState: string;
  requiredAuthorityRuleCode: string | null;
  requiredPolicyCodes: string[];
}

async function seedPack(seed: PackSeed): Promise<{ packId: string; capabilityIdByCode: Map<string, string>; authorityRuleIdByCode: Map<string, string>; policyIdByCode: Map<string, string> }> {
  const { data: pack, error: packErr } = await packsDB.upsert(seed);
  if (packErr || !pack) throw packErr ?? new Error(`pack upsert failed: ${seed.code}`);
  logger.info(`[seed:seu] pack ${pack.code} -> ${pack.id}`);

  const capabilityIdByCode = new Map<string, string>();
  for (const cap of seed.contributions.capabilities ?? []) {
    const { data: capability, error } = await capabilitiesDB.upsertFromPack({
      code: cap.code,
      name: cap.name,
      description: cap.description ?? null,
      category: cap.category ?? null,
      originatingPackId: pack.id,
    });
    if (error || !capability) throw error ?? new Error(`capability upsert failed: ${cap.code}`);
    capabilityIdByCode.set(cap.code, capability.id);
    logger.info(`[seed:seu]   capability ${capability.code} -> ${capability.id}`);
  }

  for (const svc of seed.contributions.services ?? []) {
    const capabilityId = capabilityIdByCode.get(svc.capabilityCode);
    if (!capabilityId) throw new Error(`service ${svc.name} references unknown capability ${svc.capabilityCode}`);
    const { error } = await servicesDB.upsertFromPack({
      code: svc.code,
      providingCapabilityId: capabilityId,
      name: svc.name,
      contractDescription: svc.contractDescription,
      serviceLevel: svc.serviceLevel,
      originatingPackId: pack.id,
    });
    if (error) throw error;
    logger.info(`[seed:seu]   service ${svc.name}`);
  }

  const authorityRuleIdByCode = new Map<string, string>();
  for (const rule of seed.contributions.authorityRules ?? []) {
    const { data: authorityRule, error } = await authorityRulesDB.upsert({
      code: rule.code,
      governedTransition: rule.governedTransition,
      authorisedRole: rule.authorisedRole,
      originatingPackId: pack.id,
    });
    if (error || !authorityRule) throw error ?? new Error(`authority rule upsert failed: ${rule.code}`);
    authorityRuleIdByCode.set(rule.code, authorityRule.id);
    logger.info(`[seed:seu]   authority rule ${authorityRule.code} -> ${authorityRule.id}`);
  }

  const policyIdByCode = new Map<string, string>();
  for (const policy of seed.contributions.policies ?? []) {
    const { data: policyRow, error } = await policiesDB.upsert({
      code: policy.code,
      name: policy.name,
      category: policy.category,
      constraintType: policy.constraintType,
      governedTransition: policy.governedTransition,
      condition: policy.condition,
      severity: policy.severity,
      originatingPackId: pack.id,
    });
    if (error || !policyRow) throw error ?? new Error(`policy upsert failed: ${policy.code}`);
    policyIdByCode.set(policy.code, policyRow.id);
    logger.info(`[seed:seu]   policy ${policyRow.code} -> ${policyRow.id}`);
  }

  for (const gate of seed.contributions.qualityGates ?? []) {
    const { data: qualityGate, error } = await qualityGatesDB.upsert({
      code: gate.code,
      name: gate.name,
      category: gate.category,
      entityType: gate.entityType,
      fromState: gate.fromState,
      toState: gate.toState,
      criteria: gate.criteria,
      originatingPackId: pack.id,
    });
    if (error || !qualityGate) throw error ?? new Error(`quality gate upsert failed: ${gate.code}`);
    logger.info(`[seed:seu]   quality gate ${qualityGate.code} -> ${qualityGate.id}`);
  }

  return { packId: pack.id, capabilityIdByCode, authorityRuleIdByCode, policyIdByCode };
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

async function seedProfile(seed: ProfileSeed, templateId: string): Promise<string> {
  const { data: profile, error } = await profilesDB.upsert({
    code: seed.code,
    name: seed.name,
    baseTemplateId: templateId,
    environment: seed.environment,
    configParameters: seed.configParameters,
  });
  if (error || !profile) throw error ?? new Error(`profile upsert failed: ${seed.code}`);
  logger.info(`[seed:seu] profile ${profile.code} -> ${profile.id}`);
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
    const packSeed = loadJson<PackSeed>("core-engineering.pack.json");
    const templateSeed = loadJson<TemplateSeed>("web-application.template.json");
    const profileSeed = loadJson<ProfileSeed>("default-development.profile.json");
    const transitionSeeds = loadJson<TransitionDefinitionSeed[]>("transitionDefinitions.json");

    const { packId, capabilityIdByCode, authorityRuleIdByCode, policyIdByCode } = await seedPack(packSeed);
    const packIdByCode = new Map([[packSeed.code, packId]]);
    const templateId = await seedTemplate(templateSeed, capabilityIdByCode, packIdByCode);
    await seedProfile(profileSeed, templateId);
    await seedTransitionDefinitions(transitionSeeds, authorityRuleIdByCode, policyIdByCode);

    logger.info("[seed:seu] done.");
  } catch (err) {
    logger.error("[seed:seu] failed", err as Error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
