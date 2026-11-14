import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pool, { withLookupMemo } from "../../../utils/db.js";
import { logger } from "../../../utils/logger.js";
import { loadServiceDefinitionIdByCode, stampServiceDefinitionIds } from "../serviceDefinitionIds.js";
import type { PackSeedInput } from "../../../routes/seu/core/packs.js";
import { createAuthoringDraft, publishAuthoringDraft, inheritedTemplateContent, toTemplateSeedInput } from "../../../routes/seu/core/sdkAuthoring.js";
import { publishTemplate, PACK_SELECTION_SLOTS } from "../../../routes/seu/core/templates.js";
import { validateComposableFieldsAgainstSchema } from "../../../routes/seu/core/ontology.js";
import { badgeAuthorityEngine } from "../../../domain/engine/badgeAuthorityEngine.js";
import { schemaDefinitionsDB } from "../../schemaDefinitionsDB.js";
import { demoStepsDB } from "../../demoStepsDB.js";
import { demoScenariosDB } from "../../demoScenariosDB.js";
import { demoAreasDB } from "../../demoAreasDB.js";
import { templatesDB } from "../../templatesDB.js";
import { getPlatformTenantId, NO_EXPIRY_DATE, INITIAL_VERSION, DEMO_AREAS } from "../../constants.js";
import type { JsonSchemaDocument } from "../../../domain/sdk/formGenerator.js";
import { publishProfile, type ProfileSeedInput } from "../../../routes/seu/core/profiles.js";
import { createObjective, objectiveInitialState } from "../../../routes/seu/core/objectives.js";
import { transitionEntity, publishTransition } from "../../../domain/engine/entityTransition.js";
import { participantsMasterDB } from "../../participantsMasterDB.js";
import { transitionDefinitionsDB } from "../../transitionDefinitionsDB.js";
import type { ObjectiveTier, TemplateDependencyGraphEntry } from "../../seuTypes.js";
import { seedDemoParticipants } from "./demoParticipants.js";
import { purgeDemoTenant } from "./demoPurge.js";
import { getDemoActor, grantBadge, grantBadgesWithPrefixes, grantTransitionBadge, type DemoActor } from "./demoBadges.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data", "demo");

function loadJson<T>(fileName: string): T {
  return JSON.parse(readFileSync(path.join(dataDir, fileName), "utf8")) as T;
}

interface DemoObjectiveSeed {
  key: string;
  tier: ObjectiveTier;
  parentKey: string | null;
  statement: string;
  requiredCapabilityCodes: string[];
}

const PACK_HOPS = [["Draft", "Validated"], ["Validated", "Published"], ["Published", "Active"]] as const;
const PROFILE_HOPS = PACK_HOPS;
const TEMPLATE_HOPS = PACK_HOPS;
const POLICY_HOPS = PACK_HOPS;

async function prepareActor(actor: DemoActor): Promise<string> {
  const { authorisedRoles } = loadJson<{ authorisedRoles: string[] }>("demoUser.json");
  const { error } = await participantsMasterDB.setAuthorisedRole(
    actor.participantId,
    authorisedRoles.map((role) => ({ role, effective_till: NO_EXPIRY_DATE, seu_ids: [] }))
  );
  if (error) throw error;
  return authorisedRoles[0];
}

