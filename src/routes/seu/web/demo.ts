import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { renderMarkdown, renderInlineMarkdown } from "../../../domain/sdk/markdownRender.js";
import { getFlash } from "../../../utils/flash.js";
import { redirects } from "../../../middleware/redirects.js";
import { emailService } from "../../../domain/auth/emailService.js";
import { logger } from "../../../utils/logger.js";
import { parseListParams, paginateList } from "../../../utils/listQuery.js";
import { requireTenantScope } from "../../../middleware/requireTenantScope.js";
import { tenantsDB } from "../../../dblayer/tenantsDB.js";
import { DEMO_TENANT_NAME, DEMO_AREAS, DEMO_VISITOR_STEP_KIND, DEMO_NOTE_STEP_KIND, DEMO_STEPS_TAB } from "../../../dblayer/constants.js";
import type { TenantRow } from "../../../dblayer/seuTypes.js";
import { resolveActorAndBadge } from "../../../domain/identity/heldBadges.js";
import { nextActionsFor } from "../../../domain/engine/entityTransition.js";
import { evidenceDB } from "../../../dblayer/evidenceDB.js";
import { knowledgeItemsDB } from "../../../dblayer/knowledgeItemsDB.js";
import { createEvidence, transitionEvidence } from "../core/evidence.js";
import { createKnowledgeItem, promoteKnowledgeItemScope, transitionKnowledgeItem } from "../core/knowledge.js";
import { getParticipantHomeView, completeMyWorkItem, raiseMyObligation } from "../core/participantHome.js";
import type { WorkItemOutcome } from "../core/workItems.js";
import { listViewerParticipants, getViewerParticipant, getViewerObligationOptions, resolveViewerAuthorBadge } from "../core/demoParticipantViewer.js";
import type { AcquisitionScope, ParticipantMasterRow } from "../../../dblayer/seuTypes.js";
import { listAreaContent, saveAreaContent, createStep, updateStep, createScenario, updateScenario, setScenarioEnabled } from "../core/demoCatalogue.js";
import { getDemoActor } from "../../../dblayer/seed/demo/demoBadges.js";
import { listStepKinds, listAllSteps, listScenarios, runStep, setStepEnabled, advanceScenario, resetDemo, getGuide } from "../core/demoSimulator.js";

// Every demo route is reachable only from the Demo tenant (root is always in reach).
const demoTenantOnly = requireTenantScope.forParam<TenantRow>("demo", () => tenantsDB.findByName(DEMO_TENANT_NAME), (tenant) => tenant.id);
router.use("/demo", (req: Request, res: Response, next: NextFunction) => {
  void demoTenantOnly(req, res, next, "demo");
});

const landingPath = "/aisworg/seu/demo";
const rootPath = "/aisworg/seu/demo/root";

