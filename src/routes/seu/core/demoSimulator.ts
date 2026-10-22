import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { badgeAuthorityEngine } from "../../../domain/engine/badgeAuthorityEngine.js";
import { lookupRouteAuthority } from "../../../domain/identity/routeAuthorityCache.js";
import { resolveAuthorBadge } from "../../../domain/identity/heldBadges.js";
import { demoScenariosDB, type DemoScenarioRow } from "../../../dblayer/demoScenariosDB.js";
import { demoPlaybooksDB, type DemoPlaybookRow } from "../../../dblayer/demoPlaybooksDB.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { seusDB } from "../../../dblayer/seusDB.js";
import { participantsDB } from "../../../dblayer/participantsDB.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { templatesDB } from "../../../dblayer/templatesDB.js";
import { profilesDB } from "../../../dblayer/profilesDB.js";
import { packsDB } from "../../../dblayer/packsDB.js";
import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { workItemsDB } from "../../../dblayer/workItemsDB.js";
import { attentionItemsDB } from "../../../dblayer/attentionItemsDB.js";
import { findingsDB } from "../../../dblayer/findingsDB.js";
import { getDemoActor, grantAllTransitionBadges, grantRouteBadges, grantTransitionBadge, type DemoActor } from "../../../dblayer/seed/demo/demoBadges.js";
import { seedDemo } from "../../../dblayer/seed/demo/demoSeed.js";
import { listObjectives } from "./objectives.js";
import { initiateSeu, validateSeu, previewCommissioningValidation, validateEbm } from "./commissioning.js";
import { transitionEntity, publishTransition } from "../../../domain/engine/entityTransition.js";
import { completeWorkItem } from "./workItems.js";
import { transitionAttentionItem } from "./attentionItems.js";
import { createReview, listReviewsBySeu } from "./reviews.js";
import { createFinding, transitionFinding, convertFindingToObligation, listFindingsByReview } from "./findings.js";
import { createObligation } from "./obligations.js";
import { approveConcept } from "./ontology.js";
import { publishAuthoringDraft } from "./sdkAuthoring.js";
import { BIRTH_STATE, INITIAL_VERSION } from "../../../dblayer/constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "..", "..", "dblayer", "seed", "data", "demo");

export interface SimulatorResult {
  ok: boolean;
  message: string;
}

interface SimulatorContext extends DemoActor {
}

type Target = Record<string, unknown>;
type Handler = (ctx: SimulatorContext, scenario: DemoScenarioRow) => Promise<string>;

const str = (value: unknown, label: string): string => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`scenario is missing "${label}"`);
  return value;
};

async function getContext(): Promise<SimulatorContext> {
  const actor = await getDemoActor();
  const { data: master, error } = await participantsMasterDB.findById(actor.participantId);
  if (error || !master) throw error ?? new Error("Demo User participant not found");
  const role = master.authorised_role[0]?.role;
  if (!role) throw new Error("Demo User holds no role; reset the demo data");
  return { ...actor };
}

// Grants what route_authority declares for this route, then records the same author badge the web layer would.
async function authorBadgeFor(ctx: SimulatorContext, method: string, fullPath: string): Promise<string> {
  const found = lookupRouteAuthority(method, fullPath);
  if (found && found.badges.length > 0) await grantRouteBadges(ctx.participantId, method, fullPath);
  const { isRoot, badgeTypes } = await badgeAuthorityEngine.getHeldBadges(ctx.participantId);
  const badge = resolveAuthorBadge(found, { isRoot, badgeTypes, has: (b) => isRoot || badgeTypes.has(b) });
  return badge;
}

async function objectiveFor(ctx: SimulatorContext, target: Target): Promise<{ id: string; statement: string }> {
  const key = str(target.objectiveKey, "target.objectiveKey");
  const seeds = JSON.parse(readFileSync(path.join(dataDir, "objectives.json"), "utf8")) as Array<{ key: string; statement: string }>;
  const seed = seeds.find((o) => o.key === key);
  if (!seed) throw new Error(`unknown Objective key ${key}`);
  const objective = (await listObjectives(ctx.tenantId)).find((o) => o.statement === seed.statement);
  if (!objective) throw new Error(`Objective ${key} is not seeded; reset the demo data`);
  return { id: objective.id, statement: objective.statement };
}

async function seuFor(ctx: SimulatorContext, target: Target): Promise<string> {
  const objective = await objectiveFor(ctx, target);
  const { data: seu, error } = await seusDB.findByObjectiveId(objective.id);
  if (error) throw error;
  if (!seu) throw new Error(`Objective ${String(target.objectiveKey)} has no SEU yet; run its commission scenario first`);
  return seu.id;
}