async function grantAuthoringBadges(actor: DemoActor): Promise<void> {
  await grantBadge(actor.participantId, "pack_define");
  await grantBadge(actor.participantId, "profile_define");
  await grantBadge(actor.participantId, "template_define");
  await grantBadge(actor.participantId, "capability_define");
  await grantBadge(actor.participantId, "policy_define");
  for (const [from, to] of POLICY_HOPS) await grantTransitionBadge(actor.participantId, "Policy", from, to);
  for (const [from, to] of PACK_HOPS) await grantTransitionBadge(actor.participantId, "Pack", from, to);
  for (const [from, to] of TEMPLATE_HOPS) await grantTransitionBadge(actor.participantId, "Template", from, to);
  for (const [from, to] of PROFILE_HOPS) await grantTransitionBadge(actor.participantId, "Profile", from, to);
  const initialState = await objectiveInitialState();
  await grantTransitionBadge(actor.participantId, "Objective", initialState, "Active");
  const { data: birth, error: birthError } = await transitionDefinitionsDB.findBirth("Objective");
  if (birthError || !birth?.verb) throw birthError ?? new Error("no birth Transition Definition with a verb for Objective");
  await grantBadge(actor.participantId, `objective_${birth.verb}`);
  await grantBadgesWithPrefixes(actor.participantId, ["seu_", "ebm_"]);
  // tenant_manage makes the SEU list show every SEU of the Demo tenant, not only those the user is engaged in.
  await grantBadge(actor.participantId, "tenant_manage");
}

// Authors each Policy Definition through the SDK authoring path and takes it to Active, so the Packs can adopt it.
async function seedPolicies(actor: DemoActor): Promise<void> {
  const policies = loadJson<Array<Record<string, unknown> & { code: string }>>("policies.json");
  const { data: policySchema, error: schemaError } = await schemaDefinitionsDB.findLatest("Policy");
  if (schemaError || !policySchema) throw schemaError ?? new Error("no schema_definitions grammar for Policy");
  const authorBadge = await badgeAuthorityEngine.resolveAuthorBadge(actor.participantId, "policy_define");
  for (const policy of policies) {
    const created = await createAuthoringDraft({
      kind: "Policy", actorId: actor.participantId, authorBadge, tenantId: actor.tenantId,
      content: policy, schemaDefinitionId: policySchema.id,
    });
    if (!created.ok) throw new Error(`[seed:demo] Policy "${policy.code}" draft failed: ${created.errors.join("; ")}`);
    let status = "Draft";
    while (status !== "Active") {
      const advanced = await publishAuthoringDraft({ kind: "Policy", id: created.draftId, actorId: actor.participantId });
      if (!advanced.ok) throw new Error(`[seed:demo] Policy "${policy.code}" failed at ${status}: ${advanced.errors.join("; ")}`);
      status = advanced.status;
    }
  }
}

// Authors each Pack through the SDK authoring path. A Pack whose code is not yet a
// canonical Ontology concept gets a ConceptCreated proposal at Draft creation and
// stays unpublished until the concept is accepted; that is an outcome, not an error.
async function seedPacks(actor: DemoActor): Promise<{ authored: Set<string>; active: Set<string> }> {
  const packs = loadJson<Array<Omit<PackSeedInput, "tenantId">>>("packs.json");
  const { data: packSchema, error: schemaError } = await schemaDefinitionsDB.findLatest("Pack");
  if (schemaError || !packSchema) throw schemaError ?? new Error("no schema_definitions grammar for Pack");
  const authorBadge = await badgeAuthorityEngine.resolveAuthorBadge(actor.participantId, "pack_define");

  const serviceDefinitionIdByCode = await loadServiceDefinitionIdByCode(actor.tenantId);
  const authored = new Set<string>();
  const active = new Set<string>();
  for (const pack of packs) {
    stampServiceDefinitionIds(pack, serviceDefinitionIdByCode);
    const created = await createAuthoringDraft({
      kind: "Pack", actorId: actor.participantId, authorBadge, tenantId: actor.tenantId,
      content: pack as unknown as Record<string, unknown>, schemaDefinitionId: packSchema.id,
    });
    if (!created.ok) throw new Error(`[seed:demo] Pack "${pack.code}" draft failed: ${created.errors.join("; ")}`);

    authored.add(pack.code);
    let status = "Draft";
    while (status !== "Active") {
      if (status === "Validated") {
        const pending = await validateComposableFieldsAgainstSchema(packSchema.schema as JsonSchemaDocument, { code: pack.code, category: pack.category }, { isRoot: false, tenantId: actor.tenantId });
        if (pending.length > 0) {
          logger.info(`[seed:demo] Pack "${pack.code}" left at Validated, waiting on Ontology acceptance: ${pending.join("; ")}`);
          break;
        }
      }
      const advanced = await publishAuthoringDraft({ kind: "Pack", id: created.draftId, actorId: actor.participantId });
      if (!advanced.ok) throw new Error(`[seed:demo] Pack "${pack.code}" failed at ${status}: ${advanced.errors.join("; ")}`);
      status = advanced.status;
    }
    if (status === "Active") active.add(pack.code);
  }
  return { authored, active };
}