async function renderDemo(req: Request, res: Response, next: NextFunction, root: boolean): Promise<void> {
  try {
    const { tenantId } = await getDemoActor();
    const area = DEMO_AREAS.find((a) => a === req.query.category) ?? DEMO_AREAS[0];
    const catalogue = await listAllSteps(tenantId);
    const stepsTab = root && req.query.category === DEMO_STEPS_TAB;
    const steps = stepsTab ? catalogue : (root ? catalogue : catalogue.filter((s) => s.enabled)).filter((s) => s.area === area);
    const byCode = new Map(catalogue.map((s) => [s.code, s]));
    const basePath = root ? rootPath : landingPath;
    const params = parseListParams(req.query, { sortable: ["area", "code", "kind", "title"], defaultSort: "code", defaultDir: "asc" });
    req.vm.req.title = root ? "Demo Root" : "Demo";
    req.vm.req.root = root;
    const areaContent = await listAreaContent(tenantId);
    req.vm.req.areaContent = areaContent.map((a) => ({ area: a.area, stageTitle: a.stage_title, howToLead: a.how_to_lead, howToSteps: a.how_to_steps }));
    req.vm.opt.kinds = listStepKinds();
    req.vm.opt.noteKind = DEMO_NOTE_STEP_KIND;
    req.vm.opt.stepsTab = stepsTab;
    req.vm.opt.stepsTabName = DEMO_STEPS_TAB;
    req.vm.opt.stepOptions = catalogue.map((s) => ({ code: s.code, title: s.title, area: s.area, description: s.description ?? "" }));
    req.vm.req.scenarios = (await listScenarios(tenantId, { includeDisabled: root })).filter((p) => p.area === area).map((p) => ({
      code: p.code,
      enabled: p.enabled,
      sortOrder: p.sort_order,
      playbook: p.playbook,
      title: p.title,
      progress: p.progress,
      done: p.playbook.slice(0, p.progress).filter((c) => byCode.get(c)?.kind !== DEMO_NOTE_STEP_KIND).length,
      total: p.playbook.filter((c) => byCode.get(c)?.kind !== DEMO_NOTE_STEP_KIND).length,
      steps: p.playbook.map((code) => byCode.get(code)).filter((s): s is NonNullable<typeof s> => !!s).map((s) => ({
        code: s.code,
        title: s.title,
        annotation: s.annotation,
        visitor: s.kind === DEMO_VISITOR_STEP_KIND,
        note: s.kind === DEMO_NOTE_STEP_KIND,
        copy: Array.isArray(s.payload.copy) ? (s.payload.copy as Array<{ label: string; text: string }>) : [],
      })),
    }));
    req.vm.req.areas = DEMO_AREAS;
    req.vm.req.area = area;
    const stepList = paginateList(steps, params, {
      searchFields: [(s) => s.area, (s) => s.code, (s) => s.title, (s) => s.kind, (s) => s.description],
      sortFields: {
        area: (s) => s.area,
        code: (s) => s.code,
        kind: (s) => s.kind,
        title: (s) => s.title,
      },
    });
    req.vm.req.list = { ...stepList, category: stepsTab ? DEMO_STEPS_TAB : area };
    req.vm.opt.listBasePath = basePath;
    req.vm.opt.renderMarkdown = renderMarkdown;
    req.vm.opt.renderInlineMarkdown = renderInlineMarkdown;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/demo/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/demo] GET error", err as Error);
    next(err);
  }
}

router.get("/demo", attachVM("seu/demo/index"), (req: Request, res: Response, next: NextFunction) => renderDemo(req, res, next, false));
router.get("/demo/root", attachVM("seu/demo/index"), (req: Request, res: Response, next: NextFunction) => renderDemo(req, res, next, true));

function backFor(req: Request): string {
  const base = req.body?.from === "root" ? rootPath : landingPath;
  if (req.body?.from === "root" && req.body?.view === DEMO_STEPS_TAB) return `${rootPath}?category=${DEMO_STEPS_TAB}`;
  const area = DEMO_AREAS.find((a) => a === req.body?.category);
  return area ? `${base}?category=${area}` : base;
}

router.post("/demo/reset", async (req: Request, res: Response) => {
  const backTo = backFor(req);
  try {
    await resetDemo();
    return redirects.seu.demo.success(req, res, "Demo data was reset to the seeded base state.", backTo);
  } catch (err) {
    logger.error("[web/seu/demo] POST /demo/reset error", err as Error);
    return redirects.seu.demo.error(req, res, `Reset failed: ${(err as Error).message}`, backTo);
  }
});

router.post("/demo/contact", async (req: Request, res: Response) => {
  const backTo = backFor(req);
  try {
    const message = String(req.body?.message ?? "").trim();
    if (!message) return redirects.seu.demo.error(req, res, "Enter a message before sending.", backTo);
    const to = (process.env.SUPERUSER_EMAIL || "").split(",").map((e) => e.trim()).filter(Boolean);
    if (to.length === 0) throw new Error("No superuser email is configured.");
    // The route has a session: the route authority gate runs before the handler.
    const user = req.session.user!;
    await emailService.sendDemoContact({ to, fromName: user.name ?? "", fromEmail: user.email, message });
    return redirects.seu.demo.success(req, res, "Thank you. We will be in touch.", backTo);
  } catch (err) {
    logger.error("[web/seu/demo] POST /demo/contact error", err as Error);
    return redirects.seu.demo.error(req, res, `Message could not be sent: ${(err as Error).message}`, backTo);
  }
});

router.post("/demo/steps/:code/run", async (req: Request, res: Response) => {
  const backTo = backFor(req);
  const result = await runStep(String(req.params.code), { allowDisabled: backTo.startsWith(rootPath) });
  return result.ok ? redirects.seu.demo.success(req, res, result.message, backTo) : redirects.seu.demo.error(req, res, result.message, backTo);
});

