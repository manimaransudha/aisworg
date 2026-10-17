import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pool from "../../../utils/db.js";
import { logger } from "../../../utils/logger.js";
import type { PackSeedInput } from "../../../routes/seu/core/packs.js";
import { createAuthoringDraft, publishAuthoringDraft, inheritedTemplateContent } from "../../../routes/seu/core/sdkAuthoring.js";
import { validateComposableFieldsAgainstSchema } from "../../../routes/seu/core/ontology.js";
import { badgeAuthorityEngine } from "../../../domain/engine/badgeAuthorityEngine.js";
import { schemaDefinitionsDB } from "../../schemaDefinitionsDB.js";
import { ontologyDB } from "../../ontologyDB.js";
import { demoScenariosDB } from "../../demoScenariosDB.js";
import { demoPlaybooksDB } from "../../demoPlaybooksDB.js";
import { templatesDB } from "../../templatesDB.js";
import { getPlatformTenantId } from "../../constants.js";
import type { JsonSchemaDocument } from "../../../domain/sdk/formGenerator.js";
import { publishProfile, type ProfileSeedInput } from "../../../routes/seu/core/profiles.js";
import { createObjective, submitObjective, transitionObjective } from "../../../routes/seu/core/objectives.js";
import { participantsMasterDB } from "../../participantsMasterDB.js";
import { transitionDefinitionsDB } from "../../transitionDefinitionsDB.js";
import type { ObjectiveTier } from "../../seuTypes.js";
import { seedDemoParticipants } from "./demoParticipants.js";
import { purgeDemoTenant } from "./demoPurge.js";
import { getDemoActor, grantBadge, grantTransitionBadge, type DemoActor } from "./demoBadges.js";

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

async function prepareActor(actor: DemoActor): Promise<string> {
  const { authorisedRoles } = loadJson<{ authorisedRoles: string[] }>("demoUser.json");
  const { error } = await participantsMasterDB.setAuthorisedRole(
    actor.participantId,
    authorisedRoles.map((role) => ({ role, effective_till: "9999-12-31", seu_ids: [] }))
  );
  if (error) throw error;
  return authorisedRoles[0];
}

async function grantAuthoringBadges(actor: DemoActor): Promise<void> {
  await grantBadge(actor.participantId, "pack_define");
  await grantBadge(actor.participantId, "profile_define");
  await grantBadge(actor.participantId, "template_define");
  for (const [from, to] of PACK_HOPS) await grantTransitionBadge(actor.participantId, "Pack", from, to);
  for (const [from, to] of TEMPLATE_HOPS) await grantTransitionBadge(actor.participantId, "Template", from, to);
  for (const [from, to] of PROFILE_HOPS) await grantTransitionBadge(actor.participantId, "Profile", from, to);
  await grantTransitionBadge(actor.participantId, "Objective", "Proposed", "Active");
  const { data: next, error } = await transitionDefinitionsDB.findPossibleNextTransitions("Objective", "Proposed");
  if (error) throw error;
  const submitVerb = (next ?? []).find((t) => t.submitVerb)?.submitVerb;
  if (!submitVerb) throw new Error("no Submit step is defined for Objective status Proposed");
  await grantBadge(actor.participantId, `objective_${submitVerb}`);
}

