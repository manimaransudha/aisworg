import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { badgeAuthorityEngine } from "../../../domain/engine/badgeAuthorityEngine.js";
import { lookupRouteAuthority } from "../../../domain/identity/routeAuthorityCache.js";
import { resolveAuthorBadge } from "../../../domain/identity/heldBadges.js";
import { demoStepsDB, type DemoStepRow } from "../../../dblayer/demoStepsDB.js";
import { demoScenariosDB, type DemoScenarioRow } from "../../../dblayer/demoScenariosDB.js";
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
import { getDemoActor, grantBadge, grantAllTransitionBadges, grantRouteBadges, grantTransitionBadge, type DemoActor } from "../../../dblayer/seed/demo/demoBadges.js";
import { seedDemo } from "../../../dblayer/seed/demo/demoSeed.js";
import { listObjectives } from "./objectives.js";
import { initiateSeu, validateSeu, previewCommissioningValidation, validateEbm } from "./commissioning.js";
import { transitionEntity, publishTransition } from "../../../domain/engine/entityTransition.js";
import { completeWorkItem } from "./workItems.js";
import { transitionAttentionItem } from "./attentionItems.js";
import { createReview, listReviewsBySeu } from "./reviews.js";
import { createFinding, transitionFinding, convertFindingToObligation, listFindingsByReview } from "./findings.js";
import { createObligation } from "./obligations.js";
import { approveConcept, validateComposableFieldsAgainstSchema } from "./ontology.js";
import { createAuthoringDraft, publishAuthoringDraft } from "./sdkAuthoring.js";
import { renderMarkdown, renderInlineMarkdown } from "../../../domain/sdk/markdownRender.js";
import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import type { JsonSchemaDocument } from "../../../domain/sdk/formGenerator.js";
import { BIRTH_STATE, INITIAL_VERSION, DEMO_VISITOR_STEP_KIND, DEMO_NOTE_STEP_KIND } from "../../../dblayer/constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "..", "..", "dblayer", "seed", "data", "demo");

export interface SimulatorResult {
  ok: boolean;
  message: string;
}

interface SimulatorContext extends DemoActor {
}

type Target = Record<string, unknown>;
type Handler = (ctx: SimulatorContext, step: DemoStepRow) => Promise<string>;

const str = (value: unknown, label: string): string => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`step is missing "${label}"`);
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
  const has = (b: string) => isRoot || badgeTypes.has(b);
  return resolveAuthorBadge(found, { isRoot, badgeTypes, has, hasVerb: (entityType, verb) => !!verb && has(`${entityType.toLowerCase()}_${verb}`) });
}