router.post("/demo/scenarios/:code/step", async (req: Request, res: Response) => {
  const backTo = backFor(req);
  try {
    const result = await advanceScenario(String(req.params.code));
    return result.ok ? redirects.seu.demo.success(req, res, result.finished ? `${result.message} All steps are done.` : result.message, backTo) : redirects.seu.demo.error(req, res, result.message, backTo);
  } catch (err) {
    logger.error("[web/seu/demo] POST /demo/scenarios/:code/step error", err as Error);
    return redirects.seu.demo.error(req, res, (err as Error).message, backTo);
  }
});

// Participant viewer: the visitor chooses a Demo participant and sees, and acts through, that participant's "My Work" page.
// Each action runs as the chosen participant, under the badges that participant holds. The route's own authority is the Demo role.
const participantsPath = "/aisworg/seu/demo/participants";
const viewerBack = (participantId: string): string => `${participantsPath}?participantId=${encodeURIComponent(participantId)}`;

router.get("/demo/participants", attachVM("seu/demo/participants"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = await getDemoActor();
    const roster = await listViewerParticipants(tenantId);
    const chosenId = typeof req.query.participantId === "string" ? req.query.participantId : "";
    const params = parseListParams(req.query, { sortable: ["name", "type"], defaultSort: "name", defaultDir: "asc" });
    const list = paginateList(roster, params, {
      searchFields: [(p) => p.display_name, (p) => p.type],
      sortFields: { name: (p) => p.display_name, type: (p) => p.type },
    });
    list.participantId = chosenId || undefined;
    req.vm.req.title = "Demo Participants";
    req.vm.req.list = list;
    req.vm.opt.listBasePath = participantsPath;
    req.vm.opt.flash = getFlash(req);
    if (chosenId) {
      const chosen = roster.find((p) => p.id === chosenId);
      if (!chosen) return redirects.seu.demoParticipants.error(req, res, "That participant is not in the Demo tenant.", participantsPath);
      const options = await getViewerObligationOptions(tenantId);
      req.vm.opt.participantHome = await getParticipantHomeView(chosen.id);
      req.vm.opt.actionBase = `${participantsPath}/${chosen.id}`;
      req.vm.opt.obligationCategoryOptions = options.categories;
      req.vm.opt.obligationSeverityOptions = options.severities;
    }
    return renderView(req, res, "seu/demo/participants", req.vm);
  } catch (err) {
    logger.error("[web/seu/demo] GET /demo/participants error", err as Error);
    next(err);
  }
});

// Runs one form action as the chosen participant. The participant must belong to the Demo tenant. The action returns the message shown to the visitor, or throws.
async function actAsParticipant(req: Request, res: Response, run: (participant: ParticipantMasterRow) => Promise<string>): Promise<void> {
  const participantId = String(req.params.participantId);
  const back = viewerBack(participantId);
  try {
    const { tenantId } = await getDemoActor();
    const participant = await getViewerParticipant(participantId, tenantId);
    return redirects.seu.demoParticipants.success(req, res, await run(participant), back);
  } catch (err) {
    logger.error("[web/seu/demo] POST /demo/participants/:participantId action error", err as Error);
    return redirects.seu.demoParticipants.error(req, res, (err as Error).message, back);
  }
}

router.post("/demo/participants/:participantId/seus/:seuId/obligations", (req: Request, res: Response) => actAsParticipant(req, res, async (participant) => {
  const { deliverableId, category, title, description, severity, completionCriteria } = req.body ?? {};
  if (typeof deliverableId !== "string" || !deliverableId.trim() || typeof category !== "string" || !category.trim() || typeof title !== "string" || !title.trim()) {
    throw new Error("Deliverable, category and title are required.");
  }
  const result = await raiseMyObligation({ userId: participant.id, seuId: String(req.params.seuId), deliverableId, category, title, description, severity, completionCriteria });
  if (!result.ok) throw new Error(result.detail);
  return `Obligation "${result.obligation.title}" created (${result.obligation.category}, ${result.obligation.severity}).`;
}));

router.post("/demo/participants/:participantId/work-items/:workItemId/complete", (req: Request, res: Response) => actAsParticipant(req, res, async (participant) => {
  const { outcome, reference } = req.body ?? {};
  if (typeof outcome !== "string" || !["done", "failed", "blocked"].includes(outcome)) throw new Error("Outcome must be done, failed or blocked.");
  const result = await completeMyWorkItem({
    userId: participant.id,
    workItemId: String(req.params.workItemId),
    outcome: outcome as WorkItemOutcome,
    reference: typeof reference === "string" && reference.trim() !== "" ? reference : null,
  });
  if (!result.ok) throw new Error(`Could not record result: ${result.detail}`);
  if (result.outcome === "done") return `Result recorded for Deliverable "${result.deliverable.name}".`;
  return `Reported "${result.outcome}" - the transition was not applied and an Attention Item was raised.`;
}));