// Authors each Pack through the SDK authoring path. A Pack whose code is not yet a
// canonical Ontology concept gets a ConceptCreated proposal at Draft creation and
// stays unpublished until the concept is accepted; that is an outcome, not an error.
async function seedPacks(actor: DemoActor): Promise<{ authored: Set<string>; active: Set<string> }> {
  const packs = loadJson<Array<Omit<PackSeedInput, "tenantId">>>("packs.json");
  const { data: packSchema, error: schemaError } = await schemaDefinitionsDB.findLatest("Pack");
  if (schemaError || !packSchema) throw schemaError ?? new Error("no schema_definitions grammar for Pack");
  const auth = await badgeAuthorityEngine.authorise({ actorId: actor.participantId, requiredBadge: "pack_define" });
  if (!auth.allowed) throw new Error(`[seed:demo] Demo User does not hold pack_define`);
  const authorBadge = auth.via === "root" ? "root" : (auth.matchedBadge ?? "pack_define");

  const authored = new Set<string>();
  const active = new Set<string>();
  for (const pack of packs) {
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

// The Demo tenant cannot see Platform Templates, so each base Template the Profiles
// use is inherited into the Demo tenant unchanged and taken to Active.
async function seedTemplates(actor: DemoActor): Promise<void> {
  const profiles = loadJson<ProfileSeedInput[]>("profiles.json");
  const baseTemplateCodes = [...new Set(profiles.map((p) => p.baseTemplateCode))];
  const { data: templateSchema, error: schemaError } = await schemaDefinitionsDB.findLatest("Template");
  if (schemaError || !templateSchema) throw schemaError ?? new Error("no schema_definitions grammar for Template");
  const auth = await badgeAuthorityEngine.authorise({ actorId: actor.participantId, requiredBadge: "template_define" });
  if (!auth.allowed) throw new Error(`[seed:demo] Demo User does not hold template_define`);
  const authorBadge = auth.via === "root" ? "root" : (auth.matchedBadge ?? "template_define");
  const platformTenantId = await getPlatformTenantId();

  for (const code of baseTemplateCodes) {
    const { data: parent, error } = await templatesDB.findActiveByCode(code, platformTenantId);
    if (error || !parent) throw error ?? new Error(`[seed:demo] Platform Template "${code}" not found`);
    const inherited = await inheritedTemplateContent(parent.id, actor.tenantId);
    if (!inherited.ok) throw new Error(`[seed:demo] Template "${code}": ${inherited.error}`);
    const created = await createAuthoringDraft({
      kind: "Template", actorId: actor.participantId, authorBadge, tenantId: actor.tenantId,
      parentTemplateId: parent.id, content: inherited.content, schemaDefinitionId: templateSchema.id,
    });
    if (!created.ok) throw new Error(`[seed:demo] Template "${code}" draft failed: ${created.errors.join("; ")}`);
    let status = "Draft";
    while (status !== "Active") {
      const advanced = await publishAuthoringDraft({ kind: "Template", id: created.draftId, actorId: actor.participantId });
      if (!advanced.ok) throw new Error(`[seed:demo] Template "${code}" failed at ${status}: ${advanced.errors.join("; ")}`);
      status = advanced.status;
    }
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
  // All Objectives are created first: a submitted Proposed parent locks its children.
  for (const o of objectives) {
    const parentObjectiveId = o.parentKey ? idByKey.get(o.parentKey) : null;
    if (o.parentKey && !parentObjectiveId) throw new Error(`[seed:demo] Objective ${o.key}: parent ${o.parentKey} is not defined before it`);
    const { objective } = await createObjective({
      statement: o.statement,
      requiredCapabilityCodes: o.requiredCapabilityCodes,
      tier: o.tier,
      status: "Proposed",
      parentObjectiveId,
      requestedBy: actor.participantId,
    });
    idByKey.set(o.key, objective.id);
  }
  for (const o of objectives) {
    const objectiveId = idByKey.get(o.key)!;
    await submitObjective(objectiveId, actor.participantId);
    const result = await transitionObjective({ objectiveId, targetState: "Active", actorId: actor.participantId });
    if (!result.ok) throw new Error(`[seed:demo] Objective ${o.key} activation failed: ${result.reason}${"detail" in result ? `: ${result.detail}` : ""}`);
  }
}

interface DemoScenarioSeed {
  code: string;
  kind: string;
  title: string;
  description: string | null;
  category: string | null;
  severity: string | null;
  priority: string | null;
  target: Record<string, unknown>;
  payload: Record<string, unknown>;
  sortOrder: number;
}

interface DemoPlaybookSeed {
  code: string;
  title: string;
  steps: string[];
}

// Loads the scenario catalogue in one batch. Category, severity and priority are
// checked against the Ontology, which is read once per concept type.
async function seedCatalogue(actor: DemoActor): Promise<void> {
  const scenarios = loadJson<DemoScenarioSeed[]>("scenarios.json");
  const playbooks = loadJson<DemoPlaybookSeed[]>("playbooks.json");
  const viewer = { isRoot: false, tenantId: actor.tenantId };
  const allowed = async (conceptType: string): Promise<Set<string>> => {
    const { data, error } = await ontologyDB.findConceptsByType(conceptType, viewer);
    if (error) throw error;
    return new Set((data ?? []).map((c) => c.code));
  };
  const [categories, severities, priorities] = await Promise.all([allowed("category:obligation"), allowed("category:obligation-severity"), allowed("category:obligation-priority")]);
  const codes = new Set(scenarios.map((s) => s.code));
  const errors: string[] = [];
  for (const sc of scenarios) {
    if (sc.category && !categories.has(sc.category)) errors.push(`${sc.code}: category "${sc.category}" is not a canonical category:obligation concept`);
    if (sc.severity && !severities.has(sc.severity)) errors.push(`${sc.code}: severity "${sc.severity}" is not a canonical category:obligation-severity concept`);
    if (sc.priority && !priorities.has(sc.priority)) errors.push(`${sc.code}: priority "${sc.priority}" is not a canonical category:obligation-priority concept`);
  }
  for (const pb of playbooks) {
    for (const step of pb.steps) if (!codes.has(step)) errors.push(`playbook ${pb.code}: step "${step}" is not a scenario code`);
  }
  if (errors.length > 0) throw new Error(`[seed:demo] scenario catalogue invalid: ${errors.join("; ")}`);

  const auth = await badgeAuthorityEngine.authorise({ actorId: actor.participantId, requiredBadge: "pack_define" });
  if (!auth.allowed) throw new Error(`[seed:demo] Demo User does not hold pack_define`);
  const authorBadge = auth.via === "root" ? "root" : (auth.matchedBadge ?? "pack_define");
  const common = { tenantId: actor.tenantId, authorId: actor.participantId, authorBadge };
  const inserted = await demoScenariosDB.insertMany(scenarios.map((sc) => ({ ...common, ...sc })));
  if (inserted.error) throw inserted.error;
  const insertedPlaybooks = await demoPlaybooksDB.insertMany(playbooks.map((pb) => ({ ...common, ...pb })));
  if (insertedPlaybooks.error) throw insertedPlaybooks.error;
}

// Seeds the Demo tenant through the governed path with the Demo User as actor.
export async function seedDemo(): Promise<void> {
  const actor = await getDemoActor();
  await purgeDemoTenant(actor.tenantId);
  await grantAuthoringBadges(actor);
  const packs = await seedPacks(actor);
  await seedTemplates(actor);
  await seedProfiles(actor, packs);
  await seedDemoParticipants(actor);
  await seedObjectives(actor);
  await seedCatalogue(actor);
  logger.info("[seed:demo] Packs, Templates, Profiles, participants, Objectives and the scenario catalogue seeded.");
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