async function deliverableFor(seuId: string, code: string) {
  const { data, error } = await deliverablesDB.findBySeuId(seuId);
  if (error) throw error;
  const deliverable = (data ?? []).find((d) => d.name === code);
  if (!deliverable) throw new Error(`the SEU has no Deliverable "${code}"`);
  return deliverable;
}

async function findingFor(seuId: string, title: string) {
  for (const review of await listReviewsBySeu(seuId)) {
    const finding = (await listFindingsByReview(review.id)).find((f) => f.title === title);
    if (finding) return finding;
  }
  throw new Error(`the SEU has no Finding "${title}"`);
}

async function outstandingWorkItem(seuId: string, deliverableCode: unknown) {
  const { data, error } = await workItemsDB.findOutstandingBySeuDetailed(seuId);
  if (error) throw error;
  const item = (data ?? []).find((w) => typeof deliverableCode !== "string" || w.deliverable_name === deliverableCode);
  if (!item) throw new Error("the SEU has no outstanding Work Item to act on yet");
  return item;
}

async function waitFor<T>(label: string, probe: () => Promise<T | null | undefined>, timeoutMs = 30000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = await probe();
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`timed out waiting for ${label}`);
}

// The SEU's authoring steps (Compose EBM, finalize) record the acting user's engagement Participant in the SEU.
async function ensureEngagement(ctx: SimulatorContext, seuId: string): Promise<void> {
  const { data: existing, error } = await participantsDB.findBySeuIdAndParticipantMasterId(seuId, ctx.participantId);
  if (error) throw error;
  if (existing) return;
  const { data: master, error: masterError } = await participantsMasterDB.findById(ctx.participantId);
  if (masterError || !master) throw masterError ?? new Error("Demo User participant not found");
  const { error: createError } = await participantsDB.create({ seuId, type: master.type, displayName: master.display_name, participantId: master.id });
  if (createError) throw createError;
}

