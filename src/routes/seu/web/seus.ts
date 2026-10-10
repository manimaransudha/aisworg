import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash, flashError, flashSuccess } from "../../../utils/flash.js";
import { logger } from "../../../utils/logger.js";
import { listSeusPaginated, getSeuDetailView, getSeuEbmView } from "../core/seus.js";
import { parseListParams } from "../../../utils/listQuery.js";
import { getObjectiveDetail, listCommissionableObjectives } from "../core/objectives.js";
import { resolveHeldBadges, resolveAuthorBadge } from "../../../domain/identity/heldBadges.js";
import { lookupRouteAuthority } from "../../../domain/identity/routeAuthorityCache.js";
import { fulfilCapabilityWithParticipants, releaseParticipants } from "../core/capabilities.js";
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
      userId: req.session?.user?.id ?? null,
      isAdmin: platformBadges.includes("root") || platformBadges.includes("tenant_admin") || platformBadges.includes("tenant_manage"),
    });
    const held = await resolveHeldBadges(req);
    const hasSeuBadge = (verb: string | null): boolean => held.isRoot || (!!verb && held.badgeTypes.has(`seu_${verb}`));
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
        return flashError(req, res, "/aisworg/seu/objectives", "Objective not found.");
      }
      req.vm.req.title = "Commission SEU from Objective";
      req.vm.req.fromObjective = fromObjective;
      req.vm.opt.flash = getFlash(req);
      return renderView(req, res, "seu/seus/new", req.vm);
    }

    const held = await resolveHeldBadges(req);
    const tenantId = held.isRoot ? undefined : req.session?.user?.tenant_id ?? null;
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
      return flashError(req, res, "/aisworg/seu/seus", "SEU not found.");
    }
    req.vm.req.title = `SEU ${detail.seu.id.slice(0, 8)}`;
    req.vm.req.detail = detail;
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
      return flashError(req, res, "/aisworg/seu/seus", "SEU not found.");
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
  const backTo = `/aisworg/seu/seus/${seuId}?tab=capabilities`;
  const raw = req.body?.participantMasterIds;
  const participantMasterIds: string[] = (Array.isArray(raw) ? raw : raw ? [raw] : []).map(String);

  if (participantMasterIds.length === 0) {
    return flashError(req, res, backTo, "At least one Participant is required.");
  }

  const actorId = req.session?.user?.id != null ? String(req.session.user.id) : null;
  if (!actorId) return flashError(req, res, backTo, "No acting user to record as this Capability Fulfilment's author — log in first.");
  const authRow = lookupRouteAuthority(req.method, req.baseUrl + req.path);
  const held = await resolveHeldBadges(req);
  const authorBadge = resolveAuthorBadge(authRow, held);
  if (!authorBadge) return flashError(req, res, backTo, "No held badge authorises this action — cannot record an author badge.");

  try {
    const results = await fulfilCapabilityWithParticipants({
      seuId,
      capabilityId: String(req.params.capabilityId),
      participantMasterIds,
      actorId,
      authorBadge,
    });
    const names = results.map((r) => r.participant.display_name).join(", ");
    return flashSuccess(req, res, backTo, `Capability "${results[0].capabilityCode}" fulfilled by ${names}.`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/capabilities/:capabilityId/fulfil error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

router.post("/seus/:id/capabilities/:capabilityId/participant/:participantId/replace", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const backTo = `/aisworg/seu/seus/${seuId}?tab=capabilities`;
  const { participantType, displayName } = req.body ?? {};

  if (!participantType || typeof displayName !== "string" || !displayName.trim()) {
    return flashError(req, res, backTo, "Replacement Participant type and display name are required.");
  }

  const authRow = lookupRouteAuthority(req.method, req.baseUrl + req.path);
  const held = await resolveHeldBadges(req);
  const authorBadge = resolveAuthorBadge(authRow, held);
  if (!authorBadge) return flashError(req, res, backTo, "No held badge authorises this action — cannot record an author badge.");

  try {
    const result = await replaceParticipant({
      oldParticipantId: String(req.params.participantId),
      newParticipantType: participantType as ParticipantType,
      newDisplayName: displayName,
      actorRole: req.session?.user?.role ?? "general",
      actorId: req.session?.user?.id != null ? String(req.session.user.id) : undefined,
      authorBadge,
    });
    if (!result.ok) {
      return flashError(req, res, backTo, `Replacement blocked: ${result.detail}`);
    }
    return flashSuccess(req, res, backTo, `Participant replaced: "${displayName}" now fulfils this Capability.`);
  } catch (err) {
    logger.error("[web/seu/seus] POST .../participant/:participantId/replace error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

router.post("/seus/:id/capabilities/:capabilityId/release", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const backTo = `/aisworg/seu/seus/${seuId}?tab=capabilities`;
  const raw = req.body?.participantIds;
  const participantIds: string[] = (Array.isArray(raw) ? raw : raw ? [raw] : []).map(String);

  if (participantIds.length === 0) {
    return flashError(req, res, backTo, "At least one Participant is required.");
  }

  try {
    const released = await releaseParticipants({
      seuId,
      capabilityId: String(req.params.capabilityId),
      participantIds,
      actorRole: req.session?.user?.role ?? "general",
      actorId: req.session?.user?.id != null ? String(req.session.user.id) : undefined,
    });
    const names = released.map((p) => p.display_name).join(", ");
    return flashSuccess(req, res, backTo, `Released: ${names}. Capability is Unfulfilled again — pick a replacement below.`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/capabilities/:capabilityId/release error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

router.post("/seus/:id/deliverables/:deliverableId/transition", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const backTo = `/aisworg/seu/seus/${seuId}`;
  const { targetState } = req.body ?? {};

  if (typeof targetState !== "string" || !targetState.trim()) {
    return flashError(req, res, backTo, "Target state is required.");
  }

  try {
    const result = await transitionDeliverable({
      deliverableId: String(req.params.deliverableId),
      targetState,
      actorRole: req.session?.user?.role ?? "general",
      actorId: req.session?.user?.id != null ? String(req.session.user.id) : undefined,
      requestedBy: req.session?.user?.id != null ? String(req.session.user.id) : null,
    });
    if (!result.ok) {
      const reason = result.reason === "dependency_not_satisfied" ? "one or more dependencies aren't Satisfied yet" : "detail" in result ? result.detail : result.reason;
      return flashError(req, res, backTo, `Transition blocked: ${reason}`);
    }
    return flashSuccess(req, res, backTo, `Deliverable "${result.fromState}" → "${result.toState}" requested. It stays in "${result.fromState}" until dispatched and a result is reported.`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/deliverables/:deliverableId/transition error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

router.post("/seus/:id/ebm/transition", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const backTo = `/aisworg/seu/seus/${seuId}`;
  const { targetState } = req.body ?? {};

  if (typeof targetState !== "string" || !targetState.trim()) {
    return flashError(req, res, backTo, "Target state is required.");
  }

  try {
    const { data: seu } = await seusDB.findById(seuId);
    if (!seu || !seu.active_ebm_id) {
      return flashError(req, res, backTo, "This SEU has no Engineering Behavior Model to transition yet.");
    }
    if (req.session?.user?.id == null) return flashError(req, res, backTo, "Authentication required.");
    const result = await transitionEbm({
      ebmId: seu.active_ebm_id,
      targetState,
      actorRole: req.session?.user?.role ?? "general",
      actorId: String(req.session.user.id),
    });
    if (!result.ok) {
      const reason = result.reason === "not_found" ? "EBM not found" : result.detail;
      return flashError(req, res, backTo, `EBM transition blocked: ${reason}`);
    }
    const message =
      result.appliedTransition.toState === "Active"
        ? `Engineering Behavior Model activated — commissioning is proceeding in the background. Refresh this page shortly to see the SEU's lifecycle state.`
        : `Engineering Behavior Model moved from "${result.appliedTransition.fromState}" to "${result.appliedTransition.toState}".`;
    return flashSuccess(req, res, backTo, message);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/ebm/transition error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

router.post("/seus/:id/obligations/:obligationId/transition", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const backTo = `/aisworg/seu/seus/${seuId}`;
  const { targetState } = req.body ?? {};

  if (typeof targetState !== "string" || !targetState.trim()) {
    return flashError(req, res, backTo, "Target state is required.");
  }

  try {
    if (req.session?.user?.id == null) return flashError(req, res, backTo, "Authentication required.");
    const result = await transitionObligation({
      obligationId: String(req.params.obligationId),
      targetState,
      actorRole: req.session?.user?.role ?? "general",
      actorId: String(req.session.user.id),
    });
    if (!result.ok) {
      const reason = "detail" in result ? result.detail : result.reason;
      return flashError(req, res, backTo, `Obligation transition blocked: ${reason}`);
    }
    return flashSuccess(req, res, backTo, `Obligation moved from "${result.appliedTransition.fromState}" to "${result.appliedTransition.toState}".`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/obligations/:obligationId/transition error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

router.post("/seus/:id/obligations/:obligationId/revise", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const backTo = `/aisworg/seu/seus/${seuId}`;
  const { title, description, category, severity, priority, completionCriteria, assignedEntityType, assignedEntityId } = req.body ?? {};

  try {
    if (req.session?.user?.id == null) return flashError(req, res, backTo, "Authentication required.");
    await reviseObligation({
      obligationId: String(req.params.obligationId),
      actorId: String(req.session.user.id),
      title: typeof title === "string" ? title : undefined,
      description: typeof description === "string" ? description : undefined,
      category: typeof category === "string" ? category : undefined,
      severity: typeof severity === "string" ? severity : undefined,
      priority: typeof priority === "string" ? priority : undefined,
      completionCriteria: typeof completionCriteria === "string" ? completionCriteria : undefined,
      assignedEntityType: typeof assignedEntityType === "string" ? assignedEntityType : undefined,
      assignedEntityId: typeof assignedEntityId === "string" ? assignedEntityId : undefined,
    });
    return flashSuccess(req, res, backTo, "Obligation saved.");
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/obligations/:obligationId/revise error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

router.post("/seus/:id/attention-items", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const backTo = `/aisworg/seu/seus/${seuId}`;
  const { deliverableId, category, title, priority } = req.body ?? {};

  if (typeof category !== "string" || !category.trim() || typeof title !== "string" || !title.trim()) {
    return flashError(req, res, backTo, "Category and title are required.");
  }

  const actorId = req.session?.user?.id != null ? String(req.session.user.id) : null;
  if (!actorId) return flashError(req, res, backTo, "No acting user to record as this Attention Item's author — log in first.");
  const authRow = lookupRouteAuthority(req.method, req.baseUrl + req.path);
  const held = await resolveHeldBadges(req);
  const authorBadge = resolveAuthorBadge(authRow, held);
  if (!authorBadge) return flashError(req, res, backTo, "No held badge authorises this action — cannot record an author badge.");

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
    return flashSuccess(req, res, backTo, `Attention Item "${attentionItem.title}" created (${attentionItem.category}, ${attentionItem.priority}).`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/attention-items error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

router.post("/seus/:id/attention-items/:attentionItemId/transition", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const backTo = `/aisworg/seu/seus/${seuId}`;
  const { targetState } = req.body ?? {};

  if (typeof targetState !== "string" || !targetState.trim()) {
    return flashError(req, res, backTo, "Target state is required.");
  }

  try {
    if (req.session?.user?.id == null) return flashError(req, res, backTo, "Authentication required.");
    const result = await transitionAttentionItem({
      attentionItemId: String(req.params.attentionItemId),
      targetState,
      actorRole: req.session?.user?.role ?? "general",
      actorId: String(req.session.user.id),
    });
    if (!result.ok) {
      const reason = "detail" in result ? result.detail : result.reason;
      return flashError(req, res, backTo, `Attention Item transition blocked: ${reason}`);
    }
    return flashSuccess(req, res, backTo, `Attention Item moved from "${result.appliedTransition.fromState}" to "${result.appliedTransition.toState}".`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/attention-items/:attentionItemId/transition error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

router.post("/seus/:id/evidence", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const backTo = `/aisworg/seu/seus/${seuId}`;
  const { deliverableId, category, title, description, source, predecessorEvidenceId } = req.body ?? {};

  if (typeof deliverableId !== "string" || !deliverableId.trim() || typeof category !== "string" || !category.trim() || typeof title !== "string" || !title.trim()) {
    return flashError(req, res, backTo, "Deliverable, category and title are required.");
  }

  const actorId = req.session?.user?.id != null ? String(req.session.user.id) : null;
  if (!actorId) return flashError(req, res, backTo, "No acting user to record as this Evidence's author — log in first.");
  const authRow = lookupRouteAuthority(req.method, req.baseUrl + req.path);
  const held = await resolveHeldBadges(req);
  const authorBadge = resolveAuthorBadge(authRow, held);
  if (!authorBadge) return flashError(req, res, backTo, "No held badge authorises this action — cannot record an author badge.");

  try {
    const evidence = await createEvidence({
      seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverableId, category, title, description, source,
      supersedesEvidenceId: predecessorEvidenceId || null, actorId, authorBadge,
    });
    return flashSuccess(req, res, backTo, `Evidence "${evidence.title}" collected (${evidence.category}).`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/evidence error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

router.post("/seus/:id/evidence/:evidenceId/validate", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const backTo = `/aisworg/seu/seus/${seuId}`;
  const { dimension, status, notes } = req.body ?? {};

  if (typeof dimension !== "string" || !dimension.trim() || typeof status !== "string" || !status.trim()) {
    return flashError(req, res, backTo, "Dimension and status are required.");
  }

  try {
    const result = await recordValidationAssessment({ evidenceId: String(req.params.evidenceId), dimension, status, notes: notes || null });
    if (!result.ok) return flashError(req, res, backTo, "Evidence not found.");
    return flashSuccess(req, res, backTo, `Recorded "${dimension}" assessment (${status}) — confidence now ${result.evidence.confidence_level ?? "unassessed"}.`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/evidence/:evidenceId/validate error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

router.post("/seus/:id/evidence/:evidenceId/transition", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const backTo = `/aisworg/seu/seus/${seuId}`;
  const { targetState } = req.body ?? {};

  if (typeof targetState !== "string" || !targetState.trim()) {
    return flashError(req, res, backTo, "Target state is required.");
  }

  try {
    const result = await transitionEvidence({
      evidenceId: String(req.params.evidenceId),
      targetState,
      actorRole: req.session?.user?.role ?? "general",
      actorId: req.session?.user?.id != null ? String(req.session.user.id) : undefined,
    });
    if (!result.ok) {
      const reason = "detail" in result ? result.detail : result.reason;
      return flashError(req, res, backTo, `Evidence transition blocked: ${reason}`);
    }
    return flashSuccess(req, res, backTo, `Evidence moved from "${result.appliedTransition.fromState}" to "${result.appliedTransition.toState}".`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/evidence/:evidenceId/transition error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

router.post("/seus/:id/evidence/:evidenceId/link", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const backTo = `/aisworg/seu/seus/${seuId}`;
  const { deliverableId } = req.body ?? {};

  if (typeof deliverableId !== "string" || !deliverableId.trim()) {
    return flashError(req, res, backTo, "Deliverable is required.");
  }

  const actorId = req.session?.user?.id != null ? String(req.session.user.id) : null;
  if (!actorId) return flashError(req, res, backTo, "No acting user to record as this link's author — log in first.");
  const authRow = lookupRouteAuthority(req.method, req.baseUrl + req.path);
  const held = await resolveHeldBadges(req);
  const authorBadge = resolveAuthorBadge(authRow, held);
  if (!authorBadge) return flashError(req, res, backTo, "No held badge authorises this action — cannot record an author badge.");

  try {
    const result = await linkEvidenceToObject(String(req.params.evidenceId), "Deliverable", deliverableId, actorId, authorBadge);
    if (!result.ok) {
      if (result.reason === "not_found") return flashError(req, res, backTo, "Evidence not found.");
      return flashError(req, res, backTo, `Could not link Evidence: ${result.detail}`);
    }
    return flashSuccess(req, res, backTo, "Evidence linked.");
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/evidence/:evidenceId/link error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

router.post("/seus/:id/knowledge", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const backTo = `/aisworg/seu/seus/${seuId}`;
  const { deliverableId, evidenceId, category, title, description, acquisitionScope } = req.body ?? {};

  if (typeof deliverableId !== "string" || !deliverableId.trim() || typeof category !== "string" || !category.trim() || typeof title !== "string" || !title.trim()) {
    return flashError(req, res, backTo, "Deliverable, category and title are required.");
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
      userId: req.session?.user?.id != null ? String(req.session.user.id) : undefined,
    });
    return flashSuccess(req, res, backTo, `Knowledge Item "${knowledgeItem.title}" observed (${knowledgeItem.category}, ${knowledgeItem.acquisition_scope} scope).`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/knowledge error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

router.post("/seus/:id/knowledge/:knowledgeItemId/transition", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const backTo = `/aisworg/seu/seus/${seuId}`;
  const { targetState } = req.body ?? {};

  if (typeof targetState !== "string" || !targetState.trim()) {
    return flashError(req, res, backTo, "Target state is required.");
  }

  try {
    const result = await transitionKnowledgeItem({
      knowledgeItemId: String(req.params.knowledgeItemId),
      targetState,
      actorRole: req.session?.user?.role ?? "general",
      actorId: req.session?.user?.id != null ? String(req.session.user.id) : undefined,
      userId: req.session?.user?.id != null ? String(req.session.user.id) : undefined,
    });
    if (!result.ok) {
      const reason = "detail" in result ? result.detail : result.reason;
      return flashError(req, res, backTo, `Knowledge Item transition blocked: ${reason}`);
    }
    return flashSuccess(req, res, backTo, `Knowledge Item moved from "${result.appliedTransition.fromState}" to "${result.appliedTransition.toState}".`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/knowledge/:knowledgeItemId/transition error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

router.post("/seus/:id/knowledge/:knowledgeItemId/promote-scope", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const backTo = `/aisworg/seu/seus/${seuId}`;
  const { targetScope } = req.body ?? {};

  if (typeof targetScope !== "string" || !targetScope.trim()) {
    return flashError(req, res, backTo, "Target scope is required.");
  }

  try {
    const result = await promoteKnowledgeItemScope({
      knowledgeItemId: String(req.params.knowledgeItemId),
      targetScope: targetScope as AcquisitionScope,
      actorRole: req.session?.user?.role ?? "general",
      actorId: req.session?.user?.id != null ? String(req.session.user.id) : undefined,
      userId: req.session?.user?.id != null ? String(req.session.user.id) : undefined,
    });
    if (!result.ok) {
      const reason = "detail" in result ? result.detail : result.reason;
      return flashError(req, res, backTo, `Acquisition Scope promotion blocked: ${reason}`);
    }
    return flashSuccess(
      req,
      res,
      backTo,
      `Knowledge Item promoted from "${result.appliedTransition.fromState}" to "${result.appliedTransition.toState}" scope. Organisational Learning Obligation raised: "${result.obligation.title}".`
    );
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/knowledge/:knowledgeItemId/promote-scope error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

router.post("/seus/:id/decisions", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const backTo = `/aisworg/seu/seus/${seuId}`;
  const { deliverableId, knowledgeId, evidenceId, category, title, engineeringQuestion, alternativeStatement, alternativeRationale } = req.body ?? {};

  if (typeof deliverableId !== "string" || !deliverableId.trim() || typeof category !== "string" || !category.trim() || typeof title !== "string" || !title.trim()) {
    return flashError(req, res, backTo, "Deliverable, category and title are required.");
  }

  try {
    const decision = await createDecision({
      seuId,
      userId: req.session?.user?.id,
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
    return flashSuccess(req, res, backTo, `Decision "${decision.title}" identified (${decision.category}).`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/decisions error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

router.post("/seus/:id/decisions/:decisionId/transition", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const backTo = `/aisworg/seu/seus/${seuId}`;
  const { targetState } = req.body ?? {};

  if (typeof targetState !== "string" || !targetState.trim()) {
    return flashError(req, res, backTo, "Target state is required.");
  }

  try {
    const result = await transitionDecision({
      decisionId: String(req.params.decisionId),
      targetState,
      actorRole: req.session?.user?.role ?? "general",
      actorId: req.session?.user?.id != null ? String(req.session.user.id) : undefined,
    });
    if (!result.ok) {
      const reason = "detail" in result ? result.detail : result.reason;
      return flashError(req, res, backTo, `Decision transition blocked: ${reason}`);
    }
    return flashSuccess(req, res, backTo, `Decision moved from "${result.appliedTransition.fromState}" to "${result.appliedTransition.toState}".`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/decisions/:decisionId/transition error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

router.post("/seus/:id/external-interactions", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const backTo = `/aisworg/seu/seus/${seuId}`;
  const { deliverableId, interactionType, direction, targetSystem, purpose } = req.body ?? {};

  if (typeof interactionType !== "string" || !interactionType.trim() || typeof direction !== "string" || !direction.trim() || typeof targetSystem !== "string" || !targetSystem.trim()) {
    return flashError(req, res, backTo, "Interaction type, direction and target system are required.");
  }

  const actorId = req.session?.user?.id != null ? String(req.session.user.id) : null;
  if (!actorId) return flashError(req, res, backTo, "No acting user to record as this External Interaction's author — log in first.");
  const authRow = lookupRouteAuthority(req.method, req.baseUrl + req.path);
  const held = await resolveHeldBadges(req);
  const authorBadge = resolveAuthorBadge(authRow, held);
  if (!authorBadge) return flashError(req, res, backTo, "No held badge authorises this action — cannot record an author badge.");

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
    return flashSuccess(req, res, backTo, `External Interaction with "${interaction.target_system}" recorded (${interaction.interaction_type}, ${interaction.direction}).`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/external-interactions error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

router.post("/seus/:id/external-interactions/:interactionId/transition", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const backTo = `/aisworg/seu/seus/${seuId}`;
  const { targetState } = req.body ?? {};

  if (typeof targetState !== "string" || !targetState.trim()) {
    return flashError(req, res, backTo, "Target state is required.");
  }

  try {
    const result = await transitionExternalInteraction({
      interactionId: String(req.params.interactionId),
      targetState,
      actorRole: req.session?.user?.role ?? "general",
      actorId: req.session?.user?.id != null ? String(req.session.user.id) : undefined,
    });
    if (!result.ok) {
      const reason = "detail" in result ? result.detail : result.reason;
      return flashError(req, res, backTo, `External Interaction transition blocked: ${reason}`);
    }
    return flashSuccess(req, res, backTo, `External Interaction moved from "${result.appliedTransition.fromState}" to "${result.appliedTransition.toState}".`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/external-interactions/:interactionId/transition error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

export { router };
