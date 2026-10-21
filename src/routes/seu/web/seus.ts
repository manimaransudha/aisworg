import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { resolveHeldRoles } from "../../../domain/identity/heldRoles.js";
import { getFlash } from "../../../utils/flash.js";
import { redirects } from "../../../middleware/redirects.js";
import { logger } from "../../../utils/logger.js";
import { listSeusPaginated, getSeuDetailView, getSeuEbmView } from "../core/seus.js";
import { parseListParams } from "../../../utils/listQuery.js";
import { getObjectiveDetail, listCommissionableObjectives } from "../core/objectives.js";
import { resolveHeldBadges, requireActorId, resolveActorAndBadge, resolveAuthorBadgeForRequest } from "../../../domain/identity/heldBadges.js";
import { requestCapabilityFulfilment, releaseParticipants } from "../core/capabilities.js";
import { replaceParticipant } from "../core/participants.js";
import { transitionDeliverable } from "../core/deliverables.js";
import { transitionEbm } from "../core/commissioning.js";
import { seusDB } from "../../../dblayer/seusDB.js";
import { transitionObligation, reviseObligation } from "../core/obligations.js";
import { createAttentionItem, transitionAttentionItem } from "../core/attentionItems.js";
import { createEvidence, transitionEvidence, linkEvidenceToObject, recordValidationAssessment } from "../core/evidence.js";
import { createKnowledgeItem, promoteKnowledgeItemScope, transitionKnowledgeItem } from "../core/knowledge.js";
import { createDecision, transitionDecision } from "../core/decisions.js";
import { createExternalInteraction, transitionExternalInteraction } from "../core/externalInteractions.js";
import type { AcquisitionScope, InteractionDirection, ParticipantType } from "../../../dblayer/seuTypes.js";

router.get("/seus", attachVM("seu/seus/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.vm.req.title = "SEUs";
    const platformBadges: string[] = req.session?.user?.platformBadges ?? [];
    const params = parseListParams(req.query, { sortable: ["objective", "state", "created"], defaultSort: "created", defaultDir: "desc" });
    const list = await listSeusPaginated(params, {
      userId: requireActorId(req),
      isAdmin: platformBadges.includes("root") || platformBadges.includes("tenant_admin") || platformBadges.includes("tenant_manage"),
    });
    const held = await resolveHeldBadges(req);
    const hasSeuBadge = (verb: string | null): boolean => held.hasVerb("SEU", verb);
    for (const item of list.items) {
      item.possibleNextStates = item.possibleNextStates.filter((s) => hasSeuBadge(item.possibleTransitionVerbs[s]));
    }
    req.vm.req.list = list;
    req.vm.opt.listBasePath = "/aisworg/seu/seus";
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/seus/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/seus] GET /seus error", err as Error);
    next(err);
  }
});

router.get("/seus/new", attachVM("seu/seus/new"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const objectiveId = typeof req.query.objectiveId === "string" && req.query.objectiveId.trim() ? req.query.objectiveId.trim() : null;
    if (objectiveId) {
      const fromObjective = await getObjectiveDetail(objectiveId);
      if (!fromObjective) {
        return redirects.seu.seusNew.error(req, res, "Objective not found.");
      }
      req.vm.req.title = "Commission SEU from Objective";
      req.vm.req.fromObjective = fromObjective;
      req.vm.opt.flash = getFlash(req);
      return renderView(req, res, "seu/seus/new", req.vm);
    }

    const isRoot = (req.session?.user?.platformBadges ?? []).includes("root");
    const tenantId = isRoot ? undefined : req.session?.user?.tenant_id ?? null;
    req.vm.req.title = "Commission a new SEU";
    req.vm.req.commissionableObjectives = await listCommissionableObjectives(tenantId);
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/seus/new", req.vm);
  } catch (err) {
    logger.error("[web/seu/seus] GET /seus/new error", err as Error);
    next(err);
  }
});

