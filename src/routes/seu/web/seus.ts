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
import { resolveHeldBadges } from "../../../domain/identity/heldBadges.js";
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

/** GET /aisworg/seu/seus — SEU Runtime: every commissioned SEU. */
router.get("/seus", attachVM("seu/seus/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.vm.req.title = "SEUs";
    const platformBadges: string[] = req.session?.user?.platformBadges ?? [];
    const params = parseListParams(req.query, { sortable: ["objective", "state", "created"], defaultSort: "created", defaultDir: "desc" });
    const list = await listSeusPaginated(params, {
      userId: req.session?.user?.id ?? null,
      isAdmin: platformBadges.includes("root") || platformBadges.includes("tenant_admin"),
    });
    // Same badge-filter pass as web/objectives.ts's own hasObjectiveBadge —
    // core already restricted possibleNextStates to real, manual-triggered
    // edges; this narrows it further to the ones THIS viewer actually holds
    // the badge for, so index.ejs never renders a button/link that would
    // just 403 on click.
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

/** GET /aisworg/seu/seus/new — commissioning entry point.
 * Bug fix (owner: "The commission SEU should get onto the SEU screen and the
 * messages has to be on that screen. Not on the objective screen.") — an
 * optional ?objectiveId= switches this into "commission against an existing
 * Objective" mode. Previously this diagnostic lived on the Objective detail
 * page itself, and the Objective tree/list rows posted the commission action
 * directly from the row — both moved here, onto the SEU screen.
 * Redesigned (owner, 2026-09-05: "Objectives only propose capabilities...
 * capability-name -> templates -> profile And allow the user to choose a
 * profile") — the content is getObjectiveDetail's own commissioningOptions,
 * a capability -> Templates -> Profiles tree to browse and pick from, not an
 * auto-derived single match.
 * Redesigned again (owner, 2026-09-06: "the SEU is commissioned against an
 * objective... If the commissioning happens from SEU, then Objective also
 * has to be picked") — the old freeform path (no ?objectiveId=: type a
 * statement + check Capability boxes, auto-creating an Objective inline via
 * commissionFromForm) is retired from this screen entirely. Arriving here
 * with no Objective chosen yet now shows a picker over
 * listCommissionableObjectives — the same real, already-decomposed
 * Objectives the Objectives tree itself offers a "Commission SEU" action
 * on — rather than minting a new one from a bare statement. Choosing one
 * just links to this same route WITH ?objectiveId=, converging onto the
 * identical tree below. commissionFromForm itself is untouched — it's still
 * real, load-bearing test fixture infrastructure (~35 test files call it
 * directly as a one-shot "give me a commissioned SEU" helper) — only this
 * web page stopped using it. */
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

/** GET /aisworg/seu/seus/:id — full SEU detail: EBM, Capabilities (with Fulfil form), Deliverables (with Transition form), Events. */
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

/** GET /aisworg/seu/seus/:id/ebm — the EBM's own composed content
 * (Metadata/Parameters/Engineering Practices/Quality Gates/Services/
 * Capability codes/Governance/declared Deliverable Catalogue) and its own
 * Validate/Activate transition. design/mvp-build-plan/SEU Composition.md —
 * owner: "There should be a viewEBM button... create a new one. EBM page.
 * We will need this to advance the EBM states." */
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

/** POST /aisworg/seu/seus/:id/capabilities/:capabilityId/fulfil — Ch.12 direct assignment.
 * Owner: "The participants dropdown should be multi-select. It chooses as many as it wants
 * as eligible." — a real HTML multi-select submits its field once per selection, so a single
 * pick arrives as a bare string, not an array; normalise before passing it on. */
router.post("/seus/:id/capabilities/:capabilityId/fulfil", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const backTo = `/aisworg/seu/seus/${seuId}?tab=capabilities`;
  const raw = req.body?.participantMasterIds;
  const participantMasterIds: string[] = (Array.isArray(raw) ? raw : raw ? [raw] : []).map(String);

  if (participantMasterIds.length === 0) {
    return flashError(req, res, backTo, "At least one Participant is required.");
  }

  try {
    const results = await fulfilCapabilityWithParticipants({
      seuId,
      capabilityId: String(req.params.capabilityId),
      participantMasterIds,
    });
    const names = results.map((r) => r.participant.display_name).join(", ");
    return flashSuccess(req, res, backTo, `Capability "${results[0].capabilityCode}" fulfilled by ${names}.`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/capabilities/:capabilityId/fulfil error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

/**
 * POST /aisworg/seu/seus/:id/capabilities/:capabilityId/participant/:participantId/replace — Ch.13 §13
 * Participant Lifecycle Governance — Plan, Build order step 5: a small manual form calling
 * replaceParticipant directly, explicitly a placeholder adapter for a future Participant-sourcing
 * mechanism (HR system, AI orchestration platform), not the final design — see the plan's own step 5 note.
 */
router.post("/seus/:id/capabilities/:capabilityId/participant/:participantId/replace", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const backTo = `/aisworg/seu/seus/${seuId}?tab=capabilities`;
  const { participantType, displayName } = req.body ?? {};

  if (!participantType || typeof displayName !== "string" || !displayName.trim()) {
    return flashError(req, res, backTo, "Replacement Participant type and display name are required.");
  }

  try {
    const result = await replaceParticipant({
      oldParticipantId: String(req.params.participantId),
      newParticipantType: participantType as ParticipantType,
      newDisplayName: displayName,
      actorRole: req.session?.user?.role ?? "general",
      actorId: req.session?.user?.id != null ? String(req.session.user.id) : undefined,
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

/** POST /aisworg/seu/seus/:id/capabilities/:capabilityId/release — Ch.12 §7/§13, the detail
 * page's new two-step Replace (owner: "Replace should take it back to unfilled state...
 * Once user picks new participants, Click on assign again to get the status changed to
 * fulfiled"). Releases one or more currently-fulfilling Participants (checked, by type, in
 * the card's own assigned-Participants section) and reverts the Capability to Unfulfilled —
 * picking a replacement is then the ordinary Fulfil/Assign form (.../fulfil above), not part
 * of this same action. Distinct from the older .../participant/:participantId/replace route
 * just above, which stays untouched (still the atomic ad hoc swap the dry-run suite exercises). */
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

/** POST /aisworg/seu/seus/:id/deliverables/:deliverableId/transition — Ch.15/Ch.29 gated transition. */
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
      requestedBy: req.session?.user?.id ?? null,
    });
    if (!result.ok) {
      const reason = result.reason === "dependency_not_satisfied" ? "one or more dependencies aren't Satisfied yet" : "detail" in result ? result.detail : result.reason;
      return flashError(req, res, backTo, `Transition blocked: ${reason}`);
    }
    // Governance cleared and a Command was requested — dispatch outcome
    // (assigned / deferred) is decided later, asynchronously, and isn't known
    // yet at this point. The Deliverable stays put until a Participant
    // reports a result.
    return flashSuccess(req, res, backTo, `Deliverable "${result.fromState}" → "${result.toState}" requested. It stays in "${result.fromState}" until dispatched and a result is reported.`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/deliverables/:deliverableId/transition error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

/** POST /aisworg/seu/seus/:id/ebm/transition — Chapter 3 §15 "Validate Engineering
 * Model"/"Activate" (design/mvp-build-plan/SEU Composition.md, plan step 6).
 * Two separate, independently human-triggered transitions on the SEU's own
 * active EBM (Composed -> Validated -> Active), same shape as every other
 * entity transition on this page. CR-102: activating publishes EBMActivated
 * and returns immediately — finalizeCommissioning now runs asynchronously in
 * ebmActivatedHandler, off the bus, not inside this request. */
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
    const result = await transitionEbm({
      ebmId: seu.active_ebm_id,
      targetState,
      actorRole: req.session?.user?.role ?? "general",
      actorId: req.session?.user?.id != null ? String(req.session.user.id) : undefined,
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

/** POST /aisworg/seu/seus/:id/obligations/:obligationId/transition — Ch.23 §9 lifecycle. */
router.post("/seus/:id/obligations/:obligationId/transition", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const backTo = `/aisworg/seu/seus/${seuId}`;
  const { targetState } = req.body ?? {};

  if (typeof targetState !== "string" || !targetState.trim()) {
    return flashError(req, res, backTo, "Target state is required.");
  }

  try {
    const result = await transitionObligation({
      obligationId: String(req.params.obligationId),
      targetState,
      actorRole: req.session?.user?.role ?? "general",
      actorId: req.session?.user?.id != null ? String(req.session.user.id) : undefined,
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

/** POST /aisworg/seu/seus/:id/obligations/:obligationId/revise — Ch.23, migration 252: a pure Revision (no transition, no event) — the Save button on the Obligation modal. */
router.post("/seus/:id/obligations/:obligationId/revise", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const backTo = `/aisworg/seu/seus/${seuId}`;
  const { title, description, category, severity, priority, completionCriteria, assignedEntityType, assignedEntityId } = req.body ?? {};

  try {
    await reviseObligation({
      obligationId: String(req.params.obligationId),
      actorId: req.session?.user?.id != null ? String(req.session.user.id) : undefined,
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

/** POST /aisworg/seu/seus/:id/attention-items — Ch.34: create an Attention Item, optionally against a Deliverable. */
router.post("/seus/:id/attention-items", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const backTo = `/aisworg/seu/seus/${seuId}`;
  const { deliverableId, category, title, priority } = req.body ?? {};

  if (typeof category !== "string" || !category.trim() || typeof title !== "string" || !title.trim()) {
    return flashError(req, res, backTo, "Category and title are required.");
  }

  try {
    const attentionItem = await createAttentionItem({
      seuId,
      relatedObjectType: typeof deliverableId === "string" && deliverableId.trim() ? "Deliverable" : null,
      relatedObjectId: typeof deliverableId === "string" && deliverableId.trim() ? deliverableId : null,
      category,
      title,
      priority,
    });
    return flashSuccess(req, res, backTo, `Attention Item "${attentionItem.title}" created (${attentionItem.category}, ${attentionItem.priority}).`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/attention-items error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

/** POST /aisworg/seu/seus/:id/attention-items/:attentionItemId/transition — Ch.34 §9 lifecycle. */
router.post("/seus/:id/attention-items/:attentionItemId/transition", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const backTo = `/aisworg/seu/seus/${seuId}`;
  const { targetState } = req.body ?? {};

  if (typeof targetState !== "string" || !targetState.trim()) {
    return flashError(req, res, backTo, "Target state is required.");
  }

  try {
    const result = await transitionAttentionItem({
      attentionItemId: String(req.params.attentionItemId),
      targetState,
      actorRole: req.session?.user?.role ?? "general",
      actorId: req.session?.user?.id != null ? String(req.session.user.id) : undefined,
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

/** POST /aisworg/seu/seus/:id/evidence — Ch.17: collect an Evidence Item against a Deliverable. */
router.post("/seus/:id/evidence", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const backTo = `/aisworg/seu/seus/${seuId}`;
  const { deliverableId, category, title, description, source, predecessorEvidenceId } = req.body ?? {};

  if (typeof deliverableId !== "string" || !deliverableId.trim() || typeof category !== "string" || !category.trim() || typeof title !== "string" || !title.trim()) {
    return flashError(req, res, backTo, "Deliverable, category and title are required.");
  }

  try {
    const evidence = await createEvidence({
      seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverableId, category, title, description, source,
      supersedesEvidenceId: predecessorEvidenceId || null,
    });
    return flashSuccess(req, res, backTo, `Evidence "${evidence.title}" collected (${evidence.category}).`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/evidence error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

/** POST /aisworg/seu/seus/:id/evidence/:evidenceId/validate — Ch.17 §11/§13:
 *  record one validation-dimension assessment. Append-only — confidence_level
 *  is recomputed from the full history, never overwritten in place. */
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

/** POST /aisworg/seu/seus/:id/evidence/:evidenceId/transition — Ch.17 §9 lifecycle. */
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

/** POST /aisworg/seu/seus/:id/evidence/:evidenceId/link — CR-051 item 1
 *  (Ch.17 §20.2/§20.8): link an existing Evidence Item to another object it
 *  also supports. Deliverable-only from this form for now, same as
 *  collection above — the API route accepts any TransitionEntityType. */
router.post("/seus/:id/evidence/:evidenceId/link", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const backTo = `/aisworg/seu/seus/${seuId}`;
  const { deliverableId } = req.body ?? {};

  if (typeof deliverableId !== "string" || !deliverableId.trim()) {
    return flashError(req, res, backTo, "Deliverable is required.");
  }

  try {
    const result = await linkEvidenceToObject(String(req.params.evidenceId), "Deliverable", deliverableId);
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

/** POST /aisworg/seu/seus/:id/knowledge — Ch.16: observe a Knowledge Item against a Deliverable. */
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
      // The form's single "supporting Evidence" picker maps onto the new
      // §10-shaped evidenceReferences object under the "supports" key —
      // the literal relationship this field has always meant.
      evidenceReferences: evidenceId ? { supports: [evidenceId] } : undefined,
      category,
      title,
      description,
      acquisitionScope: acquisitionScope as AcquisitionScope | undefined,
      userId: req.session?.user?.id != null ? Number(req.session.user.id) : undefined,
    });
    return flashSuccess(req, res, backTo, `Knowledge Item "${knowledgeItem.title}" observed (${knowledgeItem.category}, ${knowledgeItem.acquisition_scope} scope).`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/knowledge error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

/** POST /aisworg/seu/seus/:id/knowledge/:knowledgeItemId/transition — Ch.16 §9 lifecycle. */
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
      userId: req.session?.user?.id != null ? Number(req.session.user.id) : undefined,
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

/** POST /aisworg/seu/seus/:id/knowledge/:knowledgeItemId/promote-scope — Ch.16 §12: governed Acquisition Scope promotion; raises an Organisational Learning Obligation (Ch.23 §7). */
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
      userId: req.session?.user?.id != null ? Number(req.session.user.id) : undefined,
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

/** POST /aisworg/seu/seus/:id/decisions — Ch.19: identify a Decision against a Deliverable. */
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
      // The web form captures one alternative up front (Ch.19 §9's
      // "Candidate" starting point) — further alternatives are added by
      // re-identifying, same as any other repeatable-row authoring surface
      // on this platform; no dedicated multi-alternative form yet.
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

/** POST /aisworg/seu/seus/:id/decisions/:decisionId/transition — Ch.19 §9 lifecycle. */
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

/** POST /aisworg/seu/seus/:id/external-interactions — Ch.36: record an External Interaction, optionally against a Deliverable. */
router.post("/seus/:id/external-interactions", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const backTo = `/aisworg/seu/seus/${seuId}`;
  const { deliverableId, interactionType, direction, targetSystem, purpose } = req.body ?? {};

  if (typeof interactionType !== "string" || !interactionType.trim() || typeof direction !== "string" || !direction.trim() || typeof targetSystem !== "string" || !targetSystem.trim()) {
    return flashError(req, res, backTo, "Interaction type, direction and target system are required.");
  }

  try {
    const interaction = await createExternalInteraction({
      seuId,
      deliverableId: deliverableId || null,
      interactionType,
      direction: direction as InteractionDirection,
      targetSystem,
      purpose,
    });
    return flashSuccess(req, res, backTo, `External Interaction with "${interaction.target_system}" recorded (${interaction.interaction_type}, ${interaction.direction}).`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/external-interactions error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

/** POST /aisworg/seu/seus/:id/external-interactions/:interactionId/transition — Ch.36 §9 lifecycle; a transition to Failed raises an Attention Item (Ch.36 §13). */
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