interface DemoTemplateSeed {
  baseTemplateCode: string;
  name?: string;
  engineeringPackCodes?: string[];
  omitDeliverableCodes?: string[];
  omitPackCodes?: string[];
}

// The Demo tenant cannot see Platform Templates, so each base Template named in templates.json
// is inherited into the Demo tenant and taken to Active, as the standard Templates are seeded.
// The copy leaves out the Packs listed in omitPackCodes and the Deliverables listed in omitDeliverableCodes, with the dependency edges that touch them.
// Keeps the edges between kept Deliverables. A kept prerequisite whose gated Deliverable is omitted stays as a standalone entry.
function standaloneKeptSources(graph: TemplateDependencyGraphEntry[], omitted: Set<string>): TemplateDependencyGraphEntry[] {
  const kept: TemplateDependencyGraphEntry[] = [];
  const standaloneFrom = new Set<string>();
  const connected = new Set<string>();
  for (const e of graph) {
    if (e.fromType !== "Deliverable" || !e.fromCode || omitted.has(e.fromCode)) continue;
    if (e.toCode && !omitted.has(e.toCode)) { kept.push(e); connected.add(e.fromCode); connected.add(e.toCode); continue; }
    standaloneFrom.add(e.fromCode);
  }
  for (const fromCode of standaloneFrom) {
    if (!connected.has(fromCode)) kept.push({ fromType: "Deliverable", fromCode });
  }
  return kept;
}

async function seedTemplates(actor: DemoActor): Promise<void> {
  const templates = loadJson<DemoTemplateSeed[]>("templates.json");
  const profiles = loadJson<ProfileSeedInput[]>("profiles.json");
  const seeded = new Set(templates.map((t) => t.baseTemplateCode));
  const missing = [...new Set(profiles.map((p) => p.baseTemplateCode))].filter((code) => !seeded.has(code));
  if (missing.length > 0) throw new Error(`[seed:demo] templates.json has no entry for the base Template(s) the Profiles use: ${missing.join(", ")}`);
  const platformTenantId = await getPlatformTenantId();

  for (const { baseTemplateCode: code, name, omitDeliverableCodes, omitPackCodes, engineeringPackCodes } of templates) {
    const { data: parent, error } = await templatesDB.findActiveByCode(code, platformTenantId);
    if (error || !parent) throw error ?? new Error(`[seed:demo] Platform Template "${code}" not found`);
    const inherited = await inheritedTemplateContent(parent.id, actor.tenantId);
    if (!inherited.ok) throw new Error(`[seed:demo] Template "${code}": ${inherited.error}`);
    const omitted = new Set(omitDeliverableCodes ?? []);
    const omittedPacks = new Set(omitPackCodes ?? []);
    const seed = toTemplateSeedInput(inherited.content);
    const result = await publishTemplate({
      seed: {
        ...seed,
        ...(name ? { name } : {}),
        ...Object.fromEntries(PACK_SELECTION_SLOTS.map((slot) => [slot.field, ((seed[slot.field] as string[] | undefined) ?? []).filter((c) => !omittedPacks.has(c))])),
        engineeringPackCodes: [...new Set([...(seed.engineeringPackCodes ?? []), ...(engineeringPackCodes ?? [])])].filter((c) => !omittedPacks.has(c)),
        deliverableCatalogue: seed.deliverableCatalogue.filter((d) => !omitted.has(d.code)),
        // dependencyGraph: (seed.dependencyGraph ?? []).filter((e) => !omitted.has(e.toCode) && !(e.fromType === "Deliverable" && omitted.has(e.fromCode ?? ""))),
        // An edge whose gated Deliverable is omitted but whose prerequisite is kept leaves the prerequisite as a standalone node (no toCode).
        dependencyGraph: standaloneKeptSources(seed.dependencyGraph ?? [], omitted),
        templateVersion: INITIAL_VERSION,
        tenantId: actor.tenantId,
        parentTemplateId: parent.id,
      },
      actorId: actor.participantId,
    });
    if (!result.ok) throw new Error(`[seed:demo] Template "${code}" failed: ${result.errors.join("; ")}`);
  }
}