router.get("/seus/:id", attachVM("seu/seus/detail"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const detail = await getSeuDetailView(String(req.params.id));
    if (!detail) {
      return redirects.seu.seus.error(req, res, "SEU not found.");
    }
    req.vm.req.title = `SEU ${detail.seu.id.slice(0, 8)}`;
    req.vm.req.detail = detail;
    const sessionUser = req.session.user;
    if (!sessionUser) throw new Error("[web/seu/seus] GET /seus/:id reached without a session user");
    req.vm.req.isSuperuser = (await resolveHeldRoles(sessionUser.id)).isSuperuser;
    req.vm.req.activeTab = typeof req.query.tab === "string" ? req.query.tab : undefined;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/seus/detail", req.vm);
  } catch (err) {
    logger.error("[web/seu/seus] GET /seus/:id error", err as Error);
    next(err);
  }
});

router.get("/seus/:id/ebm", attachVM("seu/seus/ebm"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ebmView = await getSeuEbmView(String(req.params.id));
    if (!ebmView) {
      return redirects.seu.seusEbm.error(req, res, "SEU not found.");
    }
    req.vm.req.title = `EBM — SEU ${ebmView.seuId.slice(0, 8)}`;
    req.vm.req.ebmView = ebmView;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/seus/ebm", req.vm);
  } catch (err) {
    logger.error("[web/seu/seus] GET /seus/:id/ebm error", err as Error);
    next(err);
  }
});

router.post("/seus/:id/capabilities/:capabilityId/fulfil", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const raw = req.body?.participantMasterIds;
  const participantMasterIds: string[] = (Array.isArray(raw) ? raw : raw ? [raw] : []).map(String);

  const { actorId, authorBadge } = await resolveActorAndBadge(req);

  try {
    await requestCapabilityFulfilment({
      seuId,
      capabilityId: String(req.params.capabilityId),
      participantMasterIds,
      actorId,
      authorBadge,
    });
    return redirects.seu.seusCapabilities.success(req, res, "Capability requested.");
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/capabilities/:capabilityId/fulfil error", err as Error);
    return redirects.seu.seusCapabilities.error(req, res, (err as Error).message);
  }
});

router.post("/seus/:id/capabilities/:capabilityId/participant/:participantId/replace", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const { participantType, displayName } = req.body ?? {};

  if (!participantType || typeof displayName !== "string" || !displayName.trim()) {
    return redirects.seu.seusCapabilities.error(req, res, "Replacement Participant type and display name are required.");
  }

  const authorBadge = await resolveAuthorBadgeForRequest(req);

  try {
    const result = await replaceParticipant({
      oldParticipantId: String(req.params.participantId),
      newParticipantType: participantType as ParticipantType,
      newDisplayName: displayName,
      actorId: requireActorId(req),
      authorBadge,
    });
    if (!result.ok) {
      return redirects.seu.seusCapabilities.error(req, res, `Replacement blocked: ${result.detail}`);
    }
    return redirects.seu.seusCapabilities.success(req, res, `Participant replaced: "${displayName}" now fulfils this Capability.`);
  } catch (err) {
    logger.error("[web/seu/seus] POST .../participant/:participantId/replace error", err as Error);
    return redirects.seu.seusCapabilities.error(req, res, (err as Error).message);
  }
});

router.post("/seus/:id/capabilities/:capabilityId/release", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const raw = req.body?.participantIds;
  const participantIds: string[] = (Array.isArray(raw) ? raw : raw ? [raw] : []).map(String);

  if (participantIds.length === 0) {
    return redirects.seu.seusCapabilities.error(req, res, "At least one Participant is required.");
  }

  try {
    const released = await releaseParticipants({
      seuId,
      capabilityId: String(req.params.capabilityId),
      participantIds,
      actorId: requireActorId(req),
    });
    const names = released.map((p) => p.display_name).join(", ");
    return redirects.seu.seusCapabilities.success(req, res, `Released: ${names}. Capability is Unfulfilled again — pick a replacement below.`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/capabilities/:capabilityId/release error", err as Error);
    return redirects.seu.seusCapabilities.error(req, res, (err as Error).message);
  }
});

router.post("/seus/:id/deliverables/:deliverableId/transition", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const { targetState } = req.body ?? {};

  if (typeof targetState !== "string" || !targetState.trim()) {
    return redirects.seu.seusDeliverablesTransition.error(req, res, "Target state is required.");
  }

  try {
    const result = await transitionDeliverable({
      deliverableId: String(req.params.deliverableId),
      targetState,
      actorId: requireActorId(req),
      requestedBy: requireActorId(req),
    });
    if (!result.ok) {
      const reason = result.reason === "dependency_not_satisfied" ? "one or more dependencies aren't Satisfied yet" : "detail" in result ? result.detail : result.reason;
      return redirects.seu.seusDeliverablesTransition.error(req, res, `Transition blocked: ${reason}`);
    }
    return redirects.seu.seusDeliverablesTransition.success(req, res, `Deliverable "${result.fromState}" → "${result.toState}" completed by the Execution Engine.`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/deliverables/:deliverableId/transition error", err as Error);
    return redirects.seu.seusDeliverablesTransition.error(req, res, (err as Error).message);
  }
});