const handlers: Record<string, Handler> = {
  async "commission-objective"(ctx, sc) {
    const objective = await objectiveFor(ctx, sc.target);
    await grantRouteBadges(ctx.participantId, "POST", `/aisworg/seu/objectives/${objective.id}/commission`);
    const { data: template } = await templatesDB.findActiveByCode(str(sc.payload.templateCode, "payload.templateCode"), ctx.tenantId);
    if (!template) throw new Error("the Demo Template is not Active; reset the demo data");
    const profileCode = str(sc.payload.profileCode, "payload.profileCode");
    const { data: profiles } = await profilesDB.findActiveVisibleTo(ctx.tenantId);
    const profile = (profiles ?? []).find((p) => p.code === profileCode);
    if (!profile) throw new Error(`Profile ${profileCode} is not Active; reset the demo data`);
    const initiated = await initiateSeu({ objectiveId: objective.id, profileId: profile.id, actorId: ctx.participantId, tenantId: ctx.tenantId });
    if (!initiated.ok) throw new Error(`commissioning stopped at initiate_seu: ${initiated.reason}`);
    const validated = await validateSeu({ seuId: initiated.seu.id, actorId: ctx.participantId });
    if (!validated.ok) throw new Error(`commissioning stopped at validate_request: ${"detail" in validated ? validated.detail : validated.reason}`);
    const seuId = initiated.seu.id;
    await ensureEngagement(ctx, seuId);

    const selections = [{ templateId: template.id, profileId: profile.id }];
    const composition = await previewCommissioningValidation({ selections, viewerTenantId: ctx.tenantId });
    if (composition.compositionConflicts.length > 0) throw new Error(`composition has ${composition.compositionConflicts.length} unresolved conflict(s)`);
    await seusDB.setCompositionReport(seuId, { selections, ...composition, resolvedParameterOverrides: undefined, resolvedCompositionConflicts: {} });
    await grantTransitionBadge(ctx.participantId, "EBM", BIRTH_STATE, "Composed");
    const composeBadge = await authorBadgeFor(ctx, "POST", `/aisworg/seu/objectives/${objective.id}/compose-ebm`);
    await eventBus.publish({
      eventType: "CompositionCompleted", originatingObjectType: "SEU", originatingObjectId: seuId, seuId,
      correlationId: eventBus.newCorrelationId(), payload: { seuId, authorBadge: composeBadge },
      actorId: ctx.participantId, authorityBadge: composeBadge,
    });

    const ebmId = await waitFor("the EBM to be composed", async () => (await seusDB.findById(seuId)).data?.active_ebm_id);
    for (const [from, to] of [["Composed", "Validated"], ["Validated", "Active"]] as const) {
      await grantTransitionBadge(ctx.participantId, "EBM", from, to);
      let step;
      if (to === "Validated") {
        step = await validateEbm({ ebmId, actorId: ctx.participantId });
      } else {
        step = await transitionEntity({ entityType: "EBM", entityId: ebmId, targetState: to, actorId: ctx.participantId, seuId });
        if (step.ok) await publishTransition(step);
      }
      if (!step.ok) throw new Error(`EBM ${from} -> ${to} blocked: ${"detail" in step ? step.detail : step.reason}`);
    }
    const state = await waitFor("the SEU to finish commissioning", async () => {
      const lifecycle = (await seusDB.findById(seuId)).data?.lifecycle_state;
      return lifecycle === "Activated" || lifecycle === "Operational" || lifecycle === "Failed" ? lifecycle : null;
    });
    if (state === "Failed") throw new Error("commissioning failed after the EBM was activated; see the SEU's CommissionFailed event");
    return `Commissioned and activated an SEU for "${objective.statement}".`;
  },

  async "complete-deliverable"(ctx, sc) {
    const seuId = await seuFor(ctx, sc.target);
    const item = await outstandingWorkItem(seuId, sc.target.deliverableCode);
    const result = await completeWorkItem({ workItemId: item.id, outcome: "done" });
    if (!result.ok) throw new Error(result.detail);
    return `Work on "${item.deliverable_name}" reported done.`;
  },

  async "raise-blocker"(ctx, sc) {
    const seuId = await seuFor(ctx, sc.target);
    const item = await outstandingWorkItem(seuId, sc.target.deliverableCode);
    const outcome = sc.payload.outcome === "failed" ? "failed" : "blocked";
    const result = await completeWorkItem({ workItemId: item.id, outcome });
    if (!result.ok) throw new Error(result.detail);
    return `Work on "${item.deliverable_name}" reported ${outcome}; an Attention Item was raised.`;
  },

  async "release-blocker"(ctx, sc) {
    const seuId = await seuFor(ctx, sc.target);
    for (const [from, to] of [["Delivered", "Acknowledged"], ["Acknowledged", "In Progress"], ["In Progress", "Resolved"]] as const) {
      await grantTransitionBadge(ctx.participantId, "AttentionItem", from, to);
    }
    const { data: items, error } = await attentionItemsDB.findBySeuId(seuId);
    if (error) throw error;
    const open = (items ?? []).filter((a) => !["Resolved", "Closed"].includes(a.status)).sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
    if (!open) throw new Error("the SEU has no open Attention Item");
    for (const target of ["Acknowledged", "In Progress", "Resolved"]) {
      const current = (await attentionItemsDB.findById(open.id)).data;
      if (current?.status === target || (target === "Acknowledged" && current && ["In Progress", "Resolved"].includes(current.status))) continue;
      const result = await transitionAttentionItem({ attentionItemId: open.id, targetState: target, actorId: ctx.participantId });
      if (!result.ok) throw new Error("detail" in result ? result.detail : result.reason);
    }
    return `Released "${open.title}"; re-dispatch follows from the Resolved event.`;
  },

  async "raise-risk"(ctx, sc) {
    const seuId = await seuFor(ctx, sc.target);
    const authorBadge = await authorBadgeFor(ctx, "POST", "/aisworg/api/seu/obligations");
    const obligation = await createObligation({
      relatedObjectType: "SEU", relatedObjectId: seuId, category: str(sc.category, "category"), title: sc.title,
      description: sc.description, severity: sc.severity ?? undefined, priority: sc.priority, origin: typeof sc.payload.origin === "string" ? sc.payload.origin : null,
      actorId: ctx.participantId, authorBadge,
    });
    return `Raised Risk "${obligation.title}".`;
  },

  async "raise-finding"(ctx, sc) {
    const seuId = await seuFor(ctx, sc.target);
    const deliverable = await deliverableFor(seuId, str(sc.target.deliverableCode, "target.deliverableCode"));
    const review = await createReview({
      seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverable.id,
      category: str(sc.payload.reviewCategory, "payload.reviewCategory"), name: str(sc.payload.reviewName, "payload.reviewName"),
      actorId: ctx.participantId,
    });
    await createFinding({ reviewId: review.id, severity: str(sc.severity, "severity"), title: sc.title, description: sc.description, actorId: ctx.participantId });
    return `Raised ${sc.severity} Finding "${sc.title}" on "${deliverable.name}".`;
  },

  async "convert-finding"(ctx, sc) {
    const seuId = await seuFor(ctx, sc.target);
    const finding = await findingFor(seuId, str(sc.target.findingTitle, "target.findingTitle"));
    const result = await convertFindingToObligation({ findingId: finding.id, category: typeof sc.payload.category === "string" ? sc.payload.category : undefined, actorId: ctx.participantId });
    if (!result.ok) throw new Error(result.detail);
    return `Converted Finding "${finding.title}" to an Obligation.`;
  },

  async "waive-blocker"(ctx, sc) {
    const seuId = await seuFor(ctx, sc.target);
    const finding = await findingFor(seuId, str(sc.target.findingTitle, "target.findingTitle"));
    await grantTransitionBadge(ctx.participantId, "Finding", "Open", "Waived");
    const result = await transitionFinding({ findingId: finding.id, targetState: "Waived", actorId: ctx.participantId });
    if (!result.ok) throw new Error("detail" in result ? String(result.detail) : result.reason);
    return `Waived Finding "${finding.title}".`;
  },

  async "accept-ontology-code"(ctx, sc) {
    const conceptType = str(sc.payload.conceptType, "payload.conceptType");
    const code = str(sc.payload.code, "payload.code");
    await grantTransitionBadge(ctx.participantId, "Ontology", "Draft", "Active");
    await approveConcept(conceptType, code, ctx.tenantId, { isRoot: false, tenantId: ctx.tenantId, actorId: ctx.participantId, actorBadge: "ontology_define" });
    const { data: pack } = await packsDB.findByCodeAndVersion(str(sc.payload.packCode, "payload.packCode"), INITIAL_VERSION, ctx.tenantId);
    if (!pack) throw new Error("the reader privacy Pack is not seeded; reset the demo data");
    let status: string = pack.status;
    while (status !== "Active") {
      const advanced = await publishAuthoringDraft({ kind: "Pack", id: pack.id, actorId: ctx.participantId });
      if (!advanced.ok) throw new Error(advanced.errors.join("; "));
      status = advanced.status;
    }
    return `Accepted "${code}" in the Ontology and activated Pack "${pack.code}".`;
  },
};