router.post("/demo/participants/:participantId/seus/:seuId/evidence", (req: Request, res: Response) => actAsParticipant(req, res, async (participant) => {
  const { deliverableId, category, title, description, source, predecessorEvidenceId } = req.body ?? {};
  if (typeof deliverableId !== "string" || !deliverableId.trim() || typeof category !== "string" || !category.trim() || typeof title !== "string" || !title.trim()) {
    throw new Error("Deliverable, category and title are required.");
  }
  const evidence = await createEvidence({
    seuId: String(req.params.seuId), relatedObjectType: "Deliverable", relatedObjectId: deliverableId, category, title, description, source,
    supersedesEvidenceId: predecessorEvidenceId || null, actorId: participant.id, authorBadge: await resolveViewerAuthorBadge(req, participant.id),
  });
  return `Evidence "${evidence.title}" collected (${evidence.category}).`;
}));

router.post("/demo/participants/:participantId/seus/:seuId/evidence/:evidenceId/transition", (req: Request, res: Response) => actAsParticipant(req, res, async (participant) => {
  const evidenceId = String(req.params.evidenceId);
  const { data: evidence } = await evidenceDB.findById(evidenceId);
  if (!evidence) throw new Error("Evidence not found.");
  const targetState = String(req.body?.targetState ?? "");
  const action = (await nextActionsFor("Evidence", evidence.status, participant.id)).find((a) => a.toState === targetState);
  if (!action) throw new Error(`Evidence transition blocked: "${targetState}" is not available from ${evidence.status} for this participant.`);
  const result = await transitionEvidence({ evidenceId, targetState: action.toState, actorId: participant.id });
  if (!result.ok) throw new Error(`Evidence transition blocked: ${"detail" in result ? result.detail : result.reason}`);
  return `Evidence moved from "${result.appliedTransition.fromState}" to "${result.appliedTransition.toState}".`;
}));

router.post("/demo/participants/:participantId/seus/:seuId/knowledge", (req: Request, res: Response) => actAsParticipant(req, res, async (participant) => {
  const { deliverableId, evidenceId, category, title, description, acquisitionScope } = req.body ?? {};
  if (typeof deliverableId !== "string" || !deliverableId.trim() || typeof category !== "string" || !category.trim() || typeof title !== "string" || !title.trim()) {
    throw new Error("Deliverable, category and title are required.");
  }
  if (typeof evidenceId !== "string" || !evidenceId.trim()) throw new Error("Select the supporting Evidence.");
  const knowledgeItem = await createKnowledgeItem({
    seuId: String(req.params.seuId), deliverableId, evidenceReferences: { supports: [evidenceId] }, category, title, description,
    acquisitionScope: acquisitionScope as AcquisitionScope | undefined, actorId: participant.id,
  });
  return `Knowledge Item "${knowledgeItem.title}" observed (${knowledgeItem.category}, ${knowledgeItem.acquisition_scope} scope).`;
}));

router.post("/demo/participants/:participantId/seus/:seuId/knowledge/:knowledgeItemId/transition", (req: Request, res: Response) => actAsParticipant(req, res, async (participant) => {
  const knowledgeItemId = String(req.params.knowledgeItemId);
  const { data: knowledgeItem } = await knowledgeItemsDB.findById(knowledgeItemId);
  if (!knowledgeItem) throw new Error("Knowledge Item not found.");
  const targetState = String(req.body?.targetState ?? "");
  const action = (await nextActionsFor("Knowledge", knowledgeItem.status, participant.id)).find((a) => a.toState === targetState);
  if (!action) throw new Error(`Knowledge Item transition blocked: "${targetState}" is not available from ${knowledgeItem.status} for this participant.`);
  const result = await transitionKnowledgeItem({ knowledgeItemId, targetState: action.toState, actorId: participant.id });
  if (!result.ok) throw new Error(`Knowledge Item transition blocked: ${"detail" in result ? result.detail : result.reason}`);
  return `Knowledge Item moved from "${result.appliedTransition.fromState}" to "${result.appliedTransition.toState}".`;
}));