router.post("/seus/:id/ebm/transition", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const { targetState } = req.body ?? {};

  if (typeof targetState !== "string" || !targetState.trim()) {
    return redirects.seu.seusEbmTransition.error(req, res, "Target state is required.");
  }

  try {
    const { data: seu } = await seusDB.findById(seuId);
    if (!seu || !seu.active_ebm_id) {
      return redirects.seu.seusEbmTransition.error(req, res, "This SEU has no Engineering Behavior Model to transition yet.");
    }
    const result = await transitionEbm({
      ebmId: seu.active_ebm_id,
      targetState,
      actorId: requireActorId(req),
    });
    if (!result.ok) {
      const reason = result.reason === "not_found" ? "EBM not found" : result.detail;
      return redirects.seu.seusEbmTransition.error(req, res, `EBM transition blocked: ${reason}`);
    }
    const message =
      result.appliedTransition.toState === "Active"
        ? `Engineering Behavior Model activated — commissioning is proceeding in the background. Refresh this page shortly to see the SEU's lifecycle state.`
        : `Engineering Behavior Model moved from "${result.appliedTransition.fromState}" to "${result.appliedTransition.toState}".`;
    return redirects.seu.seusEbmTransition.success(req, res, message);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/ebm/transition error", err as Error);
    return redirects.seu.seusEbmTransition.error(req, res, (err as Error).message);
  }
});

router.post("/seus/:id/obligations/:obligationId/transition", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const { targetState } = req.body ?? {};

  if (typeof targetState !== "string" || !targetState.trim()) {
    return redirects.seu.seusObligationsTransition.error(req, res, "Target state is required.");
  }

  try {
    const result = await transitionObligation({
      obligationId: String(req.params.obligationId),
      targetState,
      actorId: requireActorId(req),
    });
    if (!result.ok) {
      const reason = "detail" in result ? result.detail : result.reason;
      return redirects.seu.seusObligationsTransition.error(req, res, `Obligation transition blocked: ${reason}`);
    }
    return redirects.seu.seusObligationsTransition.success(req, res, `Obligation moved from "${result.appliedTransition.fromState}" to "${result.appliedTransition.toState}".`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/obligations/:obligationId/transition error", err as Error);
    return redirects.seu.seusObligationsTransition.error(req, res, (err as Error).message);
  }
});

router.post("/seus/:id/obligations/:obligationId/revise", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const { title, description, category, severity, priority, completionCriteria, assignedEntityType, assignedEntityId } = req.body ?? {};

  try {
    await reviseObligation({
      obligationId: String(req.params.obligationId),
      actorId: requireActorId(req),
      title: typeof title === "string" ? title : undefined,
      description: typeof description === "string" ? description : undefined,
      category: typeof category === "string" ? category : undefined,
      severity: typeof severity === "string" ? severity : undefined,
      priority: typeof priority === "string" ? priority : undefined,
      completionCriteria: typeof completionCriteria === "string" ? completionCriteria : undefined,
      assignedEntityType: typeof assignedEntityType === "string" ? assignedEntityType : undefined,
      assignedEntityId: typeof assignedEntityId === "string" ? assignedEntityId : undefined,
    });
    return redirects.seu.seusObligationsRevise.success(req, res, "Obligation saved.");
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/obligations/:obligationId/revise error", err as Error);
    return redirects.seu.seusObligationsRevise.error(req, res, (err as Error).message);
  }
});