// A Profile can only select Active Packs; one that selects a Pack still waiting on
// the Ontology is skipped and reported.
async function seedProfiles(actor: DemoActor, packs: { authored: Set<string>; active: Set<string> }): Promise<void> {
  const profiles = loadJson<ProfileSeedInput[]>("profiles.json");
  for (const profile of profiles) {
    const waiting = (profile.optionalPackCodes ?? []).filter((c) => packs.authored.has(c) && !packs.active.has(c));
    if (waiting.length > 0) {
      logger.info(`[seed:demo] Profile "${profile.code}" not published, waiting on Pack(s): ${waiting.join(", ")}`);
      continue;
    }
    const result = await publishProfile({ seed: { ...profile, tenantId: actor.tenantId }, actorId: actor.participantId });
    if (!result.ok) throw new Error(`[seed:demo] Profile "${profile.code}" failed: ${result.errors.join("; ")}`);
  }
}

async function seedObjectives(actor: DemoActor): Promise<void> {
  const objectives = loadJson<DemoObjectiveSeed[]>("objectives.json");
  const idByKey = new Map<string, string>();
  // All Objectives are created first: a parent cannot take children once it has left the initial state.
  for (const o of objectives) {
    const parentObjectiveId = o.parentKey ? idByKey.get(o.parentKey) : null;
    if (o.parentKey && !parentObjectiveId) throw new Error(`[seed:demo] Objective ${o.key}: parent ${o.parentKey} is not defined before it`);
    const { objective } = await createObjective({
      statement: o.statement,
      requiredCapabilityCodes: o.requiredCapabilityCodes,
      tier: o.tier,
      parentObjectiveId,
      requestedBy: actor.participantId,
    });
    idByKey.set(o.key, objective.id);
  }
  for (const o of objectives) {
    const objectiveId = idByKey.get(o.key)!;
    const result = await transitionEntity({ entityType: "Objective", entityId: objectiveId, targetState: "Active", actorId: actor.participantId });
    if (!result.ok) throw new Error(`[seed:demo] Objective ${o.key} activation failed: ${result.reason}${"detail" in result ? `: ${result.detail}` : ""}`);
    await publishTransition(result);
  }
}

interface DemoStepSeed {
  code: string;
  kind: string;
  area: string;
  title: string;
  description: string | null;
  annotation: string | null;
  target: Record<string, unknown>;
  payload: Record<string, unknown>;
}

interface DemoScenarioSeed {
  code: string;
  area: string;
  title: string;
  playbook: string[];
  enabled?: boolean;
  sortOrder: number;
}

interface DemoAreaSeed {
  area: string;
  stageTitle: string;
  howToLead: string;
  howToSteps: Array<{ text: string }>;
}