export async function listAllowedScenarios(tenantId: string): Promise<DemoScenarioRow[]> {
  const { data, error } = await demoScenariosDB.findByTenant(tenantId, { enabledOnly: true });
  if (error) throw error;
  return data ?? [];
}

export async function listAllScenarios(tenantId: string): Promise<DemoScenarioRow[]> {
  const { data, error } = await demoScenariosDB.findByTenant(tenantId);
  if (error) throw error;
  return data ?? [];
}

export async function listPlaybooks(tenantId: string): Promise<DemoPlaybookRow[]> {
  const { data, error } = await demoPlaybooksDB.findByTenant(tenantId, { enabledOnly: true });
  if (error) throw error;
  return data ?? [];
}

export async function runScenario(code: string, opts: { allowDisabled?: boolean } = {}): Promise<SimulatorResult> {
  try {
    const ctx = await getContext();
    await grantAllTransitionBadges(ctx.participantId);
    const { data: scenario, error } = await demoScenariosDB.findByCode(ctx.tenantId, code);
    if (error) throw error;
    if (!scenario) return { ok: false, message: `No scenario "${code}".` };
    if (!scenario.enabled && !opts.allowDisabled) return { ok: false, message: `Scenario "${code}" is disabled.` };
    const handler = handlers[scenario.kind];
    if (!handler) return { ok: false, message: `No handler for scenario kind "${scenario.kind}".` };
    return { ok: true, message: await handler(ctx, scenario) };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

// Runs the playbook step at `index` and reports the index of the next step, or null when finished.
export async function stepPlaybook(code: string, index: number): Promise<SimulatorResult & { nextIndex: number | null }> {
  const ctx = await getContext();
  const { data: playbook, error } = await demoPlaybooksDB.findByCode(ctx.tenantId, code);
  if (error) throw error;
  if (!playbook || !playbook.enabled) return { ok: false, message: `No enabled playbook "${code}".`, nextIndex: null };
  const scenarioCode = playbook.steps[index];
  if (!scenarioCode) return { ok: false, message: `Playbook "${code}" has no step ${index + 1}.`, nextIndex: null };
  const result = await runScenario(scenarioCode);
  const next = index + 1 < playbook.steps.length ? index + 1 : null;
  return { ...result, nextIndex: result.ok ? next : index };
}

export async function setScenarioEnabled(code: string, enabled: boolean): Promise<void> {
  const ctx = await getContext();
  const { data, error } = await demoScenariosDB.setEnabled(ctx.tenantId, code, enabled);
  if (error) throw error;
  if (!data) throw new Error(`No scenario "${code}".`);
}

export async function resetDemo(): Promise<void> {
  await seedDemo();
}