router.post("/seus/:id/attention-items", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const { deliverableId, category, title, priority } = req.body ?? {};

  if (typeof category !== "string" || !category.trim() || typeof title !== "string" || !title.trim()) {
    return redirects.seu.seusAttentionItems.error(req, res, "Category and title are required.");
  }

  const { actorId, authorBadge } = await resolveActorAndBadge(req);

  try {
    const attentionItem = await createAttentionItem({
      seuId,
      relatedObjectType: typeof deliverableId === "string" && deliverableId.trim() ? "Deliverable" : null,
      relatedObjectId: typeof deliverableId === "string" && deliverableId.trim() ? deliverableId : null,
      category,
      title,
      priority,
      actorId,
      authorBadge,
    });
    return redirects.seu.seusAttentionItems.success(req, res, `Attention Item "${attentionItem.title}" created (${attentionItem.category}, ${attentionItem.priority}).`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/attention-items error", err as Error);
    return redirects.seu.seusAttentionItems.error(req, res, (err as Error).message);
  }
});

router.post("/seus/:id/attention-items/:attentionItemId/transition", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const { targetState } = req.body ?? {};

  if (typeof targetState !== "string" || !targetState.trim()) {
    return redirects.seu.seusAttentionItemsTransition.error(req, res, "Target state is required.");
  }

  try {
    const result = await transitionAttentionItem({
      attentionItemId: String(req.params.attentionItemId),
      targetState,
      actorId: requireActorId(req),
    });
    if (!result.ok) {
      const reason = "detail" in result ? result.detail : result.reason;
      return redirects.seu.seusAttentionItemsTransition.error(req, res, `Attention Item transition blocked: ${reason}`);
    }
    return redirects.seu.seusAttentionItemsTransition.success(req, res, `Attention Item moved from "${result.appliedTransition.fromState}" to "${result.appliedTransition.toState}".`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/attention-items/:attentionItemId/transition error", err as Error);
    return redirects.seu.seusAttentionItemsTransition.error(req, res, (err as Error).message);
  }
});

router.post("/seus/:id/evidence", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const { deliverableId, category, title, description, source, predecessorEvidenceId } = req.body ?? {};

  if (typeof deliverableId !== "string" || !deliverableId.trim() || typeof category !== "string" || !category.trim() || typeof title !== "string" || !title.trim()) {
    return redirects.seu.seusEvidence.error(req, res, "Deliverable, category and title are required.");
  }

  const { actorId, authorBadge } = await resolveActorAndBadge(req);

  try {
    const evidence = await createEvidence({
      seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverableId, category, title, description, source,
      supersedesEvidenceId: predecessorEvidenceId || null, actorId, authorBadge,
    });
    return redirects.seu.seusEvidence.success(req, res, `Evidence "${evidence.title}" collected (${evidence.category}).`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/evidence error", err as Error);
    return redirects.seu.seusEvidence.error(req, res, (err as Error).message);
  }
});

router.post("/seus/:id/evidence/:evidenceId/validate", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const { dimension, status, notes } = req.body ?? {};

  if (typeof dimension !== "string" || !dimension.trim() || typeof status !== "string" || !status.trim()) {
    return redirects.seu.seusEvidenceValidate.error(req, res, "Dimension and status are required.");
  }

  try {
    const result = await recordValidationAssessment({ evidenceId: String(req.params.evidenceId), dimension, status, notes: notes || null });
    if (!result.ok) return redirects.seu.seusEvidenceValidate.error(req, res, "Evidence not found.");
    return redirects.seu.seusEvidenceValidate.success(req, res, `Recorded "${dimension}" assessment (${status}) — confidence now ${result.evidence.confidence_level ?? "unassessed"}.`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/evidence/:evidenceId/validate error", err as Error);
    return redirects.seu.seusEvidenceValidate.error(req, res, (err as Error).message);
  }
});

router.post("/seus/:id/evidence/:evidenceId/transition", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const { targetState } = req.body ?? {};

  if (typeof targetState !== "string" || !targetState.trim()) {
    return redirects.seu.seusEvidenceTransition.error(req, res, "Target state is required.");
  }

  try {
    const result = await transitionEvidence({
      evidenceId: String(req.params.evidenceId),
      targetState,
      actorId: requireActorId(req),
    });
    if (!result.ok) {
      const reason = "detail" in result ? result.detail : result.reason;
      return redirects.seu.seusEvidenceTransition.error(req, res, `Evidence transition blocked: ${reason}`);
    }
    return redirects.seu.seusEvidenceTransition.success(req, res, `Evidence moved from "${result.appliedTransition.fromState}" to "${result.appliedTransition.toState}".`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/evidence/:evidenceId/transition error", err as Error);
    return redirects.seu.seusEvidenceTransition.error(req, res, (err as Error).message);
  }
});