router.post("/demo/participants/:participantId/seus/:seuId/knowledge/:knowledgeItemId/promote-scope", (req: Request, res: Response) => actAsParticipant(req, res, async (participant) => {
  const { targetScope } = req.body ?? {};
  if (typeof targetScope !== "string" || !targetScope.trim()) throw new Error("Target scope is required.");
  const result = await promoteKnowledgeItemScope({ knowledgeItemId: String(req.params.knowledgeItemId), targetScope: targetScope as AcquisitionScope, actorId: participant.id });
  if (!result.ok) throw new Error(`Acquisition Scope promotion blocked: ${"detail" in result ? result.detail : result.reason}`);
  return `Knowledge Item promoted from "${result.appliedTransition.fromState}" to "${result.appliedTransition.toState}" scope.`;
}));

// Guide panel: the scenario the visitor is following is kept in the session, its progress in the Demo tenant.
router.get("/demo/guide", async (req: Request, res: Response) => {
  try {
    const code = req.session.demoGuide;
    return res.json({ guide: code ? await getGuide(code) : null });
  } catch (err) {
    logger.error("[web/seu/demo] GET /demo/guide error", err as Error);
    return res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/demo/guide/start/:code", async (req: Request, res: Response) => {
  try {
    const guide = await getGuide(String(req.params.code));
    if (!guide) return res.status(404).json({ error: `No scenario "${String(req.params.code)}".` });
    req.session.demoGuide = guide.code;
    return res.json({ guide });
  } catch (err) {
    logger.error("[web/seu/demo] POST /demo/guide/start error", err as Error);
    return res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/demo/guide/step", async (req: Request, res: Response) => {
  try {
    const code = req.session.demoGuide;
    if (!code) return res.status(400).json({ error: "No scenario is being followed." });
    const result = await advanceScenario(code);
    return res.status(result.ok ? 200 : 422).json({ ok: result.ok, message: result.message, guide: await getGuide(code) });
  } catch (err) {
    logger.error("[web/seu/demo] POST /demo/guide/step error", err as Error);
    return res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/demo/guide/close", async (req: Request, res: Response) => {
  try {
    delete req.session.demoGuide;
    return res.json({ guide: null });
  } catch (err) {
    logger.error("[web/seu/demo] POST /demo/guide/close error", err as Error);
    return res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/demo/root/steps/:code/enabled", async (req: Request, res: Response) => {
  try {
    await setStepEnabled(String(req.params.code), req.body?.enabled === "true");
    return redirects.seu.demo.success(req, res, `Step "${String(req.params.code)}" ${req.body?.enabled === "true" ? "enabled" : "disabled"}.`, backFor(req));
  } catch (err) {
    logger.error("[web/seu/demo] POST /demo/root/steps/:code/enabled error", err as Error);
    return redirects.seu.demo.error(req, res, (err as Error).message, backFor(req));
  }
});

// Root edits the demo catalogue. Each route runs one core function and returns to the tab it came from.
function rootEdit(run: (req: Request) => Promise<string>, label: string) {
  return async (req: Request, res: Response) => {
    const backTo = backFor(req);
    try {
      return redirects.seu.demo.success(req, res, await run(req), backTo);
    } catch (err) {
      logger.error(`[web/seu/demo] POST ${label} error`, err as Error);
      return redirects.seu.demo.error(req, res, (err as Error).message, backTo);
    }
  };
}

router.post("/demo/root/areas/:area", rootEdit((req) => saveAreaContent({ ...req.body, category: String(req.params.area) }), "/demo/root/areas/:area"));
router.post("/demo/root/scenarios", rootEdit(async (req) => createScenario(req.body ?? {}, await resolveActorAndBadge(req)), "/demo/root/scenarios"));
router.post("/demo/root/scenarios/:code", rootEdit((req) => updateScenario(String(req.params.code), req.body ?? {}), "/demo/root/scenarios/:code"));
router.post("/demo/root/scenarios/:code/enabled", rootEdit((req) => setScenarioEnabled(String(req.params.code), req.body?.enabled === "true"), "/demo/root/scenarios/:code/enabled"));
router.post("/demo/root/steps", rootEdit(async (req) => createStep(req.body ?? {}, await resolveActorAndBadge(req)), "/demo/root/steps"));
router.post("/demo/root/steps/:code", rootEdit((req) => updateStep(String(req.params.code), req.body ?? {}), "/demo/root/steps/:code"));

export { router };
