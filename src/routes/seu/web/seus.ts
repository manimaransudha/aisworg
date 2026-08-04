import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash, flashError, flashSuccess } from "../../../utils/flash.js";
import { logger } from "../../../utils/logger.js";
import { listSeus, getSeuDetailView } from "../core/seus.js";
import { commissionFromForm } from "../core/commissioning.js";
import { fulfilCapability } from "../core/capabilities.js";
import { transitionDeliverable } from "../core/deliverables.js";
import { createObligation, transitionObligation } from "../core/obligations.js";
import { createEvidence, transitionEvidence } from "../core/evidence.js";
import { createKnowledgeItem, promoteKnowledgeItemScope, transitionKnowledgeItem } from "../core/knowledge.js";
import { createDecision, transitionDecision } from "../core/decisions.js";
import { capabilitiesDB } from "../../../dblayer/capabilitiesDB.js";
import type { AcquisitionScope, ParticipantType } from "../../../dblayer/seuTypes.js";

/** GET /aisworg/seu/seus — SEU Runtime: every commissioned SEU. */
router.get("/seus", attachVM("seu/seus/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.vm.req.title = "SEUs";
    req.vm.req.seus = await listSeus();
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/seus/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/seus] GET /seus error", err as Error);
    next(err);
  }
});

/** GET /aisworg/seu/seus/new — commissioning form (Objective statement + required Capabilities). */
router.get("/seus/new", attachVM("seu/seus/new"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data: capabilities } = await capabilitiesDB.findAll();
    req.vm.req.title = "Commission a new SEU";
    req.vm.req.capabilities = capabilities ?? [];
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/seus/new", req.vm);
  } catch (err) {
    logger.error("[web/seu/seus] GET /seus/new error", err as Error);
    next(err);
  }
});

/** POST /aisworg/seu/seus — runs the full Ch.8 pipeline (Objective → Template → Profile → commission) from one form submit. */
router.post("/seus", async (req: Request, res: Response) => {
  const { statement, requiredCapabilityCodes } = req.body ?? {};
  const codes = Array.isArray(requiredCapabilityCodes) ? requiredCapabilityCodes : requiredCapabilityCodes ? [requiredCapabilityCodes] : [];

  if (typeof statement !== "string" || !statement.trim() || codes.length === 0) {
    return flashError(req, res, "/aisworg/seu/seus/new", "Statement and at least one required Capability are required.");
  }

  try {
    const result = await commissionFromForm({
      statement,
      requiredCapabilityCodes: codes,
      actorRole: req.session?.user?.role ?? "general",
      requestedBy: req.session?.user?.id ?? null,
    });

    if (!result.ok) {
      return flashError(req, res, "/aisworg/seu/seus/new", `Commissioning failed at "${result.stage}": ${result.reason}`);
    }
    return flashSuccess(req, res, `/aisworg/seu/seus/${result.seu.id}`, `SEU commissioned — lifecycle state: ${result.seu.lifecycle_state}.`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus error", err as Error);
    return flashError(req, res, "/aisworg/seu/seus/new", (err as Error).message);
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
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/seus/detail", req.vm);
  } catch (err) {
    logger.error("[web/seu/seus] GET /seus/:id error", err as Error);
    next(err);
  }
});

/** POST /aisworg/seu/seus/:id/capabilities/:capabilityId/fulfil — Ch.12 direct assignment. */
router.post("/seus/:id/capabilities/:capabilityId/fulfil", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const backTo = `/aisworg/seu/seus/${seuId}`;
  const { participantType, displayName } = req.body ?? {};

  if (!participantType || typeof displayName !== "string" || !displayName.trim()) {
    return flashError(req, res, backTo, "Participant type and display name are required.");
  }

  try {
    const result = await fulfilCapability({
      seuId,
      capabilityId: String(req.params.capabilityId),
      participantType: participantType as ParticipantType,
      displayName,
    });
    return flashSuccess(req, res, backTo, `Capability "${result.capabilityCode}" fulfilled by ${displayName}.`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/capabilities/:capabilityId/fulfil error", err as Error);
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
      requestedBy: req.session?.user?.id ?? null,
    });
    if (!result.ok) {
      const reason = result.reason === "dependency_not_satisfied" ? "one or more dependencies aren't Satisfied yet" : "detail" in result ? result.detail : result.reason;
      return flashError(req, res, backTo, `Transition blocked: ${reason}`);
    }
    return flashSuccess(req, res, backTo, `Deliverable moved from "${result.appliedTransition.fromState}" to "${result.appliedTransition.toState}".`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/deliverables/:deliverableId/transition error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

/** POST /aisworg/seu/seus/:id/obligations — Ch.23: create an Obligation against a Deliverable. */
router.post("/seus/:id/obligations", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const backTo = `/aisworg/seu/seus/${seuId}`;
  const { deliverableId, category, title, description, severity } = req.body ?? {};

  if (typeof deliverableId !== "string" || !deliverableId.trim() || typeof category !== "string" || !category.trim() || typeof title !== "string" || !title.trim()) {
    return flashError(req, res, backTo, "Deliverable, category and title are required.");
  }

  try {
    const obligation = await createObligation({ seuId, deliverableId, category, title, description, severity });
    return flashSuccess(req, res, backTo, `Obligation "${obligation.title}" created (${obligation.category}, ${obligation.severity}).`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/obligations error", err as Error);
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

/** POST /aisworg/seu/seus/:id/evidence — Ch.17: collect an Evidence Item against a Deliverable. */
router.post("/seus/:id/evidence", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const backTo = `/aisworg/seu/seus/${seuId}`;
  const { deliverableId, category, title, description, source, confidenceLevel } = req.body ?? {};

  if (typeof deliverableId !== "string" || !deliverableId.trim() || typeof category !== "string" || !category.trim() || typeof title !== "string" || !title.trim()) {
    return flashError(req, res, backTo, "Deliverable, category and title are required.");
  }

  try {
    const evidence = await createEvidence({ seuId, deliverableId, category, title, description, source, confidenceLevel });
    return flashSuccess(req, res, backTo, `Evidence "${evidence.title}" collected (${evidence.category}, confidence ${evidence.confidence_level}).`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/evidence error", err as Error);
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
      evidenceId: evidenceId || null,
      category,
      title,
      description,
      acquisitionScope: acquisitionScope as AcquisitionScope | undefined,
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
  const { deliverableId, knowledgeId, evidenceId, category, title, engineeringQuestion, selectedAlternative, rationale } = req.body ?? {};

  if (typeof deliverableId !== "string" || !deliverableId.trim() || typeof category !== "string" || !category.trim() || typeof title !== "string" || !title.trim()) {
    return flashError(req, res, backTo, "Deliverable, category and title are required.");
  }

  try {
    const decision = await createDecision({
      seuId,
      deliverableId,
      knowledgeId: knowledgeId || null,
      evidenceId: evidenceId || null,
      category,
      title,
      engineeringQuestion,
      selectedAlternative,
      rationale,
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

export { router };