router.post("/seus/:id/evidence/:evidenceId/link", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const { deliverableId } = req.body ?? {};

  if (typeof deliverableId !== "string" || !deliverableId.trim()) {
    return redirects.seu.seusEvidenceLink.error(req, res, "Deliverable is required.");
  }

  const { actorId, authorBadge } = await resolveActorAndBadge(req);

  try {
    const result = await linkEvidenceToObject(String(req.params.evidenceId), "Deliverable", deliverableId, actorId, authorBadge);
    if (!result.ok) {
      if (result.reason === "not_found") return redirects.seu.seusEvidenceLink.error(req, res, "Evidence not found.");
      return redirects.seu.seusEvidenceLink.error(req, res, `Could not link Evidence: ${result.detail}`);
    }
    return redirects.seu.seusEvidenceLink.success(req, res, "Evidence linked.");
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/evidence/:evidenceId/link error", err as Error);
    return redirects.seu.seusEvidenceLink.error(req, res, (err as Error).message);
  }
});

router.post("/seus/:id/knowledge", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const { deliverableId, evidenceId, category, title, description, acquisitionScope } = req.body ?? {};

  if (typeof deliverableId !== "string" || !deliverableId.trim() || typeof category !== "string" || !category.trim() || typeof title !== "string" || !title.trim()) {
    return redirects.seu.seusKnowledge.error(req, res, "Deliverable, category and title are required.");
  }

  try {
    const knowledgeItem = await createKnowledgeItem({
      seuId,
      deliverableId,
      evidenceReferences: evidenceId ? { supports: [evidenceId] } : undefined,
      category,
      title,
      description,
      acquisitionScope: acquisitionScope as AcquisitionScope | undefined,
      actorId: requireActorId(req),
    });
    return redirects.seu.seusKnowledge.success(req, res, `Knowledge Item "${knowledgeItem.title}" observed (${knowledgeItem.category}, ${knowledgeItem.acquisition_scope} scope).`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/knowledge error", err as Error);
    return redirects.seu.seusKnowledge.error(req, res, (err as Error).message);
  }
});

router.post("/seus/:id/knowledge/:knowledgeItemId/transition", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const { targetState } = req.body ?? {};

  if (typeof targetState !== "string" || !targetState.trim()) {
    return redirects.seu.seusKnowledgeTransition.error(req, res, "Target state is required.");
  }

  try {
    const result = await transitionKnowledgeItem({
      knowledgeItemId: String(req.params.knowledgeItemId),
      targetState,
      actorId: requireActorId(req),
    });
    if (!result.ok) {
      const reason = "detail" in result ? result.detail : result.reason;
      return redirects.seu.seusKnowledgeTransition.error(req, res, `Knowledge Item transition blocked: ${reason}`);
    }
    return redirects.seu.seusKnowledgeTransition.success(req, res, `Knowledge Item moved from "${result.appliedTransition.fromState}" to "${result.appliedTransition.toState}".`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/knowledge/:knowledgeItemId/transition error", err as Error);
    return redirects.seu.seusKnowledgeTransition.error(req, res, (err as Error).message);
  }
});

router.post("/seus/:id/knowledge/:knowledgeItemId/promote-scope", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const { targetScope } = req.body ?? {};

  if (typeof targetScope !== "string" || !targetScope.trim()) {
    return redirects.seu.seusKnowledgePromoteScope.error(req, res, "Target scope is required.");
  }

  try {
    const result = await promoteKnowledgeItemScope({
      knowledgeItemId: String(req.params.knowledgeItemId),
      targetScope: targetScope as AcquisitionScope,
      actorId: requireActorId(req),
    });
    if (!result.ok) {
      const reason = "detail" in result ? result.detail : result.reason;
      return redirects.seu.seusKnowledgePromoteScope.error(req, res, `Acquisition Scope promotion blocked: ${reason}`);
    }
    return redirects.seu.seusKnowledgePromoteScope.success(req, res, `Knowledge Item promoted from "${result.appliedTransition.fromState}" to "${result.appliedTransition.toState}" scope. Organisational Learning Obligation raised: "${result.obligation.title}".`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/knowledge/:knowledgeItemId/promote-scope error", err as Error);
    return redirects.seu.seusKnowledgePromoteScope.error(req, res, (err as Error).message);
  }
});