// The catalogue lives in the database and is edited on the Demo root page, so a reset keeps it and only
// sets every scenario back to its first step. The JSON files bootstrap a table that is still empty.
async function seedCatalogue(actor: DemoActor): Promise<void> {
  const [existingSteps, existingScenarios, existingAreas] = await Promise.all([
    demoStepsDB.findByTenant(actor.tenantId),
    demoScenariosDB.findByTenant(actor.tenantId),
    demoAreasDB.findByTenant(actor.tenantId),
  ]);
  if (existingSteps.error) throw existingSteps.error;
  if (existingScenarios.error) throw existingScenarios.error;
  if (existingAreas.error) throw existingAreas.error;
  const authorBadge = await badgeAuthorityEngine.resolveAuthorBadge(actor.participantId, "pack_define");
  const common = { tenantId: actor.tenantId, authorId: actor.participantId, authorBadge };

  if ((existingSteps.data ?? []).length === 0 && (existingScenarios.data ?? []).length === 0) {
    const steps = loadJson<DemoStepSeed[]>("steps.json");
    const scenarios = loadJson<DemoScenarioSeed[]>("scenarios.json");
    const codes = new Set(steps.map((s) => s.code));
    const errors: string[] = [];
    for (const sc of scenarios) {
      for (const step of sc.playbook) if (!codes.has(step)) errors.push(`scenario ${sc.code}: step "${step}" is not a step code`);
    }
    if (errors.length > 0) throw new Error(`[seed:demo] step and scenario catalogue invalid: ${errors.join("; ")}`);
    const insertedSteps = await demoStepsDB.insertMany(steps.map((st) => ({ ...common, ...st })));
    if (insertedSteps.error) throw insertedSteps.error;
    const insertedScenarios = await demoScenariosDB.insertMany(scenarios.map((sc) => ({ ...common, ...sc })));
    if (insertedScenarios.error) throw insertedScenarios.error;
  } else {
    const reset = await demoScenariosDB.resetProgress(actor.tenantId);
    if (reset.error) throw reset.error;
  }

  if ((existingAreas.data ?? []).length === 0) {
    const areas = loadJson<DemoAreaSeed[]>("areas.json");
    const unknown = areas.filter((a) => !(DEMO_AREAS as readonly string[]).includes(a.area));
    if (unknown.length > 0) throw new Error(`[seed:demo] areas.json names unknown area(s): ${unknown.map((a) => a.area).join(", ")}`);
    const insertedAreas = await demoAreasDB.insertMany(areas.map((a) => ({ ...common, ...a })));
    if (insertedAreas.error) throw insertedAreas.error;
  }
}

// Seeds the Demo tenant through the governed path with the Demo User as actor.
export async function seedDemo(): Promise<void> {
  const startedAt = Date.now();
  let phaseStartedAt = startedAt;
  const phaseDone = (phase: string): void => {
    const now = Date.now();
    logger.info(`[seed:demo] ${phase} done in ${((now - phaseStartedAt) / 1000).toFixed(1)}s (${((now - startedAt) / 1000).toFixed(1)}s since start).`);
    phaseStartedAt = now;
  };
  logger.info(`[seed:demo] reset started at ${new Date(startedAt).toISOString()}.`);
  const actor = await getDemoActor();
  await purgeDemoTenant(actor.tenantId);
  phaseDone("purge");
  // Each lookup list is read once for the run; writes made during the run drop the lists they affect.
  await withLookupMemo(async () => {
    await grantAuthoringBadges(actor);
    await seedPolicies(actor);
    phaseDone("Policies");
    const packs = await seedPacks(actor);
    phaseDone("Packs");
    await seedTemplates(actor);
    phaseDone("Templates");
    await seedProfiles(actor, packs);
    phaseDone("Profiles");
    await seedDemoParticipants(actor);
    phaseDone("participants");
    await seedObjectives(actor);
    phaseDone("Objectives");
    await seedCatalogue(actor);
    phaseDone("step and scenario catalogue");
  });
  logger.info(`[seed:demo] reset finished at ${new Date().toISOString()}, ${((Date.now() - startedAt) / 1000).toFixed(1)}s in total. Packs, Templates, Profiles, participants, Objectives and the step and scenario catalogue seeded.`);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  seedDemo()
    .catch((err) => {
      logger.error("[seed:demo] failed", err as Error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