// The Objective keys a step target can name, from the Objective seed.
export function listObjectiveKeys(): string[] {
  return (JSON.parse(readFileSync(path.join(dataDir, "objectives.json"), "utf8")) as Array<{ key: string }>).map((o) => o.key);
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
  if (!seu) throw new Error(`Objective ${String(target.objectiveKey)} has no SEU yet; run its commission step first`);
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
  async "commission-objective"(ctx, st) {
    const objective = await objectiveFor(ctx, st.target);
    await grantRouteBadges(ctx.participantId, "POST", `/aisworg/seu/objectives/${objective.id}/commission`);
    const { data: template } = await templatesDB.findActiveByCodeVisibleTo(str(st.payload.templateCode, "payload.templateCode"), ctx.tenantId);
    if (!template) throw new Error("the Demo Template is not Active; reset the demo data");
    const profileCode = str(st.payload.profileCode, "payload.profileCode");
    const { data: profiles } = await profilesDB.listActiveOptionRows(ctx.tenantId);
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
    // Commented out (owner): the old conflict check is replaced by the detectors. How the demo answers their conflicts is to be decided.
    // if (composition.compositionConflicts.length > 0) throw new Error(`composition has ${composition.compositionConflicts.length} unresolved conflict(s)`);
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

  async "complete-deliverable"(ctx, st) {
    const seuId = await seuFor(ctx, st.target);
    const item = await outstandingWorkItem(seuId, st.target.deliverableCode);
    const result = await completeWorkItem({ workItemId: item.id, outcome: "done" });
    if (!result.ok) throw new Error(result.detail);
    return `Work on "${item.deliverable_name}" reported done.`;
  },

  async "raise-blocker"(ctx, st) {
    const seuId = await seuFor(ctx, st.target);
    const item = await outstandingWorkItem(seuId, st.target.deliverableCode);
    const outcome = st.payload.outcome === "failed" ? "failed" : "blocked";
    const result = await completeWorkItem({ workItemId: item.id, outcome });
    if (!result.ok) throw new Error(result.detail);
    return `Work on "${item.deliverable_name}" reported ${outcome}; an Attention Item was raised.`;
  },

  async "release-blocker"(ctx, st) {
    const seuId = await seuFor(ctx, st.target);
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

  async "raise-risk"(ctx, st) {
    const seuId = await seuFor(ctx, st.target);
    const authorBadge = await authorBadgeFor(ctx, "POST", "/aisworg/api/seu/obligations");
    const obligation = await createObligation({
      relatedObjectType: "SEU", relatedObjectId: seuId, category: str(st.payload.category, "payload.category"), title: st.title,
      description: st.description, severity: typeof st.payload.severity === "string" ? st.payload.severity : undefined, priority: typeof st.payload.priority === "string" ? st.payload.priority : null, origin: typeof st.payload.origin === "string" ? st.payload.origin : null,
      actorId: ctx.participantId, authorBadge,
    });
    return `Raised Risk "${obligation.title}".`;
  },

  async "raise-finding"(ctx, st) {
    const seuId = await seuFor(ctx, st.target);
    const deliverable = await deliverableFor(seuId, str(st.target.deliverableCode, "target.deliverableCode"));
    const severity = str(st.payload.severity, "payload.severity");
    const review = await createReview({
      seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverable.id,
      category: str(st.payload.reviewCategory, "payload.reviewCategory"), name: str(st.payload.reviewName, "payload.reviewName"),
      actorId: ctx.participantId,
    });
    await createFinding({ reviewId: review.id, severity: severity, title: st.title, description: st.description, actorId: ctx.participantId });
    return `Raised ${severity} Finding "${st.title}" on "${deliverable.name}".`;
  },

  async "convert-finding"(ctx, st) {
    const seuId = await seuFor(ctx, st.target);
    const finding = await findingFor(seuId, str(st.target.findingTitle, "target.findingTitle"));
    const result = await convertFindingToObligation({ findingId: finding.id, category: typeof st.payload.category === "string" ? st.payload.category : undefined, actorId: ctx.participantId });
    if (!result.ok) throw new Error(result.detail);
    return `Converted Finding "${finding.title}" to an Obligation.`;
  },

  async "waive-blocker"(ctx, st) {
    const seuId = await seuFor(ctx, st.target);
    const finding = await findingFor(seuId, str(st.target.findingTitle, "target.findingTitle"));
    await grantTransitionBadge(ctx.participantId, "Finding", "Open", "Waived");
    const result = await transitionFinding({ findingId: finding.id, targetState: "Waived", actorId: ctx.participantId });
    if (!result.ok) throw new Error("detail" in result ? String(result.detail) : result.reason);
    return `Waived Finding "${finding.title}".`;
  },

  async "create-pack"(ctx, st) {
    const pack = st.payload.pack as Record<string, unknown> | undefined;
    if (!pack || typeof pack !== "object") throw new Error('step is missing "payload.pack"');
    const code = str(pack.code, "payload.pack.code");
    const creationBadge = str(st.payload.creationBadge, "payload.creationBadge");
    await grantBadge(ctx.participantId, creationBadge);
    const { data: schema, error: schemaError } = await schemaDefinitionsDB.findLatest("Pack");
    if (schemaError || !schema) throw schemaError ?? new Error("no schema_definitions grammar for Pack");
    const authorBadge = await badgeAuthorityEngine.resolveAuthorBadge(ctx.participantId, creationBadge);
    const created = await createAuthoringDraft({ kind: "Pack", actorId: ctx.participantId, authorBadge, tenantId: ctx.tenantId, content: pack, schemaDefinitionId: schema.id });
    if (!created.ok) throw new Error(created.errors.join("; "));
    let status = "Draft";
    while (status !== "Active") {
      if (status === "Validated") {
        const pending = await validateComposableFieldsAgainstSchema(schema.schema as JsonSchemaDocument, { code, category: pack.category }, { isRoot: false, tenantId: ctx.tenantId });
        if (pending.length > 0) return `Authored Pack "${code}" and validated it. It waits for its code to be accepted in the Ontology before it can be activated.`;
      }
      const advanced = await publishAuthoringDraft({ kind: "Pack", id: created.draftId, actorId: ctx.participantId });
      if (!advanced.ok) throw new Error(advanced.errors.join("; "));
      status = advanced.status;
    }
    return `Authored and activated Pack "${code}".`;
  },

  async "accept-ontology-code"(ctx, st) {
    const conceptType = str(st.payload.conceptType, "payload.conceptType");
    const code = str(st.payload.code, "payload.code");
    const packCode = str(st.payload.packCode, "payload.packCode");
    const { data: pack } = await packsDB.findByCodeAndVersion(packCode, INITIAL_VERSION, ctx.tenantId);
    if (!pack) throw new Error(`Pack "${packCode}" was not found. Create it first, using the code given in the earlier steps.`);
    await grantTransitionBadge(ctx.participantId, "Ontology", "Draft", "Active");
    await approveConcept(conceptType, code, ctx.tenantId, { isRoot: false, tenantId: ctx.tenantId, actorId: ctx.participantId, actorBadge: await badgeAuthorityEngine.resolveAuthorBadge(ctx.participantId, "ontology_approve") });
    let status: string = pack.status;
    while (status !== "Active") {
      const advanced = await publishAuthoringDraft({ kind: "Pack", id: pack.id, actorId: ctx.participantId });
      if (!advanced.ok) throw new Error(advanced.errors.join("; "));
      status = advanced.status;
    }
    return `Accepted "${code}" in the Ontology and activated Pack "${pack.code}".`;
  },
};

// The step kinds a step can be saved with: the handlers above, the visitor step and the note.
export function listStepKinds(): string[] {
  return [...Object.keys(handlers), DEMO_VISITOR_STEP_KIND, DEMO_NOTE_STEP_KIND].sort();
}

export async function listAllowedSteps(tenantId: string): Promise<DemoStepRow[]> {
  const { data, error } = await demoStepsDB.findByTenant(tenantId, { enabledOnly: true });
  if (error) throw error;
  return data ?? [];
}

export async function listAllSteps(tenantId: string): Promise<DemoStepRow[]> {
  const { data, error } = await demoStepsDB.findByTenant(tenantId);
  if (error) throw error;
  return data ?? [];
}

export async function listScenarios(tenantId: string, opts: { includeDisabled?: boolean } = {}): Promise<DemoScenarioRow[]> {
  const { data, error } = await demoScenariosDB.findByTenant(tenantId, { enabledOnly: !opts.includeDisabled });
  if (error) throw error;
  return data ?? [];
}

export async function runStep(code: string, opts: { allowDisabled?: boolean } = {}): Promise<SimulatorResult> {
  try {
    const ctx = await getContext();
    await grantAllTransitionBadges(ctx.participantId);
    const { data: step, error } = await demoStepsDB.findByCode(ctx.tenantId, code);
    if (error) throw error;
    if (!step) return { ok: false, message: `No step "${code}".` };
    if (!step.enabled && !opts.allowDisabled) return { ok: false, message: `Step "${code}" is disabled.` };
    if (step.kind === DEMO_VISITOR_STEP_KIND) return { ok: false, message: `"${step.title}" is a step for the visitor and has nothing to run.` };
    if (step.kind === DEMO_NOTE_STEP_KIND) return { ok: false, message: `"${step.title}" is a note and has nothing to run.` };
    const handler = handlers[step.kind];
    if (!handler) return { ok: false, message: `No handler for step kind "${step.kind}".` };
    return { ok: true, message: await handler(ctx, step) };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

// Runs the scenario's next step. The scenario's stored progress decides which step of its playbook that is.
export async function advanceScenario(code: string): Promise<SimulatorResult & { finished: boolean }> {
  const ctx = await getContext();
  const { data: scenario, error } = await demoScenariosDB.findByCode(ctx.tenantId, code);
  if (error) throw error;
  if (!scenario || !scenario.enabled) return { ok: false, message: `No enabled scenario "${code}".`, finished: false };
  const stepCode = scenario.playbook[scenario.progress];
  if (!stepCode) return { ok: false, message: `"${scenario.title}" is already complete.`, finished: true };
  const { data: step, error: stepError } = await demoStepsDB.findByCode(ctx.tenantId, stepCode);
  if (stepError) throw stepError;
  // A visitor step is done by the visitor in the application; marking it done only advances the scenario.
  // A note has no action; continuing past it only advances the scenario.
  const result: SimulatorResult = step?.kind === DEMO_VISITOR_STEP_KIND ? { ok: true, message: `Step "${step.title}" marked done.` }
    : step?.kind === DEMO_NOTE_STEP_KIND ? { ok: true, message: `Note "${step.title}" read.` }
    : await runStep(stepCode);
  if (!result.ok) return { ...result, finished: false };
  const { error: progressError } = await demoScenariosDB.setProgress(ctx.tenantId, code, scenario.progress + 1);
  if (progressError) throw progressError;
  return { ...result, finished: scenario.progress + 1 >= scenario.playbook.length };
}

export interface GuideStep {
  title: string;
  titleHtml: string;
  annotation: string | null;
  annotationHtml: string;
  copy: Array<{ label: string; text: string }>;
  visitor: boolean;
  note: boolean;
}

export interface GuideState {
  code: string;
  number: number;
  title: string;
  titleHtml: string;
  index: number;
  total: number;
  finished: boolean;
  step: GuideStep | null;
}

// The state the guide panel shows for one scenario: its position among the scenarios of its area, and the step the visitor is on.
export async function getGuide(code: string): Promise<GuideState | null> {
  const ctx = await getContext();
  const { data: scenario, error } = await demoScenariosDB.findByCode(ctx.tenantId, code);
  if (error) throw error;
  if (!scenario || !scenario.enabled) return null;
  const sameArea = (await listScenarios(ctx.tenantId)).filter((p) => p.area === scenario.area);
  const stepCode = scenario.playbook[scenario.progress];
  const { data: step, error: stepError } = stepCode ? await demoStepsDB.findByCode(ctx.tenantId, stepCode) : { data: null, error: undefined };
  if (stepError) throw stepError;
  // Notes are not counted: the index and total count the playbook's other steps only.
  const { data: allSteps, error: allError } = await demoStepsDB.findByTenant(ctx.tenantId);
  if (allError) throw allError;
  const isNote = (c: string): boolean => (allSteps ?? []).find((s) => s.code === c)?.kind === DEMO_NOTE_STEP_KIND;
  const visitor = step?.kind === DEMO_VISITOR_STEP_KIND;
  return {
    code: scenario.code,
    number: sameArea.findIndex((p) => p.code === scenario.code) + 1,
    title: scenario.title,
    titleHtml: renderInlineMarkdown(scenario.title),
    index: scenario.playbook.slice(0, scenario.progress).filter((c) => !isNote(c)).length,
    total: scenario.playbook.filter((c) => !isNote(c)).length,
    finished: !step,
    step: step ? {
      title: step.title,
      titleHtml: renderInlineMarkdown(step.title),
      annotation: step.annotation,
      annotationHtml: renderMarkdown(step.annotation ?? ""),
      copy: Array.isArray(step.payload.copy) ? (step.payload.copy as Array<{ label: string; text: string }>) : [],
      visitor,
      note: step.kind === DEMO_NOTE_STEP_KIND,
    } : null,
  };
}

export async function setStepEnabled(code: string, enabled: boolean): Promise<void> {
  const ctx = await getContext();
  const { data, error } = await demoStepsDB.setEnabled(ctx.tenantId, code, enabled);
  if (error) throw error;
  if (!data) throw new Error(`No step "${code}".`);
}

export async function resetDemo(): Promise<void> {
  await seedDemo();
}