router.post("/seus/:id/decisions", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const { deliverableId, knowledgeId, evidenceId, category, title, engineeringQuestion, alternativeStatement, alternativeRationale } = req.body ?? {};

  if (typeof deliverableId !== "string" || !deliverableId.trim() || typeof category !== "string" || !category.trim() || typeof title !== "string" || !title.trim()) {
    return redirects.seu.seusDecisions.error(req, res, "Deliverable, category and title are required.");
  }

  try {
    const decision = await createDecision({
      seuId,
      actorId: requireActorId(req),
      relatedObjects: [{ related_object_type: "Deliverable", related_object_ids: [deliverableId] }],
      knowledgeIds: knowledgeId ? [knowledgeId] : [],
      evidenceIds: evidenceId ? [evidenceId] : [],
      category,
      title,
      engineeringQuestion,
      alternatives:
        typeof alternativeStatement === "string" && alternativeStatement.trim()
          ? [{ statement: alternativeStatement, assumptions: [], consequences: [], status: "Candidate", rationale: alternativeRationale || null }]
          : [],
    });
    return redirects.seu.seusDecisions.success(req, res, `Decision "${decision.title}" identified (${decision.category}).`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/decisions error", err as Error);
    return redirects.seu.seusDecisions.error(req, res, (err as Error).message);
  }
});

router.post("/seus/:id/decisions/:decisionId/transition", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const { targetState } = req.body ?? {};

  if (typeof targetState !== "string" || !targetState.trim()) {
    return redirects.seu.seusDecisionsTransition.error(req, res, "Target state is required.");
  }

  try {
    const result = await transitionDecision({
      decisionId: String(req.params.decisionId),
      targetState,
      actorId: requireActorId(req),
    });
    if (!result.ok) {
      const reason = "detail" in result ? result.detail : result.reason;
      return redirects.seu.seusDecisionsTransition.error(req, res, `Decision transition blocked: ${reason}`);
    }
    return redirects.seu.seusDecisionsTransition.success(req, res, `Decision moved from "${result.appliedTransition.fromState}" to "${result.appliedTransition.toState}".`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/decisions/:decisionId/transition error", err as Error);
    return redirects.seu.seusDecisionsTransition.error(req, res, (err as Error).message);
  }
});

router.post("/seus/:id/external-interactions", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const { deliverableId, interactionType, direction, targetSystem, purpose } = req.body ?? {};

  if (typeof interactionType !== "string" || !interactionType.trim() || typeof direction !== "string" || !direction.trim() || typeof targetSystem !== "string" || !targetSystem.trim()) {
    return redirects.seu.seusExternalInteractions.error(req, res, "Interaction type, direction and target system are required.");
  }

  const { actorId, authorBadge } = await resolveActorAndBadge(req);

  try {
    const interaction = await createExternalInteraction({
      seuId,
      deliverableId: deliverableId || null,
      interactionType,
      direction: direction as InteractionDirection,
      targetSystem,
      purpose,
      actorId,
      authorBadge,
    });
    return redirects.seu.seusExternalInteractions.success(req, res, `External Interaction with "${interaction.target_system}" recorded (${interaction.interaction_type}, ${interaction.direction}).`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/external-interactions error", err as Error);
    return redirects.seu.seusExternalInteractions.error(req, res, (err as Error).message);
  }
});

router.post("/seus/:id/external-interactions/:interactionId/transition", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const { targetState } = req.body ?? {};

  if (typeof targetState !== "string" || !targetState.trim()) {
    return redirects.seu.seusExternalInteractionsTransition.error(req, res, "Target state is required.");
  }

  try {
    const result = await transitionExternalInteraction({
      interactionId: String(req.params.interactionId),
      targetState,
      actorId: requireActorId(req),
    });
    if (!result.ok) {
      const reason = "detail" in result ? result.detail : result.reason;
      return redirects.seu.seusExternalInteractionsTransition.error(req, res, `External Interaction transition blocked: ${reason}`);
    }
    return redirects.seu.seusExternalInteractionsTransition.success(req, res, `External Interaction moved from "${result.appliedTransition.fromState}" to "${result.appliedTransition.toState}".`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/external-interactions/:interactionId/transition error", err as Error);
    return redirects.seu.seusExternalInteractionsTransition.error(req, res, (err as Error).message);
  }
});

export { router };
