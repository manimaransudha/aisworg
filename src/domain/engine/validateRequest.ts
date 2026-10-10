import { seusDB } from "../../dblayer/seusDB.js";
import { objectivesDB } from "../../dblayer/objectivesDB.js";
import { templatesDB } from "../../dblayer/templatesDB.js";
import { profilesDB } from "../../dblayer/profilesDB.js";
import { checkRequestLiveness, type LivenessCheck } from "../../routes/seu/core/commissioning.js";
import { logger } from "../../utils/logger.js";
import { eventBus } from "./eventBus.js";
import { transitionEngine } from "./transitionEngine.js";
import type { EventHandler } from "./eventBus.js";
import type { EventRow, SeuRow, ObjectiveRow, TemplateRow, ProfileRow } from "../../dblayer/seuTypes.js";
import { getPlatformTenantId } from "../../dblayer/constants.js";
 
interface CommissionRequestedPayload {
  seuId: string;
}

async function failValidation(seu: { id: string }, event: EventRow, reason: string): Promise<void> {
  await seusDB.updateLifecycleState(seu.id, "Failed");
  await eventBus.publish({
    eventType: "CommissionFailed",
    originatingObjectType: "SEU",
    originatingObjectId: seu.id,
    seuId: seu.id,
    correlationId: event.correlation_id,
    causationId: event.id,
    actorId: event.actor_id,
    authorityBadge: event.authority_badge,
    payload: { stage: "validate_request", reason },
  });
}

export const validateRequestHandler: EventHandler = async (event: EventRow) => {
  const { seuId } = event.payload as unknown as CommissionRequestedPayload;
  const { data: seu } = await seusDB.findById(seuId);
  if (!seu) {
    logger.error(`[validateRequest] SEU not found: ${seuId}`);
    return;
  }
  const { data: objective } = await objectivesDB.findById(seu.objective_id);
  const { data: template } = await templatesDB.findById(seu.template_id);
  const { data: profile } = await profilesDB.findById(seu.profile_id);
  if (!objective || !template || !profile) {
    logger.error(`[validateRequest] Objective/Template/Profile referenced by SEU ${seuId} not found`);
    return;
  }
  try {
    await runValidation(seu, objective, template, profile, event);
  } catch (err) {
    await failValidation(seu, event, (err as Error).message);
  }
};

async function runValidation(seu: SeuRow, objective: ObjectiveRow, template: TemplateRow, profile: ProfileRow, event: EventRow): Promise<void> {
  const viewerTenantId = seu.tenant_id ?? (await getPlatformTenantId());

  const gate = await transitionEngine.evaluate({
    entityType: "SEU",
    fromState: "Pending",
    toState: "Commissioned",
    actorRole: "system",
    actorId: event.actor_id,
    context: { profile, objective },
  });
  const authorityCheck: LivenessCheck = gate.allowed
    ? { item: "Authority (badge seu_commission)", status: "live", detail: `authorised via ${gate.authorityBadge ?? "system"}` }
    : {
        item: "Authority (badge seu_commission)",
        status: "dead",
        detail: gate.reason === "authority_denied" ? `missing badge ${gate.authorityRuleCode}` : gate.reason === "policy_blocked" ? `policy "${gate.policyCode}" blocked` : gate.reason,
      };
  if (!gate.allowed) {
    await seusDB.updateLifecycleState(seu.id, "Failed");
    await eventBus.publish({
      eventType: "CommissionFailed",
      originatingObjectType: "SEU",
      originatingObjectId: seu.id,
      seuId: seu.id,
      correlationId: event.correlation_id,
      causationId: event.id,
      actorId: event.actor_id,
      authorityBadge: event.authority_badge,
      payload: { stage: "validate_request", checks: [authorityCheck], ...gate },
    });
    return;
  }

  const livenessChecks = await checkRequestLiveness({ objective, templates: [template], profile, viewerTenantId });
  const checks = [authorityCheck, ...livenessChecks];
  const deadReferences = livenessChecks.filter((c) => c.status === "dead").map((c) => (c.detail ? `${c.item} ${c.detail}` : c.item));
  if (deadReferences.length > 0) {
    await seusDB.updateLifecycleState(seu.id, "Failed");
    await eventBus.publish({
      eventType: "CommissionFailed",
      originatingObjectType: "SEU",
      originatingObjectId: seu.id,
      seuId: seu.id,
      correlationId: event.correlation_id,
      causationId: event.id,
      actorId: event.actor_id,
      authorityBadge: event.authority_badge,
      payload: { stage: "validate_request", reason: "stale_reference", references: deadReferences, checks },
    });
    return;
  }

  await eventBus.publish({
    eventType: "CommissionValidated",
    originatingObjectType: "SEU",
    originatingObjectId: seu.id,
    seuId: seu.id,
    correlationId: event.correlation_id,
    causationId: event.id,
    actorId: event.actor_id,
    authorityBadge: gate.authorityBadge ?? "system",
    payload: {
      objectiveId: seu.objective_id,
      templateIds: [seu.template_id],
      profileIds: [seu.profile_id],
      viewerTenantId,
      checks,
    },
  });
}
